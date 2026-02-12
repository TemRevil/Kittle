import React, { useState, useRef } from 'react';
import { LLMConfig, AVAILABLE_MODELS, LLMProvider, LLMModel, MODEL_PRICING } from '../types';
import { Check, ChevronDown, Cpu, Zap, AlertTriangle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModelSelectorProps {
  config: LLMConfig;
  onConfigChange: (newConfig: LLMConfig) => void;
  capabilities: any;
}

const isValidKey = (provider: string, key: string) => {
  if (!key || key.trim() === '') return false;
  const trimmed = key.trim();
  switch (provider) {
    case 'google': return trimmed.startsWith('AIza') && trimmed.length > 30;
    case 'openai': return trimmed.startsWith('sk-') && trimmed.length > 30;
    case 'anthropic': return trimmed.startsWith('sk-ant') && trimmed.length > 30;
    case 'deepseek': return trimmed.startsWith('sk-') && trimmed.length > 20;
    case 'openrouter': return trimmed.startsWith('sk-or-') && trimmed.length > 30;
    default: return false;
  }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ config, onConfigChange, capabilities }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isProviderAvailable = (p: LLMProvider) => {
    if (p === 'google' && config.apiKeys.google === process.env.NEXT_PUBLIC_API_KEY && process.env.NEXT_PUBLIC_API_KEY) return true;
    return isValidKey(p, config.apiKeys[p]);
  };

  const availableProviders = (['google', 'deepseek', 'openai', 'anthropic', 'openrouter'] as LLMProvider[]).filter(isProviderAvailable);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors group"
      >
        <div className={`p-1 rounded bg-white dark:bg-black shadow-sm ${availableProviders.length === 0 ? 'text-red-500' : 'text-black dark:text-white'}`}>
          {availableProviders.length === 0 ? <AlertTriangle className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
        </div>

        <div className="flex flex-col items-start text-left">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">API's Gateway</span>
          <span className="text-xs font-bold text-black dark:text-white leading-none mt-1">
            {AVAILABLE_MODELS[config.provider]?.find(m => m.id === config.model)?.name ||
              capabilities?.[config.provider]?.discoveredModels?.find((m: LLMModel) => m.id === config.model)?.name ||
              "Select Model"}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute top-full left-0 mt-3 w-72 bg-white/70 dark:bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] z-50 overflow-hidden"
            >
              <div className="p-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                <div className="space-y-4 p-2">
                  {availableProviders.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
                      <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">No Valid APIs</p>
                      <p className="text-xs text-red-500/80 mb-4">Add a key in Sidebar Settings to unlock models.</p>
                    </div>
                  ) : (
                    availableProviders.map(provider => {
                      const hardcodedModels = AVAILABLE_MODELS[provider] || [];
                      const discoveredModels = capabilities?.[provider]?.discoveredModels || [];
                      const isLive = discoveredModels.length > 0;

                      let finalModels = hardcodedModels;
                      if (provider === 'google' && isLive) {
                        finalModels = discoveredModels;
                      } else if (isLive) {
                        const discoveredIds = new Set(discoveredModels.map((m: any) => m.id));
                        finalModels = [...discoveredModels, ...hardcodedModels.filter(m => !discoveredIds.has(m.id))];
                      }

                      // Sort: thinking models first, then alphabetically
                      finalModels = [...finalModels].sort((a, b) => {
                        if (a.hasThinking && !b.hasThinking) return -1;
                        if (!a.hasThinking && b.hasThinking) return 1;
                        return a.name.localeCompare(b.name);
                      });

                      return (
                        <div key={provider} className="space-y-2">
                          <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              {provider}
                            </span>
                            {isLive && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-bold tracking-tighter animate-pulse">
                                LIVE
                              </span>
                            )}
                            <div className="h-px flex-1 bg-gray-100 dark:bg-white/5"></div>
                          </div>

                          <div className="space-y-1">
                            {finalModels.map(model => (
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
                                <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 w-full">
                                    <span className="font-medium text-left truncate">
                                      {model.name}
                                    </span>
                                    {model.hasThinking && (
                                      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wide shrink-0 ${config.model === model.id
                                        ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black'
                                        : 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                        }`}>
                                        <Zap className="w-2.5 h-2.5" />
                                        Deep
                                      </span>
                                    )}
                                  </div>
                                  {model.hasThinking && (
                                    <span className={`text-[9px] text-left ${config.model === model.id ? 'text-white/70 dark:text-black/70' : 'text-gray-400'}`}>
                                      Reasoning available
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                                  {MODEL_PRICING[model.id] && (
                                    <span className={`text-[9px] font-bold ${config.model === model.id ? 'text-white/60 dark:text-black/60' : 'text-gray-400'}`}>
                                      ${MODEL_PRICING[model.id].input}/${MODEL_PRICING[model.id].output}
                                    </span>
                                  )}
                                  {config.model === model.id && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
