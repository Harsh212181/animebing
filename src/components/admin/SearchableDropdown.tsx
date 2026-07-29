 // src/components/admin/SearchableDropdown.tsx – NO PURPLE GLOW
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface BaseOption {
  _id: string;
  title: string;
  thumbnail?: string;
  posterImage?: string;
  coverImage?: string;
  status?: string;
  contentType?: string;
  episodes?: any[];
  [key: string]: any;
}

// Local mode props
interface LocalModeProps<T extends BaseOption> {
  options: T[];
  value: T | null;
  onChange: (option: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  fetchUrl?: never;
  apiBase?: never;
  token?: never;
  onSelect?: never;
}

// Async mode props
interface AsyncModeProps {
  onSelect: (item: BaseOption) => void;
  placeholder?: string;
  disabled?: boolean;
  fetchUrl: string;
  apiBase?: string;
  token?: string;
  autoFocus?: boolean;
  options?: never;
  value?: never;
  onChange?: never;
}

type SearchableDropdownProps<T extends BaseOption = BaseOption> = 
  | LocalModeProps<T>
  | AsyncModeProps;

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
  const asyncMode = isAsyncMode(props as SearchableDropdownProps);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const localSelected = !asyncMode ? props.value : null;

  const [asyncResults, setAsyncResults] = useState<BaseOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [selectedAsync, setSelectedAsync] = useState<BaseOption | null>(null);

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

  // ✅ UPDATED: always fetch, even on empty query, to show default/recent results
  const fetchAsyncResults = useCallback(
    debounce(async (query: string) => {
      // 👇 Empty query pe bhi fetch karo — backend ko empty search='' bhejo,
      // taaki default/recent results dikhein jab tak user kuch type na kare.
      setAsyncLoading(true);
      setAsyncError(null);
      try {
        const base = asyncMode ? props.apiBase || DEFAULT_API_BASE : '';
        const authToken = asyncMode ? props.token || getToken() : '';
        const url = new URL(
          (props as AsyncModeProps).fetchUrl,
          base || window.location.origin
        ).toString();
        const response = await axios.get(url, {
          params: { search: query.trim() },
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

  // ✅ UPDATED: trigger fetch when searchTerm changes
  useEffect(() => {
    if (asyncMode) {
      fetchAsyncResults(searchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, asyncMode]);

  // 👇 NEW — dropdown open hote hi (focus) agar abhi tak koi results/search nahi hua, default list laao
  useEffect(() => {
    if (asyncMode && isOpen && asyncResults.length === 0 && !searchTerm && !asyncLoading) {
      fetchAsyncResults('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (!asyncMode && props.onChange) {
      (props as LocalModeProps<T>).onChange(null);
    }
  };

  const handleSelect = (option: BaseOption) => {
    if (asyncMode) {
      setSelectedAsync(option);
      setSearchTerm(option.title);
      (props as AsyncModeProps).onSelect(option);
      setIsOpen(false);
    } else {
      (props as LocalModeProps<T>).onChange(option as T);
      setSearchTerm(option.title);
      setIsOpen(false);
    }
  };

  const clearSelection = () => {
    if (asyncMode) {
      setSelectedAsync(null);
      setSearchTerm('');
    } else {
      (props as LocalModeProps<T>).onChange(null);
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

  const getImageSrc = (option: BaseOption): string | undefined => {
    return option.thumbnail || option.posterImage || option.coverImage;
  };

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
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none transition-colors pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {currentSelected && (
          <button
            onClick={clearSelection}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-red-400 transition-colors"
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
              {/* ✅ No purple, using slate instead */}
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400 mr-2"></div>
              Loading...
            </div>
          ) : asyncError ? (
            <div className="p-4 text-center text-red-400">{asyncError}</div>
          ) : optionsToShow.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              {searchTerm ? 'No results found' : 'No anime available'}
            </div>
          ) : (
            optionsToShow.map(option => (
              <button
                key={option._id}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors flex items-center gap-3 ${
                  currentSelected?._id === option._id
                    ? 'bg-slate-700 text-white'        // ✅ No purple, using slate
                    : 'text-slate-300'
                }`}
                type="button"
              >
                {getImageSrc(option) && (
                  <img
                    src={getImageSrc(option)}
                    alt={option.title}
                    className="w-10 h-14 object-cover rounded flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div>
                  <div className="font-medium">{option.title}</div>
                  {option.status && (
                    <div className="text-xs text-slate-400">{option.status}</div>
                  )}
                  {option.contentType && (
                    <div className="text-xs text-slate-400">{option.contentType}</div>
                  )}
                  {/* 👇 NEW: creator name (only for sub‑admin, not main admin) */}
                  {option.createdByUsername && option.createdBy && option.createdBy !== 'admin' && (
                    <div className="text-xs text-purple-400"> {option.createdByUsername}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;