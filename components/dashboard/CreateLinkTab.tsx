import React, { useState, useEffect } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';
const ANIME_API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/anime';

interface AnimeItem { _id: string; title: string; slug?: string; }

const CreateLinkTab: React.FC<{ token: string; onRefresh: () => void; onToast: any; existingLinksCount: number }> = ({
  token, onRefresh, onToast,
}) => {
  const [animeList, setAnimeList]         = useState<AnimeItem[]>([]);
  const [animeSearch, setAnimeSearch]     = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [creating, setCreating]           = useState(false);
  const [fetchingAnime, setFetchingAnime] = useState(false);
  const [animeFetchError, setAnimeFetchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [displayCount, setDisplayCount]   = useState(30);

  useEffect(() => {
    const fetchAnime = async () => {
      setFetchingAnime(true); setAnimeFetchError(null);
      try {
        const res = await fetch(`${ANIME_API_BASE}?limit=1000`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) setAnimeList(json.data);
        else throw new Error('Invalid response format');
      } catch { setAnimeFetchError('Could not load anime list. Please refresh.'); }
      finally { setFetchingAnime(false); }
    };
    fetchAnime();
  }, []);

  const filteredAnime = animeSearch.trim()
    ? animeList.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase()))
    : animeList.slice(0, displayCount);

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (animeSearch.trim()) return;
    if (e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 40)
      setDisplayCount(prev => prev + 30);
  };

  const handleSelect = (anime: AnimeItem) => {
    setSelectedAnime(anime);
    setAnimeSearch('');
    setShowDropdown(false);
    setDisplayCount(30);
  };

  const handleClearSelection = () => {
    setSelectedAnime(null);
    setAnimeSearch('');
  };

  const handleCreateLink = async () => {
    if (!selectedAnime) { onToast('Please select an anime first.', 'error'); return; }
    setCreating(true);
    try {
      const payload = {
        animeId: selectedAnime._id,
        animeTitle: selectedAnime.title,
        animeSlug: selectedAnime.slug || selectedAnime.title.replace(/\s+/g, '-').toLowerCase(),
        label: selectedAnime.title,
      };
      const res = await fetch(`${API_BASE}/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Failed to create link', 'error'); return; }
      onToast(data.message || 'Link created successfully!', 'success');
      setSelectedAnime(null);
      setAnimeSearch('');
      setShowDropdown(false);
      setDisplayCount(30);
      onRefresh();
    } catch { onToast('Network error', 'error'); }
    finally { setCreating(false); }
  };

  return (
    <div className="w-full max-w-none bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header – larger on PC */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800">Create Short Link</p>
          <p className="text-sm text-gray-400">Select an anime and generate your short link</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Anime Select – full width input */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Select Anime
          </p>

          {!selectedAnime ? (
            <div className="relative">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search anime title…"
                  value={animeSearch}
                  onChange={e => { setAnimeSearch(e.target.value); setDisplayCount(30); if (!showDropdown) setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-12 py-3.5 text-base text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                />
                {fetchingAnime && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {showDropdown && !animeFetchError && (
                <div
                  className="absolute z-10 mt-2 w-full max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                  onScroll={handleDropdownScroll}
                >
                  {filteredAnime.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No anime found</p>
                  ) : (
                    filteredAnime.map(anime => (
                      <button
                        key={anime._id}
                        onMouseDown={() => handleSelect(anime)}
                        className="w-full text-left px-5 py-3.5 text-base text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        {anime.title}
                      </button>
                    ))
                  )}
                  {!animeSearch.trim() && displayCount < animeList.length && (
                    <div className="py-2 text-center text-xs text-gray-400 border-t border-gray-100">
                      Scroll for more ({animeList.length - displayCount} remaining)
                    </div>
                  )}
                </div>
              )}

              {animeFetchError && (
                <p className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-500">
                  {animeFetchError}
                </p>
              )}
            </div>
          ) : (
            /* Selected anime chip – more spacious */
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-indigo-500 mb-0.5">Selected anime</p>
                  <p className="text-base font-medium text-indigo-800 truncate">{selectedAnime.title}</p>
                </div>
              </div>
              <button
                onClick={handleClearSelection}
                className="shrink-0 ml-4 rounded-md p-2 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                title="Change anime"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Create Button – aligned with larger controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <p className="text-sm text-gray-400">
            After creation, link appears in <span className="font-medium text-gray-500">My Links</span> tab.
          </p>
          <button
            onClick={handleCreateLink}
            disabled={creating || !selectedAnime}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            {creating ? 'Creating…' : 'Create Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateLinkTab;