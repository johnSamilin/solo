import { FC } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SearchInput: FC<SearchInputProps> = ({
  searchQuery,
  onSearchChange
}) => {
  return (
    <div className="search-input-section">
      <div className="search-input-wrapper">
        <Search className="h-5 w-5 search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes... (fuzzy search supported)"
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