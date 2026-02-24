import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { useStore } from '../../../stores/StoreProvider';

interface ImageContextMenu {
  x: number;
  y: number;
  target: HTMLImageElement;
}

interface AnnotationImage {
  src: string;
  id: string;
}

export const useImageHandling = (editor: Editor | null) => {
  const { notesStore, settingsStore } = useStore();
  const [contextMenu, setContextMenu] = useState<ImageContextMenu | null>(null);
  const [annotationImages, setAnnotationImages] = useState<AnnotationImage[]>([]);
  const editorContentRef = useRef<HTMLDivElement>(null);

  // Extract images from note content for annotated layout
  useEffect(() => {
    if (!notesStore.selectedNote?.content) {
      setAnnotationImages([]);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notesStore.selectedNote.content;
    const images = tempDiv.querySelectorAll('img:not(.carousel-img)');
    let imageList: AnnotationImage[] = Array.from(images).map((img, index) => ({
      src: img.src,
      id: `img-${index}`
    }));
    
    const carousels = tempDiv.querySelectorAll('[data-type="carousel"]')
    carousels.forEach((carousel) => {
      try {
        const list = JSON
          .parse(carousel.dataset.images)
          .map((path) => ({
            id: path,
            src: path,
          }));
          imageList = imageList.concat(list);
      } catch(er) {
        console.error(er, carousel);
      }
    });

    setAnnotationImages(imageList);
  }, [notesStore.selectedNote?.content]);

  const handleImageContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: target as HTMLImageElement
      });
    }
  };

  const handleImageClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      
      const img = target as HTMLImageElement;
      if (img.requestFullscreen) {
        img.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && !e.target?.closest('.image-context-menu')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    const editorContent = editorContentRef.current;
    if (editorContent) {
      editorContent.addEventListener('contextmenu', handleImageContextMenu);
      editorContent.addEventListener('click', handleImageClick);
      return () => {
        editorContent.removeEventListener('contextmenu', handleImageContextMenu);
        editorContent.removeEventListener('click', handleImageClick);
      };
    }
  }, []);

  const toggleImageWidth = () => {
    if (contextMenu && editor) {
      editor.chain().focus().toggleImageFullWidth().run();
      setContextMenu(null);
    }
  };

  const deleteImage = async () => {
    if (!contextMenu || !notesStore.selectedNote) return;

    const src = contextMenu.target.src;
    
    if (settingsStore.syncMode === 'server' && settingsStore.server.token && src.startsWith(settingsStore.server.url)) {
      try {
        const imageId = src.split('/').pop();
        const response = await fetch(`${settingsStore.server.url}/api/images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${settingsStore.server.token}`,
          },
        });

        if (!response.ok) {
          settingsStore.setToast('Failed to delete image from server', 'error');
          return;
        }
      } catch (error) {
        console.error('Failed to delete image:', error);
        settingsStore.setToast('Failed to delete image from server', 'error');
        return;
      }
    }

    if (editor) {
      editor.chain().focus().setContent(editor.getHTML().replace(contextMenu.target.outerHTML, '')).run();
      notesStore.updateNote(notesStore.selectedNote.id, {
        content: editor.getHTML()
      });
    }

    setContextMenu(null);
    settingsStore.setToast('Image deleted successfully', 'success');
  };

  return {
    contextMenu,
    annotationImages,
    editorContentRef,
    toggleImageWidth,
    deleteImage,
    setContextMenu
  };
};