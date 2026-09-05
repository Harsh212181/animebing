 import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import SearchableDropdown from './SearchableDropdown';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface AnimeOption { _id: string; title: string; thumbnail?: string; }
interface ExistingPage { _id: string; slug: string; title: string; links: any[]; }
interface EpisodeItem { url: string; episode: number | null; }

interface Props {
  items: EpisodeItem[];
  token?: string;
  onClose: () => void;
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getEpisodeRange(links: any[]): string {
  const eps = (links || []).map((l: any) => l.episode).filter((e: any) => typeof e === 'number');
  if (eps.length === 0) return 'No episodes';
  const min = Math.min(...eps);
  const max = Math.max(...eps);
  return min === max ? `Ep ${min}` : `Ep ${min}-${max}`;
}

// ─── Custom Styled Dropdown (portal-based, no clipping) ─────────────────────
interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  color?: string;
}

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
}> = ({ value, onChange, options, icon, label, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const maxListHeight = 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < maxListHeight && rect.top > maxListHeight;

    setCoords({
      top: openUpward
        ? rect.top + window.scrollY - maxListHeight - 6
        : rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
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
  }, [isOpen]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={triggerRef} className="relative">
      <label className="block text-xs font-medium text-slate-300 mb-1 flexl items-center gap-1.5">
        {icon}
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full bg-gray-800/60 border text-white rounded-lg px-3 py-2.5 text-sm text-left transition-all flex items-center justify-between gap-2 ${
          isOpen ? 'border-purple-500/60 ring-1 ring-purple-500/30' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selected.color} flex-shrink-0`} />}
          <span className="truncate">{selected?.label || 'Select...'}</span>
        </span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

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
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl shadow-black/50 py-1.5 max-h-72 overflow-y-auto animate-fadeIn [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-600/20 text-purple-200' : 'text-slate-300 hover:bg-gray-700'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${opt.color} flex-shrink-0`} />}
                  <span className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{opt.label}</span>
                    {opt.hint && <span className="text-[11px] text-slate-500 truncate">{opt.hint}</span>}
                  </span>
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

const AddToPageModal: React.FC<Props> = ({ items, token: tokenProp, onClose }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const isBulk = items.length > 1;

  const [episodeNumbers, setEpisodeNumbers] = useState<Record<string, string>>({});
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initNumbers: Record<string, string> = {};
    const initSelected = new Set<string>();
    items.forEach(i => {
      initNumbers[i.url] = i.episode !== null ? String(i.episode) : '';
      if (i.episode !== null) initSelected.add(i.url);
    });
    setEpisodeNumbers(initNumbers);
    setSelectedUrls(initSelected);
  }, [items]);

  const skippedCount = items.filter(i => i.episode === null).length;

  const isItemNumberValid = (url: string) => {
    const v = episodeNumbers[url];
    return v !== undefined && v.trim() !== '' && !isNaN(Number(v));
  };

  const itemsToSubmit = useMemo(
    () =>
      items
        .filter(i => (isBulk ? selectedUrls.has(i.url) : true) && isItemNumberValid(i.url))
        .map(i => ({ url: i.url, episode: Number(episodeNumbers[i.url]) })),
    [items, selectedUrls, episodeNumbers, isBulk]
  );

  const toggleSelect = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const setEpisodeNumber = (url: string, value: string) => {
    setEpisodeNumbers(prev => ({ ...prev, [url]: value }));
  };

  const selectAllEpisodes = () => setSelectedUrls(new Set(items.filter(i => isItemNumberValid(i.url)).map(i => i.url)));
  const clearAllEpisodes = () => setSelectedUrls(new Set());

  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeOption | null>(null);
  const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('new');
  const [newSlug, setNewSlug] = useState('');
  const [includeWatch, setIncludeWatch] = useState(true);
  const [includeDownload, setIncludeDownload] = useState(true);
  const [quality, setQuality] = useState('');
  const [language, setLanguage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/admin/protected/anime-list`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(json => {
        const list = json.data || json;
        if (Array.isArray(list)) setAnimeOptions(list.map((a: any) => ({ _id: a._id, title: a.title, thumbnail: a.thumbnail })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAnime) {
      setExistingPages([]);
      setSelectedPageId('new');
      return;
    }
    setLoadingPages(true);
    const token = resolveToken();
    fetch(`${API_BASE}/download-pages/anime/${selectedAnime._id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a: any, b: any) => a._id.localeCompare(b._id));
          setExistingPages(sorted);
          setSelectedPageId(sorted.length > 0 ? sorted[0]._id : 'new');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPages(false));

    const base = itemsToSubmit;
    const minEp = base.length ? Math.min(...base.map(i => i.episode)) : 1;
    const maxEp = base.length ? Math.max(...base.map(i => i.episode)) : 1;
    const rangeLabel = minEp === maxEp ? `ep-${minEp}` : `eps-${minEp}-${maxEp}`;
    setNewSlug(slugify(`${selectedAnime.title}-${rangeLabel}`));
  }, [selectedAnime]);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!selectedAnime) { setError('Anime select karo'); return; }
    if (!includeWatch && !includeDownload) { setError('Watch ya Download me se kam se kam ek type select karo'); return; }
    if (itemsToSubmit.length === 0) { setError('Kam se kam ek episode select karo aur uska number bharo'); return; }

    const types: ('watch' | 'download')[] = [
      ...(includeWatch ? ['watch' as const] : []),
      ...(includeDownload ? ['download' as const] : []),
    ];

    const newLinks = itemsToSubmit.flatMap(item =>
      types.map(type => ({ episode: item.episode, url: item.url, type, quality, language }))
    );

    setSaving(true);
    try {
      const token = resolveToken();
      if (selectedPageId === 'new') {
        if (!newSlug.trim()) { setError('Slug daalo'); setSaving(false); return; }
        const minEp = Math.min(...itemsToSubmit.map(i => i.episode));
        const res = await fetch(`${API_BASE}/download-pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            animeId: selectedAnime._id,
            slug: newSlug.trim(),
            title: 'Download',
            episodeNumber: minEp,
            links: newLinks,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setSuccess(`Naya page ban gaya — ${newLinks.length} link add ho gaye!`);
      } else {
        const page = existingPages.find(p => p._id === selectedPageId);
        if (!page) throw new Error('Page not found');
        const links = [...(page.links || [])];
        let updatedCount = 0, addedCount = 0;
        newLinks.forEach(nl => {
          const idx = links.findIndex((l: any) => l.episode === nl.episode && l.type === nl.type);
          if (idx >= 0) { links[idx] = { ...links[idx], ...nl }; updatedCount++; }
          else { links.push(nl); addedCount++; }
        });

        const res = await fetch(`${API_BASE}/download-pages/${selectedPageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ links }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setSuccess(`${addedCount} naye link add, ${updatedCount} update ho gaye!`);
      }
    } catch (err: any) {
      setError(err.message || 'Kuch galat ho gaya');
    } finally {
      setSaving(false);
    }
  };

  const pageOptions: SelectOption[] = [
    { value: 'new', label: '+ Naya page banao', color: 'from-purple-500 to-pink-500' },
    ...existingPages.map((p, idx) => ({
      value: p._id,
      label: `Page ${idx + 1} · ${getEpisodeRange(p.links)}`,
      hint: p.slug,
    })),
  ];

  return (
    <div className="mt-3 p-4 sm:p-5 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 space-y-5 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isBulk ? `${items.length} Episodes ko Download Page me Add Karo` : 'Download Page me Link Add Karo'}
          </h4>
          <p className="text-xs text-white/40">Select episodes, anime aur page details</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {/* Episode Selection Section */}
      <div className="space-y-2">
        {isBulk ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-white/40">
                <span className="font-semibold text-white/70">{itemsToSubmit.length}</span> / {items.length} episodes selected
                {skippedCount > 0 && <span className="text-amber-400"> · {skippedCount} need manual number</span>}
              </p>
              <div className="flex gap-2">
                <button onClick={selectAllEpisodes} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors">
                  Select All
                </button>
                <button onClick={clearAllEpisodes} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors">
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map(i => {
                const checked = selectedUrls.has(i.url);
                const numValid = isItemNumberValid(i.url);
                return (
                  <div
                    key={i.url}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
                      checked && numValid
                        ? 'bg-purple-600/20 border-purple-500/40 shadow-sm'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(i.url)}
                      className="w-4 h-4 accent-purple-500 flex-shrink-0 cursor-pointer"
                    />
                    <span className="text-xs text-white/50 font-medium flex-shrink-0">Ep</span>
                    <input
                      type="number"
                      value={episodeNumbers[i.url] ?? ''}
                      onChange={e => setEpisodeNumber(i.url, e.target.value)}
                      placeholder="#"
                      className={`w-16 px-2 py-1 bg-gray-800/80 border rounded-lg text-xs text-white flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                        numValid ? 'border-gray-700' : 'border-rose-500/60'
                      }`}
                    />
                    <span className="text-xs text-white/40 truncate flex-1" title={i.url}>
                      {i.url.split('/').pop()}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">Video URL</p>
              <p className="text-sm text-purple-300 break-all bg-black/30 rounded-lg px-3 py-2">{items[0]?.url}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-white/50">Episode #</span>
              <input
                type="number"
                value={items[0] ? (episodeNumbers[items[0].url] ?? '') : ''}
                onChange={e => items[0] && setEpisodeNumber(items[0].url, e.target.value)}
                placeholder="Enter episode number"
                className="w-28 px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Anime Selection */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1.5 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Anime <span className="text-red-400">*</span>
        </label>
        <SearchableDropdown
          options={animeOptions}
          value={selectedAnime}
          onChange={setSelectedAnime}
          placeholder="Search anime..."
        />
      </div>

      {/* Page Details */}
      {selectedAnime && (
        <>
          <div>
            <CustomSelect
              label="Download Page"
              value={selectedPageId}
              onChange={setSelectedPageId}
              options={pageOptions}
              icon={
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              }
            />
            {loadingPages && <p className="text-xs text-white/40 mt-1">Loading pages...</p>}
          </div>

          {selectedPageId === 'new' && (
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Naya Slug <span className="text-red-400">*</span></label>
              <input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value)}
                placeholder="my-anime-download-page"
                className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Link Types */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-white/60">Link Type</label>
            <div className="flex gap-3 flex-wrap">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border transition-colors ${
                includeWatch ? 'bg-blue-600/20 border-blue-500/40' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}>
                <input
                  type="checkbox"
                  checked={includeWatch}
                  onChange={e => setIncludeWatch(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-white/80">Watch</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border transition-colors ${
                includeDownload ? 'bg-emerald-600/20 border-emerald-500/40' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}>
                <input
                  type="checkbox"
                  checked={includeDownload}
                  onChange={e => setIncludeDownload(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-sm text-white/80">Download</span>
              </label>
            </div>
          </div>

          {/* Quality & Language */}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Quality (optional)"
              value={quality}
              onChange={e => setQuality(e.target.value)}
              className="px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <input
              placeholder="Language (optional)"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !selectedAnime || itemsToSubmit.length === 0}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving...
            </span>
          ) : (
            isBulk ? `Save (${itemsToSubmit.length} ep)` : 'Save'
          )}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AddToPageModal;