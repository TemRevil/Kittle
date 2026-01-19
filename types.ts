
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

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'deepseek';
export type ThinkingMode = 'deep' | 'concise';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKeys: {
    google: string;
    openai: string;
    anthropic: string;
    deepseek: string;
  };
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
  lastModified: number;
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
  showThinking: boolean;
  currentConversationId: string | null;
  conversations: StoredConversation[];
  keyCapabilities: {
    google?: { discoveredModels: LLMModel[] };
    openai?: { discoveredModels: LLMModel[] };
    anthropic?: { discoveredModels: LLMModel[] };
    deepseek?: { discoveredModels: LLMModel[] };
  };
}

export const AVAILABLE_MODELS: Record<LLMProvider, LLMModel[]> = {
  google: [
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', hasThinking: true, version: 3 },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', hasThinking: true, version: 3 },
    { id: 'gemini-3-deep-think', name: 'Gemini 3 Deep Think', hasThinking: true, version: 3 },
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
  ]
};
