 import React, { useEffect, useState } from 'react';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Activity {
  _id: string;
  animeId: string;
  animeTitle?: string;
  episodeNumber?: number;
  activityType: 'watch' | 'download';
  ip: string;
  device?: string;
  country?: string;
  watchDurationSec?: number;
  startedAt: string;
}

interface Stats {
  totalWatch: number;
  totalDownload: number;
  uniqueViewers: number;
  totalWatchTimeSec: number;
  topAnime: { _id: string; title?: string; count: number; totalWatchSec: number }[];
  topDownloads: { _id: string; title?: string; count: number }[];
}

const formatDuration = (sec: number = 0): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// Custom SVG icon component
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// Icon paths
const ICONS = {
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  mobile: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  desktop: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  globe: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.197-1.539-1.118l1.286-3.96a1 1 0 00-.363-1.117L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

interface UserActivityManagerProps {
  token?: string;
}

type RangeFilter = 'all' | 'today' | 'week' | 'month';

const UserActivityManager: React.FC<UserActivityManagerProps> = ({ token: tokenProp }) => {
  const resolveToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'watch' | 'download'>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const token = resolveToken();
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (typeFilter !== 'all') params.set('activityType', typeFilter);
      if (rangeFilter !== 'all') params.set('range', rangeFilter);

      const res = await fetch(`${API_BASE}/watch-activity?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setActivities(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = resolveToken();
      const params = new URLSearchParams();
      if (rangeFilter !== 'all') params.set('range', rangeFilter);

      const res = await fetch(`${API_BASE}/watch-activity/stats?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [rangeFilter]);

  useEffect(() => {
    fetchActivities();
  }, [typeFilter, rangeFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 sm:p-8 space-y-8 min-h-screen bg-gradient-to-br from-[#0f0e17] via-[#1a1829] to-[#0f0e17] text-white">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="p-3 bg-gradient-to-br from-purple-500/30 to-pink-500/20 rounded-2xl shadow-lg shadow-purple-500/20">
          <SvgIcon d={ICONS.eye} className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300">
            User Activity
          </h1>
          <p className="text-sm text-gray-400 mt-1">Monitor watch and download actions in real-time</p>
        </div>
      </div>

      {/* Range Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Time Range:</span>
        {([
          { value: 'all', label: 'All Time' },
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
        ] as const).map(r => (
          <button
            key={r.value}
            onClick={() => {
              setRangeFilter(r.value);
              setPage(1);
            }}
            className={`relative px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2
              ${rangeFilter === r.value
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
          >
            <SvgIcon d={ICONS.calendar} className="w-4 h-4" />
            <span>{r.label}</span>
            {rangeFilter === r.value && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-purple-600" />
            )}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Watches */}
          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl">
                  <SvgIcon d={ICONS.eye} className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-gray-400">Total Watches</p>
              </div>
              <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">live</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-blue-300">{stats.totalWatch.toLocaleString()}</p>
          </div>

          {/* Total Downloads */}
          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                  <SvgIcon d={ICONS.download} className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm text-gray-400">Total Downloads</p>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-emerald-300">{stats.totalDownload.toLocaleString()}</p>
          </div>

          {/* Unique Viewers */}
          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 rounded-xl">
                  <SvgIcon d={ICONS.users} className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-gray-400">Unique Viewers</p>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-purple-300">{stats.uniqueViewers.toLocaleString()}</p>
          </div>

          {/* Total Watch Time */}
          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-pink-500/20 rounded-xl">
                  <SvgIcon d={ICONS.clock} className="w-6 h-6 text-pink-400" />
                </div>
                <p className="text-sm text-gray-400">Watch Time</p>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-pink-300">{formatDuration(stats.totalWatchTimeSec)}</p>
          </div>
        </div>
      )}

      {/* Top Watched & Downloaded Anime Side by Side */}
      {stats && (stats.topAnime?.length > 0 || stats.topDownloads?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stats.topAnime && stats.topAnime.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.05] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-5">
                <SvgIcon d={ICONS.star} className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white/90">Top Watched Anime</h2>
              </div>
              <div className="space-y-3">
                {stats.topAnime.map((a, i) => (
                  <div key={a._id} className="flex items-center justify-between gap-4 group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-yellow-400/20 text-yellow-300' :
                        i === 1 ? 'bg-gray-300/20 text-gray-200' :
                        i === 2 ? 'bg-amber-600/20 text-amber-500' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/80 truncate">{a.title || 'Unknown'}</p>
                        <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (a.count / stats.topAnime[0].count) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white/80">{a.count} views</p>
                      <p className="text-xs text-gray-500">{formatDuration(a.totalWatchSec)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.topDownloads && stats.topDownloads.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.05] transition-colors duration-300">
              <div className="flex items-center gap-2 mb-5">
                <SvgIcon d={ICONS.download} className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white/90">Top Downloaded Anime</h2>
              </div>
              <div className="space-y-3">
                {stats.topDownloads.map((a, i) => (
                  <div key={a._id} className="flex items-center justify-between gap-4 group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-emerald-400/20 text-emerald-300' :
                        i === 1 ? 'bg-gray-300/20 text-gray-200' :
                        i === 2 ? 'bg-amber-600/20 text-amber-500' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/80 truncate">{a.title || 'Unknown'}</p>
                        <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (a.count / stats.topDownloads[0].count) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white/80">{a.count} downloads</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Type Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Filter:</span>
        {(['all', 'watch', 'download'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`relative px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2
              ${typeFilter === t 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105' 
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
          >
            {t === 'watch' && <SvgIcon d={ICONS.eye} className="w-4 h-4" />}
            {t === 'download' && <SvgIcon d={ICONS.download} className="w-4 h-4" />}
            <span>{t === 'all' ? 'All Activity' : t === 'watch' ? 'Watching' : 'Downloads'}</span>
            {typeFilter === t && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-purple-600" />
            )}
          </button>
        ))}
      </div>

      {/* Activities Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.05] text-left text-gray-300 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3.5 font-medium">Date / Time</th>
                  <th className="px-4 py-3.5 font-medium">Anime</th>
                  <th className="px-4 py-3.5 font-medium">Episode</th>
                  <th className="px-4 py-3.5 font-medium">Type</th>
                  <th className="px-4 py-3.5 font-medium">Duration</th>
                  <th className="px-4 py-3.5 font-medium">IP Address</th>
                  <th className="px-4 py-3.5 font-medium">Device</th>
                  <th className="px-4 py-3.5 font-medium">Country</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <SvgIcon d={ICONS.eye} className="w-12 h-12 text-gray-600" />
                        <p className="text-gray-500">No activity recorded yet</p>
                      </div>
                    </td>
                  </tr>
                ) : activities.map(a => (
                  <tr key={a._id} className="border-b border-white/5 hover:bg-white/[0.05] transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                      {new Date(a.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white/80">{a.animeTitle || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{a.episodeNumber ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        a.activityType === 'watch' 
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                          : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {a.activityType === 'watch' ? (
                          <SvgIcon d={ICONS.eye} className="w-3 h-3" />
                        ) : (
                          <SvgIcon d={ICONS.download} className="w-3 h-3" />
                        )}
                        {a.activityType === 'watch' ? 'Watch' : 'Download'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {a.activityType === 'watch' ? formatDuration(a.watchDurationSec) : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{a.ip}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {a.device ? (
                        <span className="flex items-center gap-1.5">
                          <SvgIcon d={
                            a.device.toLowerCase().includes('mobile') ? ICONS.mobile :
                            a.device.toLowerCase().includes('tablet') ? ICONS.mobile :
                            ICONS.desktop
                          } className="w-4 h-4" />
                          {a.device}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {a.country ? (
                        <span className="flex items-center gap-1.5">
                          <SvgIcon d={ICONS.globe} className="w-4 h-4" />
                          {a.country}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-t border-white/10">
              <div className="text-xs text-gray-500">
                Showing page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-white/60 px-2">{page}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserActivityManager;