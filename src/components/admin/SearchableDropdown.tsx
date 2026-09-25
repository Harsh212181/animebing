 // src/components/admin/SearchableDropdown.tsx – ✨ 100x Better UI
import React, { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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

// 🔍 Highlight matched text in title
const highlightMatch = (text: string, query: string) => {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.trim().length);
  const after = text.slice(idx + query.trim().length);
  return (
    <>
      {before}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
};

// 🎨 Status badge color helper
const statusStyles = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('ongoing') || s.includes('airing')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (s.includes('completed') || s.includes('finished')) return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (s.includes('hiatus') || s.includes('paused')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (s.includes('upcoming')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
};

function SearchableDropdown<T extends BaseOption>(props: SearchableDropdownProps<T>) {
  const asyncMode = isAsyncMode(props as SearchableDropdownProps);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const localSelected = !asyncMode ? props.value : null;

  const [asyncResults, setAsyncResults] = useState<BaseOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [selectedAsync, setSelectedAsync] = useState<BaseOption | null>(null);

  const filteredOptions = useMemo(() => {
    if (asyncMode) return [];
    return (props.options || []).filter(opt =>
      opt.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [asyncMode, props, searchTerm]);

  // ── Position calc ──
  const updatePosition = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const maxListHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < maxListHeight && rect.top > maxListHeight;

    setCoords({
      top: openUpward
        ? rect.top + window.scrollY - maxListHeight - 8
        : rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width,
      openUpward,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen, updatePosition]);

  const fetchAsyncResults = useCallback(
    debounce(async (query: string) => {
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

  useEffect(() => {
    if (asyncMode) {
      fetchAsyncResults(searchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, asyncMode]);

  useEffect(() => {
    if (asyncMode && isOpen && asyncResults.length === 0 && !searchTerm && !asyncLoading) {
      fetchAsyncResults('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
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

  const clearSelection = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (asyncMode) {
      setSelectedAsync(null);
      setSearchTerm('');
    } else {
      (props as LocalModeProps<T>).onChange(null);
      setSearchTerm('');
    }
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const currentSelected = asyncMode ? selectedAsync : localSelected;
  const isLoading = asyncMode ? asyncLoading : false;
  const optionsToShow = asyncMode ? asyncResults : filteredOptions;

  const placeholderText = props.placeholder || (asyncMode ? 'Type to search...' : 'Search...');
  const disabled = props.disabled;

  const getImageSrc = (option: BaseOption): string | undefined => {
    return option.thumbnail || option.posterImage || option.coverImage;
  };

  // ⌨️ Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, optionsToShow.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (optionsToShow[highlightedIndex]) {
        handleSelect(optionsToShow[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-md group" ref={dropdownRef}>
      {/* ── Input container ── */}
      <div
        className={`relative rounded-xl transition-all duration-200 ${
          isOpen
            ? 'ring-2 ring-indigo-500/60 shadow-lg shadow-indigo-500/10'
            : 'ring-1 ring-slate-700 hover:ring-slate-600'
        }`}
      >
        {/* Search icon (left) */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          disabled={disabled}
          autoFocus={props.autoFocus}
          className="w-full bg-slate-900/60 backdrop-blur-sm text-white placeholder-slate-500 rounded-xl pl-10 pr-10 py-3 text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />

        {/* Right side: loading / clear / chevron */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
          )}
          {currentSelected && !isLoading && (
            <button
              onClick={clearSelection}
              className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              type="button"
              aria-label="Clear selection"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          {!currentSelected && !isLoading && (
            <svg
              className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Portal dropdown menu ── */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 9999,
          }}
          className="animate-[dropdownIn_140ms_ease-out] origin-top"
        >
          <style>{`
            @keyframes dropdownIn {
              from { opacity: 0; transform: translateY(-4px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .sd-scroll::-webkit-scrollbar { width: 6px; }
            .sd-scroll::-webkit-scrollbar-track { background: transparent; }
            .sd-scroll::-webkit-scrollbar-thumb {
              background: rgba(100,116,139,0.4);
              border-radius: 999px;
            }
            .sd-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(100,116,139,0.7);
            }
          `}</style>

          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header strip (subtle) */}
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <span>
                {isLoading
                  ? 'Searching…'
                  : asyncError
                  ? 'Error'
                  : optionsToShow.length > 0
                  ? `${optionsToShow.length} result${optionsToShow.length !== 1 ? 's' : ''}`
                  : 'No results'}
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">↑↓</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">↵</kbd>
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto sd-scroll p-1.5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-6 h-6 border-2 border-slate-700 border-t-indigo-400 rounded-full animate-spin" />
                  <span className="text-xs text-slate-500">Loading results…</span>
                </div>
              ) : asyncError ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  </div>
                  <span className="text-xs text-red-400 text-center px-4">{asyncError}</span>
                </div>
              ) : optionsToShow.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500">
                    {searchTerm ? `No results for "${searchTerm}"` : 'Nothing to show'}
                  </span>
                </div>
              ) : (
                optionsToShow.map((option, idx) => {
                  const isSelected = currentSelected?._id === option._id;
                  const isHighlighted = idx === highlightedIndex;
                  const img = getImageSrc(option);
                  return (
                    <button
                      key={option._id}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-2.5 py-2.5 rounded-lg flex items-center gap-3 transition-colors duration-100 group/item ${
                        isSelected
                          ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                          : isHighlighted
                          ? 'bg-slate-800/80'
                          : 'hover:bg-slate-800/60'
                      }`}
                      type="button"
                    >
                      {/* Thumbnail */}
                      <div className="relative flex-shrink-0">
                        {img ? (
                          <img
                            src={img}
                            alt={option.title}
                            className="w-11 h-15 object-cover rounded-md ring-1 ring-slate-700/60 shadow-sm"
                            style={{ height: '60px' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-11 h-[60px] rounded-md bg-slate-800 ring-1 ring-slate-700/60 flex items-center justify-center text-slate-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="9" cy="9" r="2" />
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                            </svg>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/50">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-200' : 'text-slate-100'}`}>
                          {highlightMatch(option.title, searchTerm)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {option.status && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusStyles(option.status)}`}>
                              {option.status}
                            </span>
                          )}
                          {option.contentType && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-slate-700/40 text-slate-300 border-slate-600/40">
                              {option.contentType}
                            </span>
                          )}
                          {option.createdByUsername && option.createdBy && option.createdBy !== 'admin' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30 flex items-center gap-1">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              {option.createdByUsername}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron on hover */}
                      <div className={`flex-shrink-0 transition-all duration-150 ${
                        isHighlighted || isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
                      }`}>
                        <svg className={isSelected ? 'text-indigo-400' : 'text-slate-500'} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hint (only when results present) */}
            {!isLoading && !asyncError && optionsToShow.length > 0 && (
              <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-900/60 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Use <kbd className="px-1 bg-slate-800 border border-slate-700 rounded">Esc</kbd> to close</span>
                <span className="text-slate-600">AnimeBing</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default SearchableDropdown;