
export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

export interface FileContext {
  id: string;
  name: string;
  type: string;
  content: string; // Base64 for images, raw text for code
  category: 'code' | 'image' | 'other';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  thinking?: string; // AI reasoning content
  thinkingTime?: number; // How long it took to think in ms
  responseTime?: number; // Total response time in ms
  timestamp: number;
  relatedFiles?: string[];
  isNew?: boolean; // Used to trigger entrance animations
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string; // Track which model generated this response
  isAborted?: boolean;
}

export interface RepoContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  html_url: string;
  download_url: string | null;
}

export interface RepoDetails {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  owner: {
    avatar_url: string;
    login: string;
  };
  updated_at: string;
  open_issues_count: number;
  topics: string[];
  default_branch: string;
  contents?: RepoContent[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children?: FileNode[];
  isOpen?: boolean;
}

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter';
export type ThinkingMode = 'deep' | 'concise';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKeys: {
    google: string;
    openai: string;
    anthropic: string;
    deepseek: string;
    openrouter: string;
  };
  apiKeysDates?: Record<LLMProvider, number>;
  apiKeysFirstUsed?: Record<LLMProvider, number>;
}

export interface LLMModel {
  id: string;
  name: string;
  hasThinking: boolean;
  version: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: Message[];
  activeFiles: FileContext[];
  githubRepoLink: string;
  repoDetails: RepoDetails | null;
  repoTree: FileNode[];
  lastModified: number;
  totalUsage?: UsageStats;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  activeFiles: FileContext[];
  githubRepoLink: string;
  repoTree: FileNode[];
  repoDetails: RepoDetails | null;
  llmConfig: LLMConfig;
  thinkingMode: ThinkingMode;
  isSearchEnabled: boolean;
  isDesignMode: boolean;
  isFullRepoMode: boolean;
  showThinking: boolean;
  currentConversationId: string | null;
  conversations: StoredConversation[];
  keyCapabilities: {
    google?: { discoveredModels: LLMModel[] };
    openai?: { discoveredModels: LLMModel[] };
    anthropic?: { discoveredModels: LLMModel[] };
    deepseek?: { discoveredModels: LLMModel[] };
    openrouter?: { discoveredModels: LLMModel[] };
  };
  totalUsage: UsageStats;
  modelUsage: Record<string, UsageStats>;
}

export const AVAILABLE_MODELS: Record<LLMProvider, LLMModel[]> = {
  google: [
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro', hasThinking: false, version: 2 },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', hasThinking: false, version: 2 },
    { id: 'gemini-2.0-flash-thinking-exp-1219', name: 'Gemini 2.0 Thinking', hasThinking: true, version: 2 },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', hasThinking: false, version: 1.5 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', hasThinking: false, version: 1.5 },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', hasThinking: false, version: 4 },
    { id: 'o1', name: 'o1 (Reasoning)', hasThinking: true, version: 5 },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', hasThinking: false, version: 3 },
  ],
  deepseek: [
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', hasThinking: true, version: 1 },
    { id: 'deepseek-chat', name: 'DeepSeek V3', hasThinking: false, version: 1 },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OR)', hasThinking: false, version: 3 },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (OR)', hasThinking: false, version: 2 },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (OR)', hasThinking: true, version: 1 },
  ]
};

export interface ModelPricing {
  input: number; // Per 1M tokens
  output: number; // Per 1M tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-2.0-pro-exp': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-exp': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-thinking-exp-1219': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 3.75 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'o1': { input: 15.00, output: 60.00 },
  'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};
