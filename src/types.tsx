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
}

