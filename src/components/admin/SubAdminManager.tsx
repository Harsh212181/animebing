 import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

interface SubAdmin {
  _id: string;
  username: string;
  fullName?: string;
  permissions: string[];
  animeAccess: 'own' | 'all';
  isBlocked?: boolean;
  lastLogin?: string;
  createdAt?: string;
  phone?: string;
  upi?: string;
  gmail?: string;
  youtubeChannel?: string;
  ratePerThousandViews?: number | null; // 🆕 CUSTOM RATE
}

interface SubAdminStat {
  subAdminId: string;
  username: string;
  realName: string;
  animeCount: number;
  downloadPagesCount: number;
  totalViews: number;
  shortUsersCount: number;
  linksCount: number;
  totalClicks: number;
  instagramAccountsCount: number;   // 👈 add karo
}

interface SubAnime {
  _id: string;
  title: string;
  thumbnail?: string;
  contentType: string;
  subDubStatus: string;
  status: string;
  releaseYear?: number;
  views?: number;
  likes?: number;
  slug?: string;
  isHidden?: boolean;
  isBlocked?: boolean;
  createdAt?: string;
  createdBy?: string;
  createdByUsername?: string;
}

interface SubShortUser {
  _id: string;
  username: string;
  realName: string;
  totalClicks: number;
  totalEarnings: number;
  unpaidEarnings: number;
  isActive: boolean;
  createdAt?: string;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'add-anime', label: 'Add Content', icon: 'M12 4v16m8-8H4' },
  { key: 'edit-anime', label: 'Edit Anime', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { key: 'delete-anime', label: 'Delete Anime', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  { key: 'block-anime', label: 'Block/Unblock Anime', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  { key: 'episodes', label: 'Episodes', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { key: 'chapters', label: 'Manage Chapters', icon: 'M4 6h16M4 10h16M4 14h16M9 6v12M15 6v12' },
  { key: 'reports', label: 'User Reports', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9' },
  { key: 'useractivity', label: 'User Activity', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  { key: 'notes', label: 'Notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'polls', label: 'Poll Manager', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { key: 'social', label: 'Social Media', icon: 'M4 12a8 8 0 018-8 8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8zm3.5 0a4.5 4.5 0 109 0 4.5 4.5 0 00-9 0zm8 4.5a8.03 8.03 0 01-6 2.5 8.03 8.03 0 01-6-2.5' },
  { key: 'downloadPages', label: 'Download Pages', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  { key: 'partners', label: 'Partner Manager', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3v-1a4 4 0 00-3-3.87m-4-8.13a4 4 0 011 7.87' },
  { key: 'shortener', label: 'Shortener & Short Users', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { key: 'pageviews', label: 'Analytics (Page Views)', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  { key: 'link-control', label: 'Link Control', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { key: 'tracklist', label: 'YouTube Track List', icon: 'M15 10l4.55-2.27a1 1 0 011.45.9v6.74a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'instagram', label: 'Instagram Automation', icon: 'M12 3l2.6 5.6 6.1.6-4.5 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.5-4.2 6.1-.6L12 3z' }, // 👈 add karo
  { key: 'videoUpload', label: 'Video Upload', icon: 'M15 10l4.55-2.27a1 1 0 011.45.9v6.74a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'r2storage', label: 'Connect Own Storage (R2)', icon: 'M20 7h-9m3-3v6M4 17h9m-3 3v-6M4 7h4M16 17h4' },
  { key: 'earnings', label: 'My Earnings', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' }, // 🆕 EARNINGS
];

const COPY_ICON = 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z';
const EYE_OFF_ICON = 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21';

// ── Reusable components ──────────────────────────────────────────────

const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="group relative flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm p-3 transition-all hover:border-white/10 hover:bg-white/[0.06]">
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${color}`}>{icon}</div>
    <div>
      <p className="text-sm font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</p>
    </div>
  </div>
);

const GradientButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}> = ({ children, onClick, className = '', type = 'button', disabled }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

const OutlineButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'gray';
}> = ({ children, onClick, className = '', color = 'gray' }) => {
  const colorMap: Record<string, string> = {
    indigo: 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/50',
    green: 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50',
    yellow: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50',
    red: 'border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/50',
    gray: 'border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all ${colorMap[color]} ${className}`}
    >
      {children}
    </button>
  );
};

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

const ICONS = {
  anime: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  views: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  users: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3v-1a4 4 0 00-3-3.87m-4-8.13a4 4 0 011 7.87',
  links: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  clicks: 'M13 10V3L4 14h7v7l9-11h-7z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  plus: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  block: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  chevronDown: 'M19 9l-7 7-7-7',
  check: 'M5 13l4 4L19 7',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  instagram: 'M12 3l2.6 5.6 6.1.6-4.5 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.5-4.2 6.1-.6L12 3z',
};

// ── Custom styled checkbox component ─────────────────────────────────
const StyledCheckbox: React.FC<{
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ checked, onChange, label, icon, className = '' }) => {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all select-none ${className} ${
      checked
        ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
        : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className={`flex h-4 w-4 items-center justify-center rounded-md border transition-all ${
        checked
          ? 'border-purple-500 bg-purple-500'
          : 'border-white/30 bg-white/5'
      }`}>
        <svg
          className={`h-3 w-3 text-white transition-all ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </label>
  );
};

// ── Custom styled select component ───────────────────────────────────
const StyledSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}> = ({ value, onChange, options, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/50">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────

const SubAdminManager: React.FC = () => {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [stats, setStats] = useState<Record<string, SubAdminStat>>({});
  const [trackStats, setTrackStats] = useState<Record<string, { channelsCount: number; titlesCount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [detailView, setDetailView] = useState<Record<string, 'anime' | 'users'>>({});
  const [animeData, setAnimeData] = useState<Record<string, SubAnime[]>>({});
  const [shortUsersData, setShortUsersData] = useState<Record<string, SubShortUser[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  const [assignModalFor, setAssignModalFor] = useState<SubAdmin | null>(null);
  const [allAnime, setAllAnime] = useState<SubAnime[]>([]);
  const [assignedAnimeIds, setAssignedAnimeIds] = useState<Set<string>>(new Set());
  const [animeSearch, setAnimeSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    permissions: [] as string[],
    animeAccess: 'own' as 'own' | 'all',
    phone: '',
    upi: '',
    gmail: '',
    youtubeChannel: '',
  });

  // 🆕 NEW: custom rate state
  const [ratePerThousandViews, setRatePerThousandViews] = useState<string>('');

  const [showPassCreate, setShowPassCreate] = useState(false);
  const [showPassEdit, setShowPassEdit] = useState(false);

  const token = localStorage.getItem('adminToken') || '';
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchSubAdmins = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin`, authHeaders);
      setSubAdmins(data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load sub-admins');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/analytics/sub-admin-stats`, authHeaders);
      const map: Record<string, SubAdminStat> = {};
      (data.stats || []).forEach((s: SubAdminStat) => {
        map[s.subAdminId] = s;
      });
      setStats(map);
    } catch {
      // non-fatal
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchTrackStats = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/track/sub-admin-stats`, authHeaders);
      setTrackStats(data || {});
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    fetchSubAdmins();
    fetchStats();
    fetchTrackStats();
  }, []);

  const resetForm = () => {
    setForm({
      username: '',
      password: '',
      fullName: '',
      permissions: [],
      animeAccess: 'own',
      phone: '',
      upi: '',
      gmail: '',
      youtubeChannel: '',
    });
    setRatePerThousandViews(''); // 🆕 reset custom rate
    setEditingId(null);
    setShowForm(false);
    setShowPassCreate(false);
    setShowPassEdit(false);
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleEdit = (sa: SubAdmin) => {
    setEditingId(sa._id);
    setShowForm(false);
    setForm({
      username: sa.username,
      password: '',
      fullName: sa.fullName || '',
      permissions: sa.permissions || [],
      animeAccess: sa.animeAccess || 'own',
      phone: sa.phone || '',
      upi: sa.upi || '',
      gmail: sa.gmail || '',
      youtubeChannel: sa.youtubeChannel || '',
    });
    // 🆕 set custom rate if exists
    setRatePerThousandViews(
      typeof sa.ratePerThousandViews === 'number'
        ? String(sa.ratePerThousandViews)
        : ''
    );
    setShowPassEdit(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating...' : 'Creating...');
    try {
      if (editingId) {
        const payload: any = {
          fullName: form.fullName,
          permissions: form.permissions,
          animeAccess: form.animeAccess,
          phone: form.phone,
          upi: form.upi,
          gmail: form.gmail,
          youtubeChannel: form.youtubeChannel,
          // 🆕 add custom rate
          ratePerThousandViews: ratePerThousandViews.trim() === '' ? null : parseFloat(ratePerThousandViews),
        };
        if (form.password.trim()) payload.password = form.password;
        await axios.put(`${API_BASE}/sub-admin/${editingId}`, payload, authHeaders);
        toast.success('Sub-admin updated', { id: toastId });
      } else {
        // 🆕 build payload for create (with custom rate)
        const payload = {
          ...form,
          ratePerThousandViews: ratePerThousandViews.trim() === '' ? null : parseFloat(ratePerThousandViews),
        };
        await axios.post(`${API_BASE}/sub-admin`, payload, authHeaders);
        toast.success('Sub-admin created', { id: toastId });
      }
      resetForm();
      fetchSubAdmins();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed', { id: toastId });
    }
  };

  const handleBlock = async (sa: SubAdmin) => {
    const toastId = toast.loading(sa.isBlocked ? 'Unblocking...' : 'Blocking...');
    try {
      const { data } = await axios.patch(`${API_BASE}/sub-admin/${sa._id}/block`, {}, authHeaders);
      toast.success(data.message, { id: toastId });
      fetchSubAdmins();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed', { id: toastId });
    }
  };

  const handleDelete = async (sa: SubAdmin) => {
    if (!confirm(`Permanently delete "${sa.username}"?`)) return;
    const toastId = toast.loading('Deleting...');
    try {
      await axios.delete(`${API_BASE}/sub-admin/${sa._id}`, authHeaders);
      toast.success('Deleted', { id: toastId });
      fetchSubAdmins();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed', { id: toastId });
    }
  };

  const fetchAnimeForSubAdmin = async (id: string) => {
    setDetailLoading(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin/${id}/anime`, authHeaders);
      setAnimeData(prev => ({ ...prev, [id]: data.data || [] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load anime');
    } finally {
      setDetailLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const fetchShortUsersForSubAdmin = async (id: string) => {
    setDetailLoading(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin/${id}/shortusers`, authHeaders);
      setShortUsersData(prev => ({ ...prev, [id]: data.data || [] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load short users');
    } finally {
      setDetailLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const openDetailTab = (id: string, tab: 'anime' | 'users') => {
    setDetailView(prev => {
      if (prev[id] === tab) {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      }
      return { ...prev, [id]: tab };
    });
    if (tab === 'anime' && !animeData[id]) fetchAnimeForSubAdmin(id);
    if (tab === 'users' && !shortUsersData[id]) fetchShortUsersForSubAdmin(id);
  };

  const openAssignModal = async (sa: SubAdmin) => {
    setAssignModalFor(sa);
    setAssignLoading(true);
    setAnimeSearch('');
    try {
      const [{ data: animeListRes }, { data: assignedRes }] = await Promise.all([
        axios.get<any>(`${API_BASE}/admin/anime-list`, authHeaders),
        axios.get<{ success: boolean; data: SubAnime[] }>(`${API_BASE}/sub-admin/${sa._id}/assigned-anime`, authHeaders),
      ]);
      const list: SubAnime[] = Array.isArray(animeListRes) ? animeListRes : (animeListRes?.data || []);
      setAllAnime(list);
      setAssignedAnimeIds(new Set((assignedRes.data || []).map((a: SubAnime) => a._id)));
    } catch (err: any) {
      toast.error('Anime list load nahi ho saka');
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleAssignAnime = (id: string) => {
    setAssignedAnimeIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!assignModalFor) return;
    setAssignSaving(true);
    const toastId = toast.loading('Saving...');
    try {
      const { data: currentRes } = await axios.get<{ success: boolean; data: SubAnime[] }>(
        `${API_BASE}/sub-admin/${assignModalFor._id}/assigned-anime`,
        authHeaders
      );

      const currentIds: Set<string> = new Set(
        (currentRes.data || []).map((a: SubAnime) => a._id)
      );
      const selectedIds: string[] = Array.from(assignedAnimeIds);

      const toAdd: string[] = selectedIds.filter((id: string) => !currentIds.has(id));
      const toRemove: string[] = Array.from(currentIds).filter(
        (id: string) => !assignedAnimeIds.has(id)
      );

      if (toAdd.length) {
        await axios.post(`${API_BASE}/sub-admin/${assignModalFor._id}/assign-anime`, { animeIds: toAdd }, authHeaders);
      }
      if (toRemove.length) {
        await axios.post(`${API_BASE}/sub-admin/${assignModalFor._id}/unassign-anime`, { animeIds: toRemove }, authHeaders);
      }

      toast.success('Anime assignments update ho gaye', { id: toastId });
      setAssignModalFor(null);
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save fail ho gaya', { id: toastId });
    } finally {
      setAssignSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied!`),
      () => toast.error('Copy failed')
    );
  };

  const totals = Object.values(stats).reduce(
    (acc, s) => ({
      animeCount: acc.animeCount + s.animeCount,
      totalViews: acc.totalViews + s.totalViews,
      shortUsersCount: acc.shortUsersCount + s.shortUsersCount,
      linksCount: acc.linksCount + s.linksCount,
      totalClicks: acc.totalClicks + s.totalClicks,
    }),
    { animeCount: 0, totalViews: 0, shortUsersCount: 0, linksCount: 0, totalClicks: 0 }
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 animate-spin shadow-xl shadow-purple-500/30">
          <div className="h-full w-full rounded-2xl bg-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-1">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Sub‑Admin Management
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {subAdmins.length} sub‑admin{subAdmins.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <GradientButton
          onClick={() => {
            if (showForm && !editingId) resetForm();
            else {
              setEditingId(null);
              setShowForm(true);
            }
          }}
        >
          <SvgIcon d={ICONS.plus} className="h-4 w-4" />
          {showForm && !editingId ? 'Cancel' : 'New Sub‑Admin'}
        </GradientButton>
      </div>

      {/* ── Org‑wide stats bar ────────────────────────── */}
      {!statsLoading && subAdmins.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatPill icon={<SvgIcon d={ICONS.anime} />} label="Total Anime" value={totals.animeCount} color="text-purple-300" />
          <StatPill icon={<SvgIcon d={ICONS.eye} />} label="Total Views" value={totals.totalViews} color="text-cyan-300" />
          <StatPill icon={<SvgIcon d={ICONS.users} />} label="Shortener Users" value={totals.shortUsersCount} color="text-emerald-300" />
          <StatPill icon={<SvgIcon d={ICONS.links} />} label="Links" value={totals.linksCount} color="text-blue-300" />
          <StatPill icon={<SvgIcon d={ICONS.clicks} />} label="Clicks" value={totals.totalClicks} color="text-amber-300" />
        </div>
      )}

      {/* ── Create form ───────────────────────────────── */}
      {showForm && !editingId && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md space-y-5"
        >
          <h3 className="text-lg font-semibold text-white">Create Sub‑Admin</h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Password *</label>
              <div className="relative">
                <input
                  type={showPassCreate ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none pr-20 transition-all focus:border-purple-500/50 focus:bg-white/10"
                  required
                  minLength={6}
                />
                <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassCreate(!showPassCreate)}
                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    title={showPassCreate ? 'Hide password' : 'Show password'}
                  >
                    <SvgIcon d={showPassCreate ? EYE_OFF_ICON : ICONS.eye} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(form.password, 'Password')}
                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    title="Copy password"
                  >
                    <SvgIcon d={COPY_ICON} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Anime Access</label>
              <StyledSelect
                value={form.animeAccess}
                onChange={(value) => setForm({ ...form, animeAccess: value as 'own' | 'all' })}
                options={[
                  { value: 'own', label: 'Only own anime' },
                  { value: 'all', label: 'All anime' },
                ]}
              />
            </div>
            {/* NEW: Optional contact fields */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">UPI ID</label>
              <input
                type="text"
                value={form.upi}
                onChange={e => setForm({ ...form, upi: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Gmail</label>
              <input
                type="email"
                value={form.gmail}
                onChange={e => setForm({ ...form, gmail: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">YouTube Channel Name</label>
              <input
                type="text"
                value={form.youtubeChannel}
                onChange={e => setForm({ ...form, youtubeChannel: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                placeholder="Optional"
              />
            </div>
            {/* 🆕 CUSTOM RATE FIELD */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Custom rate ($/1000 download-page views)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Leave blank to use global rate"
                value={ratePerThousandViews}
                onChange={e => setRatePerThousandViews(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#1c1b29] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                Leave blank to use the main admin's global rate. This only affects
                download-page views where a short link (1-4) was used.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium text-white/60">Permissions</label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {AVAILABLE_PERMISSIONS.map(p => (
                <StyledCheckbox
                  key={p.key}
                  checked={form.permissions.includes(p.key)}
                  onChange={() => togglePermission(p.key)}
                  icon={<SvgIcon d={p.icon} className="h-3.5 w-3.5 shrink-0" />}
                  label={p.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <GradientButton type="submit">Create Now</GradientButton>
            <OutlineButton onClick={resetForm}>Cancel</OutlineButton>
          </div>
        </form>
      )}

      {/* ── Sub‑admin list (cards) ────────────────────── */}
      <div className="space-y-4">
        {subAdmins.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-white/30">
            No sub‑admins yet
          </div>
        ) : (
          subAdmins.map(sa => {
            const s = stats[sa._id];
            const isExpanded = expandedId === sa._id;

            return (
              <div
                key={sa._id}
                className="group rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm transition-all hover:border-white/20"
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-base font-bold text-white shadow-lg shadow-purple-500/20">
                    {(sa.fullName || sa.username).charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-white">{sa.username}</p>
                      <button
                        onClick={() => copyToClipboard(sa.username, 'Username')}
                        className="p-0.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        title="Copy username"
                      >
                        <SvgIcon d={COPY_ICON} className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-white/40">{sa.fullName || '—'}</p>
                    {/* YouTube channel display (if exists) */}
                    {sa.youtubeChannel && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-red-400">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        {sa.youtubeChannel}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/20">
                    {sa.animeAccess === 'all' ? 'All Anime' : 'Own Only'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
                      sa.isBlocked
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    <SvgIcon d={sa.isBlocked ? ICONS.block : ICONS.check} className="h-3 w-3" />
                    {sa.isBlocked ? 'Blocked' : 'Active'}
                  </span>

                  <div className="ml-auto flex items-center gap-3">
                    {statsLoading ? (
                      <span className="text-xs text-white/30">…</span>
                    ) : s ? (
                      <>
                        <span className="flex items-center gap-1 text-xs text-purple-300" title="Anime">
                          <SvgIcon d={ICONS.anime} className="h-3.5 w-3.5" /> {s.animeCount}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-cyan-300" title="Views">
                          <SvgIcon d={ICONS.eye} className="h-3.5 w-3.5" /> {s.totalViews.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-emerald-300" title="Users">
                          <SvgIcon d={ICONS.users} className="h-3.5 w-3.5" /> {s.shortUsersCount}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-pink-300" title="Instagram Accounts">
                          <SvgIcon d={ICONS.instagram} className="h-3.5 w-3.5" /> {s.instagramAccountsCount}
                        </span>
                      </>
                    ) : null}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : sa._id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <SvgIcon
                        d={ICONS.chevronDown}
                        className={`h-4 w-4 text-white/60 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === sa._id && (
                  <form
                    onSubmit={handleSubmit}
                    className="border-t border-white/10 bg-white/[0.03] p-5 space-y-5"
                  >
                    <h3 className="text-base font-semibold text-white">Edit {sa.username}</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">Username</label>
                        <input
                          type="text"
                          value={form.username}
                          disabled
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/60">
                          New Password (optional)
                          <span
                            className="group/tip relative inline-flex"
                            title="Passwords are one-way hashed and can never be retrieved or displayed — this field is intentionally blank. Type a new password only if you want to reset it; leave it empty to keep the current password unchanged."
                          >
                            <SvgIcon d={ICONS.info} className="h-3.5 w-3.5 text-white/30 hover:text-white/60 cursor-help" />
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassEdit ? 'text' : 'password'}
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            placeholder="•••••••• (leave blank to keep current)"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none pr-20 focus:border-purple-500/50 focus:bg-white/10"
                            minLength={6}
                          />
                          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setShowPassEdit(!showPassEdit)}
                              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                              title={showPassEdit ? 'Hide password' : 'Show password'}
                            >
                              <SvgIcon d={showPassEdit ? EYE_OFF_ICON : ICONS.eye} className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(form.password, 'Password')}
                              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                              title="Copy password"
                            >
                              <SvgIcon d={COPY_ICON} className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-white/35">
                          For security, existing passwords are stored as a one-way hash and can't be shown here. Leave blank to keep it unchanged, or type a new one to reset it.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">Full Name</label>
                        <input
                          type="text"
                          value={form.fullName}
                          onChange={e => setForm({ ...form, fullName: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">Anime Access</label>
                        <StyledSelect
                          value={form.animeAccess}
                          onChange={(value) => setForm({ ...form, animeAccess: value as 'own' | 'all' })}
                          options={[
                            { value: 'own', label: 'Only own anime' },
                            { value: 'all', label: 'All anime' },
                          ]}
                        />
                      </div>
                      {/* NEW: Optional contact fields for edit */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">Phone Number</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">UPI ID</label>
                        <input
                          type="text"
                          value={form.upi}
                          onChange={e => setForm({ ...form, upi: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">Gmail</label>
                        <input
                          type="email"
                          value={form.gmail}
                          onChange={e => setForm({ ...form, gmail: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">YouTube Channel Name</label>
                        <input
                          type="text"
                          value={form.youtubeChannel}
                          onChange={e => setForm({ ...form, youtubeChannel: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                          placeholder="Optional"
                        />
                      </div>
                      {/* 🆕 CUSTOM RATE FIELD */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          Custom rate ($/1000 download-page views)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Leave blank to use global rate"
                          value={ratePerThousandViews}
                          onChange={e => setRatePerThousandViews(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[#1c1b29] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                        />
                        <p className="text-[10px] text-gray-600 mt-1">
                          Leave blank to use the main admin's global rate. This only affects
                          download-page views where a short link (1-4) was used.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium text-white/60">Permissions</label>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {AVAILABLE_PERMISSIONS.map(p => (
                          <StyledCheckbox
                            key={p.key}
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                            icon={<SvgIcon d={p.icon} className="h-3.5 w-3.5 shrink-0" />}
                            label={p.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <GradientButton type="submit">Save Changes</GradientButton>
                      <OutlineButton onClick={resetForm}>Cancel</OutlineButton>
                    </div>
                  </form>
                )}

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-white/[0.01] p-5 space-y-6">
                    {s && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
                        <StatPill icon={<SvgIcon d={ICONS.anime} />} label="Anime" value={s.animeCount} color="text-purple-300" />
                        <StatPill icon={<SvgIcon d={ICONS.download} />} label="Download Pages" value={s.downloadPagesCount} color="text-fuchsia-300" />
                        <StatPill icon={<SvgIcon d={ICONS.eye} />} label="Views" value={s.totalViews} color="text-cyan-300" />
                        <StatPill icon={<SvgIcon d={ICONS.users} />} label="Short Users" value={s.shortUsersCount} color="text-emerald-300" />
                        <StatPill icon={<SvgIcon d={ICONS.links} />} label="Links" value={s.linksCount} color="text-blue-300" />
                        <StatPill icon={<SvgIcon d={ICONS.clicks} />} label="Clicks" value={s.totalClicks} color="text-amber-300" />
                        <StatPill
                          icon={<SvgIcon d={ICONS.instagram} />}
                          label="IG Accounts"
                          value={s.instagramAccountsCount}
                          color="text-pink-300"
                        />
                        <StatPill
                          icon={<SvgIcon d="M15 10l4.55-2.27a1 1 0 011.45.9v6.74a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />}
                          label="YT Channels"
                          value={trackStats[sa._id]?.channelsCount ?? 0}
                          color="text-red-300"
                        />
                        <StatPill
                          icon={<SvgIcon d={ICONS.anime} />}
                          label="Tracked Titles"
                          value={trackStats[sa._id]?.titlesCount ?? 0}
                          color="text-orange-300"
                        />
                      </div>
                    )}

                    {/* Detail tabs */}
                    <div className="pt-2">
                      <div className="mb-4 flex gap-2">
                        <button
                          onClick={() => openDetailTab(sa._id, 'anime')}
                          className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
                            detailView[sa._id] === 'anime'
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                              : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          <SvgIcon d={ICONS.anime} className="h-3.5 w-3.5" />
                          Anime ({s?.animeCount ?? 0})
                        </button>
                        <button
                          onClick={() => openDetailTab(sa._id, 'users')}
                          className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
                            detailView[sa._id] === 'users'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                              : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          <SvgIcon d={ICONS.links} className="h-3.5 w-3.5" />
                          Short Users ({s?.shortUsersCount ?? 0})
                        </button>
                      </div>

                      {detailLoading[sa._id] && (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-8 w-8 rounded-lg border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                        </div>
                      )}

                      {/* Anime grid */}
                      {!detailLoading[sa._id] && detailView[sa._id] === 'anime' &&
                        (animeData[sa._id]?.length ? (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {animeData[sa._id].map(a => (
                              <div
                                key={a._id}
                                className="group/card overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition-all hover:border-white/20 hover:shadow-xl"
                              >
                                <div className="aspect-[2/3] w-full bg-slate-800">
                                  <img
                                    src={a.thumbnail || 'https://via.placeholder.com/150x225/1e293b/64748b?text=NA'}
                                    alt={a.title}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                                    loading="lazy"
                                    onError={e => {
                                      (e.currentTarget as HTMLImageElement).src =
                                        'https://via.placeholder.com/150x225/1e293b/64748b?text=NA';
                                    }}
                                  />
                                </div>
                                <div className="p-2.5 space-y-1.5">
                                  <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">
                                    {a.title}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[9px] text-purple-300">
                                      {a.contentType}
                                    </span>
                                    <span
                                      className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                                        a.status === 'Complete'
                                          ? 'bg-green-500/15 text-green-300'
                                          : 'bg-yellow-500/15 text-yellow-300'
                                      }`}
                                    >
                                      {a.status}
                                    </span>
                                    {a.isHidden && (
                                      <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-300">
                                        Hidden
                                      </span>
                                    )}
                                  </div>
                                  <p className="flex items-center gap-2 text-[9px] text-white/40">
                                    <span className="inline-flex items-center gap-0.5">
                                      <SvgIcon d={ICONS.eye} className="h-3 w-3" /> {(a.views || 0).toLocaleString()}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <SvgIcon d={ICONS.heart} className="h-3 w-3" /> {(a.likes || 0).toLocaleString()}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-8 text-center text-xs text-white/30">No anime added yet.</p>
                        ))}

                      {/* Short users table */}
                      {!detailLoading[sa._id] && detailView[sa._id] === 'users' &&
                        (shortUsersData[sa._id]?.length ? (
                          <div className="overflow-x-auto rounded-2xl border border-white/5">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="bg-white/[0.02] text-left text-white/40">
                                  <th className="px-3 py-2.5 font-medium">Username</th>
                                  <th className="px-3 py-2.5 font-medium">Real Name</th>
                                  <th className="px-3 py-2.5 font-medium">Clicks</th>
                                  <th className="px-3 py-2.5 font-medium">Earnings</th>
                                  <th className="px-3 py-2.5 font-medium">Unpaid</th>
                                  <th className="px-3 py-2.5 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {shortUsersData[sa._id].map(u => (
                                  <tr key={u._id} className="text-white/80 transition-colors hover:bg-white/[0.02]">
                                    <td className="px-3 py-2.5">{u.username}</td>
                                    <td className="px-3 py-2.5">{u.realName}</td>
                                    <td className="px-3 py-2.5 font-medium text-amber-300">
                                      {(u.totalClicks || 0).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5">₹{(u.totalEarnings || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2.5">₹{(u.unpaidEarnings || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2.5">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                          u.isActive
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : 'bg-red-500/10 text-red-300'
                                        }`}
                                      >
                                        <SvgIcon d={u.isActive ? ICONS.check : ICONS.block} className="h-3 w-3" />
                                        {u.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="py-8 text-center text-xs text-white/30">No shortener users yet.</p>
                        ))}
                    </div>

                    {/* Permissions chips */}
                    {sa.permissions && sa.permissions.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          Permissions
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sa.permissions.map(p => {
                            const perm = AVAILABLE_PERMISSIONS.find(ap => ap.key === p);
                            const label = perm?.label || p;
                            const icon = perm?.icon || ICONS.check;
                            return (
                              <span
                                key={p}
                                className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] text-purple-200 flex items-center gap-1"
                              >
                                <SvgIcon d={icon} className="h-3 w-3" />
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <OutlineButton onClick={() => handleEdit(sa)} color="indigo">
                        <SvgIcon d={ICONS.edit} className="h-3.5 w-3.5" /> Edit
                      </OutlineButton>
                      <OutlineButton onClick={() => openAssignModal(sa)} color="indigo">
                        <SvgIcon d={ICONS.plus} className="h-3.5 w-3.5" /> Assign Anime
                      </OutlineButton>
                      <OutlineButton onClick={() => handleBlock(sa)} color={sa.isBlocked ? 'green' : 'yellow'}>
                        <SvgIcon d={ICONS.block} className="h-3.5 w-3.5" />
                        {sa.isBlocked ? 'Unblock' : 'Block'}
                      </OutlineButton>
                      <OutlineButton onClick={() => handleDelete(sa)} color="red">
                        <SvgIcon d={ICONS.trash} className="h-3.5 w-3.5" /> Delete
                      </OutlineButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Assign Anime Modal */}
      {assignModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                Assign Anime — {assignModalFor.fullName || assignModalFor.username}
              </h3>
              <button onClick={() => setAssignModalFor(null)} className="text-white/50 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="p-4 border-b border-white/10">
              <input
                value={animeSearch}
                onChange={e => setAnimeSearch(e.target.value)}
                placeholder="Anime search karo..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50"
              />
              <p className="mt-2 text-xs text-white/40">{assignedAnimeIds.size} anime selected</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {assignLoading ? (
                <p className="text-center text-white/40 py-8">Loading...</p>
              ) : (
                allAnime
                  .filter(a => a.title?.toLowerCase().includes(animeSearch.toLowerCase()))
                  .map(a => {
                    const isChecked = assignedAnimeIds.has(a._id);
                    return (
                      <StyledCheckbox
                        key={a._id}
                        checked={isChecked}
                        onChange={() => toggleAssignAnime(a._id)}
                        className="!justify-start !gap-3 !px-3 !py-2"
                        label={
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate">{a.title}</p>
                            <p className="text-[10px] text-white/40">{a.contentType} · {a.createdByUsername || 'admin'}</p>
                          </div>
                        }
                        icon={
                          <img
                            src={a.thumbnail || 'https://via.placeholder.com/40x56/1e293b/64748b?text=NA'}
                            className="w-8 h-11 object-cover rounded"
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/40x56/1e293b/64748b?text=NA';
                            }}
                          />
                        }
                      />
                    );
                  })
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-3">
              <GradientButton onClick={saveAssignments} disabled={assignSaving}>
                {assignSaving ? 'Saving...' : 'Save Assignments'}
              </GradientButton>
              <OutlineButton onClick={() => setAssignModalFor(null)}>Cancel</OutlineButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubAdminManager;