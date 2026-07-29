 import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

const AVATARS = [
  { id: 1,  emoji: '🦊', bg: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { id: 2,  emoji: '🐉', bg: 'linear-gradient(135deg,#a855f7,#6366f1)' },
  { id: 3,  emoji: '⚡', bg: 'linear-gradient(135deg,#eab308,#f97316)' },
  { id: 4,  emoji: '👻', bg: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { id: 5,  emoji: '🗡️', bg: 'linear-gradient(135deg,#64748b,#334155)' },
  { id: 6,  emoji: '🌙', bg: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { id: 7,  emoji: '🔥', bg: 'linear-gradient(135deg,#ef4444,#f97316)' },
  { id: 8,  emoji: '🦚', bg: 'linear-gradient(135deg,#38bdf8,#06b6d4)' },
  { id: 9,  emoji: '🧌', bg: 'linear-gradient(135deg,#0ea5e9,#3b82f6)' },
  { id: 10, emoji: '🦋', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  { id: 11, emoji: '🎮', bg: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  { id: 12, emoji: '🧙‍♂️', bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
  { id: 13, emoji: '🐺', bg: 'linear-gradient(135deg,#78716c,#57534e)' },
  { id: 14, emoji: '⚖️', bg: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { id: 15, emoji: '💀', bg: 'linear-gradient(135deg,#374151,#111827)' },
  { id: 16, emoji: '🦅', bg: 'linear-gradient(135deg,#0369a1,#1d4ed8)' },
  { id: 17, emoji: '🛸', bg: 'linear-gradient(135deg,#f43f5e,#e11d48)' },
  { id: 18, emoji: '⛈️', bg: 'linear-gradient(135deg,#475569,#1e293b)' },
  { id: 19, emoji: '🐉', bg: 'linear-gradient(135deg,#10b981,#059669)' },
  { id: 20, emoji: '💎', bg: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  { id: 21, emoji: '🌪️', bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  { id: 22, emoji: '🏔️', bg: 'linear-gradient(135deg,#64748b,#475569)' },
  { id: 23, emoji: '🦁', bg: 'linear-gradient(135deg,#d97706,#92400e)' },
  { id: 24, emoji: '🌌', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)' },
  { id: 25, emoji: '🎙️', bg: 'linear-gradient(135deg,#be185d,#9d174d)' },
];

 

// ─── Admin bubble avatar ───────────────────────────────────────────────────────
const AdminAvatar = () => (
  <div style={{
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(99,102,241,0.3)',
  }}>
    <span style={{
      fontFamily: '"Inter", system-ui, sans-serif',
      fontWeight: 800, fontSize: 10, color: '#fff', letterSpacing: '-0.3px',
    }}>AB</span>
  </div>
);

// ─── Sender label badge (Main Admin vs Sub-Admin) ──────────────────────────
const SenderBadge: React.FC<{ senderRole?: string; senderName?: string }> = ({ senderRole, senderName }) => {
  const isSubAdmin = senderRole === 'subadmin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.2px',
      color: isSubAdmin ? '#7c3aed' : '#4f46e5',
      background: isSubAdmin ? 'rgba(124,58,237,0.1)' : 'rgba(79,70,229,0.1)',
      borderRadius: 6, padding: '1.5px 6px', marginBottom: 3,
    }}>
      {isSubAdmin ? `🎙️ ${senderName || 'Sub-Admin'}` : `🛡️ ${senderName || 'Main Admin'}`}
    </span>
  );
};

const MessagesTab: React.FC<{
  token: string;
  onRead: () => void;
  onToast: any;
  userName: string;
  avatarId: number | null;
}> = ({ token, onRead, onToast, userName, avatarId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // ✅ NEW refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      onRead();
    } catch {
      onToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  // ✅ UPDATED scroll effect
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Send failed', 'error'); return; }
      setText('');
      loadMessages();
      inputRef.current?.focus();
    } catch {
      onToast('Network error', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const groupedMessages = messages.reduce<{ date: string; msgs: any[] }[]>((acc, msg) => {
    const d = new Date(msg.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else acc.push({ date: d, msgs: [msg] });
    return acc;
  }, []);

  const av = AVATARS.find(a => a.id === avatarId);

  return (
    <div
      className="flex flex-col overflow-hidden w-full"
      style={{ height: 560, borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
    >
      <style>{`
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .msg-in { animation: msgIn 0.2s ease-out forwards; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .chat-scroll::-webkit-scrollbar { width: 3px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(100,120,160,0.25); border-radius: 99px; }

        .send-btn:not(:disabled):hover { filter: brightness(1.1); transform: scale(1.06); }
        .send-btn { transition: filter 0.15s, transform 0.15s, background 0.2s, box-shadow 0.2s; }
        .msg-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .msg-input { transition: border-color 0.15s, box-shadow 0.15s; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 60%,#16213e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2, letterSpacing: '-0.2px', margin: 0 }}>
            ⚖️ AnimaBing
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '2px 0 0' }}>
          </p>
        </div>
      </div>

      {/* ── Messages (container with ref) ── */}
      <div
        className="chat-scroll"
        ref={chatContainerRef}   // ✅ NEW ref attached
        style={{
          flex: 1, overflowY: 'auto',
          backgroundColor: '#eef2f7',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.06) 1px, transparent 0)',
          backgroundSize: '20px 20px',
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2.5px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#7a8fa6', fontSize: 12, margin: 0 }}>Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p style={{ color: '#4a5568', fontSize: 13, fontWeight: 600, margin: 0 }}>No messages yet</p>
            <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>Send a message to get started</p>
          </div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 8px' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
                  borderRadius: 99, padding: '3px 12px',
                  fontSize: 11, fontWeight: 500, color: '#64748b',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {group.date}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.msgs.map((msg, i) => (
                  <div key={i} className="msg-in" style={{ display: 'flex', justifyContent: msg.fromAdmin ? 'flex-start' : 'flex-end' }}>
                    {msg.fromAdmin ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '75%' }}>
                        <AdminAvatar />
                        <div>
                          <div style={{ marginLeft: 2 }}>
                            <SenderBadge senderRole={msg.senderRole} senderName={msg.senderName} />
                          </div>
                          <div style={{
                            background: '#fff',
                            borderRadius: '3px 14px 14px 14px',
                            padding: '8px 12px',
                            fontSize: 13.5, lineHeight: 1.45, color: '#1e293b',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            wordBreak: 'break-word',
                          }}>
                            {msg.text}
                          </div>
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0 3px' }}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '75%', flexDirection: 'row-reverse' }}>
                        {av ? (
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                            {av.emoji}
                          </div>
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{
                            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                            borderRadius: '14px 3px 14px 14px',
                            padding: '8px 12px',
                            fontSize: 13.5, lineHeight: 1.45, color: '#fff',
                            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                            wordBreak: 'break-word',
                          }}>
                            {msg.text}
                          </div>
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 3px 0 0', textAlign: 'right' }}>
                            {formatTime(msg.createdAt)}
                            <span style={{ marginLeft: 3, color: '#6366f1', fontWeight: 700 }}>✓✓</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        background: '#fff', borderTop: '1px solid #e2e8f0',
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          className="msg-input"
          style={{
            flex: 1, background: '#f8fafc',
            border: '1.5px solid #e2e8f0', borderRadius: 24,
            padding: '9px 16px', fontSize: 13.5, color: '#1e293b',
            outline: 'none', caretColor: '#6366f1',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="send-btn"
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            background: text.trim() && !sending ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: text.trim() && !sending ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
          }}
        >
          {sending ? (
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={text.trim() ? '#fff' : '#94a3b8'}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default MessagesTab;