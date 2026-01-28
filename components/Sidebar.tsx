import React, { useState, useEffect, useRef } from 'react';
import { FileContext, FileNode, StoredConversation } from '../types';
import { Trash2, FileCode, FileImage, Github, Plus, Layers, Sun, Moon, Box, ArrowRight, Settings, MessageSquare, Clock, PlusCircle, CheckSquare, Lock, BarChart3 } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { motion } from 'motion/react';

interface SidebarProps {
  files: FileContext[];
  repoTree: FileNode[];
  onRemoveFile: (id: string) => void;
  onAddFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  githubLink: string;
  onGithubLinkChange: (val: string) => void;
  onGithubEnter?: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  className?: string;
  onRepoFileClick: (path: string) => void;
  onSelectAllFiles?: () => void;
  isRepoLocked?: boolean;
  loadingFilePaths?: string[];
  onOpenSettings: () => void;
  conversations: StoredConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  repoTree,
  onRemoveFile,
  onAddFiles,
  githubLink,
  onGithubLinkChange,
  onGithubEnter,
  isDark,
  toggleTheme,
  className,
  onRepoFileClick,
  onSelectAllFiles,
  isRepoLocked,
  loadingFilePaths,
  onOpenSettings,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'explorer' | 'history'>('context');
  const [historySort, setHistorySort] = useState<'time' | 'tokens'>('time');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // If no chats exist, maybe switch to context? But user might want to start one.
    // Defaulting to 'history' is good for navigating back.
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="pt-10 px-8 pb-6 shrink-0 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
            Kittle<span className="text-gray-400">.</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">AI Code Auditor</p>
        </div>

        <button
          onClick={onNewChat}
          className="p-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 transition-all shadow-lg"
          title="New Chat"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
      </motion.div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* GitHub Input Section */}
        <div className="px-8 mb-8 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Repository
            </label>
            {isRepoLocked && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase tracking-tight">
                <Lock className="w-2.5 h-2.5" /> Locked to chat
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative group flex-1">
              <input
                type="text"
                disabled={isRepoLocked}
                value={githubLink}
                onChange={(e) => onGithubLinkChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onGithubEnter) {
                    onGithubEnter();
                  }
                }}
                placeholder="username/repo"
                className={`w-full bg-gray-50 dark:bg-zinc-900 border-none rounded-xl px-4 py-3 text-sm font-medium transition-all placeholder:text-gray-400
                  ${isRepoLocked ? 'opacity-60 cursor-not-allowed italic' : 'focus:ring-1 focus:ring-black dark:focus:ring-white'}
                `}
              />
            </div>
            <button
              onClick={onGithubEnter}
              disabled={isRepoLocked}
              className={`p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl transition-opacity
                ${isRepoLocked ? 'opacity-20 cursor-not-allowed' : 'hover:opacity-80'}
              `}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 mb-6 shrink-0">
          <div className="flex border-b border-gray-100 dark:border-white/10 gap-6">
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'history'
                ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'context'
                ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Files
            </button>
            {repoTree.length > 0 && (
              <button
                onClick={() => setActiveTab('explorer')}
                className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'explorer'
                  ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Repo
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-4">

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                    Recent Chats
                  </label>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.1em]">{conversations.length} total sessions</span>
                </div>

                {/* Ranking Toggle */}
                <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-lg">
                  <button
                    onClick={() => setHistorySort('time')}
                    className={`p-1.5 rounded-md transition-all ${historySort === 'time' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Sort by Recent"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setHistorySort('tokens')}
                    className={`p-1.5 rounded-md transition-all ${historySort === 'tokens' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Sort by Resource Usage"
                  >
                    <BarChart3 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {conversations.length === 0 ? (
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-8 text-center border border-transparent">
                  <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No chat history</p>
                  <p className="text-xs text-gray-300 mt-1">Start a new conversation above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...conversations]
                    .sort((a, b) => {
                      if (historySort === 'tokens') {
                        const totalA = (a.totalUsage?.promptTokens || 0) + (a.totalUsage?.completionTokens || 0);
                        const totalB = (b.totalUsage?.promptTokens || 0) + (b.totalUsage?.completionTokens || 0);
                        return totalB - totalA;
                      }
                      return b.lastModified - a.lastModified;
                    })
                    .map(conv => {
                      const totalTokens = (conv.totalUsage?.promptTokens || 0) + (conv.totalUsage?.completionTokens || 0);
                      const hasUsage = totalTokens > 0;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => onSelectConversation(conv.id)}
                          className={`group cursor-pointer flex items-center justify-between p-3 rounded-xl transition-all border
                              ${currentConversationId === conv.id
                              ? 'bg-black dark:bg-white text-white dark:text-black border-transparent shadow-lg transform scale-[1.02]'
                              : 'bg-white dark:bg-black border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 text-gray-600 dark:text-gray-400'}
                            `}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`text-sm font-bold truncate ${currentConversationId === conv.id ? 'text-white dark:text-black' : 'text-gray-800 dark:text-white'}`}>
                                {conv.title || "New Conversation"}
                              </h4>
                              {hasUsage && (
                                <span className={`shrink-0 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md ${currentConversationId === conv.id
                                  ? 'bg-white/20 dark:bg-black/10 text-white dark:text-black'
                                  : 'bg-blue-500/10 text-blue-500'
                                  }`}>
                                  {(totalTokens / 1000).toFixed(1)}k
                                </span>
                              )}
                            </div>
                            <div className={`flex items-center gap-2 text-[10px] ${currentConversationId === conv.id ? 'text-white/60 dark:text-black/60' : 'text-gray-400'}`}>
                              <Clock className="w-3 h-3" />
                              <span>
                                {(() => {
                                  const d = new Date(conv.lastModified);
                                  const now = new Date();
                                  const diff = now.getTime() - d.getTime();
                                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                                  if (diff < 60000) return 'Just now';
                                  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                                  if (diff < 86400000 && now.getDate() === d.getDate()) {
                                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                  }
                                  if (days === 1) return 'Yesterday';
                                  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
                                  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                })()}
                              </span>
                              <span>•</span>
                              <span>{conv.messages.length} msgs</span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            className={`p-2 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100
                               ${currentConversationId === conv.id
                                ? 'hover:bg-white/20 dark:hover:bg-black/10 text-white/70 dark:text-black/50 hover:text-white dark:hover:text-red-600'
                                : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'}
                             `}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* EXPLORER TAB */}
          {activeTab === 'explorer' && repoTree.length > 0 && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-4 px-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Repository Files
                </label>
                <button
                  onClick={onSelectAllFiles}
                  className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
                >
                  <CheckSquare className="w-3 h-3" /> Select All
                </button>
              </div>
              <FileExplorer
                nodes={repoTree}
                activeFiles={files}
                onFileClick={onRepoFileClick}
                loadingFilePaths={loadingFilePaths}
              />
            </div>
          )}

          {/* FILES TAB */}
          {activeTab === 'context' && (
            <div className="space-y-4 animate-in fade-in duration-300">

              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Context Files
                </label>
                <label className="cursor-pointer flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors" title="Add File">
                  <Plus className="w-3 h-3" /> Add
                  <input type="file" multiple className="hidden" onChange={onAddFiles} />
                </label>
              </div>

              {files.length === 0 ? (
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-8 text-center border border-transparent">
                  <p className="text-sm font-medium text-gray-400">No files active</p>
                  <p className="text-xs text-gray-300 mt-1">Upload files or select from repo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map(file => (
                    <div key={file.id} className="group flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-black flex items-center justify-center shrink-0 border border-gray-100 dark:border-zinc-800">
                          {file.category === 'code' ? (
                            <FileCode className="w-4 h-4 text-black dark:text-white" />
                          ) : (
                            <FileImage className="w-4 h-4 text-black dark:text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveFile(file.id)}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pt-6 pb-24 md:px-8 md:py-8 shrink-0 space-y-2 bg-white dark:bg-black z-10 border-t border-gray-100 dark:border-white/5">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
        >
          <Settings className="w-3.5 h-3.5" />
          Configure API Keys
        </button>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          Switch Theme
        </button>
      </div>
    </div>
  );
};
