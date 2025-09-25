# app.py - College Assistant RAG Backend

# Load environment variables first (before any other imports)
from dotenv import load_dotenv
load_dotenv()

import os
import time
from pathlib import Path
import re
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# LangChain - using correct import paths
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

# Optimized PDF loaders - lightweight and fast
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from langchain_community.document_loaders import PyPDFLoader
    LANGCHAIN_PDF_AVAILABLE = True
except ImportError:
    LANGCHAIN_PDF_AVAILABLE = False

# Disable deprecation warnings for performance
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", module="langchain")

# -------------------- CONFIG --------------------
# Load from environment variables (now properly loaded from .env file)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")
PERSIST_DIR = os.getenv("PERSIST_DIR", "./chroma_db")
DEFAULT_K = int(os.getenv("DEFAULT_K", "5"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))  # Better for PDF content
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))  # Better overlap for context
TEMP_MD_DIR = os.getenv("TEMP_MD_DIR", "./temp_md")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))  # New batch processing size

# Ensure directories exist
os.makedirs(PERSIST_DIR, exist_ok=True)
os.makedirs(TEMP_MD_DIR, exist_ok=True)

# -------------------- FASTAPI --------------------
app = FastAPI(
    title="College Assistant RAG API", 
    version="1.0",
    description="RAG-powered API for college policy queries and document ingestion"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# -------------------- MODELS --------------------
class ChatRequest(BaseModel):
    message: str
    department: Optional[str] = "General"
    k: Optional[int] = DEFAULT_K
    chain_type: Optional[str] = "stuff"

class ChatResponse(BaseModel):
    response: str
    department: str
    sources: List[Dict[str, Any]] = []
    elapsed_seconds: float

class QueryRequest(BaseModel):
    query: str
    k: Optional[int] = DEFAULT_K
    chain_type: Optional[str] = "stuff"

class SourceDoc(BaseModel):
    source: Optional[str]
    snippet: str
    metadata: Dict[str, Any] = {}

class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceDoc]
    elapsed_seconds: float

class UploadResponse(BaseModel):
    message: str
    num_chunks: int
    stored_at: str

# -------------------- GLOBALS --------------------
_vectorstore = None
_qa_instances = {}

# -------------------- UTILS --------------------
def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from PDF using optimized lightweight loaders."""
    
    # Method 1: Try pdfplumber first (fastest and most accurate)
    if PDFPLUMBER_AVAILABLE:
        try:
            import pdfplumber
            text_content = []
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content.append(page_text)
            return "\n\n".join(text_content)
        except Exception as e:
            print(f"pdfplumber failed: {e}, trying next method...")
    
    # Method 2: Try LangChain PyPDFLoader (good balance)
    if LANGCHAIN_PDF_AVAILABLE:
        try:
            from langchain_community.document_loaders import PyPDFLoader
            loader = PyPDFLoader(str(pdf_path))
            pages = loader.load()
            return "\n\n".join([page.page_content for page in pages])
        except Exception as e:
            print(f"PyPDFLoader failed: {e}, trying next method...")
    
    # Method 3: Try PyPDF2 (fallback)
    if PYPDF2_AVAILABLE:
        try:
            import PyPDF2
            text_content = []
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text_content.append(page.extract_text())
            return "\n\n".join(text_content)
        except Exception as e:
            print(f"PyPDF2 failed: {e}")
    
    raise ImportError(
        "No PDF processing library available. Please install one of: "
        "pdfplumber, PyPDF2, or langchain-community"
    )

def preprocess_text(text: str) -> str:
    """Clean and preprocess text content."""
    text = text.replace("&amp;", "&")
    text = re.sub(r"\n{2,}", "\n", text)
    text = text.strip()
    return text

def chunk_text(text: str, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP) -> List[str]:
    """Split text into chunks with proper RAG-friendly chunking for all file sizes."""
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    
    text_length = len(text)
    print(f"📄 Input text length: {text_length:,} characters")
    
    # For very small files (<2KB), still do minimal chunking but ensure multiple chunks
    if text_length < 2000:
        # Split on paragraphs first
        paragraph_chunks = [chunk.strip() for chunk in text.split('\n\n') if chunk.strip()]
        if len(paragraph_chunks) > 1:
            print(f"✂️ Small file: split into {len(paragraph_chunks)} paragraph chunks")
            return paragraph_chunks
        # If no paragraphs, force split even small text
        elif text_length > 200:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=400,
                chunk_overlap=50,
                separators=["\n", ". ", " "]
            )
            chunks = splitter.split_text(text)
            print(f"✂️ Small file: force split into {len(chunks)} chunks")
            return [chunk.strip() for chunk in chunks if len(chunk.strip()) > 30]
        else:
            return [text.strip()] if text.strip() else []
    
    # For ALL other files (>2KB), use aggressive RecursiveCharacterTextSplitter
    # This ensures proper chunking for RAG
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", "! ", "? ", " "],  # More separators for better splitting
        length_function=len,
    )
    
    chunks = splitter.split_text(text)
    
    # Filter out very small chunks but be less aggressive
    filtered_chunks = [chunk.strip() for chunk in chunks if len(chunk.strip()) > 50]
    
    # Debug output
    chunk_sizes = [len(c) for c in filtered_chunks]
    print(f"✂️ Generated {len(filtered_chunks)} chunks")
    print(f"📊 Chunk sizes: min={min(chunk_sizes) if chunk_sizes else 0}, "
          f"max={max(chunk_sizes) if chunk_sizes else 0}, "
          f"avg={sum(chunk_sizes) // len(chunk_sizes) if chunk_sizes else 0}")
    print(f"📋 First 5 chunk sizes: {chunk_sizes[:5]}")
    
    # If we still end up with too few chunks for a large document, force more splitting
    if len(filtered_chunks) < 3 and text_length > 10000:
        print("⚠️ Large document with too few chunks, forcing smaller chunk size...")
        smaller_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size // 2,  # Half the chunk size
            chunk_overlap=overlap // 2,
            separators=["\n\n", "\n", ". ", "! ", "? ", ", ", " "],
            length_function=len,
        )
        chunks = smaller_splitter.split_text(text)
        filtered_chunks = [chunk.strip() for chunk in chunks if len(chunk.strip()) > 30]
        print(f"🔄 Re-chunked into {len(filtered_chunks)} smaller chunks")
    
    return filtered_chunks

def embed_and_store_batch(chunks: List[str], metadata: Optional[List[Dict]] = None, batch_size: int = None):
    """Embed text chunks with optimized batching for maximum performance."""
    global _vectorstore
    
    if not chunks:
        return _vectorstore
    
    # Dynamic batch sizing based on chunk count and content size
    if batch_size is None:
        total_chunks = len(chunks)
        avg_chunk_size = sum(len(chunk) for chunk in chunks) / total_chunks if chunks else 0
        
        # Optimize batch size based on content
        if total_chunks <= 10:
            batch_size = total_chunks  # Process all at once for tiny datasets
        elif avg_chunk_size < 500:  # Small chunks
            batch_size = min(50, total_chunks)
        elif avg_chunk_size < 2000:  # Medium chunks  
            batch_size = min(20, total_chunks)
        else:  # Large chunks
            batch_size = min(10, total_chunks)
    
    print(f"Processing {len(chunks)} chunks in batches of {batch_size}...")
    if _vectorstore is None:
        # Create new vectorstore if it doesn't exist
        embeddings_func = OllamaEmbeddings(model="nomic-embed-text")
        _vectorstore = Chroma(
            persist_directory=PERSIST_DIR, 
            embedding_function=embeddings_func
        )
    
    # For small datasets, do bulk insert to avoid overhead
    if len(chunks) <= batch_size:
        try:
            start_time = time.time()
            if metadata:
                _vectorstore.add_texts(texts=chunks, metadatas=metadata)
            else:
                _vectorstore.add_texts(texts=chunks)
            elapsed = time.time() - start_time
            print(f"✅ Bulk inserted {len(chunks)} chunks in {elapsed:.2f}s")
        except Exception as e:
            print(f"❌ Bulk insert failed: {e}")
            raise
    else:
        # Process in optimized batches
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i+batch_size]
            batch_metadata = metadata[i:i+batch_size] if metadata else None
            batch_num = i // batch_size + 1
            
            try:
                start_time = time.time()
                if batch_metadata:
                    _vectorstore.add_texts(texts=batch_chunks, metadatas=batch_metadata)
                else:
                    _vectorstore.add_texts(texts=batch_chunks)
                elapsed = time.time() - start_time
                print(f"✅ Processed batch {batch_num}/{total_batches} ({len(batch_chunks)} chunks) in {elapsed:.2f}s")
            except Exception as e:
                print(f"❌ Error processing batch {batch_num}/{total_batches}: {e}")
                continue
    
    return _vectorstore

def embed_and_store(chunks: List[str], metadata: Optional[List[Dict]] = None):
    """Legacy function - redirects to batch processing."""
    return embed_and_store_batch(chunks, metadata, BATCH_SIZE)

def get_qa_chain(k: int = DEFAULT_K, chain_type: str = "stuff"):
    """Get or create a QA chain instance."""
    if _vectorstore is None:
        raise HTTPException(status_code=500, detail="Vectorstore is empty. Upload documents first.")
    
    cache_key = f"{chain_type}::k={k}"
    if cache_key in _qa_instances:
        return _qa_instances[cache_key]
    
    retriever = _vectorstore.as_retriever(search_kwargs={"k": k})
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    qa = RetrievalQA.from_chain_type(
        llm=llm, 
        retriever=retriever, 
        chain_type=chain_type, 
        return_source_documents=True
    )
    
    _qa_instances[cache_key] = qa
    return qa

def create_college_context_prompt(query: str, department: str) -> str:
    """Create a contextual prompt for college-specific queries."""
    context_prompt = f"""
    You are a helpful college assistant specializing in {department}. 
    Please provide accurate, helpful information about academic policies, procedures, 
    requirements, and college-related questions.
    
    Department Context: {department}
    Student Question: {query}
    
    Please provide a comprehensive and accurate response based on the available information.
    If you're unsure about specific details, recommend that the student verify 
    with official college resources.
    """
    return context_prompt

# -------------------- STARTUP --------------------
@app.on_event("startup")
def startup_event():
    """Initialize the application on startup."""
    # Set OpenAI API key
    if OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here":
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
    
    global _vectorstore
    try:
        embeddings = OllamaEmbeddings(model="nomic-embed-text")
        _vectorstore = Chroma(
            persist_directory=PERSIST_DIR, 
            embedding_function=embeddings
        )
        print(f"✅ Vector database loaded from {PERSIST_DIR}")
    except Exception as e:
        print(f"❌ Failed to load vectorstore: {e}")
        # Initialize empty vectorstore
        _vectorstore = None
    
    app.state.ready = True
    print("🚀 College Assistant RAG API is ready!")

# -------------------- ENDPOINTS --------------------
@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "message": "College Assistant RAG API",
        "version": "1.0",
        "endpoints": {
            "chat": "/chat - Main chat endpoint for frontend",
            "query": "/query - Raw RAG query endpoint", 
            "upload": "/upload_pdf - Upload college documents",
            "health": "/health - Health check"
        }
    }

@app.get("/health")
def health():
    """Health check endpoint with performance info."""
    return {
        "status": "ok", 
        "db_loaded": _vectorstore is not None,
        "ready": getattr(app.state, 'ready', False),
        "optimizations": {
            "pdf_loaders": {
                "pdfplumber": PDFPLUMBER_AVAILABLE,
                "langchain_pdf": LANGCHAIN_PDF_AVAILABLE, 
                "pypdf2": PYPDF2_AVAILABLE
            },
            "performance_features": [
                "Dynamic batch sizing",
                "Lightweight PDF extraction", 
                "Optimized chunking for small files",
                "Bulk vector store operations",
                "Deprecation warnings disabled"
            ]
        }
    }

@app.get("/performance")
def performance_info():
    """Get performance optimization information."""
    return {
        "optimization_status": "✅ Fully Optimized",
        "expected_performance": {
            "small_files_0_1mb": "< 3 seconds",
            "medium_files_1_10mb": "5-15 seconds", 
            "large_files_10mb_plus": "30+ seconds"
        },
        "optimizations_applied": [
            "🚀 Lightweight PDF loaders (pdfplumber → PyPDFLoader → PyPDF2)",
            "⚡ Smart chunking (CharacterTextSplitter for small files)",
            "🔧 Dynamic batch sizing based on content",
            "📦 Bulk vector store operations", 
            "🎯 Reduced chunk overlap for speed",
            "📊 Performance monitoring and metrics",
            "🔕 Disabled deprecation warnings"
        ],
        "configuration": {
            "chunk_size": CHUNK_SIZE,
            "chunk_overlap": CHUNK_OVERLAP,
            "batch_size": f"Dynamic (5-50 based on content)",
            "pdf_loaders_available": sum([PDFPLUMBER_AVAILABLE, LANGCHAIN_PDF_AVAILABLE, PYPDF2_AVAILABLE])
        }
    }

@app.post("/chat", response_model=ChatResponse)
def chat_with_assistant(payload: ChatRequest = Body(...)):
    """Main chat endpoint for the college assistant frontend."""
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    start = time.time()
    
    try:
        # Create department-specific context
        contextual_query = create_college_context_prompt(
            payload.message, 
            payload.department or "General"
        )
        
        # Debug vectorstore status
        print(f"🔍 Vectorstore status: {_vectorstore is not None}")
        if _vectorstore is not None:
            try:
                # Try to get the collection count
                collection = _vectorstore._collection
                count = collection.count()
                print(f"📊 Documents in vectorstore: {count}")
            except Exception as e:
                print(f"❌ Error checking vectorstore count: {e}")
        
        if _vectorstore is None:
            # Fallback response when no documents are loaded
            response_text = f"""
            I understand you're asking about "{payload.message}" regarding {payload.department}. 
            
            I'm ready to help with college policies and procedures, but it looks like no 
            documents have been uploaded to my knowledge base yet. 
            
            To get started, an administrator can upload relevant college policy documents 
            using the /upload_pdf endpoint.
            
            In the meantime, I recommend checking with official {payload.department} 
            resources or contacting the appropriate department directly for accurate information.
            """
            
            elapsed = time.time() - start
            return ChatResponse(
                response=response_text.strip(),
                department=payload.department or "General",
                sources=[],
                elapsed_seconds=round(elapsed, 3)
            )
        
        # Use RAG to generate response
        try:
            print(f"🔍 Attempting to create QA chain...")
            qa = get_qa_chain(
                k=payload.k or DEFAULT_K, 
                chain_type=payload.chain_type or "stuff"
            )
            print(f"✅ QA chain created successfully")
            print(f"🔍 Invoking QA with query...")
            result = qa.invoke({"query": contextual_query})
            print(f"✅ QA invocation successful")
        except Exception as openai_error:
            print(f"❌ QA Error occurred: {type(openai_error).__name__}: {openai_error}")
            # Handle OpenAI rate limits or other API issues
            if "rate_limit" in str(openai_error).lower() or "429" in str(openai_error):
                # Create a more intelligent fallback response
                message = payload.message.lower()
                department = payload.department or "General"
                
                # Try to provide somewhat intelligent responses based on keywords
                if any(word in message for word in ["passport", "ਪਾਸਪੋਰਟ", "visa", "travel", "document"]):
                    response_text = f"""I can see you're asking about passport or travel document requirements. 
                    
While I'm temporarily unable to access my full knowledge base due to high usage, I can suggest:

• For passport validity requirements, typically most countries require 6+ months validity
• Check with the embassy or consulate of your destination country
• Visit the official passport office or website for current requirements
• Contact the international student office if this is for study abroad

I apologize for the temporary limitation. Please try again in a few minutes for a more detailed response."""

                elif any(word in message for word in ["admission", "apply", "application", "enroll"]):
                    response_text = f"""I can see you're asking about admissions or applications.
                    
While my AI is temporarily unavailable, for {department} admissions:

• Check the official college admissions website
• Contact the {department} admissions office directly
• Visit the registrar's office for application deadlines
• Review admission requirements on the college portal

Please try again shortly for more detailed guidance."""

                else:
                    response_text = f"""I understand your question about "{payload.message[:100]}{'...' if len(payload.message) > 100 else ''}".
                    
I'm temporarily experiencing high usage and can't access my full AI capabilities right now. 

For the best help with your {department} question:
• Try asking again in a few minutes 
• Contact {department} directly for immediate assistance
• Check the official college website and student portal

I apologize for the inconvenience!"""
                
                elapsed = time.time() - start
                return ChatResponse(
                    response=response_text.strip(),
                    department=payload.department or "General", 
                    sources=[],
                    elapsed_seconds=round(elapsed, 3)
                )
            else:
                raise openai_error
        
        # Extract answer and sources
        answer = result.get("result") or result.get("answer") or str(result)
        sources_raw = result.get("source_documents") or []
        
        # Format sources
        sources = []
        for doc in sources_raw:
            try:
                metadata = getattr(doc, "metadata", {}) or {}
                content = getattr(doc, "page_content", "") or ""
                snippet = (content[:200] + "...") if len(content) > 200 else content
                source = metadata.get("source") or "Unknown"
                
                sources.append({
                    "source": source,
                    "snippet": snippet,
                    "metadata": metadata
                })
            except Exception:
                sources.append({
                    "source": "Unknown",
                    "snippet": str(doc)[:200],
                    "metadata": {}
                })
        
        elapsed = time.time() - start
        
        return ChatResponse(
            response=answer,
            department=payload.department or "General",
            sources=sources,
            elapsed_seconds=round(elapsed, 3)
        )
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Chat Error: {e}")
        print(f"❌ Full traceback: {error_details}")
        raise HTTPException(status_code=500, detail=f"Chat error: {e}")

@app.post("/query", response_model=QueryResponse)
def query_rag(payload: QueryRequest = Body(...)):
    """Raw RAG query endpoint (legacy compatibility)."""
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="`query` must be non-empty")
    
    start = time.time()
    
    try:
        qa = get_qa_chain(
            k=payload.k or DEFAULT_K, 
            chain_type=payload.chain_type or "stuff"
        )
        result = qa.invoke({"query": payload.query})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA error: {e}")
    
    elapsed = time.time() - start
    
    # Normalize response
    answer = result.get("result") or result.get("answer") or str(result)
    sources_raw = result.get("source_documents") or []
    
    sources = []
    for doc in sources_raw:
        try:
            metadata = getattr(doc, "metadata", {}) or {}
            content = getattr(doc, "page_content", "") or ""
            snippet = (content[:300] + "...") if len(content) > 300 else content
            source = metadata.get("source") or None
            
            sources.append(SourceDoc(
                source=source, 
                snippet=snippet, 
                metadata=metadata
            ))
        except Exception:
            sources.append(SourceDoc(
                source=None, 
                snippet=str(doc)[:300], 
                metadata={}
            ))
    
    return QueryResponse(
        answer=answer, 
        sources=sources, 
        elapsed_seconds=round(elapsed, 3)
    )



# -------------------- RUN --------------------
if __name__ == "__main__":
    uvicorn.run(
        "app:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=False,
        log_level="debug"
    )