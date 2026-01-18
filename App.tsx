import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { RepoModal } from './components/RepoModal';
import { ModelSelector } from './components/ModelSelector';
import { Gateway } from './components/Gateway';
import { FileContext, ChatState, Message, RepoDetails, LLMConfig, AVAILABLE_MODELS } from './types';
import { readFile } from './utils';
import { streamLLMResponse } from './services/llmFactory';
import { fetchRepoDetails, fetchRepoStructure, fetchGithubFileContent } from './services/githubService';
import { Paperclip, Menu, X, ArrowUp, Loader2, Globe, Layers, Zap, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import anime from 'animejs';

const App: React.FC = () => {
  const [isOnboarding, setIsOnboarding] = useState(true);
  
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    activeFiles: [],
    githubRepoLink: '',
    repoTree: [],
    repoDetails: null,
    thinkingMode: 'concise',
    isSearchEnabled: false,
    showThinking: true, // Default to showing thoughts
    llmConfig: {
      provider: 'google',
      model: 'gemini-2.0-flash-thinking-exp',
      apiKeys: {
        google: process.env.API_KEY || '',
        openai: '',
        anthropic: '',
        deepseek: ''
      }
    }
  });
  
  const [input, setInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);

  // Modal State
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isRepoLoading, setIsRepoLoading] = useState(false);

  // --- DERIVED STATE FOR THINKING CAPABILITY ---
  // 1. Get current model definition
  const currentModelDef = AVAILABLE_MODELS[state.llmConfig.provider]?.find(m => m.id === state.llmConfig.model);
  
  // 2. Check if it explicitly supports thinking (from types.ts or string match)
  const supportsThinking = !!(
    currentModelDef?.hasThinking || 
    state.llmConfig.model.includes('thinking') || 
    state.llmConfig.model.includes('reasoner') || 
    state.llmConfig.model.includes('o1')
  );
  
  // 3. "Free Version" check (using default google env key)
  const isFreeVersion = state.llmConfig.provider === 'google' && state.llmConfig.apiKeys.google === process.env.API_KEY;

  // Initialization Logic
  useEffect(() => {
    // Check if user has already set up the app
    const setupComplete = localStorage.getItem('app_setup_complete');
    const savedKeys = localStorage.getItem('llm_api_keys');

    if (setupComplete) {
      setIsOnboarding(false);
      if (savedKeys) {
        try {
          const parsedKeys = JSON.parse(savedKeys);
          setState(prev => ({
            ...prev,
            llmConfig: { ...prev.llmConfig, apiKeys: { ...prev.llmConfig.apiKeys, ...parsedKeys } }
          }));
        } catch (e) {
          console.error("Failed to parse saved keys");
        }
      }
    }
  }, []);

  // Migration/Fix for deprecated model ID if user has it stuck in state
  useEffect(() => {
    // Fix for the 404 error by migrating to the generic alias
    if (state.llmConfig.model === 'gemini-2.0-flash-thinking-exp-01-21') {
       setState(prev => ({
         ...prev,
         llmConfig: { ...prev.llmConfig, model: 'gemini-2.0-flash-thinking-exp' }
       }));
    }
  }, [state.llmConfig.model]);

  // Initialize theme
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleConfigChange = (newConfig: LLMConfig) => {
    setState(prev => ({ ...prev, llmConfig: newConfig }));
    localStorage.setItem('llm_api_keys', JSON.stringify(newConfig.apiKeys));
  };

  const handleGatewayComplete = (config: LLMConfig) => {
    setState(prev => ({ ...prev, llmConfig: config }));
    localStorage.setItem('llm_api_keys', JSON.stringify(config.apiKeys));
    localStorage.setItem('app_setup_complete', 'true');
    setIsOnboarding(false);
  };

  const sendMessage = async (text: string) => {
    // Allow sending message even if no files if we are in "chat mode" (which is now default)
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
      relatedFiles: state.activeFiles.map(f => f.id)
    };

    // Create placeholder bot message
    const botMessageId = (Date.now() + 1).toString();
    const initialBotMessage: Message = {
      id: botMessageId,
      role: 'model',
      text: '',
      thinking: '', // Start empty
      timestamp: Date.now(),
      isNew: true
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages.map(m => ({...m, isNew: false})), userMessage, initialBotMessage],
      isLoading: true
    }));
    setInput('');

    try {
      const stream = streamLLMResponse(
        state.llmConfig,
        userMessage.text,
        state.messages,
        state.activeFiles,
        state.githubRepoLink,
        state.thinkingMode,
        state.isSearchEnabled
      );

      for await (const chunk of stream) {
        setState(prev => {
          const newMessages = [...prev.messages];
          const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
          if (msgIndex === -1) return prev;

          const updatedMsg = { ...newMessages[msgIndex] };
          if (chunk.textDelta) updatedMsg.text += chunk.textDelta;
          if (chunk.thinkingDelta) updatedMsg.thinking = (updatedMsg.thinking || "") + chunk.thinkingDelta;
          
          newMessages[msgIndex] = updatedMsg;
          return { ...prev, messages: newMessages };
        });
      }
    } catch (e) {
      console.error("Streaming failed", e);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleSendMessage = () => sendMessage(input);

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allNewFiles: FileContext[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        try {
          const extractedFiles = await readFile(e.target.files[i]);
          allNewFiles.push(...extractedFiles);
        } catch (err) {
          console.error("Error reading file", err);
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        activeFiles: [...prev.activeFiles, ...allNewFiles] 
      }));
    }
  };

  const removeFile = (id: string) => {
    setState(prev => ({ ...prev, activeFiles: prev.activeFiles.filter(f => f.id !== id) }));
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const toggleSearch = () => setState(prev => ({ ...prev, isSearchEnabled: !prev.isSearchEnabled }));

  const handleGithubEnter = async () => {
    if (!state.githubRepoLink.trim()) return;

    setIsRepoModalOpen(true);
    setIsRepoLoading(true);
    setState(prev => ({ ...prev, repoDetails: null }));

    const details = await fetchRepoDetails(state.githubRepoLink);
    setState(prev => ({ ...prev, repoDetails: details }));
    setIsRepoLoading(false);
  };

  const handleAttachRepoFiles = async () => {
    if (!state.repoDetails) return;

    setIsRepoLoading(true); 
    
    try {
      const { tree, mapFile } = await fetchRepoStructure(state.repoDetails);
      
      setState(prev => ({
        ...prev,
        repoTree: tree,
        activeFiles: [...prev.activeFiles.filter(f => f.name !== 'REPOSITORY_MAP.md'), mapFile]
      }));
      
      setIsRepoModalOpen(false);
    } catch (error) {
      console.error("Failed to attach repo structure:", error);
      alert("Failed to load repository structure.");
    } finally {
      setIsRepoLoading(false);
    }
  };

  const handleRepoFileClick = async (path: string) => {
    if (!state.repoDetails) return;

    if (state.activeFiles.some(f => f.name === path)) {
      setState(prev => ({
        ...prev,
        activeFiles: prev.activeFiles.filter(f => f.name !== path)
      }));
      return;
    }

    setLoadingFileId(path);

    try {
      const fileContext = await fetchGithubFileContent(
        state.repoDetails.owner.login,
        state.repoDetails.name,
        state.repoDetails.default_branch,
        path
      );

      setState(prev => ({
        ...prev,
        activeFiles: [...prev.activeFiles, fileContext]
      }));
    } catch (e) {
      console.error("Error fetching specific file:", e);
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleResetConfig = () => {
    setIsOnboarding(true);
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-black dark:text-white overflow-hidden font-sans transition-colors duration-300">
      
      {isOnboarding && (
        <Gateway 
          initialConfig={state.llmConfig} 
          onComplete={handleGatewayComplete} 
        />
      )}

      <RepoModal 
        isOpen={isRepoModalOpen} 
        onClose={() => setIsRepoModalOpen(false)}
        repo={state.repoDetails}
        isLoading={isRepoLoading}
        onAttachRepo={handleAttachRepoFiles}
      />

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-[340px] flex-col border-r border-gray-100 dark:border-white/10 bg-white dark:bg-black">
        <Sidebar 
          files={state.activeFiles} 
          repoTree={state.repoTree}
          onRemoveFile={removeFile} 
          onAddFiles={handleFileChange}
          githubLink={state.githubRepoLink}
          onGithubLinkChange={(val) => setState(prev => ({...prev, githubRepoLink: val}))}
          onGithubEnter={handleGithubEnter}
          isDark={isDark}
          toggleTheme={toggleTheme}
          onRepoFileClick={handleRepoFileClick}
          isLoadingFile={loadingFileId}
          onResetConfig={handleResetConfig}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-black">
        
        {/* Minimal Header */}
        <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={toggleMobileMenu} className="md:hidden text-black dark:text-white p-2 -ml-2">
               <Menu className="w-6 h-6" />
             </button>
             
             <div className="md:hidden flex items-center gap-2">
               <span className="font-display font-bold text-xl tracking-tight">CodeCleanse</span>
             </div>

             {/* Desktop Model Selector */}
             <div className="hidden md:block">
               <ModelSelector 
                 config={state.llmConfig} 
                 onConfigChange={handleConfigChange} 
               />
             </div>
          </div>
        </header>

        {/* Chat Area - Scrollable */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <ChatArea 
            messages={state.messages} 
            isLoading={state.isLoading} 
            onSuggestionClick={handleSuggestionClick}
            showThinking={state.showThinking}
            supportsThinking={supportsThinking}
          />

          {/* Input Area */}
          <div className="p-6 md:px-12 md:pb-8 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black z-20">
            <div className="max-w-4xl mx-auto">
              <div className="relative flex flex-col bg-gray-50 dark:bg-zinc-900 rounded-[2rem] p-2 pr-3 shadow-sm focus-within:shadow-md focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 transition-all border border-transparent dark:border-white/5">
                 
                 {/* Thinking Controls within Input Box */}
                 {/* 
                     LOGIC: Show these controls ONLY if the current model SUPPORTS thinking.
                     The user specifically requested to show/hide based on model capability.
                     We also hide it for the Free version specifically requested in a previous prompt,
                     but respecting the "choosed models" constraint.
                 */}
                 {supportsThinking && !isFreeVersion && (
                   <div className="absolute top-3 right-4 z-20 flex items-center gap-2 animate-in fade-in duration-300">
                     {/* Visibility Toggle */}
                     <button 
                       onClick={() => setState(prev => ({...prev, showThinking: !prev.showThinking}))}
                       className={`flex items-center justify-center w-7 h-7 rounded-full border shadow-sm transition-all ${
                         state.showThinking 
                          ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-white/10 text-black dark:text-white' 
                          : 'bg-transparent border-transparent text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                       }`}
                       title={state.showThinking ? "Hide Thoughts" : "Show Thoughts"}
                     >
                       {state.showThinking ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                     </button>
            
                     {/* Thinking Mode Dropdown */}
                     <div className="relative">
                       <button 
                         onClick={() => setIsThinkingDropdownOpen(!isThinkingDropdownOpen)}
                         className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg shadow-sm hover:shadow-md transition-all"
                       >
                         {state.thinkingMode === 'deep' ? <Layers className="w-3 h-3 text-blue-500" /> : <Zap className="w-3 h-3 text-amber-500" />}
                         <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                           {state.thinkingMode === 'deep' ? 'Deep' : 'Concise'}
                         </span>
                         <ChevronDown className="w-3 h-3 text-gray-400" />
                       </button>
                       
                       {isThinkingDropdownOpen && (
                         <>
                           <div className="fixed inset-0 z-30" onClick={() => setIsThinkingDropdownOpen(false)}></div>
                           <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-200">
                             <button 
                               onClick={() => { setState(prev => ({...prev, thinkingMode: 'deep'})); setIsThinkingDropdownOpen(false); }}
                               className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 ${state.thinkingMode === 'deep' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                             >
                               <Layers className="w-4 h-4 text-blue-500" />
                               <div>
                                 <p className="text-xs font-bold text-black dark:text-white">Deep Dive</p>
                                 <p className="text-[10px] text-gray-400">Detailed logic</p>
                               </div>
                               {state.thinkingMode === 'deep' && <Check className="w-3 h-3 text-blue-500 ml-auto" />}
                             </button>
                             <button 
                               onClick={() => { setState(prev => ({...prev, thinkingMode: 'concise'})); setIsThinkingDropdownOpen(false); }}
                               className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 ${state.thinkingMode === 'concise' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                             >
                               <Zap className="w-4 h-4 text-amber-500" />
                               <div>
                                 <p className="text-xs font-bold text-black dark:text-white">Concise</p>
                                 <p className="text-[10px] text-gray-400">Brief answers</p>
                               </div>
                               {state.thinkingMode === 'concise' && <Check className="w-3 h-3 text-amber-500 ml-auto" />}
                             </button>
                           </div>
                         </>
                       )}
                     </div>
                   </div>
                 )}

                 <div className="flex items-end gap-2 pt-8">
                   <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Ask ${state.llmConfig.model}...`}
                      className={`flex-1 bg-transparent text-black dark:text-white p-4 ${supportsThinking && !isFreeVersion ? 'pr-24' : ''} max-h-[150px] resize-none focus:outline-none text-[16px] leading-relaxed custom-scrollbar placeholder:text-gray-400 dark:placeholder:text-gray-600 font-medium`}
                      rows={1}
                      style={{ minHeight: '60px' }}
                    />

                    <div className="flex flex-col gap-2 pb-2">
                       <div className="flex items-center gap-1">
                         <label className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-400 cursor-pointer transition-colors" title="Attach context">
                            <Paperclip className="w-5 h-5" />
                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                         </label>

                         <button 
                            onClick={toggleSearch}
                            className={`p-3 rounded-full transition-all duration-300 ${
                              state.isSearchEnabled 
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' 
                                : 'hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-400'
                            }`}
                            title={state.isSearchEnabled ? "Search Enabled" : "Enable Web Search"}
                          >
                            <Globe className="w-5 h-5" />
                          </button>
                       </div>

                       <button 
                        onClick={handleSendMessage}
                        disabled={state.isLoading || (!input.trim() && state.activeFiles.length === 0)}
                        className="p-3 rounded-full bg-black dark:bg-white text-white dark:text-black hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-lg"
                      >
                        {state.isLoading ? (
                          <div className="w-5 h-5 rounded-sm border-2 border-white dark:border-black" />
                        ) : (
                          <ArrowUp className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                 </div>

                 {state.activeFiles.length > 0 && (
                   <div className="px-4 pb-3 flex gap-2 overflow-x-auto custom-scrollbar">
                     {state.activeFiles.slice(0, 3).map(f => (
                       <span key={f.id} className="text-xs font-mono bg-white dark:bg-black border border-gray-200 dark:border-white/10 px-2 py-1 rounded-md text-gray-500 whitespace-nowrap">
                         {f.name}
                       </span>
                     ))}
                     {state.activeFiles.length > 3 && (
                       <span className="text-xs font-mono bg-white dark:bg-black border border-gray-200 dark:border-white/10 px-2 py-1 rounded-md text-gray-500">
                         +{state.activeFiles.length - 3}
                       </span>
                     )}
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={toggleMobileMenu}></div>
          <div className="relative w-4/5 max-w-[320px] bg-white dark:bg-black h-full shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={toggleMobileMenu} className="absolute top-4 right-4 p-2 text-gray-400">
              <X className="w-6 h-6" />
            </button>
            
            {/* Mobile Model Selector */}
            <div className="px-8 pt-6 pb-2">
               <ModelSelector 
                 config={state.llmConfig} 
                 onConfigChange={handleConfigChange} 
               />
            </div>

            <Sidebar 
              className="h-full border-none"
              files={state.activeFiles} 
              repoTree={state.repoTree}
              onRemoveFile={removeFile} 
              onAddFiles={handleFileChange}
              githubLink={state.githubRepoLink}
              onGithubLinkChange={(val) => setState(prev => ({...prev, githubRepoLink: val}))}
              onGithubEnter={() => { handleGithubEnter(); toggleMobileMenu(); }}
              isDark={isDark}
              toggleTheme={toggleTheme}
              onRepoFileClick={(path) => { handleRepoFileClick(path); toggleMobileMenu(); }}
              isLoadingFile={loadingFileId}
              onResetConfig={() => { handleResetConfig(); toggleMobileMenu(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;