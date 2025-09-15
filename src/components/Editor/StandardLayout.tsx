import { FC } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { NoteHeader } from './NoteHeader';
import { TagsDisplay } from './TagsDisplay';
import { NoteNavigation } from './NoteNavigation';
import { WordCount } from './WordCount';
import { LanguageSelector } from './LanguageSelector';

interface StandardLayoutProps {
  editor: Editor | null;
  isZenMode: boolean;
  isDictating: boolean;
  dictationLang: 'en-US' | 'ru-RU';
  onDateClick: () => void;
  onCreateNote: () => void;
  onToggleLanguage: () => void;
}

export const StandardLayout: FC<StandardLayoutProps> = ({
  editor,
  isZenMode,
  isDictating,
  dictationLang,
  onDateClick,
  onCreateNote,
  onToggleLanguage
}) => {
  return (
    <>
      <div className="editor-content">
        <NoteHeader onDateClick={onDateClick} />
        <EditorContent editor={editor} className="editor-body" />
        <TagsDisplay />
        <NoteNavigation onCreateNote={onCreateNote} />
      </div>
      <WordCount editor={editor} isZenMode={isZenMode} />
      <LanguageSelector
        isDictating={isDictating}
        dictationLang={dictationLang}
        onToggleLanguage={onToggleLanguage}
      />
    </>
  );
};