// src/components/admin/MyStorageManager.tsx — Sub-admin self-service R2 connect (Premium UI v3)
import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Props {
  token?: string;
}

interface Provider {
  id: string;
  hostname: string;
  bucketName: string;
  accountId: string;
  isActive: boolean;
  publicBaseUrl: string;
}

interface Status {
  connected: boolean;
  providers: Provider[];
  maxBuckets?: number;
}

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  storage:    'M20 7h-9m3-3v6M4 17h9m-3 3v-6M4 7h4M16 17h4',
  check:      'M5 13l4 4L19 7',
  checkCircle:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:    'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  xCircle:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  link:       'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  key:        'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  folder:     'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  search:     'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  save:       'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  plug:       'M13 10V3L4 14h7v7l9-11h-7z',
  info:       'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  cloud:      'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  plus:       'M12 4v16m8-8H4',
  eye:        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:     'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  copy:       'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  shield:     'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  zap:        'M13 10V3L4 14h7v7l9-11h-7z',
  sparkles:   'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

// ── Confirm Modal ─────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, loading = false, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={loading ? undefined : onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#151422] p-6 pb-8 sm:pb-6 shadow-2xl shadow-black/40 animate-[slideUp_250ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${danger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
            <SvgIcon d={ICONS.warning} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:py-2 text-sm sm:text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full sm:w-auto rounded-xl px-4 py-3 sm:py-2 text-sm sm:text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center justify-center gap-1.5 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}
          >
            {loading && <span className="w-3 h-3 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Disconnecting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────
const Toast: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm animate-[slideDown_250ms_cubic-bezier(0.16,1,0.3,1)]">
    <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
      type === 'success'
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100 shadow-emerald-500/20'
        : 'bg-rose-500/15 border-rose-500/30 text-rose-100 shadow-rose-500/20'
    }`}>
      <SvgIcon d={type === 'success' ? ICONS.checkCircle : ICONS.xCircle} className={`w-4 h-4 flex-shrink-0 mt-0.5 ${type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`} />
      <p className="flex-1 text-xs font-medium leading-relaxed">{message}</p>
      <button onClick={onClose} className="text-white/50 hover:text-white transition-colors flex-shrink-0">
        <SvgIcon d="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────────
const ProviderSkeleton = () => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3 animate-pulse">
    <div className="flex items-center gap-2">
      <div className="w-1 h-4 bg-white/10 rounded-full" />
      <div className="h-3 w-32 bg-white/10 rounded-full" />
    </div>
    <div className="h-12 bg-white/[0.04] rounded-xl" />
    <div className="h-10 bg-white/[0.04] rounded-xl" />
  </div>
);

// ── Provider Card ─────────────────────────────────────────────────────
const ProviderCard: React.FC<{
  p: Provider;
  urls: Record<string, string>;
  setUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingUrlId: string | null;
  onSaveUrl: (p: Provider) => void;
  onDisconnect: (p: Provider) => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}> = ({ p, urls, setUrls, savingUrlId, onSaveUrl, onDisconnect, copiedId, onCopy }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 transition-all">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

    <div className="flex items-center gap-2 p-4 pb-3">
      <span className={`w-1 h-5 rounded-full flex-shrink-0 ${p.isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <SvgIcon d={ICONS.folder} className="w-4 h-4 text-purple-300 flex-shrink-0" />
      <h3 className="text-sm font-bold text-white truncate flex-1" title={p.bucketName}>{p.bucketName}</h3>
      <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
        p.isActive
          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
          : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
      }`}>
        {p.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>

    <div className="mx-4 mb-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Account ID</p>
        <button
          onClick={() => onCopy(p.accountId, p.id)}
          className="flex items-center gap-1 text-[10px] font-bold text-purple-300 hover:text-purple-200 transition-colors"
        >
          <SvgIcon d={copiedId === p.id ? ICONS.check : ICONS.copy} className="w-3 h-3" />
          {copiedId === p.id ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs font-semibold text-purple-200 truncate font-mono">{p.accountId || '—'}</p>
    </div>

    <div className="mx-4 mb-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-sky-300" />
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Public Base URL</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={urls[p.id] ?? ''}
          onChange={e => setUrls(prev => ({ ...prev, [p.id]: e.target.value }))}
          disabled={savingUrlId === p.id}
          placeholder="https://pub-xxxx.r2.dev"
          className="flex-1 min-w-0 px-3.5 py-3 sm:py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 font-mono disabled:opacity-60"
        />
        <button
          onClick={() => onSaveUrl(p)}
          disabled={savingUrlId === p.id}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/25 text-sky-300 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {savingUrlId === p.id ? (
            <><span className="w-3.5 h-3.5 border-2 border-sky-300/30 border-t-sky-300 rounded-full animate-spin" /> Saving</>
          ) : (
            <><SvgIcon d={ICONS.save} className="w-3.5 h-3.5" /> Save</>
          )}
        </button>
      </div>
    </div>

    <div className="px-4 pb-4">
      <button
        onClick={() => onDisconnect(p)}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
      >
        <SvgIcon d={ICONS.trash} className="w-3.5 h-3.5" />
        Disconnect Bucket
      </button>
    </div>
  </div>
);

// ── Connect Form ──────────────────────────────────────────────────────
const ConnectForm: React.FC<{
  form: { bucketName: string; accountId: string; accessKeyId: string; secretAccessKey: string };
  setForm: React.Dispatch<React.SetStateAction<{ bucketName: string; accountId: string; accessKeyId: string; secretAccessKey: string }>>;
  bucketOptions: string[];
  fetchingBuckets: boolean;
  saving: boolean;
  showSecret: boolean;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  updateCred: (field: 'accountId' | 'accessKeyId' | 'secretAccessKey', value: string) => void;
  fetchBuckets: () => void;
  handleConnect: () => void;
  onCancel: (() => void) | null;
  inputCls: string;
}> = ({
  form, setForm, bucketOptions, fetchingBuckets, saving, showSecret, setShowSecret,
  updateCred, fetchBuckets, handleConnect, onCancel, inputCls,
}) => (
  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
    <div className="flex items-center gap-2 p-4 border-b border-white/[0.06]">
      <span className="w-1 h-5 bg-purple-400 rounded-full" />
      <SvgIcon d={ICONS.cloud} className="w-4 h-4 text-purple-300" />
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">
        {onCancel ? 'Add Another Bucket' : 'Connect Bucket'}
      </h3>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={saving}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 transition-all disabled:opacity-50"
          aria-label="Close form"
        >
          <SvgIcon d="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    <div className="px-4 pt-4 flex items-center gap-1">
      {[
        { n: 1, label: 'Credentials', done: !!(form.accountId && form.accessKeyId && form.secretAccessKey) },
        { n: 2, label: 'Buckets', done: bucketOptions.length > 0 },
        { n: 3, label: 'Connect', done: !!form.bucketName },
      ].map((s, i) => (
        <React.Fragment key={s.n}>
          <div className={`flex items-center gap-1.5 flex-shrink-0 ${s.done ? 'text-emerald-300' : 'text-white/30'}`}>
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
              s.done ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-white/[0.04] border border-white/[0.08]'
            }`}>
              {s.done ? <SvgIcon d={ICONS.check} className="w-3 h-3" /> : s.n}
            </span>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
          </div>
          {i < 2 && <div className={`flex-1 h-px transition-colors ${s.done ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
        </React.Fragment>
      ))}
    </div>

    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Cloudflare Account ID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={form.accountId}
            onChange={e => updateCred('accountId', e.target.value)}
            disabled={saving}
            className={`${inputCls} font-mono`}
            placeholder="32-character hex ID"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            R2 Access Key ID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={form.accessKeyId}
            onChange={e => updateCred('accessKeyId', e.target.value)}
            disabled={saving}
            className={`${inputCls} font-mono`}
            placeholder="Access Key ID"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            R2 Secret Access Key <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={form.secretAccessKey}
              onChange={e => updateCred('secretAccessKey', e.target.value)}
              disabled={saving}
              className={`${inputCls} font-mono pr-11`}
              placeholder="Secret Access Key"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              <SvgIcon d={showSecret ? ICONS.eyeOff : ICONS.eye} className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/[0.06]">
        <button
          onClick={fetchBuckets}
          disabled={fetchingBuckets || saving || !form.accountId || !form.accessKeyId || !form.secretAccessKey}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 hover:border-blue-500/40 text-blue-300 text-xs font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {fetchingBuckets ? (
            <><span className="w-3.5 h-3.5 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> Fetching buckets...</>
          ) : (
            <><SvgIcon d={ICONS.search} className="w-4 h-4" /> Fetch My Buckets</>
          )}
        </button>
      </div>

      {bucketOptions.length > 0 && (
        <div className="pt-3 border-t border-white/[0.06] animate-[fadeIn_200ms_ease-out]">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Select Bucket <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <select
              value={form.bucketName}
              onChange={e => setForm(prev => ({ ...prev, bucketName: e.target.value }))}
              disabled={saving}
              className={`${inputCls} appearance-none pl-10 pr-10`}
            >
              {bucketOptions.map(b => (
                <option key={b} value={b} className="bg-slate-900">{b}</option>
              ))}
            </select>
            <SvgIcon d={ICONS.folder} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <SvgIcon d="M19 9l-7 7-7-7" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
        <SvgIcon d={ICONS.shield} className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200/90 leading-relaxed">
          <span className="font-bold">Security tip:</span> Create a scoped API token in Cloudflare for only your bucket(s) — never use a key with full account access.
        </p>
      </div>
    </div>

    <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
      <button
        onClick={handleConnect}
        disabled={saving || !form.bucketName}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {saving ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting...</>
        ) : (
          <><SvgIcon d={ICONS.plug} className="w-4 h-4" /> Connect My Storage</>
        )}
      </button>
    </div>
  </div>
);

const MyStorageManager: React.FC<Props> = ({ token: tokenProp }) => {
  const resolveToken = () =>
    tokenProp || sessionStorage.getItem('subAdminToken') || localStorage.getItem('adminToken') || '';
  const authHeaders = (): Record<string, string> => {
    const t = resolveToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ bucketName: '', accountId: '', accessKeyId: '', secretAccessKey: '' });
  const [bucketOptions, setBucketOptions] = useState<string[]>([]);
  const [fetchingBuckets, setFetchingBuckets] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Double-click guard
  const pendingRef = useRef<Set<string>>(new Set());
  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try { await fn(); } catch { /* handled */ }
    finally { setTimeout(() => { pendingRef.current.delete(key); }, 250); }
  };

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; confirmLabel?: string; loading: boolean; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirm', loading: false, onConfirm: () => {} });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, open: false, loading: false }));

  const providers = status?.providers || [];
  const maxBuckets = status?.maxBuckets ?? 5;
  const canAddMore = providers.length < maxBuckets;

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message });

  const fetchStatus = async () => {
    await guarded('fetch-status', async () => {
      try {
        const res = await fetch(`${API_BASE}/uploads/my-provider`, { headers: authHeaders() });
        const data = await res.json();
        const list: Provider[] = Array.isArray(data.providers) ? data.providers : [];
        setStatus({ connected: list.length > 0, providers: list, maxBuckets: data.maxBuckets });
        setUrls(Object.fromEntries(list.map(p => [p.id, p.publicBaseUrl || ''])));
        if (list.length === 0) setShowForm(true);
      } catch {
        showToast('error', 'Failed to load storage status');
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(() => { fetchStatus(); }, []);

  const fetchBuckets = async () => {
    if (!form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      showToast('error', 'Account ID, Access Key, and Secret Key required');
      return;
    }
    await guarded('fetch-buckets', async () => {
      setToast(null);
      setFetchingBuckets(true);
      try {
        const res = await fetch(`${API_BASE}/uploads/list-buckets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            accountId: form.accountId, accessKeyId: form.accessKeyId, secretAccessKey: form.secretAccessKey,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setBucketOptions(data.buckets || []);
          if (data.buckets?.length) setForm(prev => ({ ...prev, bucketName: data.buckets[0] }));
          else showToast('error', 'No buckets found in this account');
        } else {
          showToast('error', data.error || 'Check your credentials and try again');
        }
      } catch {
        showToast('error', 'Network error');
      } finally {
        setFetchingBuckets(false);
      }
    });
  };

  const updateCred = (field: 'accountId' | 'accessKeyId' | 'secretAccessKey', value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setBucketOptions([]);
  };

  const resetForm = () => {
    setForm({ bucketName: '', accountId: '', accessKeyId: '', secretAccessKey: '' });
    setBucketOptions([]);
    setShowSecret(false);
  };

  const handleConnect = async () => {
    setToast(null);
    if (!form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      showToast('error', 'Please fill all fields and select a bucket');
      return;
    }
    await guarded('connect-storage', async () => {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/uploads/my-provider`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('success', data.updated ? 'Credentials updated!' : 'Bucket connected successfully!');
          resetForm();
          setShowForm(false);
          setTimeout(fetchStatus, 300);
        } else {
          showToast('error', data.error || 'Could not connect');
        }
      } catch {
        showToast('error', 'Network error');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDisconnect = (p: Provider) => {
    setConfirmModal({
      open: true,
      title: `Disconnect "${p.bucketName}"?`,
      message: 'Previously uploaded videos will remain in R2, they will just be removed from the dropdown.',
      confirmLabel: 'Disconnect',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        await guarded(`disconnect-${p.id}`, async () => {
          try {
            const res = await fetch(`${API_BASE}/uploads/my-provider/${p.id}`, {
              method: 'DELETE', headers: authHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Disconnect failed');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
            showToast('success', `"${p.bucketName}" disconnected`);
            setTimeout(fetchStatus, 300);
          } catch (e: any) {
            showToast('error', e.message || 'Disconnect failed');
            setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
          }
        });
      },
    });
  };

  const savePublicUrl = async (p: Provider) => {
    setToast(null);
    await guarded(`save-url-${p.id}`, async () => {
      setSavingUrlId(p.id);
      try {
        const res = await fetch(`${API_BASE}/uploads/my-provider/${p.id}/public-url`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ publicBaseUrl: (urls[p.id] || '').trim() }),
        });
        const data = await res.json();
        if (res.ok) showToast('success', `Public URL saved for "${p.bucketName}"`);
        else showToast('error', data.error || 'Could not save');
      } catch {
        showToast('error', 'Network error');
      } finally {
        setSavingUrlId(null);
      }
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ignore */ }
  };

  const inputCls = "w-full px-3.5 py-3 sm:py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm sm:text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a14] text-white">
        <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-2xl bg-white/10" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 bg-white/10 rounded-full" />
              <div className="h-3 w-56 bg-white/5 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-pulse" />
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-pulse" />
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-pulse" />
          </div>
          <div className="grid lg:grid-cols-2 gap-3">
            <ProviderSkeleton />
            <ProviderSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = providers.length === 0;
  const activeCount = providers.filter(p => p.isActive).length;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translate(-50%, -24px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 24px rgba(168,85,247,0.3); } 50% { box-shadow: 0 0 40px rgba(236,72,153,0.5); } }
        .msm-glow { animation: glowPulse 3s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#0b0a14] text-white pb-24">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">

          {/* ─── Header ─────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/[0.18] via-fuchsia-600/[0.08] to-transparent border border-purple-500/20 p-4 sm:p-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3 sm:gap-4">
              <div className="msm-glow flex-shrink-0 p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl">
                <SvgIcon d={ICONS.storage} className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                  My Storage
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Connect up to <span className="text-purple-300 font-semibold">{maxBuckets} Cloudflare R2 buckets</span> — all appear on the Video Upload page
                </p>
              </div>
            </div>

            <div className="relative grid grid-cols-3 gap-2 mt-4 max-w-md">
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Connected</p>
                <p className="text-base sm:text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
                  {providers.length}<span className="text-white/30 text-xs font-normal">/{maxBuckets}</span>
                </p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Active</p>
                <p className="text-base sm:text-lg font-bold text-sky-300 tabular-nums mt-0.5">{activeCount}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Slots</p>
                <p className="text-base sm:text-lg font-bold text-purple-300 tabular-nums mt-0.5">
                  {canAddMore ? maxBuckets - providers.length : 0}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Empty state ─────────────────────────────── */}
          {isEmpty && (
            <div className="max-w-2xl mx-auto w-full">
              {!showForm ? (
                <div className="relative overflow-hidden rounded-3xl border border-dashed border-purple-500/30 bg-gradient-to-br from-purple-500/[0.06] to-pink-500/[0.04] p-6 sm:p-10 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 mb-4 msm-glow">
                    <SvgIcon d={ICONS.cloud} className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">No storage connected yet</h3>
                  <p className="text-xs sm:text-sm text-white/50 max-w-sm mx-auto leading-relaxed mb-6">
                    Bring your own Cloudflare R2 bucket to upload and stream videos — get started in under 2 minutes.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <SvgIcon d={ICONS.plug} className="w-4 h-4" />
                    Connect Your First Bucket
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6 text-left">
                    {[
                      { icon: ICONS.zap, text: 'Fast setup' },
                      { icon: ICONS.shield, text: 'Encrypted credentials' },
                      { icon: ICONS.sparkles, text: 'Instant integration' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <SvgIcon d={f.icon} className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
                        <span className="text-[11px] font-medium text-white/70">{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ConnectForm
                  form={form}
                  setForm={setForm}
                  bucketOptions={bucketOptions}
                  fetchingBuckets={fetchingBuckets}
                  saving={saving}
                  showSecret={showSecret}
                  setShowSecret={setShowSecret}
                  updateCred={updateCred}
                  fetchBuckets={fetchBuckets}
                  handleConnect={handleConnect}
                  onCancel={null}
                  inputCls={inputCls}
                />
              )}
            </div>
          )}

          {/* ─── Split layout (has providers) ───────────── */}
          {!isEmpty && (
            <div className="grid lg:grid-cols-5 gap-4 lg:gap-6 items-start">
              <div className={`${showForm ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-3 min-w-0`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1 h-4 bg-emerald-400 rounded-full" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Connected Buckets</h2>
                  <span className="ml-auto text-[10px] font-bold text-white/40 tabular-nums">
                    {providers.length} of {maxBuckets}
                  </span>
                </div>

                <div className={`grid gap-3 ${showForm ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                  {providers.map(p => (
                    <ProviderCard
                      key={p.id}
                      p={p}
                      urls={urls}
                      setUrls={setUrls}
                      savingUrlId={savingUrlId}
                      onSaveUrl={savePublicUrl}
                      onDisconnect={handleDisconnect}
                      copiedId={copiedId}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </div>

                {!showForm && (
                  canAddMore ? (
                    <button
                      onClick={() => { setShowForm(true); setToast(null); }}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/[0.06] text-purple-300 text-sm font-bold rounded-2xl transition-all active:scale-[0.99]"
                    >
                      <SvgIcon d={ICONS.plus} className="w-4 h-4" />
                      Add Another Bucket
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                      <SvgIcon d={ICONS.info} className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                      <p className="text-[11px] text-amber-200/90">
                        Maximum {maxBuckets} buckets reached. Disconnect one to add another.
                      </p>
                    </div>
                  )
                )}
              </div>

              {showForm && (
                <div className="lg:col-span-2 min-w-0">
                  <div className="lg:sticky lg:top-4">
                    <ConnectForm
                      form={form}
                      setForm={setForm}
                      bucketOptions={bucketOptions}
                      fetchingBuckets={fetchingBuckets}
                      saving={saving}
                      showSecret={showSecret}
                      setShowSecret={setShowSecret}
                      updateCred={updateCred}
                      fetchBuckets={fetchBuckets}
                      handleConnect={handleConnect}
                      onCancel={() => { setShowForm(false); resetForm(); setToast(null); }}
                      inputCls={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </>
  );
};

export default MyStorageManager;