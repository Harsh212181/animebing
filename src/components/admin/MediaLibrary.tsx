 import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface MediaItem { key: string; size: number; lastModified: string; url: string; hostname: string; }
interface BucketOption { hostname: string; label: string; }
interface Props { token?: string; refreshTrigger?: number; subAdminMode?: boolean; }

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Yahan naye alias add karte raho jab bhi koi show alag naam se split ho raha ho
// Format: 'jo naam dikhta hai (normalized)': 'jis naam se merge karna hai (normalized)'
const TITLE_ALIASES: Record<string, string> = {
  'campfire cooking another world': 'campfire cooking',
};

function resolveAlias(normalized: string): string {
  return TITLE_ALIASES[normalized] || normalized;
}

function pickBetterDisplayName(current: string, candidate: string): string {
  const currentHasSpace = /\s/.test(current);
  const candidateHasSpace = /\s/.test(candidate);
  if (candidateHasSpace && !currentHasSpace) return candidate;
  return current;
}

function stripTags(str: string): string {
  return str
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEpisodeInfo(filename: string): { baseName: string; season: number | null; episode: number | null } {
  const name = stripTags(filename.replace(/\.(mp4|mkv|avi|mov|webm)$/i, ''));

  let baseName = name.trim();
  let season: number | null = null;
  let episode: number | null = null;

  let m = /^(.*?)[\s._-]*S(?:eason)?[\s._-]*(\d{1,2})[\s._-]*E(?:P|p)?[\s._-]*(\d{1,3})/i.exec(name);
  if (m) {
    baseName = m[1].trim().replace(/[\s._-]+$/, '');
    season = parseInt(m[2], 10);
    episode = parseInt(m[3], 10);
  } else {
    m = /^(.*?)[\s._-]*Episode[\s._-]*(\d+)/i.exec(name);
    if (m) {
      baseName = m[1].trim().replace(/[\s._-]+$/, '');
      episode = parseInt(m[2], 10);
    } else {
      m = /^(.*?)[\s._-]*Ep[\s._-]*-?(\d+)/i.exec(name);
      if (m) {
        baseName = m[1].trim().replace(/[\s._-]+$/, '');
        episode = parseInt(m[2], 10);
      } else {
        m = /^(.*?)[\s._-]*E(\d+)(?:[\s._-]|$)/i.exec(name);
        if (m) {
          baseName = m[1].trim().replace(/[\s._-]+$/, '');
          episode = parseInt(m[2], 10);
        }
      }
    }
  }

  if (season === null) {
    const seasonMatch = /^(.*?)[\s._-]*S(?:eason)?[\s._-]*(\d{1,2})$/i.exec(baseName);
    if (seasonMatch) {
      baseName = seasonMatch[1].trim().replace(/[\s._-]+$/, '');
      season = parseInt(seasonMatch[2], 10);
    }
  }

  return { baseName: baseName || name.trim(), season, episode };
}

interface EpisodeRowProps {
  item: MediaItem;
  episode: number | null;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (val: string) => void;
  busyKey: string | null;
  onWatch: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onRenameStart: () => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}

const EpisodeRow: React.FC<EpisodeRowProps> = ({
  item,
  episode,
  isRenaming,
  renameValue,
  setRenameValue,
  busyKey,
  onWatch,
  onDownload,
  onCopy,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onDelete
}) => {
  return (
    <div className="flex items-center justify-between gap-3 p-3 flex-wrap hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {episode !== null && (
            <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-200 border border-purple-500/40 rounded-full font-medium flex-shrink-0">
              Ep {episode}
            </span>
          )}
          {isRenaming ? (
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="flex-1 min-w-[150px] px-2 py-1 bg-gray-900 border border-purple-500/50 rounded text-white text-sm"
              autoFocus
            />
          ) : (
            <p className="text-sm text-white truncate">{item.key}</p>
          )}
        </div>
        <p className="text-xs text-white/40 mt-1">
          {formatSize(item.size)} · {new Date(item.lastModified).toLocaleString()}
        </p>
        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full">
          {item.hostname}
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap flex-shrink-0">
        {isRenaming ? (
          <>
            <button onClick={onRenameConfirm} disabled={busyKey === item.key + 'rename'}
              className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 rounded-lg text-xs font-medium">
              Save
            </button>
            <button onClick={onRenameCancel}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={onWatch} disabled={busyKey === item.key + 'watch'}
              className="px-2.5 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 rounded-lg text-xs font-medium">
              {busyKey === item.key + 'watch' ? '...' : 'Watch'}
            </button>
            <button onClick={onDownload} disabled={busyKey === item.key + 'download'}
              className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 rounded-lg text-xs font-medium">
              {busyKey === item.key + 'download' ? '...' : 'Download'}
            </button>
            <button onClick={onCopy}
              className="px-2.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-medium">
              Copy Link
            </button>
            <button onClick={onRenameStart}
              className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-medium">
              Rename
            </button>
            <button onClick={onDelete} disabled={busyKey === item.key + 'delete'}
              className="px-2.5 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-medium">
              {busyKey === item.key + 'delete' ? '...' : 'Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const MediaLibrary: React.FC<Props> = ({ token: tokenProp, refreshTrigger, subAdminMode = false }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [selectedHostname, setSelectedHostname] = useState('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [markedKeys, setMarkedKeys] = useState<Set<string>>(new Set());
  const [markBusyKey, setMarkBusyKey] = useState<string | null>(null);
  // ✅ teen filter states: 'all' | 'marked' | 'unmarked'
  const [markFilter, setMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/uploads/buckets`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setBuckets(data))
      .catch(() => {});
  }, []);

  const fetchMarks = useCallback(async () => {
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/marks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) setMarkedKeys(new Set(data.map((m: any) => m.groupKey)));
    } catch {
      // marks fail ho jaye to bhi list normally chalti rahe
    }
  }, []);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  const apiCall = async (path: string, method: string, body?: any) => {
    const token = resolveToken();
    const res = await fetch(`${API_BASE}/uploads${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const fetchItems = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/list?hostname=${encodeURIComponent(selectedHostname)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
      else setError(data.error || 'Failed to load');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedHostname]);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshTrigger]);

  const filteredItems = items.filter(i => i.key.toLowerCase().includes(search.toLowerCase()));

  const groupedSeries = useMemo(() => {
    const groups = new Map<string, { groupKey: string; displayBaseName: string; season: number | null; entries: { item: MediaItem; episode: number | null }[] }>();

    filteredItems.forEach(item => {
      const { baseName, season, episode } = parseEpisodeInfo(item.key);
      const normalizedBase = resolveAlias(normalizeKey(baseName));
      const groupKey = `${normalizedBase}::${season ?? 'x'}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { groupKey, displayBaseName: baseName, season, entries: [] });
      } else {
        const g = groups.get(groupKey)!;
        g.displayBaseName = pickBetterDisplayName(g.displayBaseName, baseName);
      }
      groups.get(groupKey)!.entries.push({ item, episode });
    });

    const groupArr = Array.from(groups.values()).map(g => {
      g.entries.sort((a, b) => {
        if (a.episode === null && b.episode === null) return 0;
        if (a.episode === null) return 1;
        if (b.episode === null) return -1;
        return a.episode - b.episode;
      });
      const displayName = (g.season !== null && g.season !== 1) ? `${g.displayBaseName} S${g.season}` : g.displayBaseName;
      const latestUpload = Math.max(...g.entries.map(x => new Date(x.item.lastModified).getTime()));

      // Episode range nikalte hain
      const eps = g.entries.map(e => e.episode).filter((e): e is number => e !== null);
      let epRange = '';
      if (eps.length > 0) {
        const minEp = Math.min(...eps);
        const maxEp = Math.max(...eps);
        epRange = minEp === maxEp ? `Ep ${minEp}` : `Ep ${minEp}-${maxEp}`;
      }

      return { groupKey: g.groupKey, displayName, episodes: g.entries, latestUpload, epRange };
    });

    groupArr.sort((a, b) => b.latestUpload - a.latestUpload);
    return groupArr;
  }, [filteredItems]);

  // ✅ filtered groups according to markFilter
  const filteredGroups = useMemo(() => {
    if (markFilter === 'all') return groupedSeries;
    if (markFilter === 'marked') return groupedSeries.filter(g => markedKeys.has(g.groupKey));
    if (markFilter === 'unmarked') return groupedSeries.filter(g => !markedKeys.has(g.groupKey));
    return groupedSeries;
  }, [groupedSeries, markedKeys, markFilter]);

  const handleWatchOrDownload = async (item: MediaItem, mode: 'watch' | 'download') => {
    setBusyKey(item.key + mode);
    try {
      const { url } = await apiCall('/preview-url', 'POST', { hostname: item.hostname, key: item.key, mode });
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to generate link');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopyLink = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`"${item.key}" permanently delete karna hai?`)) return;
    setBusyKey(item.key + 'delete');
    try {
      await apiCall(`/object?hostname=${encodeURIComponent(item.hostname)}&key=${encodeURIComponent(item.key)}`, 'DELETE');
      setItems(prev => prev.filter(i => !(i.key === item.key && i.hostname === item.hostname)));
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setBusyKey(null);
    }
  };

  const startRename = (item: MediaItem) => {
    setRenamingKey(item.key);
    setRenameValue(item.key);
  };

  const confirmRename = async (item: MediaItem) => {
    if (!renameValue.trim() || renameValue === item.key) {
      setRenamingKey(null);
      return;
    }
    setBusyKey(item.key + 'rename');
    try {
      const { url } = await apiCall('/rename', 'POST', { hostname: item.hostname, oldKey: item.key, newKey: renameValue.trim() });
      setItems(prev => prev.map(i =>
        (i.key === item.key && i.hostname === item.hostname)
          ? { ...i, key: renameValue.trim(), url }
          : i
      ));
      setRenamingKey(null);
    } catch (err: any) {
      alert(err.message || 'Rename failed');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleMark = async (groupKey: string, displayName: string) => {
    const token = resolveToken();
    const isMarked = markedKeys.has(groupKey);
    setMarkBusyKey(groupKey);
    try {
      if (isMarked) {
        await fetch(`${API_BASE}/uploads/mark?groupKey=${encodeURIComponent(groupKey)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setMarkedKeys(prev => {
          const next = new Set(prev);
          next.delete(groupKey);
          return next;
        });
      } else {
        await fetch(`${API_BASE}/uploads/mark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ groupKey, displayName }),
        });
        setMarkedKeys(prev => new Set(prev).add(groupKey));
      }
    } catch {
      alert('Mark update fail ho gaya, dobara try karo');
    } finally {
      setMarkBusyKey(null);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-purple-400 rounded-full"></span>
          Uploaded Videos ({filteredItems.length})
        </h3>
        <div className="flex gap-2 flex-wrap items-center">
          {/* ✅ teen filter buttons */}
          <div className="flex bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setMarkFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                markFilter === 'all' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMarkFilter('marked')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                markFilter === 'marked' ? 'bg-amber-500/30 text-amber-200' : 'text-white/60 hover:text-white'
              }`}
            >
              ⭐ Marked
            </button>
            <button
              onClick={() => setMarkFilter('unmarked')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                markFilter === 'unmarked' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              ☆ Unmarked
            </button>
          </div>

          <button onClick={fetchItems} disabled={loading} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedHostname}
          onChange={e => setSelectedHostname(e.target.value)}
          className="px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm sm:w-64"
        >
          <option value="all">All Buckets</option>
          {buckets.map(b => <option key={b.hostname} value={b.hostname}>{b.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filename se search karo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm placeholder-gray-500"
        />
      </div>

      {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm">{error}</div>}

      <div className="space-y-4 max-h-[650px] overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="text-white/40 text-center py-6">Loading...</p>
        ) : filteredGroups.length === 0 ? (
          <p className="text-white/40 text-center py-6">
            {markFilter === 'marked' ? 'Koi marked show nahi hai.' : markFilter === 'unmarked' ? 'Sab shows marked hain.' : 'Koi video nahi mila.'}
          </p>
        ) : (
          filteredGroups.map(group => renderGroupCard(group))
        )}
      </div>
    </div>
  );

  function renderGroupCard(group: typeof groupedSeries[number]) {
    const isExpanded = expandedGroups.has(group.groupKey);
    const isMarked = markedKeys.has(group.groupKey);
    return (
      <div key={group.groupKey} className="border border-white/5 rounded-xl overflow-hidden">
        <div className="w-full flex items-center bg-white/[0.04] border-b border-white/5">
          <button onClick={() => toggleGroup(group.groupKey)}
            className="flex-1 min-w-0 hover:bg-white/[0.05] px-3 py-2.5 flex items-center justify-between transition-colors text-left">
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-semibold text-purple-300 truncate">{group.displayName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {group.epRange && (
                  <span className="text-[10px] px-2 py-0.5 bg-purple-600/30 text-purple-200 border border-purple-500/40 rounded-full font-medium">
                    {group.epRange}
                  </span>
                )}
                <span className="text-[10px] text-white/40">
                  {group.episodes.length} episode{group.episodes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <svg className={`w-4 h-4 text-white/50 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => toggleMark(group.groupKey, group.displayName)}
            disabled={markBusyKey === group.groupKey}
            title={isMarked ? 'Unmark' : 'Mark'}
            className={`px-3 py-2.5 flex-shrink-0 text-lg transition-all ${
              isMarked
                ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
                : 'text-white/25 hover:text-white/60'
            }`}
          >
            {markBusyKey === group.groupKey ? '···' : isMarked ? '★' : '☆'}
          </button>
        </div>

        {isExpanded && (
          <div className="divide-y divide-white/5">
            {group.episodes.map(({ item, episode }) => (
              <EpisodeRow
                key={`${item.hostname}-${item.key}`}
                item={item}
                episode={episode}
                isRenaming={renamingKey === item.key}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                busyKey={busyKey}
                onWatch={() => handleWatchOrDownload(item, 'watch')}
                onDownload={() => handleWatchOrDownload(item, 'download')}
                onCopy={() => handleCopyLink(item)}
                onRenameStart={() => startRename(item)}
                onRenameConfirm={() => confirmRename(item)}
                onRenameCancel={() => setRenamingKey(null)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
};

export default MediaLibrary;