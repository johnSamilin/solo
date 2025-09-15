import { FC } from 'react';

interface LanguageSelectorProps {
  isDictating: boolean;
  dictationLang: 'en-US' | 'ru-RU';
  onToggleLanguage: () => void;
}

export const LanguageSelector: FC<LanguageSelectorProps> = ({
  isDictating,
  dictationLang,
  onToggleLanguage
}) => {
  if (!isDictating) return null;

  return (
    <button
      onClick={onToggleLanguage}
      className="language-selector"
      title={`Current language: ${dictationLang === 'en-US' ? 'English' : 'Russian'}`}
    >
      {dictationLang === 'en-US' ? '🇺🇸' : '🇷🇺'}
    </button>
  );
};