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

const SendIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; msgs: any[] }[]>((acc, msg) => {
    const d = new Date(msg.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else acc.push({ date: d, msgs: [msg] });
    return acc;
  }, []);

  const av = AVATARS.find(a => a.id === avatarId);

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: 560, borderRadius: 14, border: '1px solid #d1d5db' }}>

      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .msg-in { animation: msgIn 0.18s ease-out forwards; }
        .tg-scroll::-webkit-scrollbar { width: 4px; }
        .tg-scroll::-webkit-scrollbar-track { background: transparent; }
        .tg-scroll::-webkit-scrollbar-thumb { background: #c5ccd6; border-radius: 99px; }
      `}</style>

      {/* ── Header — Telegram style ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ background: '#2b5278' }}>
        {/* Telegram plane icon avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: '#3d8fc5' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">AnimaBing Admin</p>
          <p className="text-[11px]" style={{ color: '#9ecae8' }}>online</p>
        </div>
        {messages.length > 0 && (
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: '#3d8fc5' }}>
            {messages.length}
          </span>
        )}
      </div>

      {/* ── Messages — Telegram light bg ── */}
      <div className="flex-1 overflow-y-auto tg-scroll px-3 py-3 space-y-1" style={{ background: '#c6d9ed' }}>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#2aabee', borderTopColor: 'transparent' }} />
            <p className="text-xs" style={{ color: '#5a7a9a' }}>Loading…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.6)' }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3d8fc5" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#4a6a8a' }}>No messages yet</p>
          </div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Telegram date pill */}
              <div className="flex justify-center my-3">
                <span className="rounded-full px-3 py-1 text-[11px] font-medium shadow-sm" style={{ background: 'rgba(255,255,255,0.65)', color: '#4a6a8a' }}>
                  {group.date}
                </span>
              </div>

              <div className="space-y-1">
                {group.msgs.map((msg, i) => (
                  <div key={i} className={`flex msg-in ${msg.fromAdmin ? 'justify-start' : 'justify-end'}`}>
                    {msg.fromAdmin ? (
                      /* Incoming — white bubble, Telegram left tail */
                      <div className="flex items-end gap-1.5 max-w-[75%]">
                        {/* Telegram bot icon avatar */}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mb-0.5" style={{ background: '#2b5278' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="relative px-3 py-2 text-sm leading-relaxed shadow-sm" style={{ background: '#fff', borderRadius: '0 10px 10px 10px', color: '#000', minWidth: 60 }}>
                            {msg.text}
                            <span style={{ position: 'absolute', top: 0, left: -6, width: 0, height: 0, borderTop: '8px solid #fff', borderLeft: '7px solid transparent' }} />
                          </div>
                          <p className="text-[10px] mt-0.5 ml-1" style={{ color: '#5a7a9a' }}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Outgoing — Telegram blue, right tail */
                      <div className="flex items-end gap-1.5 max-w-[75%] flex-row-reverse">
                        {av ? (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm mb-0.5" style={{ background: av.bg }}>
                            {av.emoji}
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold mb-0.5" style={{ background: '#3d8fc5' }}>
                            {userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="relative px-3 py-2 text-sm leading-relaxed shadow-sm" style={{ background: '#3d8fc5', borderRadius: '10px 0 10px 10px', color: '#fff', minWidth: 60 }}>
                            {msg.text}
                            <span style={{ position: 'absolute', top: 0, right: -6, width: 0, height: 0, borderTop: '8px solid #3d8fc5', borderRight: '7px solid transparent' }} />
                          </div>
                          <p className="text-[10px] mt-0.5 mr-1 text-right" style={{ color: '#4a6a8a' }}>
                            {formatTime(msg.createdAt)}
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

      {/* ── Input — Telegram bottom bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5" style={{ background: '#fff', borderTop: '1px solid #e4e9ef' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Message"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          className="flex-1 text-sm outline-none"
          style={{ background: '#f1f3f5', border: 'none', borderRadius: 22, padding: '9px 16px', color: '#222', caretColor: '#2aabee' }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
          style={{ background: '#2b5278' }}
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
          )}
        </button>
      </div>

    </div>
  );
};

export default MessagesTab;