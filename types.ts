
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
  thinking?: string; // New field for AI reasoning
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
  showThinking: boolean; // Controls visibility of the reasoning block
}

export const AVAILABLE_MODELS = {
  google: [
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', hasThinking: true },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', hasThinking: false },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro', hasThinking: false },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Preview)', hasThinking: false },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', hasThinking: false },
    { id: 'o1', name: 'o1 (Reasoning)', hasThinking: true },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', hasThinking: false },
  ],
  deepseek: [
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', hasThinking: true },
    { id: 'deepseek-chat', name: 'DeepSeek V3', hasThinking: false },
  ]
};
