import { FC } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { ImageIcon } from 'lucide-react';
import { NoteHeader } from './NoteHeader';
import { TagsDisplay } from './TagsDisplay';
import { NoteNavigation } from './NoteNavigation';

interface AnnotationImage {
  src: string;
  id: string;
}

interface AnnotatedLayoutProps {
  editor: Editor | null;
  annotationImages: AnnotationImage[];
  onImageClick: () => void;
  onDateClick: () => void;
  onCreateNote: () => void;
}

export const AnnotatedLayout: FC<AnnotatedLayoutProps> = ({
  editor,
  annotationImages,
  onImageClick,
  onDateClick,
  onCreateNote
}) => {
  const handleAnnotationImageClick = (image: AnnotationImage) => {
    if (image.src.startsWith('http')) {
      window.open(image.src, '_blank');
    }
  };

  return (
    <div className="editor-content">
      <div className="images-column">
        <button
          onClick={onImageClick}
          className="add-image-button"
        >
          <ImageIcon className="h-5 w-5" />
          Add Image
        </button>
        {annotationImages.map((image) => (
          <img
            key={image.id}
            src={image.src}
            alt="Annotation"
            className="annotation-image"
            onClick={() => handleAnnotationImageClick(image)}
          />
        ))}
      </div>
      <div className="text-column">
        <NoteHeader onDateClick={onDateClick} />
        <EditorContent editor={editor} className="editor-body" />
        <TagsDisplay />
        <NoteNavigation onCreateNote={onCreateNote} />
      </div>
    </div>
  );
};