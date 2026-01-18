import React, { useState, useEffect, useRef } from 'react';
import { LLMConfig, LLMProvider, AVAILABLE_MODELS } from '../types';
import { Zap, Key, Check, ChevronRight, Shield, Cpu, ArrowRight, XCircle } from 'lucide-react';
import anime from 'animejs';

interface GatewayProps {
  initialConfig: LLMConfig;
  onComplete: (config: LLMConfig) => void;
}

// Validation logic
const isValidKey = (provider: string, key: string) => {
  if (!key || key.trim() === '') return false;
  const trimmed = key.trim();
  
  switch (provider) {
    case 'google':
      return trimmed.startsWith('AIza') && trimmed.length > 30;
    case 'openai':
      return trimmed.startsWith('sk-') && trimmed.length > 30;
    case 'anthropic':
      return trimmed.startsWith('sk-ant') && trimmed.length > 30;
    case 'deepseek':
      return trimmed.startsWith('sk-') && trimmed.length > 20;
    default:
      return false;
  }
};

export const Gateway: React.FC<GatewayProps> = ({ initialConfig, onComplete }) => {
  const [mode, setMode] = useState<'selection' | 'custom'>('selection');
  const [customKeys, setCustomKeys] = useState(initialConfig.apiKeys);
  const containerRef = useRef<HTMLDivElement>(null);

  // Entrance Animation
  useEffect(() => {
    // Reset initial state for animation
    const elements = document.querySelectorAll('.gateway-entry');
    anime.set(elements, { opacity: 0, translateY: 30, scale: 0.95 });

    anime({
      targets: '.gateway-entry',
      translateY: [30, 0],
      scale: [0.95, 1],
      opacity: [0, 1],
      delay: anime.stagger(150),
      easing: 'spring(1, 80, 10, 0)', // Spring physics for "mood" selection feel
      duration: 1200
    });
  }, [mode]);

  const handleFreeStart = () => {
    // Reset to Google default with env key
    const newConfig: LLMConfig = {
      ...initialConfig,
      provider: 'google',
      model: 'gemini-2.0-flash-thinking-exp',
      apiKeys: {
        ...initialConfig.apiKeys,
        google: (process.env.API_KEY as string) || ''
      }
    };
    exitAnimation(() => onComplete(newConfig));
  };

  const handleCustomStart = () => {
    // Determine provider based on which keys are present AND valid
    let provider: LLMProvider = 'google';
    let model = 'gemini-2.0-flash-thinking-exp';

    if (isValidKey('openai', customKeys.openai)) {
      provider = 'openai';
      model = 'gpt-4o';
    } else if (isValidKey('anthropic', customKeys.anthropic)) {
      provider = 'anthropic';
      model = 'claude-3-5-sonnet-latest';
    } else if (isValidKey('deepseek', customKeys.deepseek)) {
      provider = 'deepseek';
      model = 'deepseek-reasoner';
    } else if (isValidKey('google', customKeys.google)) {
      provider = 'google';
      model = 'gemini-2.0-flash-thinking-exp';
    }

    const newConfig: LLMConfig = {
      provider,
      model,
      apiKeys: customKeys
    };
    exitAnimation(() => onComplete(newConfig));
  };

  const exitAnimation = (cb: () => void) => {
    anime({
      targets: containerRef.current,
      opacity: [1, 0],
      scale: [1, 0.9],
      filter: ['blur(0px)', 'blur(10px)'],
      duration: 600,
      easing: 'easeOutExpo',
      complete: cb
    });
  };

  // Check if at least one key is valid
  const hasValidKey = Object.entries(customKeys).some(([provider, key]) => isValidKey(provider, key as string));

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex items-center justify-center p-6 transition-colors duration-500">
      <div ref={containerRef} className="max-w-4xl w-full">
        
        {/* Header */}
        <div className="text-center mb-16 gateway-entry">
          <h1 className="text-6xl md:text-7xl font-display font-bold text-black dark:text-white mb-6 tracking-tighter">
            CodeCleanse AI
          </h1>
          <p className="text-gray-400 text-xl font-medium max-w-lg mx-auto leading-relaxed">
            Select your reasoning engine.
          </p>
        </div>

        {mode === 'selection' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Option */}
            <button 
              onClick={handleFreeStart}
              className="gateway-entry group relative p-8 rounded-[2rem] bg-gray-50 dark:bg-zinc-900 border-2 border-transparent hover:border-blue-500/20 dark:hover:border-blue-500/30 transition-all text-left hover:scale-[1.02] active:scale-[0.98] duration-300"
            >
              <div className="absolute top-8 right-8 p-3 rounded-full bg-white dark:bg-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                <ArrowRight className="w-5 h-5" />
              </div>
              
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-8 group-hover:bg-blue-500/20 transition-colors">
                <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="text-3xl font-display font-bold text-black dark:text-white mb-3">
                Standard
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                Instant access via Gemini Flash Thinking. Optimized for speed and code auditing.
              </p>
              
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Shield className="w-4 h-4" /> Free Access
              </div>
            </button>

            {/* Custom Option */}
            <button 
              onClick={() => setMode('custom')}
              className="gateway-entry group relative p-8 rounded-[2rem] bg-white dark:bg-black border-2 border-gray-100 dark:border-zinc-800 hover:border-purple-500/20 dark:hover:border-purple-500/30 transition-all text-left hover:scale-[1.02] active:scale-[0.98] duration-300 shadow-2xl shadow-gray-200/50 dark:shadow-none"
            >
               <div className="absolute top-8 right-8 p-3 rounded-full bg-gray-50 dark:bg-zinc-800 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-all">
                <ChevronRight className="w-5 h-5" />
              </div>

              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-8 group-hover:bg-purple-500/20 transition-colors">
                <Key className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              
              <h3 className="text-3xl font-display font-bold text-black dark:text-white mb-3">
                BYO Keys
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                Configure OpenAI, Anthropic, or DeepSeek for specialized reasoning tasks.
              </p>
              
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                <Cpu className="w-4 h-4" /> Custom API
              </div>
            </button>
          </div>
        ) : (
          <div className="max-w-xl mx-auto gateway-entry bg-white dark:bg-black border border-gray-100 dark:border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-gray-100 to-transparent dark:from-zinc-900/50 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

             <div className="flex items-center justify-between mb-10 relative z-10">
               <h3 className="text-2xl font-bold font-display text-black dark:text-white">API Configuration</h3>
               <button 
                  onClick={() => setMode('selection')} 
                  className="px-4 py-2 rounded-full bg-gray-100 dark:bg-zinc-900 text-xs font-bold text-gray-500 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
               >
                 Go Back
               </button>
             </div>

             <div className="space-y-6 mb-10 relative z-10">
               {(['google', 'openai', 'anthropic', 'deepseek'] as const).map(provider => {
                 const key = customKeys[provider];
                 const valid = isValidKey(provider, key);
                 const hasValue = key.length > 0;

                 return (
                   <div key={provider} className="group">
                     <div className="flex items-center justify-between mb-2 pl-1">
                        <label className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${hasValue ? (valid ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`}>
                          {provider}
                        </label>
                        {valid && <Check className="w-3 h-3 text-green-500 animate-in zoom-in" />}
                        {hasValue && !valid && <XCircle className="w-3 h-3 text-red-500 animate-in zoom-in" />}
                     </div>
                     <input 
                        type="password"
                        placeholder={provider === 'google' ? 'AIza...' : 'sk-...'}
                        value={customKeys[provider]}
                        onChange={(e) => setCustomKeys({...customKeys, [provider]: e.target.value})}
                        className={`w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-900 border focus:bg-white dark:focus:bg-black outline-none transition-all font-mono text-sm
                           ${hasValue && !valid 
                             ? 'border-red-200 dark:border-red-900/50 text-red-600 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20' 
                             : 'border-transparent focus:border-gray-200 dark:focus:border-zinc-700 focus:ring-4 focus:ring-gray-100 dark:focus:ring-zinc-800'}
                        `}
                     />
                     {hasValue && !valid && (
                       <p className="text-[10px] text-red-500 mt-1.5 ml-1 font-medium">
                         Invalid key format. Should start with {provider === 'google' ? 'AIza' : 'sk-'}.
                       </p>
                     )}
                   </div>
                 );
               })}
             </div>

             <button 
               onClick={handleCustomStart}
               disabled={!hasValidKey}
               className="relative z-10 w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-3"
             >
               Launch Workspace <ArrowRight className="w-5 h-5" />
             </button>
          </div>
        )}
        
      </div>
    </div>
  );
};