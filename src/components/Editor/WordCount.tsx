import { FC } from 'react';
import { Editor } from '@tiptap/react';

interface WordCountProps {
  editor: Editor | null;
  isZenMode: boolean;
}

export const WordCount: FC<WordCountProps> = ({ editor, isZenMode }) => {
  if (isZenMode || !editor) return null;

  const wordCount = editor.state.doc.textContent.trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length || 0;
  
  const paragraphCount = editor.state.doc.content.content.filter(
    node => node.type.name === 'paragraph' || node.type.name === 'heading'
  ).length || 0;

  return (
    <div className="word-count">
      {wordCount}/{paragraphCount}
    </div>
  );
};