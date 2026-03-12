 // src/components/admin/SearchableDropdown.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

// Generic option type that at least has _id and title
export interface BaseOption {
  _id: string;
  title: string;
  [key: string]: any;
}

// Props for local mode (options provided)
interface LocalModeProps<T extends BaseOption> {
  options: T[];
  value: T | null;
  onChange: (option: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  // async mode not used
  fetchUrl?: never;
  apiBase?: never;
  token?: never;
  onSelect?: never;
}

// Props for async mode (fetchUrl provided)
interface AsyncModeProps {
  onSelect: (item: BaseOption) => void;
  placeholder?: string;
  disabled?: boolean;
  fetchUrl: string;
  apiBase?: string;
  token?: string;
  autoFocus?: boolean;
  // local mode not used
  options?: never;
  value?: never;
  onChange?: never;
}

type SearchableDropdownProps<T extends BaseOption = BaseOption> = 
  | LocalModeProps<T>
  | AsyncModeProps;

// Helper to check if in async mode
const isAsyncMode = (props: SearchableDropdownProps): props is AsyncModeProps => {
  return 'onSelect' in props;
};

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const getToken = () => localStorage.getItem('adminToken') || '';

const debounce = (fn: Function, delay: number) => {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

function SearchableDropdown<T extends BaseOption>(props: SearchableDropdownProps<T>) {
  const asyncMode = isAsyncMode(props);

  // Common state
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local mode state
  const localSelected = !asyncMode ? props.value : null;

  // Async mode state
  const [asyncResults, setAsyncResults] = useState<BaseOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [selectedAsync, setSelectedAsync] = useState<BaseOption | null>(null);

  // Filtered options for local mode – guard against undefined options
  const filteredOptions = !asyncMode
    ? (props.options || []).filter(opt =>
        opt.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Async search
  const fetchAsyncResults = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setAsyncResults([]);
        setAsyncLoading(false);
        return;
      }
      setAsyncLoading(true);
      setAsyncError(null);
      try {
        const base = asyncMode ? props.apiBase || DEFAULT_API_BASE : '';
        const authToken = asyncMode ? props.token || getToken() : '';
        const url = new URL(props.fetchUrl, base || window.location.origin).toString();
        const response = await axios.get(url, {
          params: { search: query },
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        setAsyncResults(response.data);
      } catch (err: any) {
        console.error('SearchableDropdown fetch error:', err);
        setAsyncError(err.response?.data?.error || 'Failed to search');
        setAsyncResults([]);
      } finally {
        setAsyncLoading(false);
      }
    }, 500),
    [asyncMode ? props.fetchUrl : null, asyncMode ? props.apiBase : null, asyncMode ? props.token : null]
  );

  useEffect(() => {
    if (asyncMode) {
      fetchAsyncResults(searchTerm);
    }
  }, [searchTerm, asyncMode, fetchAsyncResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (!asyncMode && props.onChange) {
      // Clear selection when typing
      props.onChange(null);
    }
  };

  const handleSelect = (option: BaseOption) => {
    if (asyncMode) {
      setSelectedAsync(option);
      setSearchTerm(option.title);
      props.onSelect(option);
      setIsOpen(false);
    } else {
      props.onChange(option as T);
      setSearchTerm(option.title);
      setIsOpen(false);
    }
  };

  const clearSelection = () => {
    if (asyncMode) {
      setSelectedAsync(null);
      setSearchTerm('');
      // No onSelect with null – we can't unselect in async mode? But we'll allow
      // but async mode typically expects a selection. We'll just clear.
    } else {
      props.onChange(null);
      setSearchTerm('');
    }
    setIsOpen(false);
  };

  const currentSelected = asyncMode ? selectedAsync : localSelected;
  const isLoading = asyncMode ? asyncLoading : false;
  const optionsToShow = asyncMode ? asyncResults : filteredOptions;

  const placeholderText = asyncMode
    ? props.placeholder || 'Type to search...'
    : props.placeholder || 'Search...';

  const disabled = asyncMode ? props.disabled : props.disabled;

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholderText}
          disabled={disabled}
          autoFocus={asyncMode ? props.autoFocus : props.autoFocus}
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {currentSelected && (
          <button
            onClick={clearSelection}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-2"></div>
              Loading...
            </div>
          ) : asyncError ? (
            <div className="p-4 text-center text-red-400">{asyncError}</div>
          ) : optionsToShow.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              {searchTerm ? 'No results found' : 'Type to search'}
            </div>
          ) : (
            optionsToShow.map(option => (
              <button
                key={option._id}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                  currentSelected?._id === option._id
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300'
                }`}
                type="button"
              >
                <div className="font-medium">{option.title}</div>
                {/* Optionally show extra info if present */}
                {option.episodes && (
                  <div className="text-sm text-slate-400">
                    {option.episodes.length} episodes
                  </div>
                )}
                {option.status && (
                  <div className="text-sm text-slate-400">{option.status}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {currentSelected && !isOpen && (
        <div className="mt-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-white">{currentSelected.title}</h4>
              {currentSelected.episodes && (
                <p className="text-slate-300 text-sm">
                  {currentSelected.episodes.length} episodes
                </p>
              )}
              {currentSelected.status && (
                <p className="text-slate-300 text-sm">{currentSelected.status}</p>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-white transition-colors text-sm"
              type="button"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;