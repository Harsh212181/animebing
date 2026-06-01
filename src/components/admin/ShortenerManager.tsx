 // src/components/admin/ShortenerManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Spinner from '../Spinner';

const SHORTENER_BASE = 'https://go.animebing.in';
const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';
const getToken = () => localStorage.getItem('adminToken') || '';

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
  avatarId?: number | null;   // ✨ added
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
}

// Helper: render user avatar from AVATARS list
const renderUserAvatar = (user: ShortUser, size = 28) => {
  const av = AVATARS.find(a => a.id === user.avatarId);
  if (av) {
    return (
      <div style={{
        width: size, height: size,
        background: av.bg,
        borderRadius: size * 0.28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.48, flexShrink: 0
      }}>
        {av.emoji}
      </div>
    );
  }
  return (
    <div className="sm-sidebar-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user.realName.charAt(0).toUpperCase()}
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

.sm * { box-sizing: border-box; margin: 0; padding: 0; }
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
}
.sm-stat-card:hover { border-color: var(--border2); }
.sm-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); }
.sm-stat-value { font-family: var(--mono); font-size: 20px; font-weight: 500; letter-spacing: -0.5px; }
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
}
.sm-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  font-size: 12px; font-weight: 500; font-family: var(--font);
  border-radius: 7px; border: none;
  background: transparent; color: var(--t2);
  cursor: pointer; transition: all 0.14s;
  position: relative;
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
.sm-toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.sm-search-wrap { position: relative; flex: 1; max-width: 280px; }
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
.sm-field { display: flex; flex-direction: column; gap: 5px; }
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
.sm-preview-url { font-family: var(--mono); font-size: 11px; color: var(--teal); margin-top: 4px; }

/* ── table ── */
.sm-table-shell {
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
}
.sm-table-wrap { overflow-x: auto; }
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
.sm-act-group { display: flex; align-items: center; gap: 3px; }
.sm-act-sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; flex-shrink: 0; }
.sm-act-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--border);
  background: transparent; color: var(--t3);
  cursor: pointer; font-size: 14px; transition: all 0.12s;
}
.sm-act-btn:hover { background: var(--bg3); color: var(--t2); border-color: var(--border2); }
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

.sm-edit-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.sm-edit-bar { width: 3px; height: 14px; border-radius: 2px; background: var(--accent); flex-shrink: 0; }
.sm-edit-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); }
.sm-edit-sub { font-family: var(--mono); font-size: 11px; color: var(--t3); background: var(--bg2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 5px; margin-left: auto; }

/* ── modal overlay ── */
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
}
@keyframes smModalIn { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }
.sm-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.sm-modal-title { font-size: 15px; font-weight: 600; color: var(--t1); }
.sm-modal-sub { font-size: 12px; color: var(--t3); margin-top: 3px; }
.sm-modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--t3); cursor: pointer; font-size: 14px; transition: all 0.12s; flex-shrink: 0; }
.sm-modal-close:hover { background: var(--bg3); color: var(--t2); }
.sm-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }

.sm-upi-box { background: var(--green-dim); border: 1px solid var(--green-border); border-radius: 7px; padding: 10px 14px; margin-bottom: 12px; }
.sm-upi-row { font-size: 11px; color: var(--green); margin-bottom: 3px; font-family: var(--mono); }
.sm-upi-row:last-child { margin-bottom: 0; }

/* ── messages layout ── */
.sm-msg-layout { display: grid; grid-template-columns: 220px 1fr; gap: 12px; min-height: 500px; }
.sm-msg-sidebar { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.sm-msg-user-btn:last-child { border-bottom: none; }
.sm-msg-user-btn:hover { background: rgba(255,255,255,0.025); }
.sm-msg-user-btn-active { background: var(--accent-dim) !important; border-left: 2px solid var(--accent); }

.sm-msg-user-name { font-size: 12px; font-weight: 500; color: var(--t1); }
.sm-msg-user-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); margin-top: 2px; }

/* Sidebar avatar */
.sm-sidebar-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--teal-dim);
  border: 1px solid var(--teal-border);
  color: var(--teal);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.sm-msg-window {
  background: var(--bg1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 60px 60px;
}

.sm-msg-win-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg1);
}
.sm-msg-win-name { font-size: 13px; font-weight: 500; color: var(--t1); }
.sm-msg-win-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); }

.sm-msg-body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 380px;
}
.sm-msg-body::-webkit-scrollbar { width: 4px; }
.sm-msg-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* ── Bubbles (WhatsApp style) ── */
.sm-bubble {
  display: inline-block;
  max-width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.sm-bubble-admin {
  background: #ffffff;
  color: #1e293b;
  border-radius: 12px 12px 12px 4px;
  border: 1px solid rgba(0,0,0,0.05);
}

.sm-bubble-user {
  background: #dcf8c6;
  color: #1e293b;
  border-radius: 12px 12px 4px 12px;
}

.sm-bubble-time {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 4px;
  font-family: var(--mono);
}

.sm-chat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-dim);
  border: 1px solid var(--accent-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}

/* Input row */
.sm-msg-input-row {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg1);
  display: flex;
  gap: 8px;
  align-items: center;
}
.sm-msg-input {
  flex: 1;
  background: var(--bg0);
  border: 1px solid var(--border2);
  border-radius: 9999px;
  padding: 10px 18px;
  font-size: 13px;
  font-family: var(--font);
  color: var(--t1);
  outline: none;
  transition: border-color 0.2s;
}
.sm-msg-input:focus { border-color: var(--accent-border); }

.sm-msg-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 18px;
}
.sm-msg-send-btn:hover { background: #6a5acd; }
.sm-msg-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Broadcast toggle */
.sm-broadcast-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--t2);
  cursor: pointer;
  background: none;
  border: none;
  padding: 5px 8px;
  border-radius: 6px;
  transition: all 0.13s;
}
.sm-broadcast-toggle:hover { background: var(--bg3); color: var(--t1); }
.sm-broadcast-toggle.active { color: var(--amber); background: var(--amber-dim); border: 1px solid var(--amber-border); }

.sm-no-msgs { text-align: center; padding: 40px 20px; color: var(--t3); font-size: 12px; }
.sm-msg-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--t3); font-size: 13px; gap: 8px; }
.sm-msg-empty i { font-size: 28px; }

/* ── requests ── */
.sm-req-list { display: flex; flex-direction: column; gap: 0; }
.sm-req-item { padding: 16px 18px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; transition: background 0.1s; }
.sm-req-item:last-child { border-bottom: none; }
.sm-req-item:hover { background: rgba(255,255,255,0.015); }
.sm-req-left { flex: 1; min-width: 200px; }
.sm-req-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
.sm-req-name { font-size: 13px; font-weight: 500; color: var(--t1); }
.sm-req-handle { font-size: 11px; color: var(--t3); font-family: var(--mono); margin-top: 1px; }
.sm-req-amount { font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--amber); margin-top: 4px; }
.sm-req-upi { font-size: 11px; color: var(--t3); margin-top: 3px; font-family: var(--mono); }
.sm-req-msg { font-size: 11px; color: var(--t3); margin-top: 3px; font-style: italic; }
.sm-req-time { font-size: 10px; color: var(--t3); margin-top: 6px; font-family: var(--mono); }
.sm-req-actions { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; }

/* ── table footer ── */
.sm-table-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--bg2); }
.sm-footer-count { font-size: 11px; color: var(--t3); font-family: var(--mono); }

/* ── empty ── */
.sm-empty { padding: 48px 24px; text-align: center; color: var(--t3); font-size: 13px; }

/* responsive */
@media (max-width: 1000px) { .sm-stats { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px) {
  .sm-stats { grid-template-columns: repeat(2, 1fr); }
  .sm-msg-layout { grid-template-columns: 1fr; }
}
`;

const ShortenerManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'links' | 'users' | 'requests' | 'messages'>('links');

  // links
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [addForm, setAddForm] = useState({ code: '', url: '', label: '', userId: '' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ url: '', label: '', userId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);

  // users
  const [users, setUsers] = useState<ShortUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', realName: '', ratePerThousand: 10 });
  const [addingUser, setAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({ password: '', realName: '', ratePerThousand: 10, isActive: true });
  const [paymentModal, setPaymentModal] = useState<ShortUser | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [createLinkModal, setCreateLinkModal] = useState<ShortUser | null>(null);
  const [createLinkForm, setCreateLinkForm] = useState({ code: '', url: '', label: '' });
  const [creatingLink, setCreatingLink] = useState(false);
  const [profileModal, setProfileModal] = useState<ShortUser | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

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

  // broadcast mode
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState<string[]>([]);

  useEffect(() => { fetchLinks(); fetchUsers(); fetchUnreadCount(); }, []);
  useEffect(() => { if (activeTab === 'requests') fetchRequests(); }, [activeTab]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages-count`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setUnreadCount(data.unread || 0);
    } catch {}
  };

  const fetchLinks = async () => {
    setLinksLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setLinks(Array.isArray(data) ? data : []);
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

  const handleUpdate = async (code: string) => {
    try {
      await axios.put(`${SHORTENER_BASE}/admin/links/${code}`, editForm, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('Updated');
      setEditingId(null); fetchLinks();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  const handleDelete = async (code: string) => {
    try {
      await axios.delete(`${SHORTENER_BASE}/admin/links/${code}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('Link deleted');
      setDeleteConfirm(null); fetchLinks();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const copyToClipboard = (code: string) => {
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
    if (!addUserForm.username || !addUserForm.password || !addUserForm.realName) { toast.error('All fields required'); return; }
    setAddingUser(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users`, addUserForm, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('User created');
      setAddUserForm({ username: '', password: '', realName: '', ratePerThousand: 10 });
      setShowAddUser(false); fetchUsers();
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

  const handlePayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter valid amount'); return; }
    setPayingId(paymentModal._id);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${paymentModal._id}/pay`, { amount, note: paymentNote }, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success(`Rs.${amount} payment marked`);
      setPaymentModal(null); setPaymentAmount(''); setPaymentNote('');
      fetchUsers(); fetchRequests();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Payment failed'); }
    finally { setPayingId(null); }
  };

  const handleCreateLinkForUser = async () => {
    if (!createLinkModal) return;
    if (!createLinkForm.code || !createLinkForm.url) { toast.error('Code and URL required'); return; }
    setCreatingLink(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${createLinkModal._id}/create-link`,
        { code: createLinkForm.code.trim().toLowerCase(), url: createLinkForm.url.trim(), label: createLinkForm.label.trim() || createLinkForm.code.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`Link created for ${createLinkModal.realName}`);
      setCreateLinkModal(null); setCreateLinkForm({ code: '', url: '', label: '' });
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
    setSelectedUserMsg(user); setMessagesLoading(true); setMessages([]);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages/${user._id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setMessages(Array.isArray(data) ? data : []);
      fetchUnreadCount();
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

  // --- Broadcast functions ---
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
    const total = selectedBroadcastUsers.length;
    const toastId = toast.loading(`Sending to ${total} users...`);
    let success = 0;
    let failed = 0;
    for (const userId of selectedBroadcastUsers) {
      try {
        await axios.post(`${API_BASE}/short-users/admin/messages/${userId}`, { text }, { headers: { Authorization: `Bearer ${getToken()}` } });
        success++;
      } catch {
        failed++;
      }
    }
    toast.dismiss(toastId);
    if (failed === 0) {
      toast.success(`Message sent to all ${success} users`);
    } else {
      toast.error(`Sent to ${success} users, failed for ${failed} users`);
    }
    setSelectedBroadcastUsers([]);
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '—';
    const u = users.find(u => u._id === userId);
    return u ? `${u.realName} (@${u.username})` : 'Unknown';
  };

  const filteredLinks = links.filter(l =>
    (l.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalUnpaid = users.reduce((s, u) => s + (u.unpaidEarnings || 0), 0);
  const totalEarned = users.reduce((s, u) => s + (u.totalEarnings || 0), 0);

  return (
    <>
      <style>{css}</style>
      <div className="sm">

        {/* Stats */}
        <div className="sm-stats">
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Links</div>
            <div className="sm-stat-value sm-v-teal">{links.length}</div>
            <div className="sm-stat-sub">short URLs active</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Clicks</div>
            <div className="sm-stat-value sm-v-accent">{totalClicks.toLocaleString()}</div>
            <div className="sm-stat-sub">across all links</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Users</div>
            <div className="sm-stat-value sm-v-blue">{users.length}</div>
            <div className="sm-stat-sub">{users.filter(u => u.isActive).length} active</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Total Earned</div>
            <div className="sm-stat-value sm-v-green">Rs.{totalEarned.toFixed(0)}</div>
            <div className="sm-stat-sub">all time</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-label">Pending Payout</div>
            <div className="sm-stat-value sm-v-red">Rs.{totalUnpaid.toFixed(0)}</div>
            <div className="sm-stat-sub">awaiting payment</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sm-tabs">
          <button
            className={`sm-tab${activeTab === 'links' ? ' sm-tab-active sm-tab-active-teal' : ''}`}
            onClick={() => setActiveTab('links')}
          >
            <i className="ti ti-link" style={{ fontSize: 13 }} />
            Links
          </button>
          <button
            className={`sm-tab${activeTab === 'users' ? ' sm-tab-active sm-tab-active-purple' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="ti ti-users" style={{ fontSize: 13 }} />
            Users
          </button>
          <button
            className={`sm-tab${activeTab === 'requests' ? ' sm-tab-active sm-tab-active-amber' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <i className="ti ti-clipboard-list" style={{ fontSize: 13 }} />
            Requests
            {pendingCount > 0 && <span className="sm-tab-badge">{pendingCount}</span>}
          </button>
          <button
            className={`sm-tab${activeTab === 'messages' ? ' sm-tab-active sm-tab-active-blue' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <i className="ti ti-message-circle" style={{ fontSize: 13 }} />
            Messages
            {unreadCount > 0 && <span className="sm-tab-badge">{unreadCount}</span>}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="sm-btn sm-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => { fetchLinks(); fetchUsers(); fetchUnreadCount(); if (activeTab === 'requests') fetchRequests(); }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
          </button>
        </div>

        {/* ═══ LINKS TAB ═══ (unchanged) */}
        {activeTab === 'links' && (
          <>
            {/* ... (same as before) ... */}
            <div className="sm-toolbar">
              <div className="sm-toolbar-left">
                <div className="sm-search-wrap">
                  <i className="ti ti-search" />
                  <input className="sm-search" type="text" placeholder="Search links..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                {(searchQuery) && (
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
                        <th style={{ width: '9%' }}>Clicks</th>
                        <th style={{ width: '12%' }}>Last Click</th>
                        <th style={{ width: '14%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map(link => (
                        <React.Fragment key={link.code}>
                          <tr className="sm-data-row">
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="sm-code-chip">{link.code}</span>
                                <button
                                  className="sm-act-btn"
                                  style={copiedCode === link.code ? { background: 'var(--green-dim)', color: 'var(--green)', borderColor: 'var(--green-border)' } : {}}
                                  onClick={() => copyToClipboard(link.code)}
                                  title="Copy URL"
                                >
                                  <i className={copiedCode === link.code ? 'ti ti-check' : 'ti ti-copy'} />
                                </button>
                              </div>
                            </td>
                            <td><span style={{ color: 'var(--t2)', fontSize: 12 }}>{link.label || '—'}</span></td>
                            <td>
                              <a href={link.url || '#'} target="_blank" rel="noopener noreferrer" className="sm-url-link" title={link.url}>
                                {link.url ? (link.url.length > 38 ? link.url.substring(0, 38) + '…' : link.url) : '—'}
                              </a>
                            </td>
                            <td>
                              <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                                {getUserName(link.userId)}
                              </span>
                            </td>
                            <td>
                              <span className={`sm-clicks-badge ${(link.clicks || 0) > 100 ? 'sm-clicks-high' : (link.clicks || 0) > 10 ? 'sm-clicks-mid' : 'sm-clicks-low'}`}>
                                {(link.clicks || 0).toLocaleString()}
                              </span>
                            </td>
                            <td><span className="sm-mono" style={{ color: 'var(--t3)', fontSize: 11 }}>{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</span></td>
                            <td>
                              <div className="sm-act-group">
                                <button
                                  className={`sm-act-btn${editingId === link.code ? ' sm-act-btn-on' : ''}`}
                                  onClick={() => { if (editingId === link.code) { setEditingId(null); } else { setEditingId(link.code); setEditForm({ url: link.url || '', label: link.label || '', userId: link.userId || '' }); } }}
                                  title="Edit"
                                ><i className="ti ti-edit" /></button>
                                <span className="sm-act-sep" />
                                <button className="sm-act-btn sm-act-btn-danger" onClick={() => setDeleteConfirm(link.code)} title="Delete">
                                  <i className="ti ti-trash" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingId === link.code && (
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
                                    <button className="sm-btn sm-btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                    <button className="sm-btn sm-btn-success" onClick={() => handleUpdate(link.code)}>
                                      <i className="ti ti-check" /> Save Changes
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
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

        {/* ═══ USERS TAB ═══ (unchanged) */}
        {activeTab === 'users' && (
          <>
            <div className="sm-toolbar">
              <div className="sm-toolbar-left" />
              <button className="sm-btn sm-btn-new" onClick={() => setShowAddUser(v => !v)}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> New User
              </button>
            </div>

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
                      <input className="sm-input" type="text" placeholder="harsh123" value={addUserForm.password} onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })} />
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
              <div className="sm-table-wrap">
                {usersLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <Spinner /><p style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'var(--mono)' }}>Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="sm-empty">No users yet. Create one to get started.</div>
                ) : (
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>User</th>
                        <th style={{ width: '12%' }}>Password</th>
                        <th style={{ width: '8%' }}>Rate/1k</th>
                        <th style={{ width: '9%' }}>Clicks</th>
                        <th style={{ width: '10%' }}>Earned</th>
                        <th style={{ width: '10%' }}>Pending</th>
                        <th style={{ width: '9%' }}>Status</th>
                        <th style={{ width: '27%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <React.Fragment key={user._id}>
                          <tr className="sm-data-row">
                            <td>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{user.realName}</div>
                              <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 2 }}>@{user.username}</div>
                            </td>
                            <td>
                              <span className="sm-mono" style={{ color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: 5, padding: '2px 8px', fontSize: 11 }}>
                                {user.password}
                              </span>
                            </td>
                            <td><span className="sm-mono" style={{ color: 'var(--teal)' }}>Rs.{user.ratePerThousand}</span></td>
                            <td><span className="sm-mono" style={{ color: 'var(--t2)' }}>{(user.totalClicks || 0).toLocaleString()}</span></td>
                            <td><span className="sm-mono" style={{ color: 'var(--green)' }}>Rs.{(user.totalEarnings || 0).toFixed(2)}</span></td>
                            <td><span className="sm-mono" style={{ color: 'var(--red)' }}>Rs.{(user.unpaidEarnings || 0).toFixed(2)}</span></td>
                            <td>
                              <span className={user.isActive ? 'sm-badge sm-badge-active' : 'sm-badge sm-badge-inactive'}>
                                <span className="sm-dot" />{user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="sm-act-group">
                                <button
                                  className={`sm-act-btn${editingUserId === user._id ? ' sm-act-btn-on' : ''}`}
                                  onClick={() => { if (editingUserId === user._id) setEditingUserId(null); else { setEditingUserId(user._id); setEditUserForm({ password: user.password, realName: user.realName, ratePerThousand: user.ratePerThousand, isActive: user.isActive }); } }}
                                  title="Edit"
                                ><i className="ti ti-edit" /></button>
                                <span className="sm-act-sep" />
                                <button className="sm-act-btn sm-act-btn-amber" onClick={() => { setPaymentModal(user); setPaymentAmount(''); setPaymentNote(''); }} title="Mark payment">
                                  <i className="ti ti-currency-rupee" />
                                </button>
                                <button className="sm-act-btn sm-act-btn-teal" onClick={() => { setCreateLinkModal(user); setCreateLinkForm({ code: '', url: '', label: '' }); }} title="Create link">
                                  <i className="ti ti-link" />
                                </button>
                                <button className="sm-act-btn" onClick={() => setProfileModal(user)} title="View profile">
                                  <i className="ti ti-user" />
                                </button>
                                <button className="sm-act-btn" onClick={() => { setActiveTab('messages'); loadMessages(user); }} title="Messages">
                                  <i className="ti ti-message-circle" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingUserId === user._id && (
                            <tr className="sm-edit-expand">
                              <td colSpan={8}>
                                <div className="sm-edit-inner">
                                  <div className="sm-edit-header">
                                    <span className="sm-edit-bar" />
                                    <span className="sm-edit-title">Edit User</span>
                                    <span className="sm-edit-sub">{user.realName}</span>
                                  </div>
                                  <div className="sm-form-grid">
                                    <div className="sm-field">
                                      <span>Real Name</span>
                                      <input className="sm-input" type="text" value={editUserForm.realName} onChange={e => setEditUserForm({ ...editUserForm, realName: e.target.value })} />
                                    </div>
                                    <div className="sm-field">
                                      <span>New Password</span>
                                      <input className="sm-input" type="text" placeholder="Leave blank to keep" value={editUserForm.password} onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })} />
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
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {users.length > 0 && (
                <div className="sm-table-footer">
                  <span className="sm-footer-count">{users.length} users &bull; {users.filter(u => u.isActive).length} active</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ REQUESTS TAB ═══ (unchanged) */}
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
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                        {req.type === 'payment' && req.amount && (
                          <div className="sm-req-amount">Rs.{req.amount.toFixed(2)}</div>
                        )}
                        {req.type === 'payment' && req.profile && (
                          <div className="sm-req-upi">
                            {req.profile.upiId && <span>UPI: {req.profile.upiId}</span>}
                            {req.profile.upiId && req.profile.upiPhone && <span> &bull; </span>}
                            {req.profile.upiPhone && <span>Phone: {req.profile.upiPhone}</span>}
                          </div>
                        )}
                        {req.type === 'link' && req.message && (
                          <div className="sm-req-msg">"{req.message}"</div>
                        )}
                        <div className="sm-req-time">{new Date(req.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      {req.status === 'pending' && (
                        <div className="sm-req-actions">
                          {req.type === 'payment' && (
                            <button
                              className="sm-btn sm-btn-success"
                              onClick={() => { const u = users.find(u => u._id === req.userId); if (u) { setPaymentModal(u); setPaymentAmount(String(req.amount || '')); } }}
                            >
                              <i className="ti ti-currency-rupee" /> Process
                            </button>
                          )}
                          {req.type === 'link' && (
                            <button
                              className="sm-btn sm-btn-teal"
                              onClick={() => { const u = users.find(u => u._id === req.userId); if (u) { setCreateLinkModal(u); setCreateLinkForm({ code: '', url: '', label: '' }); } }}
                            >
                              <i className="ti ti-link" /> Create Link
                            </button>
                          )}
                          <button className="sm-btn sm-btn-danger" onClick={() => updateRequestStatus(req._id, 'rejected')}>
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ MESSAGES TAB (with avatars from user dashboard) ═══ */}
        {activeTab === 'messages' && (
          <div className="sm-msg-layout">
            {/* Sidebar – users with avatars */}
            <div className="sm-msg-sidebar">
              <div className="sm-msg-sidebar-header">
                {broadcastMode ? 'Select Recipients' : 'Users'}
                {broadcastMode && (
                  <span className="sm-tab-badge" style={{ fontSize: 10, background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                    {selectedBroadcastUsers.length}
                  </span>
                )}
              </div>
              <div className="sm-msg-user-list">
                {broadcastMode ? (
                  <>
                    <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
                      <button className="sm-btn sm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={selectAllUsers}>All</button>
                      <button className="sm-btn sm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={deselectAllUsers}>None</button>
                    </div>
                    {users.map(user => (
                      <label key={user._id} className="sm-msg-user-btn" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedBroadcastUsers.includes(user._id)}
                          onChange={() => toggleUserSelection(user._id)}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        {renderUserAvatar(user, 28)}
                        <div>
                          <div className="sm-msg-user-name">{user.realName}</div>
                          <div className="sm-msg-user-handle">@{user.username}</div>
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  users.map(user => (
                    <button
                      key={user._id}
                      className={`sm-msg-user-btn${selectedUserMsg?._id === user._id ? ' sm-msg-user-btn-active' : ''}`}
                      onClick={() => { setBroadcastMode(false); loadMessages(user); }}
                    >
                      {renderUserAvatar(user, 28)}
                      <div>
                        <div className="sm-msg-user-name">{user.realName}</div>
                        <div className="sm-msg-user-handle">@{user.username}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat window */}
            <div className="sm-msg-window">
              {broadcastMode ? (
                <div className="sm-msg-empty" style={{ justifyContent: 'flex-start', alignItems: 'stretch', padding: 16, gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Compose Broadcast</span>
                    <button className="sm-broadcast-toggle active" onClick={toggleBroadcastMode}>
                      <i className="ti ti-arrow-back" style={{ fontSize: 13 }} /> Chat mode
                    </button>
                  </div>
                  <textarea
                    className="sm-input"
                    style={{ flex: 1, minHeight: 150, resize: 'vertical', borderRadius: 8, background: 'var(--bg0)' }}
                    placeholder={`Write a message to ${selectedBroadcastUsers.length} selected user(s)...`}
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                  />
                  <button
                    className="sm-btn sm-btn-primary"
                    style={{ alignSelf: 'flex-end' }}
                    disabled={selectedBroadcastUsers.length === 0 || !msgText.trim()}
                    onClick={sendBroadcast}
                  >
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
                    {renderUserAvatar(selectedUserMsg, 32)}
                    <div>
                      <div className="sm-msg-win-name">{selectedUserMsg.realName}</div>
                      <div className="sm-msg-win-handle">@{selectedUserMsg.username}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
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
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg._id}
                          style={{
                            display: 'flex',
                            justifyContent: msg.fromAdmin ? 'flex-start' : 'flex-end',
                            alignItems: 'flex-end',
                          }}
                        >
                          {msg.fromAdmin ? (
                            /* Admin message (left) – with avatar */
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '75%' }}>
                              <div className="sm-chat-avatar">A</div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div className="sm-bubble sm-bubble-admin">{msg.text}</div>
                                <div className="sm-bubble-time">
                                  {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  {' '}· Admin
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* User message (right) – with avatar */
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '75%', flexDirection: 'row-reverse' }}>
                              {renderUserAvatar(selectedUserMsg!, 28)}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div className="sm-bubble sm-bubble-user">{msg.text}</div>
                                <div className="sm-bubble-time">
                                  {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="sm-msg-input-row">
                    <input
                      className="sm-msg-input"
                      type="text"
                      placeholder={`Message ${selectedUserMsg.realName}...`}
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendAdminMessage()}
                    />
                    <button
                      className="sm-msg-send-btn"
                      onClick={sendAdminMessage}
                      disabled={!msgText.trim()}
                    >
                      <i className="ti ti-send" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ DELETE MODAL ═══ */}
        {deleteConfirm && (
          <div className="sm-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title">Delete Link?</div>
                  <div className="sm-modal-sub" style={{ fontFamily: 'var(--mono)', color: 'var(--teal)', marginTop: 6 }}>go.animebing.in/{deleteConfirm}</div>
                </div>
                <button className="sm-modal-close" onClick={() => setDeleteConfirm(null)}><i className="ti ti-x" /></button>
              </div>
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

        {/* ═══ PAYMENT MODAL ═══ */}
        {paymentModal && (
          <div className="sm-modal-backdrop" onClick={() => setPaymentModal(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title">Mark Payment</div>
                  <div className="sm-modal-sub">{paymentModal.realName} &bull; @{paymentModal.username}</div>
                </div>
                <button className="sm-modal-close" onClick={() => setPaymentModal(null)}><i className="ti ti-x" /></button>
              </div>
              {paymentModal.profile && (paymentModal.profile.upiId || paymentModal.profile.upiPhone) && (
                <div className="sm-upi-box">
                  {paymentModal.profile.upiId && <div className="sm-upi-row"><i className="ti ti-credit-card" style={{ marginRight: 6 }} />UPI ID: {paymentModal.profile.upiId}</div>}
                  {paymentModal.profile.upiPhone && <div className="sm-upi-row"><i className="ti ti-phone" style={{ marginRight: 6 }} />Phone: {paymentModal.profile.upiPhone}</div>}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="sm-field">
                  <span>Amount (Rs.)</span>
                  <input className="sm-input" type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>
                <div className="sm-field">
                  <span>Note (optional)</span>
                  <input className="sm-input" type="text" placeholder="Payment reference..." value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 10 }}>
                Unpaid: <strong style={{ color: 'var(--red)' }}>Rs.{paymentModal.unpaidEarnings.toFixed(2)}</strong>
              </p>
              <div className="sm-modal-footer">
                <button className="sm-btn sm-btn-ghost" onClick={() => setPaymentModal(null)}>Cancel</button>
                <button className="sm-btn sm-btn-success" onClick={handlePayment} disabled={!!payingId}>
                  <i className="ti ti-check" />{payingId ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CREATE LINK MODAL ═══ */}
        {createLinkModal && (
          <div className="sm-modal-backdrop" onClick={() => setCreateLinkModal(null)}>
            <div className="sm-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title">Create Link for User</div>
                  <div className="sm-modal-sub">{createLinkModal.realName} &bull; @{createLinkModal.username}</div>
                </div>
                <button className="sm-modal-close" onClick={() => setCreateLinkModal(null)}><i className="ti ti-x" /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="sm-field">
                  <span>Short Code</span>
                  <input className="sm-input" type="text" placeholder="e.g. myanime"
                    value={createLinkForm.code}
                    onChange={e => setCreateLinkForm({ ...createLinkForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })} />
                  {createLinkForm.code && <span className="sm-preview-url">go.animebing.in/{createLinkForm.code}</span>}
                </div>
                <div className="sm-field">
                  <span>Destination URL</span>
                  <input className="sm-input" type="url" placeholder="https://..." value={createLinkForm.url} onChange={e => setCreateLinkForm({ ...createLinkForm, url: e.target.value })} />
                </div>
                <div className="sm-field">
                  <span>Label (optional)</span>
                  <input className="sm-input" type="text" placeholder="Display name" value={createLinkForm.label} onChange={e => setCreateLinkForm({ ...createLinkForm, label: e.target.value })} />
                </div>
              </div>
              <div className="sm-modal-footer">
                <button className="sm-btn sm-btn-ghost" onClick={() => setCreateLinkModal(null)}>Cancel</button>
                <button className="sm-btn sm-btn-teal" onClick={handleCreateLinkForUser} disabled={creatingLink}>
                  <i className="ti ti-link" />{creatingLink ? 'Creating...' : 'Create & Assign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PROFILE MODAL ═══ */}
        {profileModal && (
          <div className="sm-modal-backdrop" onClick={() => setProfileModal(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-header">
                <div>
                  <div className="sm-modal-title">Profile Details</div>
                  <div className="sm-modal-sub">{profileModal.realName} &bull; @{profileModal.username}</div>
                </div>
                <button className="sm-modal-close" onClick={() => setProfileModal(null)}><i className="ti ti-x" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icon: 'ti-device-mobile', label: 'Mobile', value: profileModal.profile?.mobile },
                  { icon: 'ti-mail', label: 'Gmail', value: profileModal.profile?.gmail },
                  { icon: 'ti-credit-card', label: 'UPI ID', value: profileModal.profile?.upiId },
                  { icon: 'ti-phone', label: 'UPI Phone', value: profileModal.profile?.upiPhone },
                  { icon: 'ti-calendar', label: 'Age', value: profileModal.profile?.age?.toString() },
                  { icon: 'ti-users', label: 'Gender', value: profileModal.profile?.gender },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`ti ${icon}`} style={{ fontSize: 13, color: 'var(--t3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--t3)', marginBottom: 2 }}>{label}</div>
                      {value
                        ? <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{value}</div>
                        : <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Not provided</div>
                      }
                    </div>
                  </div>
                ))}
              </div>
              {profileModal.gmailLinked && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', borderRadius: 7, fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>
                  <i className="ti ti-brand-google" style={{ marginRight: 6 }} />Gmail linked: {profileModal.gmailLinked}
                </div>
              )}
              <div className="sm-modal-footer">
                <button className="sm-btn sm-btn-ghost" onClick={() => setProfileModal(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default ShortenerManager;