import React, { useState, useEffect } from 'react';
import { LLMConfig, LLMProvider } from '../types';
import { Key, Check, X, XCircle, ExternalLink, Loader2, BarChart3, TrendingUp, DollarSign, Zap, Settings, Shield, Activity, ChevronRight, Globe, Lock, Sun, Moon } from 'lucide-react';
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
    onResetUsage: () => void;
    onFullReset: () => void;
    isDark: boolean;
    onToggleTheme: () => void;
}

const API_LINKS: Record<LLMProvider, { url: string; label: string }> = {
    google: { url: 'https://aistudio.google.com/apikey', label: 'Google AI' },
    openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
    anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
    deepseek: { url: 'https://platform.deepseek.com/api_keys', label: 'DeepSeek Platform' },
    openrouter: { url: 'https://openrouter.ai/keys', label: 'OpenRouter' }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    config,
    onConfigChange,
    totalUsage,
    modelUsage,
    conversations,
    onResetUsage,
    onFullReset,
    isDark,
    onToggleTheme
}) => {
    const [activeTab, setActiveTab] = useState<'analytics' | 'models' | 'keys' | 'appearance'>('analytics');
    const [customKeys, setCustomKeys] = useState(config.apiKeys);
    const [isVerifying, setIsVerifying] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [verifiedProviders, setVerifiedProviders] = useState<Set<string>>(new Set());
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'usage' | 'full'; title: string; desc: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCustomKeys(config.apiKeys);
            setValidationErrors({});
        }
    }, [isOpen, config.apiKeys]);

    const handleSave = async () => {
        setIsVerifying(true);
        setValidationErrors({});
        const newVerified = new Set<string>();
        let errors: Record<string, string> = {};

        const providersToCheck = (['google', 'openai', 'anthropic', 'deepseek', 'openrouter'] as LLMProvider[])
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
        { id: 'analytics', label: 'Usage Insights', icon: Activity, description: 'Track your spending and activity' },
        { id: 'models', label: 'Model Intelligence', icon: Zap, description: 'Analyze performance by engine' },
        { id: 'appearance', label: 'Appearance', icon: Sun, description: 'Personalize your interface' },
        { id: 'keys', label: 'API & Security', icon: Shield, description: 'Manage your secure connections' },
    ] as const;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 lg:p-12 overflow-hidden bg-black/80 backdrop-blur-xl">
                {/* Backdrop Click Area */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 cursor-pointer"
                    onClick={onClose}
                />

                {/* Main Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full h-full max-h-[90dvh] md:h-[85vh] md:max-h-[85vh] max-w-6xl bg-white dark:bg-zinc-950 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border md:border border-black/5 dark:border-white/10 overflow-hidden flex flex-col md:flex-row z-10"
                >
                    {/* ASIDE SIDEBAR (Desktop) / TOP NAV (Mobile) */}
                    <aside className="w-full md:w-80 lg:w-96 bg-gray-50 dark:bg-zinc-900/50 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 flex flex-col shrink-0 overflow-y-auto no-scrollbar">
                        <div className="p-6 md:p-8 md:pb-4 flex flex-col h-full">
                            <div className="flex items-center justify-between md:justify-start gap-4 mb-6 md:mb-10 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-black dark:bg-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-white dark:text-black" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-black text-black dark:text-white tracking-tight">System</h2>
                                        <p className="text-[9px] md:text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-[0.2em] hidden md:block">Preferences</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="md:hidden p-2.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto gap-2 pb-2 md:pb-0 no-scrollbar touch-pan-x snap-x snap-mandatory flex-1 min-h-0">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-none md:w-full group flex items-center md:items-start gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 snap-center ${activeTab === tab.id
                                            ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/5 dark:shadow-white/5'
                                            : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <tab.icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${activeTab === tab.id ? 'text-white dark:text-black' : 'group-hover:text-black dark:group-hover:text-white transition-colors'}`} />
                                        <div className="text-left">
                                            <div className="font-black text-xs md:text-sm whitespace-nowrap md:whitespace-normal">{tab.label}</div>
                                            <div className="text-[9px] md:text-[10px] font-bold opacity-60 line-clamp-1 hidden md:block">{tab.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Sidebar Badge */}
                        <div className="mt-auto p-8 hidden md:block">
                            <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <Globe className="w-12 h-12" />
                                </div>
                                <div className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-2">Network Consumption</div>
                                <div className="text-2xl font-black text-black dark:text-white italic tracking-tighter">
                                    ${totalUsage.totalCost.toFixed(3)}
                                </div>
                                <div className="mt-4 space-y-3">
                                    <div className="flex justify-between items-center py-2 border-y border-black/5 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-black/20 dark:text-white/20 uppercase tracking-widest">Total Tokens</span>
                                            <span className="text-xs font-black text-black dark:text-white">{totalUsage.promptTokens + totalUsage.completionTokens}</span>
                                        </div>
                                        <div className="text-right flex flex-col">
                                            <span className="text-[8px] font-black text-black/20 dark:text-white/20 uppercase tracking-widest">Models Used</span>
                                            <span className="text-xs font-black text-black dark:text-white">{Object.keys(modelUsage).length}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Active System</span>
                                        </div>
                                        <button
                                            onClick={() => setConfirmModal({
                                                isOpen: true,
                                                type: 'usage',
                                                title: 'Reset Usage Statistics?',
                                                desc: 'This will clear all token counts and cost history. Your API keys and chat history will remain safe.'
                                            })}
                                            className="text-[9px] font-bold text-black/20 dark:text-white/20 hover:text-red-500 transition-all uppercase tracking-[0.2em] hover:scale-105 active:scale-95"
                                        >
                                            Reset Stats
                                        </button>
                                    </div>
                                </div>

                                {/* CRITICAL ACTIONS */}
                                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                                    <button
                                        onClick={() => setConfirmModal({
                                            isOpen: true,
                                            type: 'full',
                                            title: 'Nuke Local Archive?',
                                            desc: 'Warning: This will permanently delete ALL API keys, chat history, and preferences. This action cannot be undone.'
                                        })}
                                        className="w-full flex items-center justify-between p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-2xl group transition-all"
                                    >
                                        <div className="text-left">
                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Full System Reset</div>
                                            <div className="text-[9px] font-bold text-red-500/30">Destroy all local data</div>
                                        </div>
                                        <XCircle className="w-4 h-4 text-red-500/20 group-hover:text-red-500 transition-colors" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* MAIN CONTENT AREA */}
                    <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-zinc-950 relative">
                        {/* Header Header (Mobile hidden) / Current Tab Title (Desktop) */}
                        <header className="px-8 py-8 hidden md:flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-20">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1">Configuration</span>
                                <h3 className="text-2xl md:text-3xl font-black text-black dark:text-white tracking-tight">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-all transform hover:rotate-90"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </header>

                        {/* Scrollable Content Container */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 custom-scrollbar min-h-0 scroll-smooth">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'analytics' && (
                                        <motion.section
                                            key="analytics"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-4"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                                <div className="p-6 bg-black/[0.02] dark:bg-white/[0.03] rounded-3xl border border-black/5 dark:border-white/5">
                                                    <div className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-2">Prompt Tokens</div>
                                                    <div className="text-3xl font-black text-black dark:text-white italic tracking-tighter">
                                                        {totalUsage.promptTokens >= 1000000
                                                            ? `${(totalUsage.promptTokens / 1000000).toFixed(2)}M`
                                                            : `${(totalUsage.promptTokens / 1000).toFixed(1)}k`}
                                                    </div>
                                                </div>
                                                <div className="p-6 bg-black/[0.02] dark:bg-white/[0.03] rounded-3xl border border-black/5 dark:border-white/5">
                                                    <div className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-2">Completion Tokens</div>
                                                    <div className="text-3xl font-black text-black dark:text-white italic tracking-tighter">
                                                        {totalUsage.completionTokens >= 1000000
                                                            ? `${(totalUsage.completionTokens / 1000000).toFixed(2)}M`
                                                            : `${(totalUsage.completionTokens / 1000).toFixed(1)}k`}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-xs font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-6">Recent Heavy Queries</div>
                                            <div className="space-y-3">
                                                {[...conversations]
                                                    .filter(c => (c.totalUsage?.totalCost || 0) > 0)
                                                    .sort((a, b) => (b.totalUsage?.totalCost || 0) - (a.totalUsage?.totalCost || 0))
                                                    .slice(0, 10)
                                                    .map((conv, idx) => (
                                                        <div key={conv.id} className="flex items-center justify-between p-5 bg-black/[0.01] dark:bg-white/[0.02] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-2xl border border-black/5 dark:border-white/5 transition-all group">
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-zinc-900 flex items-center justify-center text-xs font-black text-black/20 dark:text-white/20 border border-black/5 dark:border-white/5">
                                                                    {idx + 1}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-black text-black dark:text-white truncate pr-4">{conv.title || "Unknown Session"}</div>
                                                                    <div className="text-[10px] font-bold text-black/30 dark:text-white/30">ID: {conv.id.substring(0, 8)}...</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <div className="text-sm font-black text-blue-500 italic">${(conv.totalUsage?.totalCost || 0).toFixed(4)}</div>
                                                                <div className="text-[9px] font-bold text-black/20 dark:text-white/20 uppercase">Resource Cost</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                {conversations.length === 0 && (
                                                    <div className="py-20 text-center bg-black/[0.01] dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10">
                                                        <Activity className="w-8 h-8 text-black/10 dark:text-white/10 mx-auto mb-4" />
                                                        <p className="text-sm font-bold text-black/20 dark:text-white/20 uppercase tracking-widest">No spectral data detected</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.section>
                                    )}

                                    {activeTab === 'models' && (
                                        <motion.section
                                            key="models"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                                        >
                                            {Object.entries(modelUsage).map(([id, stats]) => (
                                                <div key={id} className="p-8 bg-black/[0.02] dark:bg-white/[0.03] rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col">
                                                    <div className="flex items-center justify-between mb-8">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-lg">
                                                                <Zap className="w-5 h-5 text-white dark:text-black" />
                                                            </div>
                                                            <div className="text-sm font-black text-black dark:text-white uppercase tracking-tight">{id}</div>
                                                        </div>
                                                        <div className="text-xl font-black text-blue-500 italic tracking-tighter">${stats.totalCost.toFixed(4)}</div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-2">
                                                            <span className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Input</span>
                                                            <span className="text-sm font-black text-black dark:text-white">{(stats.promptTokens / 1000).toFixed(2)}k <span className="text-[9px] opacity-30">TKN</span></span>
                                                        </div>
                                                        <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-2">
                                                            <span className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Output</span>
                                                            <span className="text-sm font-black text-black dark:text-white">{(stats.completionTokens / 1000).toFixed(2)}k <span className="text-[9px] opacity-30">TKN</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {Object.keys(modelUsage).length === 0 && (
                                                <div className="col-span-full py-20 text-center bg-black/[0.01] dark:bg-white/[0.02] rounded-[2.5rem] border border-dashed border-black/10 dark:border-white/10">
                                                    <Zap className="w-8 h-8 text-black/10 dark:text-white/10 mx-auto mb-4" />
                                                    <p className="text-sm font-bold text-black/20 dark:text-white/20 uppercase tracking-widest">Awaiting engine performance data</p>
                                                </div>
                                            )}
                                        </motion.section>
                                    )}

                                    {activeTab === 'appearance' && (
                                        <motion.section
                                            key="appearance"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-12"
                                        >
                                            <div className="flex flex-col gap-8">
                                                <div>
                                                    <h4 className="text-xs font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-6">Interface Theme</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <button
                                                            onClick={() => !isDark || onToggleTheme()}
                                                            className={`relative group flex flex-col items-center gap-4 p-8 rounded-[2rem] border transition-all duration-300 ${!isDark
                                                                ? 'bg-black text-white border-black shadow-xl shadow-black/10'
                                                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 text-black/40 dark:text-white/40'
                                                                }`}
                                                        >
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${!isDark ? 'bg-white text-black rotate-0' : 'bg-black/10 text-black/20 rotate-12'}`}>
                                                                <Sun className="w-6 h-6" />
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="font-black text-sm uppercase tracking-widest mb-1">Light Mode</div>
                                                                <div className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Daylight Clarity</div>
                                                            </div>
                                                            {!isDark && (
                                                                <motion.div layoutId="theme-check" className="absolute top-4 right-4 bg-white text-black p-1 rounded-full">
                                                                    <Check className="w-3 h-3" />
                                                                </motion.div>
                                                            )}
                                                        </button>

                                                        <button
                                                            onClick={() => isDark || onToggleTheme()}
                                                            className={`relative group flex flex-col items-center gap-4 p-8 rounded-[2rem] border transition-all duration-300 ${isDark
                                                                ? 'bg-zinc-800 text-white border-white/10 shadow-xl shadow-black/40'
                                                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 text-black/40 dark:text-white/40'
                                                                }`}
                                                        >
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isDark ? 'bg-white text-black rotate-0' : 'bg-black/10 text-black/20 -rotate-12'}`}>
                                                                <Moon className="w-6 h-6" />
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="font-black text-sm uppercase tracking-widest mb-1">Dark Mode</div>
                                                                <div className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Night Focus</div>
                                                            </div>
                                                            {isDark && (
                                                                <motion.div layoutId="theme-check" className="absolute top-4 right-4 bg-white text-black p-1 rounded-full">
                                                                    <Check className="w-3 h-3" />
                                                                </motion.div>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-black text-black/30 dark:text-white/30 uppercase tracking-[0.2em] mb-4">Adaptive Aesthetics</h4>
                                                    <p className="text-[11px] font-bold text-black/40 dark:text-white/40 leading-relaxed max-w-md">
                                                        Kittle automatically synchronizes its interface with your neural preferences. Transitions are mathematically smoothed for maximum optical comfort.
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.section>
                                    )}

                                    {activeTab === 'keys' && (
                                        <motion.section
                                            key="keys"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-6"
                                        >
                                            <div className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-8 flex items-start gap-4">
                                                <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold text-black dark:text-white leading-relaxed">Keys are encrypted and stored locally. Never shared with central servers.</p>
                                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2">End-to-End Governance Active</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {(['google', 'openai', 'anthropic', 'deepseek', 'openrouter'] as const).map(provider => {
                                                    const error = validationErrors[provider];
                                                    const isVerified = verifiedProviders.has(provider);
                                                    return (
                                                        <div key={provider} className="group flex flex-col gap-2">
                                                            <div className="flex items-center justify-between px-1">
                                                                <div className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-[0.2em] flex items-center flex-wrap gap-y-1">
                                                                    <span className="shrink-0">{provider} gateway</span>
                                                                    {config.apiKeysDates?.[provider] ? (
                                                                        <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-500/70 lowercase italic rounded-md tracking-normal font-bold whitespace-nowrap">
                                                                            • added {new Date(config.apiKeysDates[provider]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </span>
                                                                    ) : null}
                                                                    {config.apiKeysFirstUsed?.[provider] ? (
                                                                        <span className="ml-2 px-2 py-0.5 bg-green-500/10 text-green-500/50 lowercase italic rounded-md tracking-normal font-bold whitespace-nowrap">
                                                                            • first used {new Date(config.apiKeysFirstUsed[provider]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <a href={API_LINKS[provider].url} target="_blank" rel="noreferrer" className="text-[9px] font-black text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
                                                                    Provision Key <ExternalLink className="w-2.5 h-2.5" />
                                                                </a>
                                                            </div>
                                                            <div className="relative group/input">
                                                                <input
                                                                    type="password"
                                                                    value={customKeys[provider] || ''}
                                                                    onChange={(e) => setCustomKeys({ ...customKeys, [provider]: e.target.value })}
                                                                    placeholder="Enter cryptographic key..."
                                                                    className={`w-full bg-gray-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-mono text-black dark:text-white placeholder:text-black/10 dark:placeholder:text-white/10 focus:outline-none focus:border-black/20 dark:focus:border-white/20 focus:bg-white dark:focus:bg-zinc-800 transition-all shadow-inner
                                                                    ${error ? 'border-red-500/50 bg-red-500/5' : ''}
                                                                `}
                                                                />
                                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {isVerified && <Check className="w-5 h-5 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
                                                                    {error && <XCircle className="w-5 h-5 text-red-500 animate-pulse" />}
                                                                </div>
                                                            </div>
                                                            {error && <span className="text-[9px] font-black text-red-500 uppercase ml-1 tracking-widest">{error}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.section>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* STICKY FOOTER */}
                        <footer className="shrink-0 px-6 md:px-8 py-5 md:py-8 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl flex flex-col-reverse sm:flex-row items-center gap-4 mt-auto">
                            <button
                                onClick={onClose}
                                className="w-full sm:w-auto px-8 py-4 text-xs font-black text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white uppercase tracking-widest transition-colors"
                            >
                                Release Changes
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isVerifying}
                                className="w-full sm:flex-1 bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {isVerifying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Cryptographic Verification...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Synchronize Preferences</span>
                                    </>
                                )}
                            </button>
                        </footer>
                    </main>
                </motion.div>

                {/* --- CUSTOM CONFIRMATION MODAL --- */}
                <AnimatePresence>
                    {confirmModal?.isOpen && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setConfirmModal(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
                                <div className="mb-6">
                                    <h4 className="text-xl font-black text-black dark:text-white mb-2">{confirmModal.title}</h4>
                                    <p className="text-sm font-semibold text-black/40 dark:text-white/40 leading-relaxed">
                                        {confirmModal.desc}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmModal(null)}
                                        className="flex-1 py-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-xs font-black text-black dark:text-white uppercase tracking-widest transition-all"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirmModal.type === 'usage') onResetUsage();
                                            else onFullReset();
                                            setConfirmModal(null);
                                        }}
                                        className="flex-1 py-4 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-[0_10px_20px_rgba(239,68,68,0.2)]"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </AnimatePresence>
    );
};
