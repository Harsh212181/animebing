// src/components/admin/MailManager.tsx — Gmail accounts + compose (main admin only)
import React, { useCallback, useEffect, useState } from 'react';
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

const inputCls = 'w-full bg-white/[0.03] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-600 transition';

const MailManager: React.FC<Props> = ({ token: tokenProp }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';
  const auth = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [form, setForm] = useState({ accountId: '', to: '', subject: '', message: '' });

  const load = useCallback(async () => {
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
        setNotice(e.data.ok ? { type: 'ok', text: 'Gmail connected' } : { type: 'err', text: 'Gmail connect failed' });
        load();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [load]);

  const addGmail = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const { data } = await axios.get(`${API_BASE}/mail/connect-url`, auth());
      setRedirectUri(data.redirectUri);
      const popup = window.open(data.url, 'gmail-connect', 'width=520,height=680');
      if (!popup) { window.location.href = data.url; return; }
      const t = setInterval(() => {
        if (popup.closed) { clearInterval(t); setConnecting(false); load(); }
      }, 800);
    } catch (e: any) {
      setConnecting(false);
      setNotice({ type: 'err', text: e.response?.data?.error || 'Could not start Gmail connect' });
    }
  };

  const patchAccount = async (id: string, body: Partial<Pick<MailAccount, 'label' | 'isActive'>>) => {
    try {
      await axios.put(`${API_BASE}/mail/accounts/${id}`, body, auth());
      load();
    } catch (e: any) {
      setNotice({ type: 'err', text: e.response?.data?.error || 'Update failed' });
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/mail/accounts/${id}`, auth());
      setDeleteArmed(null);
      load();
    } catch (e: any) {
      setNotice({ type: 'err', text: e.response?.data?.error || 'Delete failed' });
    }
  };

  const send = async () => {
    setSending(true);
    setNotice(null);
    try {
      const { data } = await axios.post(`${API_BASE}/mail/send`, {
        accountId: form.accountId || undefined,
        to: form.to, subject: form.subject, message: form.message,
      }, auth());
      setNotice({ type: 'ok', text: data.message || 'Mail sent' });
      setForm(f => ({ ...f, to: '', subject: '', message: '' }));
      load();
    } catch (e: any) {
      setNotice({ type: 'err', text: e.response?.data?.error || 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="text-center py-12 px-4">
      <p className="text-rose-400 text-sm mb-3">{error}</p>
      <button onClick={load} className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition">Try again</button>
    </div>
  );

  const canSend = form.to.trim() && form.subject.trim() && form.message.trim() && accounts.some(a => a.isActive);

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${notice.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-rose-500/10 border-rose-500/25 text-rose-300'}`}>
          {notice.text}
        </div>
      )}

      {/* Accounts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Gmail Accounts</h3>
            <p className="text-xs text-gray-500 mt-0.5">{accounts.length} connected &middot; mail auto-rotates to the least-used active account</p>
          </div>
          <button
            onClick={addGmail}
            disabled={connecting}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-[0_1px_10px_rgba(147,51,234,0.35)] disabled:opacity-50"
          >
            {connecting ? 'Waiting for Google…' : '+ Add Gmail'}
          </button>
        </div>

        {redirectUri && (
          <p className="text-[11px] text-gray-500 break-all">
            Google error "redirect_uri_mismatch" aaye to Cloud Console mein ye Authorized redirect URI add karo: <span className="font-mono text-gray-300">{redirectUri}</span>
          </p>
        )}

        {accounts.length === 0 ? (
          <div className="text-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs text-gray-500">
            Koi Gmail connected nahi. "Add Gmail" dabao.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(a => {
              const pct = Math.min(100, Math.round((a.sent24h / a.dailyLimit) * 100));
              return (
                <div key={a._id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-sm font-medium text-white truncate">{a.email}</p>
                      <input
                        defaultValue={a.label}
                        onBlur={(e) => { if (e.target.value.trim() !== a.label) patchAccount(a._id, { label: e.target.value }); }}
                        className="mt-1 bg-transparent border-b border-white/10 focus:border-purple-500 outline-none text-xs text-gray-400 w-full max-w-[220px]"
                        placeholder="Label"
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => patchAccount(a._id, { isActive: !a.isActive })}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                      >
                        {a.isActive ? 'Disable' : 'Enable'}
                      </button>
                      {deleteArmed === a._id ? (
                        <>
                          <button onClick={() => setDeleteArmed(null)} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-300">Cancel</button>
                          <button onClick={() => deleteAccount(a._id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white">Remove</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteArmed(a._id)} className="text-xs font-medium px-2.5 py-1.5 text-gray-500 hover:text-rose-400 transition">Remove</button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                      <span>Last 24h</span><span>{a.sent24h} / {a.dailyLimit}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${pct > 85 ? 'bg-rose-400' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {a.lastError && <p className="text-[11px] text-rose-400">{a.lastError}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Compose */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-white tracking-tight">Send mail</h3>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className={inputCls}>
              <option value="">Auto (least used)</option>
              {accounts.filter(a => a.isActive).map(a => <option key={a._id} value={a._id}>{a.label || a.email}</option>)}
            </select>
            <input type="email" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} className={inputCls} placeholder="To (user email)" />
          </div>
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputCls} placeholder="Subject" maxLength={200} />
          <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className={`${inputCls} h-32`} placeholder="Message" />
          <div className="flex justify-end">
            <button onClick={send} disabled={sending || !canSend} className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40">
              {sending ? 'Sending…' : 'Send mail'}
            </button>
          </div>
        </div>
      </section>

      {/* Logs */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-white tracking-tight">Recent mails</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-600">Abhi tak koi mail nahi gayi.</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map(l => (
              <div key={l._id} className="flex items-start gap-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.status === 'sent' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">{l.subject}</p>
                  <p className="text-[11px] text-gray-600 truncate">to {l.to} &middot; from {l.accountEmail} &middot; {new Date(l.createdAt).toLocaleString()}</p>
                  {l.error && <p className="text-[11px] text-rose-400">{l.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MailManager;