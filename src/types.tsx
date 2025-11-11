import { Editor } from "@tiptap/react";

export interface Tag {
  id: string;
  path: string;
}

export interface TagNode {
  id: string;
  name: string;
  children: TagNode[];
  isChecked: boolean;
  isExpanded: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  tags: Tag[];
  notebookId: string;
  isCensored?: boolean;
  theme?: string;
}

export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
  isCensored?: boolean;
}

export interface TypographySettings {
  editorFontFamily: string;
  editorFontSize: string;
  editorLineHeight: string;
  titleFontFamily: string;
  titleFontSize: string;
  sidebarFontFamily: string;
  sidebarFontSize: string;
  pageMargins: string;
  paragraphSpacing: string;
  enableDropCaps: boolean;
  dropCapSize: string;
  dropCapLineHeight: string;
  maxEditorWidth: string;
  sidebarPinned: boolean;
  typewriterSound: string;
  autoZenMode: boolean;
}

export interface CensorshipSettings {
  pin: string | null;
  enabled: boolean;
}

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

export type ImportMode = 'merge' | 'replace';

export interface Bridge {
  loadFromStorage: (key: string) => Promise<any>;
  saveToStorage: (key: string, data: any) => Promise<boolean>;
  pickExportFolder: () => Promise<string>;
  pickImportFolder: () => Promise<string>;
  exportData: (data: string, exportPath: string) => void;
  importFromJoplin: (settings: string) => Promise<{ notes: Note[], notebooks: Notebook[] } | null>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    bridge?: Bridge;
  }
}