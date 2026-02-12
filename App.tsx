import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { RepoModal } from './components/RepoModal';
import { ModelSelector } from './components/ModelSelector';
import { Gateway } from './components/Gateway';
import { SettingsModal } from './components/SettingsModal';
import { FileContext, ChatState, Message, RepoDetails, LLMConfig, AVAILABLE_MODELS, LLMProvider, MODEL_PRICING, StoredConversation } from './types';
import { readFile } from './utils';
import { streamLLMResponse } from './services/llmFactory';
import { fetchRepoDetails, fetchRepoStructure, fetchGithubFileContent } from './services/githubService';
import { verifyKey } from './services/keyVerification';
import { Paperclip, Menu, X, XCircle, ArrowUp, Loader2, Globe, Layers, Zap, Eye, EyeOff, ChevronDown, Check, BrainCircuit, CheckSquare, Box, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    activeFiles: [],
    githubRepoLink: '',
    repoTree: [],
    repoDetails: null,
    thinkingMode: 'concise',
    isSearchEnabled: false,
    isDesignMode: false,
    isFullRepoMode: false,
    showThinking: false,
    currentConversationId: null,
    conversations: [],
    keyCapabilities: {
      google: { discoveredModels: [] }
    },
    llmConfig: {
      provider: 'google',
      model: 'gemini-2.0-flash-exp',
      apiKeys: {
        google: process.env.NEXT_PUBLIC_API_KEY || '',
        openai: '',
        anthropic: '',
        deepseek: '',
        openrouter: ''
      },
      apiKeysDates: {
        google: Date.now(),
        openai: 0,
        anthropic: 0,
        deepseek: 0,
        openrouter: 0
      },
      apiKeysFirstUsed: {
        google: 0,
        openai: 0,
        anthropic: 0,
        deepseek: 0,
        openrouter: 0
      }
    },
    totalUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0
    },
    modelUsage: {}
  });

  const [input, setInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [loadingFilePaths, setLoadingFilePaths] = useState<string[]>([]);
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quotaError, setQuotaError] = useState<{ type: 'quota' | 'model'; message: string; model: string; originalPrompt: string; userMessageId: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modal State
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isRepoLoading, setIsRepoLoading] = useState(false);

  // --- DERIVED STATE FOR THINKING CAPABILITY ---
  // 1. Get current model definition (check both hardcoded and discovered models)
  const currentModelDef = AVAILABLE_MODELS[state.llmConfig.provider]?.find(m => m.id === state.llmConfig.model);
  const discoveredModelDef = state.keyCapabilities?.[state.llmConfig.provider]?.discoveredModels?.find((m: any) => m.id === state.llmConfig.model);

  // 2. Check if it explicitly supports thinking (from types.ts, discovered, or string match)
  const supportsThinking = !!(
    currentModelDef?.hasThinking ||
    discoveredModelDef?.hasThinking ||
    state.llmConfig.model.includes('gemini-2.5') ||
    state.llmConfig.model.includes('gemini-3') ||
    state.llmConfig.model.includes('thinking') ||
    state.llmConfig.model.includes('reasoner') ||
    state.llmConfig.model.includes('think') ||
    state.llmConfig.model.includes('deep') ||
    state.llmConfig.model.includes('o1')
  );

  // 2.5 Check if model supports visual diagram generation
  const capableVisualModels = ['gemini', 'gpt-4', 'claude-3', 'sonnet', 'opus', 'o1', 'deepseek', 'f1'];
  const supportsVisuals = capableVisualModels.some(m => state.llmConfig.model.toLowerCase().includes(m));

  // 3. "Free Version" check (using default google env key)
  const isFreeVersion = state.llmConfig.provider === 'google' && state.llmConfig.apiKeys.google === process.env.NEXT_PUBLIC_API_KEY;

  // Initialization Logic
  // Initialization Logic
  useEffect(() => {
    const initApp = async () => {
      const setupComplete = localStorage.getItem('app_setup_complete');
      const savedKeysStr = localStorage.getItem('llm_api_keys');
      const savedConversations = localStorage.getItem('chat_history');
      const savedUsage = localStorage.getItem('total_usage');
      const savedModelUsage = localStorage.getItem('model_usage');
      const savedCurrentId = localStorage.getItem('current_conv_id');
      const savedConfig = localStorage.getItem('llm_config');

      let currentKeys = { ...state.llmConfig.apiKeys };

      // 1. Initial State Load (Usage & History) - ALWAYS run this
      if (savedUsage) {
        try {
          const parsed = JSON.parse(savedUsage);
          setState(prev => ({ ...prev, totalUsage: parsed }));
        } catch (e) { }
      }

      if (savedModelUsage) {
        try {
          const parsed = JSON.parse(savedModelUsage);
          setState(prev => ({ ...prev, modelUsage: parsed }));
        } catch (e) { }
      }

      if (savedConversations) {
        try {
          const parsed = JSON.parse(savedConversations);
          const lastConv = savedCurrentId ? parsed.find((c: any) => c.id === savedCurrentId) : null;

          setState(prev => ({
            ...prev,
            conversations: parsed,
            currentConversationId: savedCurrentId || prev.currentConversationId,
            messages: lastConv ? lastConv.messages : prev.messages,
            activeFiles: lastConv ? lastConv.activeFiles : prev.activeFiles,
            githubRepoLink: lastConv ? lastConv.githubRepoLink : prev.githubRepoLink,
            repoDetails: lastConv ? lastConv.repoDetails : prev.repoDetails,
            repoTree: (lastConv && lastConv.repoTree) ? lastConv.repoTree : prev.repoTree
          }));
        } catch (e) {
          console.error("Failed to parse conversations");
        }
      }

      // 2. Try to load saved keys/config
      if (savedKeysStr) {
        try {
          const parsedKeys = JSON.parse(savedKeysStr);
          currentKeys = { ...currentKeys, ...parsedKeys };

          let nextConfig = { ...state.llmConfig, apiKeys: currentKeys };

          const savedDatesStr = localStorage.getItem('llm_api_keys_dates');
          if (savedDatesStr) {
            try {
              nextConfig.apiKeysDates = JSON.parse(savedDatesStr);
            } catch (e) { }
          }

          const savedFirstUsedStr = localStorage.getItem('llm_api_keys_first_used');
          if (savedFirstUsedStr) {
            try {
              nextConfig.apiKeysFirstUsed = JSON.parse(savedFirstUsedStr);
            } catch (e) { }
          }

          if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            nextConfig = { ...nextConfig, ...parsedConfig };
          }

          setState(prev => ({
            ...prev,
            llmConfig: nextConfig
          }));
        } catch (e) {
          console.error("Failed to parse saved keys/config");
        }
      }

      // 3. Authorization Check
      if (setupComplete) {
        const providers: LLMProvider[] = ['google', 'openai', 'anthropic', 'deepseek', 'openrouter'];
        let allProvidedKeysValid = true;
        let atLeastOneKey = false;

        for (const provider of providers) {
          const key = currentKeys[provider];
          if (key && key.trim().length > 0) {
            atLeastOneKey = true;
            if (key.length > 20) {
              const result = await verifyKey(provider, key);
              if (!result.isValid) allProvidedKeysValid = false;
            } else {
              allProvidedKeysValid = false;
            }
          }
        }

        const onlyHasDefaultKey = currentKeys.google === process.env.NEXT_PUBLIC_API_KEY &&
          !currentKeys.openai && !currentKeys.anthropic && !currentKeys.deepseek && !currentKeys.openrouter;

        if (atLeastOneKey && allProvidedKeysValid && !onlyHasDefaultKey) {
          setIsOnboarding(false);
        } else {
          console.warn("Invalid, missing, or default keys detected on startup, forcing onboarding.");
          setIsOnboarding(true);
        }
      } else {
        setIsOnboarding(true);
      }

      setIsInitializing(false);
    };

    initApp();
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(state.conversations));
    localStorage.setItem('total_usage', JSON.stringify(state.totalUsage));
    localStorage.setItem('model_usage', JSON.stringify(state.modelUsage));
    if (state.currentConversationId) {
      localStorage.setItem('current_conv_id', state.currentConversationId);
    }
  }, [state.conversations, state.totalUsage, state.modelUsage, state.currentConversationId]);

  // Sync current state to currentConversationId in memory
  useEffect(() => {
    if (!state.currentConversationId || state.isLoading) return;

    setState(prev => {
      const existing = prev.conversations.find(c => c.id === prev.currentConversationId);
      if (!existing) return prev;

      // Update the stored conversation with latest state
      const updatedConversations = prev.conversations.map(c => {
        if (c.id === prev.currentConversationId) {
          return {
            ...c,
            messages: prev.messages,
            activeFiles: prev.activeFiles,
            githubRepoLink: prev.githubRepoLink,
            repoDetails: prev.repoDetails,
            repoTree: prev.repoTree,
            lastModified: Date.now()
          };
        }
        return c;
      });

      // Avoid infinite loop by only updating if something actually changed
      if (JSON.stringify(existing.messages) === JSON.stringify(prev.messages) &&
        existing.activeFiles.length === prev.activeFiles.length) {
        return prev;
      }

      return { ...prev, conversations: updatedConversations };
    });
  }, [state.messages, state.activeFiles, state.githubRepoLink, state.repoDetails, state.currentConversationId, state.isLoading]);

  const handleNewChat = () => {
    setState(prev => ({
      ...prev,
      messages: [],
      activeFiles: [],
      githubRepoLink: '',
      repoTree: [],
      repoDetails: null,
      currentConversationId: null
    }));
  };

  const selectConversation = (id: string) => {
    const conv = state.conversations.find(c => c.id === id);
    if (conv) {
      setState(prev => ({
        ...prev,
        messages: conv.messages,
        activeFiles: conv.activeFiles,
        githubRepoLink: conv.githubRepoLink,
        repoDetails: conv.repoDetails,
        repoTree: conv.repoTree || [],
        currentConversationId: conv.id
      }));
    }
    setIsMobileMenuOpen(false);
  };

  const deleteConversation = (id: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.filter(c => c.id !== id),
      currentConversationId: prev.currentConversationId === id ? null : prev.currentConversationId,
      messages: prev.currentConversationId === id ? [] : prev.messages,
      activeFiles: prev.currentConversationId === id ? [] : prev.activeFiles,
      repoDetails: prev.currentConversationId === id ? null : prev.repoDetails,
      githubRepoLink: prev.currentConversationId === id ? '' : prev.githubRepoLink,
      repoTree: prev.currentConversationId === id ? [] : prev.repoTree
    }));
  };

  // No migration needed for now
  useEffect(() => {
  }, [state.llmConfig.model]);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // Key Verification Logic
  useEffect(() => {
    const verifyKeys = async () => {
      const providers: LLMProvider[] = ['google', 'openai', 'anthropic', 'deepseek', 'openrouter'];

      for (const provider of providers) {
        const key = state.llmConfig.apiKeys[provider];

        // If key is removed or too short, clear capabilities
        if (!key || key.length <= 20) {
          setState(prev => {
            // Only update if it actually exists to avoid render loops
            if (!prev.keyCapabilities?.[provider]?.discoveredModels?.length) return prev;

            return {
              ...prev,
              keyCapabilities: {
                ...prev.keyCapabilities,
                [provider]: { discoveredModels: [] }
              }
            };
          });
          continue;
        }

        // Verify existing key
        const support = await verifyKey(provider, key);

        if (support.isValid && support.discoveredModels) {
          setState(prev => ({
            ...prev,
            keyCapabilities: {
              ...prev.keyCapabilities,
              [provider]: { discoveredModels: support.discoveredModels || [] }
            }
          }));
        } else {
          // Verification failed - clear models
          setState(prev => ({
            ...prev,
            keyCapabilities: {
              ...prev.keyCapabilities,
              [provider]: { discoveredModels: [] }
            }
          }));
        }
      }
    };
    verifyKeys();
  }, [
    state.llmConfig.apiKeys.google,
    state.llmConfig.apiKeys.openai,
    state.llmConfig.apiKeys.anthropic,
    state.llmConfig.apiKeys.deepseek
  ]);

  const handleConfigChange = (newConfig: LLMConfig) => {
    // Determine which keys are newly added/changed to record their date
    const updatedDates = { ...(state.llmConfig.apiKeysDates || {}) } as Record<LLMProvider, number>;
    const providers: LLMProvider[] = ['google', 'openai', 'anthropic', 'deepseek', 'openrouter'];

    providers.forEach(p => {
      // If the key is new/changed and it's not empty, set the date
      if (newConfig.apiKeys[p] && newConfig.apiKeys[p] !== state.llmConfig.apiKeys[p]) {
        updatedDates[p] = Date.now();
      }
    });

    const finalConfig = { ...newConfig, apiKeysDates: updatedDates };
    setState(prev => ({ ...prev, llmConfig: finalConfig }));
    localStorage.setItem('llm_api_keys', JSON.stringify(finalConfig.apiKeys));
    localStorage.setItem('llm_api_keys_dates', JSON.stringify(finalConfig.apiKeysDates));
    localStorage.setItem('llm_config', JSON.stringify({ provider: finalConfig.provider, model: finalConfig.model }));
  };

  const handleResetUsage = () => {
    setState(prev => ({
      ...prev,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalCost: 0 },
      modelUsage: {}
    }));
    localStorage.removeItem('total_usage');
    localStorage.removeItem('model_usage');
  };

  const handleFullReset = () => {
    if (confirm("This will delete ALL data (history, keys, settings) and reset Kittle. Are you sure?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleGatewayComplete = (config: LLMConfig) => {
    setState(prev => ({ ...prev, llmConfig: config }));
    localStorage.setItem('llm_api_keys', JSON.stringify(config.apiKeys));
    localStorage.setItem('llm_config', JSON.stringify({ provider: config.provider, model: config.model }));
    localStorage.setItem('app_setup_complete', 'true');
    setIsOnboarding(false);
  };

  const stopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => {
      const nextMessages = [...prev.messages];
      if (nextMessages.length > 0) {
        const lastIndex = nextMessages.length - 1;
        const lastMsg = nextMessages[lastIndex];
        if (lastMsg.role === 'model' && !lastMsg.responseTime) {
          nextMessages[lastIndex] = {
            ...lastMsg,
            isAborted: true,
            responseTime: Date.now() - lastMsg.timestamp
          };
        }
      }

      // Also sync current conversation in history
      const nextConversations = prev.conversations.map(c =>
        c.id === prev.currentConversationId ? { ...c, messages: nextMessages, lastModified: Date.now() } : c
      );

      return {
        ...prev,
        messages: nextMessages,
        conversations: nextConversations,
        isLoading: false
      };
    });
  };

  const sendMessage = async (text: string, configOverride?: LLMConfig) => {
    const activeConfig = configOverride || state.llmConfig;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
      relatedFiles: state.activeFiles.map(f => f.name)
    };

    const botMessageId = (Date.now() + 1).toString();
    const initialBotMessage: Message = {
      id: botMessageId,
      role: 'model',
      text: '',
      thinking: '',
      timestamp: Date.now(),
      isNew: true,
      model: activeConfig.model
    };

    let newConvId = state.currentConversationId || Date.now().toString();
    const isNewConversation = !state.currentConversationId;

    setState(prev => {
      const existingConv = prev.conversations.find(c => c.id === newConvId);
      let nextConversations = [...prev.conversations];

      if (isNewConversation) {
        // Create new conversation
        const newConv: StoredConversation = {
          id: newConvId,
          title: text.length > 30 ? text.substring(0, 30) + '...' : text,
          messages: [userMessage, initialBotMessage],
          activeFiles: prev.activeFiles,
          githubRepoLink: prev.githubRepoLink,
          repoDetails: prev.repoDetails,
          repoTree: prev.repoTree,
          lastModified: Date.now(),
          totalUsage: { promptTokens: 0, completionTokens: 0, totalCost: 0 }
        };
        nextConversations = [newConv, ...nextConversations];
      } else {
        // Update existing conversation
        nextConversations = nextConversations.map(c => {
          if (c.id === newConvId) {
            const existingPaths = new Set(c.activeFiles.map(f => f.name));
            const newFilesToRecord = prev.activeFiles.filter(f => !existingPaths.has(f.name));
            return {
              ...c,
              activeFiles: [...c.activeFiles, ...newFilesToRecord],
              messages: [...prev.messages, userMessage, initialBotMessage],
              lastModified: Date.now()
            };
          }
          return c;
        });
      }

      return {
        ...prev,
        messages: [...prev.messages.map(m => ({ ...m, isNew: false })), userMessage, initialBotMessage],
        isLoading: true,
        currentConversationId: newConvId,
        activeFiles: [],
        conversations: nextConversations
      };
    });
    setInput('');

    // Initialize AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const stream = streamLLMResponse(
        activeConfig,
        userMessage.text,
        state.messages,
        state.activeFiles,
        state.githubRepoLink,
        state.thinkingMode,
        state.isSearchEnabled,
        state.isDesignMode,
        state.isFullRepoMode,
        state.repoTree,
        state.conversations.find(c => c.id === newConvId)?.activeFiles || state.activeFiles,
        controller.signal
      );

      const responseStartTime = Date.now();
      let thinkingStartTime = Date.now();
      let hasFinishedThinking = false;

      for await (const chunk of stream) {
        // IMMEDIATE STOP CHECK: If user stopped or signal aborted, break the loop and cease all UI updates
        if (controller.signal.aborted || !abortControllerRef.current) {
          console.log("[App] Loop termination requested via AbortSignal.");
          break;
        }

        if (chunk.error && (chunk.error.type === 'quota' || chunk.error.type === 'model')) {
          setQuotaError({
            type: chunk.error.type,
            message: chunk.error.message,
            model: state.llmConfig.model,
            originalPrompt: text,
            userMessageId: userMessage.id
          });
          // Remove the dummy bot message if it's empty or just the error
          setState(prev => ({
            ...prev,
            messages: prev.messages.filter(m => m.id !== botMessageId),
            isLoading: false
          }));
          return;
        }

        setState(prev => {
          const newMessages = [...prev.messages];
          const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
          if (msgIndex === -1) return prev;

          const updatedMsg = { ...newMessages[msgIndex] };

          if (chunk.thinkingDelta) {
            updatedMsg.thinking = (updatedMsg.thinking || "") + chunk.thinkingDelta;
          }

          if (chunk.textDelta) {
            if (!hasFinishedThinking && updatedMsg.thinking) {
              updatedMsg.thinkingTime = Date.now() - thinkingStartTime;
              hasFinishedThinking = true;
            }
            updatedMsg.text += chunk.textDelta;
          }

          newMessages[msgIndex] = updatedMsg;

          // Keep conversations in sync for immediate persistence
          const updatedConversations = prev.conversations.map(c =>
            c.id === newConvId ? { ...c, messages: newMessages, lastModified: Date.now() } : c
          );

          return {
            ...prev,
            messages: newMessages,
            conversations: updatedConversations
          };
        });

        if (chunk.usage) {
          const { promptTokens, completionTokens } = chunk.usage;

          setState(prev => {
            const pricing = MODEL_PRICING[prev.llmConfig.model] || { input: 0, output: 0 };
            const cost = ((promptTokens / 1000000) * pricing.input) + ((completionTokens / 1000000) * pricing.output);
            const modelKey = prev.llmConfig.model;
            const currentModelStats = prev.modelUsage[modelKey] || { promptTokens: 0, completionTokens: 0, totalCost: 0 };

            // Update first used date if not set
            const provider = prev.llmConfig.provider;
            const updatedFirstUsed = { ...(prev.llmConfig.apiKeysFirstUsed || {}) } as Record<LLMProvider, number>;
            if (!updatedFirstUsed[provider]) {
              updatedFirstUsed[provider] = Date.now();
              localStorage.setItem('llm_api_keys_first_used', JSON.stringify(updatedFirstUsed));
            }

            const updatedModelUsage = {
              ...prev.modelUsage,
              [modelKey]: {
                promptTokens: currentModelStats.promptTokens + promptTokens,
                completionTokens: currentModelStats.completionTokens + completionTokens,
                totalCost: currentModelStats.totalCost + cost
              }
            };

            const updatedConversations = prev.conversations.map(c => {
              if (c.id === newConvId) {
                const convUsage = c.totalUsage || { promptTokens: 0, completionTokens: 0, totalCost: 0 };
                return {
                  ...c,
                  totalUsage: {
                    promptTokens: convUsage.promptTokens + promptTokens,
                    completionTokens: convUsage.completionTokens + completionTokens,
                    totalCost: convUsage.totalCost + cost
                  }
                };
              }
              return c;
            });

            return {
              ...prev,
              llmConfig: {
                ...prev.llmConfig,
                apiKeysFirstUsed: updatedFirstUsed
              },
              messages: prev.messages.map(m =>
                m.id === botMessageId ? { ...m, usage: chunk.usage } : m
              ),
              totalUsage: {
                promptTokens: prev.totalUsage.promptTokens + promptTokens,
                completionTokens: prev.totalUsage.completionTokens + completionTokens,
                totalCost: prev.totalUsage.totalCost + cost
              },
              modelUsage: updatedModelUsage,
              conversations: updatedConversations
            };
          });
        }
      }

      setState(prev => {
        const newMessages = [...prev.messages];
        const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
        if (msgIndex !== -1) {
          newMessages[msgIndex] = {
            ...newMessages[msgIndex],
            responseTime: Date.now() - responseStartTime
          };
        }
        return { ...prev, messages: newMessages };
      });
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

    if (loadingFilePaths.includes(path)) return;
    setLoadingFilePaths(prev => [...prev, path]);

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
      setLoadingFilePaths(prev => prev.filter(p => p !== path));
    }
  };

  const handleSelectAllFiles = async () => {
    if (!state.repoDetails || !state.repoTree || state.repoTree.length === 0) return;

    setIsRepoLoading(true);
    const paths: string[] = [];

    const walk = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node.type === 'blob') paths.push(node.path);
        if (node.children) walk(node.children);
      });
    };
    walk(state.repoTree);

    // Filter out both already active files AND files currently loading
    const filteredPaths = paths.filter(p =>
      !state.activeFiles.some(f => f.name === p) &&
      !loadingFilePaths.includes(p)
    ).slice(0, 40);

    if (filteredPaths.length === 0) {
      setIsRepoLoading(false);
      return;
    }

    setLoadingFilePaths(prev => [...prev, ...filteredPaths]);

    try {
      const promises = filteredPaths.map(path =>
        fetchGithubFileContent(
          state.repoDetails!.owner.login,
          state.repoDetails!.name,
          state.repoDetails!.default_branch,
          path
        )
      );

      const newFiles = await Promise.all(promises);
      setState(prev => ({
        ...prev,
        activeFiles: [...prev.activeFiles, ...newFiles]
      }));
    } catch (err) {
      console.error("Select all failed", err);
    } finally {
      setIsRepoLoading(false);
      setLoadingFilePaths(prev => prev.filter(p => !filteredPaths.includes(p)));
    }
  };

  const handleResetConfig = () => {
    setIsOnboarding(true);
  };

  // Handle settings shortcut from ModelSelector
  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-white" />;

  return (
    <div className="flex h-[100dvh] w-full bg-paper text-ink overflow-hidden font-sans transition-colors duration-300">

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-amber-500/20 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[15%] w-[20%] h-[20%] bg-purple-500/10 rounded-full blur-[80px]" />
      </div>

      <AnimatePresence mode="wait">
        {isInitializing && (
          <motion.div
            key="init-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white dark:bg-black flex items-center justify-center flex-col gap-4"
          >
            <Loader2 className="w-8 h-8 animate-spin text-black dark:text-white" />
            <p className="text-sm font-medium text-gray-500">Verifying keys...</p>
          </motion.div>
        )}

        {!isInitializing && isOnboarding && (
          <Gateway
            initialConfig={state.llmConfig}
            onComplete={handleGatewayComplete}
          />
        )}
      </AnimatePresence>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={state.llmConfig}
        onConfigChange={handleConfigChange}
        totalUsage={state.totalUsage}
        modelUsage={state.modelUsage}
        conversations={state.conversations}
        onResetUsage={handleResetUsage}
        onFullReset={handleFullReset}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Quota Error Overlay */}
      <AnimatePresence>
        {quotaError && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setQuotaError(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col"
            >
              <div className="p-8 md:p-10 text-center flex-1 overflow-y-auto custom-scrollbar">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${quotaError.type === 'quota' ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-red-100 dark:bg-red-500/10'}`}>
                  {quotaError.type === 'quota' ? (
                    <Box className="w-10 h-10 text-amber-600 dark:text-amber-500" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-600 dark:text-red-500" />
                  )}
                </div>
                <h3 className="text-2xl font-black font-display text-black dark:text-white mb-3">
                  {quotaError.type === 'quota' ? 'API Quota Reached' : 'Model Unavailable'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed mb-8">
                  {quotaError.type === 'quota' ? (
                    <>
                      The model <span className="font-bold text-black dark:text-white underline decoration-amber-500/40">{quotaError.model}</span> has temporarily reached its rate limit.
                    </>
                  ) : (
                    <>
                      The model <span className="font-bold text-black dark:text-white underline decoration-red-500/40">{quotaError.model}</span> is currently unavailable for your API key.
                    </>
                  )}
                  Switch to a different model to continue immediately.
                </p>

                <div className="flex flex-col gap-6 text-left">
                  {/* Models List */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {state.llmConfig.provider}
                      </span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-bold tracking-tighter animate-pulse">
                        LIVE
                      </span>
                      <div className="h-px flex-1 bg-gray-100 dark:bg-white/5"></div>
                    </div>

                    <div className="space-y-1">
                      {(() => {
                        const provider = state.llmConfig.provider;
                        const hardcodedModels = AVAILABLE_MODELS[provider] || [];
                        const discoveredModels = state.keyCapabilities?.[provider]?.discoveredModels || [];
                        const isLive = discoveredModels.length > 0;

                        let finalModels = hardcodedModels;
                        if (provider === 'google' && isLive) {
                          finalModels = discoveredModels;
                        } else if (isLive) {
                          const discoveredIds = new Set(discoveredModels.map((m: any) => m.id));
                          finalModels = [...discoveredModels, ...hardcodedModels.filter((m: any) => !discoveredIds.has(m.id))];
                        }

                        // Sort: thinking models first, then alphabetically
                        const sortedModels = [...finalModels].sort((a, b) => {
                          if (a.hasThinking && !b.hasThinking) return -1;
                          if (!a.hasThinking && b.hasThinking) return 1;
                          return a.name.localeCompare(b.name);
                        });

                        return sortedModels
                          .filter(m => m.id !== quotaError.model)
                          .map(altModel => (
                            <button
                              key={altModel.id}
                              onClick={() => {
                                const newConfig = { ...state.llmConfig, model: altModel.id };

                                // Remove old message to avoid duplicates
                                setState(prev => ({
                                  ...prev,
                                  llmConfig: newConfig,
                                  messages: prev.messages.filter(m => m.id !== quotaError.userMessageId)
                                }));

                                localStorage.setItem('llm_config', JSON.stringify(newConfig));
                                setQuotaError(null);
                                // Auto resend with the NEW config to avoid stale closure issues
                                sendMessage(quotaError.originalPrompt, newConfig);
                              }}
                              className="w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all group text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                            >
                              <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className="font-medium text-left truncate">{altModel.name}</span>
                                  {altModel.hasThinking && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wide shrink-0 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                      <Zap className="w-2.5 h-2.5" />
                                      Deep
                                    </span>
                                  )}
                                </div>
                                {altModel.hasThinking && (
                                  <span className="text-[9px] text-left text-gray-400">Reasoning available</span>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all font-bold" />
                              </div>
                            </button>
                          ));
                      })()}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                    <button
                      onClick={() => {
                        const funnyMessages = [
                          "Response aborted. My brain cells have reached their union-mandated break limit. ☕",
                          "System Error: The hamster powering my servers has stopped for a snack. Come back when he's finished his carrot. 🐹🥕",
                          "Quota reached. I'm legally obligated to stop thinking until you feed the meter. 🪙",
                          "Transmission terminated. My digital aura is currently being cleansed of excess tokens. ✨",
                          "I've hit the limit! Even AI needs a 'do nothing' day. Aborting response... 🧘‍♂️"
                        ];
                        const sillyText = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

                        setQuotaError(null);

                        const abortMessage: Message = {
                          id: Date.now().toString(),
                          role: 'model',
                          text: `*${sillyText}*`,
                          timestamp: Date.now(),
                          responseTime: 1 // Stop the timer
                        };

                        setState(prev => {
                          const newMessages = [...prev.messages, abortMessage];
                          const updatedConversations = prev.conversations.map(c =>
                            c.id === prev.currentConversationId ? { ...c, messages: newMessages, lastModified: Date.now() } : c
                          );
                          return {
                            ...prev,
                            messages: newMessages,
                            conversations: updatedConversations
                          };
                        });
                      }}
                      className="w-full py-4 text-gray-400 dark:text-zinc-600 font-bold text-xs hover:text-red-500 dark:hover:text-red-400 transition-all uppercase tracking-[0.2em]"
                    >
                      Abort Task
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RepoModal
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        repo={state.repoDetails}
        isLoading={isRepoLoading}
        onAttachRepo={handleAttachRepoFiles}
      />

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-[340px] flex-col border-r border-gray-100 dark:border-white/10 bg-white dark:bg-black h-full overflow-hidden">
        <Sidebar
          files={state.activeFiles}
          repoTree={state.repoTree}
          onRemoveFile={removeFile}
          onAddFiles={handleFileChange}
          githubLink={state.githubRepoLink}
          onGithubLinkChange={(val) => setState(prev => ({ ...prev, githubRepoLink: val }))}
          onGithubEnter={handleGithubEnter}
          isDark={isDark}
          toggleTheme={toggleTheme}
          onRepoFileClick={handleRepoFileClick}
          onSelectAllFiles={handleSelectAllFiles}
          loadingFilePaths={loadingFilePaths}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isRepoLocked={!!state.repoDetails}
          // History Props
          conversations={state.conversations}
          currentConversationId={state.currentConversationId}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          onNewChat={handleNewChat}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-black">

        {/* Minimal Header */}
        <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0 relative z-30">
          <div className="flex items-center gap-4">
            <button onClick={toggleMobileMenu} className="md:hidden text-black dark:text-white p-2 -ml-2">
              <Menu className="w-6 h-6" />
            </button>

            <div className="md:hidden flex items-center gap-2">
              <span className="font-display font-bold text-xl tracking-tight">Kittle</span>
            </div>

            {/* Desktop Model Selector */}
            <div className="hidden md:block">
              <ModelSelector
                config={state.llmConfig}
                onConfigChange={handleConfigChange}
                capabilities={state.keyCapabilities}
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
            isDesignMode={state.isDesignMode}
          />

          {/* Input Area */}
          {/* Input Area */}
          {/* Input Area */}
          <div className="p-4 md:px-12 md:pb-8 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black z-20">
            <div className="max-w-4xl mx-auto">
              <div className="group relative flex flex-col bg-white dark:bg-zinc-900 shadow-2xl shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 transition-all rounded-[24px]">

                {/* Textarea Area */}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Ask ${state.llmConfig.model.split('/').pop()}...`}
                  className="w-full bg-transparent text-black dark:text-white p-5 pb-2 min-h-[60px] max-h-[200px] resize-none focus:outline-none text-[16px] leading-relaxed custom-scrollbar placeholder:text-gray-400 dark:placeholder:text-gray-600 font-medium z-10"
                  rows={1}
                  style={{ minHeight: '60px' }}
                />

                {/* Attached Files (Moved Here) */}
                <AnimatePresence>
                  {state.activeFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 pb-3 flex gap-2 overflow-x-auto custom-scrollbar"
                    >
                      {state.activeFiles.map(f => (
                        <div key={f.id} className="group/file flex items-center gap-2 pl-2 pr-1 py-1 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg">
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 max-w-[100px] truncate">{f.name}</span>
                          <button
                            onClick={() => removeFile(f.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Modern Toolbar Footer */}
                <div className="flex items-center justify-between px-3 py-2">

                  {/* Left Actions */}
                  <div className="flex items-center gap-1">
                    <label className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-black dark:hover:text-white cursor-pointer transition-all active:scale-95">
                      <Paperclip className="w-5 h-5" />
                      <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>

                    <button
                      onClick={toggleSearch}
                      className={`p-2 rounded-xl transition-all active:scale-95 ${state.isSearchEnabled
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-black dark:hover:text-white'
                        }`}
                      title="Web Search"
                    >
                      <Globe className="w-5 h-5" />
                    </button>

                    {state.repoDetails && (
                      <button
                        onClick={handleSelectAllFiles}
                        className="p-2 rounded-xl transition-all active:scale-95 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-black dark:hover:text-white"
                        title="Attach All Repository Files"
                      >
                        <CheckSquare className="w-5 h-5" />
                      </button>
                    )}

                    {supportsVisuals && (
                      <button
                        onClick={() => setState(prev => ({ ...prev, isDesignMode: !prev.isDesignMode }))}
                        className={`p-2 rounded-xl transition-all active:scale-95 ${state.isDesignMode
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-black dark:hover:text-white'
                          }`}
                        title="Design Mode"
                      >
                        <Layers className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-3">
                    {supportsThinking && (
                      <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setState(prev => ({ ...prev, thinkingMode: 'concise' }))}
                            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg transition-all active:scale-95 ${state.thinkingMode === 'concise'
                              ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm ring-1 ring-black/5'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                            title="Fast Response"
                          >
                            <Zap className={`w-3.5 h-3.5 ${state.thinkingMode === 'concise' ? 'text-amber-500 fill-amber-500' : ''}`} />
                            <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider">Fast</span>
                          </button>

                          <button
                            onClick={() => setState(prev => ({ ...prev, thinkingMode: 'deep' }))}
                            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg transition-all active:scale-95 ${state.thinkingMode === 'deep'
                              ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm ring-1 ring-black/5'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                            title="Deep Thinking"
                          >
                            <BrainCircuit className={`w-3.5 h-3.5 ${state.thinkingMode === 'deep' ? 'text-blue-500 fill-blue-500/20' : ''}`} />
                            <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider">Deep</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={state.isLoading ? stopResponse : handleSendMessage}
                      disabled={!state.isLoading && (!input.trim() && state.activeFiles.length === 0)}
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-sm
                        ${!state.isLoading && (!input.trim() && state.activeFiles.length === 0)
                          ? 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : state.isLoading
                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                            : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 shadow-md'}
                      `}
                    >
                      {state.isLoading ? (
                        <div className="w-3 h-3 bg-white rounded-sm animate-pulse" />
                      ) : (
                        <ArrowUp className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={toggleMobileMenu}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-4/5 max-w-[320px] bg-white dark:bg-black h-full shadow-2xl md:hidden border-r border-gray-100 dark:border-white/10"
            >
              <button onClick={toggleMobileMenu} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors z-[60]">
                <X className="w-6 h-6 pointer-events-none" />
              </button>

              {/* Mobile Model Selector */}
              <div className="px-8 pt-6 pb-2">
                <ModelSelector
                  config={state.llmConfig}
                  onConfigChange={handleConfigChange}
                  capabilities={state.keyCapabilities}
                />
              </div>

              <Sidebar
                className="h-full border-none"
                files={state.activeFiles}
                repoTree={state.repoTree}
                onRemoveFile={removeFile}
                onAddFiles={handleFileChange}
                githubLink={state.githubRepoLink}
                onGithubLinkChange={(val) => setState(prev => ({ ...prev, githubRepoLink: val }))}
                onGithubEnter={() => { handleGithubEnter(); toggleMobileMenu(); }}
                isDark={isDark}
                toggleTheme={toggleTheme}
                onRepoFileClick={(path) => { handleRepoFileClick(path); toggleMobileMenu(); }}
                onSelectAllFiles={handleSelectAllFiles}
                loadingFilePaths={loadingFilePaths}
                onOpenSettings={() => { setIsSettingsOpen(true); toggleMobileMenu(); }}
                // History Props
                conversations={state.conversations}
                currentConversationId={state.currentConversationId}
                onSelectConversation={selectConversation}
                onDeleteConversation={deleteConversation}
                onNewChat={handleNewChat}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;