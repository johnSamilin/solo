import { TypographySettings } from './types';

export const defaultSettings: TypographySettings = {
  editorFontFamily: 'Crimson Pro',
  editorFontSize: '1.125rem',
  editorLineHeight: '1.75',
  titleFontFamily: 'Crimson Pro',
  titleFontSize: '2rem',
  sidebarFontFamily: 'Crimson Pro',
  sidebarFontSize: '1rem',
  pageMargins: '2rem',
  paragraphSpacing: '1em',
  enableDropCaps: false,
  dropCapSize: '3.5em',
  dropCapLineHeight: '3.5',
  maxEditorWidth: '75%',
  sidebarPinned: true
};

export const themes: Record<string, { name: string; settings: TypographySettings }> = {
  air: {
    name: 'Air',
    settings: {
      editorFontFamily: 'Crimson Pro',
      editorFontSize: '1.25rem',
      editorLineHeight: '2',
      titleFontFamily: 'Crimson Pro',
      titleFontSize: '2.5rem',
      sidebarFontFamily: 'Crimson Pro',
      sidebarFontSize: '1rem',
      pageMargins: '3rem',
      paragraphSpacing: '1.5em',
      enableDropCaps: true,
      dropCapSize: '4.5em',
      dropCapLineHeight: '4.5',
      maxEditorWidth: '80%',
      sidebarPinned: true
    },
  },
  typewriter: {
    name: 'Typewriter',
    settings: {
      editorFontFamily: 'GNU Typewriter',
      editorFontSize: '1.125rem',
      editorLineHeight: '1.75',
      titleFontFamily: 'GNU Typewriter',
      titleFontSize: '2rem',
      sidebarFontFamily: 'GNU Typewriter',
      sidebarFontSize: '1rem',
      pageMargins: '2rem',
      paragraphSpacing: '1em',
      enableDropCaps: false,
      dropCapSize: '3.5em',
      dropCapLineHeight: '3.5',
      maxEditorWidth: '75%',
      sidebarPinned: true
    },
  },
  narrow: {
    name: 'Narrow',
    settings: {
      editorFontFamily: 'Crimson Pro',
      editorFontSize: '1rem',
      editorLineHeight: '1.5',
      titleFontFamily: 'Crimson Pro',
      titleFontSize: '1.5rem',
      sidebarFontFamily: 'Crimson Pro',
      sidebarFontSize: '0.875rem',
      pageMargins: '1rem',
      paragraphSpacing: '0.5em',
      enableDropCaps: false,
      dropCapSize: '2.5em',
      dropCapLineHeight: '2.5',
      maxEditorWidth: '60%',
      sidebarPinned: true
    },
  },
};