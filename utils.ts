import { FileContext, FileNode } from "./types";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import yaml from "js-yaml";
// 5. PDF.js is loaded dynamically to avoid Node-specific dependencies like 'canvas' during build
let pdfLib: any = null;
const getPdfLib = async () => {
  if (pdfLib) return pdfLib;
  const lib = await import("pdfjs-dist");
  pdfLib = lib.default || lib;
  pdfLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  return pdfLib;
};

/**
 * Converts a flat list of git paths into a nested FileNode tree.
 */
export const buildFileTree = (items: any[]): FileNode[] => {
  const root: FileNode[] = [];
  const map: { [key: string]: FileNode } = {};

  // Sort: Directories first, then files.
  items.sort((a, b) => {
    if (a.type === b.type) return a.path.localeCompare(b.path);
    return a.type === 'tree' ? -1 : 1;
  });

  items.forEach(item => {
    const parts = item.path.split('/');
    const fileName = parts.pop();
    const parentPath = parts.join('/');

    const node: FileNode = {
      name: fileName,
      path: item.path,
      type: item.type,
      children: item.type === 'tree' ? [] : undefined
    };

    map[item.path] = node;

    if (parts.length === 0) {
      root.push(node);
    } else {
      // Find parent (assuming parent folders always come before children in git tree response, 
      // but if not, this simple logic relies on structure. GitHub recursive tree usually works well.)
      // To be robust, we might need to create implicit parents, but GitHub API usually guarantees tree existence.
      if (map[parentPath]) {
        map[parentPath].children?.push(node);
      } else {
        // Fallback if parent not found in order (should be rare with recursive=1)
        root.push(node);
      }
    }
  });

  return root;
};

/**
 * Main entry point to read a file (or extract multiple if archive).
 */
export const readFile = async (file: File): Promise<FileContext[]> => {
  const buffer = await file.arrayBuffer();
  const fileType = determineFileType(new Uint8Array(buffer), file.name);

  // 1. Handle ZIP Archives (Recursive)
  if (fileType.mime === 'application/zip') {
    return handleZipArchive(buffer);
  }

  // 2. Handle PDF
  if (fileType.mime === 'application/pdf') {
    const text = await handlePdf(buffer);
    return [{
      id: genId(),
      name: file.name,
      type: 'text/plain', // Converted to text for the LLM
      content: text,
      category: 'other'
    }];
  }

  // 3. Handle Excel
  if (fileType.mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType.mime === 'application/vnd.ms-excel') {
    const text = handleExcel(buffer);
    return [{
      id: genId(),
      name: file.name + " (Processed)",
      type: 'text/csv',
      content: text,
      category: 'other'
    }];
  }

  // 4. Handle Image
  if (fileType.mime.startsWith('image/')) {
    const base64 = arrayBufferToBase64(buffer);
    return [{
      id: genId(),
      name: file.name,
      type: fileType.mime,
      content: base64,
      category: 'image'
    }];
  }

  // 5. Handle Text / Code / YAML / JSON
  const textContent = new TextDecoder("utf-8").decode(buffer);

  if (fileType.ext === 'yaml' || fileType.ext === 'yml') {
    try {
      const obj = yaml.load(textContent);
      return [{
        id: genId(),
        name: file.name,
        type: 'application/json',
        content: JSON.stringify(obj, null, 2),
        category: 'code'
      }];
    } catch (e) {
      // Fallback to raw text if parsing fails
    }
  }

  // Default: Treat as Text/Code
  return [{
    id: genId(),
    name: file.name,
    type: fileType.mime || 'text/plain',
    content: textContent,
    category: 'code'
  }];
};

// --- Parsers ---

async function handleZipArchive(buffer: ArrayBuffer): Promise<FileContext[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const results: FileContext[] = [];

    const entries = Object.keys(zip.files);

    // Limit to prevent crashing browser with massive repos
    const limitedEntries = entries.slice(0, 50);

    for (const filename of limitedEntries) {
      const entry = zip.files[filename];
      if (entry.dir) continue;

      const fileData = await entry.async("arraybuffer");
      // Recursively identify type for each file in zip
      const type = determineFileType(new Uint8Array(fileData), filename);

      // We mostly care about code/text in zips for this app
      if (type.mime.startsWith('image/')) {
        // Skip images in zips to save tokens/memory for now, or uncomment to support
        continue;
      }

      const text = new TextDecoder("utf-8").decode(fileData);
      // Basic binary check to avoid adding garbage
      if (isBinary(text)) continue;

      results.push({
        id: genId(),
        name: filename,
        type: 'text/plain',
        content: text,
        category: 'code'
      });
    }
    return results;
  } catch (error) {
    console.error("Error parsing ZIP:", error);
    return [];
  }
}

async function handlePdf(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getPdfLib();
    const loadingTask = pdf.getDocument({ data: buffer });
    const pdfDoc = await loadingTask.promise;
    let fullText = "";

    // Limit pages for token sanity
    const maxPages = Math.min(pdfDoc.numPages, 10);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  } catch (e) {
    console.error("PDF Parse Error", e);
    return "Error parsing PDF file.";
  }
}

function handleExcel(buffer: ArrayBuffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    let result = "";

    workbook.SheetNames.slice(0, 3).forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      result += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
    });

    return result;
  } catch (e) {
    console.error("Excel Parse Error", e);
    return "Error parsing Excel file.";
  }
}

// --- Helpers ---

function determineFileType(header: Uint8Array, filename: string): { mime: string, ext: string } {
  const hex = Array.from(header.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Magic Numbers
  if (hex.startsWith('504B0304')) return { mime: 'application/zip', ext: 'zip' };
  if (hex.startsWith('25504446')) return { mime: 'application/pdf', ext: 'pdf' };
  if (hex.startsWith('D0CF11E0')) return { mime: 'application/vnd.ms-excel', ext: 'xls' }; // Old Excel
  if (hex.startsWith('504B0304') && (ext === 'xlsx' || ext === 'docx')) {
    // DOCX/XLSX are technically zips, relies on extension distinction here
    return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }

  // Images
  if (hex.startsWith('FFD8FF')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (hex.startsWith('89504E47')) return { mime: 'image/png', ext: 'png' };
  if (hex.startsWith('47494638')) return { mime: 'image/gif', ext: 'gif' };

  // Default fallback to extension or text
  return { mime: '', ext };
}

function isBinary(text: string): boolean {
  // Simple heuristic: if we see too many nulls or non-printables in first 100 chars
  for (let i = 0; i < Math.min(text.length, 100); i++) {
    const code = text.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      return true;
    }
  }
  return false;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Rough estimate of tokens (4 chars per token)
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

function genId() {
  return Math.random().toString(36).substring(7);
}