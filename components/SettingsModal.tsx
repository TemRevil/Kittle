import React, { useState } from 'react';
import { LLMConfig, LLMProvider } from '../types';
import { Key, Check, X, XCircle, ExternalLink, Loader2, BarChart3, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { verifyKey } from '../services/keyVerification';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: LLMConfig;
    onConfigChange: (newConfig: LLMConfig) => void;
    totalUsage: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number;
    };
    modelUsage: Record<string, { promptTokens: number; completionTokens: number; totalCost: number }>;
    conversations: any[];
}

const API_LINKS: Record<LLMProvider, { url: string; label: string }> = {
    google: { url: 'https://aistudio.google.com/apikey', label: 'Google AI' },
    openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
    anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
    deepseek: { url: 'https://platform.deepseek.com/api_keys', label: 'DeepSeek Platform' }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    config,
    onConfigChange,
    totalUsage,
    modelUsage,
    conversations
}) => {
    const [activeTab, setActiveTab] = useState<'analytics' | 'models' | 'keys'>('analytics');
    const [customKeys, setCustomKeys] = useState(config.apiKeys);
    const [isVerifying, setIsVerifying] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [verifiedProviders, setVerifiedProviders] = useState<Set<string>>(new Set());

    const handleSave = async () => {
        setIsVerifying(true);
        setValidationErrors({});
        const newVerified = new Set<string>();
        let errors: Record<string, string> = {};

        const providersToCheck = (['google', 'openai', 'anthropic', 'deepseek'] as LLMProvider[])
            .filter(p => customKeys[p] && customKeys[p] !== config.apiKeys[p]);

        if (providersToCheck.length === 0) {
            onConfigChange({ ...config, apiKeys: customKeys });
            setIsVerifying(false);
            onClose();
            return;
        }

        await Promise.all(providersToCheck.map(async (provider) => {
            const result = await verifyKey(provider, customKeys[provider]);
            if (result.isValid) {
                newVerified.add(provider);
            } else {
                errors[provider] = result.error || "Verification failed";
            }
        }));

        if (Object.keys(errors).length === 0) {
            onConfigChange({ ...config, apiKeys: customKeys });
            setVerifiedProviders(newVerified);
            setTimeout(() => {
                setIsVerifying(false);
                onClose();
            }, 500);
        } else {
            setValidationErrors(errors);
            setIsVerifying(false);
        }
    };

    const tabs = [
        { id: 'analytics', label: 'Resource Ranking', icon: TrendingUp },
        { id: 'models', label: 'Model Breakdown', icon: Zap },
        { id: 'keys', label: 'API Configuration', icon: Key },
    ] as const;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 100 }}
                        className="relative w-full max-w-4xl h-auto max-h-[90vh] md:h-[700px] bg-white dark:bg-zinc-950 rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col md:flex-row"
                    >
                        {/* Aside Sidebar - Desktop Only */}
                        <aside className="hidden md:flex w-72 bg-gray-50/50 dark:bg-white/[0.02] border-r border-gray-100 dark:border-white/5 flex-col">
                            <div className="p-8">
                                <div className="flex items-center gap-3 mb-10">
                                    <div className="p-2.5 bg-black dark:bg-white rounded-xl">
                                        <BarChart3 className="w-5 h-5 text-white dark:text-black" />
                                    </div>
                                    <h2 className="text-xl font-bold font-display text-black dark:text-white tracking-tight">Settings</h2>
                                </div>

                                <nav className="space-y-2">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id
                                                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                                                : 'text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <div className="mt-auto p-8">
                                <div className="p-6 bg-blue-500/10 dark:bg-blue-500/5 rounded-[2rem] border border-blue-500/20">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Total Spend</div>
                                    <div className="text-2xl font-display font-black text-black dark:text-white">
                                        ${totalUsage.totalCost.toFixed(4)}
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-1 font-medium">Estimated AI Costs</div>
                                </div>
                            </div>
                        </aside>

                        {/* Mobile Header Tabs */}
                        <div className="md:hidden flex overflow-x-auto p-4 gap-2 border-b border-gray-100 dark:border-white/5 no-scrollbar">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab.id
                                        ? 'bg-black dark:bg-white text-white dark:text-black'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <header className="px-6 md:px-10 py-5 md:py-8 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-bold text-black dark:text-white leading-none mb-1">
                                        {tabs.find(t => t.id === activeTab)?.label}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest md:hidden">Total Spend: ${totalUsage.totalCost.toFixed(4)}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 hover:text-black dark:hover:text-white transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </header>

                            <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'analytics' && (
                                        <motion.section
                                            key="analytics"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-3">
                                                {[...conversations]
                                                    .filter(c => (c.totalUsage?.promptTokens || 0) > 0 || (c.totalUsage?.completionTokens || 0) > 0)
                                                    .sort((a, b) => {
                                                        const totalA = (a.totalUsage?.promptTokens || 0) + (a.totalUsage?.completionTokens || 0);
                                                        const totalB = (b.totalUsage?.promptTokens || 0) + (b.totalUsage?.completionTokens || 0);
                                                        return totalB - totalA;
                                                    })
                                                    .slice(0, 15)
                                                    .map((conv, index) => {
                                                        const total = (conv.totalUsage?.promptTokens || 0) + (conv.totalUsage?.completionTokens || 0);
                                                        return (
                                                            <div key={conv.id} className="flex items-center justify-between p-4 md:p-5 bg-gray-50 dark:bg-white/5 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-white/5 group hover:border-blue-500/30 transition-all">
                                                                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center text-[10px] md:text-xs font-black shrink-0 ${index === 0 ? 'bg-amber-100 text-amber-600 shadow-sm' :
                                                                        index === 1 ? 'bg-gray-200 text-gray-600 shadow-sm' :
                                                                            index === 2 ? 'bg-orange-100 text-orange-600 shadow-sm' :
                                                                                'bg-white dark:bg-white/5 text-gray-400 border border-gray-100 dark:border-white/5'
                                                                        }`}>
                                                                        {index + 1}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-xs md:text-sm font-bold text-black dark:text-white truncate pr-4">{conv.title || "Untitled Conversation"}</div>
                                                                        <div className="text-[9px] md:text-[10px] text-gray-400 font-medium tracking-wide">{(new Date(conv.lastModified)).toLocaleDateString()}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className="text-sm md:text-[15px] font-black text-black dark:text-white">
                                                                        {(total / 1000).toFixed(1)}k <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">tkn</span>
                                                                    </div>
                                                                    <div className="text-[9px] md:text-[10px] font-bold text-blue-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                                        ${(conv.totalUsage?.totalCost || 0).toFixed(4)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                {conversations.filter(c => (c.totalUsage?.totalCost || 0) > 0).length === 0 && (
                                                    <div className="text-center py-16 md:py-20 text-gray-400 text-xs md:text-sm font-medium italic bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] md:rounded-[3rem] px-6">
                                                        No resource data captured for your chats yet. Start a conversation to see rankings.
                                                    </div>
                                                )}
                                            </div>
                                        </motion.section>
                                    )}

                                    {activeTab === 'models' && (
                                        <motion.section
                                            key="models"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="grid grid-cols-1 gap-4"
                                        >
                                            {Object.entries(modelUsage).map(([modelId, stats]) => (
                                                <div key={modelId} className="p-5 md:p-6 bg-gray-50 dark:bg-white/5 rounded-2xl md:rounded-[2.5rem] border border-gray-100 dark:border-white/5">
                                                    <div className="flex items-center justify-between mb-4 md:mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                                                                <Zap size={16} className="md:w-5 md:h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[11px] md:text-sm font-black text-black dark:text-white uppercase tracking-tight truncate max-w-[120px] md:max-w-none">{modelId}</div>
                                                                <div className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Model Instance</div>
                                                            </div>
                                                        </div>
                                                        <div className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-500 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-black">
                                                            ${stats.totalCost.toFixed(5)}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                                        <div className="p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-gray-100 dark:border-white/5">
                                                            <div className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Input Volume</div>
                                                            <div className="text-lg md:text-xl font-display font-black text-black dark:text-white">{(stats.promptTokens / 1000).toFixed(2)}k</div>
                                                        </div>
                                                        <div className="p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-gray-100 dark:border-white/5">
                                                            <div className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Output Volume</div>
                                                            <div className="text-lg md:text-xl font-display font-black text-black dark:text-white">{(stats.completionTokens / 1000).toFixed(2)}k</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {Object.keys(modelUsage).length === 0 && (
                                                <div className="text-center py-20 text-gray-400 text-xs md:text-sm font-medium italic bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] md:rounded-[3rem] px-6">
                                                    No model breakdown available yet.
                                                </div>
                                            )}
                                        </motion.section>
                                    )}

                                    {activeTab === 'keys' && (
                                        <motion.section
                                            key="keys"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-6 md:space-y-8"
                                        >
                                            <div className="grid grid-cols-1 gap-5 md:gap-6">
                                                {(['google', 'openai', 'anthropic', 'deepseek'] as const).map(provider => {
                                                    const error = validationErrors[provider];
                                                    const isVerified = verifiedProviders.has(provider);
                                                    const link = API_LINKS[provider];

                                                    return (
                                                        <div key={provider} className="relative group">
                                                            <div className="flex items-center justify-between mb-2 px-1">
                                                                <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                                                    {provider} Key
                                                                </label>
                                                                <a
                                                                    href={link.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[9px] md:text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline tracking-tight"
                                                                >
                                                                    Get Key <ExternalLink className="w-2 md:w-2.5 h-2 md:h-2.5" />
                                                                </a>
                                                            </div>
                                                            <div className="relative">
                                                                <input
                                                                    type="password"
                                                                    value={customKeys[provider]}
                                                                    placeholder={`••••••••••••••••`}
                                                                    onChange={(e) => setCustomKeys({ ...customKeys, [provider]: e.target.value })}
                                                                    className={`w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4.5 text-xs md:text-sm font-mono transition-all
                                                                    ${error ? 'ring-2 ring-red-500/20' : 'focus:ring-2 focus:ring-black dark:focus:ring-white'}
                                                                `}
                                                                />
                                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {isVerified && <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" />}
                                                                    {error && <XCircle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />}
                                                                </div>
                                                            </div>
                                                            {error && <p className="text-[9px] md:text-[10px] text-red-500 mt-2 ml-1 font-medium italic">{error}</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.section>
                                    )}
                                </AnimatePresence>
                            </main>

                            {/* Footer */}
                            <footer className="p-6 md:p-10 pt-4 md:pt-6 border-t border-gray-100 dark:border-white/5 bg-white/50 dark:bg-zinc-950/50">
                                <div className="flex gap-3 md:gap-4">
                                    <button
                                        onClick={onClose}
                                        className="px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-400 hover:text-black dark:hover:text-white transition-all text-xs md:text-sm"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isVerifying}
                                        className="flex-1 py-3.5 md:py-4.5 px-6 md:px-10 bg-black dark:bg-white text-white dark:text-black rounded-2xl md:rounded-3xl font-bold text-xs md:text-sm shadow-xl md:shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 md:gap-3"
                                    >
                                        {isVerifying ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                                <span>Verifying...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                <span>Save All Changes</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

