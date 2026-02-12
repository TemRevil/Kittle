import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, AVAILABLE_MODELS } from '../types';
import { User, Check, Copy, Sparkles, ArrowRight, BrainCircuit, ChevronDown, Code2, Layout, Download, MoreVertical, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MermaidRenderer } from './MermaidRenderer';

interface ChatAreaProps {
  messages: Message[];
  onSuggestionClick: (text: string) => void;
  showThinking: boolean;
  supportsThinking: boolean;
  isDesignMode: boolean;
  isLoading: boolean;
}

// --- Components ---

const CodeBlock = memo(({ language, children }: { language: string, children?: any }) => {
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
});

// Mermaid wrapper that handles "Visual" vs "Code" toggle
// (MermaidToggleWrapper removed as per user request for strict mode behavior)

const ThinkingSection = memo(({ text, thinkingTime }: { text: string, thinkingTime?: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const seconds = thinkingTime ? Math.round(thinkingTime / 1000) : null;

  return (
    <div className="mb-6 group/thinking">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-blue-500 fill-blue-500/20" />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all group"
        >
          <span>{isOpen ? "Hide thinking" : "Show thinking"}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {seconds !== null && (
          <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium ml-1">
            • Thought for {seconds}s
          </span>
        )}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-4 pl-6 border-l-2 border-gray-100 dark:border-white/5 py-2 text-[13px] font-medium text-gray-500 dark:text-zinc-500 leading-relaxed italic">
              {text ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }: any) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-4 decoration-gray-400 hover:decoration-black dark:hover:decoration-white transition-all font-medium">
                          {children}
                        </a>
                      )
                    }}
                  >
                    {text}
                  </ReactMarkdown>
                </div>
              ) : (
                <span className="opacity-50 italic">Analyzing...</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Smooth LiveTimer using CSS Animation or Fast Interval for smoothness
const LiveTimer = memo(({ startTime, label }: { startTime: number, label: string }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // 80ms interval is smooth enough (12.5fps) for text without killing CPU
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 80);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-[11px] text-blue-500 dark:text-blue-400 font-bold tabular-nums">
      {label} {(elapsed / 1000).toFixed(1)}s
    </span>
  );
});

// Single Message Item - Memoized for Performance
const MessageItem = memo(({ msg, supportsThinking, showThinking, isDesignMode, isLoadingMessage }: { msg: Message, supportsThinking: boolean, showThinking: boolean, isDesignMode: boolean, isLoadingMessage: boolean }) => {

  // Find friendly name for display
  const modelDisplayName = useMemo(() => {
    if (!msg.model) return null;
    for (const provider in AVAILABLE_MODELS) {
      const found = (AVAILABLE_MODELS as any)[provider].find((m: any) => m.id === msg.model);
      if (found) return found.name;
    }
    return msg.model;
  }, [msg.model]);

  // Custom Renderer for this message
  // Includes logic to show toggle for mermaid
  const components = useMemo(() => ({
    code: ({ node, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const codeContent = String(children).replace(/\n$/, '');

      if (match && match[1] === 'mermaid') {
        return <MermaidRenderer code={codeContent} isGenerating={isLoadingMessage} />;
      }

      if (match) {
        return <CodeBlock language={match[1]}>{codeContent}</CodeBlock>;
      }

      return (
        <code className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 dark:bg-white/10 text-black dark:text-white" {...props}>
          {children}
        </code>
      );
    },
    ul: ({ children }: any) => <ul className="list-disc pl-5 my-4 space-y-2 opacity-90">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 my-4 space-y-2 opacity-90">{children}</ol>,
    h1: ({ children }: any) => <h1 className="text-2xl font-display font-bold mt-8 mb-4">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-display font-bold mt-6 mb-3 animate-in fade-in duration-700 fill-mode-both">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-display font-bold mt-5 mb-2 animate-in fade-in duration-700 fill-mode-both">{children}</h3>,
    p: ({ children }: any) => <p className="mb-4 last:mb-0 animate-in fade-in duration-700 fill-mode-both">{children}</p>,
    li: ({ children }: any) => <li className="animate-in fade-in duration-700 fill-mode-both">{children}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-200 dark:border-white/20 pl-4 italic my-4 opacity-70 animate-in fade-in duration-1000 fill-mode-both">{children}</blockquote>,
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-1 underline-offset-4 decoration-gray-400 hover:decoration-black dark:hover:decoration-white transition-all font-medium"
      >
        {children}
      </a>
    ),
    table: ({ children }: any) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
        <table className="w-full border-collapse text-sm text-left">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-gray-50/50 dark:bg-white/5 font-bold">{children}</thead>,
    tbody: ({ children }: any) => <tbody className="divide-y divide-gray-100 dark:divide-white/5">{children}</tbody>,
    tr: ({ children }: any) => <tr className="hover:bg-gray-50/30 dark:hover:bg-white/[0.02] transition-colors">{children}</tr>,
    th: ({ children }: any) => <th className="px-4 py-3 border-b border-gray-100 dark:border-white/10 font-bold text-gray-900 dark:text-gray-100">{children}</th>,
    td: ({ children }: any) => <td className="px-4 py-3 text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{children}</td>,
  }), [isLoadingMessage]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg.text);
    // You could add a toast or local state here
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([msg.text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kittle-message-${msg.timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`message-item group flex gap-3 md:gap-6 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {msg.role === 'model' && (
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0 mt-1 md:mt-2 shadow-lg">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white dark:text-black" />
        </div>
      )}

      <div
        className={`
            relative px-4 py-3 md:px-6 md:py-5 max-w-[85%] md:max-w-[80%] 
            ${msg.role === 'user'
            ? 'bg-black dark:bg-white text-white dark:text-black rounded-2xl md:rounded-3xl rounded-tr-sm md:rounded-tr-md shadow-2xl'
            : 'bg-white/40 dark:bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-2xl md:rounded-3xl rounded-tl-sm md:rounded-tl-md text-gray-800 dark:text-gray-200 shadow-sm'}
          `}
      >
        {/* Message Actions */}
        <div className={`
          absolute top-2 ${msg.role === 'user' ? 'right-full mr-2' : 'left-full ml-2'} 
          flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200
        `}>
          <button
            onClick={handleCopy}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Copy Message"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Download as Markdown"
          >
            <Download size={14} />
          </button>
        </div>
        {msg.thinking && supportsThinking && showThinking && (
          <ThinkingSection text={msg.thinking} thinkingTime={msg.thinkingTime} />
        )}

        {msg.text ? (
          <div className={`markdown-content text-sm md:text-[15px] leading-6 md:leading-7 ${msg.role === 'user' ? 'font-medium' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        ) : (msg.role === 'model' && !msg.thinking && (
          <div className="flex flex-col gap-3 py-2">
            {msg.isAborted ? (
              <div className="flex items-center gap-2 text-red-500/70 dark:text-red-400/50 italic text-xs font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>Response terminated by user.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              </div>
            )}
          </div>
        ))}

        {/* Response time indicator */}
        {msg.role === 'model' && (
          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-400 dark:text-zinc-600 font-medium uppercase tracking-wide">
            {modelDisplayName && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-bold border border-black/5 dark:border-white/5">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{modelDisplayName}</span>
              </div>
            )}
            {msg.isAborted && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 font-bold border border-red-500/10 shrink-0">
                <X size={10} />
                <span>ABORTED</span>
              </div>
            )}
            {msg.responseTime ? (
              <div className="flex items-center gap-3">
                <span>Time: {(msg.responseTime / 1000).toFixed(1)}s</span>
                {msg.thinkingTime && <span>Thinking: {(msg.thinkingTime / 1000).toFixed(1)}s</span>}
              </div>
            ) : (
              <LiveTimer startTime={msg.timestamp} label="Generating:" />
            )}
          </div>
        )}
      </div>

      {msg.role === 'user' && (
        <div className="hidden sm:flex w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 items-center justify-center shrink-0 mt-2">
          <User className="w-5 h-5 text-gray-500" />
        </div>
      )}
    </motion.div>
  );
});

// --- Main ChatArea ---

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isLoading,
  onSuggestionClick,
  showThinking,
  supportsThinking,
  isDesignMode
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastMessageText = messages[messages.length - 1]?.text || "";
  const lastMessageThinking = messages[messages.length - 1]?.thinking || "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, lastMessageText.length, lastMessageThinking.length, isLoading]);

  const suggestions = [
    { label: "Find Bugs", prompt: "Analyze the attached code and identify any potential bugs or logic errors." },
    { label: "Architecture", prompt: "Based on the file structure, explain the architecture of this project." },
    { label: "Optimize", prompt: "Suggest performance optimizations for the critical paths in this code." },
    { label: "Security", prompt: "Perform a security audit of the provided code and identify vulnerabilities." },
  ];

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 md:px-12 py-8 space-y-10 custom-scrollbar scroll-smooth">
      {messages.length === 0 && (
        <div className="flex flex-col justify-start pt-4 md:justify-center md:pt-0 h-full min-h-[400px] max-w-3xl mx-auto">
          <div className="mb-8">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
              className="inline-block px-3 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6"
            >
              AI Powered
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-5xl md:text-7xl font-display font-bold text-black dark:text-white leading-[0.95] tracking-tighter mb-6"
            >
              Code Analysis<br />
              <span className="text-gray-400 dark:text-zinc-700/50">Reimagined.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="text-lg md:text-xl text-gray-500 max-w-lg leading-relaxed"
            >
              Upload your files or connect a repository to get deep, context-aware insights into your codebase.
            </motion.p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 w-full">
            {suggestions.map((s, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (idx * 0.05), duration: 0.4 }}
                onClick={() => onSuggestionClick(s.prompt)}
                className="group flex flex-col justify-between p-4 h-24 md:p-6 md:h-32 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-left shadow-sm hover:shadow-xl"
              >
                <span className="text-base md:text-lg font-display font-bold leading-tight">{s.label}</span>
                <div className="flex justify-between items-end">
                  <span className="text-xs opacity-60">Start analysis</span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            supportsThinking={supportsThinking}
            showThinking={showThinking}
            isDesignMode={isDesignMode}
            isLoadingMessage={isLoading && idx === messages.length - 1}
          />
        ))}
      </AnimatePresence>

      {isLoading && (messages.length === 0 || messages[messages.length - 1].role !== 'model') && (
        <div className="flex gap-6 max-w-4xl mx-auto items-start message-item mt-4">
          <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0 shadow-lg">
            <Sparkles className="w-5 h-5 text-white dark:text-black animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mt-4 bg-white/20 dark:bg-white/5 py-3 px-5 rounded-2xl backdrop-blur-sm">
            <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          </div>
        </div>
      )}
      <div ref={scrollRef} className="h-4" />
    </div>
  );
};