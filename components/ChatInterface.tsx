
import React, { useEffect, useRef, useState } from 'react';
import { Message, Sender } from '../types';
import { Send, User, Bot, Loader2, Sparkles, ShieldAlert, Mic, MicOff, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isThinking }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);

  // Calculate Progress (Estimate based on turn count, e.g. max 10 turns)
  const userMessageCount = messages.filter(m => m.sender === Sender.USER).length;
  const progressPercent = Math.min((userMessageCount / 8) * 100, 100);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'id-ID'; // Indonesian Language

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput((prev) => prev + (prev ? ' ' : '') + transcript);
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error details:', event.error);
            setIsListening(false);
            
            // Graceful error handling
            if (event.error === 'no-speech') {
                 // Ignore noisy no-speech errors or show subtle toast
            } else if (event.error === 'not-allowed') {
                alert("Akses mikrofon ditolak. Mohon izinkan akses mikrofon pada pengaturan browser.");
            }
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Browser Anda tidak mendukung fitur Voice Input. Gunakan Chrome/Edge.");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error("Error starting speech recognition:", e);
            setIsListening(false);
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isThinking) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    alert("⚠️ Peringatan Keamanan: Fitur Copy-Paste dinonaktifkan untuk menjaga integritas tes ini.");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 md:rounded-2xl md:shadow-xl md:border border-slate-200 overflow-hidden relative font-sans">
      
      {/* 1. Header with Progress Bar (Mobile Responsive) */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3">
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-mobeng-blue" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interview Progress</span>
                </div>
                <span className="text-xs font-bold text-mobeng-blue">{Math.round(progressPercent)}%</span>
             </div>
             <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                    className="bg-gradient-to-r from-mobeng-blue to-mobeng-green h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,133,202,0.3)]" 
                    style={{width: `${progressPercent}%`}} 
                />
             </div>
        </div>
      </div>

      {/* 2. Content Area (ScrollView equivalent) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 scroll-smooth select-none">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                    <Bot size={32} className="text-mobeng-blue" />
                </div>
                <p className="font-medium text-sm">Memulai sesi simulasi...</p>
            </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] md:max-w-[75%] gap-2 md:gap-3 ${msg.sender === Sender.USER ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center shadow-sm mt-1 
                ${msg.sender === Sender.USER 
                    ? 'bg-mobeng-darkblue text-white' 
                    : 'bg-white text-mobeng-green border border-slate-200'}`}>
                {msg.sender === Sender.USER ? <User size={16} /> : <Sparkles size={16} />}
              </div>

              {/* 3. Chat Bubble Style */}
              <div className={`flex flex-col ${msg.sender === Sender.USER ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-3 md:px-5 md:py-4 rounded-2xl text-sm md:text-base shadow-sm leading-relaxed relative
                    ${msg.sender === Sender.USER 
                      ? 'bg-mobeng-blue text-white rounded-tr-sm' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'}`}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    className={`prose prose-sm max-w-none ${msg.sender === Sender.USER ? 'prose-invert' : 'prose-slate'}`}
                    components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-4 space-y-1" {...props} />,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start w-full">
             <div className="flex gap-3 flex-row max-w-[75%]">
                <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm bg-white text-mobeng-green border border-slate-200">
                    <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Input Area (KeyboardAvoidingView equivalent for Web) */}
      <div className="bg-white border-t border-slate-200 p-3 md:p-4 pb-safe-area-bottom">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 md:gap-3 max-w-4xl mx-auto">
            
            {/* Input Field */}
            <div className="flex-1 bg-slate-100 rounded-[20px] md:rounded-[24px] border border-slate-200 focus-within:border-mobeng-blue focus-within:ring-1 focus-within:ring-mobeng-blue/30 transition-all flex items-center">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Ketik jawaban Anda..."
                    className="w-full bg-transparent border-none px-4 py-3.5 text-slate-800 placeholder-slate-400 focus:ring-0 text-sm md:text-base select-text" 
                    disabled={isThinking}
                    autoFocus
                />
            </div>
            
            {/* 5. Voice Button (Large & Prominent) */}
            <button
                type="button"
                onClick={toggleListening}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 flex-shrink-0 relative
                ${isListening 
                  ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' 
                  : 'bg-mobeng-blue text-white hover:bg-mobeng-darkblue hover:shadow-lg'}`}
                title="Tekan untuk bicara"
            >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                {isListening && (
                    <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap font-bold animate-bounce">
                        Mendengarkan...
                    </span>
                )}
            </button>

            {/* Send Button */}
            {input.trim() && (
                <button
                    type="submit"
                    disabled={isThinking}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-900 text-white shadow-md transition-all active:scale-95 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed flex-shrink-0 animate-in zoom-in duration-200"
                >
                    <Send size={20} className={isThinking ? 'opacity-0' : ''} />
                </button>
            )}
        </form>
        <div className="mt-2 text-center">
             <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <ShieldAlert size={10} /> Anti-Cheat: Copy-Paste Locked
             </span>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;