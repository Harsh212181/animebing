 // src/components/admin/R2ProviderManager.tsx
import React, { useState, useEffect } from 'react';

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
  createdAt?: string;
}

interface Props {
  token?: string;
}

// ── SvgIcon helper ──────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const WARNING_ICON = 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z';

// ── 🆕 Confirm Modal ─────────────────────────────────────────────────
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
            <SvgIcon d={WARNING_ICON} className="h-5 w-5" />
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

const R2ProviderManager: React.FC<Props> = ({ token: tokenProp }) => {
  const resolveToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [providers, setProviders] = useState<R2Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 🆕 Confirm modal state (confirmLabel included)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: 'Delete', onConfirm: () => {} });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, open: false }));

  const [form, setForm] = useState({
    hostname: '',
    bucketName: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    ownerUsername: '',
    label: '',
  });

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/r2-providers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      hostname: '', bucketName: '', accountId: '',
      accessKeyId: '', secretAccessKey: '', ownerUsername: '', label: ''
    });
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!form.hostname || !form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Hostname, Bucket Name, Account ID, Access Key, aur Secret Key zaroori hain');
      return;
    }

    setSaving(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/r2-providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('R2 Provider add ho gaya!');
        resetForm();
        setShowForm(false);
        fetchProviders();
      } else {
        setError(data.error || 'Kuch galat ho gaya');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const token = resolveToken();
      await fetch(`${API_BASE}/r2-providers/${id}/toggle`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchProviders();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete R2 Provider?',
      message: 'Yeh R2 provider delete karna hai? Iske links kaam karna band kar denge. This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          const token = resolveToken();
          await fetch(`${API_BASE}/r2-providers/${id}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          fetchProviders();
        } catch (err) {
          console.error('Delete failed:', err);
        }
      },
    });
  };

  const copyUrlPrefix = (hostname: string) => {
    navigator.clipboard.writeText(`https://${hostname}/`);
    setSuccess(`Copied: https://${hostname}/`);
    setTimeout(() => setSuccess(''), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-white/60">Loading...</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
          R2 Providers (Sub-Admin Buckets)
        </h2>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-medium transition-all"
        >
          {showForm ? 'Cancel' : '+ Naya R2 Provider Add Karo'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Hostname (unique naam, DNS nahi chahiye) *
              </label>
              <input
                type="text"
                placeholder="e.g. subadmin1-videos.internal"
                value={form.hostname}
                onChange={e => handleChange('hostname', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Bucket Name *</label>
              <input
                type="text"
                placeholder="unka-bucket-ka-naam"
                value={form.bucketName}
                onChange={e => handleChange('bucketName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Cloudflare Account ID *</label>
              <input
                type="text"
                placeholder="32-character hex ID"
                value={form.accountId}
                onChange={e => handleChange('accountId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">R2 Access Key ID *</label>
              <input
                type="text"
                value={form.accessKeyId}
                onChange={e => handleChange('accessKeyId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/60 mb-1">R2 Secret Access Key * (encrypted store hoga)</label>
              <input
                type="password"
                value={form.secretAccessKey}
                onChange={e => handleChange('secretAccessKey', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Owner Username (optional)</label>
              <input
                type="text"
                placeholder="subadmin1"
                value={form.ownerUsername}
                onChange={e => handleChange('ownerUsername', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Label (optional, dashboard ke liye)</label>
              <input
                type="text"
                placeholder="Sub-admin 1 ka bucket"
                value={form.label}
                onChange={e => handleChange('label', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Provider'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {providers.length === 0 ? (
          <div className="text-center py-10 text-white/40">Koi R2 provider add nahi kiya abhi tak.</div>
        ) : (
          providers.map(p => (
            <div key={p._id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold">{p.label || p.hostname}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.isActive !== false
                      ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                      : 'bg-red-600/30 text-red-300 border border-red-500/50'
                  }`}>
                    {p.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-white/60 mt-1">
                  Hostname: <span className="text-purple-300">{p.hostname}</span>
                </p>
                <p className="text-xs text-white/40">
                  Bucket: {p.bucketName} · Owner: {p.ownerUsername || '—'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => copyUrlPrefix(p.hostname)}
                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 text-blue-200 rounded-lg text-xs font-medium transition-all"
                >
                  Copy URL Prefix
                </button>
                <button
                  onClick={() => handleToggle(p._id)}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 text-amber-200 rounded-lg text-xs font-medium transition-all"
                >
                  {p.isActive !== false ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(p._id)}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 text-rose-200 rounded-lg text-xs font-medium transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 🆕 Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default R2ProviderManager;