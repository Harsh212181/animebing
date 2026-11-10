import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PostCodesPanel from './PostCodesPanel';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/* ============================================================
   TYPES
   ============================================================ */
interface InstagramAccount {
  _id: string;
  igUsername: string;
  igUserId: string;
  isActive: boolean;
  connectedAt?: string;
  profilePictureUrl?: string | null;
  createdBy?: string | null;
  createdByUsername?: string;
  tokenExpiresAt?: string | null;
  tokenStatus?: 'ok' | 'error' | 'expired' | null;
  tokenError?: string | null;
}

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
}

interface AutomationRule {
  _id: string;
  accountId: string;
  keyword: string;
  matchType: 'exact' | 'contains';
  dmMessage: string;
  isActive: boolean;
  postId?: string | null;
  postThumbnail?: string | null;
  postCaption?: string | null;
}

type LogStatus = 'sent' | 'failed' | 'queued' | 'limit_reached' | 'processing';

interface AutomationLog {
  _id: string;
  accountId: string;
  keyword: string;
  matchedText: string;
  status: LogStatus;
  error?: string;
  createdAt: string;
}

type RuleForm = { keyword: string; matchType: 'exact' | 'contains'; dmMessage: string };
type Tab = 'rules' | 'codes' | 'logs';
type LogGroup = 'all' | 'sent' | 'failed' | 'queued' | 'limit';

/* ============================================================
   CONSTANTS
   ============================================================ */
const LOG_PAGE_SIZE = 25;
const DEFAULT_DM_TEMPLATE = 'Here is your link: {link}';
const DEFAULT_MATCH_TYPE: 'exact' | 'contains' = 'exact';

const LOG_STYLE: Record<LogStatus, { label: string; badge: string; dot: string; group: LogGroup }> = {
  sent:          { label: 'Sent',       badge: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200',       dot: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]', group: 'sent' },
  failed:        { label: 'Failed',     badge: 'border-red-400/30 bg-red-500/15 text-red-200',           dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]', group: 'failed' },
  queued:        { label: 'Queued',     badge: 'border-amber-400/30 bg-amber-500/15 text-amber-200',     dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]', group: 'queued' },
  processing:    { label: 'Sending',    badge: 'border-sky-400/30 bg-sky-500/15 text-sky-200',           dot: 'bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]', group: 'queued' },
  limit_reached: { label: 'Limit hit',  badge: 'border-orange-400/30 bg-orange-500/15 text-orange-200',  dot: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]', group: 'limit' },
};

const LOG_FILTERS: { id: LogGroup; label: string; dot?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent', dot: 'bg-cyan-400' },
  { id: 'failed', label: 'Failed', dot: 'bg-red-400' },
  { id: 'queued', label: 'Queued', dot: 'bg-amber-400' },
  { id: 'limit', label: 'Limit hit', dot: 'bg-orange-400' },
];

const MATCH_OPTIONS = [
  { value: 'exact', label: 'Exact match' },
  { value: 'contains', label: 'Contains (anywhere)' },
];

const INPUT_CLS =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60';

const IG_GRADIENT = 'bg-violet-600';

/* ============================================================
   HELPERS
   ============================================================ */
const formatRelativeTime = (iso: string): string => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const getTokenInfo = (acc: InstagramAccount): { text: string; tone: 'red' | 'amber' | 'cyan' | 'gray'; pct: number } => {
  if (acc.tokenStatus === 'expired') return { text: 'Expired, reconnect', tone: 'red', pct: 0 };
  if (!acc.tokenExpiresAt) return { text: 'Expiry unknown', tone: 'gray', pct: 0 };
  const daysLeft = Math.ceil((new Date(acc.tokenExpiresAt).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return { text: 'Expired, reconnect', tone: 'red', pct: 0 };
  const pct = Math.min(100, Math.round((daysLeft / 60) * 100));
  if (daysLeft <= 7) return { text: `${daysLeft}d left`, tone: 'red', pct };
  if (daysLeft <= 20) return { text: `${daysLeft}d left`, tone: 'amber', pct };
  return { text: `${daysLeft}d left`, tone: 'cyan', pct };
};

const TONE_TEXT = { red: 'text-red-300', amber: 'text-amber-300', cyan: 'text-cyan-300', gray: 'text-white/40' };
const TONE_BAR = { red: 'bg-red-400', amber: 'bg-amber-400', cyan: 'bg-cyan-400', gray: 'bg-white/20' };

const errMsg = (e: any, fallback: string): string => e?.response?.data?.error || fallback;

const renderDm = (text: string): React.ReactNode =>
  text.split(/(\{link\})/g).map((part, i) =>
    part === '{link}' ? (
      <span key={i} className="rounded bg-sky-400/15 px-1 font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2">
        animebing.in/your-link
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );

/* ============================================================
   ICONS
   ============================================================ */
type IconName =
  | 'plus' | 'trash' | 'check' | 'close' | 'chevronDown' | 'refresh'
  | 'search' | 'inbox' | 'warning' | 'globe' | 'key' | 'user'
  | 'play' | 'sparkles' | 'link' | 'message' | 'zap' | 'chart'
  | 'shield' | 'external' | 'activity' | 'clock' | 'info'
  | 'rocket' | 'userCircle' | 'filter' | 'grid' | 'send' | 'pause' | 'image';

const ICON_ELEMENTS: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  trash: <path d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.99-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />,
  chevronDown: <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />,
  refresh: (
    <>
      <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 11a8 8 0 0116 0" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </>
  ),
  inbox: <path d="M3 8l1.5-4.5A1 1 0 015.45 3h13.1a1 1 0 01.95.68L21 8m-18 0v10a2 2 0 002 2h14a2 2 0 002-2V8m-18 0h18m-13 4h8" strokeLinecap="round" strokeLinejoin="round" />,
  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeLinecap="round" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" strokeLinecap="round" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  sparkles: (
    <>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" strokeLinejoin="round" />
      <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75z" strokeLinejoin="round" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  message: <path d="M8 10h8M8 14h5m-5 7l-4-4V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H9z" strokeLinecap="round" strokeLinejoin="round" />,
  zap: <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinejoin="round" />,
  chart: <path d="M3 20h18M7 16V8m5 8V4m5 12v-6" strokeLinecap="round" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" strokeLinejoin="round" />,
  external: <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />,
  activity: <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
    </>
  ),
  rocket: <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" strokeLinecap="round" strokeLinejoin="round" />,
  userCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 20c1-3.5 3.5-5 5.5-5s4.5 1.5 5.5 5" strokeLinecap="round" />
    </>
  ),
  filter: <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-5.586L3.293 6.707A1 1 0 013 6V4z" strokeLinecap="round" strokeLinejoin="round" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />,
  pause: <path d="M10 5v14M16 5v14" strokeLinecap="round" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

const Icon: React.FC<{ name: IconName; className?: string }> = ({ name, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    {ICON_ELEMENTS[name]}
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 7.38a4.62 4.62 0 100 9.24 4.62 4.62 0 000-9.24zm6.635-3.539a1.08 1.08 0 100-2.16 1.08 1.08 0 000 2.16z" />
  </svg>
);

const Spinner: React.FC<{ className?: string }> = ({ className = 'h-3 w-3' }) => (
  <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none`} />
);

/* ============================================================
   UI PRIMITIVES
   ============================================================ */
type BtnColor = 'primary' | 'instagram' | 'indigo' | 'cyan' | 'yellow' | 'red' | 'gray' | 'ghost';

const BTN_COLORS: Record<BtnColor, string> = {
  primary: 'border-transparent bg-violet-600 font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-95',
  instagram: `border-transparent bg-violet-600 font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-95`,
  indigo: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200 hover:border-indigo-300/50 hover:bg-indigo-500/20',
  cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200 hover:border-cyan-300/50 hover:bg-cyan-500/20',
  yellow: 'border-amber-400/25 bg-amber-500/10 text-amber-200 hover:border-amber-300/50 hover:bg-amber-500/20',
  red: 'border-red-400/25 bg-red-500/10 text-red-200 hover:border-red-300/50 hover:bg-red-500/20',
  gray: 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/10',
  ghost: 'border-transparent text-white/60 hover:bg-white/5 hover:text-white',
};

const Btn: React.FC<{
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  color?: BtnColor;
  size?: 'sm' | 'md' | 'icon';
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  className?: string;
}> = ({ children, onClick, color = 'gray', size = 'sm', type = 'button', disabled, loading, title, className = '' }) => (
  <button
    type={type}
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
      size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'icon' ? 'p-2' : 'px-4 py-2.5 text-sm'
    } ${BTN_COLORS[color]} ${className}`}
  >
    {loading && <Spinner />}
    {children}
  </button>
);

/** Premium toggle — cyan glow when ON */
const Switch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean; label: string }> = ({
  checked, onChange, disabled, label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:opacity-50 ${
      checked
        ? 'bg-cyan-500 shadow-[0_0_14px_-2px_rgba(6,182,212,0.65)]'
        : 'bg-white/15 hover:bg-white/20'
    }`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300 ease-out ${checked ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);

const StyledSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${INPUT_CLS} appearance-none pr-9`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/50">
      <Icon name="chevronDown" className="h-3.5 w-3.5" />
    </div>
  </div>
);

const SafeImage: React.FC<{
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}> = ({ src, alt, className, fallback = null }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className={className} />
  );
};

const AccountAvatar: React.FC<{ url?: string | null; name: string }> = ({ url, name }) => (
  <SafeImage
    src={url}
    alt={name}
    className="h-full w-full object-cover"
    fallback={
      <span className="flex h-full w-full items-center justify-center bg-slate-800 text-sm font-bold text-white">
        {(name || '?').charAt(0).toUpperCase()}
      </span>
    }
  />
);

const EmptyState: React.FC<{
  icon?: IconName;
  title?: string;
  text: string;
  action?: React.ReactNode;
}> = ({ icon = 'inbox', title, text, action }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 text-violet-300 ring-1 ring-violet-500/25">
      <span className="absolute inset-0 rounded-2xl bg-violet-500/15 blur-xl" />
      <Icon name={icon} className="relative h-6 w-6" />
    </span>
    <div className="space-y-1">
      {title && <p className="text-sm font-semibold text-white/85">{title}</p>}
      <p className="mx-auto max-w-xs text-xs leading-relaxed text-white/45">{text}</p>
    </div>
    {action}
  </div>
);

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-white/[0.05] ${className}`} />
);

/* ---------- Stat card + ring ---------- */
const Ring: React.FC<{ pct: number; tone?: string }> = ({ pct, tone = 'stroke-cyan-400' }) => {
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
      <circle cx="22" cy="22" r={R} fill="none" className="stroke-white/10" strokeWidth="5" />
      <circle
        cx="22" cy="22" r={R} fill="none" className={tone} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`}
      />
    </svg>
  );
};

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: IconName;
  accent: string;
  glow?: string;
  right?: React.ReactNode;
}> = ({ label, value, sub, icon, accent, glow = '', right }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3.5 transition-all hover:border-white/[0.15]">
    {glow && <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${glow} blur-2xl opacity-40 transition-opacity group-hover:opacity-70`} />}
    <div className="relative flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs text-white/50">
          <span className={`flex h-5 w-5 items-center justify-center rounded-md ${accent}`}>
            <Icon name={icon} className="h-3 w-3" />
          </span>
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-white/40">{sub}</p>}
      </div>
      {right}
    </div>
  </div>
);

/* ============================================================
   POST PICKER GRID
   ============================================================ */
const PostPickerGrid: React.FC<{
  posts: InstagramPost[];
  loading: boolean;
  selectedPostId: string;
  onSelect: (id: string) => void;
  excludePostIds?: string[];
  disabled?: boolean;
}> = ({ posts, loading, selectedPostId, onSelect, excludePostIds = [], disabled = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="aspect-square" />)}
      </div>
    );
  }

  const available = posts.filter((p) => !excludePostIds.includes(p.id));

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div className="ig-auto-scroll grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
            selectedPostId === ''
              ? 'border-violet-400/70 bg-violet-500/15 shadow-lg shadow-violet-500/20'
              : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
          }`}
        >
          <Icon name="globe" className={`h-4 w-4 ${selectedPostId === '' ? 'text-violet-300' : 'text-white/60'}`} />
          <span className="text-[10px] font-medium leading-tight text-white/75">All posts</span>
        </button>

        {available.map((post) => {
          const thumb = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
          const selected = selectedPostId === post.id;
          return (
            <button
              type="button"
              key={post.id}
              onClick={() => onSelect(post.id)}
              title={post.caption || 'No caption'}
              className={`group relative aspect-square overflow-hidden rounded-xl border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                selected ? 'border-violet-400 shadow-lg shadow-violet-500/25' : 'border-white/10 hover:border-white/40'
              }`}
            >
              <SafeImage
                src={thumb}
                alt={post.caption || 'post'}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/25">
                    <Icon name="image" className="h-4 w-4" />
                  </div>
                }
              />
              <div className={`absolute inset-0 transition ${selected ? 'bg-violet-600/25' : 'bg-black/0 group-hover:bg-black/25'}`} />
              {selected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg">
                  <Icon name="check" className="h-2.5 w-2.5" />
                </span>
              )}
              {post.media_type === 'VIDEO' && (
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">
                  <Icon name="play" className="h-2 w-2" /> Reel
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   DM PREVIEW
   ============================================================ */
const DmPreview: React.FC<{ keyword: string; message: string }> = ({ keyword, message }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-black/30 to-black/20 p-3">
    <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-white/40">
      <Icon name="message" className="h-3 w-3" /> Preview
    </p>
    <div className="space-y-2">
      <div className="flex justify-start">
        <span className="max-w-[80%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-1.5 text-xs text-white/80">
          {keyword || 'keyword'}
        </span>
      </div>
      <div className="flex justify-end">
        <span className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3 py-2 text-xs leading-relaxed text-white shadow-lg shadow-violet-500/20 ${IG_GRADIENT}`}>
          {message ? renderDm(message) : <span className="text-white/60">Your DM will appear here</span>}
        </span>
      </div>
    </div>
  </div>
);

/* ============================================================
   RULE ROW
   ============================================================ */
const RuleRow: React.FC<{
  rule: AutomationRule;
  expanded: boolean;
  pendingAction: string | null;
  onExpand: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, updates: RuleForm) => void;
}> = ({ rule, expanded, pendingAction, onExpand, onToggle, onDelete, onSave }) => {
  const [form, setForm] = useState<RuleForm>({ keyword: rule.keyword, matchType: rule.matchType, dmMessage: rule.dmMessage });

  useEffect(() => {
    if (!expanded) setForm({ keyword: rule.keyword, matchType: rule.matchType, dmMessage: rule.dmMessage });
  }, [expanded, rule.keyword, rule.matchType, rule.dmMessage]);

  const isSaving = pendingAction === `update-rule-${rule._id}`;
  const isToggling = pendingAction === `toggle-rule-${rule._id}`;
  const isDeleting = pendingAction === `delete-rule-${rule._id}`;
  const busy = isSaving || isToggling || isDeleting;

  const save = () => {
    if (!form.keyword.trim() || !form.dmMessage.trim()) return;
    onSave(rule._id, form);
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
        isDeleting ? 'pointer-events-none opacity-50' : ''
      } ${expanded ? 'border-violet-400/40 bg-gradient-to-br from-violet-500/[0.06] to-transparent shadow-lg shadow-violet-500/5' : 'border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]'} ${
        !rule.isActive && !expanded ? 'opacity-70' : ''
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-3 p-3"
        onClick={onExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <SafeImage
            src={rule.postThumbnail}
            alt="post"
            className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center text-white/35">
                <Icon name="globe" className="h-5 w-5" />
              </div>
            }
          />
          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-tl-md ${rule.isActive ? 'bg-cyan-400' : 'bg-white/30'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-sm font-semibold text-violet-200">
              {rule.keyword}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/55">
              {rule.matchType === 'exact' ? 'Exact' : 'Contains'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/55">
              <Icon name={rule.postId ? 'image' : 'globe'} className="h-2.5 w-2.5" />
              {rule.postId ? 'Single post' : 'All posts'}
            </span>
            {!rule.isActive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Icon name="pause" className="h-2.5 w-2.5" /> Paused
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-white/45">{rule.dmMessage}</p>
        </div>

        <Switch checked={rule.isActive} onChange={() => onToggle(rule._id, rule.isActive)} disabled={busy} label={rule.isActive ? 'Pause rule' : 'Resume rule'} />
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-white/[0.06] p-3 md:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            {rule.postId && (
              <div className="flex items-start gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2 text-[11px] text-violet-200/90">
                <Icon name="image" className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{rule.postCaption ? rule.postCaption.slice(0, 120) : rule.postId}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Keyword</label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="Keyword"
                  disabled={isSaving}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Match type</label>
                <StyledSelect
                  value={form.matchType}
                  onChange={(v) => setForm({ ...form, matchType: v as 'exact' | 'contains' })}
                  disabled={isSaving}
                  options={MATCH_OPTIONS}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">DM message</label>
              <textarea
                value={form.dmMessage}
                onChange={(e) => setForm({ ...form, dmMessage: e.target.value })}
                rows={3}
                placeholder="DM message"
                disabled={isSaving}
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Btn color="red" onClick={() => onDelete(rule._id)} disabled={busy}>
                <Icon name="trash" className="h-3.5 w-3.5" /> Delete rule
              </Btn>
              <div className="flex gap-2">
                <Btn onClick={onExpand} disabled={isSaving}>Cancel</Btn>
                <Btn color="cyan" onClick={save} loading={isSaving}>
                  <Icon name="check" className="h-3.5 w-3.5" /> Save changes
                </Btn>
              </div>
            </div>
          </div>
          <DmPreview keyword={form.keyword} message={form.dmMessage} />
        </div>
      )}
    </div>
  );
};

/* ============================================================
   LOG ROW
   ============================================================ */
const LogRow: React.FC<{ log: AutomationLog }> = ({ log }) => {
  const s = LOG_STYLE[log.status] || LOG_STYLE.failed;
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]" title={log.error || ''}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white/85">
          <span className="font-semibold text-violet-200">{log.keyword}</span>
          <span className="mx-1.5 text-white/20">|</span>
          <span className="text-white/55">{log.matchedText}</span>
        </p>
        {log.status === 'failed' && log.error && (
          <p className="mt-0.5 truncate text-[11px] text-red-300/80">{log.error}</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{s.label}</span>
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-white/35 sm:block" title={new Date(log.createdAt).toLocaleString()}>
        {formatRelativeTime(log.createdAt)}
      </span>
    </div>
  );
};

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, loading = false, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1726] to-[#12111c] p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 text-red-400 ring-1 ring-red-500/30">
            <Icon name="warning" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn onClick={onCancel} disabled={loading}>Cancel</Btn>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] hover:shadow-red-500/30 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          >
            {loading ? <Spinner className="h-3 w-3" /> : <Icon name="trash" className="h-3 w-3" />}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
interface InstagramAutomationManagerProps {
  token?: string;
  apiBase?: string;
  subAdminMode?: boolean;
}

const InstagramAutomationManager: React.FC<InstagramAutomationManagerProps> = ({
  token: tokenProp, apiBase, subAdminMode = false,
}) => {
  const token = tokenProp || localStorage.getItem('adminToken') || '';
  const API = apiBase || API_BASE;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const base = `${API}/instagram-automation`;

  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [tab, setTab] = useState<Tab>('rules');

  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState('');

  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<RuleForm>({
    keyword: '',
    matchType: DEFAULT_MATCH_TYPE,
    dmMessage: DEFAULT_DM_TEMPLATE,
  });
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = useState('');

  const [logFilter, setLogFilter] = useState<LogGroup>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logLimit, setLogLimit] = useState(LOG_PAGE_SIZE);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [, forceTick] = useState(0);

  const [confirmModal, setConfirmModal] = useState({
    open: false, title: '', message: '', loading: false, onConfirm: () => {},
  });
  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, open: false, loading: false }));

  const pendingRef = useRef<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isPending = (key: string) => pendingAction === key;

  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPendingAction(key);
    try {
      await fn();
    } catch {
      /* each action handles its own errors */
    } finally {
      setTimeout(() => {
        pendingRef.current.delete(key);
        setPendingAction((prev) => (prev === key ? null : prev));
      }, 250);
    }
  };

  const run = (
    key: string,
    msgs: { loading?: string; success?: string; fail: string },
    fn: () => Promise<void>,
  ) =>
    guarded(key, async () => {
      const id = msgs.loading ? toast.loading(msgs.loading) : undefined;
      try {
        await fn();
        if (msgs.success) toast.success(msgs.success, { id });
        else if (id) toast.dismiss(id);
      } catch (e) {
        toast.error(errMsg(e, msgs.fail), { id });
      }
    });

  const fetchAll = (silent = true) =>
    guarded('fetch-all', async () => {
      if (!silent) setLoading(true);
      try {
        const [a, r, l] = await Promise.all([
          axios.get(`${base}/accounts`, authHeaders),
          axios.get(`${base}/rules`, authHeaders),
          axios.get(`${base}/logs`, authHeaders),
        ]);
        const accData: InstagramAccount[] = a.data.accounts || [];
        setAccounts(accData);
        setRules(r.data.rules || []);
        setLogs(l.data.logs || []);
        setSelectedAccountId((prev) =>
          prev && accData.some((x) => x.igUserId === prev) ? prev : accData[0]?.igUserId || '',
        );
      } catch (e) {
        toast.error(errMsg(e, 'Failed to load Instagram data'));
      } finally {
        setLoading(false);
      }
    });

  const fetchPosts = (accountMongoId: string) =>
    guarded(`fetch-posts-${accountMongoId}`, async () => {
      setPostsLoading(true);
      try {
        const res = await axios.get(`${base}/accounts/${accountMongoId}/posts`, authHeaders);
        setPosts(res.data.posts || []);
      } catch (e: any) {
        console.error('Posts fetch error:', e.response?.data || e.message);
      } finally {
        setPostsLoading(false);
      }
    });

  const selectedAccount = accounts.find((a) => a.igUserId === selectedAccountId);

  const rulesForSelected = useMemo(
    () => rules.filter((r) => r.accountId === selectedAccountId),
    [rules, selectedAccountId],
  );

  const visibleRules = useMemo(() => {
    const s = ruleSearch.trim().toLowerCase();
    if (!s) return rulesForSelected;
    return rulesForSelected.filter(
      (r) => r.keyword.toLowerCase().includes(s) || (r.dmMessage || '').toLowerCase().includes(s),
    );
  }, [rulesForSelected, ruleSearch]);

  const accountLogs = useMemo(
    () => logs.filter((l) => l.accountId === selectedAccountId),
    [logs, selectedAccountId],
  );

  const logCounts = useMemo(() => {
    const c: Record<LogGroup, number> = { all: accountLogs.length, sent: 0, failed: 0, queued: 0, limit: 0 };
    accountLogs.forEach((l) => { c[(LOG_STYLE[l.status] || LOG_STYLE.failed).group]++; });
    return c;
  }, [accountLogs]);

  const filteredLogs = useMemo(() => {
    let f = accountLogs;
    if (logFilter !== 'all') f = f.filter((l) => (LOG_STYLE[l.status] || LOG_STYLE.failed).group === logFilter);
    const s = logSearch.trim().toLowerCase();
    if (s) f = f.filter((l) => (l.matchedText || '').toLowerCase().includes(s) || (l.keyword || '').toLowerCase().includes(s));
    return [...f].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  }, [accountLogs, logFilter, logSearch]);

  const groupedLogs = useMemo(() => {
    const groups: { label: string; items: AutomationLog[] }[] = [];
    filteredLogs.slice(0, logLimit).forEach((l) => {
      const label = dayLabel(l.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(l);
      else groups.push({ label, items: [l] });
    });
    return groups;
  }, [filteredLogs, logLimit]);

  const stats = useMemo(() => {
    const done = logCounts.sent + logCounts.failed;
    const rate = done > 0 ? Math.round((logCounts.sent / done) * 100) : 0;
    const activeRules = rulesForSelected.filter((r) => r.isActive).length;

    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const count = accountLogs.filter((l) => l.status === 'sent' && new Date(l.createdAt).toDateString() === key).length;
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), count });
    }
    return { rate, done, activeRules, days };
  }, [logCounts, rulesForSelected, accountLogs]);

  const activeAccounts = accounts.filter((a) => a.isActive).length;

  useEffect(() => {
    fetchAll(false);
    const tick = setInterval(() => forceTick((t) => t + 1), 30000);

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ig_connected') {
        toast.success(`@${e.data.username} connected`);
        fetchAll();
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      clearInterval(tick);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (showAddRule && selectedAccount) fetchPosts(selectedAccount._id);
  }, [showAddRule, selectedAccountId]);

  useEffect(() => {
    if (!(autoRefresh && tab === 'logs')) return;
    const id = setInterval(() => {
      guarded('auto-refresh-logs', async () => {
        try {
          const res = await axios.get(`${base}/logs`, authHeaders);
          if (res.data.logs) setLogs(res.data.logs);
        } catch { /* ignore */ }
      });
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, tab]);

  useEffect(() => { setLogLimit(LOG_PAGE_SIZE); }, [selectedAccountId, logFilter, logSearch]);

  const selectAccount = (acc: InstagramAccount) => {
    if (acc.igUserId === selectedAccountId) return;
    setSelectedAccountId(acc.igUserId);
    setSelectedPostId('');
    setExpandedRuleId(null);
    setShowAddRule(false);
    setRuleSearch('');
  };

  const handleToggleAccount = (id: string, isActive: boolean) =>
    run(`toggle-account-${id}`, { success: isActive ? 'Account paused' : 'Account resumed', fail: 'Update failed' }, async () => {
      await axios.put(`${base}/accounts/${id}`, { isActive: !isActive }, authHeaders);
      fetchAll();
    });

  const handleRefreshToken = (id: string) =>
    run(`refresh-token-${id}`, { loading: 'Refreshing token...', success: 'Token refreshed (60 more days)', fail: 'Refresh failed' }, async () => {
      await axios.post(`${base}/accounts/${id}/refresh-token`, {}, authHeaders);
      fetchAll();
    });

  const confirmDelete = (
    title: string, message: string, key: string, successMsg: string, doDelete: () => Promise<void>,
  ) =>
    setConfirmModal({
      open: true, title, message, loading: false,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, loading: true }));
        await run(key, { success: successMsg, fail: 'Delete failed' }, doDelete);
        closeConfirmModal();
      },
    });

  const handleDeleteAccount = (id: string) =>
    confirmDelete(
      'Remove this Instagram account?',
      'The account and all its rules will be deleted. This cannot be undone.',
      `delete-account-${id}`, 'Account removed',
      async () => {
        await axios.delete(`${base}/accounts/${id}`, authHeaders);
        fetchAll();
      },
    );

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !newRule.keyword || !newRule.dmMessage) return;
    const post = posts.find((p) => p.id === selectedPostId);
    run('add-rule', { loading: 'Adding rule...', success: 'Rule created', fail: 'Failed to add rule' }, async () => {
      await axios.post(`${base}/rules`, {
        accountId: selectedAccountId,
        postId: selectedPostId || null,
        postThumbnail: post ? (post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url) : null,
        postCaption: post?.caption || null,
        ...newRule,
      }, authHeaders);
      setNewRule({ keyword: '', matchType: DEFAULT_MATCH_TYPE, dmMessage: DEFAULT_DM_TEMPLATE });
      setSelectedPostId('');
      setShowAddRule(false);
      fetchAll();
    });
  };

  const handleToggleRule = (id: string, isActive: boolean) =>
    run(`toggle-rule-${id}`, { fail: 'Update failed' }, async () => {
      await axios.put(`${base}/rules/${id}`, { isActive: !isActive }, authHeaders);
      fetchAll();
    });

  const handleUpdateRule = (id: string, updates: RuleForm) =>
    run(`update-rule-${id}`, { loading: 'Updating rule...', success: 'Rule updated', fail: 'Update failed' }, async () => {
      await axios.put(`${base}/rules/${id}`, updates, authHeaders);
      setExpandedRuleId(null);
      fetchAll();
    });

  const handleDeleteRule = (id: string) =>
    confirmDelete(
      'Delete this rule?',
      'This automation rule will be permanently deleted.',
      `delete-rule-${id}`, 'Rule deleted',
      async () => {
        await axios.delete(`${base}/rules/${id}`, authHeaders);
        setExpandedRuleId(null);
        fetchAll();
      },
    );

  if (loading) {
    return (
      <div className="space-y-4 px-1 py-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const isAddingRule = isPending('add-rule');

  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: 'rules', label: 'Rules', icon: 'zap', count: rulesForSelected.length },
    { id: 'codes', label: 'Post codes', icon: 'key' },
    { id: 'logs', label: 'Activity', icon: 'activity', count: logCounts.all },
  ];

  const maxDay = Math.max(...stats.days.map((d) => d.count), 1);

  return (
    <>
      <style>{`
        .ig-auto-scroll::-webkit-scrollbar { display: none; }
        .ig-auto-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="space-y-5 px-1 py-3">
        {/* ===== HERO HEADER ===== */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-cyan-500/10 p-5">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-xl shadow-violet-500/40 ring-1 ring-white/20">
                <InstagramIcon className="h-5 w-5" />
                <span className="absolute inset-0 rounded-2xl bg-white/10 blur-md" />
              </span>
              <div>
                <h2 className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-xl font-bold leading-tight tracking-tight text-transparent">
                  Instagram Automation
                </h2>
                <p className="text-xs text-white/50">Reply to comments with a DM, automatically.</p>
              </div>
            </div>
            <button
              onClick={() =>
                window.open(`${API.replace('/api', '')}/api/auth/instagram/connect?token=${encodeURIComponent(token)}`, '_blank')
              }
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl shadow-violet-500/30 ring-1 ring-white/15 transition-all hover:scale-[1.03] hover:shadow-violet-500/50 active:scale-95"
            >
              <InstagramIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
              Connect account
              <Icon name="plus" className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
            </button>
          </div>
        </div>

        {/* ===== STATS ===== */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Accounts"
              icon="userCircle"
              accent="bg-violet-500/15 text-violet-300"
              glow="bg-violet-500"
              value={accounts.length}
              sub={`${activeAccounts} active`}
            />
            <StatCard
              label="Active rules"
              icon="zap"
              accent="bg-fuchsia-500/15 text-fuchsia-300"
              glow="bg-fuchsia-500"
              value={stats.activeRules}
              sub={`of ${rulesForSelected.length} on this account`}
            />
            <StatCard
              label="DMs sent"
              icon="send"
              accent="bg-cyan-500/15 text-cyan-300"
              glow="bg-cyan-500"
              value={logCounts.sent.toLocaleString()}
              sub={`${logCounts.failed} failed, ${logCounts.queued} waiting`}
              right={
                <div className="flex h-11 items-end gap-0.5" aria-label="Sent in the last 7 days">
                  {stats.days.map((d, i) => (
                    <div
                      key={i}
                      title={`${d.label}: ${d.count}`}
                      className="w-1.5 rounded-sm bg-cyan-400/70 transition-all hover:bg-cyan-400"
                      style={{ height: `${Math.max((d.count / maxDay) * 100, 8)}%`, opacity: d.count ? 1 : 0.25 }}
                    />
                  ))}
                </div>
              }
            />
            <StatCard
              label="Success rate"
              icon="shield"
              accent="bg-sky-500/15 text-sky-300"
              glow="bg-sky-500"
              value={stats.done ? `${stats.rate}%` : '-'}
              sub={stats.done ? `${stats.done} delivery attempts` : 'No attempts yet'}
              right={
                stats.done ? (
                  <Ring pct={stats.rate} tone={stats.rate >= 80 ? 'stroke-cyan-400' : stats.rate >= 50 ? 'stroke-amber-400' : 'stroke-red-400'} />
                ) : undefined
              }
            />
          </div>
        )}

        {/* ===== ACCOUNTS ===== */}
        {accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.02]">
            <EmptyState
              icon="userCircle"
              title="Connect your first account"
              text="Link an Instagram account and your rules will start sending DMs to people who comment your keyword."
              action={
                <Btn
                  color="instagram"
                  size="md"
                  onClick={() =>
                    window.open(`${API.replace('/api', '')}/api/auth/instagram/connect?token=${encodeURIComponent(token)}`, '_blank')
                  }
                >
                  <InstagramIcon /> Connect account
                </Btn>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((acc) => {
              const toggling = isPending(`toggle-account-${acc._id}`);
              const deleting = isPending(`delete-account-${acc._id}`);
              const refreshing = isPending(`refresh-token-${acc._id}`);
              const busy = toggling || deleting || refreshing;
              const selected = selectedAccountId === acc.igUserId;
              const token_ = getTokenInfo(acc);
              return (
                <div
                  key={acc._id}
                  onClick={() => selectAccount(acc)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAccount(acc); } }}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-3.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                    selected
                      ? 'border-violet-400/60 bg-gradient-to-br from-violet-500/[0.10] to-cyan-500/[0.04] shadow-lg shadow-violet-500/10'
                      : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]'
                  } ${deleting ? 'pointer-events-none opacity-50' : ''} ${!acc.isActive ? 'opacity-75' : ''}`}
                >
                  {selected && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-violet-500 to-cyan-500" />
                  )}

                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-[2px] transition-all ${acc.isActive ? 'bg-gradient-to-br from-cyan-400 to-violet-500 shadow-md shadow-cyan-500/30' : 'bg-white/15'}`}>
                      <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-[#0f0d1a] bg-slate-800">
                        <AccountAvatar url={acc.profilePictureUrl} name={acc.igUsername} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">@{acc.igUsername}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
                        <span className={`h-1.5 w-1.5 rounded-full ${acc.isActive ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]' : 'bg-white/30'}`} />
                        {acc.isActive ? 'Active' : 'Paused'}
                        {!subAdminMode && (
                          <>
                            <span className="text-white/20">|</span>
                            <span className="truncate">{acc.createdByUsername || 'Admin'}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3" title={acc.tokenError || ''}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 text-white/45">
                        <Icon name="key" className="h-3 w-3" /> Access token
                      </span>
                      <span className={`font-medium ${TONE_TEXT[token_.tone]}`}>{token_.text}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${TONE_BAR[token_.tone]} transition-all`} style={{ width: `${token_.pct}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <Btn
                      color="indigo"
                      title="Refresh access token"
                      onClick={(e) => { e.stopPropagation(); handleRefreshToken(acc._id); }}
                      disabled={busy}
                      loading={refreshing}
                      className="flex-1"
                    >
                      {!refreshing && <Icon name="refresh" className="h-3.5 w-3.5" />}
                      Refresh token
                    </Btn>
                    <Btn
                      color={acc.isActive ? 'yellow' : 'cyan'}
                      onClick={(e) => { e.stopPropagation(); handleToggleAccount(acc._id, acc.isActive); }}
                      disabled={busy}
                      loading={toggling}
                    >
                      {acc.isActive ? 'Pause' : 'Resume'}
                    </Btn>
                    <Btn
                      color="red"
                      title="Remove account"
                      onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc._id); }}
                      disabled={busy}
                      loading={deleting}
                      size="icon"
                    >
                      {!deleting && <Icon name="trash" className="h-3.5 w-3.5" />}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== SELECTED ACCOUNT WORKSPACE ===== */}
        {selectedAccountId && (
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-white/[0.01]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 pt-3">
              <div className="flex gap-1" role="tablist">
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={`relative inline-flex items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                        active ? 'text-white' : 'text-white/45 hover:text-white/80'
                      }`}
                    >
                      <Icon name={t.icon} className="h-4 w-4" />
                      {t.label}
                      {t.count !== undefined && (
                        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-violet-500/25 text-violet-100' : 'bg-white/10 text-white/50'}`}>
                          {t.count}
                        </span>
                      )}
                      {active && <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${IG_GRADIENT}`} />}
                    </button>
                  );
                })}
              </div>
              <p className="pb-3 text-xs text-white/45">
                Managing <span className="font-medium text-violet-200">@{selectedAccount?.igUsername}</span>
              </p>
            </div>

            <div className="p-4">
              {/* ---------- RULES ---------- */}
              {tab === 'rules' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {rulesForSelected.length > 6 && (
                      <div className="relative min-w-[160px] flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                          <Icon name="search" className="h-3.5 w-3.5" />
                        </span>
                        <input
                          type="text" placeholder="Search rules" value={ruleSearch}
                          onChange={(e) => setRuleSearch(e.target.value)}
                          className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/25 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    )}
                    <div className="ml-auto">
                      <Btn color={showAddRule ? 'gray' : 'primary'} onClick={() => setShowAddRule((v) => !v)} disabled={isAddingRule}>
                        <Icon name={showAddRule ? 'close' : 'plus'} className="h-3.5 w-3.5" />
                        {showAddRule ? 'Close' : 'New rule'}
                      </Btn>
                    </div>
                  </div>

                  {showAddRule && (
                    <form onSubmit={handleAddRule} className="grid gap-4 rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-4 lg:grid-cols-[1fr_280px]">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 text-[10px] font-bold text-violet-200">1</span>
                            Pick where it applies
                          </p>
                          <PostPickerGrid
                            posts={posts}
                            loading={postsLoading}
                            selectedPostId={selectedPostId}
                            onSelect={setSelectedPostId}
                            excludePostIds={rulesForSelected.filter((r) => r.postId).map((r) => r.postId as string)}
                            disabled={isAddingRule}
                          />
                        </div>

                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 text-[10px] font-bold text-violet-200">2</span>
                            Set the trigger
                          </p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs text-white/50">Keyword</label>
                              <input
                                type="text" placeholder="e.g. LINK" value={newRule.keyword} disabled={isAddingRule}
                                onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} className={INPUT_CLS}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-white/50">Match type</label>
                              <StyledSelect
                                value={newRule.matchType}
                                onChange={(v) => setNewRule({ ...newRule, matchType: v as 'exact' | 'contains' })}
                                disabled={isAddingRule}
                                options={MATCH_OPTIONS}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 text-[10px] font-bold text-violet-200">3</span>
                              Write the DM
                            </p>
                            <button
                              type="button"
                              onClick={() => setNewRule((r) => ({ ...r, dmMessage: DEFAULT_DM_TEMPLATE }))}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/10"
                            >
                              <Icon name="sparkles" className="h-3 w-3" /> Reset template
                            </button>
                          </div>
                          <textarea
                            placeholder="Write the DM. Use {link} to insert the saved post link."
                            value={newRule.dmMessage} rows={3} disabled={isAddingRule}
                            onChange={(e) => setNewRule({ ...newRule, dmMessage: e.target.value })}
                            className={`${INPUT_CLS} resize-none`}
                          />
                          <button
                            type="button"
                            onClick={() => setNewRule((r) => ({ ...r, dmMessage: `${r.dmMessage}${r.dmMessage && !r.dmMessage.endsWith(' ') ? ' ' : ''}{link}` }))}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 transition hover:bg-white/10"
                          >
                            <Icon name="link" className="h-3 w-3" /> Insert {'{link}'}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <Btn type="submit" color="primary" size="md" loading={isAddingRule}>
                            <Icon name="check" className="h-4 w-4" /> Save rule
                          </Btn>
                          <Btn size="md" onClick={() => setShowAddRule(false)} disabled={isAddingRule}>Cancel</Btn>
                        </div>
                      </div>

                      <div className="lg:sticky lg:top-2 lg:self-start">
                        <DmPreview keyword={newRule.keyword} message={newRule.dmMessage} />
                        <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                          {'{link}'} is replaced with the link saved in the post code.
                        </p>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {visibleRules.length === 0 ? (
                      <EmptyState
                        icon={rulesForSelected.length === 0 ? 'zap' : 'search'}
                        title={rulesForSelected.length === 0 ? 'No rules yet' : 'No matching rules'}
                        text={rulesForSelected.length === 0 ? 'Create a rule to send a DM when someone comments your keyword.' : 'Try a different search term.'}
                        action={
                          rulesForSelected.length === 0 && !showAddRule ? (
                            <Btn color="primary" onClick={() => setShowAddRule(true)}>
                              <Icon name="plus" className="h-3.5 w-3.5" /> New rule
                            </Btn>
                          ) : undefined
                        }
                      />
                    ) : (
                      visibleRules.map((rule) => (
                        <RuleRow
                          key={rule._id}
                          rule={rule}
                          expanded={expandedRuleId === rule._id}
                          pendingAction={pendingAction}
                          onExpand={() => setExpandedRuleId((cur) => (cur === rule._id ? null : rule._id))}
                          onToggle={handleToggleRule}
                          onDelete={handleDeleteRule}
                          onSave={handleUpdateRule}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ---------- POST CODES ---------- */}
              {tab === 'codes' && (
                <div className="[&>div]:border-t-0 [&>div]:pt-0">
                  <PostCodesPanel apiBase={API} token={token} accountId={selectedAccountId} />
                </div>
              )}

              {/* ---------- LOGS ---------- */}
              {tab === 'logs' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/20 p-1">
                      {LOG_FILTERS.map((f) => {
                        const active = logFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setLogFilter(f.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                              active
                                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25'
                                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                            }`}
                          >
                            {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                            {f.label}
                            <span className={`text-[10px] ${active ? 'text-white/90' : 'text-white/35'}`}>{logCounts[f.id]}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative min-w-[140px] flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                        <Icon name="search" className="h-3.5 w-3.5" />
                      </span>
                      <input
                        type="text" placeholder="Search keyword or comment" value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-8 text-xs text-white placeholder-white/25 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
                      />
                      {logSearch && (
                        <button
                          onClick={() => setLogSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/30 transition hover:text-white/70"
                          aria-label="Clear search"
                        >
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <Btn color={autoRefresh ? 'cyan' : 'gray'} onClick={() => setAutoRefresh((v) => !v)}>
                      <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)] animate-pulse' : 'bg-white/30'}`} />
                      {autoRefresh ? 'Live updates on' : 'Live updates'}
                    </Btn>
                  </div>

                  <div className="ig-auto-scroll max-h-[28rem] overflow-y-auto rounded-2xl border border-white/[0.06] bg-black/20">
                    {filteredLogs.length === 0 ? (
                      <EmptyState
                        icon="activity"
                        title={logCounts.all === 0 ? 'No activity yet' : 'No matching activity'}
                        text={logCounts.all === 0 ? 'Sent and failed DMs will show up here once a comment matches a rule.' : 'Try a different filter or search term.'}
                        action={
                          (logFilter !== 'all' || logSearch) && logCounts.all > 0 ? (
                            <button
                              onClick={() => { setLogFilter('all'); setLogSearch(''); }}
                              className="text-xs font-medium text-violet-300 hover:text-violet-200"
                            >
                              Clear filters
                            </button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <>
                        {groupedLogs.map((g) => (
                          <div key={g.label}>
                            <p className="sticky top-0 z-10 border-b border-white/[0.05] bg-[#12101d]/95 px-3 py-1.5 text-[11px] font-semibold text-white/50 backdrop-blur-sm">
                              {g.label} <span className="text-white/30">({g.items.length})</span>
                            </p>
                            <div className="divide-y divide-white/[0.05]">
                              {g.items.map((log) => <LogRow key={log._id} log={log} />)}
                            </div>
                          </div>
                        ))}
                        {filteredLogs.length > logLimit && (
                          <button
                            onClick={() => setLogLimit((n) => n + LOG_PAGE_SIZE)}
                            className="w-full border-t border-white/[0.05] py-3 text-xs font-semibold text-violet-300 transition hover:bg-white/[0.03]"
                          >
                            Show {Math.min(LOG_PAGE_SIZE, filteredLogs.length - logLimit)} more ({filteredLogs.length - logLimit} left)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          loading={confirmModal.loading}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirmModal}
        />
      </div>
    </>
  );
};

export default InstagramAutomationManager;