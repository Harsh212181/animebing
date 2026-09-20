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
  subAdminUsername?: string | null;
}

interface Stats {
  totalWatch: number;
  totalDownload: number;
  uniqueViewers: number;
  totalWatchTimeSec: number;
  topAnime: { _id: string; title?: string; count: number; totalWatchSec: number }[];
  topDownloads: { _id: string; title?: string; count: number }[];
}

interface SubAdminOption {
  _id: string;
  username: string;
  fullName?: string;
}

const formatDuration = (sec: number = 0): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

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
  badge: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  filter: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-5.586L3.293 6.707A1 1 0 013 6V4z',
  trending: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  chevronDown: 'M19 9l-7 7-7-7',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  arrowLeft: 'M15 19l-7-7 7-7',
  arrowRight: 'M9 5l7 7-7 7',
};

interface UserActivityManagerProps {
  token?: string;
  subAdminMode?: boolean;
}

type RangeFilter = 'all' | 'today' | 'week' | 'month';

const UserActivityManager: React.FC<UserActivityManagerProps> = ({ token: tokenProp, subAdminMode = false }) => {
  const resolveToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'watch' | 'download'>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const [subAdminFilter, setSubAdminFilter] = useState('all');
  const [subAdminList, setSubAdminList] = useState<SubAdminOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (subAdminMode) return;
    (async () => {
      try {
        const token = resolveToken();
        const res = await fetch(`${API_BASE}/sub-admin`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) setSubAdminList(data.data || []);
      } catch (err) {
        console.error('Failed to fetch sub-admin list:', err);
      }
    })();
  }, [subAdminMode]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const token = resolveToken();
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (typeFilter !== 'all') params.set('activityType', typeFilter);
      if (rangeFilter !== 'all') params.set('range', rangeFilter);
      if (!subAdminMode && subAdminFilter !== 'all') params.set('subAdminId', subAdminFilter);

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
      if (!subAdminMode && subAdminFilter !== 'all') params.set('subAdminId', subAdminFilter);

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
  }, [rangeFilter, subAdminFilter]);

  useEffect(() => {
    fetchActivities();
  }, [typeFilter, rangeFilter, subAdminFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statCards = stats ? [
    { label: 'Total Watches',   value: stats.totalWatch.toLocaleString(), icon: ICONS.eye,      accent: 'text-sky-300',     iconBg: 'bg-sky-500/15',     ring: 'group-hover:border-sky-500/30',     live: true },
    { label: 'Downloads',       value: stats.totalDownload.toLocaleString(), icon: ICONS.download, accent: 'text-emerald-300', iconBg: 'bg-emerald-500/15', ring: 'group-hover:border-emerald-500/30' },
    { label: 'Unique Viewers',  value: stats.uniqueViewers.toLocaleString(), icon: ICONS.users,   accent: 'text-purple-300',  iconBg: 'bg-purple-500/15',  ring: 'group-hover:border-purple-500/30' },
    { label: 'Watch Time',      value: formatDuration(stats.totalWatchTimeSec), icon: ICONS.clock, accent: 'text-pink-300',   iconBg: 'bg-pink-500/15',    ring: 'group-hover:border-pink-500/30' },
  ] : [];

  return (
    <div className="p-3 sm:p-6 space-y-6 min-h-screen bg-[#0b0a14] text-white">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 shadow-lg shadow-purple-500/10">
          <SvgIcon d={ICONS.activity} className="w-6 h-6 sm:w-7 sm:h-7 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            User Activity
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Monitor watch and download actions in real-time</p>
        </div>
        {!subAdminMode && subAdminList.length > 0 && (
          <div className="relative">
            <select
              value={subAdminFilter}
              onChange={e => { setSubAdminFilter(e.target.value); setPage(1); }}
              className="appearance-none pl-9 pr-8 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-white/80 outline-none cursor-pointer transition-all hover:bg-white/[0.08] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all" className="bg-slate-900">All Users</option>
              {subAdminList.map(sa => (
                <option key={sa._id} value={sa._id} className="bg-slate-900">
                  {sa.fullName || sa.username}
                </option>
              ))}
            </select>
            <SvgIcon d={ICONS.users} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
            <SvgIcon d={ICONS.chevronDown} className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>
        )}
      </div>

      {/* ─── Filter Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3">
        {/* Time Range Segmented Control */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-1">
            <SvgIcon d={ICONS.calendar} className="w-3 h-3" />
            Range
          </span>
          <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
            {([
              { value: 'all', label: 'All' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ] as const).map(r => (
              <button
                key={r.value}
                onClick={() => { setRangeFilter(r.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                  rangeFilter === r.value
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-white/[0.08] hidden sm:block" />

        {/* Type Filter Segmented Control */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-1">
            <SvgIcon d={ICONS.filter} className="w-3 h-3" />
            Type
          </span>
          <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
            {([
              { value: 'all', label: 'All', icon: null },
              { value: 'watch', label: 'Watching', icon: ICONS.eye },
              { value: 'download', label: 'Downloads', icon: ICONS.download },
            ] as const).map(t => (
              <button
                key={t.value}
                onClick={() => { setTypeFilter(t.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  typeFilter === t.value
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {t.icon && <SvgIcon d={t.icon} className="w-3 h-3" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {total > 0 && (
          <span className="ml-auto text-[11px] text-gray-500 font-medium">
            {total.toLocaleString()} total entries
          </span>
        )}
      </div>

      {/* ─── Stats Cards ────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ label, value, icon, accent, iconBg, ring, live }) => (
            <div
              key={label}
              className={`group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 transition-all duration-300 hover:bg-white/[0.05] ${ring}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl ${iconBg}`}>
                  <SvgIcon d={icon} className={`w-4 h-4 ${accent}`} />
                </div>
                {live && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className={`text-xl sm:text-2xl font-bold tracking-tight ${accent}`}>{value}</p>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Top Watched & Downloaded ──────────────────────── */}
      {stats && (stats.topAnime?.length > 0 || stats.topDownloads?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {stats.topAnime && stats.topAnime.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-yellow-500/15">
                    <SvgIcon d={ICONS.star} className="w-3.5 h-3.5 text-yellow-300" />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Top Watched</h2>
                </div>
                <span className="text-[10px] text-gray-500">by views</span>
              </div>
              <div className="space-y-2.5">
                {stats.topAnime.map((a, i) => {
                  const pct = Math.min(100, (a.count / stats.topAnime[0].count) * 100);
                  const rankStyle = i === 0 ? 'from-yellow-500/20 to-yellow-500/5 text-yellow-300 border-yellow-500/25'
                    : i === 1 ? 'from-slate-400/20 to-slate-400/5 text-slate-200 border-slate-400/25'
                    : i === 2 ? 'from-amber-600/20 to-amber-600/5 text-amber-400 border-amber-600/25'
                    : 'from-white/5 to-white/[0.02] text-gray-400 border-white/10';
                  return (
                    <div key={a._id} className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold border bg-gradient-to-br ${rankStyle}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-medium text-white/90 truncate">{a.title || 'Unknown'}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-bold text-purple-300">{a.count}</span>
                            <span className="text-[10px] text-gray-500">{formatDuration(a.totalWatchSec)}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.topDownloads && stats.topDownloads.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15">
                    <SvgIcon d={ICONS.trending} className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Top Downloaded</h2>
                </div>
                <span className="text-[10px] text-gray-500">by downloads</span>
              </div>
              <div className="space-y-2.5">
                {stats.topDownloads.map((a, i) => {
                  const pct = Math.min(100, (a.count / stats.topDownloads[0].count) * 100);
                  const rankStyle = i === 0 ? 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/25'
                    : i === 1 ? 'from-slate-400/20 to-slate-400/5 text-slate-200 border-slate-400/25'
                    : i === 2 ? 'from-amber-600/20 to-amber-600/5 text-amber-400 border-amber-600/25'
                    : 'from-white/5 to-white/[0.02] text-gray-400 border-white/10';
                  return (
                    <div key={a._id} className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold border bg-gradient-to-br ${rankStyle}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-medium text-white/90 truncate">{a.title || 'Unknown'}</p>
                          <span className="text-[11px] font-bold text-emerald-300 flex-shrink-0">{a.count}</span>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Activity Table ─────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/[0.06] text-left text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3 font-semibold">Date / Time</th>
                  <th className="px-4 py-3 font-semibold">Anime</th>
                  <th className="px-4 py-3 font-semibold">Ep</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  {!subAdminMode && <th className="px-4 py-3 font-semibold">Added By</th>}
                  <th className="px-4 py-3 font-semibold">Device</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={subAdminMode ? 8 : 9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                          <SvgIcon d={ICONS.eye} className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">No activity recorded yet</p>
                        <p className="text-[10px] text-gray-600">Try changing filters or check back later</p>
                      </div>
                    </td>
                  </tr>
                ) : activities.map(a => (
                  <tr key={a._id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-400 text-[11px]">
                      {new Date(a.startedAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-white/90">{a.animeTitle || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{a.episodeNumber ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                        a.activityType === 'watch'
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                      }`}>
                        <SvgIcon d={a.activityType === 'watch' ? ICONS.eye : ICONS.download} className="w-2.5 h-2.5" />
                        {a.activityType === 'watch' ? 'Watch' : 'DL'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {a.activityType === 'watch' ? formatDuration(a.watchDurationSec) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500">{a.ip}</td>
                    {!subAdminMode && (
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                          <SvgIcon d={ICONS.badge} className="w-2.5 h-2.5" />
                          {a.subAdminUsername || 'Admin'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-gray-400">
                      {a.device ? (
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <SvgIcon d={
                            a.device.toLowerCase().includes('mobile') || a.device.toLowerCase().includes('tablet')
                              ? ICONS.mobile : ICONS.desktop
                          } className="w-3 h-3 text-gray-500" />
                          {a.device}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {a.country ? (
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <SvgIcon d={ICONS.globe} className="w-3 h-3 text-gray-500" />
                          {a.country}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-t border-white/[0.06]">
              <div className="text-[11px] text-gray-500">
                Page <span className="text-white font-semibold">{page}</span> of {totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] text-gray-300 text-[11px] font-medium hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/[0.06]"
                >
                  <SvgIcon d={ICONS.arrowLeft} className="w-3 h-3" />
                  Prev
                </button>
                <span className="text-[11px] text-white/60 px-2 font-mono">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] text-gray-300 text-[11px] font-medium hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/[0.06]"
                >
                  Next
                  <SvgIcon d={ICONS.arrowRight} className="w-3 h-3" />
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