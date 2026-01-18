import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, AVAILABLE_MODELS, LLMProvider } from '../types';
import { Check, ChevronDown, Key, Cpu, Zap, Eye, EyeOff, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import anime from 'animejs';

interface ModelSelectorProps {
  config: LLMConfig;
  onConfigChange: (newConfig: LLMConfig) => void;
}

// Reuse validation logic locally or import if shared (kept local for simplicity here as it's small)
const isValidKey = (provider: string, key: string) => {
  if (!key || key.trim() === '') return false;
  const trimmed = key.trim();
  switch (provider) {
    case 'google': return trimmed.startsWith('AIza') && trimmed.length > 30;
    case 'openai': return trimmed.startsWith('sk-') && trimmed.length > 30;
    case 'anthropic': return trimmed.startsWith('sk-ant') && trimmed.length > 30;
    case 'deepseek': return trimmed.startsWith('sk-') && trimmed.length > 20;
    default: return false;
  }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ config, onConfigChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'models' | 'keys'>('models');
  const [showKeys, setShowKeys] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      anime({
        targets: dropdownRef.current,
        opacity: [0, 1],
        translateY: [-10, 0],
        scale: [0.95, 1],
        duration: 300,
        easing: 'easeOutExpo'
      });
    }
  }, [isOpen]);

  const handleProviderSelect = (p: LLMProvider) => {
    onConfigChange({ 
      ...config, 
      provider: p, 
      model: AVAILABLE_MODELS[p][0].id 
    });
  };

  const handleKeyChange = (provider: LLMProvider, key: string) => {
    onConfigChange({
      ...config,
      apiKeys: { ...config.apiKeys, [provider]: key }
    });
  };

  // Determine which providers are "available" (have a VALID key or is google default)
  const isProviderAvailable = (p: LLMProvider) => {
    // Special case for Google: if default env key is used, it's valid
    if (p === 'google' && config.apiKeys.google === process.env.API_KEY && process.env.API_KEY) return true;
    
    // Otherwise check validity
    return isValidKey(p, config.apiKeys[p]);
  };

  // Get list of available providers based on keys
  const availableProviders = (['google', 'deepseek', 'openai', 'anthropic'] as LLMProvider[]).filter(isProviderAvailable);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors group"
      >
        <div className={`p-1 rounded bg-white dark:bg-black shadow-sm ${availableProviders.length === 0 ? 'text-red-500' : 'text-black dark:text-white'}`}>
           {availableProviders.length === 0 ? <AlertTriangle className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
        </div>
        
        <div className="flex flex-col items-start text-left">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">Model</span>
          <span className="text-xs font-bold text-black dark:text-white leading-none mt-1">
            {AVAILABLE_MODELS[config.provider]?.find(m => m.id === config.model)?.name || "Select Model"}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 mt-3 w-72 bg-white dark:bg-[#09090b] rounded-2xl border border-gray-100 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
          >
            {/* Header Tabs */}
            <div className="flex border-b border-gray-100 dark:border-white/10 p-1.5 bg-gray-50 dark:bg-white/5 gap-1">
              <button 
                onClick={() => setActiveTab('models')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'models' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
              >
                Selection
              </button>
              <button 
                onClick={() => setActiveTab('keys')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'keys' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
              >
                Settings
              </button>
            </div>

            <div className="p-2 max-h-[350px] overflow-y-auto custom-scrollbar">
              {activeTab === 'models' ? (
                <div className="space-y-2 p-2">
                  {availableProviders.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
                      <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">No Valid APIs</p>
                      <p className="text-xs text-red-500/80 mb-4">Add a valid API key in Settings to unlock models.</p>
                      <button 
                        onClick={() => setActiveTab('keys')} 
                        className="text-xs font-bold px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Go to Settings
                      </button>
                    </div>
                  ) : (
                    availableProviders.map(provider => (
                      <div key={provider} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2 mb-2 px-2">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                             {provider}
                           </span>
                           <div className="h-px flex-1 bg-gray-100 dark:bg-white/5"></div>
                        </div>
                        
                        <div className="space-y-1">
                          {AVAILABLE_MODELS[provider].map(model => (
                            <button
                              key={model.id}
                              onClick={() => {
                                onConfigChange({ ...config, provider, model: model.id });
                                setIsOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all group
                                ${config.model === model.id 
                                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' 
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}
                              `}
                            >
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="font-medium flex items-center gap-1.5">
                                  {model.name}
                                  {model.hasThinking && (
                                    <Zap className={`w-3 h-3 ${config.model === model.id ? 'text-yellow-300 dark:text-yellow-600' : 'text-yellow-500'}`} />
                                  )}
                                </span>
                                {model.hasThinking && (
                                  <span className={`text-[9px] opacity-70 ${config.model === model.id ? 'text-white/80 dark:text-black/80' : 'text-gray-400'}`}>
                                    Supports Reasoning
                                  </span>
                                )}
                              </div>
                              {config.model === model.id && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">API Configuration</p>
                    <button 
                      onClick={() => setShowKeys(!showKeys)} 
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      title={showKeys ? "Hide Keys" : "Show Keys"}
                    >
                      {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {(['google', 'openai', 'anthropic', 'deepseek'] as LLMProvider[]).map(provider => {
                    const key = config.apiKeys[provider];
                    const valid = isValidKey(provider, key);
                    const hasValue = key.length > 0;
                    
                    return (
                      <div key={provider} className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">{provider}</label>
                          {hasValue && (valid ? <Check className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />)}
                        </div>
                        <div className="relative group">
                          <Key className={`absolute left-3 top-2.5 w-3.5 h-3.5 transition-colors ${hasValue && !valid ? 'text-red-400' : 'text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white'}`} />
                          <input 
                            type={showKeys ? "text" : "password"}
                            value={config.apiKeys[provider]}
                            onChange={(e) => handleKeyChange(provider, e.target.value)}
                            placeholder={provider === 'google' ? 'AIza...' : 'sk-...'}
                            className={`w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border rounded-xl text-xs font-mono focus:outline-none transition-all
                              ${hasValue && !valid 
                                ? 'border-red-200 dark:border-red-900/50 text-red-600 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30' 
                                : 'border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-black dark:focus:ring-white'}
                            `}
                          />
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="px-2 pt-2">
                     <p className="text-[10px] text-gray-400 leading-relaxed text-center">
                       Keys are stored locally in your browser and are never sent to our servers.
                     </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
