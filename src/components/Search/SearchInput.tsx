import { FC } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface SearchInputProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SearchInput: FC<SearchInputProps> = ({
  searchQuery,
  onSearchChange
}) => {
  const { t } = useI18n();

  return (
    <div className="search-input-section">
      <div className="search-input-wrapper">
        <Search className="h-5 w-5 search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.search.searchPlaceholder}
          className="search-input"
          autoFocus
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="search-clear-button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};