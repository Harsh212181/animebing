 import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

// ============ TYPES ============
interface InstagramAccount {
  _id: string;
  igUsername: string;
  igUserId: string;
  isActive: boolean;
  connectedAt?: string;
  profilePictureUrl?: string | null;
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

interface AutomationLog {
  _id: string;
  accountId: string;
  keyword: string;
  matchedText: string;
  status: 'sent' | 'failed';
  createdAt: string;
}

// ============ ICONS ============
const Icons = {
  plus: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  trash: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  check: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  block: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  instagram: (c = 'w-4 h-4') => <svg className={c} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 7.38a4.62 4.62 0 100 9.24 4.62 4.62 0 000-9.24zm6.635-3.539a1.08 1.08 0 100-2.16 1.08 1.08 0 000 2.16z"/></svg>,
  chevronDown: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  refresh: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 11a8 8 0 0116 0" strokeLinecap="round" /></svg>,
  search: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  filter: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-5.586L3.293 6.707A1 1 0 013 6V4z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  close: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  clock: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  inbox: (c = 'w-4 h-4') => <svg className={c} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 8l1.5-4.5A1 1 0 015.45 3h13.1a1 1 0 01.95.68L21 8m-18 0v10a2 2 0 002 2h14a2 2 0 002-2V8m-18 0h18m-13 4h8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

// ============ HELPERS ============
const formatRelativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ============ UI COMPONENTS ============
const GradientButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ children, onClick, type = 'button', disabled, size = 'md' }) => {
  const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${sizeClasses[size]}`}
    >
      {children}
    </button>
  );
};

const OutlineButton: React.FC<{
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'gray';
  size?: 'sm' | 'md';
}> = ({ children, onClick, color = 'gray', size = 'md' }) => {
  const colorMap: Record<string, string> = {
    indigo: 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/50',
    green: 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50',
    yellow: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50',
    red: 'border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/50',
    gray: 'border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
  };
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-xs';
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl border backdrop-blur-sm transition-all ${colorMap[color]} ${sizeClasses}`}>
      {children}
    </button>
  );
};

const StyledSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">{opt.label}</option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/50">
      {Icons.chevronDown()}
    </div>
  </div>
);

// ============ POST PICKER ============
const PostPickerGrid: React.FC<{
  posts: InstagramPost[];
  loading: boolean;
  selectedPostId: string;
  onSelect: (id: string) => void;
  excludePostIds?: string[];
}> = ({ posts, loading, selectedPostId, onSelect, excludePostIds = [] }) => {
  if (loading) {
    return <p className="py-4 text-center text-xs text-white/30">Loading posts...</p>;
  }

  const availablePosts = posts.filter(p => !excludePostIds.includes(p.id));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-white/60">Apply to:</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all ${
            selectedPostId === ''
              ? 'border-purple-500/60 bg-purple-500/20 ring-2 ring-purple-500/40'
              : 'border-white/10 bg-white/[0.03] hover:border-white/20'
          }`}
        >
          <span className="text-lg">🌐</span>
          <span className="text-[9px] font-medium leading-tight text-white/70">Whole Account</span>
        </button>

        {availablePosts.map((post) => {
          const thumb = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
          const isSelected = selectedPostId === post.id;
          return (
            <button
              type="button"
              key={post.id}
              onClick={() => onSelect(post.id)}
              className={`group relative aspect-square overflow-hidden rounded-xl border transition-all ${
                isSelected
                  ? 'border-purple-500/60 ring-2 ring-purple-500/40'
                  : 'border-white/10 hover:border-white/30'
              }`}
              title={post.caption || 'No caption'}
            >
              {thumb ? (
                <img src={thumb} alt={post.caption || 'post'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20 text-xs">No preview</div>
              )}
              <div className={`absolute inset-0 transition-opacity ${isSelected ? 'bg-purple-600/30' : 'bg-black/0 group-hover:bg-black/20'}`} />
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white">
                  {Icons.check('h-2.5 w-2.5')}
                </span>
              )}
              {post.media_type === 'VIDEO' && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white">▶ Reel</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============ RULE CARD ============
const RuleCard: React.FC<{
  rule: AutomationRule;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, updates: { keyword: string; matchType: 'exact' | 'contains'; dmMessage: string }) => void;
}> = ({ rule, onToggle, onDelete, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    keyword: rule.keyword,
    matchType: rule.matchType,
    dmMessage: rule.dmMessage,
  });

  const handleSave = () => {
    if (!form.keyword.trim() || !form.dmMessage.trim()) return;
    onSave(rule._id, form);
    setEditing(false);
  };

  return (
    <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex flex-wrap items-start gap-3">
        {/* Post thumbnail */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {rule.postThumbnail ? (
            <img src={rule.postThumbnail} alt="post" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🌐</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-purple-300/70">
            {rule.postId ? (rule.postCaption ? rule.postCaption.slice(0, 60) : `Post ID: ${rule.postId.slice(0, 12)}...`) : '🌐 Whole Account'}
          </p>

          {!editing ? (
            <>
              <p className="mt-1 text-sm font-medium text-white">
                Keyword: <span className="text-purple-300">{rule.keyword}</span>{' '}
                <span className="text-[10px] text-white/30">({rule.matchType === 'exact' ? 'exact' : 'contains'})</span>
              </p>
              <p className="mt-0.5 text-xs text-white/40 break-words">DM: {rule.dmMessage}</p>
            </>
          ) : (
            <div className="mt-1.5 space-y-2">
              <input
                type="text"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="Keyword"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/50"
              />
              <StyledSelect
                value={form.matchType}
                onChange={(v) => setForm({ ...form, matchType: v as 'exact' | 'contains' })}
                options={[
                  { value: 'contains', label: 'Contains (anywhere)' },
                  { value: 'exact', label: 'Exact match' },
                ]}
              />
              <textarea
                value={form.dmMessage}
                onChange={(e) => setForm({ ...form, dmMessage: e.target.value })}
                rows={2}
                placeholder="DM message"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/50"
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
            rule.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/40'
          }`}>
            {rule.isActive ? 'Active' : 'Paused'}
          </span>

          {!editing ? (
            <>
              <OutlineButton onClick={() => setEditing(true)} color="indigo" size="sm">Edit</OutlineButton>
              <OutlineButton onClick={() => onToggle(rule._id, rule.isActive)} color={rule.isActive ? 'yellow' : 'green'} size="sm">
                {rule.isActive ? 'Pause' : 'Resume'}
              </OutlineButton>
              <OutlineButton onClick={() => onDelete(rule._id)} color="red" size="sm">
                {Icons.trash('h-3.5 w-3.5')}
              </OutlineButton>
            </>
          ) : (
            <>
              <OutlineButton onClick={handleSave} color="green" size="sm">Save</OutlineButton>
              <OutlineButton onClick={() => { setForm({ keyword: rule.keyword, matchType: rule.matchType, dmMessage: rule.dmMessage }); setEditing(false); }} size="sm">Cancel</OutlineButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ LOG ROW ============
const LogRow: React.FC<{ log: AutomationLog }> = ({ log }) => {
  const isSent = log.status === 'sent';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isSent ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}
      >
        {isSent ? Icons.check('h-3.5 w-3.5') : Icons.close('h-3.5 w-3.5')}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white/80">
          <span className="font-semibold text-purple-300">{log.keyword}</span>
          <span className="text-white/30"> matched </span>
          <span className="text-white/50">&ldquo;{log.matchedText}&rdquo;</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isSent ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
          }`}
        >
          {isSent ? 'Sent' : 'Failed'}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-white/30" title={new Date(log.createdAt).toLocaleString()}>
          {Icons.clock('h-3 w-3')}
          {formatRelativeTime(log.createdAt)}
        </span>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============
interface InstagramAutomationManagerProps {
  token?: string;
  apiBase?: string;
}

const InstagramAutomationManager: React.FC<InstagramAutomationManagerProps> = ({ token: tokenProp, apiBase }) => {
  const token = tokenProp || localStorage.getItem('adminToken') || '';
  const API = apiBase || API_BASE;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // State
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ igUsername: '', igUserId: '', accessToken: '' });

  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ keyword: '', matchType: 'contains' as 'exact' | 'contains', dmMessage: '' });

  // Logs filtering
  const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [, forceTick] = useState(0); // re-render periodically so relative timestamps stay fresh
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const tickInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch all data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [accRes, ruleRes, logRes] = await Promise.all([
        axios.get(`${API}/instagram-automation/accounts`, authHeaders),
        axios.get(`${API}/instagram-automation/rules`, authHeaders),
        axios.get(`${API}/instagram-automation/logs`, authHeaders),
      ]);
      const accData = accRes.data.accounts || [];
      setAccounts(accData);
      setRules(ruleRes.data.rules || []);
      setLogs(logRes.data.logs || []);
      if (accData.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accData[0].igUserId);
        fetchPosts(accData[0]._id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load Instagram data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (accountMongoId: string) => {
    setPostsLoading(true);
    try {
      const res = await axios.get(`${API}/instagram-automation/accounts/${accountMongoId}/posts`, authHeaders);
      setPosts(res.data.posts || []);
    } catch (err: any) {
      console.error('Posts fetch error:', err.response?.data || err.message);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // Keep relative timestamps ("2m ago") fresh without refetching data
    tickInterval.current = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
  }, []);

  // Auto-refresh logs
  useEffect(() => {
    if (autoRefresh && selectedAccountId) {
      refreshInterval.current = setInterval(() => {
        axios.get(`${API}/instagram-automation/logs`, authHeaders)
          .then(res => {
            if (res.data.logs) setLogs(res.data.logs);
          })
          .catch(() => {});
      }, 15000);
    } else if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [autoRefresh, selectedAccountId]);

  // Handlers
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.igUsername || !newAccount.igUserId || !newAccount.accessToken) return;
    const toastId = toast.loading('Adding account...');
    try {
      await axios.post(`${API}/instagram-automation/accounts`, newAccount, authHeaders);
      toast.success('Account connected!', { id: toastId });
      setNewAccount({ igUsername: '', igUserId: '', accessToken: '' });
      setShowAddAccount(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add account', { id: toastId });
    }
  };

  const handleToggleAccount = async (id: string, isActive: boolean) => {
    try {
      await axios.put(`${API}/instagram-automation/accounts/${id}`, { isActive: !isActive }, authHeaders);
      toast.success(!isActive ? 'Account resumed' : 'Account paused');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Remove this Instagram account? All its rules will be deleted.')) return;
    const toastId = toast.loading('Removing...');
    try {
      await axios.delete(`${API}/instagram-automation/accounts/${id}`, authHeaders);
      toast.success('Account removed', { id: toastId });
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Remove failed', { id: toastId });
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !newRule.keyword || !newRule.dmMessage) return;
    const toastId = toast.loading('Adding rule...');
    const selectedPostObj = posts.find(p => p.id === selectedPostId);
    try {
      await axios.post(`${API}/instagram-automation/rules`, {
        accountId: selectedAccountId,
        postId: selectedPostId || null,
        postThumbnail: selectedPostObj
          ? (selectedPostObj.media_type === 'VIDEO' ? selectedPostObj.thumbnail_url : selectedPostObj.media_url)
          : null,
        postCaption: selectedPostObj?.caption || null,
        ...newRule,
      }, authHeaders);
      toast.success('Rule created', { id: toastId });
      setNewRule({ keyword: '', matchType: 'contains', dmMessage: '' });
      setSelectedPostId('');
      setShowAddRule(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add rule', { id: toastId });
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      await axios.put(`${API}/instagram-automation/rules/${id}`, { isActive: !isActive }, authHeaders);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleUpdateRule = async (id: string, updates: { keyword: string; matchType: 'exact' | 'contains'; dmMessage: string }) => {
    const toastId = toast.loading('Updating rule...');
    try {
      await axios.put(`${API}/instagram-automation/rules/${id}`, updates, authHeaders);
      toast.success('Rule updated', { id: toastId });
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed', { id: toastId });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await axios.delete(`${API}/instagram-automation/rules/${id}`, authHeaders);
      toast.success('Rule deleted');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // Computed
  const selectedAccount = accounts.find(a => a.igUserId === selectedAccountId);
  const rulesForSelected = rules.filter(r => r.accountId === selectedAccountId);
  const logsForSelected = useMemo(() => {
    let filtered = logs.filter(l => l.accountId === selectedAccountId);
    if (logFilter !== 'all') filtered = filtered.filter(l => l.status === logFilter);
    if (logSearch.trim()) {
      const s = logSearch.toLowerCase();
      filtered = filtered.filter(l => l.matchedText.toLowerCase().includes(s) || l.keyword.toLowerCase().includes(s));
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs, selectedAccountId, logFilter, logSearch]);

  const allLogsForAccount = useMemo(
    () => logs.filter(l => l.accountId === selectedAccountId),
    [logs, selectedAccountId]
  );
  const totalLogs = allLogsForAccount.length;
  const sentCount = allLogsForAccount.filter(l => l.status === 'sent').length;
  const failedCount = totalLogs - sentCount;
  const shownCount = logsForSelected.length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 animate-spin shadow-xl shadow-purple-500/30">
          <div className="h-full w-full rounded-2xl bg-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-1 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Instagram Automation
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} · {rules.length} rule{rules.length !== 1 ? 's' : ''} · {logs.length} total logs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GradientButton
            onClick={() => {
              window.open(
                `${API.replace('/api', '')}/api/auth/instagram/connect`,
                '_blank'
              );
            }}
          >
            {Icons.instagram('h-4 w-4')}
            Connect Instagram
          </GradientButton>
          <OutlineButton onClick={() => setShowAddAccount(!showAddAccount)}>
            {showAddAccount ? 'Cancel' : 'Add Manually'}
          </OutlineButton>
        </div>
      </div>

      {/* Add account form */}
      {showAddAccount && (
        <form onSubmit={handleAddAccount} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md space-y-4">
          <p className="text-xs text-white/40">Get User ID & Access Token from Meta Developer Dashboard.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Username</label>
              <input
                type="text"
                value={newAccount.igUsername}
                onChange={(e) => setNewAccount({ ...newAccount, igUsername: e.target.value })}
                placeholder="animebingofficial"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">User ID</label>
              <input
                type="text"
                value={newAccount.igUserId}
                onChange={(e) => setNewAccount({ ...newAccount, igUserId: e.target.value })}
                placeholder="17841479995368916"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Access Token</label>
              <input
                type="text"
                value={newAccount.accessToken}
                onChange={(e) => setNewAccount({ ...newAccount, accessToken: e.target.value })}
                placeholder="IGQVJ..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <GradientButton type="submit">Save Account</GradientButton>
            <OutlineButton onClick={() => setShowAddAccount(false)}>Cancel</OutlineButton>
          </div>
        </form>
      )}

      {/* Accounts list */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-white/30">
            No Instagram accounts connected yet.
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc._id}
              onClick={() => {
                setSelectedAccountId(acc.igUserId);
                fetchPosts(acc._id);
                setSelectedPostId('');
              }}
              className={`group flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-3xl border p-4 backdrop-blur-sm transition-all ${
                selectedAccountId === acc.igUserId
                  ? 'border-purple-500/40 bg-purple-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20">
                  {acc.profilePictureUrl ? (
                    <img src={acc.profilePictureUrl} alt={acc.igUsername} className="h-full w-full object-cover" />
                  ) : (
                    Icons.instagram('h-5 w-5')
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">@{acc.igUsername}</p>
                  <p className="text-xs text-white/40">ID: {acc.igUserId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
                  acc.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/40'
                }`}>
                  {acc.isActive ? Icons.check('h-3 w-3') : Icons.block('h-3 w-3')}
                  {acc.isActive ? 'Active' : 'Paused'}
                </span>
                <OutlineButton onClick={(e) => { e?.stopPropagation(); handleToggleAccount(acc._id, acc.isActive); }} color={acc.isActive ? 'yellow' : 'green'} size="sm">
                  {acc.isActive ? 'Pause' : 'Resume'}
                </OutlineButton>
                <OutlineButton onClick={(e) => { e?.stopPropagation(); handleDeleteAccount(acc._id); }} color="red" size="sm">
                  {Icons.trash('h-3.5 w-3.5')}
                </OutlineButton>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected account details */}
      {selectedAccountId && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-6">
          {/* Rules section */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-white">
                Rules — <span className="text-purple-300">@{selectedAccount?.igUsername}</span>
                <span className="ml-2 text-xs font-normal text-white/40">({rulesForSelected.length})</span>
              </h3>
              <OutlineButton onClick={() => setShowAddRule(!showAddRule)} color="indigo">
                {Icons.plus('h-3.5 w-3.5')} Add Rule
              </OutlineButton>
            </div>

            {showAddRule && (
              <form onSubmit={handleAddRule} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4 mb-4">
                <PostPickerGrid
                  posts={posts}
                  loading={postsLoading}
                  selectedPostId={selectedPostId}
                  onSelect={setSelectedPostId}
                  excludePostIds={rulesForSelected.filter(r => r.postId).map(r => r.postId as string)}
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Keyword (e.g., ANIME)"
                    value={newRule.keyword}
                    onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/50"
                  />
                  <StyledSelect
                    value={newRule.matchType}
                    onChange={(v) => setNewRule({ ...newRule, matchType: v as 'exact' | 'contains' })}
                    options={[
                      { value: 'contains', label: 'Contains (anywhere)' },
                      { value: 'exact', label: 'Exact match' },
                    ]}
                  />
                </div>
                <textarea
                  placeholder="DM message to send (include link)"
                  value={newRule.dmMessage}
                  onChange={(e) => setNewRule({ ...newRule, dmMessage: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/50"
                />
                <div className="flex gap-3">
                  <GradientButton type="submit">Save Rule</GradientButton>
                  <OutlineButton onClick={() => setShowAddRule(false)}>Cancel</OutlineButton>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {rulesForSelected.length === 0 ? (
                <p className="py-6 text-center text-xs text-white/30">No rules for this account yet.</p>
              ) : (
                rulesForSelected.map((rule) => (
                  <RuleCard
                    key={rule._id}
                    rule={rule}
                    onToggle={handleToggleRule}
                    onDelete={handleDeleteRule}
                    onSave={handleUpdateRule}
                  />
                ))
              )}
            </div>
          </div>

          {/* Logs section — redesigned */}
          <div className="border-t border-white/5 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50">
                  {Icons.clock('h-4 w-4')}
                </span>
                <div>
                  <h3 className="font-semibold text-white leading-tight">Activity Logs</h3>
                  <p className="text-[11px] text-white/40 leading-tight">
                    {shownCount === totalLogs ? `${totalLogs} entries` : `${shownCount} of ${totalLogs} entries`}
                  </p>
                </div>
              </div>
              <OutlineButton
                onClick={() => setAutoRefresh(!autoRefresh)}
                color={autoRefresh ? 'green' : 'gray'}
                size="sm"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
                {Icons.refresh('h-3.5 w-3.5')}
                {autoRefresh ? 'Live' : 'Auto-refresh'}
              </OutlineButton>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-white">{totalLogs}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Total</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald-300">{sentCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-emerald-300/50">Sent</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-red-300">{failedCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-red-300/50">Failed</p>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
                {(['all', 'sent', 'failed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setLogFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      logFilter === status
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'sent' ? 'Sent' : 'Failed'}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                  {Icons.search('h-3.5 w-3.5')}
                </span>
                <input
                  type="text"
                  placeholder="Search keyword or message..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-1.5 pl-9 pr-8 text-xs text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
                />
                {logSearch && (
                  <button
                    onClick={() => setLogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                    aria-label="Clear search"
                  >
                    {Icons.close('h-3.5 w-3.5')}
                  </button>
                )}
              </div>
            </div>

            {/* Logs list */}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
              {logsForSelected.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/20">
                    {Icons.inbox('h-5 w-5')}
                  </span>
                  <p className="text-xs text-white/30">
                    {totalLogs === 0 ? 'No activity yet for this account.' : 'No logs match the current filter.'}
                  </p>
                  {(logFilter !== 'all' || logSearch) && totalLogs > 0 && (
                    <button
                      onClick={() => { setLogFilter('all'); setLogSearch(''); }}
                      className="text-[11px] font-medium text-purple-300 hover:text-purple-200"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                logsForSelected.map((log) => <LogRow key={log._id} log={log} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramAutomationManager;