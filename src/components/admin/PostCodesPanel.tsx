import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

/* ============================================================
   TYPES
   ============================================================ */
type TriggerMode = 'any' | 'exact' | 'contains';
type CodeStatus = 'live' | 'waiting' | 'paused';
type Filter = 'all' | CodeStatus;
type Sort = 'newest' | 'hits';

interface PostCode {
  _id: string;
  code: string;
  /** Full DM message sent when someone comments on the post */
  dmMessage?: string;
  /** When does this code send its DM: every comment, or only a keyword */
  triggerMode?: TriggerMode;
  keyword?: string;
  /** Legacy field (older codes only had a link) */
  link?: string;
  label?: string;
  isActive: boolean;
  postId?: string | null;
  hits?: number;
  createdAt: string;
}

interface Props {
  apiBase: string;
  token: string;
  /** igUserId of the selected Instagram account */
  accountId: string;
}

interface CheckItem {
  key: string;
  /** true = ok, false = problem, null = just info */
  ok: boolean | null;
  text: string;
}

interface CheckResult {
  found: boolean;
  post?: { id: string; permalink?: string } | null;
  checks: CheckItem[];
  logs: { status: string; matchedText: string; createdAt: string; error?: string }[];
}

/* ============================================================
   CONSTANTS + HELPERS
   ============================================================ */
const DEFAULT_DM_TEMPLATE = 'Here is your link: ';

const TRIGGER_OPTIONS: { value: TriggerMode; label: string }[] = [
  { value: 'any', label: 'Every comment' },
  { value: 'exact', label: 'Exact keyword' },
  { value: 'contains', label: 'Contains keyword' },
];

const TRIGGER_HINT: Record<TriggerMode, string> = {
  any: 'Anyone who comments on the post gets this message.',
  exact: 'Only a comment that is exactly the keyword gets this message.',
  contains: 'A comment with the keyword anywhere in it gets this message.',
};

const STATUS_META: Record<CodeStatus, { label: string; badge: string; dot: string }> = {
  live:    { label: 'Live',    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',    dot: 'bg-cyan-400' },
  waiting: { label: 'Waiting', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  paused:  { label: 'Paused',  badge: 'border-white/10 bg-white/5 text-white/40',           dot: 'bg-white/30' },
};

const FIELD_CLS =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10 disabled:opacity-60';

const modeOf = (c: PostCode): TriggerMode => c.triggerMode || 'any';

const triggerLabel = (c: PostCode): string => {
  const m = modeOf(c);
  if (m === 'any') return 'Every comment';
  return `${m === 'exact' ? 'Exact' : 'Contains'}: ${c.keyword || '?'}`;
};

const statusOf = (c: PostCode): CodeStatus => (!c.isActive ? 'paused' : c.postId ? 'live' : 'waiting');

/** The message this code actually sends (falls back to old link-only codes) */
const messageOf = (c: PostCode): string =>
  (c.dmMessage || '').trim() || (c.link ? `${DEFAULT_DM_TEMPLATE}${c.link}` : '');

/** First URL inside a message (kept so older backends that read `link` still work) */
const extractLink = (text: string): string => text.match(/https?:\/\/[^\s]+/i)?.[0] || '';

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const timeAgo = (iso: string): string => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const dayDiff = (iso: string): number => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

const groupOf = (iso: string): string => {
  const d = dayDiff(iso);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return 'This week';
  return 'Earlier';
};

/* ============================================================
   ICONS
   ============================================================ */
type IconName =
  | 'copy' | 'check' | 'trash' | 'edit' | 'pause' | 'play' | 'message' | 'bolt' | 'key' | 'fire'
  | 'info' | 'warning' | 'search' | 'close' | 'sparkles' | 'chevronDown' | 'activity' | 'plus' | 'external';

const PATHS: Record<IconName, React.ReactNode> = {
  copy: <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />,
  trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />,
  edit: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  message: <path d="M8 10h8M8 14h5m-5 7l-4-4V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H9z" strokeLinecap="round" strokeLinejoin="round" />,
  bolt: <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinejoin="round" />,
  key: <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeLinecap="round" strokeLinejoin="round" />,
  fire: <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" strokeLinejoin="round" />,
  info: <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />,
  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </>
  ),
  close: <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />,
  sparkles: (
    <>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" strokeLinejoin="round" />
      <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75z" strokeLinejoin="round" />
    </>
  ),
  chevronDown: <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />,
  activity: <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />,
  external: <path d="M14 3h7v7m0-7L10 14M5 5h5M5 5v14h14v-5" strokeLinecap="round" strokeLinejoin="round" />,
};

const Icon: React.FC<{ name: IconName; className?: string }> = ({ name, className = 'h-3.5 w-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

const Spin: React.FC<{ className?: string }> = ({ className = 'h-3.5 w-3.5' }) => (
  <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} />
);

/* ============================================================
   SMALL UI PIECES
   ============================================================ */
const IconBtn: React.FC<{
  title: string;
  onClick: () => void;
  tone?: 'indigo' | 'amber' | 'cyan' | 'red' | 'gray' | 'purple';
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, tone = 'gray', disabled, children }) => {
  const tones: Record<string, string> = {
    indigo: 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20',
    amber:  'border-amber-500/30 text-amber-300 hover:bg-amber-500/20',
    cyan:   'border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20',
    red:    'border-red-500/30 text-red-300 hover:bg-red-500/20',
    purple: 'border-purple-500/30 text-purple-300 hover:bg-purple-500/20',
    gray:   'border-white/10 text-white/60 hover:bg-white/10 hover:text-white',
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

/** Compact "when should the DM go out" control: 3 segments + keyword box */
const TriggerPicker: React.FC<{
  mode: TriggerMode;
  keyword: string;
  onMode: (m: TriggerMode) => void;
  onKeyword: (k: string) => void;
  disabled?: boolean;
}> = ({ mode, keyword, onMode, onKeyword, disabled }) => (
  <div className="space-y-1.5">
    <div className="grid grid-cols-3 gap-0.5 rounded-xl border border-white/10 bg-white/[0.02] p-0.5">
      {TRIGGER_OPTIONS.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onMode(o.value)}
            className={`rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition-all disabled:opacity-60 ${
              active
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow shadow-purple-500/20'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
    {mode !== 'any' && (
      <input
        type="text"
        value={keyword}
        onChange={(e) => onKeyword(e.target.value)}
        disabled={disabled}
        placeholder="Keyword, e.g. LINK"
        aria-label="Keyword"
        className={FIELD_CLS}
      />
    )}
    <p className="text-[10px] leading-snug text-white/30">{TRIGGER_HINT[mode]}</p>
  </div>
);

const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, loading = false, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <Icon name="warning" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          >
            {loading ? <Spin className="h-3 w-3" /> : <Icon name="trash" className="h-3 w-3" />}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
const PostCodesPanel: React.FC<Props> = ({ apiBase, token, accountId }) => {
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const base = `${apiBase}/instagram-automation/post-codes`;

  /* ---------- state ---------- */
  const [codes, setCodes] = useState<PostCode[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [createOpen, setCreateOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dmMessage, setDmMessage] = useState(DEFAULT_DM_TEMPLATE);
  const [label, setLabel] = useState('');
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('any');
  const [keyword, setKeyword] = useState('');

  // list controls
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  // one row open at a time
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editMode, setEditMode] = useState<TriggerMode>('any');
  const [editKeyword, setEditKeyword] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<string, CheckResult>>({});

  const [confirmState, setConfirmState] = useState<{ open: boolean; code: PostCode | null; loading: boolean }>({
    open: false, code: null, loading: false,
  });
  const closeConfirm = () => setConfirmState({ open: false, code: null, loading: false });

  /* ---------- data ---------- */
  const fetchCodes = async () => {
    try {
      const res = await axios.get(base, { ...authHeaders, params: { accountId } });
      setCodes(res.data.codes || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    setEditing(false);
    setSearch('');
    setFilter('all');
    fetchCodes();
  }, [accountId]);

  /* ---------- computed ---------- */
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: codes.length, live: 0, waiting: 0, paused: 0 };
    codes.forEach((x) => { c[statusOf(x)]++; });
    return c;
  }, [codes]);

  const totalHits = useMemo(() => codes.reduce((sum, c) => sum + (c.hits || 0), 0), [codes]);
  const maxHits = useMemo(() => Math.max(1, ...codes.map((c) => c.hits || 0)), [codes]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = codes
      .filter((c) => filter === 'all' || statusOf(c) === filter)
      .filter(
        (c) =>
          !s ||
          c.code.toLowerCase().includes(s) ||
          (c.label || '').toLowerCase().includes(s) ||
          messageOf(c).toLowerCase().includes(s) ||
          (c.keyword || '').toLowerCase().includes(s),
      );
    return list.sort((a, b) =>
      sort === 'hits'
        ? (b.hits || 0) - (a.hits || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [codes, filter, search, sort]);

  // "Today / Yesterday / This week / Earlier" headings (only when sorted by newest)
  const groups = useMemo(() => {
    if (sort === 'hits') return [{ label: '', items: visible }];
    const out: { label: string; items: PostCode[] }[] = [];
    visible.forEach((c) => {
      const l = groupOf(c.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === l) last.items.push(c);
      else out.push({ label: l, items: [c] });
    });
    return out;
  }, [visible, sort]);

  /* ---------- small helpers ---------- */
  const flashCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  };

  const handleCopy = async (key: string, text: string, okLabel: string) => {
    const ok = await copyText(text);
    if (ok) {
      flashCopied(key);
      toast.success(`${okLabel} copied`);
    } else {
      toast.error('Copy failed');
    }
  };

  const toggleExpand = (id: string) => {
    setEditing(false);
    setExpandedId((cur) => (cur === id ? null : id));
  };

  const startEdit = (c: PostCode) => {
    setExpandedId(c._id);
    setEditing(true);
    setEditMessage(messageOf(c) || DEFAULT_DM_TEMPLATE);
    setEditMode(modeOf(c));
    setEditKeyword(c.keyword || '');
  };

  /* ---------- actions ---------- */
  // Create code + copy "ID:123456" to clipboard
  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (generating) return;
    const msg = dmMessage.trim();
    if (!msg || msg === DEFAULT_DM_TEMPLATE.trim()) {
      toast.error('Write the DM message first');
      return;
    }
    if (triggerMode !== 'any' && !keyword.trim()) {
      toast.error('Write the keyword');
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post(
        `${base}/generate`,
        {
          accountId,
          dmMessage: msg,
          link: extractLink(msg),
          label: label.trim(),
          triggerMode,
          keyword: triggerMode === 'any' ? '' : keyword.trim(),
        },
        authHeaders,
      );
      const caption: string = res.data.captionText;
      const copied = await copyText(caption);
      toast.success(copied ? `${caption} copied! Paste it in your caption` : `Code: ${caption}`);
      setDmMessage(DEFAULT_DM_TEMPLATE);
      setLabel('');
      setKeyword('');
      setSort('newest');
      setFilter('all');
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Create failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMessage = async (id: string) => {
    const msg = editMessage.trim();
    if (!msg) {
      toast.error('DM message cannot be empty');
      return;
    }
    if (editMode !== 'any' && !editKeyword.trim()) {
      toast.error('Write the keyword');
      return;
    }
    setBusyId(id);
    try {
      await axios.put(
        `${base}/${id}`,
        {
          dmMessage: msg,
          link: extractLink(msg),
          triggerMode: editMode,
          keyword: editMode === 'any' ? '' : editKeyword.trim(),
        },
        authHeaders,
      );
      toast.success('Code updated');
      setEditing(false);
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  // Finds the post that has this code in its caption, links it right now,
  // and reports if everything needed for the DM is ready.
  const handleCheck = async (c: PostCode) => {
    if (checkingId) return;
    setCheckingId(c._id);
    try {
      const res = await axios.post(`${base}/${c._id}/check`, {}, authHeaders);
      const result: CheckResult = {
        found: !!res.data.found,
        post: res.data.post || null,
        checks: res.data.checks || [],
        logs: res.data.logs || [],
      };
      setCheckResults((prev) => ({ ...prev, [c._id]: result }));
      setEditing(false);
      setExpandedId(c._id); // open the row so the result is visible
      if (result.found) toast.success('Post found. Trigger is on');
      else toast('Post not in latest posts. DM still works when someone comments');
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check failed');
    } finally {
      setCheckingId(null);
    }
  };

  const handleToggle = async (c: PostCode) => {
    setBusyId(c._id);
    try {
      await axios.put(`${base}/${c._id}`, { isActive: !c.isActive }, authHeaders);
      toast.success(c.isActive ? 'Code paused' : 'Code resumed');
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const c = confirmState.code;
    if (!c) return;
    setConfirmState((p) => ({ ...p, loading: true }));
    setBusyId(c._id);
    try {
      await axios.delete(`${base}/${c._id}`, authHeaders);
      toast.success('Code deleted');
      if (expandedId === c._id) setExpandedId(null);
      closeConfirm();
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
      setConfirmState((p) => ({ ...p, loading: false }));
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- render pieces ---------- */
  const filters: { id: Filter; label: string; dot?: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'Live', dot: STATUS_META.live.dot },
    { id: 'waiting', label: 'Waiting', dot: STATUS_META.waiting.dot },
    { id: 'paused', label: 'Paused', dot: STATUS_META.paused.dot },
  ];

  const renderCheckResult = (c: PostCode) => {
    const r = checkResults[c._id];
    if (!r) return null;
    return (
      <div className="space-y-2 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-white/80">Check result</p>
          <button
            type="button"
            onClick={() =>
              setCheckResults((prev) => {
                const next = { ...prev };
                delete next[c._id];
                return next;
              })
            }
            aria-label="Close check result"
            className="rounded p-0.5 text-white/30 transition-colors hover:text-white/70"
          >
            <Icon name="close" />
          </button>
        </div>

        <ul className="space-y-1">
          {r.checks.map((it) => (
            <li key={it.key} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 shrink-0 ${it.ok === true ? 'text-cyan-300' : it.ok === false ? 'text-red-300' : 'text-amber-300'}`}>
                <Icon name={it.ok === true ? 'check' : it.ok === false ? 'close' : 'info'} className="h-3.5 w-3.5" />
              </span>
              <span className={it.ok === false ? 'text-red-200/90' : 'text-white/70'}>{it.text}</span>
            </li>
          ))}
        </ul>

        {r.post?.permalink && (
          <a
            href={r.post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 hover:text-purple-200"
          >
            Open the post on Instagram <Icon name="external" className="h-3 w-3" />
          </a>
        )}

        {r.logs.length > 0 && (
          <div className="space-y-1 border-t border-white/5 pt-2">
            <p className="text-[10px] font-medium text-white/40">Latest activity on this post</p>
            {r.logs.map((l, i) => (
              <p key={i} className="flex items-center gap-2 text-[11px] text-white/60">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    l.status === 'sent' ? 'bg-cyan-500/10 text-cyan-300'
                      : l.status === 'failed' ? 'bg-red-500/10 text-red-300'
                      : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {l.status}
                </span>
                <span className="min-w-0 flex-1 truncate">{l.error || l.matchedText}</span>
                <span className="shrink-0 text-white/30">{timeAgo(l.createdAt)}</span>
              </p>
            ))}
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-white/30">
          Real test: comment on the post from a different Instagram account (your own comments are ignored), then press Check again.
        </p>
      </div>
    );
  };

  const renderRow = (c: PostCode) => {
    const busy = busyId === c._id;
    const expanded = expandedId === c._id;
    const isEditing = expanded && editing;
    const st = statusOf(c);
    const meta = STATUS_META[st];
    const hits = c.hits || 0;
    const msg = messageOf(c);
    const codeCopied = copiedKey === `code-${c._id}`;
    const msgCopied = copiedKey === `msg-${c._id}`;

    return (
      <div
        key={c._id}
        className={`rounded-xl border transition-colors ${
          expanded ? 'border-purple-500/30 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.035]'
        } ${busy ? 'pointer-events-none opacity-60' : ''} ${st === 'paused' && !expanded ? 'opacity-70' : ''}`}
      >
        {/* ----- one-line summary (click to open) ----- */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => toggleExpand(c._id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpand(c._id);
            }
          }}
          className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1.5 px-2.5 py-2 outline-none focus-visible:ring-1 focus-visible:ring-purple-500/50"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} title={meta.label} />

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCopy(`code-${c._id}`, `ID:${c.code}`, `ID:${c.code}`); }}
            title="Copy caption code"
            className="group/chip inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 font-mono text-xs font-semibold text-purple-200 transition-all hover:border-purple-400/50 hover:bg-purple-500/20 active:scale-95"
          >
            ID:{c.code}
            <span className={codeCopied ? 'text-cyan-300' : 'text-purple-300/60 group-hover/chip:text-purple-200'}>
              <Icon name={codeCopied ? 'check' : 'copy'} className="h-3 w-3" />
            </span>
          </button>

          <div className="min-w-[120px] flex-1">
            <p className="truncate text-xs font-medium text-white/90">
              {c.label || <span className="text-white/30">No note</span>}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {msg || <span className="text-amber-300/70">No DM message yet</span>}
            </p>
          </div>

          <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-purple-300/90 md:inline-flex">
            {triggerLabel(c)}
          </span>

          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-white/40" title="Times this code sent a DM">
            <Icon name="fire" className="h-3 w-3 text-purple-300" />
            <span className="font-semibold text-white/80">{hits}</span>
            <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-white/10 lg:inline-block">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ width: `${Math.max(hits > 0 ? 10 : 0, (hits / maxHits) * 100)}%` }}
              />
            </span>
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCheck(c); }}
              disabled={!!checkingId}
              title="Find the post and check if the DM will work"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-purple-500/30 px-2 text-[11px] font-medium text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-60"
            >
              {checkingId === c._id ? <Spin className="h-3 w-3" /> : <Icon name="activity" className="h-3 w-3" />}
              <span className="hidden sm:inline">Check</span>
            </button>
            <IconBtn title="Edit code" tone="indigo" onClick={() => startEdit(c)}>
              <Icon name="edit" className="h-3 w-3" />
            </IconBtn>
            <IconBtn title={c.isActive ? 'Pause code' : 'Resume code'} tone={c.isActive ? 'amber' : 'cyan'} onClick={() => handleToggle(c)}>
              <Icon name={c.isActive ? 'pause' : 'play'} className="h-3 w-3" />
            </IconBtn>
            <IconBtn title="Delete code" tone="red" onClick={() => setConfirmState({ open: true, code: c, loading: false })}>
              <Icon name="trash" className="h-3 w-3" />
            </IconBtn>
            <span className={`ml-0.5 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <Icon name="chevronDown" className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* ----- details ----- */}
        {expanded && (
          <div className="space-y-2.5 border-t border-white/5 px-3 py-3">
            {isEditing ? (
              <div className="space-y-2.5">
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(false);
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveMessage(c._id);
                  }}
                  rows={3}
                  autoFocus
                  aria-label="Edit DM message"
                  className={FIELD_CLS}
                />
                <TriggerPicker
                  mode={editMode}
                  keyword={editKeyword}
                  onMode={setEditMode}
                  onKeyword={setEditKeyword}
                  disabled={busy}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="inline-flex h-7 items-center rounded-lg border border-white/10 px-2.5 text-xs text-white/70 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveMessage(c._id)}
                    disabled={busy}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-500/30 px-2.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-60"
                  >
                    {busy ? <Spin className="h-3 w-3" /> : <Icon name="check" className="h-3 w-3" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-purple-300/70">
                      <Icon name="message" />
                    </span>
                    {msg ? (
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/75">{msg}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="inline-flex items-center gap-1 text-xs text-amber-300/80 hover:text-amber-200"
                      >
                        <Icon name="info" className="h-3 w-3" /> No DM message set. Add a message
                      </button>
                    )}
                    {msg && (
                      <button
                        type="button"
                        onClick={() => handleCopy(`msg-${c._id}`, msg, 'Message')}
                        title="Copy message"
                        aria-label="Copy message"
                        className={`shrink-0 rounded-md p-1 transition-colors ${
                          msgCopied ? 'text-cyan-300' : 'text-white/30 hover:bg-white/5 hover:text-white/70'
                        }`}
                      >
                        <Icon name={msgCopied ? 'check' : 'copy'} className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span>Sends on: <span className="text-white/70">{triggerLabel(c)}</span></span>
                  <span>Created {timeAgo(c.createdAt)}</span>
                  <span>{c.postId ? 'Linked to a post' : 'Not linked to a post yet'}</span>
                </div>
              </>
            )}

            {renderCheckResult(c)}
          </div>
        )}
      </div>
    );
  };

  /* ---------- render ---------- */
  return (
    <div className="border-t border-white/5 pt-5">
      {/* ===== Header ===== */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
            <Icon name="key" />
          </span>
          Post codes
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-medium text-white/60">{codes.length}</span>
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META.live.dot}`} />
            <span className="font-semibold text-white/70">{counts.live}</span> live
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META.waiting.dot}`} />
            <span className="font-semibold text-white/70">{counts.waiting}</span> waiting
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="fire" className="h-3 w-3 text-purple-300" />
            <span className="font-semibold text-white/70">{totalHits}</span> DMs sent
          </span>
        </div>
      </div>

      {/* ===== Create ===== */}
      <form
        onSubmit={handleGenerate}
        className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/[0.07] via-white/[0.02] to-transparent"
      >
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-white">
            <Icon name="plus" className="h-3.5 w-3.5 text-purple-300" />
            New code
            <span className="hidden font-normal text-white/40 sm:inline">
              Write the DM once, we copy <code className="font-mono text-purple-300">ID:123456</code> for your caption
            </span>
          </span>
          <span className={`text-white/40 transition-transform ${createOpen ? 'rotate-180' : ''}`}>
            <Icon name="chevronDown" />
          </span>
        </button>

        {createOpen && (
          <div className="grid gap-3 border-t border-white/5 p-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* left: message */}
            <div className="flex flex-col">
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="pc-dm" className="text-[10px] font-medium text-white/40">DM message</label>
                <button
                  type="button"
                  onClick={() => setDmMessage(DEFAULT_DM_TEMPLATE)}
                  title="Reset to the default template"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-purple-300/80 transition-colors hover:bg-purple-500/10 hover:text-purple-200"
                >
                  <Icon name="sparkles" className="h-2.5 w-2.5" /> Reset
                </button>
              </div>
              <textarea
                id="pc-dm"
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
                }}
                rows={4}
                disabled={generating}
                placeholder="Here is your link: https://animebing.in/..."
                className={`${FIELD_CLS} flex-1`}
              />
              <p className="mt-1 text-[10px] text-white/30">Tip: press Ctrl + Enter to create quickly.</p>
            </div>

            {/* right: options + button */}
            <div className="flex flex-col gap-2">
              <TriggerPicker
                mode={triggerMode}
                keyword={keyword}
                onMode={setTriggerMode}
                onKeyword={setKeyword}
                disabled={generating}
              />
              <input
                id="pc-note"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Note for you (e.g. Naruto ep 5)"
                aria-label="Note"
                disabled={generating}
                className={FIELD_CLS}
              />
              <button
                type="submit"
                disabled={generating}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] hover:shadow-purple-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {generating ? <Spin /> : <Icon name="bolt" />}
                {generating ? 'Creating...' : 'Create & copy'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ===== Toolbar ===== */}
      {codes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                  {f.label}
                  <span className={`text-[10px] ${active ? 'text-white/90' : 'text-white/40'}`}>{counts[f.id]}</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[150px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              <Icon name="search" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, note or message..."
              aria-label="Search codes"
              className="w-full rounded-full border border-white/10 bg-white/5 py-1.5 pl-9 pr-8 text-xs text-white placeholder-white/25 outline-none transition-all focus:border-purple-500/50 focus:bg-white/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/30 transition-colors hover:text-white/70"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort codes"
              className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-7 text-xs text-white outline-none focus:border-purple-500/50"
            >
              <option value="newest" className="bg-slate-900">Newest first</option>
              <option value="hits" className="bg-slate-900">Most DMs sent</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/40">
              <Icon name="chevronDown" className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}

      {/* ===== List ===== */}
      <div className="space-y-1.5">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
          ))
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
              <Icon name="key" className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-white/80">No codes yet</p>
            <p className="max-w-xs text-xs leading-relaxed text-white/40">
              Write a DM message above and press <span className="text-purple-300">Create &amp; copy</span>. Paste the copied code in your post caption.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center">
            <p className="text-sm font-medium text-white/80">No matching codes</p>
            <p className="text-xs text-white/40">Try a different search or filter.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-1 text-[11px] font-medium text-purple-300 hover:text-purple-200"
            >
              Clear filters
            </button>
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={`${g.label}-${gi}`} className="space-y-1.5">
              {g.label && (
                <p className="px-1 pt-1.5 text-[11px] font-medium text-white/30">
                  {g.label} <span className="text-white/20">· {g.items.length}</span>
                </p>
              )}
              {g.items.map(renderRow)}
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={`Delete code ${confirmState.code?.code || ''}?`}
        message="Comments on its post will stop getting this message. This action cannot be undone."
        loading={confirmState.loading}
        onConfirm={confirmDelete}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default PostCodesPanel;