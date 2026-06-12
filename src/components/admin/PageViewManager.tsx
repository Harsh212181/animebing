 // src/components/admin/PageViewManager.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
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

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── Country code → name map (partial, common ones) ──────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', JP: 'Japan',
  DE: 'Germany', FR: 'France', CA: 'Canada', AU: 'Australia', BR: 'Brazil',
  CN: 'China', RU: 'Russia', KR: 'South Korea', PH: 'Philippines',
  ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore', TH: 'Thailand',
  BD: 'Bangladesh', PK: 'Pakistan', NP: 'Nepal', LK: 'Sri Lanka',
  NG: 'Nigeria', ZA: 'South Africa', MX: 'Mexico', AR: 'Argentina',
  EG: 'Egypt', SA: 'Saudi Arabia', AE: 'UAE', TR: 'Turkey', IT: 'Italy',
  ES: 'Spain', NL: 'Netherlands', PL: 'Poland', SE: 'Sweden', NO: 'Norway',
  UA: 'Ukraine', VN: 'Vietnam', MM: 'Myanmar', KH: 'Cambodia',
  AF: 'Afghanistan', IQ: 'Iraq', IR: 'Iran', IL: 'Israel', JO: 'Jordan',
};

// numeric ISO → alpha-2 (subset used by world-atlas) — NO DUPLICATES
const NUM_TO_ALPHA2: Record<string, string> = {
  '356': 'IN','840': 'US','826': 'GB','392': 'JP','276': 'DE','250': 'FR',
  '124': 'CA','036': 'AU','076': 'BR','156': 'CN','643': 'RU','410': 'KR',
  '608': 'PH','360': 'ID','458': 'MY','702': 'SG','764': 'TH','050': 'BD',
  '586': 'PK','524': 'NP','144': 'LK','566': 'NG','710': 'ZA','484': 'MX',
  '032': 'AR','818': 'EG','682': 'SA','784': 'AE','792': 'TR','380': 'IT',
  '724': 'ES','528': 'NL','616': 'PL','752': 'SE','578': 'NO','804': 'UA',
  '704': 'VN','104': 'MM','116': 'KH','004': 'AF','368': 'IQ','364': 'IR',
  '376': 'IL','400': 'JO','056': 'BE','203': 'CZ','348': 'HU',
  '620': 'PT','040': 'AT','756': 'CH','300': 'GR','642': 'RO','100': 'BG',
  '191': 'HR','688': 'RS','703': 'SK','705': 'SI','233': 'EE','428': 'LV',
  '440': 'LT','246': 'FI','208': 'DK','372': 'IE','196': 'CY','470': 'MT',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface DailyPoint { date: string; views: number }
interface TopPage {
  path: string; views: number; pageType: string;
  animeTitle?: string; slug?: string; device?: string;
}
interface ByType { type: string; views: number }
interface ByDevice { device: string; count: number }
interface ByCountry { country: string; views: number }

interface Stats {
  totalViews: number; todayViews: number; uniqueVisitors: number;
  dailyChart: DailyPoint[]; topPages: TopPage[];
  byType: ByType[]; byDevice: ByDevice[];
  allTimeTotalViews: number; allTimeUniqueVisitors: number;
  last7DaysUniqueVisitors: number; todayUniqueVisitors?: number;
  byCountry?: ByCountry[];
}

interface GeoDetail {
  country: string; totalViews: number; uniqueVisitors: number;
  cities: { city: string; region: string; views: number; uniqueVisitors: number }[];
}

// ─── Color maps ───────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  'anime-detail': '#a78bfa', 'download': '#34d399', 'anime-list': '#60a5fa',
  'home': '#f472b6', 'episode': '#fb923c', 'top-100': '#facc15',
  'contact': '#94a3b8', 'privacy': '#94a3b8', 'terms': '#94a3b8',
  'dmca': '#94a3b8', 'earn-money': '#6ee7b7', 'other': '#475569',
};
const DEVICE_COLOR: Record<string, string> = {
  mobile: '#a78bfa', desktop: '#34d399', tablet: '#60a5fa', unknown: '#475569',
};
const PAGE_TYPE_LABEL: Record<string, string> = {
  'anime-detail': 'Anime Detail', 'download': 'Download Page', 'anime-list': 'Anime List',
  'home': 'Home Page', 'episode': 'Episode', 'top-100': 'Top 100',
  'contact': 'Contact', 'privacy': 'Privacy', 'terms': 'Terms',
  'dmca': 'DMCA', 'earn-money': 'Earn Money', 'other': 'Other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function viewsToColor(views: number, maxViews: number): string {
  if (!views || !maxViews) return '#1a1930';
  const intensity = Math.pow(views / maxViews, 0.4);
  const r = Math.round(60 + intensity * 107);
  const g = Math.round(26 + intensity * 13);
  const b = Math.round(100 + intensity * 150);
  return `rgb(${r},${g},${b})`;
}

// ─── World Map Component ──────────────────────────────────────────────────
interface WorldMapProps {
  byCountry: ByCountry[];
  token: string;
  days: number;
}

const WorldMap: React.FC<WorldMapProps> = ({ byCountry, token, days }) => {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([20, 10]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [geoDetail, setGeoDetail] = useState<GeoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const countryMap = new Map(byCountry.map(c => [c.country, c.views]));
  const maxViews = Math.max(...byCountry.map(c => c.views), 1);
  const totalViews = byCountry.reduce((s, c) => s + c.views, 0) || 1;

  const handleCountryClick = async (alpha2: string) => {
    if (!alpha2) return;
    setSelectedCountry(alpha2);
    setDetailLoading(true);
    setGeoDetail(null);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/geo-detail`, {
        params: { country: alpha2, days },
        headers: { Authorization: `Bearer ${token}` },
      });
      setGeoDetail(data);
    } catch {
      toast.error('Failed to load country detail');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Visitors by Country
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {byCountry.length} countries · Click a country for details
          </p>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.min(z * 1.5, 12))}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center text-sm font-bold transition-colors"
          >+</button>
          <button
            onClick={() => setZoom(z => Math.max(z / 1.5, 1))}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center text-sm font-bold transition-colors"
          >−</button>
          <button
            onClick={() => { setZoom(1); setCenter([20, 10]); }}
            className="px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors"
          >Reset</button>
        </div>
      </div>

      <div className="relative">
        {/* Map */}
        <div className="w-full" style={{ background: '#0c0b18' }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center: [0, 20] }}
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={({ zoom: z, coordinates }) => {
                setZoom(z);
                setCenter(coordinates);
              }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const numId = geo.id?.toString().padStart(3, '0') ?? '';
                    const alpha2 = NUM_TO_ALPHA2[numId] ?? '';
                    const views = countryMap.get(alpha2) ?? 0;
                    const fill = views > 0
                      ? viewsToColor(views, maxViews)
                      : '#1a1930';
                    const isSelected = alpha2 === selectedCountry;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke={isSelected ? '#a78bfa' : '#2a2840'}
                        strokeWidth={isSelected ? 1.5 : 0.4}
                        style={{
                          default: { outline: 'none', cursor: views > 0 ? 'pointer' : 'default', opacity: 1 },
                          hover: { outline: 'none', fill: views > 0 ? '#a78bfa' : '#252340', opacity: 0.9 },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={(e) => {
                          const name = COUNTRY_NAMES[alpha2] || geo.properties?.name || alpha2;
                          const pct = ((views / totalViews) * 100).toFixed(1);
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            label: views > 0
                              ? `${name}\n${views.toLocaleString()} views · ${pct}%`
                              : name,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => { if (views > 0) handleCountryClick(alpha2); }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg text-xs shadow-xl"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              background: '#1c1b29',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              whiteSpace: 'pre-line',
              lineHeight: 1.6,
            }}
          >
            {tooltip.label}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3">
        <span className="text-[10px] text-gray-600">Less</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: 'linear-gradient(to right, #1a1930, #6b21a8, #a855f7)',
          }}
        />
        <span className="text-[10px] text-gray-600">More</span>
      </div>

      {/* Two-column layout: country list + detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-white/[0.06]">
        {/* Country list */}
        <div className="border-r border-white/[0.06]">
          <div className="px-4 py-2 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Top Countries</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {byCountry.slice(0, 20).map((c, i) => {
              const pct = ((c.views / totalViews) * 100).toFixed(1);
              const isActive = c.country === selectedCountry;
              return (
                <button
                  key={c.country}
                  onClick={() => handleCountryClick(c.country)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-white/[0.04] transition-colors text-left
                    ${isActive ? 'bg-purple-600/10 border-l-2 border-purple-500' : 'border-l-2 border-transparent'}`}
                >
                  <span className="text-gray-600 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-gray-300 truncate">
                    {COUNTRY_NAMES[c.country] || c.country}
                    <span className="text-gray-600 ml-1 text-[10px]">{c.country}</span>
                  </span>
                  <span className="text-white font-semibold flex-shrink-0">{c.views.toLocaleString()}</span>
                  <span className="text-gray-600 flex-shrink-0 w-10 text-right">{pct}%</span>
                </button>
              );
            })}
            {byCountry.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-6">No geo data yet</p>
            )}
          </div>
        </div>

        {/* Country detail */}
        <div>
          <div className="px-4 py-2 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
              {selectedCountry
                ? `${COUNTRY_NAMES[selectedCountry] || selectedCountry} — Detail`
                : 'Country Detail'}
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {!selectedCountry && (
              <p className="text-gray-600 text-xs text-center py-6">
                Click a country on the map or list
              </p>
            )}
            {selectedCountry && detailLoading && (
              <div className="flex justify-center py-6">
                <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {geoDetail && !detailLoading && (
              <div>
                <div className="grid grid-cols-2 gap-0 border-b border-white/[0.06]">
                  <div className="px-4 py-3 border-r border-white/[0.06]">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Views</p>
                    <p className="text-lg font-semibold text-purple-400 mt-0.5">
                      {geoDetail.totalViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Unique</p>
                    <p className="text-lg font-semibold text-emerald-400 mt-0.5">
                      {geoDetail.uniqueVisitors.toLocaleString()}
                    </p>
                  </div>
                </div>
                {geoDetail.cities.length > 0 ? (
                  <div>
                    <div className="px-4 py-1.5 border-b border-white/[0.04]">
                      <p className="text-[10px] text-gray-600">Cities / Regions</p>
                    </div>
                    {geoDetail.cities.map((city, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.03] text-xs">
                        <span className="text-gray-600 w-4">{i + 1}</span>
                        <span className="flex-1 text-gray-300 truncate">
                          {city.city !== 'Unknown' ? city.city : city.region !== 'Unknown' ? city.region : '—'}
                        </span>
                        <span className="text-white font-medium">{city.views}</span>
                        <span className="text-gray-600 text-[10px]">{city.uniqueVisitors}u</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs text-center py-4">
                    No city data (city/region not tracked yet)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── GA-style line chart ──────────────────────────────────────────────────
const GALineChart: React.FC<{ data: DailyPoint[]; days: number; height?: number }> = ({ data, days, height = 220 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!data.length) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(167,139,250,0.22)');
    grad.addColorStop(0.7, 'rgba(167,139,250,0.05)');
    grad.addColorStop(1, 'rgba(167,139,250,0.00)');

    chartRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.date.slice(5)),
        datasets: [{
          data: data.map(d => d.views),
          borderColor: '#a78bfa', borderWidth: 2, backgroundColor: grad,
          fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
          pointHoverBackgroundColor: '#a78bfa', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1b29', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            titleColor: '#9ca3af', bodyColor: '#ffffff',
            titleFont: { size: 11 }, bodyFont: { size: 13, weight: 'bold' as const },
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (item) => `  ${Number(item.raw).toLocaleString()} views`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false }, border: { display: false },
            ticks: { color: '#6b7280', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: days <= 7 ? 7 : 8 },
          },
          y: {
            beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false },
            ticks: {
              color: '#6b7280', font: { size: 11 }, maxTicksLimit: 5, precision: 0,
              callback: (v) => Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : v,
            },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, days, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-xs" style={{ height }}>
        No data yet
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${height}px` }} />
    </div>
  );
};

// ─── Ring chart ───────────────────────────────────────────────────────────
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
          <circle key={i} cx="44" cy="44" r={R} fill="none" stroke={s.color} strokeWidth="14"
            strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.offset} opacity={0.85} />
        ))}
      </svg>
      <div className="flex flex-col gap-1 text-xs flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-gray-400 truncate flex-1">{d.label}</span>
            <span className="text-white font-medium flex-shrink-0">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
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
    <p className={`text-3xl font-semibold ${color}`}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </p>
    {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
  </div>
);

// ─── Page detail modal ────────────────────────────────────────────────────
const PageDetailModal: React.FC<{ page: TopPage; token: string; onClose: () => void }> = ({ page, token, onClose }) => {
  const [detail, setDetail] = useState<{ path: string; total: number; daily: DailyPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/analytics/page-detail`, {
      params: { path: page.path, days: 30 },
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      const data = r.data;
      const rawDaily = data.daily ?? data.dailyChart ?? [];
      const normalizedDaily: DailyPoint[] = rawDaily
        .map((d: any) => ({ date: d.date ?? d.day ?? '', views: Number(d.views ?? d.count ?? 0) }))
        .filter((d: DailyPoint) => d.date !== '');
      setDetail({ path: data.path ?? page.path, total: data.total ?? 0, daily: normalizedDaily });
    }).catch(() => toast.error('Failed to load page detail'))
      .finally(() => setLoading(false));
  }, [page.path]);

  const fullUrl = page.path.startsWith('http')
    ? page.path
    : `https://animabingwatch.workers.dev${page.path}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#13121e] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {page.animeTitle || PAGE_TYPE_LABEL[page.pageType] || page.pageType}
            </p>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 truncate block mt-0.5 underline underline-offset-2 transition-colors"
              title={fullUrl}>{page.path}</a>
          </div>
          <button onClick={onClose}
            className="ml-3 flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center transition-colors">
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
                <GALineChart data={detail.daily} days={30} height={180} />
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
interface PageViewManagerProps { token: string }

const PageViewManager: React.FC<PageViewManagerProps> = ({ token }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [selectedPage, setSelectedPage] = useState<TopPage | null>(null);

  const topPeriodLabels: Record<string, { label: string; days: number }> = {
    daily: { label: 'Today', days: 1 },
    weekly: { label: 'Week', days: 7 },
    monthly: { label: 'Month', days: 30 },
    yearly: { label: 'Year', days: 365 },
  };
  const [topPeriod, setTopPeriod] = useState<string>('daily');
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [topLoading, setTopLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { days };
      if (deviceFilter !== 'all') params.device = deviceFilter;
      const { data } = await axios.get(`${API_BASE}/analytics/stats`, {
        params, headers: { Authorization: `Bearer ${token}` },
      });
      setStats(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days, token, deviceFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchTopPages = useCallback(async () => {
    setTopLoading(true);
    try {
      const topDays = topPeriodLabels[topPeriod]?.days ?? 7;
      const params: Record<string, any> = { days: topDays };
      if (deviceFilter !== 'all') params.device = deviceFilter;
      const { data } = await axios.get(`${API_BASE}/analytics/stats`, {
        params, headers: { Authorization: `Bearer ${token}` },
      });
      setTopPages(data.topPages || []);
    } catch {
      toast.error('Failed to load top pages');
    } finally {
      setTopLoading(false);
    }
  }, [topPeriod, token, deviceFilter]);

  useEffect(() => { fetchTopPages(); }, [fetchTopPages]);

  const filteredPages = (topPages || []).filter(p => {
    const matchSearch = !search ||
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      (p.animeTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.pageType === typeFilter;
    return matchSearch && matchType;
  });

  const typeChartData = (stats?.byType || []).map(t => ({
    label: PAGE_TYPE_LABEL[t.type] || t.type, value: t.views, color: TYPE_COLOR[t.type] || '#475569',
  }));
  const deviceChartData = (stats?.byDevice || []).map(d => ({
    label: d.device.charAt(0).toUpperCase() + d.device.slice(1), value: d.count, color: DEVICE_COLOR[d.device] || '#475569',
  }));
  const allTypes = Array.from(new Set((topPages || []).map(p => p.pageType)));
  const allDevices = stats?.byDevice?.map(d => d.device) ?? [];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Loading analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Page View Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track how users engage with every page</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                ${days === d ? 'bg-purple-600/30 text-purple-300 border-purple-500/40' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
              {d}d
            </button>
          ))}
          <button onClick={fetchStats}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Today's Views" value={stats?.todayViews ?? 0} sub="Since midnight IST" color="text-cyan-400" />
        <StatCard label="Daily Unique Visitors" value={stats?.todayUniqueVisitors ?? 0} sub="Today (IST)" color="text-indigo-400" />
        <StatCard label={`Total Views (${days}d)`} value={stats?.totalViews ?? 0} sub="Selected period" color="text-purple-400" />
        <StatCard label="All Time Views" value={stats?.allTimeTotalViews ?? 0} sub="Since launch" color="text-blue-400" />
        <StatCard label="Unique Visitors" value={stats?.uniqueVisitors ?? 0} sub={`Last ${days} days`} color="text-emerald-400" />
        <StatCard label="All Time Unique" value={stats?.allTimeUniqueVisitors ?? 0} sub="Since launch" color="text-amber-400" />
      </div>

      {/* Line chart + ring charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

      {/* ── World Map ──────────────────────────────────────────────────── */}
      <WorldMap
        byCountry={stats?.byCountry ?? []}
        token={token}
        days={days}
      />

      {/* Top pages table */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Top Pages</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setTopPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${topPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search pages…"
              className="pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 w-44" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-[#1c1b29] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50 [color-scheme:dark]">
            <option value="all" className="bg-[#1c1b29] text-gray-300">All Types</option>
            {allTypes.map(t => (
              <option key={t} value={t} className="bg-[#1c1b29] text-gray-300">{PAGE_TYPE_LABEL[t] || t}</option>
            ))}
          </select>
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-[#1c1b29] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50 [color-scheme:dark]">
            <option value="all" className="bg-[#1c1b29] text-gray-300">All Devices</option>
            {allDevices.map(d => (
              <option key={d} value={d} className="bg-[#1c1b29] text-gray-300">
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-gray-600">{filteredPages.length} pages</span>
        </div>

        {topLoading ? (
          <div className="py-8 text-center text-gray-500 text-xs">Loading top pages…</div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f0e1a]">
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
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                      {search || typeFilter !== 'all' ? 'No matching pages found' : 'No page view data yet'}
                    </td>
                  </tr>
                ) : filteredPages.map((page, idx) => {
                  const rank = idx + 1;
                  const activeTotal = (topPages || []).reduce((s, p) => s + p.views, 0) || 1;
                  const share = ((page.views / activeTotal) * 100).toFixed(1);
                  const barWidth = Math.max((page.views / (topPages[0]?.views || 1)) * 100, 2);
                  return (
                    <tr key={page.path} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                      <td className="px-4 py-3 text-gray-600 w-8">{rank}</td>
                      <td className="px-4 py-3 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-medium truncate max-w-xs">
                            {page.animeTitle || page.path}
                          </span>
                          {page.animeTitle && (
                            <span className="text-gray-600 truncate max-w-xs text-[10px]">{page.path}</span>
                          )}
                          <div className="mt-1 h-1 bg-white/5 rounded-full w-32 overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, background: TYPE_COLOR[page.pageType] || '#a78bfa' }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            background: (TYPE_COLOR[page.pageType] || '#475569') + '22',
                            color: TYPE_COLOR[page.pageType] || '#94a3b8',
                          }}>
                          {PAGE_TYPE_LABEL[page.pageType] || page.pageType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{page.views.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{share}%</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSelectedPage(page)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-md transition-all">
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPage && (
        <PageDetailModal page={selectedPage} token={token} onClose={() => setSelectedPage(null)} />
      )}
    </div>
  );
};

export default PageViewManager;