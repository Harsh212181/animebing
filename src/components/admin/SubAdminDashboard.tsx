 // src/components/admin/SubAdminDashboard.tsx — SUB-ADMIN ONLY (Premium Purple Theme)
import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import PollManager from './PollManager';
import PartnerManager from './PartnerManager';
import EpisodeStatusManager from './EpisodeStatusManager';
import DownloadPageManager from './DownloadPageManager';
import ShortenerManager from './ShortenerManager';
import ShortUsersManager from './ShortUsersManager';
import SubAdminPageViewManager from './SubAdminPageViewManager';
import UserActivityManager from './UserActivityManager';
import AnimeLinkControlManager from './AnimeLinkControlManager';
import NotesManager from './NotesManager';
import TrackListManager from './TrackListManager';
import InstagramAutomationManager from './InstagramAutomationManager';
import VideoManager from './VideoManager';
import SubAdminMyEarnings from './SubAdminMyEarnings';
import MyStorageManager from './MyStorageManager';
import Spinner from '../Spinner';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface SubAdminDashboardProps {
  onLogout?: () => void;
}

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string; fill?: boolean }> = ({ d, className = 'w-4 h-4', fill = false }) => (
  <svg
    className={className}
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={1.7}
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

// ── Icon paths ─────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  list:            'M4.5 6.5h15M4.5 12h15M4.5 17.5h9.5M4 6.5h.01M4 12h.01M4 17.5h.01',
  add:             'M12 5v14M5 12h14',
  episodes:        'M7 4v16l13-8L7 4z',
  'episode-status':'M4 7h16M4 12h10M4 17h7 M18 15l2 2 4-4',
  reports:         'M8 3h8l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM13 3v5h5M9 13h6M9 17h4',
  social:          'M12 3l2.6 5.6 6.1.6-4.5 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.5-4.2 6.1-.6L12 3z',
  polls:           'M5 20V10M12 20V4M19 20v-7',
  downloadPages:   'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  partners:        'M7 20v-2a3 3 0 013-3h4a3 3 0 013 3v2M12 12a3 3 0 100-6 3 3 0 000 6zM3 20v-1a2.5 2.5 0 012.5-2.5M21 20v-1a2.5 2.5 0 00-2.5-2.5',
  shortenerLinks:  'M9 15l6-6M8.5 8.5L11 6a3.5 3.5 0 115 5l-2.5 2.5M15.5 15.5L13 18a3.5 3.5 0 11-5-5l2.5-2.5',
  shortenerUsers:  'M5 20a5 5 0 0110 0M10 11a3 3 0 100-6 3 3 0 000 6zM17 20a4 4 0 00-3-3.87M14.5 8.13A3 3 0 1116 14',
  pageviews:       'M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z M12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  useractivity:    'M4 20h16M5 20V15M9 20V10M13 20V12M17 20V7',
  linkControl:     'M10 14a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1',
  refresh:         'M4 4v5h5M20 20v-5h-5M4.5 9A8 8 0 0119 8M19.5 15A8 8 0 015 16',
  logout:          'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  pin:             'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM12 14v8',
  chevron:         'M9 18l6-6-6-6',
  notes:           'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  tracklist:       'M4 6h16M4 10h16M4 14h10 M18 15l2 2 4-4',
  instagram:       'M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  videoUpload:     'M15 10l4.55-2.27a1 1 0 011.45.9v6.74a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  myEarnings:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-14a9 9 0 100 18 9 9 0 000-18z',
  myStorage:       'M20 7h-9m3-3v6M4 17h9m-3 3v-6M4 7h4M16 17h4',
  menu:            'M4 6h16M4 12h16M4 18h16',
  close:           'M6 18L18 6M6 6l12 12',
};

const TAB_LABELS: Record<string, string> = {
  list:            'Content List',
  add:             'Add Content',
  episodes:        'Episodes',
  'episode-status':'Episode Status',
  reports:         'User Reports',
  social:          'Social Media',
  polls:           'Poll Manager',
  downloadPages:   'Download Pages',
  partners:        'Partner Manager',
  shortenerLinks:  'Shortener Links',
  shortenerUsers:  'Shortener Users',
  pageviews:       'Analytics',
  useractivity:    'User Activity',
  linkControl:     'Link Control',
  notes:           'Notes',
  tracklist:       'Track List',
  instagram:       'Instagram Automation',
  videoUpload:     'Video Upload',
  myEarnings:      'My Earnings',
  myStorage:       'My Storage',
};

// ── Per-tab color identity ─────────────────────────────────────────
const TAB_COLORS: Record<string, {
  text: string; bg: string; ring: string; dot: string;
  from: string; to: string; glow: string;
}> = {
  list:            { text: 'text-purple-200',  bg: 'bg-purple-500/15',  ring: 'bg-purple-400',  dot: 'bg-purple-400',  from: 'from-purple-500/25',  to: 'to-purple-500/5',  glow: 'shadow-purple-500/20' },
  add:             { text: 'text-emerald-200', bg: 'bg-emerald-500/15', ring: 'bg-emerald-400', dot: 'bg-emerald-400', from: 'from-emerald-500/25', to: 'to-emerald-500/5', glow: 'shadow-emerald-500/20' },
  episodes:        { text: 'text-blue-200',    bg: 'bg-blue-500/15',    ring: 'bg-blue-400',    dot: 'bg-blue-400',    from: 'from-blue-500/25',    to: 'to-blue-500/5',    glow: 'shadow-blue-500/20' },
  'episode-status':{ text: 'text-cyan-200',    bg: 'bg-cyan-500/15',    ring: 'bg-cyan-400',    dot: 'bg-cyan-400',    from: 'from-cyan-500/25',    to: 'to-cyan-500/5',    glow: 'shadow-cyan-500/20' },
  notes:           { text: 'text-yellow-200',  bg: 'bg-yellow-500/15',  ring: 'bg-yellow-400',  dot: 'bg-yellow-400',  from: 'from-yellow-500/25',  to: 'to-yellow-500/5',  glow: 'shadow-yellow-500/20' },
  polls:           { text: 'text-violet-200',  bg: 'bg-violet-500/15',  ring: 'bg-violet-400',  dot: 'bg-violet-400',  from: 'from-violet-500/25',  to: 'to-violet-500/5',  glow: 'shadow-violet-500/20' },
  social:          { text: 'text-pink-200',    bg: 'bg-pink-500/15',    ring: 'bg-pink-400',    dot: 'bg-pink-400',    from: 'from-pink-500/25',    to: 'to-pink-500/5',    glow: 'shadow-pink-500/20' },
  reports:         { text: 'text-rose-200',    bg: 'bg-rose-500/15',    ring: 'bg-rose-400',    dot: 'bg-rose-400',    from: 'from-rose-500/25',    to: 'to-rose-500/5',    glow: 'shadow-rose-500/20' },
  instagram:       { text: 'text-fuchsia-200', bg: 'bg-fuchsia-500/15', ring: 'bg-fuchsia-400', dot: 'bg-fuchsia-400', from: 'from-fuchsia-500/25', to: 'to-fuchsia-500/5', glow: 'shadow-fuchsia-500/20' },
  downloadPages:   { text: 'text-indigo-200',  bg: 'bg-indigo-500/15',  ring: 'bg-indigo-400',  dot: 'bg-indigo-400',  from: 'from-indigo-500/25',  to: 'to-indigo-500/5',  glow: 'shadow-indigo-500/20' },
  videoUpload:     { text: 'text-sky-200',     bg: 'bg-sky-500/15',     ring: 'bg-sky-400',     dot: 'bg-sky-400',     from: 'from-sky-500/25',     to: 'to-sky-500/5',     glow: 'shadow-sky-500/20' },
  myStorage:       { text: 'text-slate-200',   bg: 'bg-slate-500/15',   ring: 'bg-slate-400',   dot: 'bg-slate-400',   from: 'from-slate-500/25',   to: 'to-slate-500/5',   glow: 'shadow-slate-500/20' },
  partners:        { text: 'text-teal-200',    bg: 'bg-teal-500/15',    ring: 'bg-teal-400',    dot: 'bg-teal-400',    from: 'from-teal-500/25',    to: 'to-teal-500/5',    glow: 'shadow-teal-500/20' },
  shortenerLinks:  { text: 'text-amber-200',   bg: 'bg-amber-500/15',   ring: 'bg-amber-400',   dot: 'bg-amber-400',   from: 'from-amber-500/25',   to: 'to-amber-500/5',   glow: 'shadow-amber-500/20' },
  shortenerUsers:  { text: 'text-orange-200',  bg: 'bg-orange-500/15',  ring: 'bg-orange-400',  dot: 'bg-orange-400',  from: 'from-orange-500/25',  to: 'to-orange-500/5',  glow: 'shadow-orange-500/20' },
  linkControl:     { text: 'text-lime-200',    bg: 'bg-lime-500/15',    ring: 'bg-lime-400',    dot: 'bg-lime-400',    from: 'from-lime-500/25',    to: 'to-lime-500/5',    glow: 'shadow-lime-500/20' },
  tracklist:       { text: 'text-red-200',     bg: 'bg-red-500/15',     ring: 'bg-red-400',     dot: 'bg-red-400',     from: 'from-red-500/25',     to: 'to-red-500/5',     glow: 'shadow-red-500/20' },
  pageviews:       { text: 'text-cyan-200',    bg: 'bg-cyan-500/15',    ring: 'bg-cyan-400',    dot: 'bg-cyan-400',    from: 'from-cyan-500/25',    to: 'to-cyan-500/5',    glow: 'shadow-cyan-500/20' },
  useractivity:    { text: 'text-blue-200',    bg: 'bg-blue-500/15',    ring: 'bg-blue-400',    dot: 'bg-blue-400',    from: 'from-blue-500/25',    to: 'to-blue-500/5',    glow: 'shadow-blue-500/20' },
  myEarnings:      { text: 'text-green-200',   bg: 'bg-green-500/15',   ring: 'bg-green-400',   dot: 'bg-green-400',   from: 'from-green-500/25',   to: 'to-green-500/5',   glow: 'shadow-green-500/20' },
};

const getTabColor = (tabId: string) =>
  TAB_COLORS[tabId] || TAB_COLORS.list;

const TAB_PERMISSIONS: Record<string, string | null> = {
  list:            null,
  add:             'add-anime',
  episodes:        'episodes',
  'episode-status':'episodes',
  reports:         'reports',
  social:          'social',
  polls:           'polls',
  downloadPages:   'downloadPages',
  partners:        'partners',
  shortenerLinks:  'shortener',
  shortenerUsers:  'shortener',
  pageviews:       'pageviews',
  useractivity:    'useractivity',
  linkControl:     'link-control',
  notes:           'notes',
  tracklist:       'tracklist',
  instagram:       'instagram',
  videoUpload:     'videoUpload',
  myEarnings:      'earnings',
  myStorage:       'r2storage',
};

// ─── Sidebar sections ────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  { id: 'overview',    label: 'Overview',        tabs: ['list', 'add', 'notes'] },
  { id: 'content',     label: 'Content Ops',     tabs: ['episodes', 'episode-status'] },
  { id: 'engagement',  label: 'Community',       tabs: ['polls', 'social', 'reports', 'instagram'] },
  { id: 'links',       label: 'Links & Media',   tabs: ['downloadPages', 'videoUpload', 'myStorage', 'partners'] },
  { id: 'shortener',   label: 'Shortener',       tabs: ['shortenerLinks', 'shortenerUsers', 'linkControl', 'tracklist'] },
  { id: 'analytics',   label: 'Insights',        tabs: ['pageviews', 'useractivity', 'myEarnings'] },
];

// ─── 🆕 Helper: element ko container ke andar smooth-scroll karke bring into view ──
function scrollChildIntoContainer(
  container: HTMLElement | null,
  child: HTMLElement | null,
  padding = 12
) {
  if (!container || !child) return;
  const cRect = container.getBoundingClientRect();
  const bRect = child.getBoundingClientRect();

  if (bRect.top < cRect.top + padding) {
    // upar cut gaya — upar scroll
    container.scrollTo({
      top: container.scrollTop - (cRect.top + padding - bRect.top),
      behavior: 'smooth',
    });
  } else if (bRect.bottom > cRect.bottom - padding) {
    // neeche cut gaya — neeche scroll
    container.scrollTo({
      top: container.scrollTop + (bRect.bottom - (cRect.bottom - padding)),
      behavior: 'smooth',
    });
  }
}

// ─── User Avatar ─────────────────────────────────────────────────────
const UserAvatar: React.FC<{ username: string; size?: number; className?: string; onClick?: () => void }> = ({
  username, size = 32, className = '', onClick,
}) => {
  const initial = (username || 'S').charAt(0).toUpperCase();
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600 flex items-center justify-center text-white font-bold select-none cursor-pointer transition-all hover:ring-2 hover:ring-purple-400/60 hover:scale-105 shadow-lg shadow-purple-500/30 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(size * 0.42, 10) }}
    >
      <span className="relative z-10">{initial}</span>
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
};

// ─── Brand Logo ─────────────────────────────────────────────────────
const BrandLogo: React.FC = () => (
  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/40 select-none">
    <svg viewBox="0 0 24 24" className="w-5 h-5 relative z-10" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent opacity-60" />
  </div>
);

// ─── Purple Loading Screen ───────────────────────────────────────────
const SimpleLoadingScreen: React.FC = () => {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 50% 40%, #4c1d95 0%, #3b0764 40%, #1e0533 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      isolation: 'isolate',
    }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.035, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <filter id="ad-loading-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ad-loading-noise)" />
      </svg>

      <style>{`
        @keyframes ad-ls-spin { to { transform: rotate(360deg); } }
        @keyframes ad-ls-fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .ad-ls-spinner {
          width: 56px; height: 56px;
          border: 4px solid rgba(192,132,252,0.15);
          border-top-color: #c084fc;
          border-radius: 50%;
          animation: ad-ls-spin 0.8s linear infinite;
        }
        .ad-ls-card { animation: ad-ls-fadeIn 0.4s ease both; }
      `}</style>

      <div className="ad-ls-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div className="ad-ls-spinner" style={{ marginBottom: 24 }} />
        <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 900 }}>
          <span style={{ color: '#e9d5ff' }}>Anime</span>
          <span style={{
            background: 'linear-gradient(90deg, #c084fc, #a855f7, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>bing</span>
        </h1>
        <p style={{ margin: 0, color: 'rgba(196,181,253,0.55)', fontSize: 11, fontWeight: 600, letterSpacing: 2 }}>
          Loading...
        </p>
      </div>
    </div>
  );
};

// ─── Nav Item (Premium) ─────────────────────────────────────────────
interface NavItemProps {
  tabId: string;
  activeTab: string;
  onClick: (id: string) => void;
  badgeCount?: number;
  itemRef?: (el: HTMLButtonElement | null) => void;   // 🆕
}

const NavItem: React.FC<NavItemProps> = ({ tabId, activeTab, onClick, badgeCount = 0, itemRef }) => {
  const isActive = activeTab === tabId;
  const label = TAB_LABELS[tabId] || tabId;
  const iconPath = ICONS[tabId] || ICONS.list;
  const color = getTabColor(tabId);

  return (
    <button
      ref={itemRef}                                    // 🆕
      onClick={() => onClick(tabId)}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left overflow-hidden
        ${isActive
          ? `bg-gradient-to-r ${color.from} ${color.to} ${color.text} shadow-lg ${color.glow}`
          : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100'
        }`}
    >
      {/* Active left accent bar */}
      {isActive && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${color.ring} rounded-r-full shadow-lg`} />
      )}

      {/* Icon with subtle scale on hover */}
      <span className={`flex-shrink-0 w-5 h-5 transition-transform duration-200 ${isActive ? color.text : 'group-hover:scale-110'}`}>
        <SvgIcon d={iconPath} className="w-5 h-5" />
      </span>

      <span className={`text-sm font-medium truncate flex-1 ${isActive ? 'font-semibold' : ''}`}>
        {label}
      </span>

      {badgeCount > 0 && (
        <span className="ml-auto bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md shadow-rose-500/30 ring-1 ring-white/10">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}

      {/* Subtle shine effect on active */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.06] to-transparent pointer-events-none" />
      )}
    </button>
  );
};

// ─── Sidebar Section Header (Premium) ───────────────────────────────
const SidebarSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-1">
    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 select-none flex items-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <span className="flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-purple-400/60" />
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </p>
    <div className="space-y-1 px-2">{children}</div>
  </div>
);

// ─── Tab Content ─────────────────────────────────────────────────────
function renderTab(tabId: string, token: string) {
  switch (tabId) {
    case 'list':           return <AnimeListTable token={token} />;
    case 'add':            return <AddAnimeForm token={token} />;
    case 'episodes':       return <EpisodesManager token={token} />;
    case 'episode-status': return <EpisodeStatusManager token={token} />;
    case 'reports':        return <ReportsManager token={token} />;
    case 'social':         return <SocialMediaManager token={token} />;
    case 'polls':          return <PollManager token={token} apiBase={API_BASE} />;
    case 'partners':       return <PartnerManager token={token} apiBase={API_BASE} />;
    case 'downloadPages':  return <DownloadPageManager token={token} subAdminMode />;
    case 'shortenerLinks': return <ShortenerManager token={token} subAdminMode />;
    case 'shortenerUsers': return <ShortUsersManager token={token} subAdminMode />;
    case 'pageviews':      return <SubAdminPageViewManager token={token} />;
    case 'useractivity':   return <UserActivityManager token={token} subAdminMode />;
    case 'linkControl':    return <AnimeLinkControlManager token={token} />;
    case 'notes':          return <NotesManager token={token} apiBase={API_BASE} />;
    case 'tracklist':      return <TrackListManager />;
    case 'instagram':      return <InstagramAutomationManager token={token} apiBase={API_BASE} subAdminMode />;
    case 'videoUpload':    return <VideoManager token={token} subAdminMode />;
    case 'myEarnings':     return <SubAdminMyEarnings token={token} />;
    case 'myStorage':      return <MyStorageManager token={token} />;
    default:               return null;
  }
}

const TabContent: React.FC<{ activeTab: string; visitedTabs: Set<string>; token: string }> =
  React.memo(({ activeTab, visitedTabs, token }) => (
    <>
      {Array.from(visitedTabs).map(tabId => (
        <div key={tabId} style={{ display: activeTab === tabId ? 'block' : 'none' }}>
          {renderTab(tabId, token)}
        </div>
      ))}
    </>
  ));

// ─── Scroll to top button ────────────────────────────────────────────
const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;
    const fn = () => setVisible(el.scrollTop > 300);
    el.addEventListener('scroll', fn);
    return () => el.removeEventListener('scroll', fn);
  }, []);
  return (
    <button
      onClick={() => document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-xl shadow-purple-500/40 transition-all duration-300 hover:scale-110 ${ 
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
      aria-label="Scroll to top"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────
const SubAdminDashboard: React.FC<SubAdminDashboardProps> = ({ onLogout }) => {
  const token = sessionStorage.getItem('subAdminToken') || '';
  const permissions: string[] = (() => {
    try { return JSON.parse(sessionStorage.getItem('subAdminPermissions') || '[]'); }
    catch { return []; }
  })();

  const canAccessTab = (tabId: string): boolean => {
    const required = TAB_PERMISSIONS[tabId];
    if (required === null) return true;
    return permissions.includes(required);
  };

  const visibleTabs = Object.keys(TAB_LABELS).filter(canAccessTab);
  const visibleSections = SIDEBAR_SECTIONS
    .map(section => ({ ...section, tabs: section.tabs.filter(canAccessTab) }))
    .filter(section => section.tabs.length > 0);

  const [activeTab, setActiveTab] = useState(visibleTabs[0] || 'list');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([visibleTabs[0] || 'list']));

  useEffect(() => {
    if (!canAccessTab(activeTab)) return;
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🆕 Refs for auto-scroll to active tab in each nav
  const iconRailRef = useRef<HTMLDivElement>(null);
  const expandedNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const iconRailBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const expandedNavBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileNavBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 🆕 Auto-scroll active tab into view — when tab changes, sidebar opens, mobile menu opens, or pin state changes
  useEffect(() => {
    // thoda delay, taaki transition/open animation ho jaaye
    const id = window.setTimeout(() => {
      scrollChildIntoContainer(iconRailRef.current, iconRailBtnRefs.current[activeTab], 10);
      scrollChildIntoContainer(expandedNavRef.current, expandedNavBtnRefs.current[activeTab], 14);
      scrollChildIntoContainer(mobileNavRef.current, mobileNavBtnRefs.current[activeTab], 14);
    }, 60);
    return () => window.clearTimeout(id);
  }, [activeTab, sidebarCollapsed, sidebarPinned, mobileMenuOpen]);

  const handleSidebarMouseEnter = () => {
    if (sidebarPinned) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setSidebarCollapsed(false);
  };
  const handleSidebarMouseLeave = () => {
    if (sidebarPinned) return;
    hoverTimeout.current = setTimeout(() => setSidebarCollapsed(true), 300);
  };

  const handleMobileNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState({ username: '' });
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting...');
      setTimeout(() => { window.location.href = '/sub-admin-login'; }, 2000);
      return;
    }
    if (!canAccessTab(activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0]);
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!token || !canAccessTab('shortenerUsers')) return;
    const interval = setInterval(async () => {
      try {
        const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
        const res = await inst.get(`${API_BASE}/short-users/admin/messages-count`);
        setUnreadMessagesCount(res.data?.unread || 0);
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true); setError('');
    try {
      const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const res = await inst.get(`${API_BASE}/sub-admin/me`);
      const d = res.data?.data || {};
      setUser({ username: d.username || 'Sub-Admin' });

      if (canAccessTab('reports')) {
        try {
          const countRes = await inst.get(`${API_BASE}/admin/reports/pending-count`);
          setPendingReportsCount(countRes.data?.count || 0);
        } catch { /* ignore */ }
      }

      if (canAccessTab('shortenerUsers')) {
        try {
          const msgCountRes = await inst.get(`${API_BASE}/short-users/admin/messages-count`);
          setUnreadMessagesCount(msgCountRes.data?.unread || 0);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load dashboard data.';
      setError(msg);
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('subAdminToken');
        sessionStorage.removeItem('subAdminUsername');
        sessionStorage.removeItem('subAdminPermissions');
        sessionStorage.removeItem('subAdminAnimeAccess');
        window.location.href = '/sub-admin-login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('subAdminToken');
    sessionStorage.removeItem('subAdminUsername');
    sessionStorage.removeItem('subAdminPermissions');
    sessionStorage.removeItem('subAdminAnimeAccess');
    if (onLogout) onLogout();
    else window.location.href = '/sub-admin-login';
  };

  if (loading) return <SimpleLoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0e17] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <SvgIcon d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" className="w-6 h-6 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-rose-400 mb-3">Dashboard Error</h2>
          <p className="text-gray-300 mb-6 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={loadInitialData} className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition">
              <SvgIcon d={ICONS.refresh} className="w-4 h-4" /> Retry
            </button>
            <button onClick={() => window.location.href = '/sub-admin-login'} className="px-5 py-2 bg-rose-700/60 hover:bg-rose-600/80 rounded-lg text-sm font-medium transition">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#0b0a14] text-white overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1c1b29', color: '#fff', border: '1px solid #3f3d56' },
          success: { style: { border: '1px solid #10b981' } },
          error:   { style: { border: '1px solid #ef4444' } },
        }}
      />

      {/* ─── Icon Strip (collapsed rail) ──────────────────────────── */}
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="hidden sm:flex fixed top-0 left-0 h-full w-[64px] z-50 flex-col bg-[#0f0e1a] border-r border-white/[0.06]"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
        </div>

        {/* Icon rail */}
        <div
          ref={iconRailRef}                                  /* 🆕 */
          className="flex-1 flex flex-col items-center py-4 gap-1.5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
        >
          {visibleTabs.map(tabId => {
            const color = getTabColor(tabId);
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                ref={el => { iconRailBtnRefs.current[tabId] = el; }}   /* 🆕 */
                onClick={() => setActiveTab(tabId)}
                title={TAB_LABELS[tabId]}
                className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  isActive
                    ? `bg-gradient-to-br ${color.from} ${color.to} shadow-lg ${color.glow}`
                    : 'hover:bg-white/[0.06]'
                }`}
              >
                {/* Active accent bar (left) */}
                {isActive && (
                  <span className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 ${color.ring} rounded-r-full`} />
                )}
                <SvgIcon
                  d={ICONS[tabId] || ICONS.list}
                  className={`w-[18px] h-[18px] transition-all duration-200 ${
                    isActive ? color.text : 'text-gray-500 group-hover:text-gray-200 group-hover:scale-110'
                  }`}
                />
                {tabId === 'reports' && pendingReportsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-full ring-2 ring-[#0f0e1a] shadow-md shadow-rose-500/50" />
                )}
                {tabId === 'shortenerLinks' && unreadMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-full ring-2 ring-[#0f0e1a] shadow-md shadow-rose-500/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* User avatar at bottom */}
        <div className="flex-shrink-0 border-t border-white/[0.06] h-16 flex items-center justify-center">
          <UserAvatar username={user.username} size={36} onClick={() => setSidebarCollapsed(false)} />
        </div>
      </div>

      {/* ─── Expanded Sidebar (hover-out panel) ────────────────────── */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease' }}
        className={`hidden sm:flex fixed top-0 left-0 h-full z-50 flex-col w-[260px] bg-[#0f0e1a] border-r border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60
          ${sidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-[15px] font-bold text-white leading-tight truncate tracking-tight">AnimaBing</p>
            <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-widest truncate mt-0.5">Sub-Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarPinned(v => !v)}
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              sidebarPinned
                ? 'text-purple-300 bg-purple-500/20 ring-1 ring-purple-500/40 shadow-md shadow-purple-500/20'
                : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.06]'
            }`}
            title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            <svg className="w-3.5 h-3.5" fill={sidebarPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav
          ref={expandedNavRef}                                /* 🆕 */
          className="relative flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
        >
          {visibleSections.map(section => (
            <SidebarSection key={section.id} label={section.label}>
              {section.tabs.map(tabId => (
                <NavItem
                  key={tabId}
                  tabId={tabId}
                  activeTab={activeTab}
                  onClick={setActiveTab}
                  itemRef={el => { expandedNavBtnRefs.current[tabId] = el; }}   /* 🆕 */
                  badgeCount={
                    tabId === 'reports' ? pendingReportsCount :
                    tabId === 'shortenerLinks' ? unreadMessagesCount : 0
                  }
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        {/* User footer */}
        <div className="relative flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] p-2.5 transition-colors">
            <UserAvatar username={user.username} size={36} />
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.username || 'Sub-Admin'}</p>
              <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mt-0.5">Sub-Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/15 transition-all"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── 📱 Mobile Drawer ─── */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        className={`sm:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] transition-opacity duration-200 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}
        className={`sm:hidden fixed top-0 left-0 h-full z-[70] flex flex-col w-[280px] max-w-[82vw] bg-[#0f0e1a] border-r border-white/[0.08] shadow-2xl shadow-black/70
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="relative flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-[15px] font-bold text-white leading-tight truncate tracking-tight">AnimaBing</p>
            <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-widest truncate mt-0.5">Sub-Admin Panel</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <SvgIcon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <nav
          ref={mobileNavRef}                                  /* 🆕 */
          className="relative flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
        >
          {visibleSections.map(section => (
            <SidebarSection key={section.id} label={section.label}>
              {section.tabs.map(tabId => (
                <NavItem
                  key={tabId}
                  tabId={tabId}
                  activeTab={activeTab}
                  onClick={handleMobileNavClick}
                  itemRef={el => { mobileNavBtnRefs.current[tabId] = el; }}   /* 🆕 */
                  badgeCount={
                    tabId === 'reports' ? pendingReportsCount :
                    tabId === 'shortenerLinks' ? unreadMessagesCount : 0
                  }
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        <div className="relative flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
            <UserAvatar username={user.username} size={36} />
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.username || 'Sub-Admin'}</p>
              <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mt-0.5">Sub-Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/15 transition-all"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content area ────────────────────────────────────── */}
      <div id="main-scroll" className="relative z-10 h-full flex flex-col overflow-y-auto sm:pl-[64px] [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
        <header className="sticky top-0 z-40 h-16 flex-shrink-0 flex items-center px-4 sm:px-6 gap-3 bg-[#0f0e1a]/85 backdrop-blur-xl border-b border-white/[0.06]">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden flex-shrink-0 w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Open menu"
          >
            <SvgIcon d={ICONS.menu} className="w-5 h-5" />
          </button>

          <span className={`hidden sm:inline-flex w-5 h-5 ${getTabColor(activeTab).text}`}>
            <SvgIcon d={ICONS[activeTab] || ICONS.list} className="w-5 h-5" />
          </span>
          <h1 className="text-[15px] font-semibold text-white truncate tracking-tight">{TAB_LABELS[activeTab]}</h1>
          <span className="hidden xs:inline-flex text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-200 border border-purple-500/30 flex-shrink-0 font-semibold uppercase tracking-wider shadow-md shadow-purple-500/10">
            Sub-Admin
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={loadInitialData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition border border-white/[0.06] hover:border-white/[0.12]"
            >
              <SvgIcon d={ICONS.refresh} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <UserAvatar username={user.username} size={32} />
          </div>
        </header>

        <main className="flex-1 py-4 sm:py-6 px-0 space-y-4">
          <div className="bg-white/[0.03] border-y sm:border border-white/[0.06] rounded-none sm:rounded-2xl p-0 min-h-[300px] overflow-hidden">
            {canAccessTab(activeTab) ? (
              <TabContent activeTab={activeTab} visitedTabs={visitedTabs} token={token} />
            ) : (
              <div className="text-center py-12 text-gray-500 px-4">
                You don't have permission to access this section.
              </div>
            )}
          </div>
        </main>
      </div>

      <ScrollToTopButton />
    </div>
  );
};

export default SubAdminDashboard;