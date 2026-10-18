// src/components/admin/R2ProviderManager.tsx — Admin view: manage sub-admin R2 buckets (Premium UI)
import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface R2Provider {
  _id: string;
  hostname: string;
  bucketName: string;
  accountId: string;
  ownerUsername?: string;
  label?: string;
  isActive?: boolean;
  publicBaseUrl?: string;
  createdAt?: string;
}

interface SubAdminOption {
  username: string;
  name?: string;
  isBlocked?: boolean;
}

interface Props {
  token?: string;
}

const subAdminLabel = (s: SubAdminOption) =>
  `${s.name ? `${s.name} (@${s.username})` : s.username}${s.isBlocked ? ' 🚫 blocked' : ''}`;

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  server:     'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
  check:      'M5 13l4 4L19 7',
  checkCircle:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:    'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  xCircle:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  link:       'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  folder:     'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus:       'M12 4v16m8-8H4',
  eye:        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:     'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  copy:       'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  shield:     'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  zap:        'M13 10V3L4 14h7v7l9-11h-7z',
  sparkles:   'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  power:      'M5.636 5.636a9 9 0 1012.728 0M12 3v9',
  user:       'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  key:        'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  cloud:      'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  chevron:    'M19 9l-7 7-7-7',
};

// ── Confirm Modal ─────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onCancel}
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
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:py-2 text-sm sm:text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto rounded-xl px-4 py-3 sm:py-2 text-sm sm:text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}
          >
            {confirmLabel}
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

// ── Skeletons ─────────────────────────────────────────────────────────
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

const emptyForm = {
  hostname: '', bucketName: '', accountId: '',
  accessKeyId: '', secretAccessKey: '',
  ownerUsername: '', label: '', publicBaseUrl: '',
};

const R2ProviderManager: React.FC<Props> = ({ token: tokenProp }) => {
  const resolveToken = () => tokenProp || localStorage.getItem('adminToken') || '';
  const authHeaders = (): Record<string, string> => {
    const t = resolveToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const [providers, setProviders] = useState<R2Provider[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdminOption[]>([]);
  const [subAdminsError, setSubAdminsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showSecret, setShowSecret] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [changingOwnerId, setChangingOwnerId] = useState<string | null>(null);

  // Double-click guard
  const pendingRef = useRef<Set<string>>(new Set());
  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try { await fn(); } catch { /* handled */ }
    finally { setTimeout(() => { pendingRef.current.delete(key); }, 250); }
  };

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: 'Delete', onConfirm: () => {} });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, open: false }));

  const [form, setForm] = useState({ ...emptyForm });

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message });

  const fetchProviders = async () => {
    await guarded('fetch-providers', async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/r2-providers`, { headers: authHeaders() });
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : []);
      } catch {
        showToast('error', 'Failed to load providers');
      } finally {
        setLoading(false);
      }
    });
  };

  // ✅ FIXED: Surface errors instead of silently swallowing them
  const fetchSubAdmins = async () => {
    try {
      const res = await fetch(`${API_BASE}/r2-providers/sub-admins`, { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubAdminsError(
          res.status === 404
            ? 'Backend update/deploy nahi hua (404)'
            : res.status === 403 || res.status === 401
            ? 'Sirf main admin ye list dekh sakta hai (login check karo)'
            : (data as any)?.error || `Error ${res.status}`
        );
        return;
      }
      setSubAdminsError('');
      setSubAdmins(Array.isArray(data) ? data : []);
    } catch {
      setSubAdminsError('Network error');
    }
  };

  useEffect(() => { fetchProviders(); fetchSubAdmins(); }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setShowSecret(false);
  };

  const handleSubmit = async () => {
    setToast(null);
    if (!form.ownerUsername || !form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      showToast('error', 'Sub-admin, Bucket Name, Account ID, Access Key & Secret Key required');
      return;
    }
    await guarded('save-provider', async () => {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/r2-providers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('success', 'R2 provider added successfully!');
          resetForm();
          setShowForm(false);
          setTimeout(fetchProviders, 300);
        } else {
          showToast('error', data.error || 'Something went wrong');
        }
      } catch {
        showToast('error', 'Network error');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleToggle = async (p: R2Provider) => {
    await guarded(`toggle-${p._id}`, async () => {
      setTogglingId(p._id);
      try {
        await fetch(`${API_BASE}/r2-providers/${p._id}/toggle`, {
          method: 'PATCH',
          headers: authHeaders(),
        });
        showToast('success', `${p.label || p.hostname} ${p.isActive !== false ? 'deactivated' : 'activated'}`);
        setTimeout(fetchProviders, 300);
      } catch {
        showToast('error', 'Toggle failed');
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleChangeOwner = async (p: R2Provider, newOwner: string) => {
    if ((p.ownerUsername || '') === newOwner) return;
    await guarded(`owner-${p._id}`, async () => {
      setChangingOwnerId(p._id);
      try {
        const res = await fetch(`${API_BASE}/r2-providers/${p._id}/owner`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ ownerUsername: newOwner }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not change owner');
        showToast('success', newOwner ? `Access diya: ${newOwner}` : 'Owner hata diya');
        setTimeout(fetchProviders, 300);
      } catch (e: any) {
        showToast('error', e.message || 'Failed');
      } finally {
        setChangingOwnerId(null);
      }
    });
  };

  const handleDelete = (p: R2Provider) => {
    setConfirmModal({
      open: true,
      title: `Delete "${p.label || p.hostname}"?`,
      message: 'This R2 provider will be removed and all its links will stop working. This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        closeConfirmModal();
        await guarded(`delete-${p._id}`, async () => {
          try {
            await fetch(`${API_BASE}/r2-providers/${p._id}`, {
              method: 'DELETE',
              headers: authHeaders(),
            });
            showToast('success', 'Provider deleted');
            setTimeout(fetchProviders, 300);
          } catch {
            showToast('error', 'Delete failed');
          }
        });
      },
    });
  };

  const copyUrlPrefix = async (p: R2Provider) => {
    const text = p.publicBaseUrl ? `${p.publicBaseUrl.replace(/\/+$/, '')}/` : `https://${p.hostname}/`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(p._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ignore */ }
  };

  const inputCls = "w-full px-3.5 py-3 sm:py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm sm:text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed";

  const activeCount = providers.filter(p => p.isActive !== false).length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a14] text-white">
        <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-2xl bg-white/10" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-56 bg-white/10 rounded-full" />
              <div className="h-3 w-72 bg-white/5 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-xl">
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

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translate(-50%, -24px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 24px rgba(168,85,247,0.3); } 50% { box-shadow: 0 0 40px rgba(236,72,153,0.5); } }
        .r2pm-glow { animation: glowPulse 3s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#0b0a14] text-white pb-24">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">

          {/* ─── Header ─────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/[0.18] via-fuchsia-600/[0.08] to-transparent border border-purple-500/20 p-4 sm:p-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3 sm:gap-4">
              <div className="r2pm-glow flex-shrink-0 p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl">
                <SvgIcon d={ICONS.server} className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                  R2 Providers
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Admin
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Manage sub-admin Cloudflare R2 buckets — assign any bucket to any sub-admin
                </p>
              </div>
            </div>

            {/* Mini stats */}
            <div className="relative grid grid-cols-3 gap-2 mt-4 max-w-md">
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Total</p>
                <p className="text-base sm:text-lg font-bold text-purple-300 tabular-nums mt-0.5">{providers.length}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Active</p>
                <p className="text-base sm:text-lg font-bold text-emerald-300 tabular-nums mt-0.5">{activeCount}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40">Inactive</p>
                <p className="text-base sm:text-lg font-bold text-amber-300 tabular-nums mt-0.5">{providers.length - activeCount}</p>
              </div>
            </div>
          </div>

          {/* ─── Empty state ─────────────────────────────── */}
          {isEmpty && !showForm && (
            <div className="max-w-2xl mx-auto w-full">
              <div className="relative overflow-hidden rounded-3xl border border-dashed border-purple-500/30 bg-gradient-to-br from-purple-500/[0.06] to-pink-500/[0.04] p-6 sm:p-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 mb-4 r2pm-glow">
                  <SvgIcon d={ICONS.cloud} className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">No R2 providers yet</h3>
                <p className="text-xs sm:text-sm text-white/50 max-w-sm mx-auto leading-relaxed mb-6">
                  Add an R2 bucket and assign it to a sub-admin so it shows up on their upload page.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <SvgIcon d={ICONS.plus} className="w-4 h-4" />
                  Add Your First Provider
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
            </div>
          )}

          {/* ─── Split layout (has providers) ───────────── */}
          {!isEmpty && (
            <div className="grid lg:grid-cols-5 gap-4 lg:gap-6 items-start">
              {/* Left: providers list */}
              <div className={`${showForm ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-3 min-w-0`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1 h-4 bg-purple-400 rounded-full" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">All Providers</h2>
                  <span className="ml-auto text-[10px] font-bold text-white/40 tabular-nums">{providers.length}</span>
                </div>

                <div className={`grid gap-3 ${showForm ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                  {providers.map(p => (
                    <ProviderCard
                      key={p._id}
                      p={p}
                      copiedId={copiedId}
                      togglingId={togglingId}
                      subAdmins={subAdmins}
                      changingOwnerId={changingOwnerId}
                      onCopyUrl={copyUrlPrefix}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onChangeOwner={handleChangeOwner}
                    />
                  ))}
                </div>

                {!showForm && (
                  <button
                    onClick={() => { setShowForm(true); setToast(null); }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/[0.06] text-purple-300 text-sm font-bold rounded-2xl transition-all active:scale-[0.99]"
                  >
                    <SvgIcon d={ICONS.plus} className="w-4 h-4" />
                    Add Another Provider
                  </button>
                )}
              </div>

              {/* Right: form (sticky) */}
              {showForm && (
                <div className="lg:col-span-2 min-w-0">
                  <div className="lg:sticky lg:top-4">
                    <ProviderForm
                      form={form}
                      subAdmins={subAdmins}
                      subAdminsError={subAdminsError}
                      handleChange={handleChange}
                      saving={saving}
                      showSecret={showSecret}
                      setShowSecret={setShowSecret}
                      handleSubmit={handleSubmit}
                      onCancel={() => { setShowForm(false); resetForm(); setToast(null); }}
                      inputCls={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state with form open (no providers yet) */}
          {isEmpty && showForm && (
            <div className="max-w-2xl mx-auto w-full">
              <ProviderForm
                form={form}
                subAdmins={subAdmins}
                subAdminsError={subAdminsError}
                handleChange={handleChange}
                saving={saving}
                showSecret={showSecret}
                setShowSecret={setShowSecret}
                handleSubmit={handleSubmit}
                onCancel={() => { setShowForm(false); resetForm(); setToast(null); }}
                inputCls={inputCls}
              />
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
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </>
  );
};

// ── Provider Card ─────────────────────────────────────────────────────
const ProviderCard: React.FC<{
  p: R2Provider;
  copiedId: string | null;
  togglingId: string | null;
  subAdmins: SubAdminOption[];
  changingOwnerId: string | null;
  onCopyUrl: (p: R2Provider) => void;
  onToggle: (p: R2Provider) => void;
  onDelete: (p: R2Provider) => void;
  onChangeOwner: (p: R2Provider, newOwner: string) => void;
}> = ({ p, copiedId, togglingId, subAdmins, changingOwnerId, onCopyUrl, onToggle, onDelete, onChangeOwner }) => {
  const isActive = p.isActive !== false;
  const urlPrefix = p.publicBaseUrl ? `${p.publicBaseUrl.replace(/\/+$/, '')}/` : `https://${p.hostname}/`;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 transition-all">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-3">
        <span className={`w-1 h-5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <SvgIcon d={ICONS.server} className="w-4 h-4 text-purple-300 flex-shrink-0" />
        <h3 className="text-sm font-bold text-white truncate flex-1" title={p.label || p.hostname}>
          {p.label || p.hostname}
        </h3>
        <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
          isActive
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
            : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
        }`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Owner — dropdown se badlo */}
      <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500/[0.08] to-purple-500/[0.06] border border-pink-500/20">
        <SvgIcon d={ICONS.user} className="w-3.5 h-3.5 text-pink-300 flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Owner</span>
        <div className="ml-auto relative min-w-0 max-w-[65%]">
          <select
            value={p.ownerUsername || ''}
            onChange={e => onChangeOwner(p, e.target.value)}
            disabled={changingOwnerId === p._id}
            className="w-full appearance-none truncate pl-2 pr-6 py-1 bg-white/[0.06] border border-white/[0.1] rounded-lg text-xs font-bold text-pink-200 outline-none focus:border-pink-500/50 disabled:opacity-50"
          >
            <option value="" className="bg-slate-900">— No owner —</option>
            {p.ownerUsername && !subAdmins.some(s => s.username === p.ownerUsername) && (
              <option value={p.ownerUsername} className="bg-slate-900">{p.ownerUsername} (not found)</option>
            )}
            {subAdmins.map(s => (
              <option key={s.username} value={s.username} className="bg-slate-900">
                {subAdminLabel(s)}
              </option>
            ))}
          </select>
          <SvgIcon d={ICONS.chevron} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Bucket + Account ID */}
      <div className="mx-4 mb-3 grid grid-cols-1 gap-2">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-1">
            <SvgIcon d={ICONS.folder} className="w-3 h-3 text-purple-300 flex-shrink-0" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Bucket</p>
          </div>
          <p className="text-xs font-semibold text-white truncate font-mono">{p.bucketName}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-1">
            <SvgIcon d={ICONS.key} className="w-3 h-3 text-sky-300 flex-shrink-0" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Account ID</p>
          </div>
          <p className="text-xs font-semibold text-sky-200 truncate font-mono">{p.accountId}</p>
        </div>
      </div>

      {/* URL prefix with copy */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-emerald-300" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
              {p.publicBaseUrl ? 'Public URL' : 'URL Prefix (not public)'}
            </p>
          </div>
          <button
            onClick={() => onCopyUrl(p)}
            className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            <SvgIcon d={copiedId === p._id ? ICONS.check : ICONS.copy} className="w-3 h-3" />
            {copiedId === p._id ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[11px] text-white/60 font-mono truncate px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          {urlPrefix}
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => onToggle(p)}
          disabled={togglingId === p._id}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive
              ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-300'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300'
          }`}
        >
          {togglingId === p._id ? (
            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <SvgIcon d={ICONS.power} className="w-3.5 h-3.5" />
          )}
          {isActive ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={() => onDelete(p)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
        >
          <SvgIcon d={ICONS.trash} className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
};

// ── Provider Form ─────────────────────────────────────────────────────
const ProviderForm: React.FC<{
  form: typeof emptyForm;
  subAdmins: SubAdminOption[];
  subAdminsError: string;
  handleChange: (field: string, value: string) => void;
  saving: boolean;
  showSecret: boolean;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: () => void;
  onCancel: () => void;
  inputCls: string;
}> = ({ form, subAdmins, subAdminsError, handleChange, saving, showSecret, setShowSecret, handleSubmit, onCancel, inputCls }) => {
  const step1Done = !!form.ownerUsername;
  const step2Done = !!(form.bucketName && form.accountId);
  const step3Done = !!(form.accessKeyId && form.secretAccessKey);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      {/* Form header */}
      <div className="flex items-center gap-2 p-4 border-b border-white/[0.06]">
        <span className="w-1 h-5 bg-purple-400 rounded-full" />
        <SvgIcon d={ICONS.cloud} className="w-4 h-4 text-purple-300" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">Add R2 Provider</h3>
        <button
          onClick={onCancel}
          disabled={saving}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 transition-all disabled:opacity-50"
          aria-label="Close form"
        >
          <SvgIcon d="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress steps */}
      <div className="px-4 pt-4 flex items-center gap-1">
        {[
          { n: 1, label: 'Owner', done: step1Done },
          { n: 2, label: 'Bucket', done: step2Done },
          { n: 3, label: 'Keys', done: step3Done },
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
        {/* Step 1: Sub-admin + Hostname + Label */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Sub-admin <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={form.ownerUsername}
                onChange={e => handleChange('ownerUsername', e.target.value)}
                disabled={saving}
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="" className="bg-slate-900">Select sub-admin...</option>
                {subAdmins.map(s => (
                  <option key={s.username} value={s.username} className="bg-slate-900">
                    {subAdminLabel(s)}
                  </option>
                ))}
              </select>
              <SvgIcon d={ICONS.chevron} className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            {/* ✅ Surface fetch error / empty / success hint clearly */}
            {subAdminsError ? (
              <p className="mt-1 text-[10px] text-rose-300">⚠ {subAdminsError}</p>
            ) : subAdmins.length === 0 ? (
              <p className="mt-1 text-[10px] text-amber-300">Koi sub-admin nahi mila. Pehle Sub-Admin Manager me bana lo.</p>
            ) : (
              <p className="mt-1 text-[10px] text-white/40">Yeh bucket sirf is sub-admin ko dikhega</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Hostname <span className="text-white/30 font-normal normal-case">(optional — khali chhodo to auto)</span>
            </label>
            <input
              type="text"
              value={form.hostname}
              onChange={e => handleChange('hostname', e.target.value)}
              disabled={saving}
              className={`${inputCls} font-mono`}
              placeholder="auto-generate hoga"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Label <span className="text-white/30 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={form.label}
              onChange={e => handleChange('label', e.target.value)}
              disabled={saving}
              className={inputCls}
              placeholder="Sub-admin 1 ka bucket"
            />
          </div>
        </div>

        {/* Step 2: Bucket + Account + Public URL */}
        <div className="pt-3 border-t border-white/[0.06] space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Bucket Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.bucketName}
              onChange={e => handleChange('bucketName', e.target.value)}
              disabled={saving}
              className={`${inputCls} font-mono`}
              placeholder="their-bucket-name"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Cloudflare Account ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.accountId}
              onChange={e => handleChange('accountId', e.target.value)}
              disabled={saving}
              className={`${inputCls} font-mono`}
              placeholder="32-character hex ID"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Public URL <span className="text-white/30 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={form.publicBaseUrl}
              onChange={e => handleChange('publicBaseUrl', e.target.value)}
              disabled={saving}
              className={`${inputCls} font-mono`}
              placeholder="https://pub-xxxx.r2.dev"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Step 3: Keys */}
        <div className="pt-3 border-t border-white/[0.06] space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              R2 Access Key ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.accessKeyId}
              onChange={e => handleChange('accessKeyId', e.target.value)}
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
                onChange={e => handleChange('secretAccessKey', e.target.value)}
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
            <p className="mt-1 text-[10px] text-white/40">Encrypted at rest</p>
          </div>
        </div>

        {/* Security tip */}
        <div className="flex items-start gap-2 p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
          <SvgIcon d={ICONS.shield} className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            <span className="font-bold">Security tip:</span> Create a scoped API token in Cloudflare for only this bucket — never use a key with full account access.
          </p>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
        <button
          onClick={handleSubmit}
          disabled={saving || !form.ownerUsername || !form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {saving ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
          ) : (
            <><SvgIcon d={ICONS.check} className="w-4 h-4" /> Save Provider</>
          )}
        </button>
      </div>
    </div>
  );
};

export default R2ProviderManager;