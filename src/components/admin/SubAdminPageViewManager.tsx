 // src/components/admin/SubAdminPageViewManager.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

interface DailyPoint { date: string; views: number }
interface TopPage {
  path: string; views: number; pageType: string;
  animeTitle?: string; slug?: string; device?: string;
  createdByUsername?: string | null;
  animeId?: string;
  detailViews?: number;
  downloadViews?: number;
}
interface ByCountry { country: string; views: number }

interface Stats {
  totalViews: number; todayViews: number; uniqueVisitors: number;
  dailyChart: DailyPoint[]; topPages: TopPage[];
  allTimeTotalViews: number; allTimeUniqueVisitors: number;
  todayUniqueVisitors?: number;
}

interface GeoDetail {
  country: string; totalViews: number; uniqueVisitors: number;
  cities: { city: string; region: string; views: number; uniqueVisitors: number }[];
}

interface MonthlyOverviewItem {
  month: string;   // "YYYY-MM"
  views: number;
  animeViews: number;
  downloadViews: number;
}

interface MonthlyDetail {
  month: string;
  days: {
    date: string;
    totalViews: number;
    animeViews: number;
    downloadViews: number;
    otherViews: number;
  }[];
  totals: {
    totalViews: number;
    animeViews: number;
    downloadViews: number;
    otherViews: number;
  };
}

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
interface CohortRow {
  month: string; total: number; active30: number; active60: number; active90: number
  retention30: number; retention60: number; retention90: number
  avgClicks: number; totalClicks: number; totalEarnings: number
}

const TYPE_COLOR: Record<string, string> = {
  'anime-detail': '#a78bfa', 'download': '#34d399', 'anime-list': '#60a5fa',
  'home': '#f472b6', 'episode': '#fb923c', 'top-100': '#facc15',
  'contact': '#94a3b8', 'privacy': '#94a3b8', 'terms': '#94a3b8',
  'dmca': '#94a3b8', 'earn-money': '#6ee7b7', 'other': '#475569',
  'anime-combined': '#c084fc',
};
const DEVICE_COLOR: Record<string, string> = {
  mobile: '#a78bfa', desktop: '#34d399', tablet: '#60a5fa', unknown: '#475569',
};
const PAGE_TYPE_LABEL: Record<string, string> = {
  'anime-detail': 'Anime Detail', 'download': 'Download Page', 'anime-list': 'Anime List',
  'home': 'Home Page', 'episode': 'Episode', 'top-100': 'Top 100',
  'contact': 'Contact', 'privacy': 'Privacy', 'terms': 'Terms',
  'dmca': 'DMCA', 'earn-money': 'Earn Money', 'other': 'Other',
  'anime-combined': 'Anime',
};

function viewsToColor(views: number, maxViews: number): string {
  if (!views || !maxViews) return '#1a1930';
  const intensity = Math.pow(views / maxViews, 0.4);
  const r = Math.round(60 + intensity * 107);
  const g = Math.round(26 + intensity * 13);
  const b = Math.round(100 + intensity * 150);
  return `rgb(${r},${g},${b})`;
}

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

const GALineChart: React.FC<{ data: DailyPoint[]; days: number; height?: number }> = ({ data, days, height = 260 }) => {
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

// ─── World Map (Visitors by Country) ──────────────────────────────────────
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

      <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3">
        <span className="text-[10px] text-gray-600">Less</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{ background: 'linear-gradient(to right, #1a1930, #6b21a8, #a855f7)' }}
        />
        <span className="text-[10px] text-gray-600">More</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-white/[0.06]">
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

// ─── Main Component ───────────────────────────────────────────────────────
interface SubAdminPageViewManagerProps { token: string }

const topPeriodLabels: Record<string, { label: string; days: number }> = {
  daily: { label: 'Today', days: 1 },
  weekly: { label: 'Week', days: 7 },
  monthly: { label: 'Month', days: 30 },
  yearly: { label: 'Year', days: 365 },
};

const SubAdminPageViewManager: React.FC<SubAdminPageViewManagerProps> = ({ token }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days] = useState(7);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [topPeriod, setTopPeriod] = useState<string>('daily');
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [topLoading, setTopLoading] = useState(false);

  const [countryPeriod, setCountryPeriod] = useState<string>('daily');
  const [byCountry, setByCountry] = useState<ByCountry[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);

  // ─── Monthly Overview states ────────────────────────────────────────────
  const [monthlyOverview, setMonthlyOverview] = useState<MonthlyOverviewItem[]>([]);
  const [monthlyOverviewLoading, setMonthlyOverviewLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthlyDetail, setMonthlyDetail] = useState<MonthlyDetail | null>(null);
  const [monthlyDetailLoading, setMonthlyDetailLoading] = useState(false);

  const [userLinksPeriod, setUserLinksPeriod] = useState<string>('daily');
  const [userLinksData, setUserLinksData] = useState<UserLinkStat[]>([]);
  const [userLinksLoading, setUserLinksLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [earningsData, setEarningsData] = useState<EarningsUser[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [expandedEarningsUser, setExpandedEarningsUser] = useState<string | null>(null);

  const [fraudData, setFraudData] = useState<FraudAlert[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudDays, setFraudDays] = useState('weekly');

  const [leaderData, setLeaderData] = useState<{ byToday: LeaderUser[]; byWeek: LeaderUser[]; byAllTime: LeaderUser[]; byStreak: LeaderUser[] } | null>(null);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderTab, setLeaderTab] = useState<'byToday' | 'byWeek' | 'byAllTime' | 'byStreak'>('byToday');

  const [cohortData, setCohortData] = useState<CohortRow[]>([]);
  const [cohortLoading, setCohortLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/stats`, {
        params: { days },
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days, token]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchTopPages = useCallback(async () => {
    setTopLoading(true);
    try {
      const topDays = topPeriodLabels[topPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/stats`, {
        params: { days: topDays },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTopPages(data.topPages || []);
    } catch {
      toast.error('Failed to load top pages');
    } finally {
      setTopLoading(false);
    }
  }, [topPeriod, token]);
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

  // ─── Fetch Monthly Overview ──────────────────────────────────────────────
  const fetchMonthlyOverview = useCallback(async () => {
    setMonthlyOverviewLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/monthly-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const months: MonthlyOverviewItem[] = data.months || [];
      setMonthlyOverview(months);
      setSelectedMonth(prev => prev || (months.length ? months[months.length - 1].month : ''));
    } catch {
      toast.error('Failed to load monthly overview');
    } finally {
      setMonthlyOverviewLoading(false);
    }
  }, [token]);
  useEffect(() => { fetchMonthlyOverview(); }, [fetchMonthlyOverview]);

  const fetchMonthlyDetail = useCallback(async () => {
    if (!selectedMonth) return;
    setMonthlyDetailLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/monthly-detail`, {
        params: { month: selectedMonth },
        headers: { Authorization: `Bearer ${token}` },
      });
      setMonthlyDetail(data);
    } catch {
      toast.error('Failed to load monthly detail');
    } finally {
      setMonthlyDetailLoading(false);
    }
  }, [selectedMonth, token]);
  useEffect(() => { fetchMonthlyDetail(); }, [fetchMonthlyDetail]);

  const fetchUserLinks = useCallback(async () => {
    setUserLinksLoading(true);
    try {
      const d = topPeriodLabels[userLinksPeriod]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/user-links`, {
        params: { days: d },
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserLinksData(data.users || []);
    } catch {
      toast.error('Failed to load user link analytics');
    } finally {
      setUserLinksLoading(false);
    }
  }, [userLinksPeriod, token]);
  useEffect(() => { fetchUserLinks(); }, [fetchUserLinks]);

  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/earnings-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEarningsData(data.users || []);
    } catch { toast.error('Failed to load earnings data'); }
    finally { setEarningsLoading(false); }
  }, [token]);
  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  const fetchFraud = useCallback(async () => {
    setFraudLoading(true);
    try {
      const d = topPeriodLabels[fraudDays]?.days ?? 7;
      const { data } = await axios.get(`${API_BASE}/analytics/fraud`, {
        params: { days: d }, headers: { Authorization: `Bearer ${token}` },
      });
      setFraudData(data.alerts || []);
    } catch { toast.error('Failed to load fraud data'); }
    finally { setFraudLoading(false); }
  }, [fraudDays, token]);
  useEffect(() => { fetchFraud(); }, [fetchFraud]);

  const fetchLeader = useCallback(async () => {
    setLeaderLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaderData(data);
    } catch { toast.error('Failed to load leaderboard'); }
    finally { setLeaderLoading(false); }
  }, [token]);
  useEffect(() => { fetchLeader(); }, [fetchLeader]);

  const fetchCohort = useCallback(async () => {
    setCohortLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/cohort`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCohortData(data.cohorts || []);
    } catch { toast.error('Failed to load cohort data'); }
    finally { setCohortLoading(false); }
  }, [token]);
  useEffect(() => { fetchCohort(); }, [fetchCohort]);

  const filteredPages = (topPages || []).filter(p => {
    const matchSearch = !search ||
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      (p.animeTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.pageType === typeFilter;
    return matchSearch && matchType;
  });
  const allTypes = Array.from(new Set((topPages || []).map(p => p.pageType)));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">My Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">Scoped to anime and links you own</p>
        </div>
        <button onClick={fetchStats}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Daily Views — Last 7 Days ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Today's Views" value={stats?.todayViews ?? 0} sub="Since midnight IST" color="text-cyan-400" />
        <StatCard label="Total Views (7d)" value={stats?.totalViews ?? 0} sub="Selected period" color="text-purple-400" />
        <StatCard label="Unique Visitors" value={stats?.uniqueVisitors ?? 0} sub="Last 7 days" color="text-emerald-400" />
      </div>

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Daily Views — Last 7 Days
          </p>
          {stats?.dailyChart?.length ? (
            <span className="text-[11px] text-gray-600">
              {stats.dailyChart[0]?.date} – {stats.dailyChart[stats.dailyChart.length - 1]?.date}
            </span>
          ) : null}
        </div>
        <GALineChart data={stats?.dailyChart ?? []} days={days} height={260} />
      </div>

      {/* ── Visitors by Country ────────────────────────────────────────── */}
      <WorldMap
        byCountry={byCountry}
        token={token}
        days={topPeriodLabels[countryPeriod]?.days ?? 1}
        countryPeriod={countryPeriod}
        setCountryPeriod={setCountryPeriod}
        loading={countryLoading}
      />

      {/* ── Monthly Overview ──────────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monthly Overview</p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Total views & breakdown by month (all time)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {monthlyOverviewLoading ? (
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
              >
                {monthlyOverview.map(m => (
                  <option key={m.month} value={m.month} className="bg-[#1c1b29] text-gray-300">
                    {m.month}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Monthly summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          {monthlyOverviewLoading ? (
            <div className="col-span-full flex justify-center py-6">
              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            monthlyOverview
              .filter(m => m.month === selectedMonth)
              .map(m => (
                <React.Fragment key={m.month}>
                  <StatCard label="Total Views" value={m.views} color="text-purple-400" />
                  <StatCard label="Anime Views" value={m.animeViews} color="text-cyan-400" />
                  <StatCard label="Download Views" value={m.downloadViews} color="text-emerald-400" />
                  <StatCard label="Other" value={m.views - m.animeViews - m.downloadViews} color="text-gray-400" />
                </React.Fragment>
              ))
          )}
        </div>

        {/* Daily detail for selected month */}
        {selectedMonth && (
          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Daily Breakdown — {selectedMonth}
              </p>
              {monthlyDetail && (
                <span className="text-[11px] text-gray-600">
                  {monthlyDetail.days.length} days
                </span>
              )}
            </div>
            {monthlyDetailLoading ? (
              <div className="flex justify-center py-8">
                <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : monthlyDetail ? (
              <>
                <GALineChart
                  data={monthlyDetail.days.map(d => ({ date: d.date, views: d.totalViews }))}
                  days={monthlyDetail.days.length}
                  height={220}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Total</p>
                    <p className="text-sm font-semibold text-white">{monthlyDetail.totals.totalViews.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Anime</p>
                    <p className="text-sm font-semibold text-cyan-400">{monthlyDetail.totals.animeViews.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Download</p>
                    <p className="text-sm font-semibold text-emerald-400">{monthlyDetail.totals.downloadViews.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Other</p>
                    <p className="text-sm font-semibold text-gray-400">{monthlyDetail.totals.otherViews.toLocaleString()}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-600 text-xs text-center py-8">Select a month to see daily detail</p>
            )}
          </div>
        )}
      </div>

      {/* ── User Link Analytics ───────────────────────────────────────── */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Link Analytics</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Your shortener users only</p>
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
              const isExpanded = expandedUser === u.userId;
              const topCountry = u.byCountry[0];
              const returningPct = u.uniqueVisitors > 0
                ? Math.round((u.returningVisitors / u.uniqueVisitors) * 100) : 0;

              return (
                <div key={u.userId}>
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-300 text-xs font-semibold">
                        {u.realName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{u.realName}</p>
                      <p className="text-[10px] text-gray-500">@{u.username} · {u.links.length} link{u.links.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-purple-400">{u.clicksInPeriod.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-600">period clicks</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-cyan-400">{u.uniqueVisitors.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-600">unique</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-sm font-semibold text-emerald-400">{returningPct}%</p>
                      <p className="text-[10px] text-gray-600">returning</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden lg:block w-16">
                      <p className="text-xs text-gray-300">{topCountry ? (COUNTRY_NAMES[topCountry.country] || topCountry.country) : '—'}</p>
                      <p className="text-[10px] text-gray-600">top country</p>
                    </div>
                    <span className={`text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-white/[0.02] px-4 py-4 space-y-4">
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

                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Daily clicks (last 7 days)</p>
                        <div className="flex items-end gap-1 h-16">
                          {u.dailyClicks.map((d, i) => {
                            const maxC = Math.max(...u.dailyClicks.map(x => x.clicks), 1);
                            const h = (d.clicks / maxC) * 100;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                                {d.clicks > 0 && <span className="text-[8px] text-gray-500">{d.clicks}</span>}
                                <div className="w-full bg-purple-500/70 rounded-t" style={{ height: `${Math.max(h, 3)}%` }} />
                                <span className="text-[8px] text-gray-600">{d.date.split(' ')[0]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

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
              );
            })}
          </div>
        )}
      </div>

      {/* ── Earnings & Link Health ────────────────────────────────────── */}
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
              const isExp = expandedEarningsUser === u.userId;
              const maxEarning = Math.max(...u.earningsTimeline.map(d => d.earnings), 0.001);
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
                              lk.status === 'declining' ? 'text-amber-400 bg-amber-500/10' : 'text-cyan-400 bg-cyan-500/10';
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${statusColor}`}>{lk.status}</span>
                                <span className="text-gray-300 truncate flex-1">{lk.label}</span>
                                <span className="text-gray-500 text-[10px]">{lk.recentClicks} last 7d</span>
                                <span className="text-white font-medium">{lk.totalClicks} total</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Fraud & Bot Detection ─────────────────────────────────────── */}
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

      {/* ── Leaderboard & Streaks ─────────────────────────────────────── */}
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
              const medal = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
              const medalColor = idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-700' : 'text-gray-600';
              const value = leaderTab === 'byToday' ? u.todayClicks
                : leaderTab === 'byWeek' ? u.weekClicks
                : leaderTab === 'byStreak' ? u.clickStreak
                : u.totalClicks;
              const label = leaderTab === 'byStreak' ? 'day streak' : 'clicks';
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── User Cohort Analysis ──────────────────────────────────────── */}
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

      {/* ── Top Pages ─────────────────────────────────────────────────── */}
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
                </tr>
              </thead>
              <tbody>
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
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
                      <td className="px-4 py-3 text-right">
                        {page.pageType === 'anime-combined' ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-purple-400 text-xs font-semibold">
                              {(page.detailViews ?? 0).toLocaleString()} <span className="text-gray-300 font-normal">detail</span>
                            </span>
                            <span className="text-emerald-400 text-xs font-semibold">
                              {(page.downloadViews ?? 0).toLocaleString()} <span className="text-gray-300 font-normal">download</span>
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-white">{page.views.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubAdminPageViewManager;