import { FileNode, FileMetadata, Note, Notebook } from '../types';
import { getNativeAPI } from './nativeBridge';

interface ParseResult {
  notebooks: Notebook[];
  notes: Note[];
}

export async function loadFromElectron(): Promise<ParseResult> {
  const api = getNativeAPI();
  if (!api) {
    throw new Error('Native API not available');
  }

  const result = await api.readStructure();
  if (!result.success || !result.structure) {
    throw new Error(result.error || 'Failed to read structure');
  }

  return parseFileStructure(result.structure);
}

export function parseFileStructure(structure: FileNode[]): ParseResult {
  const notebooks: Notebook[] = [];
  const notes: Note[] = [];

  function processNode(node: FileNode, parentPath: string = '') {
    if (node.type === 'folder') {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      const parentId = parentPath || null;

      notebooks.push({
        id: node.path,
        name: node.name,
        parentId: parentId,
        isExpanded: true,
        path: node.path,
      });

      if (node.children) {
        for (const child of node.children) {
          processNode(child, node.path);
        }
      }
    } else if (node.type === 'file' && (node.name.endsWith('.html') || node.name.endsWith('.pdf'))) {
      const isPdf = node.name.endsWith('.pdf');
      const noteTitle = node.name.replace(/\.(html|pdf)$/, '');
      const metadata = node.metadata;

      const tags: string[] = metadata?.tags || [];

      const createdAt = metadata?.createdAt
        ? new Date(metadata.createdAt)
        : new Date();

      notes.push({
        id: node.path,
        title: noteTitle,
        content: '',
        ...metadata,
        createdAt: createdAt,
        tags: tags,
        notebookId: parentPath || null,
        filePath: node.path,
        path: node.path,
        cssPath: isPdf ? undefined : node.cssPath,
        isLoaded: false,
        paragraphTags: metadata?.paragraphTags || [],
        fileType: isPdf ? 'pdf' : 'html',
      });
    }
  }

  for (const node of structure) {
    processNode(node, '');
  }

  return { notebooks, notes };
}

export async function loadNoteContent(filePath: string): Promise<string> {
  const api = getNativeAPI();
  if (!api) {
    throw new Error('Native API not available');
  }

  const result = await api.openFile(filePath);

  if (!result.success || result.content === undefined) {
    throw new Error(result.error || 'Failed to load note content');
  }

  return result.content;
}

export async function loadPdfContent(filePath: string): Promise<string> {
  const api = getNativeAPI();
  if (!api) {
    throw new Error('Native API not available');
  }

  const result = await api.openPdfFile(filePath);

  if (!result.success || result.data === undefined) {
    throw new Error(result.error || 'Failed to load PDF content');
  }

  return result.data;
}

export async function loadNoteCss(cssPath: string): Promise<string> {
  const api = getNativeAPI();
  if (!api) {
    throw new Error('Native API not available');
  }

  const result = await api.openFile(cssPath);

  if (!result.success || result.content === undefined) {
    throw new Error(result.error || 'Failed to load CSS content');
  }

  return result.content;
}
