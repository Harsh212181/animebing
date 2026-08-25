 import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface InstagramAccount {
  _id: string;
  igUsername: string;
  igUserId: string;
  isActive: boolean;
  connectedAt?: string;
  profilePictureUrl?: string | null;   // 👈 naya
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

const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  plus: 'M12 4v16m8-8H4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check: 'M5 13l4 4L19 7',
  block: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  instagram: 'M12 3l2.6 5.6 6.1.6-4.5 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.5-4.2 6.1-.6L12 3z',
  chevronDown: 'M19 9l-7 7-7-7',
};

const GradientButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}> = ({ children, onClick, type = 'button', disabled }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
  >
    {children}
  </button>
);

const OutlineButton: React.FC<{
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'gray';
}> = ({ children, onClick, color = 'gray' }) => {
  const colorMap: Record<string, string> = {
    indigo: 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/50',
    green: 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50',
    yellow: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50',
    red: 'border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/50',
    gray: 'border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all ${colorMap[color]}`}>
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
      <SvgIcon d={ICONS.chevronDown} className="h-4 w-4" />
    </div>
  </div>
);

// PostPickerGrid component with excludePostIds
const PostPickerGrid: React.FC<{
  posts: InstagramPost[];
  loading: boolean;
  selectedPostId: string;
  onSelect: (id: string) => void;
  excludePostIds?: string[];
}> = ({ posts, loading, selectedPostId, onSelect, excludePostIds = [] }) => {
  if (loading) {
    return <p className="py-4 text-center text-xs text-white/30">Posts load ho rahe hain...</p>;
  }

  const availablePosts = posts.filter(p => !excludePostIds.includes(p.id));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-white/60">Ye rule kahan apply hoga?</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {/* Pura account option */}
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
          <span className="text-[9px] font-medium leading-tight text-white/70">Pura account</span>
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
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20 text-xs">
                  No preview
                </div>
              )}
              <div className={`absolute inset-0 transition-opacity ${isSelected ? 'bg-purple-600/30' : 'bg-black/0 group-hover:bg-black/20'}`} />
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white">
                  <SvgIcon d={ICONS.check} className="h-2.5 w-2.5" />
                </span>
              )}
              {post.media_type === 'VIDEO' && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white">▶ Reel</span>
              )}
            </button>
          );
        })}
      </div>
      {availablePosts.length === 0 && posts.length > 0 && (
        <p className="mt-2 text-center text-xs text-white/30">Baaki sab posts pe pehle se rule bana hua hai.</p>
      )}
      {posts.length === 0 && (
        <p className="mt-2 text-center text-xs text-white/30">Koi recent post nahi mila.</p>
      )}
    </div>
  );
};

// RuleCard component
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
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-start gap-3">
        {/* Post preview thumbnail */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
          {rule.postThumbnail ? (
            <img src={rule.postThumbnail} alt="post" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg">🌐</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-purple-300/70">
            {rule.postId ? (rule.postCaption ? rule.postCaption.slice(0, 60) : `Post ID: ${rule.postId.slice(0, 12)}...`) : '🌐 Pura account (har post)'}
          </p>

          {!editing ? (
            <>
              <p className="mt-1 text-sm font-medium text-white">
                Keyword: <span className="text-purple-300">{rule.keyword}</span>{' '}
                <span className="text-[10px] text-white/30">({rule.matchType === 'exact' ? 'exact match' : 'contains'})</span>
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/50"
              />
              <StyledSelect
                value={form.matchType}
                onChange={(v) => setForm({ ...form, matchType: v as 'exact' | 'contains' })}
                options={[
                  { value: 'contains', label: 'Comment mein keyword kahin bhi ho' },
                  { value: 'exact', label: 'Comment sirf keyword hi ho (exact)' },
                ]}
              />
              <textarea
                value={form.dmMessage}
                onChange={(e) => setForm({ ...form, dmMessage: e.target.value })}
                rows={2}
                placeholder="DM message / link"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/50"
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
              <OutlineButton onClick={() => setEditing(true)} color="indigo">Edit</OutlineButton>
              <OutlineButton onClick={() => onToggle(rule._id, rule.isActive)} color={rule.isActive ? 'yellow' : 'green'}>
                {rule.isActive ? 'Pause' : 'Resume'}
              </OutlineButton>
              <OutlineButton onClick={() => onDelete(rule._id)} color="red">
                <SvgIcon d={ICONS.trash} className="h-3.5 w-3.5" />
              </OutlineButton>
            </>
          ) : (
            <>
              <OutlineButton onClick={handleSave} color="green">Save</OutlineButton>
              <OutlineButton onClick={() => { setForm({ keyword: rule.keyword, matchType: rule.matchType, dmMessage: rule.dmMessage }); setEditing(false); }}>
                Cancel
              </OutlineButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface InstagramAutomationManagerProps {
  token?: string;
  apiBase?: string;
}

const InstagramAutomationManager: React.FC<InstagramAutomationManagerProps> = ({ token: tokenProp, apiBase }) => {
  const token = tokenProp || localStorage.getItem('adminToken') || '';
  const API = apiBase || API_BASE;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

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
      toast.error(err.response?.data?.error || 'Instagram data load nahi ho paya');
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
      toast.error(err.response?.data?.error || 'Posts load nahi ho paye');
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.igUsername || !newAccount.igUserId || !newAccount.accessToken) return;
    const toastId = toast.loading('Account add ho raha hai...');
    try {
      await axios.post(`${API}/instagram-automation/accounts`, newAccount, authHeaders);
      toast.success('Instagram account connected!', { id: toastId });
      setNewAccount({ igUsername: '', igUserId: '', accessToken: '' });
      setShowAddAccount(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Account add nahi hua', { id: toastId });
    }
  };

  const handleToggleAccount = async (id: string, isActive: boolean) => {
    try {
      await axios.put(`${API}/instagram-automation/accounts/${id}`, { isActive: !isActive }, authHeaders);
      toast.success(!isActive ? 'Account resumed' : 'Account paused');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update fail ho gaya');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Ye Instagram account remove karna hai? Iske saare keyword rules bhi permanently delete ho jayenge.')) return;
    const toastId = toast.loading('Removing...');
    try {
      await axios.delete(`${API}/instagram-automation/accounts/${id}`, authHeaders);
      toast.success('Account removed', { id: toastId });
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Remove nahi hua', { id: toastId });
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !newRule.keyword || !newRule.dmMessage) return;
    const toastId = toast.loading('Rule add ho raha hai...');
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
      toast.error(err.response?.data?.error || 'Rule add nahi hua', { id: toastId });
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      await axios.put(`${API}/instagram-automation/rules/${id}`, { isActive: !isActive }, authHeaders);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update fail ho gaya');
    }
  };

  const handleUpdateRule = async (id: string, updates: { keyword: string; matchType: 'exact' | 'contains'; dmMessage: string }) => {
    const toastId = toast.loading('Rule update ho raha hai...');
    try {
      await axios.put(`${API}/instagram-automation/rules/${id}`, updates, authHeaders);
      toast.success('Rule updated', { id: toastId });
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update fail ho gaya', { id: toastId });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Ye rule delete karna hai?')) return;
    try {
      await axios.delete(`${API}/instagram-automation/rules/${id}`, authHeaders);
      toast.success('Rule deleted');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete nahi hua');
    }
  };

  const rulesForSelectedAccount = rules.filter((r) => r.accountId === selectedAccountId);
  const logsForSelectedAccount = logs.filter((l) => l.accountId === selectedAccountId);
  const selectedAccount = accounts.find(a => a.igUserId === selectedAccountId);

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
    <div className="space-y-8 px-1 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Instagram Automation
          </h2>
          <p className="mt-1 text-xs text-white/40">
            Comment mein keyword aaye to automatically DM mein link bhejo · {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
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
            <SvgIcon d={ICONS.instagram} className="h-4 w-4" />
            Connect Instagram Account
          </GradientButton>
          <OutlineButton onClick={() => setShowAddAccount(!showAddAccount)}>
            {showAddAccount ? 'Cancel' : 'Add Manually'}
          </OutlineButton>
        </div>
      </div>

      {showAddAccount && (
        <form onSubmit={handleAddAccount} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md space-y-4">
          <p className="text-xs text-white/40">
            Account ID aur Access Token Meta Developer Dashboard ke "API setup with Instagram login" page ke Section 2 se copy karo.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Instagram Username</label>
              <input
                type="text"
                value={newAccount.igUsername}
                onChange={(e) => setNewAccount({ ...newAccount, igUsername: e.target.value })}
                placeholder="animebingofficial"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Instagram User ID</label>
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

      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-white/30">
            Abhi koi Instagram account connect nahi hai.
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
                    <SvgIcon d={ICONS.instagram} className="h-5 w-5" />
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
                  <SvgIcon d={acc.isActive ? ICONS.check : ICONS.block} className="h-3 w-3" />
                  {acc.isActive ? 'Active' : 'Paused'}
                </span>
                <OutlineButton onClick={(e) => { e?.stopPropagation(); handleToggleAccount(acc._id, acc.isActive); }} color={acc.isActive ? 'yellow' : 'green'}>
                  {acc.isActive ? 'Pause' : 'Resume'}
                </OutlineButton>
                <OutlineButton onClick={(e) => { e?.stopPropagation(); handleDeleteAccount(acc._id); }} color="red">
                  <SvgIcon d={ICONS.trash} className="h-3.5 w-3.5" />
                </OutlineButton>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedAccountId && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-white">
              Keyword Rules — <span className="text-purple-300">@{selectedAccount?.igUsername}</span>
            </h3>
            <OutlineButton onClick={() => setShowAddRule(!showAddRule)} color="indigo">
              <SvgIcon d={ICONS.plus} className="h-3.5 w-3.5" /> Add Rule
            </OutlineButton>
          </div>

          {showAddRule && (
            <form onSubmit={handleAddRule} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <PostPickerGrid
                posts={posts}
                loading={postsLoading}
                selectedPostId={selectedPostId}
                onSelect={setSelectedPostId}
                excludePostIds={rulesForSelectedAccount.filter(r => r.postId).map(r => r.postId as string)}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Keyword (jaise: ANIME)"
                  value={newRule.keyword}
                  onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/50"
                />
                <StyledSelect
                  value={newRule.matchType}
                  onChange={(v) => setNewRule({ ...newRule, matchType: v as 'exact' | 'contains' })}
                  options={[
                    { value: 'contains', label: 'Comment mein keyword kahin bhi ho' },
                    { value: 'exact', label: 'Comment sirf keyword hi ho (exact)' },
                  ]}
                />
              </div>
              <textarea
                placeholder="DM message jo bhejna hai (link ke saath)"
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
            {rulesForSelectedAccount.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/30">Is account ke liye koi rule nahi bana abhi tak.</p>
            ) : (
              rulesForSelectedAccount.map((rule) => (
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

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Recent Activity</p>
            {logsForSelectedAccount.length === 0 ? (
              <p className="text-xs text-white/30">Abhi tak koi comment match nahi hua.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {logsForSelectedAccount.map((log) => (
                  <div key={log._id} className="flex items-center justify-between border-b border-white/5 py-1.5 text-xs">
                    <span className="text-white/60">"{log.matchedText}" → keyword: {log.keyword}</span>
                    <span className={log.status === 'sent' ? 'text-emerald-400' : 'text-red-400'}>
                      {log.status === 'sent' ? '✓ DM Sent' : '✗ Failed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramAutomationManager;