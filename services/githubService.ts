import { RepoDetails, RepoContent, FileContext, FileNode } from "../types";
import { buildFileTree } from "../utils";
import JSZip from 'jszip';

const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.lock', '.pdf', '.mp4', '.mov', '.mp3', '.zip', '.tar', '.gz'
];

const IGNORED_DIRS = [
  'node_modules', 'dist', 'build', 'coverage', '.git', '.idea', '.vscode'
];

export const fetchRepoDetails = async (input: string): Promise<RepoDetails | null> => {
  try {
    let owner = '';
    let repo = '';

    // Remove trailing slash
    const cleanInput = input.trim().replace(/\/$/, '');

    // Check if input is a full URL or just owner/repo
    if (cleanInput.startsWith('http')) {
      try {
        const urlObj = new URL(cleanInput);
        // Pathname usually starts with /, so split results in ["", "owner", "repo"]
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
        }
      } catch (e) {
        console.error("Invalid URL format");
        return null;
      }
    } else {
      const parts = cleanInput.split('/');
      if (parts.length === 2) {
        owner = parts[0];
        repo = parts[1];
      }
    }

    if (!owner || !repo) return null;

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("Repository not found (or is private).");
      } else if (response.status === 403) {
        console.warn("GitHub API rate limit exceeded.");
      }
      return null;
    }

    const data = await response.json();

    // Fetch root contents
    try {
      const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`);
      if (contentsResponse.ok) {
        const contents: RepoContent[] = await contentsResponse.json();
        // Sort: directories first, then files alphabetically
        data.contents = contents.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'dir' ? -1 : 1;
        });
      } else {
        data.contents = [];
      }
    } catch (err) {
      console.warn("Failed to fetch repo contents:", err);
      data.contents = [];
    }

    return data as RepoDetails;
  } catch (error) {
    console.error("Error fetching repo details:", error);
    return null;
  }
};

export const fetchGithubFileContent = async (owner: string, repo: string, branch: string, path: string): Promise<FileContext> => {
  const downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file content: ${path}`);
  }

  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(path);
  let content = '';

  if (isImage) {
    const blob = await response.blob();
    content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    content = await response.text();
  }

  return {
    id: `gh-${path}-${Date.now()}`,
    name: path,
    type: isImage ? `image/${path.split('.').pop() === 'jpg' ? 'jpeg' : path.split('.').pop()}` : (path.endsWith('.svg') ? 'image/svg+xml' : 'text/plain'),
    content: content,
    category: isImage ? 'image' : 'code'
  };
};

export const fetchRepoStructure = async (repo: RepoDetails): Promise<{ tree: FileNode[], mapFile: FileContext }> => {
  try {
    const { owner, name, default_branch } = repo;

    // 1. Fetch the recursive tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner.login}/${name}/git/trees/${default_branch}?recursive=1`);

    if (!treeResponse.ok) {
      console.warn("Failed to fetch recursive tree.");
      throw new Error("Failed to fetch repository tree");
    }

    const treeData = await treeResponse.json();
    const allItems = treeData.tree; // Array of { path, mode, type, sha, url }

    // 2. Build Visual Tree
    const visualTree = buildFileTree(allItems);

    // 3. Generate Structure Map for AI
    const allPaths = allItems.map((item: any) => {
      return item.type === 'tree' ? `${item.path}/` : item.path;
    });

    let structureContent = `Repository Map for ${owner.login}/${name} (${default_branch})\n` +
      `--------------------------------------------------\n` +
      `Total Items: ${allPaths.length}\n\n` +
      `### FILE STRUCTURE ###\n` +
      allPaths.join('\n') +
      `\n\n### FULL REPOSITORY CONTENT ###\n` +
      `Below is the content of all text-based files in the repository:\n\n`;

    // 4. Fetch Full Content via Raw URLs (Avoids CORS issues with ZIP)
    try {
      console.log("Fetching full repo content via raw channels...");

      let filesProcessed = 0;
      const MAX_FILES = 60; // Reasonable limit for browser parallel fetch
      const MAX_TOTAL_SIZE = 400 * 1024; // ~100k-150k tokens (Safe for 250k TPM limits)
      let currentSize = 0;

      // Filter valid code files from the tree
      const targetFiles = allItems.filter((item: any) => {
        if (!item || !item.path || item.type !== 'blob') return false;
        const ext = '.' + item.path.split('.').pop()?.toLowerCase();
        const isIgnoredExt = IGNORED_EXTENSIONS.includes(ext);
        const isIgnoredDir = IGNORED_DIRS.some(d => (item.path as string).includes(`/${d}/`) || (item.path as string).startsWith(`${d}/`));
        return !isIgnoredExt && !isIgnoredDir;
      }).slice(0, MAX_FILES);

      console.log(`Queueing ${targetFiles.length} files for parallel fetch...`);

      const filePromises = targetFiles.map(async (item: any) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner.login}/${name}/${default_branch}/${item.path}`;
          const res = await fetch(rawUrl);
          if (!res.ok) return "";

          const content = await res.text();
          if (currentSize + content.length > MAX_TOTAL_SIZE) return "";

          currentSize += content.length;
          filesProcessed++;
          return `\n--- START FILE: ${item.path} ---\n${content}\n--- END FILE: ${item.path} ---\n`;
        } catch (e) {
          return "";
        }
      });

      const fileContents = await Promise.all(filePromises);
      const validContents = fileContents.filter(c => c !== "");
      structureContent += validContents.join('\n');

      console.log(`Successfully merged ${filesProcessed} files into context. Total size: ${(currentSize / 1024).toFixed(1)}KB`);

      if (targetFiles.length > MAX_FILES) {
        structureContent += `\n\n[Note: Only the first ${MAX_FILES} files were included to preserve performance.]\n`;
      }

    } catch (err) {
      console.warn("Failed to aggregate repo contents:", err);
      structureContent += "\n[Error aggregating full content. Only structure is available.]\n";
    }

    const mapFile: FileContext = {
      id: `repo-structure-${Date.now()}`,
      name: 'REPOSITORY_MAP.md',
      type: 'text/markdown',
      content: structureContent,
      category: 'other'
    };

    return { tree: visualTree, mapFile };

  } catch (error) {
    console.error("Error in fetchRepoStructure:", error);
    throw error;
  }
};