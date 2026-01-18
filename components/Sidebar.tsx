import React, { useState, useEffect, useRef } from 'react';
import { FileContext, FileNode } from '../types';
import { Trash2, FileCode, FileImage, Github, Plus, Layers, Sun, Moon, Box, ArrowRight, Settings } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import anime from 'animejs';

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
  isLoadingFile?: string | null;
  onResetConfig: () => void;
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
  isLoadingFile,
  onResetConfig
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'explorer'>('context');
  const headerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (repoTree.length > 0 && files.length <= 1) { 
       setActiveTab('explorer');
    }
  }, [repoTree.length]);

  // Brand Entrance
  useEffect(() => {
    anime({
      targets: headerRef.current,
      opacity: [0, 1],
      translateX: [-10, 0],
      easing: 'easeOutQuad',
      duration: 800,
      delay: 200
    });
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      
      {/* Brand Header */}
      <div ref={headerRef} className="pt-10 px-8 pb-8 shrink-0 opacity-0">
        <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
          Kinetic<span className="text-gray-400">.</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1 font-medium">AI Code Auditor</p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        
        {/* GitHub Input Section */}
        <div className="px-8 mb-8 shrink-0">
           <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">
             Repository
           </label>
           <div className="flex gap-2">
            <div className="relative group flex-1">
              <input 
                type="text" 
                value={githubLink}
                onChange={(e) => onGithubLinkChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onGithubEnter) {
                    onGithubEnter();
                  }
                }}
                placeholder="username/repo"
                className="w-full bg-gray-50 dark:bg-zinc-900 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-black dark:focus:ring-white transition-all placeholder:text-gray-400"
              />
            </div>
            <button 
              onClick={onGithubEnter}
              className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-80 transition-opacity"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
           </div>
        </div>

        {/* Tab Navigation */}
        {repoTree.length > 0 && (
          <div className="px-8 mb-6 shrink-0">
            <div className="flex border-b border-gray-100 dark:border-white/10">
              <button
                onClick={() => setActiveTab('context')}
                className={`pb-2 text-sm font-medium transition-colors mr-6 ${
                  activeTab === 'context' 
                    ? 'text-black dark:text-white border-b-2 border-black dark:border-white' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Selected
              </button>
              <button
                onClick={() => setActiveTab('explorer')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  activeTab === 'explorer' 
                    ? 'text-black dark:text-white border-b-2 border-black dark:border-white' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Explorer
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-4">
          
          {activeTab === 'explorer' && repoTree.length > 0 ? (
            <div className="animate-in fade-in duration-300">
               <FileExplorer 
                 nodes={repoTree} 
                 activeFiles={files} 
                 onFileClick={onRepoFileClick}
                 isLoadingFile={isLoadingFile}
               />
            </div>
          ) : (
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
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
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
      <div className="p-8 pt-0 shrink-0 space-y-3">
        <button 
          onClick={onResetConfig}
          className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors w-full"
        >
          <Settings className="w-4 h-4" />
          Change Mode
        </button>

        <button 
          onClick={toggleTheme}
          className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors w-full"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          Switch Theme
        </button>
      </div>
    </div>
  );
};
