import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { Editor } from '@tiptap/react';
import { themes } from '../../../constants';
import { useStore } from '../../../stores/StoreProvider';

const nonCharacterKeys = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'PageUp', 'PageDown',
  'Insert', 'Delete', 'Backspace', 'Escape',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

const isTypewriterFont = (font: string) => {
  return ['GNU Typewriter', 'CMTypewriter', 'UMTypewriter'].includes(font);
};

export const useTypewriterSound = (editor: Editor | null) => {
  const { notesStore, settingsStore } = useStore();
  const soundRef = useRef<Howl>();

  useEffect(() => {
    const currentSettings = notesStore.selectedNote?.theme ?
      themes[notesStore.selectedNote.theme].settings :
      settingsStore.settings;

    const audioSrc = window.electronAPI
      ? `audio://${currentSettings.typewriterSound}.mp3`
      : `/${currentSettings.typewriterSound}.mp3`;

    soundRef.current = new Howl({
      src: [audioSrc],
      volume: 1,
      rate: 2.0
    });
  }, [settingsStore.settings.typewriterSound, notesStore.selectedNote?.theme, settingsStore.settings]);

  useEffect(() => {
    if (!editor) return;

    let lastLength = editor.state.doc.textContent.length;

    const handleKeyUp = (event: KeyboardEvent) => {
      const currentSettings = notesStore.selectedNote?.theme ? 
        themes[notesStore.selectedNote.theme].settings : 
        settingsStore.settings;

      if (isTypewriterFont(currentSettings.editorFontFamily)) {
        const currentLength = editor.state.doc.textContent.length;
        
        if (!nonCharacterKeys.has(event.key) && 
            currentLength > lastLength &&
            !event.ctrlKey && 
            !event.altKey && 
            !event.metaKey) {
          soundRef.current?.play();
        }
        
        lastLength = currentLength;
      }
    };

    const element = editor.view.dom;
    element.addEventListener('keyup', handleKeyUp);

    return () => {
      element.removeEventListener('keyup', handleKeyUp);
    };
  }, [editor, settingsStore.settings.editorFontFamily, notesStore.selectedNote?.theme]);
};