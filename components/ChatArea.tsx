import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { User, Check, Copy, Sparkles, ArrowRight, BrainCircuit, ChevronDown } from 'lucide-react';
import anime from 'animejs';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (text: string) => void;
  showThinking: boolean;
  supportsThinking: boolean;
}

const CodeBlock = ({ language, children }: { language: string, children?: any }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children || ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 group font-mono text-sm code-block-enter animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 select-none">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{language || 'text'}</span>
        <button 
          onClick={handleCopy} 
          className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <code className="text-gray-800 dark:text-gray-200 text-xs font-medium whitespace-pre block w-full leading-relaxed">{children}</code>
      </div>
    </div>
  );
};

const ThinkingSection = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [text, isOpen]);

  return (
    <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-500/5 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-100/50 dark:bg-yellow-500/10 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors"
      >
        <BrainCircuit className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-500 animate-pulse" />
        <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider">
          Thinking Process
        </span>
        <ChevronDown className={`w-3 h-3 text-yellow-600 dark:text-yellow-500 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div 
           ref={contentRef}
           className="p-4 text-xs font-mono text-yellow-800 dark:text-yellow-200/80 leading-relaxed border-t border-yellow-500/10 animate-in slide-in-from-top-2 max-h-[200px] overflow-y-auto custom-scrollbar"
        >
          {text || <span className="opacity-50 italic">Analyzing...</span>}
        </div>
      )}
    </div>
  );
};

export const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  isLoading, 
  onSuggestionClick, 
  showThinking,
  supportsThinking
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  const lastMessageText = messages[messages.length - 1]?.text || "";
  const lastMessageThinking = messages[messages.length - 1]?.thinking || "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, lastMessageText.length, lastMessageThinking.length, isLoading]);

  useEffect(() => {
    if (messages.length === 0) {
      anime({
        targets: '.empty-state-stagger',
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        easing: 'easeOutExpo',
        duration: 800
      });
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      anime({
        targets: '.message-item:last-child',
        translateY: [50, 0],
        opacity: [0, 1],
        easing: 'easeOutQuad',
        duration: 500
      });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const suggestions = [
    { label: "Find Bugs", prompt: "Analyze the attached code and identify any potential bugs or logic errors." },
    { label: "Architecture", prompt: "Based on the file structure, explain the architecture of this project." },
    { label: "Optimize", prompt: "Suggest performance optimizations for the critical paths in this code." },
  ];

  const CodeRenderer = ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    
    if (match) {
      return <CodeBlock language={match[1]}>{codeContent}</CodeBlock>;
    }
    
    return (
      <code 
        className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 dark:bg-white/10 text-black dark:text-white" 
        {...props}
      >
        {children}
      </code>
    );
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 md:px-12 py-8 space-y-10 custom-scrollbar scroll-smooth">
      
      {messages.length === 0 && (
        <div className="flex flex-col justify-center h-full min-h-[400px] max-w-3xl mx-auto">
          
          <div className="mb-8">
            <span className="empty-state-stagger inline-block px-3 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 opacity-0">
              AI Powered
            </span>
            <h1 className="empty-state-stagger text-5xl md:text-7xl font-display font-bold text-black dark:text-white leading-[0.95] tracking-tighter mb-6 opacity-0">
              Code Analysis<br/>
              <span className="text-gray-300 dark:text-zinc-700">Reimagined.</span>
            </h1>
            <p className="empty-state-stagger text-lg md:text-xl text-gray-500 max-w-lg leading-relaxed opacity-0">
              Upload your files or connect a repository to get deep, context-aware insights into your codebase.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick(s.prompt)}
                className="empty-state-stagger opacity-0 group flex flex-col justify-between p-6 h-32 rounded-2xl bg-gray-50 dark:bg-zinc-900 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-left"
              >
                <span className="text-lg font-display font-bold">{s.label}</span>
                <div className="flex justify-between items-end">
                   <span className="text-xs opacity-60">Start analysis</span>
                   <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`message-item flex gap-6 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'model' && (
            <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0 mt-2 shadow-lg">
              <Sparkles className="w-5 h-5 text-white dark:text-black" />
            </div>
          )}

          <div 
            className={`
              relative px-6 py-5 max-w-[90%] md:max-w-[80%] 
              ${msg.role === 'user' 
                ? 'bg-black dark:bg-white text-white dark:text-black rounded-3xl rounded-tr-md shadow-2xl' 
                : 'text-gray-800 dark:text-gray-200'}
            `}
          >
            {msg.thinking && supportsThinking && showThinking && <ThinkingSection text={msg.thinking} />}

            <div className={`markdown-content text-[15px] leading-7 ${msg.role === 'user' ? 'font-medium' : ''}`}>
              <ReactMarkdown
                components={{
                  code: CodeRenderer,
                  ul: ({children}) => <ul className="list-disc pl-5 my-4 space-y-2 opacity-90">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-5 my-4 space-y-2 opacity-90">{children}</ol>,
                  h1: ({children}) => <h1 className="text-2xl font-display font-bold mt-8 mb-4">{children}</h1>,
                  h2: ({children}) => <h2 className="text-xl font-display font-bold mt-6 mb-3">{children}</h2>,
                  h3: ({children}) => <h3 className="text-lg font-display font-bold mt-5 mb-2">{children}</h3>,
                  blockquote: ({children}) => <blockquote className="border-l-4 border-gray-200 dark:border-white/20 pl-4 italic my-4 opacity-70">{children}</blockquote>,
                  a: ({href, children}) => <a href={href} className="underline decoration-1 underline-offset-4 decoration-gray-400 hover:decoration-black dark:hover:decoration-white transition-all font-medium">{children}</a>
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>

          {msg.role === 'user' && (
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 items-center justify-center shrink-0 mt-2">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex gap-6 max-w-4xl mx-auto message-item">
          <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0 shadow-lg">
             <Sparkles className="w-5 h-5 text-white dark:text-black animate-pulse" />
          </div>
          {messages.length > 0 && messages[messages.length - 1].role === 'model' && !messages[messages.length - 1].text && (!messages[messages.length - 1].thinking || !showThinking || !supportsThinking) ? (
             <div className="flex items-center gap-2 mt-4">
               <span className="w-2 h-2 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce"></span>
               <span className="w-2 h-2 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce delay-100"></span>
               <span className="w-2 h-2 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce delay-200"></span>
             </div>
          ) : null}
        </div>
      )}
      <div ref={scrollRef} className="h-4" />
    </div>
  );
};