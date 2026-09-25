// src/components/admin/MyStorageManager.tsx — Sub-admin self-service R2 connect (Premium UI)
import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Props {
  token?: string;
}

interface Status {
  connected: boolean;
  hostname?: string;
  bucketName?: string;
  accountId?: string;
  isActive?: boolean;
  publicBaseUrl?: string;
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
  warning:    'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  link:       'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  key:        'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  folder:     'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  search:     'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  save:       'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  plug:       'M13 10V3L4 14h7v7l9-11h-7z',
  info:       'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  cloud:      'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
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
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            danger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <SvgIcon d={ICONS.warning} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${
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

const MyStorageManager: React.FC<Props> = ({ token: tokenProp }) => {
  const resolveToken = () =>
    tokenProp || sessionStorage.getItem('subAdminToken') || localStorage.getItem('adminToken') || '';

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [publicUrl, setPublicUrl] = useState('');
  const [savingPublicUrl, setSavingPublicUrl] = useState(false);

  const [form, setForm] = useState({
    bucketName: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
  });

  const [bucketOptions, setBucketOptions] = useState<string[]>([]);
  const [fetchingBuckets, setFetchingBuckets] = useState(false);

  // ── Confirm modal state ─────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirm', onConfirm: () => {} });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, open: false }));

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/my-provider`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setStatus(data);
      setPublicUrl(data.publicBaseUrl || '');
    } catch {
      setError('Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const fetchBuckets = async () => {
    if (!form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Please fill Account ID, Access Key, and Secret Key first');
      return;
    }
    setError(''); setSuccess('');
    setFetchingBuckets(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/list-buckets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          accountId: form.accountId,
          accessKeyId: form.accessKeyId,
          secretAccessKey: form.secretAccessKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBucketOptions(data.buckets || []);
        if (data.buckets?.length) {
          setForm(prev => ({ ...prev, bucketName: data.buckets[0] }));
        } else {
          setError('No buckets found in this account');
        }
      } else {
        setError(data.error || 'Could not fetch buckets — please check your credentials');
      }
    } catch {
      setError('Network error');
    } finally {
      setFetchingBuckets(false);
    }
  };

  const updateCred = (field: 'accountId' | 'accessKeyId' | 'secretAccessKey', value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setBucketOptions([]);
  };

  const handleConnect = async () => {
    setError(''); setSuccess('');
    if (!form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Please fill all fields and select a bucket');
      return;
    }
    setSaving(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/my-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Bucket connected! It will now appear on the Video Upload page.');
        setForm({ bucketName: '', accountId: '', accessKeyId: '', secretAccessKey: '' });
        setBucketOptions([]);
        fetchStatus();
      } else {
        setError(data.error || 'Could not connect');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    setConfirmModal({
      open: true,
      title: 'Disconnect Storage?',
      message: 'Do you want to disconnect your storage? Previously uploaded videos will remain in R2, they will just be removed from the dropdown.',
      confirmLabel: 'Disconnect',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          const token = resolveToken();
          await fetch(`${API_BASE}/uploads/my-provider`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          fetchStatus();
        } catch {
          setError('Disconnect failed');
        }
      },
    });
  };

  const savePublicUrl = async () => {
    setError(''); setSuccess('');
    setSavingPublicUrl(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/my-provider/public-url`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ publicBaseUrl: publicUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) setSuccess('Public URL saved!');
      else setError(data.error || 'Could not save');
    } catch { setError('Network error'); }
    finally { setSavingPublicUrl(false); }
  };

  const inputCls = "w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0b0a14]">
        <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="mt-3 text-xs text-gray-500 font-medium">Loading storage status...</p>
      </div>
    );
  }

  return (
    <>
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl mx-auto bg-[#0b0a14] text-white">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 shadow-lg shadow-purple-500/10">
          <SvgIcon d={ICONS.storage} className="w-6 h-6 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">My Storage</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect your own Cloudflare R2 account — your bucket will be detected automatically
          </p>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl text-rose-200 text-xs">
          <SvgIcon d={ICONS.warning} className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 p-3 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl text-emerald-200 text-xs">
          <SvgIcon d={ICONS.check} className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {status?.connected ? (
        <>
          {/* ─── Connected Card ─────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-400 rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Connected Bucket</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Bucket</p>
                <p className="text-xs font-bold text-purple-300 truncate">{status.bucketName || '—'}</p>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Account ID</p>
                <p className="text-xs font-bold text-purple-300 truncate font-mono">{status.accountId || '—'}</p>
              </div>
            </div>
          </div>

          {/* ─── Public URL Card ────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-sky-400 rounded-full" />
              <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-sky-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Public URL</h3>
            </div>
            <p className="text-[10px] text-gray-500">
              r2.dev subdomain or custom domain — this is used to generate links
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <SvgIcon d={ICONS.link} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={publicUrl}
                  onChange={e => setPublicUrl(e.target.value)}
                  placeholder="https://pub-xxxx.r2.dev"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-sky-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
              </div>
              <button
                onClick={savePublicUrl}
                disabled={savingPublicUrl}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/25 text-sky-300 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
              >
                {savingPublicUrl ? (
                  <><span className="w-3.5 h-3.5 border-2 border-sky-300/30 border-t-sky-300 rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><SvgIcon d={ICONS.save} className="w-3.5 h-3.5" /> Save</>
                )}
              </button>
            </div>
          </div>

          {/* ─── Disconnect ─────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1 h-4 bg-rose-400 rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Danger Zone</h3>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              Disconnecting your storage will leave old files in R2, they will just be removed from the dropdown
            </p>
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 text-xs font-bold rounded-xl transition-all"
            >
              <SvgIcon d={ICONS.trash} className="w-3.5 h-3.5" /> Disconnect Storage
            </button>
          </div>
        </>
      ) : (
        /* ─── Connect Form ─────────────────────────────── */
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-400 rounded-full" />
            <SvgIcon d={ICONS.cloud} className="w-3.5 h-3.5 text-purple-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Connect R2 Bucket</h3>
          </div>

          {/* Step 1: Credentials */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/25 text-[10px] font-bold text-purple-300">1</span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Credentials</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Cloudflare Account ID *
              </label>
              <input
                type="text"
                value={form.accountId}
                onChange={e => updateCred('accountId', e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="32-character hex ID"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                R2 Access Key ID *
              </label>
              <input
                type="text"
                value={form.accessKeyId}
                onChange={e => updateCred('accessKeyId', e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="Access Key ID"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                R2 Secret Access Key *
              </label>
              <input
                type="password"
                value={form.secretAccessKey}
                onChange={e => updateCred('secretAccessKey', e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="Secret Access Key"
              />
            </div>
          </div>

          {/* Step 2: Fetch Buckets */}
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[10px] font-bold text-blue-300">2</span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Fetch Buckets</p>
            </div>
            <button
              onClick={fetchBuckets}
              disabled={fetchingBuckets || !form.accountId || !form.accessKeyId || !form.secretAccessKey}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {fetchingBuckets ? (
                <><span className="w-3.5 h-3.5 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> Fetching buckets...</>
              ) : (
                <><SvgIcon d={ICONS.search} className="w-3.5 h-3.5" /> Fetch My Buckets</>
              )}
            </button>
          </div>

          {/* Step 3: Select bucket */}
          {bucketOptions.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] font-bold text-emerald-300">3</span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Select Bucket</p>
              </div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Bucket Name *
              </label>
              <div className="relative">
                <select
                  value={form.bucketName}
                  onChange={e => setForm(prev => ({ ...prev, bucketName: e.target.value }))}
                  className={`${inputCls} appearance-none pl-9 pr-8`}
                >
                  {bucketOptions.map(b => (
                    <option key={b} value={b} className="bg-slate-900">{b}</option>
                  ))}
                </select>
                <SvgIcon d={ICONS.folder} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <SvgIcon d="M19 9l-7 7-7-7" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Tip */}
          <div className="flex items-start gap-2 p-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
            <SvgIcon d={ICONS.info} className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-200/90 leading-relaxed">
              <span className="font-bold">Tip:</span> In the Cloudflare dashboard, create a scoped API token for only your bucket(s) — don't use a key that has access to your whole account.
            </p>
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={saving || !form.bucketName}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting...</>
            ) : (
              <><SvgIcon d={ICONS.plug} className="w-4 h-4" /> Connect My Storage</>
            )}
          </button>
        </div>
      )}
    </div>

    {/* ─── Confirm Modal ──────────────────────────────── */}
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

export default MyStorageManager;