# app.py - College Assistant RAG Backend (SIH Final Version)

from dotenv import load_dotenv
load_dotenv()
import json
from fastapi.responses import StreamingResponse
import os
import time
import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor
import tempfile
import asyncio
import warnings

import time
from fastapi.responses import StreamingResponse

from fastapi import FastAPI, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
import uvicorn

# LangChain
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_ollama import OllamaLLM
from langchain.chains import RetrievalQA
from fastapi.responses import StreamingResponse

# Speech libs
import whisper
from gtts import gTTS

# PDF loaders
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

try:
    from langchain_community.document_loaders import PyPDFLoader
    LANGCHAIN_PDF_AVAILABLE = True
except ImportError:
    LANGCHAIN_PDF_AVAILABLE = False

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", module="langchain")

# -------------------- CONFIG --------------------
PERSIST_DIR = os.getenv("PERSIST_DIR", "./chroma_db")
DEFAULT_K = int(os.getenv("DEFAULT_K", "5"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TEMP_MD_DIR = os.getenv("TEMP_MD_DIR", "./temp_md")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))

os.makedirs(PERSIST_DIR, exist_ok=True)
os.makedirs(TEMP_MD_DIR, exist_ok=True)

executor = ThreadPoolExecutor(max_workers=4)

# -------------------- FASTAPI --------------------
app = FastAPI(
    title="College Assistant RAG API (SIH Final Version)",
    version="6.0",
    description="RAG backend with admin approval workflow, student chat, and voice chat"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
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

class UploadResponse(BaseModel):
    message: str
    num_chunks: int
    stored_at: str

# -------------------- GLOBALS --------------------
_vectorstore = None
_qa_instances = {}
upload_progress = {}
_doc_approval_status: Dict[str, bool] = {}

# -------------------- UTILS --------------------
def extract_text_from_pdf(pdf_path: Path) -> str:
    if PDFPLUMBER_AVAILABLE:
        with pdfplumber.open(pdf_path) as pdf:
            return "\n\n".join([p.extract_text() or "" for p in pdf.pages])
    if LANGCHAIN_PDF_AVAILABLE:
        loader = PyPDFLoader(str(pdf_path))
        return "\n\n".join([p.page_content for p in loader.load()])
    if PYPDF2_AVAILABLE:
        reader = PyPDF2.PdfReader(open(pdf_path, "rb"))
        return "\n\n".join([p.extract_text() or "" for p in reader.pages])
    raise ImportError("No PDF loader available. Install pdfplumber or PyPDF2.")

def preprocess_text(text: str) -> str:
    text = text.replace("&amp;", "&")
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()

def chunk_text(text: str, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP) -> List[str]:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", "! ", "? ", " "],
        length_function=len,
    )
    chunks = splitter.split_text(text)
    return [c.strip() for c in chunks if len(c.strip()) > 50]

def embed_and_store_fast(chunks: List[str], metadata: Optional[List[Dict]] = None, batch_size: int = BATCH_SIZE):
    global _vectorstore
    if _vectorstore is None:
        embeddings = OllamaEmbeddings(model="nomic-embed-text")
        _vectorstore = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)

    total = len(chunks)
    if total <= batch_size:
        _vectorstore.add_texts(texts=chunks, metadatas=metadata)
        return _vectorstore

    futures = []
    for i in range(0, total, batch_size):
        batch = chunks[i:i+batch_size]
        meta_batch = metadata[i:i+batch_size] if metadata else None
        futures.append(executor.submit(_vectorstore.add_texts, texts=batch, metadatas=meta_batch))

    for f in futures:
        f.result()
    return _vectorstore

def create_college_context_prompt(query: str, department: str) -> str:
    return f"""
    You are a helpful college assistant specializing in {department}.
    You respond in the same language as the query is asked in
    Department Context: {department}
    Student Question: {query}
    """

def get_qa_chain(k: int = DEFAULT_K, chain_type: str = "stuff"):
    if _vectorstore is None:
        raise HTTPException(status_code=500, detail="Vectorstore empty. Upload docs first.")
    cache_key = f"{chain_type}::k={k}"
    if cache_key in _qa_instances:
        return _qa_instances[cache_key]
    retriever = _vectorstore.as_retriever(search_kwargs={"k": k})
    llm = OllamaLLM(model="llama3:8b", temperature=0)
    qa = RetrievalQA.from_chain_type(llm=llm, retriever=retriever, chain_type=chain_type, return_source_documents=True)
    _qa_instances[cache_key] = qa
    return qa

@app.get("/health")
def health():
    return {"status": "ok", "vectorstore_loaded": _vectorstore is not None}

# -------------------- STARTUP --------------------
@app.on_event("startup")
def startup_event():
    global _vectorstore
    try:
        embeddings = OllamaEmbeddings(model="nomic-embed-text")
        _vectorstore = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
        print(f"✅ Vector DB loaded from {PERSIST_DIR}")
    except Exception as e:
        print(f"❌ Failed to load vectorstore: {e}")
        _vectorstore = None
    _ = OllamaLLM(model="llama3:8b", temperature=0)
    print("🔥 Models preloaded. API Ready!")

# -------------------- STUDENT CHAT --------------------
@app.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(payload: ChatRequest = Body(...)):
    if _vectorstore is None:
        return ChatResponse(
            response="Vectorstore not initialized. Upload some PDFs first or call /test_retrieval.",
            department=payload.department,
            sources=[],
            elapsed_seconds=0.0,
        )
    start = time.time()
    query = create_college_context_prompt(payload.message, payload.department)
    qa = get_qa_chain(k=payload.k or DEFAULT_K, chain_type=payload.chain_type)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, qa.invoke, {"query": query})
    start = time.time()
    query = create_college_context_prompt(payload.message, payload.department)
    qa = get_qa_chain(k=payload.k or DEFAULT_K, chain_type=payload.chain_type)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, qa.invoke, {"query": query})

    # filter: only approved docs
    approved_docs = []
    for doc in result.get("source_documents", []):
        if _doc_approval_status.get(doc.metadata.get("source"), False):
            approved_docs.append(doc)

    elapsed = time.time() - start
    return ChatResponse(
        response=result.get("result", ""),
        department=payload.department,
        sources=[{"source": d.metadata.get("source")} for d in approved_docs],
        elapsed_seconds=round(elapsed, 3)
    )

@app.post("/chat_stream")
async def chat_stream(payload: ChatRequest = Body(...)):
    query = create_college_context_prompt(payload.message, payload.department)
    qa = get_qa_chain(k=payload.k or DEFAULT_K, chain_type=payload.chain_type)

    def event_stream():
        retriever = qa.retriever
        docs = retriever.get_relevant_documents(query)
        yield json.dumps({"type": "status", "message": "📚 Retrieved documents"}) + "\n"
        for d in docs:
            preview = d.page_content[:120].replace("\n", " ")
            yield json.dumps({"type": "doc", "source": d.metadata.get("source"), "preview": preview}) + "\n"

        yield json.dumps({"type": "status", "message": "🤔 Generating answer..."}) + "\n"

        result = qa.invoke({"query": query})
        text = result.get("result", "")
        for word in text.split():
            yield json.dumps({"type": "token", "text": word + " "}) + "\n"

        yield json.dumps({"type": "done"}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/json")

# -------------------- ADMIN CHAT --------------------
@app.post("/admin_chat", response_model=ChatResponse)
async def admin_chat(payload: ChatRequest = Body(...)):
    start = time.time()
    query = create_college_context_prompt(payload.message, payload.department)
    qa = get_qa_chain(k=payload.k or DEFAULT_K, chain_type=payload.chain_type)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, qa.invoke, {"query": query})
    elapsed = time.time() - start
    return ChatResponse(
        response=result.get("result", ""),
        department=payload.department,
        sources=[{"source": d.metadata.get("source")} for d in result.get("source_documents", [])],
        elapsed_seconds=round(elapsed, 3)
    )

# -------------------- ADMIN DOC CONTROL --------------------
@app.post("/upload_pdf", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDFs supported")
    content = await file.read()
    temp_path = Path(TEMP_MD_DIR) / file.filename
    temp_path.write_bytes(content)

    text = extract_text_from_pdf(temp_path)
    text = preprocess_text(text)
    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No valid text extracted")

    metadata = [{"source": file.filename, "chunk_id": i} for i in range(len(chunks))]
    embed_and_store_fast(chunks, metadata)
    _doc_approval_status[file.filename] = False

    try: temp_path.unlink()
    except: pass

    return UploadResponse(message="Upload successful (awaiting approval)", num_chunks=len(chunks), stored_at=PERSIST_DIR)

# Async ingestion
async def process_pdf_background(upload_id: str, file_content: bytes, filename: str):
    try:
        temp_path = Path(TEMP_MD_DIR) / filename
        temp_path.write_bytes(file_content)
        upload_progress[upload_id] = {"status": "processing", "progress": 20}

        text = extract_text_from_pdf(temp_path)
        text = preprocess_text(text)
        chunks = chunk_text(text)
        if not chunks:
            upload_progress[upload_id] = {"status": "error", "error": "No valid text"}
            return

        metadata = [{"source": filename, "chunk_id": i} for i in range(len(chunks))]
        embed_and_store_fast(chunks, metadata)
        _doc_approval_status[filename] = False

        upload_progress[upload_id] = {"status": "completed", "progress": 100, "num_chunks": len(chunks)}
        try: temp_path.unlink()
        except: pass
    except Exception as e:
        upload_progress[upload_id] = {"status": "error", "error": str(e)}

@app.post("/upload_pdf_async")
async def upload_pdf_async(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()
    upload_id = f"{file.filename}_{int(time.time())}"
    upload_progress[upload_id] = {"status": "started", "progress": 0}
    background_tasks.add_task(process_pdf_background, upload_id, content, file.filename)
    return {"upload_id": upload_id, "message": "Upload started"}

@app.get("/upload_status/{upload_id}")
def get_upload_status(upload_id: str):
    return upload_progress.get(upload_id, {"status": "not_found"})

@app.post("/approve_doc/{filename}")
def approve_doc(filename: str):
    if filename not in _doc_approval_status:
        raise HTTPException(status_code=404, detail="Doc not found")
    _doc_approval_status[filename] = True
    return {"message": f"{filename} approved and now available to students"}

@app.delete("/delete_doc/{filename}")
def delete_doc(filename: str):
    global _vectorstore
    try:
        _vectorstore._collection.delete(where={"source": filename})
        _doc_approval_status.pop(filename, None)
        return {"message": f"{filename} deleted from vectorstore"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")

@app.post("/test_retrieval")
def test_retrieval(request: ChatRequest):
    if _vectorstore is None:
        return {"status": "error", "message": "No docs uploaded"}
    retriever = _vectorstore.as_retriever(search_kwargs={"k": 5})
    docs = retriever.get_relevant_documents(request.message)
    return {
        "status": "success",
        "query": request.message,
        "retrieved_docs": [
            {"source": d.metadata.get("source"), "preview": d.page_content[:200]}
            for d in docs
        ]
    }

# -------------------- VOICE CHAT --------------------
import torch

@app.post("/voice_chat")
async def voice_chat(file: UploadFile = File(...)):
    # Save audio safely with a temp filename
    audio_path = Path(tempfile.mktemp(suffix=".wav"))
    audio_path.write_bytes(await file.read())

    # Pick device automatically
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🔥 Using device: {device}")

    # Load Whisper model
    model = whisper.load_model("base").to(device)

    # Transcribe
    result = model.transcribe(str(audio_path))
    query = result["text"]

    qa = get_qa_chain()
    response = qa.invoke({"query": query})["result"]

    # TTS response
    tts = gTTS(response)
    out_path = Path(tempfile.mktemp(suffix=".mp3"))
    tts.save(out_path)

    try:
        audio_path.unlink()
    except:
        pass

    return FileResponse(out_path, media_type="audio/mpeg", filename="response.mp3")


# -------------------- RUN --------------------
if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
