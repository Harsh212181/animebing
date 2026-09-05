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

  // ✅ NEW: fetched bucket list state
  const [bucketOptions, setBucketOptions] = useState<string[]>([]);
  const [fetchingBuckets, setFetchingBuckets] = useState(false);

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

  // ✅ NEW: credentials se account ke buckets fetch karo
  const fetchBuckets = async () => {
    if (!form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Pehle Account ID, Access Key aur Secret Key bharo');
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
          setError('Is account mein koi bucket nahi mila');
        }
      } else {
        setError(data.error || 'Buckets fetch nahi ho sake — credentials check karo');
      }
    } catch {
      setError('Network error');
    } finally {
      setFetchingBuckets(false);
    }
  };

  // credentials change hone pe purani fetched list clear kar do
  const updateCred = (field: 'accountId' | 'accessKeyId' | 'secretAccessKey', value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setBucketOptions([]);
  };

  const handleConnect = async () => {
    setError(''); setSuccess('');
    if (!form.bucketName || !form.accountId || !form.accessKeyId || !form.secretAccessKey) {
      setError('Saare fields bharo aur bucket select karo');
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
        setBucketOptions([]);
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
          Apna Cloudflare R2 account connect karo — bucket khud detect ho jayega.
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
            <label className="block text-xs text-white/60 mb-1">Cloudflare Account ID *</label>
            <input
              type="text"
              value={form.accountId}
              onChange={e => updateCred('accountId', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="32-character hex ID"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">R2 Access Key ID *</label>
            <input
              type="text"
              value={form.accessKeyId}
              onChange={e => updateCred('accessKeyId', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">R2 Secret Access Key *</label>
            <input
              type="password"
              value={form.secretAccessKey}
              onChange={e => updateCred('secretAccessKey', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            onClick={fetchBuckets}
            disabled={fetchingBuckets}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 text-blue-200 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          >
            {fetchingBuckets ? 'Buckets dhoond rahe hain...' : '🔍 Fetch My Buckets'}
          </button>

          {bucketOptions.length > 0 && (
            <div>
              <label className="block text-xs text-white/60 mb-1">Bucket Select Karo *</label>
              <select
                value={form.bucketName}
                onChange={e => setForm(prev => ({ ...prev, bucketName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {bucketOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          <p className="text-[11px] text-white/40">
            Tip: Cloudflare dashboard mein sirf apne bucket(s) ke liye scoped API token banao — poore account ki access wali key mat do.
          </p>

          <button
            onClick={handleConnect}
            disabled={saving || !form.bucketName}
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