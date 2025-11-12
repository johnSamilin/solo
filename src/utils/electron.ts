import { FileNode, FileMetadata, Note, Notebook, Tag } from '../types';
import { generateUniqueId } from '../utils';

interface ParseResult {
  notebooks: Notebook[];
  notes: Note[];
}

export async function loadFromElectron(): Promise<ParseResult> {
  if (!window.electronAPI) {
    throw new Error('ElectronAPI not available');
  }

  const result = await window.electronAPI.readStructure();

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
      });

      if (node.children) {
        for (const child of node.children) {
          processNode(child, node.path);
        }
      }
    } else if (node.type === 'file' && node.name.endsWith('.html')) {
      const noteTitle = node.name.replace(/\.html$/, '');
      const metadata = node.metadata;

      const tags: Tag[] = metadata?.tags?.map(tagPath => ({
        id: generateUniqueId(),
        path: tagPath,
      })) || [];

      const createdAt = metadata?.date
        ? new Date(metadata.date)
        : new Date();

      notes.push({
        id: node.path,
        title: noteTitle,
        content: '',
        createdAt: createdAt,
        tags: tags,
        notebookId: parentPath || 'default',
        filePath: node.path,
      } as Note & { filePath: string });
    }
  }

  for (const node of structure) {
    processNode(node, '');
  }

  if (notebooks.length === 0) {
    notebooks.push({
      id: 'default',
      name: 'Main notebook',
      parentId: null,
      isExpanded: true,
    });
  }

  return { notebooks, notes };
}

export async function loadNoteContent(filePath: string): Promise<string> {
  if (!window.electronAPI) {
    throw new Error('ElectronAPI not available');
  }

  const result = await window.electronAPI.openFile(filePath);

  if (!result.success || result.content === undefined) {
    throw new Error(result.error || 'Failed to load note content');
  }

  return result.content;
}
