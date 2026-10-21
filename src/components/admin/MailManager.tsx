// src/components/admin/MailManager.tsx — Gmail accounts + compose (main admin only, premium redesign)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Spinner from '../Spinner';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

interface MailAccount {
  _id: string;
  email: string;
  label: string;
  isActive: boolean;
  sent24h: number;
  dailyLimit: number;
  lastError?: string | null;
}

interface MailLog {
  _id: string;
  accountEmail: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  error?: string | null;
  createdAt: string;
}

interface Props { token?: string }

// ─── Design tokens ───────────────────────────────────────────────────────
const inputCls =
  'w-full bg-white/[0.03] border border-white/10 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 ' +
  'placeholder:text-gray-600 transition';

// ─── SVG icons ───────────────────────────────────────────────────────────
const MailIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean; className?: string }> = ({ open, className = 'w-4 h-4' }) => (
  <svg className={`${className} transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7h10z" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);

const AlertIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
  </svg>
);

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
  </svg>
);

// ─── Auto-grow textarea ──────────────────────────────────────────────────
const AutoGrowTextarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}> = ({ value, onChange, placeholder, minRows = 4, className = '' }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  );
};

// ─── Custom premium account dropdown ─────────────────────────────────────
const MailAccountSelect: React.FC<{
  value: string;
  accounts: MailAccount[];
  onChange: (id: string) => void;
  disabled?: boolean;
}> = ({ value, accounts, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeAccounts = accounts.filter(a => a.isActive);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = activeAccounts.find(a => a._id === value);
  const label = current ? (current.label || current.email) : 'Auto (least used)';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 bg-white/[0.03] border rounded-lg px-3 py-2 text-sm transition text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-purple-500/70 ring-1 ring-purple-500/40'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
        }`}
      >
        <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
          current ? 'bg-purple-500/15 text-purple-300' : 'bg-white/[0.05] text-gray-500'
        }`}>
          <MailIcon className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] text-gray-500 leading-tight">Send from</span>
          <span className={`block truncate leading-tight ${current ? 'text-white' : 'text-gray-300'}`}>
            {label}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-[#1a1825] border border-white/10 shadow-2xl shadow-black/70 overflow-hidden"
          style={{ animation: 'mailSelectIn 0.16s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <style>{`
            @keyframes mailSelectIn {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
          `}</style>

          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
              value === '' ? 'bg-purple-500/15 text-purple-200' : 'text-gray-300 hover:bg-white/[0.05]'
            }`}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
              {value === '' && <CheckIcon className="w-3 h-3 text-purple-300" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-tight">Auto</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Least used account</p>
            </div>
          </button>

          {activeAccounts.length > 0 ? (
            <div className="max-h-56 overflow-y-auto border-t border-white/[0.06]">
              {activeAccounts.map(a => {
                const active = value === a._id;
                return (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => { onChange(a._id); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition border-t border-white/[0.04] first:border-t-0 ${
                      active ? 'bg-purple-500/15 text-purple-200' : 'text-gray-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      {active && <CheckIcon className="w-3 h-3 text-purple-300" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight truncate">{a.label || a.email}</p>
                      {a.label && a.email && a.label !== a.email && (
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">{a.email}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-3 text-center border-t border-white/[0.06]">
              <p className="text-[11px] text-gray-500">Koi active account nahi hai</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Small stat chip ─────────────────────────────────────────────────────
const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'purple' | 'emerald' | 'amber' | 'sky' }> = ({
  icon, label, value, tone = 'purple',
}) => {
  const tones: Record<string, string> = {
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-200',
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
    sky: 'bg-sky-500/10 border-sky-500/25 text-sky-200',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${tones[tone]}`}>
      <span className="opacity-80 flex-shrink-0">{icon}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
};

// ─── Relative time helper ────────────────────────────────────────────────
const formatRelative = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main MailManager ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const MailManager: React.FC<Props> = ({ token: tokenProp }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';
  const auth = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ accountId: '', to: '', subject: '', message: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [a, l] = await Promise.all([
        axios.get(`${API_BASE}/mail/accounts`, auth()),
        axios.get(`${API_BASE}/mail/logs`, auth()),
      ]);
      setAccounts(a.data.accounts || []);
      setLogs(l.data.logs || []);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load mail settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // popup se "gmail-connected" message aaye to refresh
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== new URL(API_BASE).origin) return;
      if (e.data?.type === 'gmail-connected') {
        setConnecting(false);
        if (e.data.ok) {
          toast.success('Gmail connected successfully', {
            style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '12px' },
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          });
        } else {
          toast.error('Gmail connect failed', {
            style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px' },
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
          });
        }
        load(true);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [load]);

  const addGmail = async () => {
    setConnecting(true);
    try {
      const { data } = await axios.get(`${API_BASE}/mail/connect-url`, auth());
      setRedirectUri(data.redirectUri);
      const popup = window.open(data.url, 'gmail-connect', 'width=520,height=680');
      if (!popup) { window.location.href = data.url; return; }
      const t = setInterval(() => {
        if (popup.closed) { clearInterval(t); setConnecting(false); load(true); }
      }, 800);
    } catch (e: any) {
      setConnecting(false);
      toast.error(e.response?.data?.error || 'Could not start Gmail connect', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#f43f5e', secondary: '#fff' },
      });
    }
  };

  const patchAccount = async (id: string, body: Partial<Pick<MailAccount, 'label' | 'isActive'>>) => {
    try {
      await axios.put(`${API_BASE}/mail/accounts/${id}`, body, auth());
      load(true);
      if ('isActive' in body) {
        toast.success(body.isActive ? 'Account enabled' : 'Account disabled', {
          style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '12px' },
          iconTheme: { primary: '#10b981', secondary: '#fff' },
        });
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Update failed', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#f43f5e', secondary: '#fff' },
      });
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/mail/accounts/${id}`, auth());
      setDeleteArmed(null);
      load(true);
      toast.success('Account removed', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#10b981', secondary: '#fff' },
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#f43f5e', secondary: '#fff' },
      });
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const { data } = await axios.post(`${API_BASE}/mail/send`, {
        accountId: form.accountId || undefined,
        to: form.to, subject: form.subject, message: form.message,
      }, auth());
      toast.success(data.message || 'Mail sent', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#10b981', secondary: '#fff' },
      });
      setForm(f => ({ ...f, to: '', subject: '', message: '' }));
      load(true);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send', {
        style: { background: '#1a1825', color: '#fff', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '12px' },
        iconTheme: { primary: '#f43f5e', secondary: '#fff' },
      });
    } finally {
      setSending(false);
    }
  };

  // ─── Loading / error states ───────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="text-center py-12 px-4">
      <p className="text-rose-400 text-sm mb-3">{error}</p>
      <button onClick={() => load()} className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition">
        Try again
      </button>
    </div>
  );

  const canSend = !!(form.to.trim() && form.subject.trim() && form.message.trim() && accounts.some(a => a.isActive));
  const activeCount = accounts.filter(a => a.isActive).length;
  const sentToday = accounts.reduce((s, a) => s + (a.sent24h || 0), 0);
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center">
                <MailIcon className="w-4 h-4" />
              </span>
              Gmail & Mail
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Connected Gmail accounts and one-off compose
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition border border-white/[0.06] hover:border-white/[0.12] disabled:opacity-50"
            >
              <RefreshIcon className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <button
              onClick={addGmail}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-[0_1px_10px_rgba(147,51,234,0.35)] disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Waiting for Google…
                </>
              ) : (
                <>
                  <PlusIcon /> Add Gmail
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex flex-wrap items-center gap-2">
          <StatChip icon={<GoogleIcon />} label="Accounts" value={accounts.length} tone="purple" />
          <StatChip icon={<CheckIcon />} label="Active" value={activeCount} tone="emerald" />
          <StatChip icon={<ClockIcon />} label="Sent today" value={sentToday} tone="sky" />
          <StatChip icon={<SendIcon />} label="Recent" value={`${sentCount} sent · ${failedCount} failed`} tone="amber" />
        </div>

        {redirectUri && (
          <div className="flex items-start gap-2 bg-sky-500/[0.06] border border-sky-500/25 rounded-xl px-3.5 py-3">
            <span className="mt-0.5 text-sky-300 flex-shrink-0"><InfoIcon /></span>
            <div className="min-w-0">
              <p className="text-[11px] text-sky-200 font-medium">redirect_uri_mismatch?</p>
              <p className="text-[11px] text-sky-300/70 mt-1">
                Google Cloud Console → Authorized redirect URI:
              </p>
              <p className="text-[11px] font-mono text-sky-100 break-all mt-1 bg-black/30 rounded px-2 py-1">{redirectUri}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Accounts ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h4 className="text-sm font-semibold text-white tracking-tight">Connected accounts</h4>
          <span className="text-[11px] text-gray-500">
            Mail auto-rotates to the least-used active account
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center">
              <MailIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-300">Koi Gmail connected nahi</p>
            <p className="text-xs text-gray-500 mt-1">"Add Gmail" dabao aur ek account connect karo.</p>
            <button
              onClick={addGmail}
              disabled={connecting}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-[0_1px_10px_rgba(147,51,234,0.35)] disabled:opacity-50"
            >
              <PlusIcon /> Connect Gmail
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {accounts.map(a => {
              const pct = Math.min(100, Math.round((a.sent24h / a.dailyLimit) * 100));
              const dangerPct = pct > 85;
              return (
                <div
                  key={a._id}
                  className={`group relative bg-white/[0.03] border rounded-xl p-3 sm:p-4 transition-all duration-200 ${
                    a.isActive
                      ? 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.045]'
                      : 'border-white/[0.04] hover:border-white/[0.08] opacity-70'
                  }`}
                >
                  {/* Status spine */}
                  <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r ${a.isActive ? 'bg-gradient-to-b from-emerald-400 to-emerald-500' : 'bg-gradient-to-b from-rose-400 to-rose-500'}`} />

                  <div className="flex items-center gap-3 flex-wrap pl-2">
                    {/* Gmail icon */}
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                    }`}>
                      <GoogleIcon className="w-4.5 h-4.5" />
                    </span>

                    {/* Email + label */}
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{a.email}</p>
                        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          a.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${a.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {a.isActive ? 'Active' : 'Off'}
                        </span>
                      </div>
                      <input
                        defaultValue={a.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== a.label) patchAccount(a._id, { label: v });
                        }}
                        className="mt-1 bg-transparent border-b border-white/10 focus:border-purple-500 outline-none text-xs text-gray-400 w-full max-w-[220px] transition"
                        placeholder="Label (e.g. Support, Sales…)"
                        maxLength={60}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                      <button
                        onClick={() => patchAccount(a._id, { isActive: !a.isActive })}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition ${
                          a.isActive
                            ? 'bg-white/5 hover:bg-white/10 text-gray-300'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                        }`}
                      >
                        {a.isActive ? 'Disable' : 'Enable'}
                      </button>
                      {deleteArmed === a._id ? (
                        <div className="flex items-center gap-1.5 bg-rose-500/[0.08] border border-rose-500/25 rounded-lg px-2 py-1">
                          <p className="text-[11px] text-rose-300 pr-1">Remove?</p>
                          <button
                            onClick={() => setDeleteArmed(null)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteAccount(a._id)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white transition"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteArmed(a._id)}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 text-gray-500 hover:text-rose-400 transition"
                          title="Remove account"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Usage bar */}
                  <div className="mt-3 pl-2">
                    <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                      <span>Last 24h usage</span>
                      <span className={`tabular-nums ${dangerPct ? 'text-rose-400' : 'text-gray-400'}`}>
                        {a.sent24h} / {a.dailyLimit} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          dangerPct ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 'bg-gradient-to-r from-purple-500 to-fuchsia-500'
                        }`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>

                  {a.lastError && (
                    <div className="mt-3 pl-2 flex items-start gap-2 text-[11px] text-rose-400 bg-rose-500/[0.06] border border-rose-500/20 rounded-lg px-2.5 py-1.5">
                      <AlertIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <p className="break-words">{a.lastError}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Compose ────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-purple-500/15 text-purple-300 flex items-center justify-center">
              <SendIcon className="w-3 h-3" />
            </span>
            Send mail
          </h4>
          {!activeCount && accounts.length > 0 && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertIcon className="w-3 h-3" /> Koi active account nahi
            </span>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MailAccountSelect
              value={form.accountId}
              accounts={accounts}
              onChange={(id) => setForm({ ...form, accountId: id })}
              disabled={accounts.length === 0}
            />
            <input
              type="email"
              value={form.to}
              onChange={e => setForm({ ...form, to: e.target.value })}
              className={inputCls}
              placeholder="To (user email)"
            />
          </div>
          <input
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            className={inputCls}
            placeholder="Subject"
            maxLength={200}
          />
          <AutoGrowTextarea
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            className={`${inputCls} block`}
            placeholder="Message…"
            minRows={4}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-gray-600">
              {form.message.length > 0 ? `${form.message.length} chars` : 'Plain text · no attachments'}
            </p>
            <button
              onClick={send}
              disabled={sending || !canSend}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-[0_1px_10px_rgba(16,185,129,0.35)] disabled:opacity-40 disabled:shadow-none"
            >
              {sending ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <SendIcon /> Send mail
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Logs ───────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-sky-500/15 text-sky-300 flex items-center justify-center">
              <ClockIcon className="w-3 h-3" />
            </span>
            Recent mails
          </h4>
          {logs.length > 0 && (
            <span className="text-[11px] text-gray-500">{logs.length} entries</span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 text-gray-500 flex items-center justify-center">
              <MailIcon className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500">Abhi tak koi mail nahi gayi.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map(l => {
              const isSent = l.status === 'sent';
              return (
                <div
                  key={l._id}
                  className="group flex items-start gap-2.5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] rounded-lg px-3 py-2.5 transition-colors"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isSent ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-rose-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-gray-200 truncate flex-1 min-w-0">{l.subject}</p>
                      <span className="text-[10px] text-gray-600 tabular-nums flex-shrink-0" title={new Date(l.createdAt).toLocaleString()}>
                        {formatRelative(l.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 truncate mt-0.5">
                      to <span className="text-gray-400">{l.to}</span>
                      <span className="mx-1.5 text-gray-700">·</span>
                      from <span className="text-gray-400">{l.accountEmail}</span>
                    </p>
                    {l.error && (
                      <p className="text-[11px] text-rose-400 mt-1 break-words">{l.error}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isSent ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                  }`}>
                    {isSent ? 'Sent' : 'Failed'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MailManager;