 // src/components/admin/ShortenerManager.tsx – UPDATED (no popups for payment/link, inline forms instead)
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Spinner from '../Spinner';
import ClickVerificationSettings from './ClickVerificationSettings';

const SHORTENER_BASE = 'https://go.animebing.in';
const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

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

interface ShortLink {
  _id: string;
  code: string;
  url: string;
  label: string;
  clicks: number;
  userId?: string;
  createdAt: string;
  lastClicked: string | null;
}

interface ShortUser {
  _id: string;
  username: string;
  password: string;
  realName: string;
  ratePerThousand: number;
  isActive: boolean;
  totalClicks: number;
  totalEarnings: number;
  unpaidEarnings: number;
  paidEarnings: number;
  gmailLinked?: string;
  avatarId?: number | null;
  createdBy?: 'admin' | 'self';
  createdByAdminId?: string;
  createdByAdminUsername?: string;
  requireFullCycle?: boolean | null;
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

interface ShortRequest {
  _id: string;
  userId: string;
  username: string;
  realName: string;
  type: 'payment' | 'link';
  status: 'pending' | 'done' | 'rejected';
  amount?: number;
  profile?: any;
  message?: string;
  createdAt: string;
}

interface ShortMessage {
  _id: string;
  userId: string;
  username: string;
  realName: string;
  text: string;
  fromAdmin: boolean;
  readByAdmin: boolean;
  readByUser: boolean;
  createdAt: string;
  senderRole?: string;
  senderName?: string;
}

// ── Helper: render user avatar ──────────────────────────────
const renderUserAvatar = (user: ShortUser, size = 28, unreadCount = 0) => {
  const av = AVATARS.find(a => a.id === user.avatarId);
  const hasUnread = unreadCount > 0;
  const avatarEl = av ? (
    <div style={{
      width: size, height: size,
      background: av.bg,
      borderRadius: size * 0.28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.48, flexShrink: 0,
      position: 'relative',
    }}>
      {av.emoji}
      {hasUnread && (
        <span style={{
          position: 'absolute', top: -3, right: -3,
          width: size * 0.35, height: size * 0.35,
          background: '#f87171', borderRadius: '50%',
          border: '1px solid #0a0a0c',
          fontSize: size * 0.22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 'bold',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  ) : (
    <div className="sm-sidebar-avatar" style={{ width: size, height: size, fontSize: size * 0.4, position: 'relative' }}>
      {user.realName.charAt(0).toUpperCase()}
      {hasUnread && (
        <span style={{
          position: 'absolute', top: -3, right: -3,
          width: size * 0.35, height: size * 0.35,
          background: '#f87171', borderRadius: '50%',
          border: '1px solid #0a0a0c',
          fontSize: size * 0.22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 'bold',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
  return avatarEl;
};

// ✅ AdminSenderBadge component
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

/* ─────────────────────────────────────────── CSS ─────────────────── */
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
  --red-border: rgba(248,113,113,0.20);
  --amber: #fbbf24;
  --amber-dim: rgba(251,191,36,0.12);
  --amber-border: rgba(251,191,36,0.25);
  --blue: #60a5fa;
  --blue-dim: rgba(96,165,250,0.10);
  --blue-border: rgba(96,165,250,0.22);
  --teal: #2dd4bf;
  --teal-dim: rgba(45,212,191,0.10);
  --teal-border: rgba(45,212,191,0.22);
  --radius: 10px;
  --font: 'DM Sans', system-ui, sans-serif;
  --mono: 'DM Mono', 'SF Mono', monospace;
}

.sm * { box-sizing: border-box; }
.sm { font-family: var(--font); font-size: 13px; color: var(--t1); }

/* ── stats bar ── */
.sm-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}
.sm-stat-card {
  background: var(--bg1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
  min-width: 0;
}
.sm-stat-card:hover { border-color: var(--border2); }
.sm-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); }
.sm-stat-value { font-family: var(--mono); font-size: 20px; font-weight: 500; letter-spacing: -0.5px; overflow-wrap: anywhere; }
.sm-stat-sub { font-size: 11px; color: var(--t3); margin-top: 2px; }
.sm-v-accent { color: var(--accent); }
.sm-v-green  { color: var(--green); }
.sm-v-red    { color: var(--red); }
.sm-v-amber  { color: var(--amber); }
.sm-v-teal   { color: var(--teal); }
.sm-v-blue   { color: var(--blue); }

/* ── tabs ── */
.sm-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 5px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.sm-tabs::-webkit-scrollbar { display: none; }
.sm-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  font-size: 12px; font-weight: 500; font-family: var(--font);
  border-radius: 7px; border: none;
  background: transparent; color: var(--t2);
  cursor: pointer; transition: all 0.14s;
  position: relative;
  flex-shrink: 0;
  white-space: nowrap;
}
.sm-tab:hover { color: var(--t1); background: var(--bg3); }
.sm-tab-active { background: var(--bg3) !important; color: var(--t1) !important; }
.sm-tab-active-teal { box-shadow: inset 0 0 0 1px var(--teal-border); color: var(--teal) !important; }
.sm-tab-active-purple { box-shadow: inset 0 0 0 1px var(--accent-border); color: var(--accent) !important; }
.sm-tab-active-amber { box-shadow: inset 0 0 0 1px var(--amber-border); color: var(--amber) !important; }
.sm-tab-active-blue { box-shadow: inset 0 0 0 1px var(--blue-border); color: var(--blue) !important; }
.sm-tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  font-size: 10px; font-weight: 700;
  border-radius: 9px;
  background: var(--red-dim); color: var(--red); border: 1px solid var(--red-border);
}

/* ── toolbar ── */
.sm-toolbar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px; flex-wrap: wrap;
}
.sm-toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; flex-wrap: wrap; }
.sm-search-wrap { position: relative; flex: 1; max-width: 280px; min-width: 160px; }
.sm-search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 14px; pointer-events: none; }
.sm-search {
  width: 100%;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px 8px 32px;
  font-size: 13px; font-family: var(--font); color: var(--t1);
  transition: border-color 0.15s, background 0.15s;
}
.sm-search:focus { outline: none; border-color: var(--border2); background: var(--bg3); }
.sm-search::placeholder { color: var(--t3); }

/* ── buttons ── */
.sm-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  font-size: 12px; font-weight: 500; font-family: var(--font);
  border-radius: 8px; border: 1px solid transparent;
  cursor: pointer; transition: all 0.13s; white-space: nowrap;
}
.sm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sm-btn-primary { background: var(--accent-dim); color: var(--accent); border-color: var(--accent-border); }
.sm-btn-primary:hover:not(:disabled) { background: rgba(124,106,247,0.22); }
.sm-btn-ghost { background: var(--bg2); color: var(--t2); border-color: var(--border); }
.sm-btn-ghost:hover:not(:disabled) { background: var(--bg3); color: var(--t1); border-color: var(--border2); }
.sm-btn-success { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }
.sm-btn-success:hover:not(:disabled) { background: rgba(52,211,153,0.2); }
.sm-btn-danger { background: var(--red-dim); color: var(--red); border-color: var(--red-border); }
.sm-btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.18); }
.sm-btn-teal { background: var(--teal-dim); color: var(--teal); border-color: var(--teal-border); }
.sm-btn-teal:hover:not(:disabled) { background: rgba(45,212,191,0.18); }
.sm-btn-amber { background: var(--amber-dim); color: var(--amber); border-color: var(--amber-border); }
.sm-btn-amber:hover:not(:disabled) { background: rgba(251,191,36,0.2); }
.sm-btn-new { background: var(--t1); color: var(--bg0); padding: 8px 16px; font-weight: 600; font-size: 12px; }
.sm-btn-new:hover { opacity: 0.88; }

/* ── create form ── */
.sm-create-panel {
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
  margin-bottom: 16px; animation: smSlide 0.18s ease;
}
@keyframes smSlide { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
.sm-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); margin-bottom: 14px; }
.sm-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 10px; margin-bottom: 14px; }
.sm-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.sm-field > span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t3); }
.sm-input {
  width: 100%; background: var(--bg0); border: 1px solid var(--border2);
  border-radius: 7px; padding: 8px 11px; font-size: 13px;
  font-family: var(--font); color: var(--t1);
  transition: border-color 0.14s, background 0.14s;
}
.sm-input:focus { outline: none; border-color: rgba(124,106,247,0.5); background: #0d0d11; }
.sm-input::placeholder { color: var(--t3); }
.sm-select {
  width: 100%; background: var(--bg0); border: 1px solid var(--border2);
  border-radius: 7px; padding: 8px 11px; font-size: 13px;
  font-family: var(--font); color: var(--t1);
  cursor: pointer;
}
.sm-select:focus { outline: none; border-color: rgba(124,106,247,0.5); }
.sm-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.sm-preview-url { font-family: var(--mono); font-size: 11px; color: var(--teal); margin-top: 4px; word-break: break-all; }

/* ── table ── */
.sm-table-shell {
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
}
.sm-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.sm-users-wrap { overflow-x: visible; }
.sm-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sm-table thead tr { background: var(--bg2); border-bottom: 1px solid var(--border); }
.sm-table th {
  padding: 10px 14px; text-align: left;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  user-select: none; cursor: pointer; transition: color 0.13s;
}
.sm-table th:hover { color: var(--t2); }
.sm-table tbody tr.sm-data-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
.sm-table tbody tr.sm-data-row:last-child { border-bottom: none; }
.sm-table tbody tr.sm-data-row:hover { background: rgba(255,255,255,0.02); }
.sm-table tbody tr.sm-edit-row { background: rgba(124,106,247,0.05); border-bottom: none; }
.sm-table td { padding: 12px 14px; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── cell atoms ── */
.sm-mono { font-family: var(--mono); font-size: 12px; }
.sm-code-chip {
  font-family: var(--mono); font-size: 11px; color: var(--teal);
  background: var(--teal-dim); border: 1px solid var(--teal-border);
  border-radius: 5px; padding: 2px 8px; display: inline-block;
}
.sm-code-chip-missing {
  font-family: var(--mono); font-size: 11px; color: var(--red);
  background: var(--red-dim); border: 1px solid var(--red-border);
  border-radius: 5px; padding: 2px 8px; display: inline-block;
}
.sm-url-link { font-size: 11px; color: var(--blue); text-decoration: none; }
.sm-url-link:hover { text-decoration: underline; }
.sm-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.sm-badge-active { background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); }
.sm-badge-inactive { background: var(--red-dim); color: var(--red); border: 1px solid var(--red-border); }
.sm-badge-pending { background: var(--amber-dim); color: var(--amber); border: 1px solid var(--amber-border); }
.sm-badge-done { background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); }
.sm-badge-rejected { background: var(--red-dim); color: var(--red); border: 1px solid var(--red-border); }
.sm-badge-payment { background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); }
.sm-badge-link { background: var(--teal-dim); color: var(--teal); border: 1px solid var(--teal-border); }
.sm-badge-admin { background: var(--blue-dim); color: var(--blue); border: 1px solid var(--blue-border); }
.sm-badge-self { background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent-border); }
.sm-badge-subadmin { background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent-border); }
.sm-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; display: inline-block; flex-shrink: 0; }

.sm-clicks-badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 12px;
  font-family: var(--mono); font-size: 11px; font-weight: 500;
}
.sm-clicks-high { background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); }
.sm-clicks-mid  { background: var(--amber-dim); color: var(--amber); border: 1px solid var(--amber-border); }
.sm-clicks-low  { background: var(--bg3); color: var(--t3); border: 1px solid var(--border); }

/* ── inline edit ── */
.sm-inline-input {
  background: var(--bg0); border: 1px solid var(--border2);
  border-radius: 6px; padding: 5px 8px;
  font-size: 12px; font-family: var(--font); color: var(--t1); width: 100%;
}
.sm-inline-input:focus { outline: none; border-color: rgba(124,106,247,0.45); }

/* ── action buttons ── */
.sm-act-group { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.sm-act-sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; flex-shrink: 0; }
.sm-act-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--border);
  background: transparent; color: var(--t3);
  cursor: pointer; font-size: 14px; transition: all 0.12s;
  flex-shrink: 0;
}
.sm-act-btn:hover { background: var(--bg3); color: var(--t2); border-color: var(--border2); }
.sm-act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.sm-act-btn-on { background: var(--accent-dim) !important; color: var(--accent) !important; border-color: var(--accent-border) !important; }
.sm-act-btn-save { background: var(--green-dim); color: var(--green); border-color: var(--green-border); font-size: 12px; width: auto; padding: 0 10px; font-weight: 600; }
.sm-act-btn-cancel { font-size: 12px; width: auto; padding: 0 10px; }
.sm-act-btn-danger { background: var(--red-dim) !important; color: var(--red) !important; border-color: var(--red-border) !important; }
.sm-act-btn-teal { background: var(--teal-dim) !important; color: var(--teal) !important; border-color: var(--teal-border) !important; }
.sm-act-btn-amber { background: var(--amber-dim) !important; color: var(--amber) !important; border-color: var(--amber-border) !important; }

/* ── edit row expand ── */
.sm-edit-expand td { padding: 0 !important; border-bottom: 1px solid var(--border) !important; white-space: normal !important; overflow: visible !important; }
.sm-edit-inner { padding: 18px 20px; background: #0d0d12; border-top: 1px solid var(--border); animation: smExpand 0.16s ease; }
@keyframes smExpand { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }

.sm-edit-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.sm-edit-bar { width: 3px; height: 14px; border-radius: 2px; background: var(--accent); flex-shrink: 0; }
.sm-edit-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); }
.sm-edit-sub { font-family: var(--mono); font-size: 11px; color: var(--t3); background: var(--bg2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 5px; margin-left: auto; word-break: break-all; }

/* ── modal overlay (only for delete confirmations) ── */
.sm-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72); z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: smFadeIn 0.14s ease;
}
@keyframes smFadeIn { from { opacity:0; } to { opacity:1; } }
.sm-modal {
  background: var(--bg1); border: 1px solid var(--border2);
  border-radius: 14px; padding: 22px 24px;
  width: 100%; max-width: 420px;
  animation: smModalIn 0.16s ease;
  max-height: 90vh;
  overflow-y: auto;
}
@keyframes smModalIn { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }
.sm-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 10px; }
.sm-modal-title { font-size: 15px; font-weight: 600; color: var(--t1); }
.sm-modal-sub { font-size: 12px; color: var(--t3); margin-top: 3px; word-break: break-all; }
.sm-modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--t3); cursor: pointer; font-size: 14px; transition: all 0.12s; flex-shrink: 0; }
.sm-modal-close:hover { background: var(--bg3); color: var(--t2); }
.sm-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; flex-wrap: wrap; }

.sm-upi-box { background: var(--green-dim); border: 1px solid var(--green-border); border-radius: 7px; padding: 10px 14px; margin-bottom: 12px; }
.sm-upi-row { font-size: 11px; color: var(--green); margin-bottom: 3px; font-family: var(--mono); word-break: break-all; }
.sm-upi-row:last-child { margin-bottom: 0; }

/* ── messages layout ── */
.sm-msg-layout { display: grid; grid-template-columns: 220px 1fr; gap: 12px; min-height: 500px; }
.sm-msg-sidebar { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; }
.sm-msg-sidebar-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3);
  display: flex; align-items: center; justify-content: space-between;
}
.sm-msg-user-list { overflow-y: auto; max-height: 460px; }
.sm-msg-user-list::-webkit-scrollbar { width: 3px; }
.sm-msg-user-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

.sm-msg-user-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left;
  padding: 10px 14px; border: none;
  background: transparent; cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.sm-msg-user-btn:last-child { border-bottom: none; }
.sm-msg-user-btn:hover { background: rgba(255,255,255,0.025); }
.sm-msg-user-btn-active { background: var(--accent-dim) !important; border-left: 2px solid var(--accent); }

.sm-msg-user-name { font-size: 12px; font-weight: 500; color: var(--t1); }
.sm-msg-user-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); margin-top: 2px; }

.sm-sidebar-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--teal-dim); border: 1px solid var(--teal-border);
  color: var(--teal); display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}

.sm-msg-window {
  background: #0b0b10;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.01) 0px,
    rgba(255,255,255,0.01) 2px,
    transparent 2px,
    transparent 8px
  );
}
.sm-msg-win-header {
  padding: 12px 16px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px; background: var(--bg1);
  flex-wrap: wrap;
}
.sm-msg-win-name { font-size: 13px; font-weight: 500; color: var(--t1); }
.sm-msg-win-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); }
.sm-msg-body {
  flex: 1; padding: 14px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px; max-height: 380px;
}
.sm-msg-body::-webkit-scrollbar { width: 4px; }
.sm-msg-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.sm-bubble {
  display: inline-block; max-width: 100%; padding: 10px 14px;
  font-size: 13px; line-height: 1.55; word-break: break-word;
  overflow-wrap: break-word; white-space: normal; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.sm-bubble-admin { background: #1e293b; color: #e2e8f0; border-radius: 12px 12px 12px 4px; border: 1px solid #334155; }
.sm-bubble-user  { background: #1f3a2f; color: #dcf8c6; border-radius: 12px 12px 4px 12px; border: 1px solid #2d5a3b; }
.sm-bubble-time  { font-size: 10px; color: #6b7280; margin-top: 4px; font-family: var(--mono); }

.sm-chat-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent-dim); border: 1px solid var(--accent-border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--accent);
}

.sm-msg-input-row {
  padding: 12px 14px; border-top: 1px solid var(--border);
  background: var(--bg1); display: flex; gap: 8px; align-items: center;
}
.sm-msg-input {
  flex: 1; background: var(--bg0); border: 1px solid var(--border2);
  border-radius: 9999px; padding: 10px 18px; font-size: 13px;
  font-family: var(--font); color: var(--t1); outline: none; transition: border-color 0.2s;
  min-width: 0;
}
.sm-msg-input:focus { border-color: var(--accent-border); }
.sm-msg-send-btn {
  width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff;
  border: none; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s; font-size: 18px; flex-shrink: 0;
}
.sm-msg-send-btn:hover { background: #6a5acd; }
.sm-msg-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.sm-broadcast-toggle {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--t2);
  cursor: pointer; background: none; border: none; padding: 5px 8px; border-radius: 6px; transition: all 0.13s;
}
.sm-broadcast-toggle:hover { background: var(--bg3); color: var(--t1); }
.sm-broadcast-toggle.active { color: var(--amber); background: var(--amber-dim); border: 1px solid var(--amber-border); }

.sm-no-msgs { text-align: center; padding: 28px; color: var(--t3); font-size: 12px; }
.sm-msg-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--t3); font-size: 13px; gap: 8px; }
.sm-msg-empty i { font-size: 28px; }

/* ── requests ── */
.sm-req-list { display: flex; flex-direction: column; gap: 0; }
.sm-req-item { padding: 16px 18px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; transition: background 0.1s; }
.sm-req-item:last-child { border-bottom: none; }
.sm-req-item:hover { background: rgba(255,255,255,0.015); }
.sm-req-left { flex: 1; min-width: 200px; }
.sm-req-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; flex-wrap: wrap; }
.sm-req-name { font-size: 13px; font-weight: 500; color: var(--t1); }
.sm-req-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); margin-top: 1px; }
.sm-req-amount { font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--amber); margin-top: 4px; }
.sm-req-upi { font-size: 11px; color: var(--t3); margin-top: 3px; font-family: var(--mono); word-break: break-all; }
.sm-req-msg { font-size: 11px; color: var(--t3); margin-top: 3px; font-style: italic; word-break: break-word; }
.sm-req-time { font-size: 10px; color: var(--t3); margin-top: 6px; font-family: var(--mono); }
.sm-req-actions { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; width: 100%; }

/* ── table footer ── */
.sm-table-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--bg2); flex-wrap: wrap; gap: 8px; }
.sm-footer-count { font-size: 11px; color: var(--t3); font-family: var(--mono); }

/* ── empty ── */
.sm-empty { padding: 48px 24px; text-align: center; color: var(--t3); font-size: 13px; }

/* ── USER CARD – 2 rows layout ── */
.sm-user-card {
  background: var(--bg1);
  border-bottom: 1px solid var(--border);
  padding: 14px 18px;
  transition: background 0.1s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sm-user-card:last-child { border-bottom: none; }
.sm-user-card:hover { background: rgba(255,255,255,0.015); }

.sm-user-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sm-user-card-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 180px;
}

/* Custom checkbox */
.sm-user-card-checkbox {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border2);
  border-radius: 4px;
  background: var(--bg0);
  transition: all 0.15s;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}
.sm-user-card-checkbox:checked {
  background: var(--accent);
  border-color: var(--accent);
}
.sm-user-card-checkbox:checked::after {
  content: "✓";
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.sm-user-card-checkbox:hover {
  border-color: var(--accent-border);
}

.sm-user-card-creds {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.sm-user-card-cred-item {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.sm-user-card-cred-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.sm-user-card-cred-value {
  font-family: var(--mono);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  word-break: break-all;
}

.sm-user-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sm-user-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.sm-user-card-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.sm-user-card-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sm-user-card-stat-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.sm-user-card-stat-value {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 500;
}

.sm-user-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* Inline expand panels (for edit/payment/link) */
.sm-inline-panel {
  background: #0d0d12;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
  animation: smExpand 0.16s ease;
}
.sm-inline-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sm-inline-panel-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--accent);
}
.sm-inline-panel-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--accent);
  flex-shrink: 0;
}
.sm-inline-panel-sub {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--t3);
  margin-left: auto;
}

/* ── LINK CARD (mobile list, replaces table on small screens) ── */
.sm-mobile-link-list { display: none; }
.sm-link-card {
  background: var(--bg1);
  border-bottom: 1px solid var(--border);
  padding: 13px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sm-link-card:last-child { border-bottom: none; }
.sm-link-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.sm-link-card-code-wrap { display: flex; align-items: center; gap: 6px; min-width: 0; }
.sm-link-card-label { font-size: 12px; color: var(--t2); font-weight: 500; display: block; }
.sm-link-card-url {
  font-size: 11.5px; color: var(--blue); text-decoration: none;
  word-break: break-all; line-height: 1.4;
}
.sm-link-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--t3);
  padding: 6px 0;
  border-top: 1px solid var(--border);
}
.sm-link-card-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.sm-link-card-meta-item span:last-child { word-break: break-word; }
.sm-link-card-meta-item:last-child { align-items: flex-end; text-align: right; }
.sm-link-card-meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t3); }
.sm-link-card-actions { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }

/* ══════════════════════════ MOBILE RESPONSIVE ══════════════════════════ */
@media (max-width: 860px) {
  .sm-msg-layout { grid-template-columns: 1fr; min-height: 0; }
  .sm-msg-sidebar { max-height: 220px; }
  .sm-msg-user-list { max-height: 170px; }
  .sm-msg-window { min-height: 460px; }
}

@media (max-width: 640px) {
  .sm { font-size: 12.5px; }

  /* stats */
  .sm-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
  .sm-stat-card { padding: 11px 12px; }
  .sm-stat-value { font-size: 16px; }
  .sm-stat-label { font-size: 9px; }
  .sm-stat-sub { font-size: 10px; }

  /* tabs */
  .sm-tab { padding: 7px 12px; font-size: 11.5px; }

  /* toolbar */
  .sm-toolbar { flex-direction: column; align-items: stretch; gap: 8px; }
  .sm-toolbar-left { width: 100%; }
  .sm-search-wrap { max-width: none; flex: 1 1 100%; }
  .sm-btn-new { width: 100%; justify-content: center; }
  .sm-toolbar > .sm-btn-new { order: -1; }

  /* month/year picker row */
  .sm-toolbar-left > .sm-btn { flex: 1 1 auto; }

  /* create / edit forms */
  .sm-create-panel, .sm-inline-panel, .sm-edit-inner { padding: 14px; }
  .sm-form-grid { grid-template-columns: 1fr; gap: 10px; }
  .sm-form-actions { flex-direction: column-reverse; }
  .sm-form-actions .sm-btn { width: 100%; justify-content: center; }
  .sm-edit-sub { margin-left: 0; width: 100%; }

  /* table: hide the horizontal-scrolling table, show stacked cards instead */
  .sm-table-wrap { display: none; }
  .sm-mobile-link-list { display: block; }

  /* user cards */
  .sm-user-card { padding: 12px 14px; }
  .sm-user-card-top { align-items: flex-start; }
  .sm-user-card-identity { min-width: 100%; }
  .sm-user-card-creds { width: 100%; }
  .sm-user-card-bottom { flex-direction: column; align-items: flex-start; gap: 10px; }
  .sm-user-card-stats { width: 100%; justify-content: space-between; gap: 10px; }
  .sm-user-card-actions { width: 100%; }
  .sm-user-card-actions .sm-act-btn { flex: 0 0 auto; }

  /* link cards */
  .sm-link-card { padding: 12px 14px; }
  .sm-link-card-actions { width: 100%; justify-content: flex-start; }

  /* requests */
  .sm-req-item { padding: 14px; }
  .sm-req-actions .sm-btn { flex: 1 1 auto; justify-content: center; }

  /* modal */
  .sm-modal { padding: 18px; border-radius: 12px; }
  .sm-modal-footer { flex-direction: column-reverse; }
  .sm-modal-footer .sm-btn { width: 100%; justify-content: center; }

  /* messages */
  .sm-msg-win-header { padding: 10px 12px; }
  .sm-msg-body { max-height: 340px; padding: 10px; }
  .sm-msg-input-row { padding: 10px; }
  .sm-bubble, div[style*="max-width: 75%"] { max-width: 88% !important; }
}

@media (max-width: 400px) {
  .sm-stats { grid-template-columns: repeat(2, 1fr); }
  .sm-stat-value { font-size: 14px; }
}
`;

// ─── Component Props ──────────────────────────────────────────
interface ShortenerManagerProps {
  token?: string;
  subAdminMode?: boolean;
}

const ShortenerManager: React.FC<ShortenerManagerProps> = ({ token: propToken, subAdminMode = false }) => {
  const getToken = () => propToken || localStorage.getItem('adminToken') || '';

  const [activeTab, setActiveTab] = useState<'links' | 'users' | 'requests' | 'messages'>('links');

  // links
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [addForm, setAddForm] = useState({ code: '', url: '', label: '', userId: '' });
  const [adding, setAdding] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ url: '', label: '', userId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<ShortLink | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);

  // users
  const [users, setUsers] = useState<ShortUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', realName: '', ratePerThousand: 100 });
  const [addingUser, setAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({ password: '', realName: '', ratePerThousand: 100, isActive: true });

  // Inline payment & link creation states (no modals)
  const [paymentUserId, setPaymentUserId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ code: '', url: '', label: '' });
  const [creatingLink, setCreatingLink] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<ShortUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'admin' | 'self'>('all');

  // Monthly view
  const [linkViewMode, setLinkViewMode] = useState<'alltime' | 'monthly'>('alltime');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [monthlyClicks, setMonthlyClicks] = useState<Record<string, number>>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyUserData, setMonthlyUserData] = useState<Record<string, { clicks: number; earnings: number }>>({});
  const [userMonthlyLoading, setUserMonthlyLoading] = useState(false);

  // Per-user click verification
  const [selectedUserIdsForCV, setSelectedUserIdsForCV] = useState<string[]>([]);
  const [cvUpdating, setCvUpdating] = useState(false);

  // requests
  const [requests, setRequests] = useState<ShortRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // messages
  const [selectedUserMsg, setSelectedUserMsg] = useState<ShortUser | null>(null);
  const [messages, setMessages] = useState<ShortMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [msgUserSearch, setMsgUserSearch] = useState('');
  const [userUnreadCounts, setUserUnreadCounts] = useState<Record<string, number>>({});

  // broadcast
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState<string[]>([]);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ─── helper: fetch per‑user unread counts ───────────────────
  const fetchUserUnreadCounts = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages/unread-per-user`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const map: Record<string, number> = {};
      (Array.isArray(data) ? data : []).forEach((item: any) => {
        map[item.userId] = item.unreadCount;
      });
      setUserUnreadCounts(map);
      const total = Object.values(map).reduce((a, b) => a + b, 0);
      setUnreadCount(total);
    } catch (err) {
      console.warn('Unread per‑user endpoint not available', err);
    }
  };

  const markConversationRead = async (userId: string) => {
    try {
      await axios.post(`${API_BASE}/short-users/admin/messages/${userId}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUserUnreadCounts(prev => ({ ...prev, [userId]: 0 }));
      const newTotal = Object.values({ ...userUnreadCounts, [userId]: 0 }).reduce((a,b)=>a+b,0);
      setUnreadCount(newTotal);
    } catch (err) {
      setUserUnreadCounts(prev => ({ ...prev, [userId]: 0 }));
    }
  };

  useEffect(() => { fetchLinks(); fetchUsers(); fetchUserUnreadCounts(); }, []);
  useEffect(() => { if (activeTab === 'requests') fetchRequests(); }, [activeTab]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (linkViewMode !== 'monthly') return;
    if (activeTab === 'links') fetchMonthlyClicks(selectedMonth, selectedYear);
    if (activeTab === 'users') fetchMonthlyUserClicks(selectedMonth, selectedYear);
  }, [activeTab, linkViewMode, selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeTab === 'messages') {
      const interval = setInterval(fetchUserUnreadCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchMonthlyClicks = async (month: number, year: number) => {
    setMonthlyLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links/monthly-clicks`, {
        params: { month, year },
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMonthlyClicks(data.data || {});
    } catch (err: any) {
      toast.error('Monthly clicks load failed');
    } finally {
      setMonthlyLoading(false);
    }
  };

  const fetchMonthlyUserClicks = async (month: number, year: number) => {
    setUserMonthlyLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/users/monthly-clicks`, {
        params: { month, year },
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMonthlyUserData(data.data || {});
    } catch (err: any) {
      toast.error('Monthly user data load failed');
    } finally {
      setUserMonthlyLoading(false);
    }
  };

  const fetchLinks = async () => {
    setLinksLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a: ShortLink, b: ShortLink) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLinks(sorted);
    } catch (err: any) {
      toast.error('Links load failed: ' + (err.response?.data?.error || err.message));
    } finally { setLinksLoading(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.code.trim() || !addForm.url.trim()) { toast.error('Code and URL are required'); return; }
    setAdding(true);
    try {
      await axios.post(`${SHORTENER_BASE}/admin/links`,
        { code: addForm.code.trim().toLowerCase(), url: addForm.url.trim(), label: addForm.label.trim() || addForm.code.trim(), userId: addForm.userId || null },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('Link created');
      setAddForm({ code: '', url: '', label: '', userId: '' });
      setShowAddLink(false);
      fetchLinks();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Create failed'); }
    finally { setAdding(false); }
  };

  const handleUpdate = async (link: ShortLink) => {
    if (!link.code || !link.code.trim()) {
      toast.error('This link has no short code — please delete it and recreate');
      return;
    }
    try {
      await axios.put(
        `${SHORTENER_BASE}/admin/links/${encodeURIComponent(link.code)}`,
        editForm,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('Updated');
      setEditingLinkId(null);
      fetchLinks();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  const handleDelete = async (link: ShortLink) => {
    try {
      if (!link.code || !link.code.trim()) {
        await axios.delete(
          `${SHORTENER_BASE}/admin/links/by-id/${link._id}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
      } else {
        await axios.delete(
          `${SHORTENER_BASE}/admin/links/${encodeURIComponent(link.code)}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
      }
      toast.success('Link deleted');
      setDeleteConfirm(null);
      fetchLinks();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const copyToClipboard = (code: string) => {
    if (!code || !code.trim()) { toast.error('No short code to copy'); return; }
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    setCopiedCode(code); toast.success('Copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/users`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error('Users load failed'); }
    finally { setUsersLoading(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = addUserForm.username.trim();
    const pwd   = addUserForm.password.trim();
    const rname = addUserForm.realName.trim();
    if (!uname || !pwd || !rname) { toast.error('All fields required'); return; }
    if (pwd.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    setAddingUser(true);
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/users`,
        { username: uname, password: pwd, realName: rname, ratePerThousand: addUserForm.ratePerThousand },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`User "${uname}" created! Password: ${pwd}`);
      setAddUserForm({ username: '', password: '', realName: '', ratePerThousand: 100 });
      setShowAddUser(false);
      fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Create failed'); }
    finally { setAddingUser(false); }
  };

  const handleUpdateUser = async (userId: string) => {
    try {
      const payload: any = { realName: editUserForm.realName, ratePerThousand: editUserForm.ratePerThousand, isActive: editUserForm.isActive };
      if (editUserForm.password.trim()) payload.password = editUserForm.password.trim();
      await axios.put(`${API_BASE}/short-users/admin/users/${userId}`, payload, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('User updated'); setEditingUserId(null); fetchUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserConfirm) return;
    setDeletingUser(true);
    try {
      await axios.delete(
        `${API_BASE}/short-users/admin/users/${deleteUserConfirm._id}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`User "${deleteUserConfirm.realName}" deleted`);
      setDeleteUserConfirm(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally { setDeletingUser(false); }
  };

  // ─── Inline Payment Handler ───────────────────────────────
  const handlePayment = async () => {
    if (!paymentUserId || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter valid amount'); return; }
    setPayingId(paymentUserId);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${paymentUserId}/pay`, { amount, note: paymentNote }, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success(`Rs.${amount} payment marked`);
      setPaymentUserId(null); setPaymentAmount(''); setPaymentNote('');
      fetchUsers(); fetchRequests();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Payment failed'); }
    finally { setPayingId(null); }
  };

  // ─── Inline Link Creation Handler ──────────────────────────
  const handleCreateLinkForUser = async () => {
    if (!linkUserId) return;
    if (!linkForm.code || !linkForm.url) { toast.error('Code and URL required'); return; }
    setCreatingLink(true);
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/users/${linkUserId}/create-link`,
        { code: linkForm.code.trim().toLowerCase(), url: linkForm.url.trim(), label: linkForm.label.trim() || linkForm.code.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`Link created for user`);
      setLinkUserId(null); setLinkForm({ code: '', url: '', label: '' });
      fetchLinks(); fetchRequests();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Create failed'); }
    finally { setCreatingLink(false); }
  };

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/requests`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      setPendingCount(list.filter((r: ShortRequest) => r.status === 'pending').length);
    } catch { toast.error('Requests load failed'); }
    finally { setRequestsLoading(false); }
  };

  const updateRequestStatus = async (reqId: string, status: string) => {
    try {
      await axios.put(`${API_BASE}/short-users/admin/requests/${reqId}`, { status }, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success(`Marked as ${status}`); fetchRequests();
    } catch { toast.error('Update failed'); }
  };

  const loadMessages = async (user: ShortUser) => {
    setSelectedUserMsg(user);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages/${user._id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setMessages(Array.isArray(data) ? data : []);
      await markConversationRead(user._id);
      await fetchUserUnreadCounts();
    } catch { toast.error('Messages load failed'); }
    finally { setMessagesLoading(false); }
  };

  const sendAdminMessage = async () => {
    if (!selectedUserMsg || !msgText.trim()) return;
    const text = msgText.trim(); setMsgText('');
    try {
      await axios.post(`${API_BASE}/short-users/admin/messages/${selectedUserMsg._id}`, { text }, { headers: { Authorization: `Bearer ${getToken()}` } });
      loadMessages(selectedUserMsg);
    } catch { toast.error('Send failed'); }
  };

  const toggleBroadcastMode = () => {
    setBroadcastMode(!broadcastMode);
    setSelectedBroadcastUsers([]);
    setSelectedUserMsg(null);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedBroadcastUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllUsers = () => setSelectedBroadcastUsers(users.map(u => u._id));
  const deselectAllUsers = () => setSelectedBroadcastUsers([]);

  const sendBroadcast = async () => {
    if (!msgText.trim() || selectedBroadcastUsers.length === 0) return;
    const text = msgText.trim();
    setMsgText('');
    const toastId = toast.loading(`Sending to ${selectedBroadcastUsers.length} users...`);
    let success = 0; let failed = 0;
    for (const userId of selectedBroadcastUsers) {
      try {
        await axios.post(`${API_BASE}/short-users/admin/messages/${userId}`, { text }, { headers: { Authorization: `Bearer ${getToken()}` } });
        success++;
      } catch { failed++; }
    }
    toast.dismiss(toastId);
    if (failed === 0) toast.success(`Message sent to all ${success} users`);
    else toast.error(`Sent to ${success}, failed for ${failed}`);
    setSelectedBroadcastUsers([]);
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '—';
    const u = users.find(u => u._id === userId);
    return u ? `${u.realName} (@${u.username})` : 'Unknown';
  };

  const filteredLinks = links.filter(l => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const matchSelf =
      (l.code || '').toLowerCase().includes(q) ||
      (l.label || '').toLowerCase().includes(q) ||
      (l.url || '').toLowerCase().includes(q);
    if (matchSelf) return true;
    if (l.userId) {
      const u = users.find(u => u._id === l.userId);
      if (u && ((u.realName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q))) return true;
    }
    return false;
  });

  const filteredUsers = users.filter(u => {
    if (sourceFilter !== 'all' && (u.createdBy || 'admin') !== sourceFilter) return false;
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.realName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

  const filteredMsgUsers = users.filter(u => {
    if (!msgUserSearch) return true;
    const q = msgUserSearch.toLowerCase();
    return (
      (u.realName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const unreadA = userUnreadCounts[a._id] || 0;
    const unreadB = userUnreadCounts[b._id] || 0;
    if (unreadA > 0 && unreadB === 0) return -1;
    if (unreadA === 0 && unreadB > 0) return 1;
    return 0;
  });

  const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalUnpaid = users.reduce((s, u) => s + (u.unpaidEarnings || 0), 0);
  const totalEarned = users.reduce((s, u) => s + (u.totalEarnings || 0), 0);

  const isMonthly = linkViewMode === 'monthly';
  const displayedClicks = isMonthly
    ? Object.values(monthlyClicks).reduce((s, v) => s + v, 0)
    : totalClicks;
  const displayedEarned = isMonthly
    ? Object.values(monthlyUserData).reduce((s, v) => s + (v.earnings || 0), 0)
    : totalEarned;

  const toggleUserSelectionForCV = (userId: string) => {
    setSelectedUserIdsForCV(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const applyClickVerification = async (value: boolean | null, userIds?: string[]) => {
    const targetIds = userIds || selectedUserIdsForCV;
    if (targetIds.length === 0) { toast.error('Pehle user(s) select karo'); return; }
    setCvUpdating(true);
    try {
      await axios.put(`${SHORTENER_BASE}/admin/users/click-verification`,
        { userIds: targetIds, value },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const label = value === true ? 'ON' : value === false ? 'OFF' : 'Global Default';
      toast.success(`${targetIds.length} user(s) ke liye Click Verification: ${label}`);
      setSelectedUserIdsForCV([]);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setCvUpdating(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="sm">
        {!subAdminMode && <ClickVerificationSettings token={getToken()} />}

        {/* Stats */}
        <div className="sm-stats">
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Links</div>
            <div className="sm-stat-value sm-v-teal">{links.length}</div>
            <div className="sm-stat-sub">short URLs active</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">{isMonthly ? `${MONTH_NAMES[selectedMonth - 1]} Clicks` : 'Total Clicks'}</div>
            <div className="sm-stat-value sm-v-accent">{displayedClicks.toLocaleString()}</div>
            <div className="sm-stat-sub">{isMonthly ? `${selectedYear}` : 'across all links'}</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Users</div>
            <div className="sm-stat-value sm-v-blue">{users.length}</div>
            <div className="sm-stat-sub">{users.filter(u => u.isActive).length} active</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">{isMonthly ? `${MONTH_NAMES[selectedMonth - 1]} Earned` : 'Total Earned'}</div>
            <div className="sm-stat-value sm-v-green">Rs.{displayedEarned.toFixed(0)}</div>
            <div className="sm-stat-sub">{isMonthly ? 'estimated (rate × clicks)' : 'all time'}</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Pending Payout</div>
            <div className="sm-stat-value sm-v-red">Rs.{totalUnpaid.toFixed(0)}</div>
            <div className="sm-stat-sub">awaiting payment</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sm-tabs">
          {(['links','users','requests','messages'] as const).map(tab => (
            <button
              key={tab}
              className={`sm-tab${activeTab === tab ? ` sm-tab-active sm-tab-active-${tab === 'links' ? 'teal' : tab === 'users' ? 'purple' : tab === 'requests' ? 'amber' : 'blue'}` : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <i className={`ti ti-${tab === 'links' ? 'link' : tab === 'users' ? 'users' : tab === 'requests' ? 'clipboard-list' : 'message-circle'}`} style={{ fontSize: 13 }} />
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'requests' && pendingCount > 0 && <span className="sm-tab-badge">{pendingCount}</span>}
              {tab === 'messages' && unreadCount > 0 && <span className="sm-tab-badge">{unreadCount}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="sm-btn sm-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => { fetchLinks(); fetchUsers(); fetchUserUnreadCounts(); if (activeTab === 'requests') fetchRequests(); }}>
            <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
          </button>
        </div>

        {/* Month-wise view selector */}
        {(activeTab === 'links' || activeTab === 'users') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              className={`sm-btn ${linkViewMode === 'alltime' ? 'sm-btn-primary' : 'sm-btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setLinkViewMode('alltime')}
            >
              All Time
            </button>
            <button
              className={`sm-btn ${linkViewMode === 'monthly' ? 'sm-btn-primary' : 'sm-btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setLinkViewMode('monthly')}
            >
              <i className="ti ti-calendar" style={{ fontSize: 12 }} /> Monthly
            </button>

            {linkViewMode === 'monthly' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="sm-act-btn" onClick={() => setSelectedYear(y => y - 1)} title="Previous year">
                    <i className="ti ti-chevron-left" />
                  </button>
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--t2)', minWidth: 42, textAlign: 'center' }}>
                    {selectedYear}
                  </span>
                  <button className="sm-act-btn" onClick={() => setSelectedYear(y => y + 1)} title="Next year">
                    <i className="ti ti-chevron-right" />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflowX: 'auto' }}>
                  {MONTH_NAMES.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(idx + 1)}
                      className={`sm-btn ${selectedMonth === idx + 1 ? 'sm-btn-primary' : 'sm-btn-ghost'}`}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {(monthlyLoading || userMonthlyLoading) && <span style={{ fontSize: 11, color: 'var(--t3)' }}>Loading…</span>}
              </>
            )}
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <>
            <div className="sm-toolbar">
              <div className="sm-toolbar-left">
                <div className="sm-search-wrap">
                  <i className="ti ti-search" />
                  <input className="sm-search" type="text" placeholder="Search links..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                {searchQuery && (
                  <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                    {filteredLinks.length} / {links.length}
                  </span>
                )}
              </div>
              <button className="sm-btn sm-btn-new" onClick={() => setShowAddLink(v => !v)}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> New Link
              </button>
            </div>

            {showAddLink && (
              <div className="sm-create-panel">
                <div className="sm-panel-label">Create Short Link</div>
                <form onSubmit={handleAdd}>
                  <div className="sm-form-grid">
                    <div className="sm-field">
                      <span>Short Code</span>
                      <input className="sm-input" type="text" placeholder="e.g. ep1"
                        value={addForm.code}
                        onChange={e => setAddForm({ ...addForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })} />
                      {addForm.code && <span className="sm-preview-url">go.animebing.in/{addForm.code}</span>}
                    </div>
                    <div className="sm-field">
                      <span>Target URL</span>
                      <input className="sm-input" type="url" placeholder="https://..." value={addForm.url} onChange={e => setAddForm({ ...addForm, url: e.target.value })} />
                    </div>
                    <div className="sm-field">
                      <span>Label</span>
                      <input className="sm-input" type="text" placeholder="Display name" value={addForm.label} onChange={e => setAddForm({ ...addForm, label: e.target.value })} />
                    </div>
                    <div className="sm-field">
                      <span>Assign to User</span>
                      <select className="sm-select" value={addForm.userId} onChange={e => setAddForm({ ...addForm, userId: e.target.value })}>
                        <option value="">— No assignment —</option>
                        {users.map(u => <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="sm-form-actions">
                    <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setShowAddLink(false)}>Cancel</button>
                    <button type="submit" className="sm-btn sm-btn-teal" disabled={adding}>
                      <i className="ti ti-link" />{adding ? 'Creating...' : 'Create Link'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="sm-table-shell">
              <div className="sm-table-wrap">
                {linksLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <Spinner /><p style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'var(--mono)' }}>Loading links...</p>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="sm-empty">{links.length === 0 ? 'No links yet. Create one to get started.' : 'No links match your search.'}</div>
                ) : (
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th style={{ width: '14%' }}>Short URL</th>
                        <th style={{ width: '13%' }}>Label</th>
                        <th style={{ width: '22%' }}>Target URL</th>
                        <th style={{ width: '16%' }}>Assigned User</th>
                        <th style={{ width: '9%' }}>
                          {linkViewMode === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} Clicks` : 'Clicks'}
                        </th>
                        <th style={{ width: '12%' }}>Last Click</th>
                        <th style={{ width: '14%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map(link => {
                        const hasCode = !!(link.code && link.code.trim());
                        const isEditingThis = editingLinkId === link._id;
                        return (
                          <React.Fragment key={link._id}>
                            <tr className="sm-data-row">
                              <td>
                                {hasCode ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <span
                                      className="sm-code-chip"
                                      title={`go.animebing.in/${link.code}`}
                                      style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                                    >
                                      {link.code}
                                    </span>
                                    <button
                                      className="sm-act-btn"
                                      style={{ flexShrink: 0, ...(copiedCode === link.code ? { background: 'var(--green-dim)', color: 'var(--green)', borderColor: 'var(--green-border)' } : {}) }}
                                      onClick={() => copyToClipboard(link.code)}
                                      title={`Copy: go.animebing.in/${link.code}`}
                                    >
                                      <i className={copiedCode === link.code ? 'ti ti-check' : 'ti ti-copy'} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {link.url ? (
                                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="sm-url-link" title={link.url} style={{ fontSize: 11, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                        {link.url.replace(/^https?:\/\//, '')}
                                      </a>
                                    ) : (
                                      <span style={{ color: 'var(--t3)', fontSize: 11 }}>No URL</span>
                                    )}
                                    <span style={{ fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap' }}>(no code)</span>
                                  </div>
                                )}
                              </td>
                              <td><span style={{ color: 'var(--t2)', fontSize: 12 }}>{link.label || '—'}</span></td>
                              <td>
                                {link.url ? (
                                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="sm-url-link" title={link.url}>
                                    {link.url.length > 50 ? link.url.substring(0, 50) + '…' : link.url}
                                  </a>
                                ) : <span style={{ color: 'var(--t3)' }}>—</span>}
                              </td>
                              <td><span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{getUserName(link.userId?.toString())}</span></td>
                              <td>
                                {(() => {
                                  const clickValue = linkViewMode === 'monthly'
                                    ? (monthlyClicks[link.code] || 0)
                                    : (link.clicks || 0);
                                  return (
                                    <span className={`sm-clicks-badge ${clickValue > 100 ? 'sm-clicks-high' : clickValue > 10 ? 'sm-clicks-mid' : 'sm-clicks-low'}`}>
                                      {clickValue.toLocaleString()}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td><span className="sm-mono" style={{ color: 'var(--t3)', fontSize: 11 }}>{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</span></td>
                              <td>
                                <div className="sm-act-group">
                                  <button
                                    className={`sm-act-btn${isEditingThis ? ' sm-act-btn-on' : ''}`}
                                    onClick={() => {
                                      if (!hasCode) { toast.error('Cannot edit — link has no short code'); return; }
                                      if (isEditingThis) { setEditingLinkId(null); }
                                      else { setEditingLinkId(link._id); setEditForm({ url: link.url || '', label: link.label || '', userId: link.userId?.toString() || '' }); }
                                    }}
                                    title={hasCode ? 'Edit' : 'No code — edit disabled'}
                                  >
                                    <i className="ti ti-edit" />
                                  </button>
                                  <span className="sm-act-sep" />
                                  <button className="sm-act-btn sm-act-btn-danger" onClick={() => setDeleteConfirm(link)} title="Delete">
                                    <i className="ti ti-trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isEditingThis && (
                              <tr className="sm-edit-expand">
                                <td colSpan={7}>
                                  <div className="sm-edit-inner">
                                    <div className="sm-edit-header">
                                      <span className="sm-edit-bar" />
                                      <span className="sm-edit-title">Edit Link</span>
                                      <span className="sm-edit-sub">go.animebing.in/{link.code}</span>
                                    </div>
                                    <div className="sm-form-grid">
                                      <div className="sm-field">
                                        <span>Target URL</span>
                                        <input className="sm-input" type="url" value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })} />
                                      </div>
                                      <div className="sm-field">
                                        <span>Label</span>
                                        <input className="sm-input" type="text" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
                                      </div>
                                      <div className="sm-field">
                                        <span>Assign to User</span>
                                        <select className="sm-select" value={editForm.userId} onChange={e => setEditForm({ ...editForm, userId: e.target.value })}>
                                          <option value="">— No assignment —</option>
                                          {users.map(u => <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>)}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="sm-form-actions">
                                      <button className="sm-btn sm-btn-ghost" onClick={() => setEditingLinkId(null)}>Cancel</button>
                                      <button className="sm-btn sm-btn-success" onClick={() => handleUpdate(link)}>
                                        <i className="ti ti-check" /> Save Changes
                                      </button>
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

              {/* MOBILE: stacked link cards (no side-scrolling) */}
              <div className="sm-mobile-link-list">
                {linksLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <Spinner /><p style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'var(--mono)' }}>Loading links...</p>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="sm-empty">{links.length === 0 ? 'No links yet. Create one to get started.' : 'No links match your search.'}</div>
                ) : (
                  filteredLinks.map(link => {
                    const hasCode = !!(link.code && link.code.trim());
                    const isEditingThis = editingLinkId === link._id;
                    const clickValue = linkViewMode === 'monthly'
                      ? (monthlyClicks[link.code] || 0)
                      : (link.clicks || 0);
                    return (
                      <div className="sm-link-card" key={link._id}>
                        <div className="sm-link-card-code-wrap">
                          {hasCode ? (
                            <>
                              <span className="sm-code-chip">{link.code}</span>
                              <button
                                className="sm-act-btn"
                                style={copiedCode === link.code ? { background: 'var(--green-dim)', color: 'var(--green)', borderColor: 'var(--green-border)' } : {}}
                                onClick={() => copyToClipboard(link.code)}
                                title="Copy link"
                              >
                                <i className={copiedCode === link.code ? 'ti ti-check' : 'ti ti-copy'} />
                              </button>
                            </>
                          ) : (
                            <span className="sm-code-chip-missing">no code</span>
                          )}
                        </div>

                        {link.label && <span className="sm-link-card-label">{link.label}</span>}

                        <span className={`sm-clicks-badge ${clickValue > 100 ? 'sm-clicks-high' : clickValue > 10 ? 'sm-clicks-mid' : 'sm-clicks-low'}`} style={{ alignSelf: 'flex-start' }}>
                          {clickValue.toLocaleString()} clicks
                        </span>

                        {link.url ? (
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="sm-link-card-url">
                            {link.url}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--t3)', fontSize: 11.5 }}>No target URL</span>
                        )}

                        <div className="sm-link-card-meta">
                          <div className="sm-link-card-meta-item">
                            <span className="sm-link-card-meta-label">Assigned</span>
                            <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{getUserName(link.userId?.toString())}</span>
                          </div>
                          <div className="sm-link-card-meta-item" style={{ alignItems: 'flex-end' }}>
                            <span className="sm-link-card-meta-label">Last Click</span>
                            <span>{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</span>
                          </div>
                        </div>

                        <div className="sm-link-card-actions">
                          <button
                            className={`sm-act-btn${isEditingThis ? ' sm-act-btn-on' : ''}`}
                            onClick={() => {
                              if (!hasCode) { toast.error('Cannot edit — link has no short code'); return; }
                              if (isEditingThis) { setEditingLinkId(null); }
                              else { setEditingLinkId(link._id); setEditForm({ url: link.url || '', label: link.label || '', userId: link.userId?.toString() || '' }); }
                            }}
                            title={hasCode ? 'Edit' : 'No code — edit disabled'}
                          >
                            <i className="ti ti-edit" />
                          </button>
                          <button className="sm-act-btn sm-act-btn-danger" onClick={() => setDeleteConfirm(link)} title="Delete">
                            <i className="ti ti-trash" />
                          </button>
                        </div>

                        {isEditingThis && (
                          <div className="sm-inline-panel">
                            <div className="sm-inline-panel-header">
                              <span className="sm-inline-panel-bar" />
                              <span className="sm-inline-panel-title">Edit Link</span>
                              <span className="sm-inline-panel-sub">go.animebing.in/{link.code}</span>
                            </div>
                            <div className="sm-form-grid">
                              <div className="sm-field">
                                <span>Target URL</span>
                                <input className="sm-input" type="url" value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })} />
                              </div>
                              <div className="sm-field">
                                <span>Label</span>
                                <input className="sm-input" type="text" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
                              </div>
                              <div className="sm-field">
                                <span>Assign to User</span>
                                <select className="sm-select" value={editForm.userId} onChange={e => setEditForm({ ...editForm, userId: e.target.value })}>
                                  <option value="">— No assignment —</option>
                                  {users.map(u => <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="sm-form-actions">
                              <button className="sm-btn sm-btn-ghost" onClick={() => setEditingLinkId(null)}>Cancel</button>
                              <button className="sm-btn sm-btn-success" onClick={() => handleUpdate(link)}>
                                <i className="ti ti-check" /> Save Changes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {filteredLinks.length > 0 && (
                <div className="sm-table-footer">
                  <span className="sm-footer-count">
                    {filteredLinks.length === links.length ? `${links.length} links` : `${filteredLinks.length} of ${links.length} links`}
                  </span>
                  {searchQuery && (
                    <button className="sm-btn sm-btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setSearchQuery('')}>
                      <i className="ti ti-x" style={{ fontSize: 11 }} /> Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* USERS TAB – inline forms, no modals */}
        {activeTab === 'users' && (
          <>
            <div className="sm-toolbar">
              <div className="sm-toolbar-left">
                <div className="sm-search-wrap">
                  <i className="ti ti-search" />
                  <input className="sm-search" type="text" placeholder="Search users by name or username..." value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                </div>
                {userSearchQuery && <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{filteredUsers.length} / {users.length}</span>}
                {!subAdminMode && (
                  <>
                    <button className={`sm-btn ${sourceFilter === 'all' ? 'sm-btn-primary' : 'sm-btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSourceFilter('all')}>All</button>
                    <button className={`sm-btn ${sourceFilter === 'admin' ? 'sm-btn-primary' : 'sm-btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSourceFilter('admin')}>Admin Created</button>
                    <button className={`sm-btn ${sourceFilter === 'self' ? 'sm-btn-primary' : 'sm-btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSourceFilter('self')}>Self Created</button>
                  </>
                )}
              </div>
              <button className="sm-btn sm-btn-new" onClick={() => setShowAddUser(v => !v)}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> New User
              </button>
            </div>

            {/* Bulk Click-Verification control */}
            {selectedUserIdsForCV.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  {selectedUserIdsForCV.length} user(s) selected
                </span>
                <button className="sm-btn sm-btn-success" style={{ padding: '5px 12px', fontSize: 11 }} disabled={cvUpdating} onClick={() => applyClickVerification(true)}>
                  Turn ON
                </button>
                <button className="sm-btn sm-btn-danger" style={{ padding: '5px 12px', fontSize: 11 }} disabled={cvUpdating} onClick={() => applyClickVerification(false)}>
                  Turn OFF
                </button>
                <button className="sm-btn sm-btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} disabled={cvUpdating} onClick={() => applyClickVerification(null)}>
                  Reset to Global
                </button>
                <button className="sm-btn sm-btn-ghost" style={{ padding: '5px 12px', fontSize: 11, marginLeft: 'auto' }} onClick={() => setSelectedUserIdsForCV([])}>
                  Clear
                </button>
              </div>
            )}

            {showAddUser && (
              <div className="sm-create-panel">
                <div className="sm-panel-label">Create New User</div>
                <form onSubmit={handleAddUser}>
                  <div className="sm-form-grid">
                    <div className="sm-field">
                      <span>Username</span>
                      <input className="sm-input" type="text" placeholder="e.g. harsh"
                        value={addUserForm.username}
                        onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
                    </div>
                    <div className="sm-field">
                      <span>Password</span>
                      <input className="sm-input" type="text" placeholder="Enter password (min 4 chars)" value={addUserForm.password} onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })} />
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>⚠ Make sure this is EXACTLY what the user will type to login</span>
                    </div>
                    <div className="sm-field">
                      <span>Real Name</span>
                      <input className="sm-input" type="text" placeholder="Harsh Rathore" value={addUserForm.realName} onChange={e => setAddUserForm({ ...addUserForm, realName: e.target.value })} />
                    </div>
                    <div className="sm-field">
                      <span>Rate per 1,000 (Rs.)</span>
                      <input className="sm-input" type="number" min="1" value={addUserForm.ratePerThousand} onChange={e => setAddUserForm({ ...addUserForm, ratePerThousand: Number(e.target.value) })} />
                    </div>
                  </div>
                  {addUserForm.username && addUserForm.password && (
                    <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: 7, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--mono)', wordBreak: 'break-word' }}>
                      ✅ Login credentials: username="{addUserForm.username}" password="{addUserForm.password}"
                    </div>
                  )}
                  <div className="sm-form-actions">
                    <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setShowAddUser(false)}>Cancel</button>
                    <button type="submit" className="sm-btn sm-btn-primary" disabled={addingUser}>
                      <i className="ti ti-check" />{addingUser ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="sm-table-shell">
              <div className="sm-users-wrap">
                {usersLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <Spinner /><p style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'var(--mono)' }}>Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="sm-empty">{users.length === 0 ? 'No users yet. Create one to get started.' : 'No users match your search.'}</div>
                ) : (
                  <>
                    {/* select-all bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && selectedUserIdsForCV.length === filteredUsers.length}
                        onChange={() => {
                          if (selectedUserIdsForCV.length === filteredUsers.length) setSelectedUserIdsForCV([]);
                          else setSelectedUserIdsForCV(filteredUsers.map(u => u._id));
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>Select all</span>
                    </div>

                    {filteredUsers.map(user => (
                      <React.Fragment key={user._id}>
                        <div className="sm-user-card">
                          {/* Row 1: checkbox + avatar + name+username + badges + password + rate */}
                          <div className="sm-user-card-top">
                            <div className="sm-user-card-identity">
                              <input
                                type="checkbox"
                                className="sm-user-card-checkbox"
                                checked={selectedUserIdsForCV.includes(user._id)}
                                onChange={() => toggleUserSelectionForCV(user._id)}
                              />
                              {renderUserAvatar(user, 32, 0)}
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{user.realName}</div>
                                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>@{user.username}</div>
                              </div>
                            </div>

                            <div className="sm-user-card-badges">
                              <span className={user.isActive ? 'sm-badge sm-badge-active' : 'sm-badge sm-badge-inactive'}>
                                <span className="sm-dot" />{user.isActive ? 'Active' : 'Inactive'}
                              </span>

                              {user.createdBy === 'self' ? (
                                <span className="sm-badge sm-badge-self"><span className="sm-dot" /> Self-Created</span>
                              ) : (!user.createdByAdminId || user.createdByAdminId === 'admin') ? (
                                <span className="sm-badge sm-badge-admin"><span className="sm-dot" /> Main Admin</span>
                              ) : (
                                <span className="sm-badge sm-badge-subadmin" title={`Created by sub-admin: ${user.createdByAdminUsername}`}>
                                  <span className="sm-dot" /> {user.createdByAdminUsername || 'Sub-Admin'}
                                </span>
                              )}

                              {user.requireFullCycle === true ? (
                                <button className="sm-badge sm-badge-active" style={{ cursor: 'pointer', border: 'none' }}
                                  onClick={() => applyClickVerification(false, [user._id])} title="Click to turn OFF for this user">
                                  <span className="sm-dot" /> ON (override)
                                </button>
                              ) : user.requireFullCycle === false ? (
                                <button className="sm-badge sm-badge-inactive" style={{ cursor: 'pointer', border: 'none' }}
                                  onClick={() => applyClickVerification(null, [user._id])} title="Click to reset to global default">
                                  <span className="sm-dot" /> OFF (override)
                                </button>
                              ) : (
                                <button className="sm-badge" style={{ cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--t3)' }}
                                  onClick={() => applyClickVerification(true, [user._id])} title="Click to force ON for this user">
                                  <span className="sm-dot" /> Global Default
                                </button>
                              )}
                            </div>

                            <div className="sm-user-card-creds">
                              <div className="sm-user-card-cred-item">
                                <span className="sm-user-card-cred-label">Password</span>
                                <span className="sm-user-card-cred-value" style={{ color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}>
                                  {user.password}
                                </span>
                              </div>
                              <div className="sm-user-card-cred-item">
                                <span className="sm-user-card-cred-label">Rate/1k</span>
                                <span className="sm-user-card-cred-value" style={{ color: 'var(--teal)', background: 'var(--teal-dim)', border: '1px solid var(--teal-border)' }}>
                                  Rs.{user.ratePerThousand}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Stats + Actions combined */}
                          <div className="sm-user-card-bottom">
                            <div className="sm-user-card-stats">
                              <div className="sm-user-card-stat">
                                <span className="sm-user-card-stat-label">{linkViewMode === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} Clicks` : 'Clicks'}</span>
                                <span className="sm-user-card-stat-value" style={{ color: 'var(--t2)' }}>
                                  {(linkViewMode === 'monthly' ? (monthlyUserData[user._id]?.clicks || 0) : (user.totalClicks || 0)).toLocaleString()}
                                </span>
                              </div>
                              <div className="sm-user-card-stat">
                                <span className="sm-user-card-stat-label">{linkViewMode === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} Earned` : 'Earned'}</span>
                                <span className="sm-user-card-stat-value" style={{ color: 'var(--green)' }}>
                                  Rs.{(linkViewMode === 'monthly' ? (monthlyUserData[user._id]?.earnings || 0) : (user.totalEarnings || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="sm-user-card-stat">
                                <span className="sm-user-card-stat-label">Pending</span>
                                <span className="sm-user-card-stat-value" style={{ color: 'var(--red)' }}>Rs.{(user.unpaidEarnings || 0).toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="sm-user-card-actions">
                              <button
                                className={`sm-act-btn${editingUserId === user._id ? ' sm-act-btn-on' : ''}`}
                                onClick={() => { if (editingUserId === user._id) setEditingUserId(null); else { setEditingUserId(user._id); setEditUserForm({ password: user.password, realName: user.realName, ratePerThousand: user.ratePerThousand, isActive: user.isActive }); } }}
                                title="Edit"
                              ><i className="ti ti-edit" /></button>
                              <span className="sm-act-sep" />
                              <button
                                className={`sm-act-btn sm-act-btn-amber${paymentUserId === user._id ? ' sm-act-btn-on' : ''}`}
                                onClick={() => {
                                  if (paymentUserId === user._id) { setPaymentUserId(null); }
                                  else { setPaymentUserId(user._id); setPaymentAmount(''); setPaymentNote(''); }
                                }}
                                title="Mark payment"
                              >
                                <i className="ti ti-currency-rupee" />
                              </button>
                              <button
                                className={`sm-act-btn sm-act-btn-teal${linkUserId === user._id ? ' sm-act-btn-on' : ''}`}
                                onClick={() => {
                                  if (linkUserId === user._id) { setLinkUserId(null); }
                                  else { setLinkUserId(user._id); setLinkForm({ code: '', url: '', label: '' }); }
                                }}
                                title="Create link"
                              >
                                <i className="ti ti-link" />
                              </button>
                              {/* ❌ Removed profile button */}
                              <button className="sm-act-btn" onClick={() => { setActiveTab('messages'); loadMessages(user); }} title="Messages">
                                <i className="ti ti-message-circle" />
                              </button>
                              <span className="sm-act-sep" />
                              <button className="sm-act-btn sm-act-btn-danger" onClick={() => setDeleteUserConfirm(user)} title="Delete user">
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>

                          {/* Inline Edit Panel */}
                          {editingUserId === user._id && (
                            <div className="sm-inline-panel">
                              <div className="sm-inline-panel-header">
                                <span className="sm-inline-panel-bar" />
                                <span className="sm-inline-panel-title">Edit User</span>
                                <span className="sm-inline-panel-sub">{user.realName}</span>
                              </div>
                              <div className="sm-form-grid">
                                <div className="sm-field">
                                  <span>Real Name</span>
                                  <input className="sm-input" type="text" value={editUserForm.realName} onChange={e => setEditUserForm({ ...editUserForm, realName: e.target.value })} />
                                </div>
                                <div className="sm-field">
                                  <span>New Password</span>
                                  <input className="sm-input" type="text" placeholder="Leave blank to keep current" value={editUserForm.password} onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })} />
                                </div>
                                <div className="sm-field">
                                  <span>Rate / 1,000 (Rs.)</span>
                                  <input className="sm-input" type="number" min="1" value={editUserForm.ratePerThousand} onChange={e => setEditUserForm({ ...editUserForm, ratePerThousand: Number(e.target.value) })} />
                                </div>
                                <div className="sm-field">
                                  <span>Status</span>
                                  <select className="sm-select" value={editUserForm.isActive ? 'true' : 'false'} onChange={e => setEditUserForm({ ...editUserForm, isActive: e.target.value === 'true' })}>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                  </select>
                                </div>
                              </div>
                              <div className="sm-form-actions">
                                <button className="sm-btn sm-btn-ghost" onClick={() => setEditingUserId(null)}>Cancel</button>
                                <button className="sm-btn sm-btn-success" onClick={() => handleUpdateUser(user._id)}>
                                  <i className="ti ti-check" /> Save Changes
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline Payment Panel */}
                          {paymentUserId === user._id && (
                            <div className="sm-inline-panel">
                              <div className="sm-inline-panel-header">
                                <span className="sm-inline-panel-bar" style={{ background: 'var(--amber)' }} />
                                <span className="sm-inline-panel-title" style={{ color: 'var(--amber)' }}>Mark Payment</span>
                                <span className="sm-inline-panel-sub">{user.realName}</span>
                              </div>
                              {user.profile && (user.profile.upiId || user.profile.upiPhone) && (
                                <div className="sm-upi-box">
                                  {user.profile.upiId && <div className="sm-upi-row"><i className="ti ti-credit-card" style={{ marginRight: 6 }} />UPI ID: {user.profile.upiId}</div>}
                                  {user.profile.upiPhone && <div className="sm-upi-row"><i className="ti ti-phone" style={{ marginRight: 6 }} />Phone: {user.profile.upiPhone}</div>}
                                </div>
                              )}
                              <div className="sm-form-grid">
                                <div className="sm-field">
                                  <span>Amount (Rs.)</span>
                                  <input className="sm-input" type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                                </div>
                                <div className="sm-field">
                                  <span>Note (optional)</span>
                                  <input className="sm-input" type="text" placeholder="Payment reference..." value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                                </div>
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
                                Unpaid: <strong style={{ color: 'var(--red)' }}>Rs.{user.unpaidEarnings.toFixed(2)}</strong>
                              </p>
                              <div className="sm-form-actions">
                                <button className="sm-btn sm-btn-ghost" onClick={() => setPaymentUserId(null)}>Cancel</button>
                                <button className="sm-btn sm-btn-success" onClick={handlePayment} disabled={!!payingId}>
                                  <i className="ti ti-check" />{payingId ? 'Processing...' : 'Confirm Payment'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline Link Creation Panel */}
                          {linkUserId === user._id && (
                            <div className="sm-inline-panel">
                              <div className="sm-inline-panel-header">
                                <span className="sm-inline-panel-bar" style={{ background: 'var(--teal)' }} />
                                <span className="sm-inline-panel-title" style={{ color: 'var(--teal)' }}>Create Link for User</span>
                                <span className="sm-inline-panel-sub">{user.realName}</span>
                              </div>
                              <div className="sm-form-grid">
                                <div className="sm-field">
                                  <span>Short Code</span>
                                  <input className="sm-input" type="text" placeholder="e.g. myanime"
                                    value={linkForm.code}
                                    onChange={e => setLinkForm({ ...linkForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })} />
                                  {linkForm.code && <span className="sm-preview-url">go.animebing.in/{linkForm.code}</span>}
                                </div>
                                <div className="sm-field">
                                  <span>Destination URL</span>
                                  <input className="sm-input" type="url" placeholder="https://..." value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} />
                                </div>
                                <div className="sm-field">
                                  <span>Label (optional)</span>
                                  <input className="sm-input" type="text" placeholder="Display name" value={linkForm.label} onChange={e => setLinkForm({ ...linkForm, label: e.target.value })} />
                                </div>
                              </div>
                              <div className="sm-form-actions">
                                <button className="sm-btn sm-btn-ghost" onClick={() => setLinkUserId(null)}>Cancel</button>
                                <button className="sm-btn sm-btn-teal" onClick={handleCreateLinkForUser} disabled={creatingLink}>
                                  <i className="ti ti-link" />{creatingLink ? 'Creating...' : 'Create & Assign'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* REQUESTS TAB – buttons now set inline states */}
        {activeTab === 'requests' && (
          <div className="sm-table-shell">
            {requestsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                <Spinner /><p style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'var(--mono)' }}>Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="sm-empty">No requests yet.</div>
            ) : (
              <>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{requests.length} requests</span>
                  {pendingCount > 0 && (
                    <span className="sm-badge sm-badge-pending" style={{ fontSize: 10 }}>
                      <span className="sm-dot" />{pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="sm-req-list">
                  {requests.map(req => (
                    <div key={req._id} className="sm-req-item">
                      <div className="sm-req-left">
                        <div className="sm-req-meta">
                          <span className={`sm-badge ${req.type === 'payment' ? 'sm-badge-payment' : 'sm-badge-link'}`}>
                            <i className={req.type === 'payment' ? 'ti ti-currency-rupee' : 'ti ti-link'} style={{ fontSize: 10 }} />
                            {req.type === 'payment' ? 'Payment' : 'Link'}
                          </span>
                          <span className={`sm-badge sm-badge-${req.status}`}>
                            <span className="sm-dot" />
                            {req.status === 'pending' ? 'Pending' : req.status === 'done' ? 'Done' : 'Rejected'}
                          </span>
                        </div>
                        <div className="sm-req-name">{req.realName}</div>
                        <div className="sm-req-handle">@{req.username}</div>
                        {req.type === 'payment' && req.amount && <div className="sm-req-amount">Rs.{req.amount.toFixed(2)}</div>}
                        {req.type === 'payment' && req.profile && (
                          <div className="sm-req-upi">
                            {req.profile.upiId && <span>UPI: {req.profile.upiId}</span>}
                            {req.profile.upiId && req.profile.upiPhone && <span> &bull; </span>}
                            {req.profile.upiPhone && <span>Phone: {req.profile.upiPhone}</span>}
                          </div>
                        )}
                        {req.type === 'link' && req.message && <div className="sm-req-msg">"{req.message}"</div>}
                        <div className="sm-req-time">{new Date(req.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      {req.status === 'pending' && (
                        <div className="sm-req-actions">
                          {req.type === 'payment' && (
                            <button className="sm-btn sm-btn-success"
                              onClick={() => { setPaymentUserId(req.userId); setPaymentAmount(String(req.amount || '')); setActiveTab('users'); }}>
                              <i className="ti ti-currency-rupee" /> Process
                            </button>
                          )}
                          {req.type === 'link' && (
                            <button className="sm-btn sm-btn-teal"
                              onClick={() => { setLinkUserId(req.userId); setLinkForm({ code: '', url: '', label: '' }); setActiveTab('users'); }}>
                              <i className="ti ti-link" /> Create Link
                            </button>
                          )}
                          <button className="sm-btn sm-btn-danger" onClick={() => updateRequestStatus(req._id, 'rejected')}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* MESSAGES TAB – unchanged */}
        {activeTab === 'messages' && (
          <div className="sm-msg-layout">
            <div className="sm-msg-sidebar">
              <div className="sm-msg-sidebar-header">
                {broadcastMode ? 'Select Recipients' : 'Users'}
                {broadcastMode && (
                  <span className="sm-tab-badge" style={{ fontSize: 10, background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                    {selectedBroadcastUsers.length}
                  </span>
                )}
              </div>
              {!broadcastMode && (
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <input
                    className="sm-input"
                    type="text"
                    placeholder="Search users..."
                    value={msgUserSearch}
                    onChange={e => setMsgUserSearch(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px' }}
                  />
                </div>
              )}
              <div className="sm-msg-user-list">
                {broadcastMode ? (
                  <>
                    <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
                      <button className="sm-btn sm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={selectAllUsers}>All</button>
                      <button className="sm-btn sm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={deselectAllUsers}>None</button>
                    </div>
                    {filteredMsgUsers.map(user => (
                      <label key={user._id} className="sm-msg-user-btn" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedBroadcastUsers.includes(user._id)} onChange={() => toggleUserSelection(user._id)} style={{ accentColor: 'var(--accent)' }} />
                        {renderUserAvatar(user, 28, 0)}
                        <div>
                          <div className="sm-msg-user-name">{user.realName}</div>
                          <div className="sm-msg-user-handle">@{user.username}</div>
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  filteredMsgUsers.map(user => {
                    const unread = userUnreadCounts[user._id] || 0;
                    return (
                      <button key={user._id}
                        className={`sm-msg-user-btn${selectedUserMsg?._id === user._id ? ' sm-msg-user-btn-active' : ''}`}
                        onClick={() => { setBroadcastMode(false); loadMessages(user); }}>
                        {renderUserAvatar(user, 28, unread)}
                        <div>
                          <div className="sm-msg-user-name">{user.realName}</div>
                          <div className="sm-msg-user-handle">@{user.username}</div>
                          {unread > 0 && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 'bold', marginLeft: 4 }}>{unread} new</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="sm-msg-window">
              {broadcastMode ? (
                <div className="sm-msg-empty" style={{ justifyContent: 'flex-start', alignItems: 'stretch', padding: 16, gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Compose Broadcast</span>
                    <button className="sm-broadcast-toggle active" onClick={toggleBroadcastMode}>
                      <i className="ti ti-arrow-back" style={{ fontSize: 13 }} /> Chat mode
                    </button>
                  </div>
                  <textarea className="sm-input" style={{ flex: 1, minHeight: 150, resize: 'vertical', borderRadius: 8, background: 'var(--bg0)' }}
                    placeholder={`Write a message to ${selectedBroadcastUsers.length} selected user(s)...`}
                    value={msgText} onChange={e => setMsgText(e.target.value)} />
                  <button className="sm-btn sm-btn-primary" style={{ alignSelf: 'flex-end', width: '100%', justifyContent: 'center' }}
                    disabled={selectedBroadcastUsers.length === 0 || !msgText.trim()} onClick={sendBroadcast}>
                    <i className="ti ti-send" /> Send to {selectedBroadcastUsers.length} user{selectedBroadcastUsers.length !== 1 ? 's' : ''}
                  </button>
                </div>
              ) : !selectedUserMsg ? (
                <div className="sm-msg-empty">
                  <i className="ti ti-message-circle" />
                  <span>Select a user to start messaging</span>
                  <button className="sm-broadcast-toggle" onClick={toggleBroadcastMode} style={{ marginTop: 8 }}>
                    <i className="ti ti-antenna-bars-5" style={{ fontSize: 13 }} /> Broadcast
                  </button>
                </div>
              ) : (
                <>
                  <div className="sm-msg-win-header">
                    {renderUserAvatar(selectedUserMsg, 32, 0)}
                    <div>
                      <div className="sm-msg-win-name">{selectedUserMsg.realName}</div>
                      <div className="sm-msg-win-handle">@{selectedUserMsg.username}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="sm-broadcast-toggle" onClick={toggleBroadcastMode}>
                        <i className="ti ti-antenna-bars-5" style={{ fontSize: 13 }} /> Broadcast
                      </button>
                      <button className="sm-btn sm-btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => loadMessages(selectedUserMsg)}>
                        <i className="ti ti-refresh" style={{ fontSize: 12 }} /> Refresh
                      </button>
                    </div>
                  </div>
                  <div className="sm-msg-body">
                    {messagesLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
                    ) : messages.length === 0 ? (
                      <div className="sm-no-msgs">No messages yet. Start the conversation.</div>
                    ) : messages.map(msg => (
                      <div key={msg._id} style={{ display: 'flex', justifyContent: msg.fromAdmin ? 'flex-start' : 'flex-end', alignItems: 'flex-end' }}>
                        {msg.fromAdmin ? (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '75%' }}>
                            <div className="sm-chat-avatar">A</div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <AdminSenderBadge senderRole={msg.senderRole} senderName={msg.senderName} />
                              <div className="sm-bubble sm-bubble-admin">{msg.text}</div>
                              <div className="sm-bubble-time">{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} · Admin</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '75%', flexDirection: 'row-reverse' }}>
                            {renderUserAvatar(selectedUserMsg, 28, 0)}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <div className="sm-bubble sm-bubble-user">{msg.text}</div>
                              <div className="sm-bubble-time">{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="sm-msg-input-row">
                    <input className="sm-msg-input" type="text" placeholder={`Message ${selectedUserMsg.realName}...`}
                      value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAdminMessage()} />
                    <button className="sm-msg-send-btn" onClick={sendAdminMessage} disabled={!msgText.trim()}>
                      <i className="ti ti-send" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Delete Link Modal */}
        {deleteConfirm && (
          <div className="sm-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title">Delete Link?</div>
                  {deleteConfirm.code && deleteConfirm.code.trim() ? (
                    <div className="sm-modal-sub" style={{ fontFamily: 'var(--mono)', color: 'var(--teal)', marginTop: 6 }}>
                      go.animebing.in/{deleteConfirm.code}
                    </div>
                  ) : (
                    <div className="sm-modal-sub" style={{ color: 'var(--amber)', marginTop: 6 }}>
                      ⚠ Broken link (no short code) — will be deleted by ID
                    </div>
                  )}
                </div>
                <button className="sm-modal-close" onClick={() => setDeleteConfirm(null)}><i className="ti ti-x" /></button>
              </div>
              {deleteConfirm.label && <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>Label: {deleteConfirm.label}</p>}
              <p style={{ fontSize: 12, color: 'var(--t3)' }}>This action cannot be undone. All click data will be lost.</p>
              <div className="sm-modal-footer">
                <button className="sm-btn sm-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="sm-btn sm-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                  <i className="ti ti-trash" /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {deleteUserConfirm && (
          <div className="sm-modal-backdrop" onClick={() => setDeleteUserConfirm(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title" style={{ color: 'var(--red)' }}>Delete User?</div>
                  <div className="sm-modal-sub" style={{ marginTop: 4 }}>
                    {deleteUserConfirm.realName} &bull; @{deleteUserConfirm.username}
                  </div>
                </div>
                <button className="sm-modal-close" onClick={() => setDeleteUserConfirm(null)}><i className="ti ti-x" /></button>
              </div>
              <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 7, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--red)' }}>
                ⚠ This will permanently delete the user and all their data. This cannot be undone.
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Total clicks: {deleteUserConfirm.totalClicks}</span>
                <span>Unpaid earnings: Rs.{deleteUserConfirm.unpaidEarnings.toFixed(2)}</span>
              </div>
              <div className="sm-modal-footer">
                <button className="sm-btn sm-btn-ghost" onClick={() => setDeleteUserConfirm(null)}>Cancel</button>
                <button className="sm-btn sm-btn-danger" onClick={handleDeleteUser} disabled={deletingUser}>
                  <i className="ti ti-trash" /> {deletingUser ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No payment or link creation modals – they are now inline */}
      </div>
    </>
  );
};

export default ShortenerManager;