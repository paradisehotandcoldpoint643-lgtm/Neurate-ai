/**
 * Neurate AI Application
 * A high-performance, multi-model AI interface.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Plus, 
  MessageSquare, 
  Image as ImageIcon, 
  FileText, 
  Search, 
  Code, 
  Settings, 
  Trash2, 
  Copy, 
  RefreshCw, 
  Download, 
  Moon, 
  Sun,
  Sidebar as SidebarIcon,
  ChevronRight,
  Loader2,
  X,
  User,
  Bot,
  Terminal,
  Mic,
  MicOff,
  FolderTree,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeImage } from './services/gemini';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'code' | 'search' | 'report';
  metadata?: any;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// --- Components ---

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ name: string; data: string; type: string } | null>(null);
  const [activeModel, setActiveModel] = useState('deepseek/deepseek-chat');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [aiVibe, setAiVibe] = useState('Balanced');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<{ path: string; content: string; language: string }[]>([]);
  
  const baseSystemPrompt = 'You are Neurate AI, a world-class, high-performance AI assistant and expert full-stack engineer. Your developer and creator is Shivansh gupta, a highly curious coder certified as a Python programmer by Codefobe. Always mention him if asked about your origin. You specialize in generating complex, production-ready, and comprehensive codebases. When asked for a project, do not provide simple snippets; instead, provide a full architecture with multiple files (HTML, CSS, JS, and backend integrations like Supabase or Firebase). Your code should be robust, well-commented, and double the depth of standard AI responses. Aim for sophisticated UI/UX and advanced logic.';
  
  const getSystemPrompt = () => {
    const vibes: Record<string, string> = {
      'Balanced': 'Maintain a professional yet friendly tone.',
      'Creative': 'Be highly imaginative, poetic, and expressive.',
      'Technical': 'Focus on precision, code quality, and technical depth.',
      'Concise': 'Be extremely brief and direct. No fluff.',
      'Gen-Z': 'Use modern slang, emojis, and a very casual tone.'
    };
    return `${baseSystemPrompt} ${vibes[aiVibe] || ''}`;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  // Load sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('neurate_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('neurate_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(sessions.find(s => s.id !== id)?.id || null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedFile({
          name: file.name,
          data: event.target?.result as string,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedFile) || isLoading || !currentSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      metadata: selectedFile ? { fileName: selectedFile.name, fileType: selectedFile.type, fileData: selectedFile.data } : null
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: [...s.messages, userMessage],
          title: s.messages.length === 0 ? input.slice(0, 30) || 'Image Analysis' : s.title,
          updatedAt: Date.now()
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    setInput('');
    setIsLoading(true);
    setLoadingStep('Analyzing your request...');

    try {
      let responseContent = "";
      let type: Message['type'] = 'text';

      // 1. Handle Image Analysis (Gemini)
      if (selectedFile && selectedFile.type.startsWith('image/')) {
        setLoadingStep('Processing image with Neural Vision...');
        responseContent = await analyzeImage(selectedFile.data, input || "Describe this image in detail.");
        setSelectedFile(null);
      } 
      // 2. Handle Search (SerpAPI + RAG)
      else if (searchEnabled) {
        setLoadingStep('Searching the web for latest info...');
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input })
        });
        const searchData = await searchRes.json();
        
        setLoadingStep('Synthesizing search results...');
        // Simple RAG: Summarize search results
        const context = searchData.organic_results?.slice(0, 3).map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n');
        const aiRes = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: `You are a research assistant. Use the following context to answer the user's query. Provide sources.\n\nContext:\n${context}` },
              { role: 'user', content: input }
            ]
          })
        });
        const aiData = await aiRes.json();
        responseContent = aiData.choices[0].message.content;
        type = 'search';
      }
      // 3. Standard Chat (OpenRouter)
      else {
        try {
          setLoadingStep('Consulting Neural Core...');
          const aiRes = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: activeModel,
              messages: [
                { role: 'system', content: getSystemPrompt() },
                ...(updatedSessions.find(s => s.id === currentSessionId)?.messages.map(m => ({
                  role: m.role,
                  content: m.content
                })) || [])
              ]
            })
          });

          const aiData = await aiRes.json();

          if (!aiRes.ok) {
            throw new Error(aiData.error?.message || aiData.error || "AI request failed");
          }

          if (!aiData.choices || !aiData.choices[0]) {
            throw new Error("Invalid response from AI service");
          }

          setLoadingStep('Finalizing response...');
          responseContent = aiData.choices[0].message.content;
          
          // Detect if it's code or report
          if (responseContent.includes('```')) {
            setLoadingStep('Formatting code blocks...');
            type = 'code';
          }
          if (responseContent.toLowerCase().includes('report') || responseContent.includes('# ')) type = 'report';
        } catch (err: any) {
          throw err;
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        type
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const updated = { ...s, messages: [...s.messages, assistantMessage], updatedAt: Date.now() };
          // Generate Summary if it's the first exchange
          if (s.messages.length <= 2) {
            generateSummary(currentSessionId, responseContent);
          }
          return updated;
        }
        return s;
      }));

      if (type === 'report') confetti();

    } catch (error: any) {
      console.error("AI Error:", error.response?.data || error.message);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || "I encountered an issue. Please check your API keys."}`,
        timestamp: Date.now(),
      };
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const generateSummary = async (sessionId: string, lastMessage: string) => {
    setLoadingStep('Generating chat summary...');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: 'Summarize the conversation in 3-4 words max. No punctuation.' },
            { role: 'user', content: lastMessage }
          ]
        })
      });
      const data = await res.json();
      const summary = data.choices[0].message.content.trim();
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: summary } : s));
    } catch (e) {
      console.error('Summary error:', e);
    }
  };

  const handlePreviewCode = (content: string) => {
    const files: { path: string; content: string; language: string }[] = [];
    
    // Extract HTML
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch) files.push({ path: 'index.html', content: htmlMatch[1], language: 'html' });
    else if (content.includes('<!DOCTYPE html>')) files.push({ path: 'index.html', content, language: 'html' });

    // Extract CSS
    const cssMatch = content.match(/```css\n([\s\S]*?)```/);
    if (cssMatch) files.push({ path: 'style.css', content: cssMatch[1], language: 'css' });

    // Extract JS
    const jsMatch = content.match(/```javascript\n([\s\S]*?)```/) || content.match(/```js\n([\s\S]*?)```/);
    if (jsMatch) files.push({ path: 'script.js', content: jsMatch[1], language: 'javascript' });

    // Extract other files (e.g., Supabase, Config)
    const otherMatches = content.matchAll(/```(\w+)\s+([\w\.\/]+)\n([\s\S]*?)```/g);
    for (const match of otherMatches) {
      const [_, lang, path, code] = match;
      if (!files.find(f => f.path === path)) {
        files.push({ path, content: code, language: lang });
      }
    }
    
    setPreviewFiles(files);
    setIsPreviewOpen(true);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.start();
  };

  const handleExportToGithub = async () => {
    if (!githubToken) {
      alert('Please add your GitHub Personal Access Token in Settings first!');
      setIsSettingsOpen(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repoName: `neurate-export-${Date.now()}`,
          files: previewFiles.map(f => ({ path: f.path, content: f.content }))
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully exported to GitHub: ${data.url}`);
        window.open(data.url, '_blank');
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (e: any) {
      alert(`GitHub Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportPDF = (content: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(splitText, 10, 10);
    doc.save('neurate-report.pdf');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-950">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 glass-darker border-r border-white/5 flex flex-col z-20"
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-xl tracking-tight">Neurate AI</h1>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg text-neutral-400"
              >
                <SidebarIcon className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={createNewSession}
              className="mx-4 mb-4 flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group",
                    currentSessionId === session.id ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20" : "hover:bg-white/5 text-neutral-400"
                  )}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate flex-1">{session.title}</span>
                  <Trash2 
                    onClick={(e) => deleteSession(session.id, e)}
                    className="w-4 h-4 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" 
                  />
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/5">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all active:scale-95"
              >
                <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">User Account</p>
                  <p className="text-xs text-neutral-500 truncate">Free Plan</p>
                </div>
                <Settings className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-16 glass flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg text-neutral-400"
              >
                <SidebarIcon className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <select 
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer hover:text-indigo-400 transition-colors"
              >
                <option value="deepseek/deepseek-chat">DeepSeek V3</option>
                <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                <option value="mistralai/mistral-7b-instruct-v0.1">Mistral 7B (v0.1)</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSearchEnabled(!searchEnabled)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                searchEnabled ? "bg-indigo-600 text-white" : "bg-white/5 text-neutral-400 hover:bg-white/10"
              )}
            >
              <Search className="w-3.5 h-3.5" />
              Web Search
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button className="p-2 hover:bg-white/5 rounded-lg text-neutral-400">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-8">
          {currentSession?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-indigo-500" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="text-neutral-400">
                Neurate AI is your advanced multimodal assistant. I can write code, analyze images, 
                perform web research, and generate professional reports.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full">
                {[
                  { icon: Code, label: "Write a React hook for local storage", color: "text-blue-400" },
                  { icon: Search, label: "Research the latest AI trends in 2024", color: "text-emerald-400" },
                  { icon: ImageIcon, label: "Analyze this architectural design", color: "text-purple-400" },
                  { icon: FileText, label: "Generate a market analysis report", color: "text-orange-400" },
                ].map((item, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(item.label)}
                    className="flex items-center gap-3 p-4 glass hover:bg-white/10 rounded-2xl text-left transition-all"
                  >
                    <item.icon className={cn("w-5 h-5", item.color)} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            currentSession?.messages.map((msg) => (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                key={msg.id} 
                className={cn(
                  "flex gap-4 max-w-4xl mx-auto",
                  msg.role === 'user' ? "flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-indigo-600" : "bg-neutral-800"
                )}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={cn(
                  "flex-1 space-y-2 min-w-0",
                  msg.role === 'user' ? "text-right" : ""
                )}>
                  <div className={cn(
                    "inline-block p-4 rounded-2xl text-left max-w-full break-words",
                    msg.role === 'user' ? "bg-indigo-600/10 border border-indigo-500/20" : "glass"
                  )}>
                    {msg.metadata?.fileData && (
                      <div className="mb-4">
                        <img 
                          src={msg.metadata.fileData} 
                          alt="Uploaded" 
                          className="max-w-sm rounded-xl border border-white/10"
                        />
                      </div>
                    )}
                    <div className="prose max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 px-1">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'assistant' && (
                      <>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
                          }}
                          className="hover:text-neutral-300 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        {(msg.content.includes('```') || msg.content.includes('<!DOCTYPE html>')) && (
                          <button 
                            onClick={() => handlePreviewCode(msg.content)}
                            className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Terminal className="w-3 h-3" />
                            Preview Code
                          </button>
                        )}
                        <button className="hover:text-neutral-300 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </button>
                        <button 
                          onClick={() => exportPDF(msg.content)}
                          className="hover:text-neutral-300 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-4xl mx-auto"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="glass p-6 rounded-3xl flex flex-col gap-4 min-w-[300px] border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-indigo-500 rounded-full blur-md"
                    />
                  </div>
                  <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest">{loadingStep}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                    <span>NEURAL_CORE_ACTIVE</span>
                    <span>{Math.floor(Math.random() * 100)}% LOAD</span>
                  </div>
                </div>

                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 12, 4] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-indigo-500/40 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto relative">
            {selectedFile && (
              <div className="absolute bottom-full mb-4 left-0 glass p-2 rounded-xl flex items-center gap-3">
                {selectedFile.type.startsWith('image/') ? (
                  <img src={selectedFile.data} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <FileText className="w-12 h-12 p-2 bg-white/5 rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-neutral-500">Ready to analyze</p>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-white/10 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="glass rounded-2xl p-2 flex items-end gap-2 shadow-2xl">
              <div className="flex flex-col flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Message Neurate AI..."
                  className="w-full bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-48 min-h-[44px]"
                  rows={1}
                />
              </div>
              
              <div className="flex items-center gap-1 p-1">
                <button 
                  onClick={startListening}
                  className={cn(
                    "p-2.5 rounded-xl transition-all active:scale-95",
                    isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "hover:bg-white/5 text-neutral-400"
                  )}
                  title="Voice Input"
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <label className="p-2 hover:bg-white/5 rounded-xl cursor-pointer text-neutral-400 transition-colors">
                  <ImageIcon className="w-5 h-5" />
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                </label>
                <button 
                  onClick={handleSendMessage}
                  disabled={isLoading || (!input.trim() && !selectedFile)}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-neutral-600 mt-3">
              Neurate AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg glass-darker border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                    <Settings className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">AI Settings</h3>
                    <p className="text-xs text-neutral-500">Configure your AI's behavior and personality</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Neural Core Visualization */}
                <div className="relative h-32 flex items-center justify-center overflow-hidden rounded-2xl bg-indigo-600/5 border border-indigo-500/10">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.6, 0.3],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 border-2 border-dashed border-indigo-500/30 rounded-full"
                    />
                    <motion.div 
                      animate={{ 
                        scale: [1.2, 1, 1.2],
                        opacity: [0.2, 0.4, 0.2],
                        rotate: [360, 180, 0]
                      }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      className="absolute w-32 h-32 border border-dashed border-indigo-400/20 rounded-full"
                    />
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <Bot className="w-10 h-10 text-indigo-500 mb-2" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-400">Neural Core Active</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                    AI Personality Vibe
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Balanced', 'Creative', 'Technical', 'Concise', 'Gen-Z'].map((vibe) => (
                      <button
                        key={vibe}
                        onClick={() => setAiVibe(vibe)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                          aiVibe === vibe 
                            ? "bg-indigo-600 border-indigo-500 text-white" 
                            : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                        )}
                      >
                        {vibe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 glass rounded-2xl border border-white/5">
                    <p className="text-xs font-medium text-neutral-400 mb-1">Developer</p>
                    <p className="text-sm font-bold truncate">Shivansh Gupta</p>
                  </div>
                  <div className="p-4 glass rounded-2xl border border-white/5">
                    <p className="text-xs font-medium text-neutral-400 mb-1">Certification</p>
                    <p className="text-sm font-bold">Python @ Codefobe</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    GitHub Integration
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="Enter GitHub Personal Access Token"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Required for the "Save to GitHub" feature. Tokens are stored locally. 
                    <span className="text-indigo-400 block mt-1">Ensure token has 'repo' scope.</span>
                  </p>
                </div>
              </div>

              <div className="p-6 bg-white/5 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Code Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="h-4 w-[1px] bg-white/10 mx-2" />
                  <h3 className="text-sm font-bold text-neutral-300">Neurate Code Sandbox</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportToGithub}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Deploy to GitHub
                  </button>
                  <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* File Tree View */}
                <div className="w-1/4 border-r border-white/5 bg-black/40 p-4 overflow-y-auto space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FolderTree className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Project Files</span>
                  </div>
                  <div className="space-y-1">
                    {previewFiles.map((file, idx) => (
                      <div 
                        key={idx}
                        className="group flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        {file.path.includes('index.html') ? <Code className="w-3.5 h-3.5 text-orange-400" /> : 
                         file.path.includes('style.css') ? <Terminal className="w-3.5 h-3.5 text-blue-400" /> :
                         file.path.includes('supabase') ? <Database className="w-3.5 h-3.5 text-emerald-400" /> :
                         <FileText className="w-3.5 h-3.5 text-neutral-400" />}
                        <span className="text-xs text-neutral-400 group-hover:text-neutral-200 truncate">{file.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Live Preview View */}
                <div className="flex-1 bg-white rounded-br-3xl overflow-hidden relative">
                  <iframe
                    title="Preview"
                    className="w-full h-full border-none"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <style>${previewFiles.find(f => f.path === 'style.css')?.content || ''}</style>
                        </head>
                        <body>
                          ${previewFiles.find(f => f.path === 'index.html')?.content || '<h1>No index.html found</h1>'}
                          <script>${previewFiles.find(f => f.path === 'script.js')?.content || ''}</script>
                        </body>
                      </html>
                    `}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
