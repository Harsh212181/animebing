// src/components/admin/MyStorageManager.tsx — Sub-admin self-service R2 connect
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
}

const MyStorageManager: React.FC<Props> = ({ token: tokenProp }) => {
  const resolveToken = () =>
    tokenProp || sessionStorage.getItem('subAdminToken') || localStorage.getItem('adminToken') || '';

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    bucketName: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
  });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/my-provider`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setError('Status load nahi ho saka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleConnect = async () => {
    setError(''); setSuccess('');
    if (!form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Saare fields bharo — Bucket Name, Account ID, Access Key, Secret Key');
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
        setSuccess('Bucket connect ho gaya! Ab Video Upload page pe yeh dikhega.');
        setForm({ bucketName: '', accountId: '', accessKeyId: '', secretAccessKey: '' });
        fetchStatus();
      } else {
        setError(data.error || 'Connect nahi ho saka');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Apna storage disconnect karna hai? Purani uploaded videos R2 mein rahengi, bas dropdown se hat jayega.')) return;
    try {
      const token = resolveToken();
      await fetch(`${API_BASE}/uploads/my-provider`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchStatus();
    } catch {
      setError('Disconnect fail ho gaya');
    }
  };

  if (loading) return <div className="p-6 text-center text-white/60">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-6 bg-purple-400 rounded-full" />
          My Storage (R2 Bucket)
        </h2>
        <p className="text-xs text-white/40 mt-1">
          Apna Cloudflare R2 bucket connect karo — sirf tumhe hi dikhega upload karte waqt.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm">{success}</div>
      )}

      {status?.connected ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-600/30 text-green-300 border border-green-500/50">
              Connected
            </span>
          </div>
          <p className="text-sm text-white/70">Bucket: <span className="text-purple-300">{status.bucketName}</span></p>
          <p className="text-sm text-white/70">Account ID: <span className="text-purple-300">{status.accountId}</span></p>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 text-rose-200 rounded-lg text-sm font-medium transition-all"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Bucket Name *</label>
            <input
              type="text"
              value={form.bucketName}
              onChange={e => setForm({ ...form, bucketName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="mera-bucket-naam"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Cloudflare Account ID *</label>
            <input
              type="text"
              value={form.accountId}
              onChange={e => setForm({ ...form, accountId: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="32-character hex ID"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">R2 Access Key ID *</label>
            <input
              type="text"
              value={form.accessKeyId}
              onChange={e => setForm({ ...form, accessKeyId: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">R2 Secret Access Key *</label>
            <input
              type="password"
              value={form.secretAccessKey}
              onChange={e => setForm({ ...form, secretAccessKey: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <p className="text-[11px] text-white/40">
            Tip: Cloudflare dashboard mein sirf isi bucket ke liye scoped API token banao — poore account ki access wali key mat do.
          </p>
          <button
            onClick={handleConnect}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Connecting...' : 'Connect My Storage'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MyStorageManager;