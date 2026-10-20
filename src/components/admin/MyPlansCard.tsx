// src/components/admin/MyPlansCard.tsx
// Visible to the sub-admin: which bucket the admin assigned, the limit, how much is used, the fee, and payment status
import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Props { token?: string; }

interface Plan {
  id: string; hostname: string; label: string;
  limitGb: number; pricePerGb: number; usedBytes: number | null;
  pct?: number; level?: 'ok' | 'near' | 'full';
  month: string; fee: number; planFee: number;
  paid: boolean; paidAmount?: number; dueAmount?: number;
  free: boolean; inGrace: boolean; canUpload: boolean; graceDays: number;
  payments: { month: string; amount: number; paidAt?: string }[];
}

const GB = 1024 ** 3;
const inr = (n: number) => `₹${(n || 0).toFixed(2)}`;
const fmtSize = (b: number) =>
  b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB`
  : b < GB ? `${(b / 1024 ** 2).toFixed(1)} MB`
  : `${(b / GB).toFixed(2)} GB`;

// ============ ICONS ============
const CloudIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
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
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
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
const ClockIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const WalletIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);
const ArrowUpIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
  </svg>
);
const HistoryIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
  </svg>
);
const SparklesIcon = (p: any) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

// ============ RING ============
const Ring: React.FC<{ pct: number; level: 'ok' | 'near' | 'full'; size?: number }> = ({ pct, level, size = 92 }) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c - (clamped / 100) * c;
  const stroke = level === 'full' ? '#fb7185' : level === 'near' ? '#fbbf24' : '#a78bfa';
  const textCls = level === 'full' ? 'text-rose-300' : level === 'near' ? 'text-amber-300' : 'text-violet-300';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={stroke} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-black leading-none ${textCls}`}>{clamped.toFixed(0)}%</span>
        <span className="text-[8px] uppercase tracking-[0.15em] text-gray-500 font-bold mt-1">used</span>
      </div>
    </div>
  );
};

// ============ STATUS PILL ============
const StatusPill: React.FC<{ plan: Plan; hasTopUp: boolean }> = ({ plan, hasTopUp }) => {
  const base = 'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap';
  if (plan.free) return <span className={`${base} bg-sky-500/10 text-sky-300 border-sky-500/30`}><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />Free</span>;
  if (hasTopUp) return <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/30`}><ArrowUpIcon className="w-3 h-3" />Top-up due</span>;
  if (plan.paid) return <span className={`${base} bg-emerald-500/10 text-emerald-300 border-emerald-500/30`}><CheckIcon className="w-3 h-3" />Paid</span>;
  if (plan.inGrace) return <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/30`}><ClockIcon className="w-3 h-3" />Grace</span>;
  return <span className={`${base} bg-rose-500/10 text-rose-300 border-rose-500/30`}><XIcon className="w-3 h-3" />Unpaid</span>;
};

// ============ MAIN ============
const MyPlansCard: React.FC<Props> = ({ token: tokenProp }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const t = tokenProp || sessionStorage.getItem('subAdminToken') || localStorage.getItem('adminToken') || '';
      const res = await fetch(`${API_BASE}/uploads/my-grants`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setPlans(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    let totalFee = 0, totalPaid = 0, totalDue = 0;
    for (const p of plans) {
      if (p.free) continue;
      totalFee += p.planFee || 0;
      totalPaid += p.paidAmount || 0;
      totalDue += p.dueAmount || 0;
    }
    return { totalFee, totalPaid, totalDue };
  }, [plans]);

  if (loading) return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
          <div className="h-2 w-56 rounded bg-white/5 animate-pulse" />
        </div>
      </div>
      <div className="h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
      <div className="h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
    </div>
  );

  if (err) return (
    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
      <WarningIcon className="w-4 h-4 shrink-0" />
      <span>{err}</span>
    </div>
  );

  if (plans.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ============ HEADER ============ */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-purple-500/10 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-violet-500/10">
          <CloudIcon className="w-4 h-4 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white tracking-tight">Shared Storage Plans</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Admin-assigned buckets &amp; monthly billing</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-colors disabled:opacity-50"
        >
          <RefreshIcon className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ============ SUMMARY (multi-plan) ============ */}
      {plans.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08]">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Plans</p>
            <p className="text-lg font-black text-white mt-0.5">{plans.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border border-emerald-500/20">
            <p className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-bold">Monthly</p>
            <p className="text-lg font-black text-emerald-300 mt-0.5">{inr(summary.totalFee)}</p>
          </div>
          <div className={`p-3 rounded-xl border ${
            summary.totalDue > 0
              ? 'bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] border-amber-500/25'
              : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-white/[0.08]'
          }`}>
            <p className={`text-[9px] uppercase tracking-wider font-bold ${summary.totalDue > 0 ? 'text-amber-400/70' : 'text-gray-500'}`}>Due</p>
            <p className={`text-lg font-black mt-0.5 ${summary.totalDue > 0 ? 'text-amber-300' : 'text-gray-400'}`}>{inr(summary.totalDue)}</p>
          </div>
        </div>
      )}

      {/* ============ PLAN CARDS ============ */}
      <div className="space-y-3">
        {plans.map(p => {
          const limitBytes = p.limitGb * GB;
          const pct = typeof p.pct === 'number'
            ? p.pct
            : p.usedBytes === null ? 0 : Math.min(100, (p.usedBytes / limitBytes) * 100);
          const level: 'ok' | 'near' | 'full' = p.level
            ?? (pct >= 100 ? 'full' : pct >= 80 ? 'near' : 'ok');
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
          const glowCls = level === 'full'
            ? 'bg-rose-500'
            : level === 'near'
              ? 'bg-amber-500'
              : 'bg-violet-500';
          const remaining = p.usedBytes === null ? null : Math.max(0, limitBytes - p.usedBytes);
          const dueAmount = p.dueAmount || 0;
          const paidAmount = p.paidAmount || 0;
          const hasTopUp = !p.free && p.paid && dueAmount > 0;

          return (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border ${cardBorder} transition-all duration-300`}
            >
              {/* Ambient glow */}
              <div className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-15 pointer-events-none ${glowCls} group-hover:opacity-25 transition-opacity duration-500`} />

              <div className="relative p-4 space-y-3.5">
                {/* --- Label + status --- */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{p.label}</p>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{p.hostname} · {p.month}</p>
                  </div>
                  <StatusPill plan={p} hasTopUp={hasTopUp} />
                </div>

                {/* --- Usage: ring + bar + stats --- */}
                <div className="flex items-center gap-4">
                  <Ring pct={pct} level={level} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-white">
                        {p.usedBytes === null ? '—' : fmtSize(p.usedBytes)}
                        <span className="text-gray-500 font-normal"> used</span>
                      </span>
                      <span className="text-[10px] text-gray-500">/ {p.limitGb} GB</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${barGrad} rounded-full`}
                        style={{ width: `${Math.min(100, pct)}%`, transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">
                        {remaining !== null ? `${fmtSize(remaining)} free` : 'Not loaded'}
                      </span>
                      {level === 'full' && <span className="text-rose-400 font-black tracking-wide">FULL</span>}
                      {level === 'near' && <span className="text-amber-400 font-black tracking-wide">NEAR LIMIT</span>}
                      {level === 'ok' && <span className="text-violet-400 font-bold">{pct.toFixed(1)}%</span>}
                    </div>
                  </div>
                </div>

                {/* --- Fee card --- */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                      <WalletIcon className="w-4 h-4 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">Monthly fee</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.limitGb} GB × {inr(p.pricePerGb)}/GB</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-emerald-300 leading-tight">{inr(p.planFee)}</p>
                    {!p.free && paidAmount > 0 && (
                      <p className="text-[9px] font-semibold mt-0.5">
                        <span className="text-emerald-400/80">{inr(paidAmount)} paid</span>
                        {dueAmount > 0 && <span className="text-amber-400"> · {inr(dueAmount)} due</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* --- Storage warnings --- */}
                {level === 'full' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200">
                    <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-rose-100">Limit is full.</strong>{' '}
                      Your {p.limitGb} GB of storage is 100% full — ask your admin to increase the limit to upload new files.
                    </div>
                  </div>
                )}
                {level === 'near' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                    <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-amber-100">Storage is {pct.toFixed(1)}% full.</strong>{' '}
                      You will hit the limit soon — ask your admin to increase it.
                    </div>
                  </div>
                )}

                {/* --- Top-up due --- */}
                {hasTopUp && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                    <ArrowUpIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-amber-100">Top-up {inr(dueAmount)} pending.</strong>{' '}
                      You have paid {inr(paidAmount)} out of a total of {inr(p.planFee)}. Pay the top-up to the admin and have it confirmed.
                    </div>
                  </div>
                )}

                {/* --- Payment pending --- */}
                {!p.free && !p.paid && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl border ${
                    p.inGrace
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  }`}>
                    {p.inGrace
                      ? <ClockIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      : <XIcon className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div className="text-[11px] leading-relaxed">
                      {p.inGrace ? (
                        <>
                          <strong className="text-amber-100">{p.month} fee of {inr(p.planFee)} is pending.</strong>{' '}
                          Uploads will keep working for the first {p.graceDays} days of the month — after that, new uploads will be blocked until the payment is confirmed.
                        </>
                      ) : (
                        <>
                          <strong className="text-rose-100">{p.month} fee of {inr(p.planFee)} is pending.</strong>{' '}
                          New uploads are blocked. Pay the admin and have it confirmed. Existing videos will keep playing.
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* --- Payment history --- */}
                {p.payments.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <HistoryIcon className="w-3 h-3 text-gray-500" />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Payment history</p>
                    </div>
                    <div className="space-y-1">
                      {p.payments.map(h => (
                        <div key={h.month} className="flex items-center justify-between text-[10px] py-1 px-2 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <span className="text-gray-400 font-mono">{h.month}</span>
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                            {inr(h.amount)}
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600 pt-1">
        <SparklesIcon className="w-3 h-3" />
        <span>Usage cache refreshed on demand · click Refresh to reload</span>
      </div>
    </div>
  );
};

export default MyPlansCard;