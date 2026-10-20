// src/components/admin/SharedAccessManager.tsx
// Admin: share one bucket with multiple sub-admins — limit (GB), price (₹/GB), monthly payment control
import React, { useState, useEffect, useRef, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Props { token?: string; }

interface Grantable { hostname: string; label: string; kind: 'static' | 'provider'; }
interface SubAdminOpt { username: string; name?: string; isBlocked?: boolean; }
interface Payment { month: string; amount: number; paidAt?: string; markedBy?: string; }
interface Grant {
  id: string; hostname: string; label: string; username: string;
  limitGb: number; pricePerGb: number; usedBytes: number | null;
  month: string; fee: number; planFee: number;
  paid: boolean; free: boolean; inGrace: boolean; canUpload: boolean;
  graceDays: number; payments: Payment[];
  paidAmount: number;
  dueAmount: number;
  pct: number;
}

const GB = 1024 ** 3;
const inr = (n: number) => `₹${(n || 0).toFixed(2)}`;
const fmtSize = (b: number) =>
  b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB`
  : b < GB ? `${(b / 1024 ** 2).toFixed(1)} MB`
  : `${(b / GB).toFixed(2)} GB`;
const PRESETS = [5, 10, 20, 50, 100];

const inputCls = "w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 transition-all";
const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5";

// ============ ICONS ============
const ShieldIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
const RefreshIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
  </svg>
);
const WarningIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);
const CheckIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const XIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const ChevronDownIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ClockIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const UserIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const DatabaseIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);
const PlusIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="M12 5v14" />
  </svg>
);
const TrashIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);
const EditIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);
const HistoryIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
  </svg>
);
const ArrowUpIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
  </svg>
);
const WalletIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);
const TrendingIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);
const FilterIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const UsersIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const SparklesIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

// ============ CUSTOM SELECT ============
interface Opt { value: string; label: string; disabled?: boolean }

const CustomSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}> = ({ value, onChange, options, placeholder = 'Select...', disabled, compact, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const btnPad = compact ? 'px-2.5 py-1.5 rounded-lg text-xs' : 'px-3 py-2.5 rounded-xl text-xs';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-white/[0.04] border border-white/[0.08] text-left outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 transition-all hover:border-white/[0.15] ${btnPad} ${open ? 'border-violet-500/50 ring-2 ring-violet-500/20' : ''}`}
      >
        <span className={`truncate flex-1 ${selected ? 'text-white' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[100] mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#151422] shadow-2xl shadow-black/70 p-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-gray-500">No options</div>
          ) : (
            options.map(opt => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-violet-500/20 text-violet-200'
                      : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isActive && <CheckIcon className="w-3 h-3 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ============ RING ============
const Ring: React.FC<{ pct: number; level: 'ok' | 'near' | 'full'; size?: number }> = ({ pct, level, size = 76 }) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c - (clamped / 100) * c;
  const stroke = level === 'full' ? '#fb7185' : level === 'near' ? '#fbbf24' : '#a78bfa';
  const textCls = level === 'full' ? 'text-rose-300' : level === 'near' ? 'text-amber-300' : 'text-violet-300';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={stroke} strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-black leading-none ${textCls}`}>{clamped.toFixed(0)}%</span>
        <span className="text-[7px] uppercase tracking-[0.15em] text-gray-500 font-bold mt-0.5">used</span>
      </div>
    </div>
  );
};

// ============ STATUS PILL ============
const StatusPill: React.FC<{ g: Grant; hasTopUp: boolean }> = ({ g, hasTopUp }) => {
  const base = 'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap';
  if (g.free) return <span className={`${base} bg-sky-500/10 text-sky-300 border-sky-500/30`}><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />Free</span>;
  if (hasTopUp) return <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/30`}><ArrowUpIcon className="w-3 h-3" />Top-up · {inr(g.dueAmount)}</span>;
  if (g.paid) return <span className={`${base} bg-emerald-500/10 text-emerald-300 border-emerald-500/30`}><CheckIcon className="w-3 h-3" />Paid</span>;
  if (g.inGrace) return <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/30`}><ClockIcon className="w-3 h-3" />Grace · {g.graceDays}d</span>;
  return <span className={`${base} bg-rose-500/10 text-rose-300 border-rose-500/30`}><XIcon className="w-3 h-3" />Unpaid</span>;
};

// ============ CONFIRM DIALOG ============
type Tone = 'danger' | 'warn' | 'ok';
interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  tone: Tone;
  loading: boolean;
  onConfirm: () => Promise<void> | void;
}

const ConfirmDialog: React.FC<{ state: ConfirmState; onCancel: () => void; onConfirm: () => void }> = ({ state, onCancel, onConfirm }) => {
  const tone = state.tone;
  const iconBg = tone === 'danger'
    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
    : tone === 'warn'
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
  const btnGrad = tone === 'danger'
    ? 'from-rose-600 to-red-600 shadow-rose-500/30 hover:shadow-rose-500/50'
    : tone === 'warn'
      ? 'from-amber-500 to-orange-600 shadow-amber-500/30 hover:shadow-amber-500/50'
      : 'from-emerald-500 to-teal-600 shadow-emerald-500/30 hover:shadow-emerald-500/50';
  const Icon = tone === 'danger' ? WarningIcon : tone === 'warn' ? WarningIcon : CheckIcon;
  const loadingLabel = tone === 'danger' ? 'Working...' : 'Saving...';

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => !state.loading && onCancel()}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-sm font-bold text-white leading-tight">{state.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/55">{state.message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={state.loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={state.loading}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${btnGrad} disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center gap-1.5`}
          >
            {state.loading && <span className="w-3 h-3 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
            {state.loading ? loadingLabel : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ GRANT CARD ============
const GrantCard: React.FC<{
  g: Grant;
  busy: boolean;
  onSave: (g: Grant, limitGb: number, pricePerGb: number) => Promise<void>;
  onPaid: (g: Grant, paid: boolean) => void;
  onRemove: (g: Grant) => void;
}> = ({ g, busy, onSave, onPaid, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(String(g.limitGb));
  const [price, setPrice] = useState(String(g.pricePerGb));
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setLimit(String(g.limitGb)); setPrice(String(g.pricePerGb)); }, [g.limitGb, g.pricePerGb]);

  const limitBytes = g.limitGb * GB;
  const pct = g.usedBytes === null ? 0 : Math.min(100, (g.usedBytes / limitBytes) * 100);
  const level: 'ok' | 'near' | 'full' = pct >= 100 ? 'full' : pct >= 80 ? 'near' : 'ok';
  const barGrad = level === 'full'
    ? 'from-rose-500 via-red-500 to-red-600'
    : level === 'near'
      ? 'from-amber-400 via-orange-500 to-orange-600'
      : 'from-violet-500 via-purple-500 to-pink-500';
  const cardBorder = level === 'full'
    ? 'border-rose-500/30 hover:border-rose-500/50'
    : level === 'near'
      ? 'border-amber-500/20 hover:border-amber-500/40'
      : 'border-white/[0.08] hover:border-violet-500/30';
  const glowCls = level === 'full' ? 'bg-rose-500' : level === 'near' ? 'bg-amber-500' : 'bg-violet-500';
  const remaining = g.usedBytes === null ? null : Math.max(0, limitBytes - g.usedBytes);
  const hasTopUp = g.paid && g.dueAmount > 0;
  const nextFee = (Number(limit) || 0) * (Number(price) || 0);

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border ${cardBorder} transition-all duration-300`}>
      <div className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-10 pointer-events-none ${glowCls} group-hover:opacity-20 transition-opacity duration-500`} />

      <div className="relative p-4 space-y-3.5">
        {/* --- User + status --- */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/25 to-rose-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
              <UserIcon className="w-4 h-4 text-pink-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{g.username}</p>
              <p className="text-[10px] text-gray-500 truncate mt-0.5">{g.label}</p>
            </div>
          </div>
          <StatusPill g={g} hasTopUp={hasTopUp} />
        </div>

        {/* --- Usage --- */}
        <div className="flex items-center gap-3">
          <Ring pct={pct} level={level} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-white">
                {g.usedBytes === null ? '—' : fmtSize(g.usedBytes)}
                <span className="text-gray-500 font-normal"> used</span>
              </span>
              <span className="text-[10px] text-gray-500">/ {g.limitGb} GB</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${barGrad} rounded-full`}
                style={{ width: `${pct}%`, transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">
                {remaining !== null ? `${fmtSize(remaining)} free` : 'Not loaded'}
              </span>
              {level === 'full' && <span className="text-rose-400 font-black tracking-wide">FULL</span>}
              {level === 'near' && <span className="text-amber-400 font-black tracking-wide">NEAR LIMIT</span>}
            </div>
          </div>
        </div>

        {/* --- Fee / Edit --- */}
        {!editing ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <WalletIcon className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">Monthly fee</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{g.limitGb} GB × {inr(g.pricePerGb)}/GB</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-black text-emerald-300 leading-tight">{inr(g.planFee)}</p>
              {!g.free && g.paidAmount > 0 && (
                <p className="text-[9px] font-semibold mt-0.5">
                  <span className="text-emerald-400/80">{inr(g.paidAmount)} paid</span>
                  {g.dueAmount > 0 && <span className="text-amber-400"> · {inr(g.dueAmount)} due</span>}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-violet-500/[0.04] border border-violet-500/20 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Limit (GB)</label>
                <input type="number" min="1" step="1" value={limit} onChange={e => setLimit(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>₹ / GB</label>
                <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={inputCls} />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              New fee: <b className="text-emerald-300">{inr(nextFee)}</b>
              {g.paid && ' · this month\'s paid amount will not change, the new rate applies from next month'}
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={async () => { await onSave(g, Number(limit), Number(price)); setEditing(false); }}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <CheckIcon className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setLimit(String(g.limitGb)); setPrice(String(g.pricePerGb)); }}
                className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* --- Top-up banner --- */}
        {!editing && hasTopUp && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200">
            <ArrowUpIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-amber-100">Top-up {inr(g.dueAmount)} pending.</strong>{' '}
              Limit increased — {inr(g.paidAmount)} paid, {inr(g.planFee)} due.
            </div>
          </div>
        )}

        {/* --- Actions --- */}
        <div className="flex flex-wrap gap-1.5">
          {hasTopUp && (
            <button
              disabled={busy}
              onClick={() => onPaid(g, true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-[10px] font-bold disabled:opacity-50 transition-colors"
            >
              <ArrowUpIcon className="w-3 h-3" /> Top-up paid ({inr(g.dueAmount)})
            </button>
          )}
          {!g.free && (
            <button
              disabled={busy}
              onClick={() => onPaid(g, !g.paid)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold disabled:opacity-50 transition-colors ${
                g.paid
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25 text-amber-300'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-200'
              }`}
            >
              {g.paid ? <><XIcon className="w-3 h-3" /> Mark Unpaid</> : <><CheckIcon className="w-3 h-3" /> Mark Paid ({inr(g.planFee)})</>}
            </button>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 text-[10px] font-bold transition-colors">
              <EditIcon className="w-3 h-3" /> Edit
            </button>
          )}
          <button onClick={() => setShowHistory(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-colors">
            <HistoryIcon className="w-3 h-3" /> History
          </button>
          <button disabled={busy} onClick={() => onRemove(g)}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 text-[10px] font-bold disabled:opacity-50 transition-colors">
            <TrashIcon className="w-3 h-3" /> Remove
          </button>
        </div>

        {/* --- History --- */}
        {showHistory && (
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 mb-2">
              <HistoryIcon className="w-3 h-3 text-gray-500" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Payment history</p>
            </div>
            {g.payments.length === 0 ? (
              <p className="text-[10px] text-gray-500 py-1">No payments yet.</p>
            ) : (
              <div className="space-y-1">
                {g.payments.map(p => (
                  <div key={p.month} className="flex items-center justify-between text-[10px] py-1 px-2 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <span className="text-gray-400 font-mono">{p.month}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString()}` : ''}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                      {inr(p.amount)} <CheckIcon className="w-3 h-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ MAIN ============
const SharedAccessManager: React.FC<Props> = ({ token: tokenProp }) => {
  const authHeaders = (): Record<string, string> => {
    const t = tokenProp || localStorage.getItem('adminToken') || '';
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const [grantables, setGrantables] = useState<Grantable[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdminOpt[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const [form, setForm] = useState({ hostname: '', username: '', limitGb: '10', pricePerGb: '3' });

  const pendingRef = useRef<Set<string>>(new Set());
  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try { await fn(); } catch { /* handled */ }
    finally { setTimeout(() => pendingRef.current.delete(key), 250); }
  };

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const api = async (path: string, method = 'GET', body?: any) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [gb, sa, gr] = await Promise.all([
        api('/uploads/grantable'),
        api('/r2-providers/sub-admins'),
        api('/uploads/grants'),
      ]);
      setGrantables(Array.isArray(gb) ? gb : []);
      setSubAdmins(Array.isArray(sa) ? sa : []);
      setGrants(Array.isArray(gr.grants) ? gr.grants : []);
      setMonth(gr.month || '');
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Load failed' });
    } finally {
      setLoading(false);
    }
  };

  const reloadGrants = async () => {
    try {
      const gr = await api('/uploads/grants');
      setGrants(Array.isArray(gr.grants) ? gr.grants : []);
      setMonth(gr.month || '');
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Load failed' });
    }
  };

  useEffect(() => { loadAll(); }, []);

  const feePreview = (Number(form.limitGb) || 0) * (Number(form.pricePerGb) || 0);

  const handleAdd = async () => {
    if (!form.hostname || !form.username) { setMsg({ type: 'err', text: 'Please select a bucket and a sub-admin' }); return; }
    await guarded('add-grant', async () => {
      setAdding(true);
      try {
        const r = await api('/uploads/grants', 'POST', {
          hostname: form.hostname, username: form.username,
          limitGb: Number(form.limitGb), pricePerGb: Number(form.pricePerGb),
        });
        setMsg({ type: 'ok', text: r.updated ? 'Limit/price updated' : 'Access granted' });
        await reloadGrants();
      } catch (e: any) {
        setMsg({ type: 'err', text: e.message });
      } finally { setAdding(false); }
    });
  };

  const handleSave = async (g: Grant, limitGb: number, pricePerGb: number) => {
    await guarded(`save-${g.id}`, async () => {
      setBusyId(g.id);
      try {
        await api(`/uploads/grants/${g.id}`, 'PATCH', { limitGb, pricePerGb });
        setMsg({ type: 'ok', text: 'Updated' });
        await reloadGrants();
      } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
      finally { setBusyId(null); }
    });
  };

  const doPaid = async (g: Grant, paid: boolean) => {
    await guarded(`paid-${g.id}`, async () => {
      setBusyId(g.id);
      try {
        await api(`/uploads/grants/${g.id}/paid`, 'POST', { paid });
        setMsg({ type: 'ok', text: paid ? 'Marked as paid' : 'Marked as unpaid' });
        await reloadGrants();
      } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
      finally { setBusyId(null); }
    });
  };

  const handlePaid = (g: Grant, paid: boolean) => {
    const isTopUp = paid && g.paid && g.dueAmount > 0;
    const title = paid
      ? (isTopUp ? 'Mark top-up as paid?' : 'Mark payment as paid?')
      : 'Mark payment as unpaid?';
    const message = paid
      ? (isTopUp
          ? `Mark ${g.username}'s top-up of ${inr(g.dueAmount)} as "Paid"? Total will become ${inr(g.planFee)}.`
          : `Mark ${g.username}'s ${g.month} fee of ${inr(g.planFee)} as "Paid"?`)
      : `Mark ${g.username}'s ${g.month} payment as "Unpaid"? Uploads may be blocked again (after grace).`;
    const confirmLabel = paid ? `Mark Paid ${inr(isTopUp ? g.dueAmount : g.planFee)}` : 'Mark Unpaid';
    const tone: Tone = paid ? (isTopUp ? 'warn' : 'ok') : 'warn';

    setConfirmDialog({
      title,
      message,
      confirmLabel,
      tone,
      loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => prev ? { ...prev, loading: true } : prev);
        await doPaid(g, paid);
        setConfirmDialog(null);
      },
    });
  };

  const doRemove = async (g: Grant) => {
    await guarded(`rm-${g.id}`, async () => {
      setBusyId(g.id);
      try {
        await api(`/uploads/grants/${g.id}`, 'DELETE');
        setMsg({ type: 'ok', text: 'Access removed' });
        await reloadGrants();
      } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
      finally { setBusyId(null); }
    });
  };

  const handleRemove = (g: Grant) => {
    setConfirmDialog({
      title: 'Remove access?',
      message: `Remove ${g.username}'s access to "${g.label}"? Files will remain in the bucket but will not be visible to ${g.username}.`,
      confirmLabel: 'Remove access',
      tone: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => prev ? { ...prev, loading: true } : prev);
        await doRemove(g);
        setConfirmDialog(null);
      },
    });
  };

  const shown = useMemo(
    () => (filterUser ? grants.filter(g => g.username === filterUser) : grants),
    [grants, filterUser]
  );

  const totals = useMemo(() => {
    const expected = grants.filter(g => !g.free).reduce((s, g) => s + g.planFee, 0);
    const collected = grants.filter(g => !g.free).reduce((s, g) => s + (g.paidAmount || 0), 0);
    return { expected, collected, pending: Math.max(0, expected - collected) };
  }, [grants]);

  const usersWithGrants = useMemo(() => Array.from(new Set(grants.map(g => g.username))).sort(), [grants]);

  return (
    <div className="space-y-4">
      {/* ============ HEADER ============ */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
          <ShieldIcon className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Shared Bucket Access</h2>
            {month && (
              <span className="text-[10px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-md">
                {month}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Share one bucket with multiple sub-admins · per-user folder isolation</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold disabled:opacity-50 transition-colors">
          <RefreshIcon className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ============ TOTALS ============ */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/[0.08] to-violet-500/[0.02] border border-violet-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingIcon className="w-3 h-3 text-violet-400" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-violet-300/70">Expected</p>
          </div>
          <p className="text-base font-black text-violet-300">{inr(totals.expected)}</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border border-emerald-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckIcon className="w-3 h-3 text-emerald-400" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70">Collected</p>
          </div>
          <p className="text-base font-black text-emerald-300">{inr(totals.collected)}</p>
        </div>
        <div className={`p-3 rounded-xl border ${
          totals.pending > 0
            ? 'bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] border-amber-500/25'
            : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-white/[0.08]'
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <ClockIcon className={`w-3 h-3 ${totals.pending > 0 ? 'text-amber-400' : 'text-gray-500'}`} />
            <p className={`text-[9px] font-bold uppercase tracking-wider ${totals.pending > 0 ? 'text-amber-300/70' : 'text-gray-500'}`}>Pending</p>
          </div>
          <p className={`text-base font-black ${totals.pending > 0 ? 'text-amber-300' : 'text-gray-400'}`}>{inr(totals.pending)}</p>
        </div>
      </div>

      {/* ============ TOAST ============ */}
      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs border animate-in fade-in slide-in-from-top-2 duration-300 ${
          msg.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
        }`}>
          {msg.type === 'ok'
            ? <CheckIcon className="w-4 h-4 shrink-0 mt-0.5" />
            : <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{msg.text}</span>
        </div>
      )}

      {/* ============ ADD FORM ============ */}
      <div className="relative rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-violet-500 blur-3xl opacity-10" />
        </div>
        <div className="relative p-4 space-y-3.5">
          <div className="relative flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <PlusIcon className="w-3.5 h-3.5 text-violet-300" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-200">Grant new access</p>
          </div>

          <div className="relative grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1">
                  <DatabaseIcon className="w-3 h-3" /> Bucket
                </span>
              </label>
              <CustomSelect
                value={form.hostname}
                onChange={v => setForm(f => ({ ...f, hostname: v }))}
                placeholder="Select bucket..."
                options={grantables.map(b => ({ value: b.hostname, label: b.label }))}
              />
            </div>
            <div>
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Sub-admin
                </span>
              </label>
              <CustomSelect
                value={form.username}
                onChange={v => setForm(f => ({ ...f, username: v }))}
                placeholder="Select sub-admin..."
                options={subAdmins.map(s => ({
                  value: s.username,
                  label: `${s.name ? `${s.name} (@${s.username})` : s.username}${s.isBlocked ? ' 🚫 blocked' : ''}`,
                }))}
              />
            </div>
          </div>

          <div className="relative">
            <label className={labelCls}>Upload limit (GB)</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {PRESETS.map(n => (
                <button key={n} type="button" onClick={() => setForm(f => ({ ...f, limitGb: String(n) }))}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    form.limitGb === String(n)
                      ? 'bg-violet-500/25 border-violet-400/50 text-violet-200 shadow-sm shadow-violet-500/20'
                      : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:border-white/[0.15]'
                  }`}>
                  {n} GB
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="1" step="1" value={form.limitGb}
                onChange={e => setForm(f => ({ ...f, limitGb: e.target.value }))} className={inputCls} placeholder="GB" />
              <div className="relative">
                <input type="number" min="0" step="0.01" value={form.pricePerGb}
                  onChange={e => setForm(f => ({ ...f, pricePerGb: e.target.value }))} className={`${inputCls} pr-14`} placeholder="3.50" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">₹ / GB</span>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
            <div className="flex items-center gap-2 min-w-0">
              <WalletIcon className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-[11px] text-gray-400 leading-tight">To be paid by the sub-admin at the start of each month</span>
            </div>
            <span className="text-lg font-black text-emerald-300 shrink-0">{inr(feePreview)}</span>
          </div>

          <button onClick={handleAdd} disabled={adding || !form.hostname || !form.username}
            className="relative w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 transition-all inline-flex items-center justify-center gap-2">
            {adding ? (
              <><RefreshIcon className="w-3.5 h-3.5 animate-spin" /> Saving...</>
            ) : (
              <><PlusIcon className="w-3.5 h-3.5" /> Grant Access / Update</>
            )}
          </button>
          <p className="text-[10px] text-gray-600 text-center">Granting the same bucket + sub-admin again will only update the limit/price.</p>
        </div>
      </div>

      {/* ============ FILTER ============ */}
      {usersWithGrants.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-gray-500">
            <FilterIcon className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Filter</span>
          </div>
          <CustomSelect
            compact
            className="min-w-[180px]"
            value={filterUser}
            onChange={setFilterUser}
            options={[
              { value: '', label: `All sub-admins (${usersWithGrants.length})` },
              ...usersWithGrants.map(u => ({ value: u, label: u })),
            ]}
          />
          {filterUser && (
            <button onClick={() => setFilterUser('')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 text-[10px] font-bold transition-colors">
              <XIcon className="w-2.5 h-2.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ============ SKELETON ============ */}
      {loading && grants.length === 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {/* ============ EMPTY ============ */}
      {!loading && grants.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.01] p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
            <UsersIcon className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-sm font-bold text-gray-300">No shared access granted yet</p>
          <p className="text-[11px] text-gray-500 mt-1">Select a bucket and sub-admin from the form above to grant access.</p>
        </div>
      )}

      {/* ============ GRANT CARDS ============ */}
      {shown.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {shown.map(g => (
            <GrantCard key={g.id} g={g} busy={busyId === g.id} onSave={handleSave} onPaid={handlePaid} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600 pt-1">
        <SparklesIcon className="w-3 h-3" />
        <span>Grace period: {grants[0]?.graceDays || 3} days · uploads are blocked when the limit is full</span>
      </div>

      {/* ============ CUSTOM CONFIRM DIALOG ============ */}
      {confirmDialog && (
        <ConfirmDialog
          state={confirmDialog}
          onCancel={() => !confirmDialog.loading && setConfirmDialog(null)}
          onConfirm={() => { confirmDialog.onConfirm(); }}
        />
      )}
    </div>
  );
};

export default SharedAccessManager;