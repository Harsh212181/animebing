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

interface FunnelStats {
  totalSessions: number;
  homeOnly: number;
  homeToDetail: number;
  homeToDetailToDownload: number;
  conversionRates: {
    homeToDetailRate: string;
    detailToDownloadRate: string;
    overallConversionRate: string;
  };
}

// ─── New analytics data types ─────────────────────────────────────────────
interface ReferrerItem { source: string; views: number }
interface BrowserItem { browser: string; count: number }
interface TimeOnPageItem { pageType: string; avgSeconds: number; samples: number }
interface LiveData { liveVisitors: number; currentPages: { path: string; count: number; animeTitle?: string; pageType?: string }[] }
interface TopAnimeItem { animeTitle: string; slug?: string; totalViews: number; detailViews: number; episodeViews: number; downloadViews: number }
interface HourlyItem { hour: number; views: number }
interface NotFoundItem { path: string; views: number; referrer?: string }
interface VisitorType { newVisitors: number; returningVisitors: number; total: number }

// User Link Analytics
interface UserLinkStat {
  userId: string
  username: string
  realName: string
  ratePerThousand: number
  totalClicks: number
  clicksInPeriod: number
  uniqueVisitors: number
  newVisitors: number
  returningVisitors: number
  byCountry: { country: string; count: number }[]
  byDevice: { device: string; count: number }[]
  dailyClicks: { date: string; clicks: number }[]
  links: {
    code: string
    label: string
    url: string
    totalClicks: number
    clicksInPeriod: number
    lastClicked: string | null
  }[]
}

// NEW interfaces for the 6 additional features
interface EarningsUser {
  userId: string; username: string; realName: string
  totalEarnings: number; unpaidEarnings: number; paidEarnings: number
  ratePerThousand: number; projectedMonthly: number
  earningsTimeline: { date: string; clicks: number; earnings: number }[]
  linkHealth: { code: string; label: string; url: string; totalClicks: number; recentClicks: number; status: string; lastClicked: string | null }[]
  deadLinks: number; trendingLinks: number
}
interface FraudAlert {
  userId: string; username: string; realName: string
  totalClicks: number; riskScore: number; riskLevel: string
  suspiciousIps: { ip: string; count: number; codes: string[] }[]
  spikeHours: { date: string; hour: number; count: number; avgHourly: number }[]
  unknownCountryClicks: number; unknownPct: number
}
interface LeaderUser {
  userId: string; username: string; realName: string
  totalClicks: number; todayClicks: number; weekClicks: number
  totalEarnings: number; unpaidEarnings: number
  clickStreak: number; loginStreak: number; ratePerThousand: number
}
interface PaymentUser {
  userId: string; username: string; realName: string
  totalClicks: number; totalEarnings: number
  paidEarnings: number; unpaidEarnings: number; ratePerThousand: number
}
interface CohortRow {
  month: string; total: number; active30: number; active60: number; active90: number
  retention30: number; retention60: number; retention90: number
  avgClicks: number; totalClicks: number; totalEarnings: number
}
interface JourneyUser {
  userId: string; username: string; realName: string
  totalClicks: number; detailVisits: number; downloadVisits: number
  bounces: number; bounceRate: number; detailRate: number; downloadRate: number
}

// ─── NEW: Per‑link journey item ──────────────────────────────────────────
interface LinkJourneyItem {
  code: string
  label: string
  url: string
  totalClicks: number
  detailVisits: number
  downloadVisits: number
  bounces: number
  bounceRate: number
  detailRate: number
  downloadRate: number
  username?: string
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
  countryPeriod: string;
  setCountryPeriod: (p: string) => void;
  loading: boolean;
}

const WorldMap: React.FC<WorldMapProps> = ({ byCountry, token, days, countryPeriod, setCountryPeriod, loading }) => {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([20, 10]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [geoDetail, setGeoDetail] = useState<GeoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const countryPeriodLabels: Record<string, { label: string; days: number }> = {
    daily: { label: 'Today', days: 1 },
    weekly: { label: 'Week', days: 7 },
    monthly: { label: 'Month', days: 30 },
    yearly: { label: 'Year', days: 365 },
  };

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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(countryPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setCountryPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${countryPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(z * 1.5, 12))}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center text-sm font-bold transition-colors">+</button>
            <button onClick={() => setZoom(z => Math.max(z / 1.5, 1))}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center text-sm font-bold transition-colors">−</button>
            <button onClick={() => { setZoom(1); setCenter([20, 10]); }}
              className="px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors">Reset</button>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Map */}
        <div className="w-full" style={{ background: '#0c0b18', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
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
            {loading ? (
              <div className="flex justify-center py-6">
                <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : byCountry.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No geo data yet</p>
            ) : (
              byCountry.slice(0, 20).map((c, i) => {
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
              })
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

  const [countryPeriod, setCountryPeriod] = useState<string>('daily');
  const [byCountry, setByCountry] = useState<ByCountry[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);

  // Funnel period (defaults to "Today")
  const [funnelPeriod, setFunnelPeriod] = useState<string>('daily');
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);

  // ─── New analytics state — now all default to 'daily' ─────────────────
  const [referrerPeriod, setReferrerPeriod] = useState<string>('daily');
  const [referrers, setReferrers] = useState<ReferrerItem[]>([]);
  const [referrerLoading, setReferrerLoading] = useState(false);

  const [browserPeriod, setBrowserPeriod] = useState<string>('daily');
  const [browsers, setBrowsers] = useState<BrowserItem[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  const [timeOnPagePeriod, setTimeOnPagePeriod] = useState<string>('daily');
  const [timeOnPageData, setTimeOnPageData] = useState<TimeOnPageItem[]>([]);
  const [timeOnPageLoading, setTimeOnPageLoading] = useState(false);

  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const [topAnimePeriod, setTopAnimePeriod] = useState<string>('daily');
  const [topAnime, setTopAnime] = useState<TopAnimeItem[]>([]);
  const [topAnimeLoading, setTopAnimeLoading] = useState(false);

  const [hourlyPeriod, setHourlyPeriod] = useState<string>('daily');
  const [hourlyData, setHourlyData] = useState<HourlyItem[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);

  const [notFoundPeriod, setNotFoundPeriod] = useState<string>('daily');
  const [notFoundPages, setNotFoundPages] = useState<NotFoundItem[]>([]);
  const [notFoundLoading, setNotFoundLoading] = useState(false);

  const [visitorTypePeriod, setVisitorTypePeriod] = useState<string>('daily');
  const [visitorType, setVisitorType] = useState<VisitorType | null>(null);
  const [visitorTypeLoading, setVisitorTypeLoading] = useState(false);

  // User Link Analytics state
  const [userLinksPeriod, setUserLinksPeriod] = useState<string>('daily');
  const [userLinksData, setUserLinksData] = useState<UserLinkStat[]>([]);
  const [userLinksLoading, setUserLinksLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ─── NEW state for 6 additional features ─────────────────────────────
  const [earningsData, setEarningsData] = useState<EarningsUser[]>([])
  const [earningsLoading, setEarningsLoading] = useState(false)
  const [expandedEarningsUser, setExpandedEarningsUser] = useState<string | null>(null)

  const [fraudData, setFraudData] = useState<FraudAlert[]>([])
  const [fraudLoading, setFraudLoading] = useState(false)
  const [fraudDays, setFraudDays] = useState('weekly')

  const [leaderData, setLeaderData] = useState<{ byToday: LeaderUser[]; byWeek: LeaderUser[]; byAllTime: LeaderUser[]; byStreak: LeaderUser[] } | null>(null)
  const [leaderLoading, setLeaderLoading] = useState(false)
  const [leaderTab, setLeaderTab] = useState<'byToday' | 'byWeek' | 'byAllTime' | 'byStreak'>('byToday')

  const [paymentData, setPaymentData] = useState<any>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const [cohortData, setCohortData] = useState<CohortRow[]>([])
  const [cohortLoading, setCohortLoading] = useState(false)

  const [journeyData, setJourneyData] = useState<JourneyUser[]>([])
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [journeyDays, setJourneyDays] = useState('weekly')

  // NEW: Link journey by link
  const [journeyTab, setJourneyTab] = useState<'byUser' | 'byLink'>('byUser')
  const [linkJourneyData, setLinkJourneyData] = useState<LinkJourneyItem[]>([])

  // ─── Existing fetch functions ────────────────────────────────────────
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

  const fetchByCountry = useCallback(async () => {
    setCountryLoading(true);
    try {
      const countryDays = topPeriodLabels[countryPeriod]?.days ?? 1;
      const { data } = await axios.get(`${API_BASE}/analytics/by-country`, {
        params: { days: countryDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setByCountry(data.byCountry || []);
    } catch {
      toast.error('Failed to load country data');
    } finally {
      setCountryLoading(false);
    }
  }, [countryPeriod, token]);

  useEffect(() => { fetchByCountry(); }, [fetchByCountry]);

  const fetchFunnel = useCallback(async () => {
    try {
      const funnelDays = topPeriodLabels[funnelPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/funnel`, {
        params: { days: funnelDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setFunnel(data);
    } catch {
      toast.error('Failed to load funnel data');
    }
  }, [funnelPeriod, token]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  // ─── New fetch functions ─────────────────────────────────────────────
  const fetchReferrers = useCallback(async () => {
    setReferrerLoading(true);
    try {
      const rDays = topPeriodLabels[referrerPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/referrers`, {
        params: { days: rDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReferrers(data.byReferrer || []);
    } catch {
      toast.error('Failed to load referrer data');
    } finally {
      setReferrerLoading(false);
    }
  }, [referrerPeriod, token]);

  useEffect(() => { fetchReferrers(); }, [fetchReferrers]);

  const fetchBrowsers = useCallback(async () => {
    setBrowserLoading(true);
    try {
      const bDays = topPeriodLabels[browserPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/browsers`, {
        params: { days: bDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setBrowsers(data.byBrowser || []);
    } catch {
      toast.error('Failed to load browser data');
    } finally {
      setBrowserLoading(false);
    }
  }, [browserPeriod, token]);

  useEffect(() => { fetchBrowsers(); }, [fetchBrowsers]);

  const fetchTimeOnPage = useCallback(async () => {
    setTimeOnPageLoading(true);
    try {
      const tDays = topPeriodLabels[timeOnPagePeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/time-on-page`, {
        params: { days: tDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimeOnPageData(data.byPageType || []);
    } catch {
      toast.error('Failed to load time on page');
    } finally {
      setTimeOnPageLoading(false);
    }
  }, [timeOnPagePeriod, token]);

  useEffect(() => { fetchTimeOnPage(); }, [fetchTimeOnPage]);

  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLiveData(data);
    } catch {
      toast.error('Failed to load live data');
    } finally {
      setLiveLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  const fetchTopAnime = useCallback(async () => {
    setTopAnimeLoading(true);
    try {
      const aDays = topPeriodLabels[topAnimePeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/top-anime`, {
        params: { days: aDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTopAnime(data.topAnime || []);
    } catch {
      toast.error('Failed to load top anime');
    } finally {
      setTopAnimeLoading(false);
    }
  }, [topAnimePeriod, token]);

  useEffect(() => { fetchTopAnime(); }, [fetchTopAnime]);

  const fetchHourly = useCallback(async () => {
    setHourlyLoading(true);
    try {
      const hDays = topPeriodLabels[hourlyPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/hourly`, {
        params: { days: hDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setHourlyData(data.hourly || []);
    } catch {
      toast.error('Failed to load hourly data');
    } finally {
      setHourlyLoading(false);
    }
  }, [hourlyPeriod, token]);

  useEffect(() => { fetchHourly(); }, [fetchHourly]);

  const fetchNotFound = useCallback(async () => {
    setNotFoundLoading(true);
    try {
      const nDays = topPeriodLabels[notFoundPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/not-found`, {
        params: { days: nDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotFoundPages(data.notFoundPages || []);
    } catch {
      toast.error('Failed to load 404 stats');
    } finally {
      setNotFoundLoading(false);
    }
  }, [notFoundPeriod, token]);

  useEffect(() => { fetchNotFound(); }, [fetchNotFound]);

  const fetchVisitorType = useCallback(async () => {
    setVisitorTypeLoading(true);
    try {
      const vDays = topPeriodLabels[visitorTypePeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/visitor-type`, {
        params: { days: vDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setVisitorType(data);
    } catch {
      toast.error('Failed to load visitor types');
    } finally {
      setVisitorTypeLoading(false);
    }
  }, [visitorTypePeriod, token]);

  useEffect(() => { fetchVisitorType(); }, [fetchVisitorType]);

  // User Link Analytics fetch
  const fetchUserLinks = useCallback(async () => {
    setUserLinksLoading(true)
    try {
      const d = topPeriodLabels[userLinksPeriod]?.days ?? 7
      const { data } = await axios.get(`${API_BASE}/analytics/user-links`, {
        params: { days: d },
        headers: { Authorization: `Bearer ${token}` },
      })
      setUserLinksData(data.users || [])
    } catch {
      toast.error('Failed to load user link analytics')
    } finally {
      setUserLinksLoading(false)
    }
  }, [userLinksPeriod, token])

  useEffect(() => { fetchUserLinks() }, [fetchUserLinks])

  // ─── NEW fetch functions for the 6 features ───────────────────────────
  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/earnings-health`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setEarningsData(data.users || [])
    } catch { toast.error('Failed to load earnings data') }
    finally { setEarningsLoading(false) }
  }, [token])
  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  const fetchFraud = useCallback(async () => {
    setFraudLoading(true)
    try {
      const d = topPeriodLabels[fraudDays]?.days ?? 7
      const { data } = await axios.get(`${API_BASE}/analytics/fraud`, {
        params: { days: d }, headers: { Authorization: `Bearer ${token}` }
      })
      setFraudData(data.alerts || [])
    } catch { toast.error('Failed to load fraud data') }
    finally { setFraudLoading(false) }
  }, [fraudDays, token])
  useEffect(() => { fetchFraud() }, [fetchFraud])

  const fetchLeader = useCallback(async () => {
    setLeaderLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setLeaderData(data)
    } catch { toast.error('Failed to load leaderboard') }
    finally { setLeaderLoading(false) }
  }, [token])
  useEffect(() => { fetchLeader() }, [fetchLeader])

  const fetchPayment = useCallback(async () => {
    setPaymentLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/payment-analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPaymentData(data)
    } catch { toast.error('Failed to load payment analytics') }
    finally { setPaymentLoading(false) }
  }, [token])
  useEffect(() => { fetchPayment() }, [fetchPayment])

  const fetchCohort = useCallback(async () => {
    setCohortLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/cohort`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCohortData(data.cohorts || [])
    } catch { toast.error('Failed to load cohort data') }
    finally { setCohortLoading(false) }
  }, [token])
  useEffect(() => { fetchCohort() }, [fetchCohort])

  const fetchJourney = useCallback(async () => {
    setJourneyLoading(true)
    try {
      const d = topPeriodLabels[journeyDays]?.days ?? 7
      const { data } = await axios.get(`${API_BASE}/analytics/link-journey`, {
        params: { days: d }, headers: { Authorization: `Bearer ${token}` }
      })
      setJourneyData(data.journeys || [])
    } catch { toast.error('Failed to load journey data') }
    finally { setJourneyLoading(false) }
  }, [journeyDays, token])
  useEffect(() => { fetchJourney() }, [fetchJourney])

  // NEW: fetch per‑link journey
  const fetchLinkJourney = useCallback(async () => {
    setJourneyLoading(true)
    try {
      const d = topPeriodLabels[journeyDays]?.days ?? 7
      const { data } = await axios.get(`${API_BASE}/analytics/link-journey-by-link`, {
        params: { days: d }, headers: { Authorization: `Bearer ${token}` }
      })
      setLinkJourneyData(data.links || [])
    } catch { toast.error('Failed to load per‑link journey') }
    finally { setJourneyLoading(false) }
  }, [journeyDays, token])
  useEffect(() => { if (journeyTab === 'byLink') fetchLinkJourney() }, [journeyTab, fetchLinkJourney])

  // ─── Filtered pages for table ────────────────────────────────────────
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
        byCountry={byCountry}
        token={token}
        days={topPeriodLabels[countryPeriod]?.days ?? 1}
        countryPeriod={countryPeriod}
        setCountryPeriod={setCountryPeriod}
        loading={countryLoading}
      />

      {/* ── Funnel ────────────────────────────────────────────────────── */}
      {funnel && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              User Journey Funnel — {topPeriodLabels[funnelPeriod]?.label ?? 'Today'}
            </p>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {Object.entries(topPeriodLabels).map(([key, { label }]) => (
                <button key={key} onClick={() => setFunnelPeriod(key)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                    ${funnelPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-cyan-400">{funnel.homeOnly.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-1">Visited Home</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-purple-400">{funnel.homeToDetail.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-1">Home → Detail</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{funnel.conversionRates.homeToDetailRate}% of Home</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-emerald-400">{funnel.homeToDetailToDownload.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-1">Home → Detail → Download</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{funnel.conversionRates.detailToDownloadRate}% of Detail visitors</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
            <p className="text-[11px] text-gray-500">
              Overall conversion (Home → Download):
              <span className="text-amber-400 font-semibold ml-1">{funnel.conversionRates.overallConversionRate}%</span>
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Traffic Sources (Referrers) ────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Traffic Sources</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setReferrerPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${referrerPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {referrerLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : referrers.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No referrer data</p>
        ) : (
          <div className="space-y-2">
            {referrers.slice(0, 10).map((r, i) => {
              const max = referrers[0]?.views || 1;
              const barWidth = (r.views / max) * 100;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-20 truncate">{r.source}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-600/60 to-purple-400 rounded-full" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="text-white font-medium w-16 text-right">{r.views.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. Browser Breakdown ──────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Browsers</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setBrowserPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${browserPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {browserLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : browsers.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No browser data</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {browsers.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-gray-300 text-xs">{b.browser}</span>
                <span className="text-white font-medium text-xs">{b.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Average Time on Page ────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg. Time on Page</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setTimeOnPagePeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${timeOnPagePeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {timeOnPageLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : timeOnPageData.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No time-on-page data</p>
        ) : (
          <div className="space-y-2">
            {timeOnPageData.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-gray-400 truncate">{PAGE_TYPE_LABEL[t.pageType] || t.pageType}</span>
                <span className="text-white font-medium">{Math.floor(t.avgSeconds / 60)}m {t.avgSeconds % 60}s</span>
                <span className="text-gray-600">({t.samples} samples)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Live Visitors ───────────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Visitors (last 5 min)</p>
          <button onClick={fetchLive} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">Refresh</button>
        </div>
        {liveLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : !liveData ? (
          <p className="text-gray-600 text-xs text-center py-4">No live data</p>
        ) : (
          <div>
            <StatCard label="Active Visitors" value={liveData.liveVisitors} color="text-green-400" />
            {liveData.currentPages.length > 0 && (
              <div className="mt-3 space-y-1">
                {liveData.currentPages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate max-w-xs">{p.animeTitle || p.path}</span>
                    <span className="text-white font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. Top Anime Overall ───────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Top Anime</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setTopAnimePeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${topAnimePeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {topAnimeLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : topAnime.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No anime data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-2 text-left text-gray-500">Anime</th>
                  <th className="py-2 text-right text-gray-500">Total</th>
                  <th className="py-2 text-right text-gray-500 hidden sm:table-cell">Detail</th>
                  <th className="py-2 text-right text-gray-500 hidden sm:table-cell">Episode</th>
                  <th className="py-2 text-right text-gray-500 hidden sm:table-cell">Download</th>
                </tr>
              </thead>
              <tbody>
                {topAnime.slice(0, 15).map((a, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-2 text-gray-300 truncate max-w-xs">{a.animeTitle}</td>
                    <td className="py-2 text-right text-white font-medium">{a.totalViews.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500 hidden sm:table-cell">{a.detailViews}</td>
                    <td className="py-2 text-right text-gray-500 hidden sm:table-cell">{a.episodeViews}</td>
                    <td className="py-2 text-right text-gray-500 hidden sm:table-cell">{a.downloadViews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 6. Hourly Heatmap ──────────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hourly Activity (IST)</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setHourlyPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${hourlyPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {hourlyLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : hourlyData.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No hourly data</p>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {hourlyData.map((h, i) => {
              const maxH = Math.max(...hourlyData.map(d => d.views), 1);
              const heightPct = (h.views / maxH) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-[9px] text-gray-500">{h.views > 0 ? h.views : ''}</span>
                  <div className="w-full bg-purple-600/70 rounded-t" style={{ height: `${Math.max(heightPct, 2)}%` }} />
                  <span className="text-[9px] text-gray-600">{h.hour}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 7. 404 Pages ────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">404 / Not Found Pages</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setNotFoundPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${notFoundPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {notFoundLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : notFoundPages.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">No 404 pages recorded</p>
        ) : (
          <div className="space-y-2">
            {notFoundPages.slice(0, 15).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 truncate max-w-xs">{p.path}</span>
                <span className="text-white font-medium">{p.views}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 8. New vs Returning Visitors ───────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visitor Loyalty</p>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setVisitorTypePeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${visitorTypePeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {visitorTypeLoading ? (
          <div className="flex justify-center py-4"><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : !visitorType ? (
          <p className="text-gray-600 text-xs text-center py-4">No data</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <p className="text-lg font-semibold text-green-400">{visitorType.newVisitors.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500">New</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-lg font-semibold text-blue-400">{visitorType.returningVisitors.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500">Returning</p>
            </div>
          </div>
        )}
      </div>

      {/* ── User Link Analytics ─────────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Link Analytics</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Per-user link performance, traffic sources & visitor loyalty</p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setUserLinksPeriod(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${userLinksPeriod === key ? 'bg-purple-600/50 text-purple-200 shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {userLinksLoading ? (
          <div className="flex justify-center py-8">
            <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : userLinksData.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">No user link data</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {userLinksData.map((u) => {
              const isExpanded = expandedUser === u.userId
              const topCountry = u.byCountry[0]
              const returningPct = u.uniqueVisitors > 0
                ? Math.round((u.returningVisitors / u.uniqueVisitors) * 100) : 0

              return (
                <div key={u.userId}>
                  {/* User summary row */}
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-300 text-xs font-semibold">
                        {u.realName.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Name + username */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{u.realName}</p>
                      <p className="text-[10px] text-gray-500">@{u.username} · {u.links.length} link{u.links.length !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Period clicks */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-purple-400">{u.clicksInPeriod.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-600">period clicks</p>
                    </div>

                    {/* Unique visitors */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-cyan-400">{u.uniqueVisitors.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-600">unique</p>
                    </div>

                    {/* Returning % */}
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-sm font-semibold text-emerald-400">{returningPct}%</p>
                      <p className="text-[10px] text-gray-600">returning</p>
                    </div>

                    {/* Top country */}
                    <div className="text-right flex-shrink-0 hidden lg:block w-16">
                      <p className="text-xs text-gray-300">{topCountry ? (COUNTRY_NAMES[topCountry.country] || topCountry.country) : '—'}</p>
                      <p className="text-[10px] text-gray-600">top country</p>
                    </div>

                    {/* Expand arrow */}
                    <span className={`text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-white/[0.02] px-4 py-4 space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total (all time)</p>
                          <p className="text-lg font-semibold text-white mt-1">{u.totalClicks.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">New visitors</p>
                          <p className="text-lg font-semibold text-green-400 mt-1">{u.newVisitors.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Returning</p>
                          <p className="text-lg font-semibold text-blue-400 mt-1">{u.returningVisitors.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rate/1000</p>
                          <p className="text-lg font-semibold text-amber-400 mt-1">₹{u.ratePerThousand}</p>
                        </div>
                      </div>

                      {/* Daily chart (mini bar chart) */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Daily clicks (last 7 days)</p>
                        <div className="flex items-end gap-1 h-16">
                          {u.dailyClicks.map((d, i) => {
                            const maxC = Math.max(...u.dailyClicks.map(x => x.clicks), 1)
                            const h = (d.clicks / maxC) * 100
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                                {d.clicks > 0 && <span className="text-[8px] text-gray-500">{d.clicks}</span>}
                                <div className="w-full bg-purple-500/70 rounded-t" style={{ height: `${Math.max(h, 3)}%` }} />
                                <span className="text-[8px] text-gray-600">{d.date.split(' ')[0]}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Country + Device row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Countries */}
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Top countries</p>
                          {u.byCountry.length === 0 ? (
                            <p className="text-gray-600 text-xs">No data</p>
                          ) : (
                            <div className="space-y-1.5">
                              {u.byCountry.map((c, i) => {
                                const maxC = u.byCountry[0]?.count || 1
                                return (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-400 w-20 truncate">
                                      {COUNTRY_NAMES[c.country] || c.country}
                                    </span>
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-500/60 rounded-full"
                                        style={{ width: `${(c.count / maxC) * 100}%` }} />
                                    </div>
                                    <span className="text-white font-medium w-8 text-right">{c.count}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Devices */}
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">By device</p>
                          {u.byDevice.length === 0 ? (
                            <p className="text-gray-600 text-xs">No data</p>
                          ) : (
                            <div className="space-y-1.5">
                              {u.byDevice.map((d, i) => {
                                const maxD = u.byDevice[0]?.count || 1
                                const color = DEVICE_COLOR[d.device] || '#475569'
                                return (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-400 w-16 capitalize">{d.device}</span>
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full"
                                        style={{ width: `${(d.count / maxD) * 100}%`, background: color }} />
                                    </div>
                                    <span className="text-white font-medium w-8 text-right">{d.count}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Per-link table */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Links performance</p>
                        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                                <th className="px-3 py-2 text-left text-gray-500">Label / Code</th>
                                <th className="px-3 py-2 text-right text-gray-500">Period</th>
                                <th className="px-3 py-2 text-right text-gray-500">Total</th>
                                <th className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">Last click</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.links.map((link, i) => (
                                <tr key={i} className="border-b border-white/[0.03]">
                                  <td className="px-3 py-2">
                                    <p className="text-white font-medium truncate max-w-[180px]">{link.label}</p>
                                    <p className="text-gray-600 text-[10px]">go.animebing.in/{link.code}</p>
                                  </td>
                                  <td className="px-3 py-2 text-right text-purple-400 font-semibold">
                                    {link.clicksInPeriod.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-300">
                                    {link.totalClicks.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">
                                    {link.lastClicked
                                      ? new Date(link.lastClicked).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FEATURE 1+2: Earnings Timeline + Link Health ─────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Earnings & Link Health</p>
            <p className="text-[10px] text-gray-600 mt-0.5">30-day timeline, projected income & per-link status</p>
          </div>
          <button onClick={fetchEarnings} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">Refresh</button>
        </div>
        {earningsLoading ? (
          <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : earningsData.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">No data</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {earningsData.map(u => {
              const isExp = expandedEarningsUser === u.userId
              const maxEarning = Math.max(...u.earningsTimeline.map(d => d.earnings), 0.001)
              return (
                <div key={u.userId}>
                  <button onClick={() => setExpandedEarningsUser(isExp ? null : u.userId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group">
                    <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-300 text-xs font-semibold">{u.realName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">{u.realName}</p>
                      <p className="text-[10px] text-gray-500">@{u.username} · ₹{u.ratePerThousand}/1000</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-amber-400">₹{u.projectedMonthly}</p>
                      <p className="text-[10px] text-gray-600">projected/month</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-emerald-400">₹{u.unpaidEarnings.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-600">unpaid</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {u.deadLinks > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-400">{u.deadLinks} dead</span>}
                      {u.trendingLinks > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/20 text-green-400">{u.trendingLinks} trending</span>}
                    </div>
                    <span className={`text-gray-600 flex-shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isExp && (
                    <div className="border-t border-white/[0.04] bg-white/[0.02] px-4 py-4 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total earned</p>
                          <p className="text-base font-semibold text-white mt-1">₹{u.totalEarnings.toFixed(2)}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Paid out</p>
                          <p className="text-base font-semibold text-emerald-400 mt-1">₹{u.paidEarnings.toFixed(2)}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pending</p>
                          <p className="text-base font-semibold text-amber-400 mt-1">₹{u.unpaidEarnings.toFixed(2)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Daily earnings (last 30 days)</p>
                        <div className="flex items-end gap-0.5 h-20">
                          {u.earningsTimeline.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ₹${d.earnings}`}>
                              <div className="w-full bg-amber-500/60 rounded-t" style={{ height: `${Math.max((d.earnings / maxEarning) * 100, d.earnings > 0 ? 4 : 1)}%` }} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                          <span>{u.earningsTimeline[0]?.date}</span>
                          <span>{u.earningsTimeline[29]?.date}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Link health</p>
                        <div className="space-y-1.5">
                          {u.linkHealth.map((lk, i) => {
                            const statusColor = lk.status === 'dead' ? 'text-red-400 bg-red-500/10' :
                              lk.status === 'trending' ? 'text-green-400 bg-green-500/10' :
                              lk.status === 'declining' ? 'text-amber-400 bg-amber-500/10' : 'text-cyan-400 bg-cyan-500/10'
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${statusColor}`}>{lk.status}</span>
                                <span className="text-gray-300 truncate flex-1">{lk.label}</span>
                                <span className="text-gray-500 text-[10px]">{lk.recentClicks} last 7d</span>
                                <span className="text-white font-medium">{lk.totalClicks} total</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FEATURE 3: Fraud Detection ──────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fraud & Bot Detection</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Suspicious IPs, click spikes, unknown traffic</p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {Object.entries(topPeriodLabels).map(([key, { label }]) => (
              <button key={key} onClick={() => setFraudDays(key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${fraudDays === key ? 'bg-purple-600/50 text-purple-200' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {fraudLoading ? (
          <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : fraudData.length === 0 ? (
          <div className="flex items-center gap-2 justify-center py-8">
            <span className="text-green-400 text-sm">All clear — no suspicious activity detected</span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {fraudData.map(alert => (
              <div key={alert.userId} className="px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.riskLevel === 'high' ? 'bg-red-400' : alert.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-yellow-400'}`} />
                  <span className="text-xs font-medium text-white">{alert.realName}</span>
                  <span className="text-[10px] text-gray-500">@{alert.username}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-medium
                    ${alert.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : alert.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {alert.riskLevel.toUpperCase()} RISK · {alert.riskScore}/100
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  {alert.suspiciousIps.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2">
                      <p className="text-red-400 font-medium mb-1">Suspicious IPs ({alert.suspiciousIps.length})</p>
                      {alert.suspiciousIps.slice(0, 3).map((ip, i) => (
                        <p key={i} className="text-gray-400">{ip.ip} — {ip.count}x clicks</p>
                      ))}
                    </div>
                  )}
                  {alert.spikeHours.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2">
                      <p className="text-amber-400 font-medium mb-1">Click spikes ({alert.spikeHours.length})</p>
                      {alert.spikeHours.slice(0, 3).map((s, i) => (
                        <p key={i} className="text-gray-400">{s.date} {s.hour}:00 — {s.count}x (avg {s.avgHourly})</p>
                      ))}
                    </div>
                  )}
                  {alert.unknownPct > 30 && (
                    <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-2">
                      <p className="text-yellow-400 font-medium mb-1">Unknown traffic</p>
                      <p className="text-gray-400">{alert.unknownCountryClicks} clicks ({alert.unknownPct}%) from unknown location</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FEATURE 4: Leaderboard ───────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Leaderboard & Streaks</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Rankings, consecutive days, login streaks</p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {(['byToday', 'byWeek', 'byAllTime', 'byStreak'] as const).map(tab => (
              <button key={tab} onClick={() => setLeaderTab(tab)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${leaderTab === tab ? 'bg-purple-600/50 text-purple-200' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                {tab === 'byToday' ? 'Today' : tab === 'byWeek' ? 'Week' : tab === 'byAllTime' ? 'All time' : 'Streak'}
              </button>
            ))}
          </div>
        </div>
        {leaderLoading ? (
          <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : !leaderData ? null : (
          <div>
            {(leaderData[leaderTab] || []).slice(0, 10).map((u, idx) => {
              const medal = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`
              const medalColor = idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-700' : 'text-gray-600'
              const value = leaderTab === 'byToday' ? u.todayClicks
                : leaderTab === 'byWeek' ? u.weekClicks
                : leaderTab === 'byStreak' ? u.clickStreak
                : u.totalClicks
              const label = leaderTab === 'byStreak' ? 'day streak' : 'clicks'
              return (
                <div key={u.userId} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.03]">
                  <span className={`text-xs font-semibold w-8 ${medalColor}`}>{medal}</span>
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-300 text-[10px] font-semibold">{u.realName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">{u.realName}</p>
                    <p className="text-[10px] text-gray-600">Login streak: {u.loginStreak}d · Click streak: {u.clickStreak}d</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-purple-400">{value.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600">{label}</p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-amber-400">₹{u.unpaidEarnings.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-600">unpaid</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FEATURE 5: Payment Analytics ─────────────────────────────────── */}
      {paymentData && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment Analytics</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Earnings overview, pending requests, monthly trend</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total paid</p>
                <p className="text-xl font-semibold text-emerald-400 mt-1">₹{paymentData.totalPaid.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total unpaid</p>
                <p className="text-xl font-semibold text-amber-400 mt-1">₹{paymentData.totalUnpaid.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pending requests</p>
                <p className="text-xl font-semibold text-red-400 mt-1">{paymentData.pendingCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Near threshold</p>
                <p className="text-xl font-semibold text-cyan-400 mt-1">{paymentData.nearThreshold.length}</p>
              </div>
            </div>
            {paymentData.monthlyTrend.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Monthly payments (last 6 months)</p>
                <div className="flex items-end gap-2 h-16">
                  {paymentData.monthlyTrend.map((m: any, i: number) => {
                    const maxA = Math.max(...paymentData.monthlyTrend.map((x: any) => x.amount), 1)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                        {m.amount > 0 && <span className="text-[9px] text-gray-500">₹{m.amount}</span>}
                        <div className="w-full bg-emerald-500/50 rounded-t" style={{ height: `${Math.max((m.amount / maxA) * 100, m.amount > 0 ? 4 : 2)}%` }} />
                        <span className="text-[9px] text-gray-600">{m.month}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {paymentData.nearThreshold.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Users near 1000 click threshold</p>
                <div className="space-y-2">
                  {paymentData.nearThreshold.map((u: any) => (
                    <div key={u.userId} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300 flex-1">{u.realName}</span>
                      <span className="text-gray-500">{u.totalClicks}/1000</span>
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${(u.totalClicks / 1000) * 100}%` }} />
                      </div>
                      <span className="text-cyan-400">{u.remaining} left</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {paymentData.recentPayments.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Recent payments</p>
                <div className="space-y-1">
                  {paymentData.recentPayments.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 flex-1">{p.realName}</span>
                      <span className="text-emerald-400 font-medium">₹{p.amount}</span>
                      <span className="text-gray-600">{new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FEATURE 6: Cohort Analysis ───────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Cohort Analysis</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Retention by join month — 30/60/90 day activity</p>
        </div>
        {cohortLoading ? (
          <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : cohortData.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">No cohort data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="px-4 py-2.5 text-left text-gray-500">Joined</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Users</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">30d ret.</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">60d ret.</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">90d ret.</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Avg clicks</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">Total earned</th>
                </tr>
              </thead>
              <tbody>
                {cohortData.map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="px-4 py-2.5 text-white font-medium">{c.month}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{c.total}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium ${c.retention30 >= 70 ? 'text-green-400' : c.retention30 >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {c.retention30}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium ${c.retention60 >= 60 ? 'text-green-400' : c.retention60 >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                        {c.retention60}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium ${c.retention90 >= 50 ? 'text-green-400' : c.retention90 >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                        {c.retention90}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-cyan-400">{c.avgClicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-amber-400 hidden sm:table-cell">₹{c.totalEarnings.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── FEATURE 7 (Updated): Link Journey Tracking ─────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Link Journey Tracking</p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {journeyTab === 'byUser' ? 'Click → detail → download per user' : 'Per‑link journey: clicks → page visits'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setJourneyTab('byUser')}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${journeyTab === 'byUser' ? 'bg-purple-600/50 text-purple-200' : 'text-gray-400 hover:text-white'}`}>
                By User
              </button>
              <button onClick={() => setJourneyTab('byLink')}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                  ${journeyTab === 'byLink' ? 'bg-purple-600/50 text-purple-200' : 'text-gray-400 hover:text-white'}`}>
                By Link
              </button>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {Object.entries(topPeriodLabels).map(([key, { label }]) => (
                <button key={key} onClick={() => setJourneyDays(key)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors
                    ${journeyDays === key ? 'bg-purple-600/50 text-purple-200' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {journeyTab === 'byUser' ? (
          /* By User view */
          journeyLoading ? (
            <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : journeyData.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8">No journey data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                    <th className="px-4 py-2.5 text-left text-gray-500">User</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Clicks</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Detail</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Downloads</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Bounce</th>
                    <th className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">Detail Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {journeyData.map((j) => (
                    <tr key={j.userId} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <p className="text-white font-medium">{j.realName}</p>
                        <p className="text-[10px] text-gray-600">@{j.username}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-semibold">{j.totalClicks.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-purple-400">{j.detailVisits}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{j.downloadVisits}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={j.bounceRate > 60 ? 'text-red-400' : j.bounceRate > 30 ? 'text-amber-400' : 'text-green-400'}>
                          {j.bounceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-cyan-400 hidden sm:table-cell">{j.detailRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* By Link view */
          journeyLoading ? (
            <div className="flex justify-center py-8"><span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : linkJourneyData.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8">No link journey data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                    <th className="px-4 py-2.5 text-left text-gray-500">Link</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Clicks</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Detail</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Download</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Bounce</th>
                    <th className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">Download %</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 hidden sm:table-cell">User</th>
                  </tr>
                </thead>
                <tbody>
                  {linkJourneyData.map((l) => (
                    <tr key={l.code} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <p className="text-white font-medium truncate max-w-[180px]">{l.label}</p>
                        <p className="text-[10px] text-gray-600">go.animebing.in/{l.code}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-semibold">{l.totalClicks.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-purple-400">{l.detailVisits}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{l.downloadVisits}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={l.bounceRate > 60 ? 'text-red-400' : l.bounceRate > 30 ? 'text-amber-400' : 'text-green-400'}>
                          {l.bounceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-cyan-400 hidden sm:table-cell">{l.downloadRate}%</td>
                      <td className="px-4 py-2.5 text-left text-gray-400 hidden sm:table-cell">{l.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

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