// src/components/ChatInterface.jsx
import React, { useState, useRef } from 'react';
import { Bell, FileText, Settings, Info } from 'lucide-react';
import sendIcon from '../icons/send.svg';
import voiceIcon from '../icons/voice_mode.svg';
import dexterIcon from '../icons/dexter.svg';
import micIcon from '../icons/microphone.svg';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ChatInterface = () => {
  const [currentView, setCurrentView] = useState('welcome'); // 'welcome' | 'chatting'
  const [messages, setMessages] = useState([]); // chat history
  const [thinking, setThinking] = useState([]); // temporary "trace"
  const [inputValue, setInputValue] = useState('');
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  // ---------------- TEXT CHAT STREAM ----------------
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);
    setInputValue('');
    setCurrentView('chatting');

    // Add placeholder bot message
    const botIndex = messages.length + 1;
    setMessages((prev) => [...prev, { type: 'bot', text: '' }]);
    setThinking([]);

    try {
      const res = await fetch('http://127.0.0.1:8000/chat_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (let line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);

          if (evt.type === "status") {
            setThinking((prev) => [...prev, { kind: 'status', text: evt.message }]);
          } else if (evt.type === "doc") {
            setThinking((prev) => [
              ...prev,
              { kind: 'doc', text: `🔗 ${evt.source}: ${evt.preview}` },
            ]);
          } else if (evt.type === "token") {
            botText += evt.text;
            setMessages((prev) =>
              prev.map((m, i) => (i === botIndex ? { ...m, text: botText } : m))
            );
          } else if (evt.type === "done") {
            setThinking([]); // clear trace after final answer
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === botIndex ? { ...m, text: '❌ Error connecting to backend.' } : m
        )
      );
      setThinking([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  // ---------------- VOICE CHAT ----------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      audioChunks.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'query.wav');

        setMessages((prev) => [
          ...prev,
          { type: 'user', text: '🎤 (voice query sent)' },
        ]);
        setCurrentView('chatting');

        try {
          const res = await fetch('http://127.0.0.1:8000/voice_chat', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error('Voice chat failed');
          const audioBlobResp = await res.blob();

          // Play response audio
          const audioURL = URL.createObjectURL(audioBlobResp);
          const audio = new Audio(audioURL);
          audio.play();

          setMessages((prev) => [
            ...prev,
            { type: 'bot', text: '🔊 Played response audio' },
          ]);
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            { type: 'bot', text: '❌ Voice chat error.' },
          ]);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied or unsupported.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  // ---------------- RENDER ----------------
  return (
    <div className="h-screen flex flex-col bg-gray-100 relative">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4">
        <span className="px-3 py-1 bg-white rounded-md text-s font-normal shadow">
          Computer Science Department
        </span>
        <span className="text-m text-gray-400 mx-auto">
          Emergency contacts | Phone: +91 1800 123 0001 | Email: helpdesk@polyuni.edu
        </span>
        <button className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300">
          <Info size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Dexter floating avatar */}
      <div
        className="absolute top-1/3 right-0 flex items-center bg-white rounded-l-full shadow-md px-4 py-2 gap-2"
        style={{ transform: 'translateY(-50%)' }}
      >
        <img src={dexterIcon} alt="Dexter" className="w-12 h-12 rounded-full" />
        <span className="text-sm font-medium">Dexter</span>
      </div>

      {/* Content */}
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col">
        {currentView === 'welcome' ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-semibold mb-8">
              How can I help you today?
            </h1>
            <div className="flex gap-6 mb-12">
              <div className="bg-white border rounded-xl p-6 w-56 text-center shadow-sm hover:shadow-md cursor-pointer">
                <Bell className="w-8 h-8 mx-auto mb-3 text-gray-600" />
                <h3 className="font-medium text-gray-900">Learn about</h3>
                <p className="text-sm text-gray-600">updated policies</p>
              </div>
              <div className="bg-white border rounded-xl p-6 w-56 text-center shadow-sm hover:shadow-md cursor-pointer">
                <FileText className="w-8 h-8 mx-auto mb-3 text-gray-600" />
                <h3 className="font-medium text-gray-900">Review the fee</h3>
                <p className="text-sm text-gray-600">structures in brief</p>
              </div>
              <div className="bg-white border rounded-xl p-6 w-56 text-center shadow-sm hover:shadow-md cursor-pointer">
                <Settings className="w-8 h-8 mx-auto mb-3 text-gray-600" />
                <h3 className="font-medium text-gray-900">Verify your</h3>
                <p className="text-sm text-gray-600">eligibility criteria</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Chat messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.type === 'user' ? 'justify-end' : 'justify-start'
                } mb-3`}
              >
                <div
                  className={`px-4 py-3 rounded-lg max-w-lg whitespace-pre-wrap ${
                    msg.type === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-200 text-black'
                  }`}
                >
                  {msg.type === 'bot' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc list-inside space-y-1" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal list-inside space-y-1" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="ml-2" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong className="font-semibold text-black" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2" {...props} />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {/* Thinking trace (temporary) */}
            {thinking.length > 0 && (
              <div className="flex justify-start mb-3">
                <div className="px-4 py-3 rounded-lg max-w-lg bg-yellow-50 text-gray-700 text-sm border border-yellow-200">
                  {thinking.map((t, idx) => (
                    <div key={idx} className="mb-1">
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input bar */}
        <div className="w-full flex items-center relative p-4 border-t bg-gray-50">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Ask me anything..."
              className="w-full px-6 py-4 bg-black text-white rounded-full pr-36 focus:outline-none text-lg shadow-lg"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 flex gap-3 items-center">
            <button className="w-12 h-12 rounded-full flex items-center justify-center">
              <img src={voiceIcon} alt="Voice" className="w-8 h-8" />
            </button>
            <button
              className="w-12 h-12 rounded-full flex items-center justify-center"
              onClick={inputValue.trim() ? handleSendMessage : toggleRecording}
            >
              {inputValue.trim() ? (
                <img src={sendIcon} alt="Send" className="w-8 h-8" />
              ) : (
                <img
                  src={micIcon}
                  alt="Microphone"
                  className={`w-8 h-8 ${
                    recording ? 'animate-pulse text-red-500' : ''
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
