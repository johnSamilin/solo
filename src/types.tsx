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
}
export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
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
}

export interface CensorshipSettings {
  pin: string | null;
  enabled: boolean;
}

export interface Bridge {
  loadFromStorage: (key: string) => Promise<any>;
  saveToStorage: (key: string, data: any) => Promise<boolean>;
}

declare global {
  interface Window {
    brigde?: Bridge;
  }
}

export type ThemeName = 'default' | 'air' | 'typewriter' | 'narrow';