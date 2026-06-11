// src/components/admin/PageViewManager.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, ChartTooltip);

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

// ─── Types ────────────────────────────────────────────────────────────────
interface DailyPoint { date: string; views: number }
interface TopPage {
  path: string;
  views: number;
  pageType: string;
  animeTitle?: string;
  slug?: string;
  device?: string; // present only when API returns device-filtered data
}
interface ByType { type: string; views: number }
interface ByDevice { device: string; count: number }

interface Stats {
  totalViews: number;
  todayViews: number;
  uniqueVisitors: number;
  dailyChart: DailyPoint[];
  topPages: TopPage[];
  byType: ByType[];
  byDevice: ByDevice[];
}

// ─── Color map for page types ─────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  'anime-detail': '#a78bfa',
  'download':     '#34d399',
  'anime-list':   '#60a5fa',
  'home':         '#f472b6',
  'episode':      '#fb923c',
  'top-100':      '#facc15',
  'contact':      '#94a3b8',
  'privacy':      '#94a3b8',
  'terms':        '#94a3b8',
  'dmca':         '#94a3b8',
  'earn-money':   '#6ee7b7',
  'other':        '#475569',
};

const DEVICE_COLOR: Record<string, string> = {
  mobile:  '#a78bfa',
  desktop: '#34d399',
  tablet:  '#60a5fa',
  unknown: '#475569',
};

const PAGE_TYPE_LABEL: Record<string, string> = {
  'anime-detail': 'Anime Detail',
  'download':     'Download Page',
  'anime-list':   'Anime List',
  'home':         'Home Page',
  'episode':      'Episode',
  'top-100':      'Top 100',
  'contact':      'Contact',
  'privacy':      'Privacy',
  'terms':        'Terms',
  'dmca':         'DMCA',
  'earn-money':   'Earn Money',
  'other':        'Other',
};

// ─── Google Analytics Style Line Chart ───────────────────────────────────
const GALineChart: React.FC<{ data: DailyPoint[]; days: number; height?: number }> = ({ data, days, height = 220 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // ✅ FIX: Even if data is empty, still render chart with zeros
    const chartData = data.length > 0 ? data : [];

    if (chartData.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(167,139,250,0.22)');
    grad.addColorStop(0.7, 'rgba(167,139,250,0.05)');
    grad.addColorStop(1, 'rgba(167,139,250,0.00)');

    chartRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.date.slice(5)),
        datasets: [
          {
            data: chartData.map(d => d.views),
            borderColor: '#a78bfa',
            borderWidth: 2,
            backgroundColor: grad,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#a78bfa',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: undefined,
        animation: { duration: 400, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1b29',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#9ca3af',
            bodyColor: '#ffffff',
            titleFont: { size: 11 },
            bodyFont: { size: 13, weight: 'bold' as const },
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (item) => `  ${Number(item.raw).toLocaleString()} views`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#6b7280',
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: days <= 7 ? 7 : days <= 14 ? 7 : 8,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: false },
            ticks: {
              color: '#6b7280',
              font: { size: 11 },
              maxTicksLimit: 5,
              precision: 0,
              callback: (v) =>
                Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : v,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, days, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-xs" style={{ height }}>
        No data yet — start getting traffic!
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${height}px` }} />
    </div>
  );
};

// ─── Donut-style ring chart ───────────────────────────────────────────────
const RingChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="text-gray-600 text-xs text-center py-4">No data</p>;

  let offset = 0;
  const R = 36; const C = 2 * Math.PI * R;
  const segments = data.map(d => {
    const dash = (d.value / total) * C;
    const seg = { ...d, dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="w-20 h-20 flex-shrink-0 -rotate-90">
        <circle cx="44" cy="44" r={R} fill="none" stroke="#1f1e2e" strokeWidth="14" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="44" cy="44" r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.offset}
            opacity={0.85}
          />
        ))}
      </svg>
      <div className="flex flex-col gap-1 text-xs flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-gray-400 truncate flex-1">{d.label}</span>
            <span className="text-white font-medium flex-shrink-0">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({
  label, value, sub, color = 'text-purple-400',
}) => (
  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
    <p className={`text-3xl font-semibold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
  </div>
);

// ─── Page detail modal ────────────────────────────────────────────────────
const PageDetailModal: React.FC<{
  page: TopPage;
  token: string;
  onClose: () => void;
}> = ({ page, token, onClose }) => {
  const [detail, setDetail] = useState<{ path: string; total: number; daily: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/analytics/page-detail`, {
        params: { path: page.path, days: 30 },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(r => {
        const data = r.data;
        // ✅ FIX: Normalize daily field — handle both 'daily' and 'dailyChart' keys, and missing/null cases
        const rawDaily = data.daily ?? data.dailyChart ?? [];
        const normalizedDaily: DailyPoint[] = rawDaily.map((d: any) => ({
          date: d.date ?? d.day ?? '',
          views: Number(d.views ?? d.count ?? d.pageViews ?? 0),
        })).filter((d: DailyPoint) => d.date !== '');

        setDetail({ path: data.path ?? page.path, total: data.total ?? 0, daily: normalizedDaily });
      })
      .catch(() => toast.error('Failed to load page detail'))
      .finally(() => setLoading(false));
  }, [page.path]);

  // ✅ Build full URL for the link
  const fullUrl = page.path.startsWith('http') ? page.path : `https://animabingwatch.workers.dev${page.path}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#13121e] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            {/* ✅ FIX: Show clickable link below page title */}
            <p className="text-sm font-semibold text-white truncate">
              {page.animeTitle || PAGE_TYPE_LABEL[page.pageType] || page.pageType}
            </p>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 truncate block mt-0.5 underline underline-offset-2 transition-colors"
              title={fullUrl}
            >
              {page.path}
            </a>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total (30d)" value={detail.total} color="text-purple-400" />
                <StatCard label="Page Type" value={PAGE_TYPE_LABEL[page.pageType] || page.pageType} color="text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-3">Daily views (last 30 days)</p>
                {/* ✅ FIX: Always render GALineChart — it handles empty state internally */}
                <GALineChart
                  data={detail.daily}
                  days={30}
                  height={180}
                />
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────
interface PageViewManagerProps {
  token: string;
}

const PageViewManager: React.FC<PageViewManagerProps> = ({ token }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [selectedPage, setSelectedPage] = useState<TopPage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 15;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { days };
      if (deviceFilter !== 'all') params.device = deviceFilter;

      const { data } = await axios.get(`${API_BASE}/analytics/stats`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(data);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days, token, deviceFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Get unique devices from byDevice data (always from full stats)
  const allDevices = stats?.byDevice?.map(d => d.device) ?? [];

  // ── Filtered pages ──
  const filteredPages = (stats?.topPages || []).filter(p => {
    const matchSearch =
      !search ||
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      (p.animeTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.pageType === typeFilter;
    return matchSearch && matchType;
  });

  const totalPages = Math.ceil(filteredPages.length / PER_PAGE);
  const pagedResults = filteredPages.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const typeChartData = (stats?.byType || []).map(t => ({
    label: PAGE_TYPE_LABEL[t.type] || t.type,
    value: t.views,
    color: TYPE_COLOR[t.type] || '#475569',
  }));

  const deviceChartData = (stats?.byDevice || []).map(d => ({
    label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: d.count,
    color: DEVICE_COLOR[d.device] || '#475569',
  }));

  const allTypes = Array.from(new Set((stats?.topPages || []).map(p => p.pageType)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Loading analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Page View Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track how users engage with every page</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                ${days === d
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
            >
              {d}d
            </button>
          ))}

          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label={`Total Views (${days}d)`}
          value={stats?.totalViews ?? 0}
          sub="All pages combined"
          color="text-purple-400"
        />
        <StatCard
          label="Today's Views"
          value={stats?.todayViews ?? 0}
          sub="Since midnight IST"
          color="text-cyan-400"
        />
        <StatCard
          label="Unique Visitors"
          value={stats?.uniqueVisitors ?? 0}
          sub={`Approx. last ${days} days`}
          color="text-emerald-400"
        />
      </div>

      {/* Chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* GA-style line chart */}
        <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Daily Views — Last {days} Days
            </p>
            {stats?.dailyChart?.length ? (
              <span className="text-[11px] text-gray-600">
                {stats.dailyChart[0]?.date} – {stats.dailyChart[stats.dailyChart.length - 1]?.date}
              </span>
            ) : null}
          </div>
          <div className="flex-1 flex items-stretch">
            <GALineChart data={stats?.dailyChart ?? []} days={days} height={260} />
          </div>
        </div>

        {/* Type + device rings */}
        <div className="space-y-4">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">By Page Type</p>
            <RingChart data={typeChartData} />
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">By Device</p>
            <RingChart data={deviceChartData} />
          </div>
        </div>
      </div>

      {/* Top pages table */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Top Pages</p>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search pages…"
              className="pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 w-44"
            />
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="px-2 py-1.5 text-xs bg-[#1c1b29] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
          >
            <option value="all" className="bg-[#1c1b29] text-gray-300">All Types</option>
            {allTypes.map(t => (
              <option key={t} value={t} className="bg-[#1c1b29] text-gray-300">{PAGE_TYPE_LABEL[t] || t}</option>
            ))}
          </select>

          {/* Device filter */}
          <select
            value={deviceFilter}
            onChange={e => { setDeviceFilter(e.target.value); setCurrentPage(1); }}
            className="px-2 py-1.5 text-xs bg-[#1c1b29] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
          >
            <option value="all" className="bg-[#1c1b29] text-gray-300">All Devices</option>
            {allDevices.map(d => (
              <option key={d} value={d} className="bg-[#1c1b29] text-gray-300">
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>

          <span className="text-[10px] text-gray-600">{filteredPages.length} pages</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-gray-500 font-medium">#</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-gray-500 font-medium">Page</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-gray-500 font-medium hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wide text-gray-500 font-medium">Views</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wide text-gray-500 font-medium hidden md:table-cell">Share</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pagedResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    {search || typeFilter !== 'all' ? 'No matching pages found' : 'No page view data yet'}
                  </td>
                </tr>
              ) : (
                pagedResults.map((page, idx) => {
                  const rank = (currentPage - 1) * PER_PAGE + idx + 1;
                  const activeTotal = (stats?.topPages || []).reduce((s, p) => s + p.views, 0) || 1;
                  const share = ((page.views / activeTotal) * 100).toFixed(1);
                  const barWidth = Math.max((page.views / (stats?.topPages[0]?.views || 1)) * 100, 2);
                  return (
                    <tr
                      key={page.path}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="px-4 py-3 text-gray-600 w-8">{rank}</td>
                      <td className="px-4 py-3 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-medium truncate max-w-xs">
                            {page.animeTitle || page.path}
                          </span>
                          <span className="text-gray-600 truncate max-w-xs text-[10px]">{page.path}</span>
                          {/* Mini bar */}
                          <div className="mt-1 h-1 bg-white/5 rounded-full w-32 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, background: TYPE_COLOR[page.pageType] || '#a78bfa' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            background: (TYPE_COLOR[page.pageType] || '#475569') + '22',
                            color: TYPE_COLOR[page.pageType] || '#94a3b8',
                          }}
                        >
                          {PAGE_TYPE_LABEL[page.pageType] || page.pageType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {page.views.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                        {share}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedPage(page)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-md transition-all"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = start + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 text-xs rounded transition-colors
                      ${page === currentPage
                        ? 'bg-purple-600/40 text-purple-300'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Page detail modal */}
      {selectedPage && (
        <PageDetailModal
          page={selectedPage}
          token={token}
          onClose={() => setSelectedPage(null)}
        />
      )}
    </div>
  );
};

export default PageViewManager;