 // src/components/admin/AdminDashboard.tsx - Premium Colorful Sidebar (No Background Glow)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import FeaturedAnimeManager from './FeaturedAnimeManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import PollManager from './PollManager';
import PartnerManager from './PartnerManager';
import PageViewManager from './PageViewManager';
import EpisodeStatusManager from './EpisodeStatusManager';
import DownloadPageManager from './DownloadPageManager';
import ShortenerManager from './ShortenerManager';
import ShortUsersManager from './ShortUsersManager';
import SubAdminManager from './SubAdminManager';
import AnimeLinkControlManager from './AnimeLinkControlManager';
import SpecialModeManager from './SpecialModeManager';
import NotesManager from './NotesManager';
import TrackListManager from './TrackListManager';
import InstagramAutomationManager from './InstagramAutomationManager';
import UserActivityManager from './UserActivityManager';
import FormBuilderManager from './FormBuilderManager';
import R2ProviderManager from './R2ProviderManager';
import VideoManager from './VideoManager';
import SubAdminEarningsManager from './SubAdminEarningsManager';
import Spinner from '../Spinner';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface AdminDashboardProps {
  onLogout?: () => void;
}

interface LinkSettings {
  link1: boolean;
  link2: boolean;
  link3: boolean;
  link4: boolean;
  link5: boolean;
  autoSundayMode: boolean;
  autoModeEnabled?: boolean;
  _id?: string;
  lastUpdated?: string;
}

const LINK_NAMES: Record<number, string> = {
  1: 'Cuty.io',
  2: 'Shrinkme',
  3: 'Linkjust.com',
  4: 'Gplinks',
  5: 'Link 5',
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const getCurrentDayInIndia = (): string => {
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.toLocaleDateString('en-IN', { weekday: 'long' });
};

// SVG icon factory
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// Pre-defined icon paths (Heroicons outline style)
const ICONS: Record<string, string> = {
  list:            'M4 6h16M4 10h16M4 14h16M4 18h16',
  add:             'M12 4v16m8-8H4',
  episodes:        'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
  'episode-status':'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  featured:        'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  reports:         'M3 21v-4m0 0V5a2 2 0 012-2h14a2 2 0 012 2v12m-4 4v-4m-4 4v-4m-4 4v-4',
  polls:           'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  social:          'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z',
  downloadPages:   'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  shortener:       'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  shortusers:      'M9 12a3 3 0 100-6 3 3 0 000 6zm0 0c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3zM15 8h4m-4 4h4m-4 4h2M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  partners:        'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  pageviews:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  subadmins:       'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  linkControl:     'M4 6h4m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m4 0h4M4 12h10m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m4 0h-2M4 18h4m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m4 0h6',
  specialModes:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  notes:           'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  trackList:       'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  instagram:       'M12 3l2.6 5.6 6.1.6-4.5 4.2 1.3 6-5.5-3-5.5 3 1.3-6-4.5-4.2 6.1-.6L12 3z',
  userActivity:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6-4a2 2 0 100-4 2 2 0 000 4zm0 0v4m0-4V9',
  forms:           'M9 12h6m-6 4h4m1 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  r2providers:     'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  videoUpload:     'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  earnings:        'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-14a9 9 0 100 18 9 9 0 000-18z',
  menu:            'M4 6h16M4 12h16M4 18h16',
  close:           'M6 18L18 6M6 6l12 12',
};

const TAB_LABELS: Record<string, string> = {
  list:            'Content List',
  add:             'Add Content',
  episodes:        'Episodes',
  'episode-status':'Episode Status',
  featured:        'Featured Anime',
  reports:         'User Reports',
  social:          'Social Media',
  polls:           'Poll Manager',
  downloadPages:   'Download Pages',
  shortener:       'URL Shortener',
  shortusers:      'Short Users',
  partners:        'Partner Manager',
  pageviews:       'Page Views',
  subadmins:       'Sub-Admins',
  linkControl:     'Anime Link Control',
  specialModes:    'Special Modes',
  notes:           'Notes',
  trackList:       'Track List',
  instagram:       'Instagram Tool',
  userActivity:    'User Activity',
  forms:           'Form Builder',
  r2providers:     'R2 Providers',
  videoUpload:     'Video Upload',
  earnings:        'Sub-Admin Earnings',
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
  featured:        { text: 'text-amber-200',   bg: 'bg-amber-500/15',   ring: 'bg-amber-400',   dot: 'bg-amber-400',   from: 'from-amber-500/25',   to: 'to-amber-500/5',   glow: 'shadow-amber-500/20' },
  reports:         { text: 'text-rose-200',    bg: 'bg-rose-500/15',    ring: 'bg-rose-400',    dot: 'bg-rose-400',    from: 'from-rose-500/25',    to: 'to-rose-500/5',    glow: 'shadow-rose-500/20' },
  polls:           { text: 'text-violet-200',  bg: 'bg-violet-500/15',  ring: 'bg-violet-400',  dot: 'bg-violet-400',  from: 'from-violet-500/25',  to: 'to-violet-500/5',  glow: 'shadow-violet-500/20' },
  social:          { text: 'text-pink-200',    bg: 'bg-pink-500/15',    ring: 'bg-pink-400',    dot: 'bg-pink-400',    from: 'from-pink-500/25',    to: 'to-pink-500/5',    glow: 'shadow-pink-500/20' },
  downloadPages:   { text: 'text-indigo-200',  bg: 'bg-indigo-500/15',  ring: 'bg-indigo-400',  dot: 'bg-indigo-400',  from: 'from-indigo-500/25',  to: 'to-indigo-500/5',  glow: 'shadow-indigo-500/20' },
  shortener:       { text: 'text-teal-200',    bg: 'bg-teal-500/15',    ring: 'bg-teal-400',    dot: 'bg-teal-400',    from: 'from-teal-500/25',    to: 'to-teal-500/5',    glow: 'shadow-teal-500/20' },
  shortusers:      { text: 'text-orange-200',  bg: 'bg-orange-500/15',  ring: 'bg-orange-400',  dot: 'bg-orange-400',  from: 'from-orange-500/25',  to: 'to-orange-500/5',  glow: 'shadow-orange-500/20' },
  partners:        { text: 'text-lime-200',    bg: 'bg-lime-500/15',    ring: 'bg-lime-400',    dot: 'bg-lime-400',    from: 'from-lime-500/25',    to: 'to-lime-500/5',    glow: 'shadow-lime-500/20' },
  pageviews:       { text: 'text-cyan-200',    bg: 'bg-cyan-500/15',    ring: 'bg-cyan-400',    dot: 'bg-cyan-400',    from: 'from-cyan-500/25',    to: 'to-cyan-500/5',    glow: 'shadow-cyan-500/20' },
  subadmins:       { text: 'text-fuchsia-200', bg: 'bg-fuchsia-500/15', ring: 'bg-fuchsia-400', dot: 'bg-fuchsia-400', from: 'from-fuchsia-500/25', to: 'to-fuchsia-500/5', glow: 'shadow-fuchsia-500/20' },
  linkControl:     { text: 'text-sky-200',     bg: 'bg-sky-500/15',     ring: 'bg-sky-400',     dot: 'bg-sky-400',     from: 'from-sky-500/25',     to: 'to-sky-500/5',     glow: 'shadow-sky-500/20' },
  specialModes:    { text: 'text-yellow-200',  bg: 'bg-yellow-500/15',  ring: 'bg-yellow-400',  dot: 'bg-yellow-400',  from: 'from-yellow-500/25',  to: 'to-yellow-500/5',  glow: 'shadow-yellow-500/20' },
  notes:           { text: 'text-yellow-200',  bg: 'bg-yellow-500/15',  ring: 'bg-yellow-400',  dot: 'bg-yellow-400',  from: 'from-yellow-500/25',  to: 'to-yellow-500/5',  glow: 'shadow-yellow-500/20' },
  trackList:       { text: 'text-red-200',     bg: 'bg-red-500/15',     ring: 'bg-red-400',     dot: 'bg-red-400',     from: 'from-red-500/25',     to: 'to-red-500/5',     glow: 'shadow-red-500/20' },
  instagram:       { text: 'text-fuchsia-200', bg: 'bg-fuchsia-500/15', ring: 'bg-fuchsia-400', dot: 'bg-fuchsia-400', from: 'from-fuchsia-500/25', to: 'to-fuchsia-500/5', glow: 'shadow-fuchsia-500/20' },
  userActivity:    { text: 'text-blue-200',    bg: 'bg-blue-500/15',    ring: 'bg-blue-400',    dot: 'bg-blue-400',    from: 'from-blue-500/25',    to: 'to-blue-500/5',    glow: 'shadow-blue-500/20' },
  forms:           { text: 'text-emerald-200', bg: 'bg-emerald-500/15', ring: 'bg-emerald-400', dot: 'bg-emerald-400', from: 'from-emerald-500/25', to: 'to-emerald-500/5', glow: 'shadow-emerald-500/20' },
  r2providers:     { text: 'text-slate-200',   bg: 'bg-slate-500/15',   ring: 'bg-slate-400',   dot: 'bg-slate-400',   from: 'from-slate-500/25',   to: 'to-slate-500/5',   glow: 'shadow-slate-500/20' },
  videoUpload:     { text: 'text-sky-200',     bg: 'bg-sky-500/15',     ring: 'bg-sky-400',     dot: 'bg-sky-400',     from: 'from-sky-500/25',     to: 'to-sky-500/5',     glow: 'shadow-sky-500/20' },
  earnings:        { text: 'text-green-200',   bg: 'bg-green-500/15',   ring: 'bg-green-400',   dot: 'bg-green-400',   from: 'from-green-500/25',   to: 'to-green-500/5',   glow: 'shadow-green-500/20' },
};

const getTabColor = (tabId: string) =>
  TAB_COLORS[tabId] || TAB_COLORS.list;

// ─── renderTab function ──────────────────────────────────────────────────────
function renderTab(tabId: string, token: string) {
  switch (tabId) {
    case 'list':           return <AnimeListTable token={token} isMainAdmin={true} />;
    case 'add':            return <AddAnimeForm />;
    case 'episodes':       return <EpisodesManager token={token || ''} isMainAdmin={true} />;
    case 'featured':       return <FeaturedAnimeManager />;
    case 'reports':        return <ReportsManager />;
    case 'social':         return <SocialMediaManager />;
    case 'polls':          return <PollManager token={token} apiBase={API_BASE} />;
    case 'episode-status': return <EpisodeStatusManager token={token || ''} isMainAdmin={true} />;
    case 'partners':       return <PartnerManager token={token} apiBase={API_BASE} isMainAdmin={true} />;
    case 'downloadPages':  return <DownloadPageManager />;
    case 'shortener':      return <ShortenerManager />;
    case 'shortusers':     return <ShortUsersManager />;
    case 'pageviews':      return <PageViewManager token={token} />;
    case 'subadmins':      return <SubAdminManager />;
    case 'linkControl':    return <AnimeLinkControlManager />;
    case 'specialModes':   return <SpecialModeManager token={token} apiBase={API_BASE} />;
    case 'notes':          return <NotesManager token={token} apiBase={API_BASE} isSuperAdmin={true} />;
    case 'trackList':      return <TrackListManager />;
    case 'instagram':      return <InstagramAutomationManager token={token} apiBase={API_BASE} />;
    case 'userActivity':   return <UserActivityManager token={token} />;
    case 'forms':          return <FormBuilderManager token={token} />;
    case 'r2providers':    return <R2ProviderManager token={token} />;
    case 'videoUpload':    return <VideoManager token={token} />;
    case 'earnings':       return <SubAdminEarningsManager token={token} />;
    default:               return <AnimeListTable token={token} isMainAdmin={true} />;
  }
}

// ─── TabContent ──────────────────────────────────────────────────────────────
const TabContent: React.FC<{ activeTab: string; visitedTabs: Set<string>; token: string; tabRefreshVersions: Record<string, number> }> =
  React.memo(({ activeTab, visitedTabs, token, tabRefreshVersions }) => (
    <>
      {Array.from(visitedTabs).map(tabId => (
        <div
          key={`${tabId}-${tabRefreshVersions[tabId] || 0}`}
          style={{ display: activeTab === tabId ? 'block' : 'none' }}
        >
          {renderTab(tabId, token)}
        </div>
      ))}
    </>
  ));

// ─── Scroll to top ───────────────────────────────────────────────────────────
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

// ─── Sidebar components ──────────────────────────────────────────────────────
const BrandLogo: React.FC = () => (
  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/40 select-none">
    <svg viewBox="0 0 24 24" className="w-5 h-5 relative z-10" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent opacity-60" />
  </div>
);

// ── User Avatar ──
const UserAvatar: React.FC<{ username: string; size?: number; className?: string; onClick?: () => void }> = ({
  username, size = 32, className = '', onClick,
}) => {
  const initial = (username || 'A').charAt(0).toUpperCase();
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

interface NavItemProps {
  tabId: string;
  activeTab: string;
  collapsed: boolean;
  badge?: number;
  onClick: (id: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({ tabId, activeTab, collapsed, badge, onClick }) => {
  const isActive = activeTab === tabId;
  const label = TAB_LABELS[tabId] || tabId;
  const iconPath = ICONS[tabId] || ICONS.list;
  const color = getTabColor(tabId);

  return (
    <button
      onClick={() => onClick(tabId)}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left overflow-hidden
        ${isActive
          ? `bg-gradient-to-r ${color.from} ${color.to} ${color.text} shadow-lg ${color.glow}`
          : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100'
        }`}
    >
      {isActive && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${color.ring} rounded-r-full shadow-lg`} />
      )}

      <span className={`flex-shrink-0 w-5 h-5 transition-transform duration-200 ${isActive ? color.text : 'group-hover:scale-110'}`}>
        <SvgIcon d={iconPath} className="w-5 h-5" />
      </span>

      <span className={`text-sm font-medium truncate flex-1 ${isActive ? 'font-semibold' : ''}`}>
        {label}
      </span>

      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md shadow-rose-500/30 ring-1 ring-white/10">
          {badge > 9 ? '9+' : badge}
        </span>
      )}

      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.06] to-transparent pointer-events-none" />
      )}
    </button>
  );
};

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

// ─── ✅ Simple Purple Loading Screen ─────────────────────────────────────────
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
          Loading Dashboard...
        </p>
      </div>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tabRefreshVersions, setTabRefreshVersions] = useState<Record<string, number>>({});
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['list']));

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

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
    handleTabChange(tabId);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [linkSettingsLoading, setLinkSettingsLoading] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState({
    totalAnimes: 0, totalMovies: 0, totalEpisodes: 0,
    todayUsers: 0, totalUsers: 0, totalManga: 0,
  });
  const [user, setUser] = useState({ username: '', email: '', profileImage: '' });
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true, link2: true, link3: true, link4: true, link5: true,
    autoSundayMode: false,
  });

  const [restorePreview, setRestorePreview] = useState<{ forced: boolean; willRestoreTo?: Record<string, boolean> }>({ forced: false });

  const [downloadStats, setDownloadStats] = useState({ totalPages: 0, totalDownloadEpisodes: 0 });
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [unreadShortMessagesCount, setUnreadShortMessagesCount] = useState(0);
  const [trackUnreadCount, setTrackUnreadCount] = useState(0);

  const token = localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const currentDayName = useMemo(() => getCurrentDayInIndia(), []);

  const REPORTS_SEEN_KEY = 'adminReportsLastSeenAt';
  const getLastSeenReportsAt = () => localStorage.getItem(REPORTS_SEEN_KEY) || '';

  const fetchPendingReportsCount = async () => {
    try {
      const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
      const since = getLastSeenReportsAt();
      const url = since
        ? `${API_BASE}/admin/reports/pending-count?since=${encodeURIComponent(since)}`
        : `${API_BASE}/admin/reports/pending-count`;
      const res = await inst.get(url);
      setPendingReportsCount(res.data?.count || 0);
    } catch { /* ignore */ }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'reports') {
      localStorage.setItem(REPORTS_SEEN_KEY, new Date().toISOString());
      setPendingReportsCount(0);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting...');
      setTimeout(() => { window.location.href = '/'; }, 2000);
      return;
    }
    loadInitialData();
    fetchLinkSettings();
    fetchDownloadStats();
    fetchRestorePreview();
    fetchPendingReportsCount();
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
        const res = await inst.get(`${API_BASE}/short-users/admin/messages-count`);
        setUnreadShortMessagesCount(res.data?.unread || 0);
      } catch { /* ignore */ }
      try {
        const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
        const res = await inst.get(`${API_BASE}/track/notifications/summary`);
        const unread = (res.data?.total || 0) - (res.data?.completed || 0);
        setTrackUnreadCount(unread > 0 ? unread : 0);
      } catch { /* ignore */ }
      fetchPendingReportsCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const loadInitialData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const [userRes, analyticsRes] = await Promise.all([
        inst.get(`${API_BASE}/admin/user-info`),
        inst.get(`${API_BASE}/admin/analytics`),
      ]);
      setUser(userRes.data);
      setAnalytics(analyticsRes.data);

      fetchPendingReportsCount();

      try {
        const msgCountRes = await inst.get(`${API_BASE}/short-users/admin/messages-count`);
        setUnreadShortMessagesCount(msgCountRes.data?.unread || 0);
      } catch { /* ignore */ }

      try {
        const trackRes = await inst.get(`${API_BASE}/track/notifications/summary`);
        const unread = (trackRes.data?.total || 0) - (trackRes.data?.completed || 0);
        setTrackUnreadCount(unread > 0 ? unread : 0);
      } catch { /* ignore */ }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load dashboard data.';
      setError(msg);
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        window.location.href = '/';
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchLinkSettings = async () => {
    try {
      setLinkSettingsLoading(true);
      const { data } = await axios.get(`${API_BASE}/link-settings`, { timeout: 5000 });
      setLinkSettings(data);
    } catch (e) {
      console.error('Link settings fetch failed', e);
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const fetchRestorePreview = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/link-settings/restore-preview`, { timeout: 5000 });
      setRestorePreview(data);
    } catch { /* ignore */ }
  };

  const fetchDownloadStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/download-pages/stats`, { timeout: 5000, headers: { Authorization: `Bearer ${token}` } });
      setDownloadStats(res.data);
    } catch (e) {
      console.error('Download stats fetch failed', e);
    }
  };

  const toggleLink = async (num: number) => {
    if (num < 1 || num > 5) return;
    try {
      setLinkSettingsLoading(true);
      const { data } = await axios.put(`${API_BASE}/link-settings/toggle/${num}`, {}, authHeaders());
      if (data.settings) setLinkSettings(data.settings);
      toast.success(`${LINK_NAMES[num]} is now ${data.toggledLink?.status ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (err: any) {
      toast.error(`Failed to toggle: ${err.response?.data?.error || err.message}`);
    } finally { setLinkSettingsLoading(false); }
  };

  const getLinkStatus = (num: number): boolean => {
    const map: Record<number, boolean> = {
      1: linkSettings.link1, 2: linkSettings.link2, 3: linkSettings.link3,
      4: linkSettings.link4, 5: linkSettings.link5,
    };
    return map[num] ?? false;
  };

  const activeLinkCount = [1,2,3,4,5].filter(getLinkStatus).length;
  const areTogglesDisabled = linkSettingsLoading;

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      if (onLogout) onLogout();
      else window.location.href = '/';
    }
  };

  if (loading) {
    return <SimpleLoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0e17] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-3">Dashboard Error</h2>
          <p className="text-gray-300 mb-6 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => loadInitialData()} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition">↻ Retry</button>
            <button onClick={() => window.location.href = '/'} className="px-5 py-2 bg-red-700/60 hover:bg-red-600/80 rounded-lg text-sm font-medium transition">🔑 Login</button>
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
        <div className="h-16 flex items-center justify-center border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
        </div>
        <div className="flex-1 flex flex-col items-center py-4 gap-1.5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          {Object.keys(TAB_LABELS).map(tabId => {
            const color = getTabColor(tabId);
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => handleTabChange(tabId)}
                title={TAB_LABELS[tabId]}
                className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-br ${color.from} ${color.to} shadow-lg ${color.glow}`
                    : 'hover:bg-white/[0.06]'
                }`}
              >
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
                {tabId === 'shortener' && unreadShortMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-full ring-2 ring-[#0f0e1a] shadow-md shadow-rose-500/50" />
                )}
                {tabId === 'trackList' && trackUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-full ring-2 ring-[#0f0e1a] shadow-md shadow-rose-500/50" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-shrink-0 border-t border-white/[0.06] h-16 flex items-center justify-center">
          <UserAvatar username={user.username} size={36} onClick={() => setSidebarCollapsed(false)} />
        </div>
      </div>

      {/* ─── Expanded Sidebar (hover-out) ──────────────────────────── */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease' }}
        className={`hidden sm:flex fixed top-0 left-0 h-full z-50 flex-col w-[260px] bg-[#0f0e1a] border-r border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60
          ${sidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}
        `}
      >
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-[15px] font-bold text-white leading-tight truncate tracking-tight">AnimaBing</p>
            <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-widest truncate mt-0.5">Admin Panel</p>
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
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          <SidebarSection label="Content">
            <NavItem tabId="list"            activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="add"             activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="episodes"        activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="episode-status"  activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="videoUpload"     activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
          <SidebarSection label="Manage">
            <NavItem tabId="featured"        activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="reports"         activeTab={activeTab} collapsed={false} onClick={handleTabChange} badge={pendingReportsCount} />
            <NavItem tabId="polls"           activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="social"          activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="notes"           activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="trackList"       activeTab={activeTab} collapsed={false} onClick={handleTabChange} badge={trackUnreadCount} />
            <NavItem tabId="forms"           activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
          <SidebarSection label="Downloads">
            <NavItem tabId="downloadPages"   activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="linkControl"     activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="specialModes"    activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="shortener"       activeTab={activeTab} collapsed={false} onClick={handleTabChange} badge={unreadShortMessagesCount} />
            <NavItem tabId="shortusers"      activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="partners"        activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
          <SidebarSection label="Tools">
            <NavItem tabId="instagram"       activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
          <SidebarSection label="Analytics">
            <NavItem tabId="pageviews"       activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="userActivity"    activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="earnings"        activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
          <SidebarSection label="Administration">
            <NavItem tabId="subadmins"       activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
            <NavItem tabId="r2providers"     activeTab={activeTab} collapsed={false} onClick={handleTabChange} />
          </SidebarSection>
        </nav>
        <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] p-2.5 transition-colors">
            <UserAvatar username={user.username} size={36} />
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.username || 'Admin'}</p>
              <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mt-0.5">
                {window.location.hostname === 'localhost' ? 'Development' : 'Production'}
              </p>
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
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-[15px] font-bold text-white leading-tight truncate tracking-tight">AnimaBing</p>
            <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-widest truncate mt-0.5">Admin Panel</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <SvgIcon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          <SidebarSection label="Content">
            <NavItem tabId="list"            activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="add"             activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="episodes"        activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="episode-status"  activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="videoUpload"     activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
          <SidebarSection label="Manage">
            <NavItem tabId="featured"        activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="reports"         activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} badge={pendingReportsCount} />
            <NavItem tabId="polls"           activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="social"          activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="notes"           activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="trackList"       activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} badge={trackUnreadCount} />
            <NavItem tabId="forms"           activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
          <SidebarSection label="Downloads">
            <NavItem tabId="downloadPages"   activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="linkControl"     activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="specialModes"    activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="shortener"       activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} badge={unreadShortMessagesCount} />
            <NavItem tabId="shortusers"      activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="partners"        activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
          <SidebarSection label="Tools">
            <NavItem tabId="instagram"       activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
          <SidebarSection label="Analytics">
            <NavItem tabId="pageviews"       activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="userActivity"    activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="earnings"        activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
          <SidebarSection label="Administration">
            <NavItem tabId="subadmins"       activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
            <NavItem tabId="r2providers"     activeTab={activeTab} collapsed={false} onClick={handleMobileNavClick} />
          </SidebarSection>
        </nav>

        <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
            <UserAvatar username={user.username} size={36} />
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.username || 'Admin'}</p>
              <p className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mt-0.5">
                {window.location.hostname === 'localhost' ? 'Development' : 'Production'}
              </p>
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

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div id="main-scroll" className="h-full flex flex-col overflow-y-auto sm:pl-[64px] [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
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
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                loadInitialData(true);
                setTabRefreshVersions(prev => ({
                  ...prev,
                  [activeTab]: (prev[activeTab] || 0) + 1,
                }));
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition border border-white/[0.06] hover:border-white/[0.12] disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <UserAvatar username={user.username} size={32} />
          </div>
        </header>

        <main className="flex-1 py-4 sm:py-6 px-0 space-y-4">
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 px-3 sm:px-0">
            {[
              { label: 'Total Content', value: analytics.totalAnimes + analytics.totalMovies + analytics.totalManga, sub: 'Anime · Movies · Manga', color: 'text-purple-400' },
              { label: 'Anime',         value: analytics.totalAnimes,   sub: 'Series',      color: 'text-cyan-400' },
              { label: 'Movies',        value: analytics.totalMovies,   sub: 'Collection',  color: 'text-emerald-400' },
              { label: 'Manga',         value: analytics.totalManga,    sub: 'Comics',      color: 'text-amber-400' },
              { label: 'Episodes',      value: analytics.totalEpisodes, sub: 'Total',       color: 'text-rose-400' },
              { label: 'DL Pages',      value: downloadStats.totalPages, sub: `${downloadStats.totalDownloadEpisodes} eps`, color: 'text-sky-400' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.06] transition-colors">
                <p className="text-[11px] text-gray-500 mb-1.5 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-semibold ${color}`}>{value.toLocaleString()}</p>
                <p className="text-[11px] text-gray-600 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Download Link Control */}
          <div className="bg-white/[0.04] border-y sm:border border-white/[0.06] rounded-none sm:rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-white">Download Link Control</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                  {activeLinkCount}/5 active
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30">
                  Today: {currentDayName}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchLinkSettings}
                  disabled={linkSettingsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {linkSettingsLoading
                    ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : '↻'
                  }
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(num => {
                const active = getLinkStatus(num);
                return (
                  <button
                    key={num}
                    onClick={() => toggleLink(num)}
                    disabled={areTogglesDisabled}
                    className={`rounded-xl py-3 px-2 text-center transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed ${
                      active
                        ? 'bg-purple-500/20 border-purple-500/40 hover:bg-purple-500/30'
                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                    }`}
                  >
                    <p className={`text-sm font-semibold mb-1 ${active ? 'text-purple-200' : 'text-gray-500'}`}>
                      {LINK_NAMES[num]}
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      <span className={`text-[10px] font-medium ${active ? 'text-emerald-400' : 'text-red-500'}`}>
                        {active ? 'Active' : 'Off'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {restorePreview.forced && restorePreview.willRestoreTo && (
              <div className="mt-4 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 border border-sky-500/20 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-xs font-semibold text-sky-200 tracking-wide">🔗 "The links will be restored once Special Mode ends."</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {[1, 2, 3, 4, 5].map(num => {
                    const willBeOn = restorePreview.willRestoreTo![`link${num}`];
                    return (
                      <div
                        key={num}
                        className={`relative overflow-hidden rounded-xl border p-3 transition-all duration-200 ${
                          willBeOn
                            ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                            willBeOn ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'
                          }`}>
                            {num}
                          </span>
                          <span className="text-[11px] font-medium text-white/80 truncate">{LINK_NAMES[num]}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${willBeOn ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-400 shadow-[0_0_6px_#f87171]'}`} />
                          <span className={`text-[11px] font-semibold ${willBeOn ? 'text-emerald-300' : 'text-red-300'}`}>
                            {willBeOn ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="mt-3 text-center text-[11px] text-gray-500">
              These settings apply only to anime that are not assigned to any group in the <span className="text-purple-300">Anime Link Control</span> tab. Link 5 is always controlled from here for all anime.
            </p>
          </div>

          {/* Active Tab Content */}
          <div className="bg-white/[0.04] border-y sm:border border-white/[0.06] rounded-none sm:rounded-xl p-0 min-h-[300px]">
            <TabContent activeTab={activeTab} visitedTabs={visitedTabs} token={token || ''} tabRefreshVersions={tabRefreshVersions} />
          </div>
        </main>
      </div>

      <ScrollToTopButton />
    </div>
  );
};

export default AdminDashboard;