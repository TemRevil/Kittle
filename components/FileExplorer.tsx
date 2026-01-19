import React, { useState } from 'react';
import { FileNode, FileContext } from '../types';
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown, CheckCircle } from 'lucide-react';

interface FileExplorerProps {
  nodes: FileNode[];
  activeFiles: FileContext[];
  onFileClick: (path: string) => void;
  loadingFilePaths?: string[];
}

const TreeNode: React.FC<{
  node: FileNode;
  depth: number;
  activeFiles: FileContext[];
  onFileClick: (path: string) => void;
  loadingFilePaths?: string[];
}> = ({ node, depth, activeFiles, onFileClick, loadingFilePaths }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isActive = activeFiles.some(f => f.name === node.path);
  const isLoading = loadingFilePaths?.includes(node.path);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'tree') {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path);
    }
  };

  const getIcon = () => {
    if (node.type === 'tree') {
      return isOpen ?
        <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" /> :
        <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    return <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-teal-400' : 'text-gray-400'}`} />;
  };

  return (
    <div>
      <div
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 py-1 pr-2 rounded-lg cursor-pointer transition-colors select-none
          ${isActive ? 'bg-teal-500/10' : 'hover:bg-white/5'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'tree' && (
          <span className="opacity-70">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
        {/* Spacer for files to align with folders */}
        {node.type === 'blob' && <span className="w-3" />}

        {getIcon()}

        <span className={`text-xs truncate ${isActive ? 'text-teal-400 font-medium' : 'dark:text-gray-300 text-gray-700'}`}>
          {node.name}
        </span>

        {isLoading && (
          <div className="ml-auto w-2.5 h-2.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        )}

        {!isLoading && isActive && (
          <CheckCircle className="ml-auto w-3 h-3 text-teal-500" />
        )}
      </div>

      {node.type === 'tree' && isOpen && node.children && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFiles={activeFiles}
              onFileClick={onFileClick}
              loadingFilePaths={loadingFilePaths}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFiles, onFileClick, loadingFilePaths }) => {
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-center text-xs dark:text-gray-500 text-gray-400">
        No files to display.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 pb-4">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          activeFiles={activeFiles}
          onFileClick={onFileClick}
          loadingFilePaths={loadingFilePaths}
        />
      ))}
    </div>
  );
};
