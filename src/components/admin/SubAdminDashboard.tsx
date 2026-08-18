 // src/components/admin/SubAdminDashboard.tsx — SUB-ADMIN ONLY (Purple Theme Matching AdminDashboard)
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
import AnimeLinkControlManager from './AnimeLinkControlManager';
import NotesManager from './NotesManager'; // 👈 Notes import
import TrackListManager from './TrackListManager'; // 🆕 Track List import
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
  linkControl:     'M10 14a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1',
  refresh:         'M4 4v5h5M20 20v-5h-5M4.5 9A8 8 0 0119 8M19.5 15A8 8 0 015 16',
  logout:          'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  pin:             'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM12 14v8',
  chevron:         'M9 18l6-6-6-6',
  notes:           'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', // 👈 Notes icon
  tracklist:       'M4 6h16M4 10h16M4 14h10 M18 15l2 2 4-4', // 🆕 Track List icon
  menu:            'M4 6h16M4 12h16M4 18h16', // 📱 Hamburger icon
  close:           'M6 18L18 6M6 6l12 12', // 📱 Close icon
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
  linkControl:     'Link Control',
  notes:           'Notes', // 👈 Notes label
  tracklist:       'Track List', // 🆕 Track List label
};

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
  linkControl:     'link-control',
  notes:           'notes', // 👈 Notes permission
  tracklist:       'tracklist', // 🆕 Track List permission
};

// ─── Sidebar sections ──────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  { id: 'content', label: 'Content', tabs: ['list', 'add', 'episodes', 'episode-status'] },
  { id: 'engagement', label: 'Engagement', tabs: ['polls', 'social', 'reports', 'notes'] }, // 👈 notes added
  { id: 'links', label: 'Links & Downloads', tabs: ['downloadPages', 'partners', 'shortenerLinks', 'shortenerUsers', 'linkControl', 'tracklist'] }, // 🆕 tracklist added
  { id: 'analytics', label: 'Analytics', tabs: ['pageviews'] },
];

// ─── User Avatar ─────────────────────────────────────────────────────
const UserAvatar: React.FC<{ username: string; size?: number; className?: string; onClick?: () => void }> = ({
  username, size = 32, className = '', onClick,
}) => {
  const initial = (username || 'S').charAt(0).toUpperCase();
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold select-none cursor-pointer transition-all hover:ring-2 hover:ring-purple-500/50 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(size * 0.45, 10) }}
    >
      {initial}
    </div>
  );
};

// ─── Brand Logo ─────────────────────────────────────────────────────
const BrandLogo: React.FC = () => (
  <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-900/40 select-none">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
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

// ─── Nav Item ────────────────────────────────────────────────────────
interface NavItemProps {
  tabId: string;
  activeTab: string;
  onClick: (id: string) => void;
  badgeCount?: number;
}

const NavItem: React.FC<NavItemProps> = ({ tabId, activeTab, onClick, badgeCount = 0 }) => {
  const isActive = activeTab === tabId;
  const label = TAB_LABELS[tabId] || tabId;
  const iconPath = ICONS[tabId] || ICONS.list;

  return (
    <button
      onClick={() => onClick(tabId)}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left
        ${isActive
          ? 'bg-purple-900/60 text-purple-200'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-400 rounded-r-full" />
      )}
      <span className={`flex-shrink-0 w-5 h-5`}>
        <SvgIcon d={iconPath} className="w-5 h-5" />
      </span>
      <span className="text-sm font-medium truncate flex-1">{label}</span>
      {badgeCount > 0 && (
        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
};

// ─── Sidebar Section Header ─────────────────────────────────────────
const SidebarSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-1">
    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">{label}</p>
    <div className="space-y-0.5 px-2">{children}</div>
  </div>
);

// ─── Tab Content ─────────────────────────────────────────────────────
const TabContent: React.FC<{ activeTab: string; token: string }> = React.memo(({ activeTab, token }) => {
  switch (activeTab) {
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
    case 'linkControl':    return <AnimeLinkControlManager token={token} />;
    case 'notes':          return <NotesManager token={token} apiBase={API_BASE} />; // 👈 Notes tab
    case 'tracklist':      return <TrackListManager />; // 🆕 Track List tab
    default:               return <AnimeListTable token={token} />;
  }
});

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
      className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-purple-600 text-white shadow-lg transition-all duration-300 hover:bg-purple-500 hover:scale-110 ${
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 📱 mobile drawer state
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = () => {
    if (sidebarPinned) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setSidebarCollapsed(false);
  };
  const handleSidebarMouseLeave = () => {
    if (sidebarPinned) return;
    hoverTimeout.current = setTimeout(() => setSidebarCollapsed(true), 300);
  };

  // 📱 Close the mobile drawer whenever a tab is picked
  const handleMobileNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  // 📱 Lock body scroll while the mobile drawer is open
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

  // ✅ Changed: no confirm popup, direct logout
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
    <div className="relative h-screen bg-[#0f0e17] text-white overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1c1b29', color: '#fff', border: '1px solid #3f3d56' },
          success: { style: { border: '1px solid #10b981' } },
          error:   { style: { border: '1px solid #ef4444' } },
        }}
      />

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      {/* ─── Icon Strip (desktop/tablet only — hidden on phones) ───────── */}
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="hidden sm:flex fixed top-0 left-0 h-full w-[52px] z-50 flex-col bg-[#13121e] border-r border-white/[0.06]"
      >
        <div className="h-14 flex items-center justify-center border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden">
          {visibleTabs.map(tabId => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              title={TAB_LABELS[tabId]}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === tabId ? 'bg-purple-900/60' : 'hover:bg-white/5'
              }`}
            >
              <SvgIcon d={ICONS[tabId] || ICONS.list} className="w-5 h-5" />
              {tabId === 'reports' && pendingReportsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#13121e]" />
              )}
              {tabId === 'shortenerLinks' && unreadMessagesCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#13121e]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex-shrink-0 border-t border-white/[0.06] h-14 flex items-center justify-center">
          <UserAvatar username={user.username} size={32} onClick={() => setSidebarCollapsed(false)} />
        </div>
      </div>

      {/* ─── Expanded Sidebar with sections (desktop/tablet hover-out panel) ── */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{ transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease' }}
        className={`hidden sm:flex fixed top-0 left-0 h-full z-50 flex-col w-[220px] bg-[#13121e] border-r border-white/[0.08] overflow-hidden shadow-2xl
          ${sidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
      >
        <div className="flex items-center gap-3 h-14 px-3 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold text-white leading-tight truncate">AnimaBing</p>
            <p className="text-[10px] text-gray-500 truncate">Sub-Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarPinned(v => !v)}
            className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ml-auto ${
              sidebarPinned ? 'text-purple-400 bg-purple-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
            title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            <svg className="w-3.5 h-3.5" fill={sidebarPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          {visibleSections.map(section => (
            <SidebarSection key={section.id} label={section.label}>
              {section.tabs.map(tabId => (
                <NavItem
                  key={tabId}
                  tabId={tabId}
                  activeTab={activeTab}
                  onClick={setActiveTab}
                  badgeCount={
                    tabId === 'reports' ? pendingReportsCount :
                    tabId === 'shortenerLinks' ? unreadMessagesCount : 0
                  }
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar username={user.username} size={32} />
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.username || 'Sub-Admin'}</p>
              <p className="text-[10px] text-gray-500">Sub-Admin</p>
            </div>
            <button onClick={handleLogout} className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Logout">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── 📱 Mobile Drawer (phones only — opened via hamburger in header) ─── */}
      {/* Backdrop */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        className={`sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-200 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Drawer panel */}
      <aside
        style={{ transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}
        className={`sm:hidden fixed top-0 left-0 h-full z-[70] flex flex-col w-[260px] max-w-[80vw] bg-[#13121e] border-r border-white/[0.08] shadow-2xl
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 h-14 px-3 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold text-white leading-tight truncate">AnimaBing</p>
            <p className="text-[10px] text-gray-500 truncate">Sub-Admin Panel</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close menu"
          >
            <SvgIcon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4">
          {visibleSections.map(section => (
            <SidebarSection key={section.id} label={section.label}>
              {section.tabs.map(tabId => (
                <NavItem
                  key={tabId}
                  tabId={tabId}
                  activeTab={activeTab}
                  onClick={handleMobileNavClick}
                  badgeCount={
                    tabId === 'reports' ? pendingReportsCount :
                    tabId === 'shortenerLinks' ? unreadMessagesCount : 0
                  }
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar username={user.username} size={32} />
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.username || 'Sub-Admin'}</p>
              <p className="text-[10px] text-gray-500">Sub-Admin</p>
            </div>
            <button onClick={handleLogout} className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Logout">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content area ────────────────────────────────────────── */}
      <div id="main-scroll" className="relative z-10 h-full flex flex-col overflow-y-auto sm:pl-[52px]">
        <header className="sticky top-0 z-40 h-14 flex-shrink-0 flex items-center px-3 sm:px-5 gap-3 bg-[#13121e]/80 backdrop-blur border-b border-white/[0.06]">
          {/* 📱 Hamburger — phones only */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden flex-shrink-0 w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Open menu"
          >
            <SvgIcon d={ICONS.menu} className="w-5 h-5" />
          </button>

          <span className="hidden sm:inline-flex w-5 h-5">
            <SvgIcon d={ICONS[activeTab] || ICONS.list} className="w-5 h-5" />
          </span>
          <h1 className="text-sm font-semibold text-white truncate">{TAB_LABELS[activeTab]}</h1>
          <span className="hidden xs:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/25 flex-shrink-0">Sub-Admin</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={loadInitialData}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/[0.06]"
            >
              <SvgIcon d={ICONS.refresh} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <UserAvatar username={user.username} size={30} />
          </div>
        </header>

        <main className="flex-1 py-3 sm:py-6 px-0 space-y-4">
          <div className="bg-white/[0.04] border-y sm:border border-white/[0.06] rounded-none sm:rounded-xl p-0 min-h-[300px]">
            {canAccessTab(activeTab) ? (
              <TabContent activeTab={activeTab} token={token} />
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