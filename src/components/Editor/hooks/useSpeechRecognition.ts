import { useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { useStore } from '../../../stores/StoreProvider';
import { analytics } from '../../../utils/analytics';

export const useSpeechRecognition = (editor: Editor | null) => {
  const { settingsStore } = useStore();
  const [isDictating, setIsDictating] = useState(false);
  const [dictationLang, setDictationLang] = useState<'en-US' | 'ru-RU'>('ru-RU');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isLanguageSwitchPending = useRef(false);

  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      settingsStore.setToast('Speech recognition is not supported in your browser', 'error');
      return null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = dictationLang;

    recognition.onstart = () => {
      setIsDictating(true);
      settingsStore.setToast('Listening...', 'success');
    };

    recognition.onresult = (event) => {
      if (!editor) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          editor.commands.insertContent(transcript + ' ');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      settingsStore.setToast('Speech recognition error: ' + event.error, 'error');
      setIsDictating(false);
      isLanguageSwitchPending.current = false;
    };

    recognition.onend = () => {
      setIsDictating(false);
      if (isLanguageSwitchPending.current) {
        isLanguageSwitchPending.current = false;
        const newRecognition = initializeSpeechRecognition();
        if (newRecognition) {
          recognitionRef.current = newRecognition;
          newRecognition.start();
        }
      }
    };

    return recognition;
  };

  const handleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      isLanguageSwitchPending.current = false;
      return;
    }

    const recognition = initializeSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
      analytics.dictationUsed();
    }
  };

  const toggleDictationLanguage = () => {
    if (!isDictating) return;

    const newLang = dictationLang === 'en-US' ? 'ru-RU' : 'en-US';
    setDictationLang(newLang);
    isLanguageSwitchPending.current = true;
    recognitionRef.current?.stop();
  };

  return {
    isDictating,
    dictationLang,
    handleDictation,
    toggleDictationLanguage
  };
};