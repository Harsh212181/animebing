 // src/components/admin/ShortUsersManager.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Spinner from '../Spinner';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

// ── Avatar list (same as UserDashboard) ──────────────────────
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

/* ─────────────────────────────────────────── types */
interface ShortUser {
  _id: string;
  username: string;
  realName: string;
  password?: string;
  ratePerThousand: number;
  isActive: boolean;
  canCreateLinks: boolean;
  totalClicks: number;
  totalEarnings: number;
  unpaidEarnings: number;
  paidEarnings: number;
  gmailLinked?: string;
  avatarId?: number | null;
  createdByAdminId?: string;
  createdByAdminUsername?: string;
  profile?: {
    mobile?: string;
    gmail?: string;
    upiId?: string;
    upiPhone?: string;
    age?: number;
    gender?: string;
  };
  createdAt: string;
}

interface Message {
  _id: string;
  text: string;
  fromAdmin: boolean;
  createdAt: string;
  senderRole?: string;
  senderName?: string;
}

type PanelAction = 'pay' | 'link' | 'messages' | 'profile' | 'activity';
type SortKey = 'realName' | 'totalClicks' | 'totalEarnings' | 'unpaidEarnings' | 'ratePerThousand';
type SortDir = 'asc' | 'desc';

// ✅ AdminSenderBadge component (unchanged)
const AdminSenderBadge: React.FC<{ senderRole?: string; senderName?: string }> = ({ senderRole, senderName }) => {
  const isSubAdmin = senderRole === 'subadmin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.2px',
      color: isSubAdmin ? 'var(--accent)' : 'var(--blue)',
      background: isSubAdmin ? 'var(--accent-dim)' : 'var(--blue-dim)',
      border: `1px solid ${isSubAdmin ? 'var(--accent-border)' : 'var(--blue-border)'}`,
      borderRadius: 6, padding: '1.5px 6px', marginBottom: 3,
    }}>
      {isSubAdmin ? `🎙️ ${senderName || 'Sub-Admin'}` : `🛡️ ${senderName || 'Main Admin'}`}
    </span>
  );
};

// Helper: render user avatar (with unread badge)
const renderUserAvatar = (user: ShortUser, size = 28, unreadCount = 0) => {
  const av = AVATARS.find(a => a.id === user.avatarId);
  const hasUnread = unreadCount > 0;
  const badge = hasUnread ? (
    <span style={{
      position: 'absolute', top: -3, right: -3,
      width: size * 0.4, height: size * 0.4, minWidth: 14, minHeight: 14,
      background: '#f87171', borderRadius: '50%',
      border: '1px solid #0a0a0c',
      fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 'bold', lineHeight: 1,
    }}>
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  ) : null;

  if (av) {
    return (
      <div style={{
        width: size, height: size,
        background: av.bg,
        borderRadius: size * 0.28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.48, flexShrink: 0, position: 'relative'
      }}>
        {av.emoji}
        {badge}
      </div>
    );
  }
  return (
    <div className="sum-user-avatar" style={{ width: size, height: size, fontSize: size * 0.4, marginRight: 8, position: 'relative' }}>
      {user.realName.charAt(0).toUpperCase()}
      {badge}
    </div>
  );
};

/* ─────────────────────────────────────────── css (unchanged) ─── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css');

:root {
  --bg0: #0a0a0c;
  --bg1: #111114;
  --bg2: #18181d;
  --bg3: #1f1f26;
  --border: rgba(255,255,255,0.065);
  --border2: rgba(255,255,255,0.11);
  --t1: #f0f0f2;
  --t2: #9191a0;
  --t3: #50505e;
  --accent: #7c6af7;
  --accent-dim: rgba(124,106,247,0.14);
  --accent-border: rgba(124,106,247,0.35);
  --green: #34d399;
  --green-dim: rgba(52,211,153,0.12);
  --green-border: rgba(52,211,153,0.25);
  --red: #f87171;
  --red-dim: rgba(248,113,113,0.10);
  --amber: #fbbf24;
  --amber-dim: rgba(251,191,36,0.12);
  --blue: #60a5fa;
  --blue-dim: rgba(96,165,250,0.10);
  --teal: #2dd4bf;
  --teal-dim: rgba(45,212,191,0.10);
  --radius: 10px;
  --font: 'DM Sans', system-ui, sans-serif;
  --mono: 'DM Mono', 'SF Mono', monospace;
}

.sum * { box-sizing: border-box; margin: 0; padding: 0; }
.sum { font-family: var(--font); font-size: 13px; color: var(--t1); }

/* ── stats bar ── */
.sum-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.sum-stat-card {
  background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  transition: border-color 0.15s;
}
.sum-stat-card:hover { border-color: var(--border2); }
.sum-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); }
.sum-stat-value { font-family: var(--mono); font-size: 20px; font-weight: 500; color: var(--t1); letter-spacing: -0.5px; }
.sum-stat-sub { font-size: 11px; color: var(--t3); margin-top: 2px; }
.sum-stat-accent { color: var(--accent); }
.sum-stat-green  { color: var(--green); }
.sum-stat-red    { color: var(--red); }
.sum-stat-amber  { color: var(--amber); }

/* ── toolbar ── */
.sum-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.sum-toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.sum-search-wrap { position: relative; flex: 1; max-width: 280px; }
.sum-search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 14px; pointer-events: none; }
.sum-search {
  width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 10px 8px 32px; font-size: 13px; font-family: var(--font); color: var(--t1);
  transition: border-color 0.15s, background 0.15s;
}
.sum-search:focus { outline: none; border-color: var(--border2); background: var(--bg3); }
.sum-search::placeholder { color: var(--t3); }
.sum-filter-group { display: flex; gap: 6px; }
.sum-filter-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px;
  font-size: 11px; font-weight: 600; font-family: var(--font);
  border-radius: 8px; border: 1px solid var(--border); background: var(--bg2); color: var(--t2);
  cursor: pointer; transition: all 0.13s; white-space: nowrap;
}
.sum-filter-btn:hover { background: var(--bg3); color: var(--t1); border-color: var(--border2); }
.sum-filter-btn-on { background: var(--accent-dim) !important; color: var(--accent) !important; border-color: var(--accent-border) !important; }
.sum-sort-select {
  background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
  padding: 7px 10px; font-size: 12px; font-family: var(--font); color: var(--t2);
  cursor: pointer; outline: none; transition: border-color 0.15s;
}
.sum-sort-select:focus { border-color: var(--border2); }
.sum-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  font-size: 12px; font-weight: 500; font-family: var(--font); border-radius: 8px;
  border: 1px solid transparent; cursor: pointer; transition: all 0.13s; white-space: nowrap;
}
.sum-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sum-btn-primary { background: var(--accent-dim); color: var(--accent); border-color: var(--accent-border); }
.sum-btn-primary:hover:not(:disabled) { background: rgba(124,106,247,0.22); }
.sum-btn-ghost { background: var(--bg2); color: var(--t2); border-color: var(--border); }
.sum-btn-ghost:hover:not(:disabled) { background: var(--bg3); color: var(--t1); border-color: var(--border2); }
.sum-btn-success { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }
.sum-btn-success:hover:not(:disabled) { background: rgba(52,211,153,0.2); }
.sum-btn-new { background: var(--t1); color: var(--bg0); padding: 8px 16px; font-weight: 600; font-size: 12px; }
.sum-btn-new:hover { opacity: 0.88; }

/* ── create form ── */
.sum-create-panel {
  background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 18px 20px; margin-bottom: 16px; animation: sumSlide 0.18s ease;
}
@keyframes sumSlide { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
.sum-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); margin-bottom: 14px; }
.sum-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 10px; margin-bottom: 14px; }
.sum-field { display: flex; flex-direction: column; gap: 5px; }
.sum-field > span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t3); }
.sum-input {
  width: 100%; background: var(--bg0); border: 1px solid var(--border2); border-radius: 7px;
  padding: 8px 11px; font-size: 13px; font-family: var(--font); color: var(--t1);
  transition: border-color 0.14s, background 0.14s;
}
.sum-input:focus { outline: none; border-color: rgba(124,106,247,0.5); background: #0d0d11; }
.sum-input::placeholder { color: var(--t3); }
.sum-chk-label {
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--t2);
  background: var(--bg0); border: 1px solid var(--border2); border-radius: 7px; padding: 8px 12px;
  cursor: pointer; transition: border-color 0.13s;
}
.sum-chk-label:hover { border-color: var(--border2); color: var(--t1); }
.sum-chk-label input { accent-color: var(--accent); }
.sum-form-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* ── table ── */
.sum-table-shell { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.sum-table-wrap { overflow-x: auto; }
.sum-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sum-table thead tr { background: var(--bg2); border-bottom: 1px solid var(--border); }
.sum-table th {
  padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  user-select: none; cursor: pointer; transition: color 0.13s;
}
.sum-table th:hover { color: var(--t2); }
.sum-table th.sum-th-sorted { color: var(--accent); }
.sum-th-sort-icon { margin-left: 4px; opacity: 0.6; font-size: 10px; }
.sum-table tbody tr.sum-data-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
.sum-table tbody tr.sum-data-row:last-child { border-bottom: none; }
.sum-table tbody tr.sum-data-row:hover { background: rgba(255,255,255,0.02); }
.sum-table tbody tr.sum-data-row.sum-row-open { background: var(--accent-dim); border-bottom: none; }
.sum-table td { padding: 12px 14px; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* col widths */
.col-user   { width: 17%; }
.col-rate   { width: 8%; }
.col-clicks { width: 9%; }
.col-earned { width: 10%; }
.col-pending{ width: 10%; }
.col-status { width: 9%; }
.col-gmail  { width: 14%; }
.col-links  { width: 8%; }
.col-actions{ width: 15%; }

/* ── cell atoms ── */
.sum-user-name   { font-size: 13px; font-weight: 500; color: var(--t1); }
.sum-user-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); margin-top: 2px; }
.sum-mono { font-family: var(--mono); font-size: 12px; }
.sum-rate    { color: var(--amber); }
.sum-earned  { color: var(--green); }
.sum-pending { color: var(--red); }

.sum-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.sum-badge-active   { background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); }
.sum-badge-inactive { background: var(--red-dim); color: var(--red); border: 1px solid rgba(248,113,113,0.18); }
.sum-badge-yes { background: var(--teal-dim); color: var(--teal); }
.sum-badge-no  { background: var(--bg3); color: var(--t3); border: 1px solid var(--border); }
.sum-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; display: inline-block; flex-shrink: 0; }

.sum-gmail-chip {
  font-size: 11px; color: var(--blue); background: var(--blue-dim); border: 1px solid rgba(96,165,250,0.15);
  border-radius: 5px; padding: 2px 8px; font-family: var(--mono);
  max-width: 145px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;
}

/* ── inline edit ── */
.sum-inline-input {
  background: var(--bg0); border: 1px solid var(--border2); border-radius: 6px; padding: 5px 8px;
  font-size: 12px; font-family: var(--font); color: var(--t1); width: 100%;
}
.sum-inline-input:focus { outline: none; border-color: rgba(124,106,247,0.45); }

/* ── action buttons ── */
.sum-act-group { display: flex; align-items: center; gap: 3px; }
.sum-act-sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; flex-shrink: 0; }
.sum-act-btn {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--border); background: transparent; color: var(--t3);
  cursor: pointer; font-size: 14px; transition: all 0.12s;
}
.sum-act-btn:hover { background: var(--bg3); color: var(--t2); border-color: var(--border2); }
.sum-act-btn-on { background: var(--accent-dim) !important; color: var(--accent) !important; border-color: var(--accent-border) !important; }
.sum-act-btn-save   { background: var(--green-dim); color: var(--green); border-color: var(--green-border); font-size: 12px; width: auto; padding: 0 10px; font-weight: 600; }
.sum-act-btn-cancel { font-size: 12px; width: auto; padding: 0 10px; }

/* ── expand panels ── */
.sum-expand-row td { padding: 0 !important; border-bottom: 1px solid var(--border) !important; white-space: normal !important; overflow: visible !important; }
.sum-expand-inner { padding: 20px 22px; background: #0d0d12; border-top: 1px solid var(--border); animation: sumExpand 0.16s ease; }
@keyframes sumExpand { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }

.sum-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.sum-panel-title {
  display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
}
.sum-panel-title-bar { width: 3px; height: 14px; border-radius: 2px; flex-shrink: 0; }
.sum-panel-user { font-family: var(--mono); font-size: 11px; color: var(--t3); background: var(--bg2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 5px; }

/* panel accent colors */
.sum-pt-pay  { color: var(--amber); } .sum-pt-pay  .sum-panel-title-bar { background: var(--amber); }
.sum-pt-link { color: var(--blue);  } .sum-pt-link .sum-panel-title-bar { background: var(--blue); }
.sum-pt-msg  { color: var(--accent);} .sum-pt-msg  .sum-panel-title-bar { background: var(--accent); }
.sum-pt-prof { color: var(--teal);  } .sum-pt-prof .sum-panel-title-bar { background: var(--teal); }

/* pay */
.sum-pay-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.sum-pay-hint { font-size: 11px; color: var(--t3); margin-top: 10px; }
.sum-pay-hint strong { color: var(--red); }
.sum-panel-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }

/* link */
.sum-link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 4px; }

/* ── User avatar in table row ── */
.sum-user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--teal-dim);
  border: 1px solid var(--teal-border);
  color: var(--teal);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  margin-right: 8px;
  position: relative;
}

/* ── messages (WhatsApp style) ── */
.sum-chat-list {
  display: flex; flex-direction: column; gap: 8px; max-height: 280px;
  overflow-y: auto; margin-bottom: 12px; padding: 14px;
  background-color: #0a0a0c;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat; background-size: 60px 60px;
  border: 1px solid var(--border); border-radius: 8px;
}
.sum-chat-list::-webkit-scrollbar { width: 4px; }
.sum-chat-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* Bubbles */
.sum-bubble {
  display: inline-block; max-width: 100%; padding: 10px 14px;
  font-size: 13px; line-height: 1.55; word-break: break-word;
  overflow-wrap: break-word; white-space: normal; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.sum-bubble-admin { background: #ffffff; color: #1e293b; border-radius: 12px 12px 12px 4px; border: 1px solid rgba(0,0,0,0.05); }
.sum-bubble-user  { background: #dcf8c6; color: #1e293b; border-radius: 12px 12px 4px 12px; }
.sum-bubble-time {
  font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: var(--mono);
}

/* Avatar for admin in chat */
.sum-chat-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent-dim); border: 1px solid var(--accent-border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--accent);
}

/* Input row */
.sum-chat-input-row { display: flex; gap: 8px; align-items: center; }
.sum-chat-input {
  flex: 1; background: var(--bg0); border: 1px solid var(--border2); border-radius: 9999px;
  padding: 10px 18px; font-size: 13px; font-family: var(--font); color: var(--t1);
  outline: none; transition: border-color 0.2s;
}
.sum-chat-input:focus { border-color: var(--accent-border); }
.sum-chat-send-btn {
  width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff;
  border: none; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s; font-size: 18px;
}
.sum-chat-send-btn:hover { background: #6a5acd; }
.sum-chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sum-no-msgs { text-align: center; padding: 28px; color: var(--t3); font-size: 12px; }

/* profile */
.sum-profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 8px; }
.sum-profile-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 14px; display: flex; align-items: center; gap: 10px;
}
.sum-profile-icon { width: 30px; height: 30px; border-radius: 7px; background: var(--bg3); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--t3); flex-shrink: 0; }
.sum-profile-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t3); margin-bottom: 3px; }
.sum-profile-val { font-size: 13px; font-weight: 500; color: var(--t1); }
.sum-profile-empty { font-size: 12px; color: var(--t3); font-style: italic; }

/* ── activity panel ── */
.sum-day-filter { display: flex; gap: 6px; margin-bottom: 14px; }
.sum-day-btn {
  padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg2); color: var(--t3); font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all 0.13s; font-family: var(--font);
}
.sum-day-btn:hover { background: var(--bg3); color: var(--t2); }
.sum-day-btn-on { background: var(--accent-dim) !important; color: var(--accent) !important; border-color: var(--accent-border) !important; }

.sum-activity-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
.sum-act-stat { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
.sum-act-stat-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3); font-weight: 700; margin-bottom: 4px; }
.sum-act-stat-val { font-family: var(--mono); font-size: 18px; font-weight: 500; }

.sum-cal-grid { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 18px; }
.sum-cal-day {
  width: 28px; height: 28px; border-radius: 5px; display: flex; align-items: center;
  justify-content: center; font-size: 9px; font-family: var(--mono); font-weight: 600;
  cursor: default; position: relative;
}
.sum-cal-day:hover .sum-cal-tooltip {
  opacity: 1; pointer-events: none;
}
.sum-cal-day-on  { background: var(--green); color: #0a0a0c; }
.sum-cal-day-off { background: var(--bg3); color: var(--t3); border: 1px solid var(--border); }
.sum-cal-tooltip {
  position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%);
  background: var(--bg0); border: 1px solid var(--border2); border-radius: 5px;
  padding: 4px 8px; font-size: 10px; color: var(--t2); white-space: nowrap;
  opacity: 0; transition: opacity 0.15s; z-index: 10; pointer-events: none;
}

.sum-link-stats-table { width: 100%; border-collapse: collapse; }
.sum-link-stats-table th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t3); padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }
.sum-link-stats-table td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.sum-link-stats-table tr:last-child td { border-bottom: none; }
.sum-link-stats-table tr:hover td { background: rgba(255,255,255,0.02); }

.sum-bar-wrap { display: flex; align-items: center; gap: 8px; }
.sum-bar-bg { flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; min-width: 60px; }
.sum-bar-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width 0.4s ease; }

/* ── empty / footer ── */
.sum-empty { padding: 48px 24px; text-align: center; color: var(--t3); font-size: 13px; }
.sum-table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-top: 1px solid var(--border); background: var(--bg2);
}
.sum-footer-count { font-size: 11px; color: var(--t3); font-family: var(--mono); }

/* responsive */
@media (max-width: 900px) {
  .sum-stats { grid-template-columns: repeat(2, 1fr); }
  .col-gmail { display: none; }
}
@media (max-width: 640px) {
  .sum-stats { grid-template-columns: 1fr 1fr; }
  .col-earned { display: none; }
  .sum-toolbar { flex-direction: column; align-items: stretch; }
}
`;

/* ═══════════════════════════════════════════ component */
interface ShortUsersManagerProps {
  token?: string;
  subAdminMode?: boolean;
}

const ShortUsersManager: React.FC<ShortUsersManagerProps> = ({ token: propToken, subAdminMode = false }) => {
  const [users, setUsers]         = useState<ShortUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<Partial<ShortUser>>({});

  const [expandedRow, setExpandedRow]       = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<PanelAction | null>(null);

  /* search / filter / sort */
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterLinks, setFilterLinks]   = useState<'all' | 'yes' | 'no'>('all');
  const [filterCreator, setFilterCreator] = useState<'all' | 'admin' | 'subadmin'>('all');
  const [sortKey, setSortKey]     = useState<SortKey>('realName');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');

  /* pay */
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote]     = useState('');
  const [payLoading, setPayLoading] = useState(false);

  /* link */
  const [linkCode, setLinkCode]   = useState('');
  const [linkUrl, setLinkUrl]     = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  /* messages */
  const [messages, setMessages]               = useState<Message[]>([]);
  const [newMessage, setNewMessage]           = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendLoading, setSendLoading]         = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null); // ✅ ref for scroll container

  /* create */
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', realName: '', ratePerThousand: 10, canCreateLinks: false });
  const [creating, setCreating] = useState(false);

  // activity
  const [activityData, setActivityData]   = useState<any>(null)
  const [activityDays, setActivityDays]   = useState<7 | 15 | 30>(30)
  const [activityLoading, setActivityLoading] = useState(false)

  // per-user unread message counts
  const [userUnreadCounts, setUserUnreadCounts] = useState<Record<string, number>>({});

  const token       = propToken || localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  /* ── data ── */
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/short-users/admin/users`, authHeaders());
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load users');
    } finally { setLoading(false); }
  };

  // fetch per‑user unread counts
  const fetchUserUnreadCounts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/short-users/admin/messages/unread-per-user`, authHeaders());
      const map: Record<string, number> = {};
      (Array.isArray(res.data) ? res.data : []).forEach((item: any) => {
        map[item.userId] = item.unreadCount;
      });
      setUserUnreadCounts(map);
    } catch {
      // endpoint failure — silently ignore, red dots just won't show
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUserUnreadCounts();
  }, []);

  // periodic refresh of unread counts
  useEffect(() => {
    const interval = setInterval(fetchUserUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── derived: filtered + sorted ── */
  const processed = useMemo(() => {
    let out = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(u =>
        u.realName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.gmailLinked || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'active')   out = out.filter(u => u.isActive);
    if (filterStatus === 'inactive') out = out.filter(u => !u.isActive);
    if (filterLinks  === 'yes') out = out.filter(u => u.canCreateLinks);
    if (filterLinks  === 'no')  out = out.filter(u => !u.canCreateLinks);
    if (filterCreator === 'admin') {
      out = out.filter(u => !u.createdByAdminId || u.createdByAdminId === 'admin');
    }
    if (filterCreator === 'subadmin') {
      out = out.filter(u => u.createdByAdminId && u.createdByAdminId !== 'admin');
    }

    // 👇 SORT: unread-message users always float to the top
    out.sort((a, b) => {
      const unreadA = userUnreadCounts[a._id] || 0;
      const unreadB = userUnreadCounts[b._id] || 0;
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;
      if (unreadA > 0 && unreadB > 0 && unreadA !== unreadB) {
        return unreadB - unreadA;   // zyada unread wala pehle
      }

      const va = a[sortKey] as any, vb = b[sortKey] as any;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [users, search, filterStatus, filterLinks, filterCreator, sortKey, sortDir, userUnreadCounts]);

  /* ── stats ── */
  const stats = useMemo(() => ({
    total:       users.length,
    active:      users.filter(u => u.isActive).length,
    totalEarned: users.reduce((s, u) => s + u.totalEarnings, 0),
    totalPending:users.reduce((s, u) => s + u.unpaidEarnings, 0),
  }), [users]);

  /* ── sort toggle ── */
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortIcon = (key: SortKey) =>
    sortKey !== key ? '↕' : sortDir === 'asc' ? '↑' : '↓';

  /* ── panel ── */
  const togglePanel = (userId: string, action: PanelAction) => {
    if (expandedRow === userId && expandedAction === action) {
      setExpandedRow(null); setExpandedAction(null)
    } else {
      setExpandedRow(userId); setExpandedAction(action)
      if (action === 'messages') loadMessages(userId)
      if (action === 'pay')      { setPayAmount(''); setPayNote('') }
      if (action === 'link')     { setLinkCode(''); setLinkUrl(''); setLinkLabel('') }
      if (action === 'activity') { setActivityData(null); setActivityDays(30); loadActivity(userId, 30) }
    }
  };
  const closePanel = () => { setExpandedRow(null); setExpandedAction(null); };

  /* ── edit ── */
  const startEdit = (user: ShortUser) => {
    setEditingId(user._id);
    setEditForm({ realName: user.realName, ratePerThousand: user.ratePerThousand, isActive: user.isActive, canCreateLinks: user.canCreateLinks, password: '' });
    closePanel();
  };
  const saveEdit = async (id: string) => {
    try {
      const payload: any = {};
      if (editForm.realName !== undefined)       payload.realName       = editForm.realName;
      if (editForm.ratePerThousand !== undefined) payload.ratePerThousand = editForm.ratePerThousand;
      if (editForm.isActive !== undefined)       payload.isActive       = editForm.isActive;
      if (editForm.canCreateLinks !== undefined) payload.canCreateLinks  = editForm.canCreateLinks;
      if (editForm.password?.trim())             payload.password       = editForm.password;
      await axios.put(`${API_BASE}/short-users/admin/users/${id}`, payload, authHeaders());
      toast.success('User updated');
      setEditingId(null); fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  /* ── create ── */
  const handleCreate = async () => {
    if (!newUser.username || !newUser.password || !newUser.realName) { toast.error('Username, password and real name are required'); return; }
    setCreating(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users`, newUser, authHeaders());
      toast.success('User created');
      setShowCreateForm(false);
      setNewUser({ username: '', password: '', realName: '', ratePerThousand: 10, canCreateLinks: false });
      fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Creation failed'); }
    finally { setCreating(false); }
  };

  /* ── pay ── */
  const handlePayment = async (userId: string) => {
    if (!payAmount || parseFloat(payAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setPayLoading(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${userId}/pay`, { amount: parseFloat(payAmount), note: payNote }, authHeaders());
      toast.success(`Payment of Rs.${payAmount} marked`);
      closePanel(); fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Payment failed'); }
    finally { setPayLoading(false); }
  };

  /* ── link ── */
  const handleCreateLink = async (userId: string) => {
    if (!linkCode || !linkUrl) { toast.error('Code and URL required'); return; }
    if (!/^[a-zA-Z0-9\-_]+$/.test(linkCode)) { toast.error('Code: letters, numbers, - and _ only'); return; }
    setLinkLoading(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${userId}/create-link`, { code: linkCode, url: linkUrl, label: linkLabel }, authHeaders());
      toast.success('Link created');
      closePanel(); fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Link creation failed'); }
    finally { setLinkLoading(false); }
  };

  /* ── messages ── */
  const loadMessages = async (userId: string) => {
    setMessagesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/short-users/admin/messages/${userId}`, authHeaders());
      setMessages(res.data);
      // ✅ Scroll is now handled by the useEffect below – no manual scroll here
      setUserUnreadCounts(prev => ({ ...prev, [userId]: 0 }));
      fetchUserUnreadCounts();
    } catch { toast.error('Failed to load messages'); }
    finally { setMessagesLoading(false); }
  };

  // ✅ Auto‑scroll to bottom whenever messages update (and panel is open)
  useEffect(() => {
    if (chatListRef.current && expandedAction === 'messages') {
      requestAnimationFrame(() => {
        if (chatListRef.current) {
          chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
        }
      });
    }
  }, [messages, expandedAction]);

  const sendMessage = async (userId: string) => {
    if (!newMessage.trim()) return;
    setSendLoading(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/messages/${userId}`, { text: newMessage }, authHeaders());
      setNewMessage(''); loadMessages(userId);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Send failed'); }
    finally { setSendLoading(false); }
  };

  /* ── activity ── */
  const loadActivity = async (userId: string, days: 7 | 15 | 30 = 30) => {
    setActivityLoading(true)
    try {
      const res = await axios.get(
        `${API_BASE}/short-users/admin/users/${userId}/activity?days=${days}`,
        authHeaders()
      )
      setActivityData(res.data)
    } catch { toast.error('Failed to load activity') }
    finally { setActivityLoading(false) }
  }

  /* ── loading ── */
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:12 }}>
      <Spinner />
      <p style={{ color:'#50505e', fontSize:13, fontFamily:'DM Mono, monospace' }}>Loading users...</p>
    </div>
  );

  /* ── render ── */
  return (
    <>
      <style>{css}</style>
      <div className="sum">

        {/* Stats bar */}
        <div className="sum-stats">
          <div className="sum-stat-card">
            <div className="sum-stat-label">Total Users</div>
            <div className="sum-stat-value sum-stat-accent">{stats.total}</div>
            <div className="sum-stat-sub">{stats.active} active</div>
          </div>
          <div className="sum-stat-card">
            <div className="sum-stat-label">Active / Inactive</div>
            <div className="sum-stat-value sum-stat-green">{stats.active}<span style={{ fontSize:13, color:'var(--t3)', fontWeight:400 }}> / {stats.total - stats.active}</span></div>
            <div className="sum-stat-sub">{stats.total > 0 ? Math.round(stats.active / stats.total * 100) : 0}% active rate</div>
          </div>
          <div className="sum-stat-card">
            <div className="sum-stat-label">Total Earned</div>
            <div className="sum-stat-value sum-stat-green">Rs.{stats.totalEarned.toFixed(0)}</div>
            <div className="sum-stat-sub">Across all users</div>
          </div>
          <div className="sum-stat-card">
            <div className="sum-stat-label">Total Pending</div>
            <div className="sum-stat-value sum-stat-red">Rs.{stats.totalPending.toFixed(0)}</div>
            <div className="sum-stat-sub">Awaiting payout</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sum-toolbar">
          <div className="sum-toolbar-left">
            <div className="sum-search-wrap">
              <i className="ti ti-search" />
              <input className="sum-search" type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="sum-filter-group">
              <button className={`sum-filter-btn${filterStatus === 'active' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterStatus(v => v === 'active' ? 'all' : 'active')}><i className="ti ti-circle-check" style={{ fontSize:12 }} /> Active</button>
              <button className={`sum-filter-btn${filterStatus === 'inactive' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterStatus(v => v === 'inactive' ? 'all' : 'inactive')}><i className="ti ti-circle-x" style={{ fontSize:12 }} /> Inactive</button>
              <button className={`sum-filter-btn${filterLinks === 'yes' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterLinks(v => v === 'yes' ? 'all' : 'yes')}><i className="ti ti-link" style={{ fontSize:12 }} /> Can Link</button>
              {!subAdminMode && (
                <>
                  <button className={`sum-filter-btn${filterCreator === 'all' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterCreator('all')}>All</button>
                  <button className={`sum-filter-btn${filterCreator === 'admin' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterCreator('admin')}><i className="ti ti-crown" style={{ fontSize:12 }} /> Admin</button>
                  <button className={`sum-filter-btn${filterCreator === 'subadmin' ? ' sum-filter-btn-on' : ''}`} onClick={() => setFilterCreator('subadmin')}><i className="ti ti-user" style={{ fontSize:12 }} /> Sub Admin</button>
                </>
              )}
            </div>
            <select className="sum-sort-select" value={`${sortKey}-${sortDir}`} onChange={e => { const [k, d] = e.target.value.split('-') as [SortKey, SortDir]; setSortKey(k); setSortDir(d); }}>
              <option value="realName-asc">Name A-Z</option>
              <option value="realName-desc">Name Z-A</option>
              <option value="totalClicks-desc">Most Clicks</option>
              <option value="totalEarnings-desc">Most Earned</option>
              <option value="unpaidEarnings-desc">Most Pending</option>
              <option value="ratePerThousand-desc">Highest Rate</option>
            </select>
          </div>
          <button className="sum-btn sum-btn-new" onClick={() => setShowCreateForm(v => !v)}>
            <i className="ti ti-plus" style={{ fontSize:13 }} /> New User
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="sum-create-panel">
            <div className="sum-panel-label">Create New User</div>
            <div className="sum-form-grid">
              <div className="sum-field"><span>Username</span><input className="sum-input" type="text" placeholder="e.g. johndoe" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} /></div>
              <div className="sum-field"><span>Password</span><input className="sum-input" type="password" placeholder="Min. 8 characters" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></div>
              <div className="sum-field"><span>Real Name</span><input className="sum-input" type="text" placeholder="Full name" value={newUser.realName} onChange={e => setNewUser({ ...newUser, realName: e.target.value })} /></div>
              <div className="sum-field"><span>Rate per 1,000 (Rs.)</span><input className="sum-input" type="number" value={newUser.ratePerThousand} onChange={e => setNewUser({ ...newUser, ratePerThousand: parseInt(e.target.value) || 0 })} /></div>
              <label className="sum-chk-label"><input type="checkbox" checked={newUser.canCreateLinks} onChange={e => setNewUser({ ...newUser, canCreateLinks: e.target.checked })} /> Can create links</label>
            </div>
            <div className="sum-form-actions">
              <button className="sum-btn sum-btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button className="sum-btn sum-btn-primary" onClick={handleCreate} disabled={creating}><i className="ti ti-check" />{creating ? 'Creating...' : 'Create User'}</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="sum-table-shell">
          <div className="sum-table-wrap">
            {processed.length === 0 ? (
              <div className="sum-empty">{users.length === 0 ? 'No users yet. Create one to get started.' : 'No users match your filters.'}</div>
            ) : (
              <table className="sum-table">
                <thead>
                  <tr>
                    <th className="col-user" onClick={() => toggleSort('realName')}>User <span className="sum-th-sort-icon">{sortIcon('realName')}</span></th>
                    <th className={`col-rate${sortKey === 'ratePerThousand' ? ' sum-th-sorted' : ''}`} onClick={() => toggleSort('ratePerThousand')}>Rate/1k <span className="sum-th-sort-icon">{sortIcon('ratePerThousand')}</span></th>
                    <th className={`col-clicks${sortKey === 'totalClicks' ? ' sum-th-sorted' : ''}`} onClick={() => toggleSort('totalClicks')}>Clicks <span className="sum-th-sort-icon">{sortIcon('totalClicks')}</span></th>
                    <th className={`col-earned${sortKey === 'totalEarnings' ? ' sum-th-sorted' : ''}`} onClick={() => toggleSort('totalEarnings')}>Earned <span className="sum-th-sort-icon">{sortIcon('totalEarnings')}</span></th>
                    <th className={`col-pending${sortKey === 'unpaidEarnings' ? ' sum-th-sorted' : ''}`} onClick={() => toggleSort('unpaidEarnings')}>Pending <span className="sum-th-sort-icon">{sortIcon('unpaidEarnings')}</span></th>
                    <th className="col-status">Status</th>
                    <th className="col-gmail">Gmail</th>
                    <th className="col-links">Links</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map(user => {
                    const isEditing = editingId === user._id;
                    const isOpen    = expandedRow === user._id;
                    return (
                      <React.Fragment key={user._id}>

                        {/* ── data row ── */}
                        <tr className={`sum-data-row${isOpen ? ' sum-row-open' : ''}`}>
                          <td>
                            {isEditing ? (
                              <input className="sum-inline-input" value={editForm.realName || ''} onChange={e => setEditForm({ ...editForm, realName: e.target.value })} />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {renderUserAvatar(user, 24, userUnreadCounts[user._id] || 0)}
                                <div>
                                  <div className="sum-user-name">{user.realName}</div>
                                  <div className="sum-user-handle">@{user.username}</div>
                                  {!subAdminMode && (
                                    <div style={{
                                      fontSize: 10, marginTop: 2, fontFamily: 'var(--mono)',
                                      color: (!user.createdByAdminId || user.createdByAdminId === 'admin') ? 'var(--t3)' : 'var(--accent)'
                                    }}>
                                      {(!user.createdByAdminId || user.createdByAdminId === 'admin')
                                        ? '🏛️Admin'
                                        : `👻${user.createdByAdminUsername || 'Sub-Admin'}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            {isEditing
                              ? <input className="sum-inline-input" type="number" style={{ width: 70 }} value={editForm.ratePerThousand ?? ''} onChange={e => setEditForm({ ...editForm, ratePerThousand: parseInt(e.target.value) || 0 })} />
                              : <span className="sum-mono sum-rate">Rs.{user.ratePerThousand}</span>
                            }
                          </td>
                          <td><span className="sum-mono" style={{ color:'var(--t2)' }}>{user.totalClicks.toLocaleString()}</span></td>
                          <td><span className="sum-mono sum-earned">Rs.{user.totalEarnings.toFixed(2)}</span></td>
                          <td><span className="sum-mono sum-pending">Rs.{user.unpaidEarnings.toFixed(2)}</span></td>
                          <td>
                            {isEditing
                              ? <label className="sum-chk-label" style={{ display:'inline-flex', padding:'4px 9px' }}><input type="checkbox" checked={editForm.isActive ?? false} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active</label>
                              : <span className={user.isActive ? 'sum-badge sum-badge-active' : 'sum-badge sum-badge-inactive'}><span className="sum-dot" />{user.isActive ? 'Active' : 'Inactive'}</span>
                            }
                          </td>
                          <td>
                            {user.gmailLinked ? <span className="sum-gmail-chip" title={user.gmailLinked}>{user.gmailLinked}</span> : <span style={{ color:'var(--t3)' }}>—</span>}
                          </td>
                          <td>
                            {isEditing
                              ? <label className="sum-chk-label" style={{ display:'inline-flex', padding:'4px 9px' }}><input type="checkbox" checked={editForm.canCreateLinks ?? false} onChange={e => setEditForm({ ...editForm, canCreateLinks: e.target.checked })} /> Yes</label>
                              : <span className={user.canCreateLinks ? 'sum-badge sum-badge-yes' : 'sum-badge sum-badge-no'}><i className={user.canCreateLinks ? 'ti ti-check' : 'ti ti-x'} style={{ fontSize:11 }} />{user.canCreateLinks ? 'Yes' : 'No'}</span>
                            }
                          </td>
                          <td>
                            <div className="sum-act-group">
                              {isEditing ? (
                                <>
                                  <button className="sum-act-btn sum-act-btn-save" onClick={() => saveEdit(user._id)} title="Save"><i className="ti ti-check" /></button>
                                  <button className="sum-act-btn sum-act-btn-cancel" onClick={() => setEditingId(null)} title="Cancel"><i className="ti ti-x" /></button>
                                </>
                              ) : (
                                <>
                                  <button className="sum-act-btn" onClick={() => startEdit(user)} title="Edit"><i className="ti ti-edit" /></button>
                                  <span className="sum-act-sep" />
                                  <button className={`sum-act-btn${isOpen && expandedAction === 'pay' ? ' sum-act-btn-on' : ''}`} onClick={() => togglePanel(user._id, 'pay')} title="Mark payment"><i className="ti ti-currency-rupee" /></button>
                                  <button className={`sum-act-btn${isOpen && expandedAction === 'link' ? ' sum-act-btn-on' : ''}`} onClick={() => togglePanel(user._id, 'link')} title="Create link"><i className="ti ti-link" /></button>
                                  <button className={`sum-act-btn${isOpen && expandedAction === 'messages' ? ' sum-act-btn-on' : ''}`} onClick={() => togglePanel(user._id, 'messages')} title="Messages" style={{ position: 'relative' }}>
                                    <i className="ti ti-message-circle" />
                                    {(userUnreadCounts[user._id] || 0) > 0 && (
                                      <span style={{
                                        position: 'absolute', top: 2, right: 2,
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: 'var(--red)',
                                      }} />
                                    )}
                                  </button>
                                  <button className={`sum-act-btn${isOpen && expandedAction === 'profile' ? ' sum-act-btn-on' : ''}`} onClick={() => togglePanel(user._id, 'profile')} title="Profile"><i className="ti ti-user" /></button>
                                  <button
                                    className={`sum-act-btn${isOpen && expandedAction === 'activity' ? ' sum-act-btn-on' : ''}`}
                                    onClick={() => togglePanel(user._id, 'activity')}
                                    title="Activity & Links"
                                  >
                                    <i className="ti ti-activity" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── Pay panel ── */}
                        {isOpen && expandedAction === 'pay' && (
                          <tr className="sum-expand-row">
                            <td colSpan={9}>
                              <div className="sum-expand-inner">
                                <div className="sum-panel-header">
                                  <div className="sum-panel-title sum-pt-pay"><span className="sum-panel-title-bar" />Mark Payment</div>
                                  <span className="sum-panel-user">{user.realName}</span>
                                </div>
                                <div className="sum-pay-row">
                                  <div className="sum-field"><span>Amount (Rs.)</span><input className="sum-input" type="number" step="0.01" placeholder="0.00" style={{ width:140 }} value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
                                  <div className="sum-field" style={{ flex:1, minWidth:200 }}><span>Note (optional)</span><input className="sum-input" type="text" placeholder="Payment reference..." value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
                                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                                    <button className="sum-btn sum-btn-success" onClick={() => handlePayment(user._id)} disabled={payLoading}><i className="ti ti-check" />{payLoading ? 'Processing...' : 'Confirm Payment'}</button>
                                    <button className="sum-btn sum-btn-ghost" onClick={closePanel}>Cancel</button>
                                  </div>
                                </div>
                                <p className="sum-pay-hint">Unpaid: <strong>Rs.{user.unpaidEarnings.toFixed(2)}</strong> &bull; Total earned: Rs.{user.totalEarnings.toFixed(2)}</p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Link panel ── */}
                        {isOpen && expandedAction === 'link' && (
                          <tr className="sum-expand-row">
                            <td colSpan={9}>
                              <div className="sum-expand-inner">
                                <div className="sum-panel-header">
                                  <div className="sum-panel-title sum-pt-link"><span className="sum-panel-title-bar" />Create Link</div>
                                  <span className="sum-panel-user">{user.realName}</span>
                                </div>
                                <div className="sum-link-grid">
                                  <div className="sum-field"><span>Short Code</span><input className="sum-input" type="text" placeholder="e.g. myanime" value={linkCode} onChange={e => setLinkCode(e.target.value)} /></div>
                                  <div className="sum-field"><span>Destination URL</span><input className="sum-input" type="url" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} /></div>
                                  <div className="sum-field"><span>Label (optional)</span><input className="sum-input" type="text" placeholder="Display name" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} /></div>
                                </div>
                                <div className="sum-panel-footer">
                                  <button className="sum-btn sum-btn-ghost" onClick={closePanel}>Cancel</button>
                                  <button className="sum-btn sum-btn-primary" onClick={() => handleCreateLink(user._id)} disabled={linkLoading}><i className="ti ti-link" />{linkLoading ? 'Creating...' : 'Create Link'}</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Messages panel (with auto‑scroll fix) ── */}
                        {isOpen && expandedAction === 'messages' && (
                          <tr className="sum-expand-row">
                            <td colSpan={9}>
                              <div className="sum-expand-inner">
                                <div className="sum-panel-header">
                                  <div className="sum-panel-title sum-pt-msg"><span className="sum-panel-title-bar" />Messages</div>
                                  <span className="sum-panel-user">{user.realName}</span>
                                </div>

                                <div className="sum-chat-list" ref={chatListRef}>
                                  {messagesLoading ? (
                                    <div style={{ display:'flex', justifyContent:'center', padding:20 }}><Spinner /></div>
                                  ) : messages.length === 0 ? (
                                    <div className="sum-no-msgs">No messages yet</div>
                                  ) : (
                                    messages.map(msg => (
                                      <div key={msg._id} style={{ display:'flex', justifyContent: msg.fromAdmin ? 'flex-start' : 'flex-end', alignItems:'flex-end' }}>
                                        {msg.fromAdmin ? (
                                          <div style={{ display:'flex', alignItems:'flex-end', gap:8, maxWidth:'75%' }}>
                                            <div className="sum-chat-avatar">A</div>
                                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
                                              <AdminSenderBadge senderRole={msg.senderRole} senderName={msg.senderName} />
                                              <div className="sum-bubble sum-bubble-admin">{msg.text}</div>
                                              <div className="sum-bubble-time">
                                                {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
                                                {' '}· Admin
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          /* User message (right) with avatar */
                                          <div style={{ display:'flex', alignItems:'flex-end', gap:8, maxWidth:'75%', flexDirection:'row-reverse' }}>
                                            {renderUserAvatar(user, 28)}   {/* ← user avatar */}
                                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
                                              <div className="sum-bubble sum-bubble-user">{msg.text}</div>
                                              <div className="sum-bubble-time">
                                                {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                  <div ref={chatEndRef} />
                                </div>

                                <div className="sum-chat-input-row">
                                  <input className="sum-chat-input" type="text" placeholder="Write a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(user._id)} />
                                  <button className="sum-chat-send-btn" onClick={() => sendMessage(user._id)} disabled={sendLoading || !newMessage.trim()}><i className="ti ti-send" /></button>
                                  <button className="sum-btn sum-btn-ghost" onClick={closePanel}>Close</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Profile panel ── */}
                        {isOpen && expandedAction === 'profile' && (
                          <tr className="sum-expand-row">
                            <td colSpan={9}>
                              <div className="sum-expand-inner">
                                <div className="sum-panel-header">
                                  <div className="sum-panel-title sum-pt-prof"><span className="sum-panel-title-bar" />Profile Details</div>
                                  <span className="sum-panel-user">{user.realName}</span>
                                </div>
                                <div className="sum-profile-grid">
                                  {[
                                    { icon:'ti-device-mobile', label:'Mobile', value: user.profile?.mobile },
                                    { icon:'ti-mail', label:'Gmail', value: user.profile?.gmail },
                                    { icon:'ti-credit-card', label:'UPI ID', value: user.profile?.upiId },
                                    { icon:'ti-phone', label:'UPI Phone', value: user.profile?.upiPhone },
                                    { icon:'ti-calendar', label:'Age', value: user.profile?.age?.toString() },
                                    { icon:'ti-users', label:'Gender', value: user.profile?.gender },
                                  ].map(({ icon, label, value }) => (
                                    <div className="sum-profile-card" key={label}>
                                      <div className="sum-profile-icon"><i className={`ti ${icon}`} /></div>
                                      <div>
                                        <div className="sum-profile-lbl">{label}</div>
                                        {value ? <div className="sum-profile-val">{value}</div> : <div className="sum-profile-empty">Not provided</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="sum-panel-footer"><button className="sum-btn sum-btn-ghost" onClick={closePanel}>Close</button></div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Activity panel ── */}
                        {isOpen && expandedAction === 'activity' && (
                          <tr className="sum-expand-row">
                            <td colSpan={9}>
                              <div className="sum-expand-inner">
                                <div className="sum-panel-header">
                                  <div className="sum-panel-title sum-pt-prof">
                                    <span className="sum-panel-title-bar" style={{ background: 'var(--green)' }} />
                                    <span style={{ color: 'var(--green)' }}>Activity & Links</span>
                                  </div>
                                  <span className="sum-panel-user">{user.realName}</span>
                                </div>

                                {/* Day filter */}
                                <div className="sum-day-filter">
                                  {([7, 15, 30] as const).map(d => (
                                    <button
                                      key={d}
                                      className={`sum-day-btn${activityDays === d ? ' sum-day-btn-on' : ''}`}
                                      onClick={() => { setActivityDays(d); loadActivity(user._id, d) }}
                                    >
                                      {d} Days
                                    </button>
                                  ))}
                                </div>

                                {activityLoading ? (
                                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
                                ) : activityData ? (
                                  <>
                                    {/* Stats row */}
                                    <div className="sum-activity-stats">
                                      <div className="sum-act-stat">
                                        <div className="sum-act-stat-lbl">Active Days</div>
                                        <div className="sum-act-stat-val" style={{ color: 'var(--green)' }}>{activityData.activeDays}</div>
                                      </div>
                                      <div className="sum-act-stat">
                                        <div className="sum-act-stat-lbl">Absent Days</div>
                                        <div className="sum-act-stat-val" style={{ color: 'var(--red)' }}>{activityData.absentDays}</div>
                                      </div>
                                      <div className="sum-act-stat">
                                        <div className="sum-act-stat-lbl">Login Rate</div>
                                        <div className="sum-act-stat-val" style={{ color: 'var(--amber)' }}>{activityData.loginRate}%</div>
                                      </div>
                                      <div className="sum-act-stat">
                                        <div className="sum-act-stat-lbl">Last Login</div>
                                        <div className="sum-act-stat-val" style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>
                                          {activityData.lastLogin
                                            ? new Date(activityData.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                            : '—'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Calendar heatmap */}
                                    <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--t3)' }}>
                                      Login Calendar
                                    </div>
                                    <div className="sum-cal-grid">
                                      {activityData.calendar.map((day: any) => (
                                        <div
                                          key={day.date}
                                          className={`sum-cal-day ${day.loggedIn ? 'sum-cal-day-on' : 'sum-cal-day-off'}`}
                                        >
                                          {new Date(day.date).getDate()}
                                          <span className="sum-cal-tooltip">
                                            {day.label} {day.loggedIn ? '✅ Logged in' : '❌ Absent'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Link stats */}
                                    {activityData.linkStats.length > 0 && (
                                      <>
                                        <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--t3)' }}>
                                          Links Performance
                                        </div>
                                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                          <table className="sum-link-stats-table">
                                            <thead>
                                              <tr>
                                                <th>Label / Code</th>
                                                <th>Total Clicks</th>
                                                <th>{activityDays}d Clicks</th>
                                                <th>Progress</th>
                                                <th>Last Click</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(() => {
                                                const maxClicks = Math.max(...activityData.linkStats.map((l: any) => l.totalClicks), 1)
                                                return activityData.linkStats.map((link: any) => (
                                                  <tr key={link._id}>
                                                    <td>
                                                      <div style={{ fontWeight: 500, color: 'var(--t1)' }}>{link.label}</div>
                                                      <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                                                        go.animebing.in/{link.code}
                                                      </div>
                                                    </td>
                                                    <td>
                                                      <span className="sum-mono" style={{ color: 'var(--t2)' }}>
                                                        {link.totalClicks.toLocaleString()}
                                                      </span>
                                                    </td>
                                                    <td>
                                                      <span className="sum-mono" style={{ color: 'var(--accent)' }}>
                                                        {link.clicksInRange.toLocaleString()}
                                                      </span>
                                                    </td>
                                                    <td style={{ minWidth: 120 }}>
                                                      <div className="sum-bar-wrap">
                                                        <div className="sum-bar-bg">
                                                          <div
                                                            className="sum-bar-fill"
                                                            style={{ width: `${Math.round((link.totalClicks / maxClicks) * 100)}%` }}
                                                          />
                                                        </div>
                                                        <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)', minWidth: 30 }}>
                                                          {Math.round((link.totalClicks / maxClicks) * 100)}%
                                                        </span>
                                                      </div>
                                                    </td>
                                                    <td>
                                                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                                                        {link.lastClicked
                                                          ? new Date(link.lastClicked).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                                          : '—'}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                ))
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    )}

                                    {activityData.linkStats.length === 0 && (
                                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--t3)', fontSize: 12 }}>
                                        No links assigned to this user yet.
                                      </div>
                                    )}
                                  </>
                                ) : null}

                                <div className="sum-panel-footer">
                                  <button className="sum-btn sum-btn-ghost" onClick={closePanel}>Close</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table footer */}
          {processed.length > 0 && (
            <div className="sum-table-footer">
              <span className="sum-footer-count">{processed.length === users.length ? `${users.length} users` : `${processed.length} of ${users.length} users`}</span>
              {(search || filterStatus !== 'all' || filterLinks !== 'all' || filterCreator !== 'all') && (
                <button className="sum-btn sum-btn-ghost" style={{ padding:'5px 12px', fontSize:11 }} onClick={() => { setSearch(''); setFilterStatus('all'); setFilterLinks('all'); setFilterCreator('all'); }}>
                  <i className="ti ti-x" style={{ fontSize:11 }} /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default ShortUsersManager;