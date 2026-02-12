import React, { useState } from 'react';
import { LLMConfig, LLMProvider } from '../types';
import { Key, Check, ArrowRight, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { verifyKey } from '../services/keyVerification';

interface GatewayProps {
  initialConfig: LLMConfig;
  onComplete: (config: LLMConfig) => void;
}

// Validation logic (Basic Format Check)
const isValidKeyFormat = (provider: string, key: string) => {
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
    case 'openrouter':
      return trimmed.startsWith('sk-or-') && trimmed.length > 30;
    default:
      return false;
  }
};

// API Key links
const API_LINKS: Record<LLMProvider, { url: string; label: string }> = {
  google: { url: 'https://aistudio.google.com/apikey', label: 'Google AI' },
  openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
  deepseek: { url: 'https://platform.deepseek.com/api_keys', label: 'DeepSeek Platform' },
  openrouter: { url: 'https://openrouter.ai/keys', label: 'OpenRouter' }
};

export const Gateway: React.FC<GatewayProps> = ({ initialConfig, onComplete }) => {
  const [customKeys, setCustomKeys] = useState(initialConfig.apiKeys);
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [verifiedProviders, setVerifiedProviders] = useState<Set<string>>(new Set());

  const handleStart = async () => {
    setIsVerifying(true);
    setValidationErrors({});
    const newVerified = new Set<string>();
    let firstValidProvider: LLMProvider | null = null;
    let errors: Record<string, string> = {};

    const providersToCheck = (['google', 'openai', 'anthropic', 'deepseek', 'openrouter'] as LLMProvider[])
      .filter(p => isValidKeyFormat(p, customKeys[p]));

    await Promise.all(providersToCheck.map(async (provider) => {
      const key = customKeys[provider];
      const result = await verifyKey(provider, key);

      if (result.isValid) {
        newVerified.add(provider);
        if (!firstValidProvider) firstValidProvider = provider;
      } else {
        errors[provider] = result.error || "Authorization failed";
      }
    }));

    setVerifiedProviders(newVerified);
    setValidationErrors(errors);
    setIsVerifying(false);

    if (firstValidProvider && Object.keys(errors).length === 0) {
      // Determine default model based on provider
      let model = 'gemini-2.0-flash-exp';
      if (firstValidProvider === 'openai') model = 'gpt-4o';
      if (firstValidProvider === 'anthropic') model = 'claude-3-5-sonnet-latest';
      if (firstValidProvider === 'deepseek') model = 'deepseek-reasoner';
      if (firstValidProvider === 'openrouter') model = 'anthropic/claude-3.5-sonnet';

      const newConfig: LLMConfig = {
        provider: firstValidProvider,
        model,
        apiKeys: customKeys
      };

      // Delay slightly to show success state
      setTimeout(() => {
        onComplete(newConfig);
      }, 500);
    }
  };

  // Check if at least one key matches the basic format
  const hasFormatValidKey = Object.entries(customKeys).some(([provider, key]) => isValidKeyFormat(provider, key as string));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[100] bg-white dark:bg-black overflow-y-auto transition-colors duration-500"
    >
      <div className="min-h-full flex items-center justify-center p-4 md:p-6">
        <div className="max-w-xl w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-8 md:mb-12"
          >
            <h1 className="text-4xl md:text-6xl font-display font-bold text-black dark:text-white mb-4 tracking-tighter">
              Kittle
            </h1>
            <p className="text-gray-400 text-base md:text-lg font-medium max-w-md mx-auto leading-relaxed">
              Enter your API key to get started with AI-powered code analysis.
            </p>
          </motion.div>

          {/* API Keys Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100, damping: 15 }}
            className="bg-white dark:bg-black border border-gray-100 dark:border-zinc-800 p-6 md:p-10 rounded-[2rem] shadow-2xl shadow-gray-200/50 dark:shadow-none relative overflow-hidden"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-gray-100 to-transparent dark:from-zinc-900/50 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="p-3 rounded-xl bg-black dark:bg-white text-white dark:text-black">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-display text-black dark:text-white">API Configuration</h3>
                <p className="text-xs text-gray-400 font-medium">Add at least one API key to continue</p>
              </div>
            </div>

            <div className="space-y-5 mb-8 relative z-10">
              {(['google', 'openai', 'anthropic', 'deepseek', 'openrouter'] as const).map(provider => {
                const key = customKeys[provider];
                const formatValid = isValidKeyFormat(provider, key);
                const hasValue = key.length > 0;
                const link = API_LINKS[provider];
                const isVerified = verifiedProviders.has(provider);
                const error = validationErrors[provider];

                return (
                  <div key={provider} className="group">
                    <div className="flex items-center justify-between mb-2 pl-1">
                      <div className="flex items-center gap-2">
                        <label className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${hasValue
                          ? (error ? 'text-red-500' : (isVerified ? 'text-green-500' : 'text-gray-600 dark:text-gray-300'))
                          : 'text-gray-400'
                          }`}>
                          {provider}
                        </label>
                        {isVerified && <Check className="w-3 h-3 text-green-500 animate-in zoom-in" />}
                        {error && <XCircle className="w-3 h-3 text-red-500 animate-in zoom-in" />}
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors uppercase tracking-wide"
                      >
                        Get Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <input
                      type="password"
                      placeholder={provider === 'google' ? 'AIza...' : (provider === 'openrouter' ? 'sk-or-...' : 'sk-...')}
                      value={customKeys[provider]}
                      onChange={(e) => {
                        setCustomKeys({ ...customKeys, [provider]: e.target.value });
                        // Clear errors/verification status on change
                        if (validationErrors[provider]) {
                          const newErrors = { ...validationErrors };
                          delete newErrors[provider];
                          setValidationErrors(newErrors);
                        }
                        if (verifiedProviders.has(provider)) {
                          const newVerified = new Set(verifiedProviders);
                          newVerified.delete(provider);
                          setVerifiedProviders(newVerified);
                        }
                      }}
                      className={`w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-900 border focus:bg-white dark:focus:bg-black outline-none transition-all font-mono text-sm
                         ${error
                          ? 'border-red-200 dark:border-red-900/50 text-red-600 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20'
                          : (isVerified
                            ? 'border-green-200 dark:border-green-900/30 ring-1 ring-green-100 dark:ring-green-900/20'
                            : 'border-transparent focus:border-gray-200 dark:focus:border-zinc-700 focus:ring-4 focus:ring-gray-100 dark:focus:ring-zinc-800')}
                      `}
                    />
                    {error && (
                      <p className="text-[10px] text-red-500 mt-1.5 ml-1 font-medium animate-in slide-in-from-top-1">
                        {error}
                      </p>
                    )}
                    {hasValue && !formatValid && !error && (
                      <p className="text-[10px] text-orange-500 mt-1.5 ml-1 font-medium">
                        Invalid format. Expecting {provider === 'google' ? 'AIza...' : (provider === 'openrouter' ? 'sk-or-...' : 'sk-...')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleStart}
              disabled={!hasFormatValidKey || isVerifying}
              className="relative z-10 w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-3"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Verifying Keys...
                </>
              ) : (
                <>
                  Launch Workspace <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-4 font-medium">
              Your API keys are stored locally and never sent to our servers.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};