 // src/components/admin/AdminDashboard.tsx - Clean Sidebar with SVG Icons
import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import FeaturedAnimeManager from './FeaturedAnimeManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import PollManager from './PollManager';
import PartnerManager from './PartnerManager';
import EpisodeStatusManager from './EpisodeStatusManager';
import DownloadPageManager from './DownloadPageManager';
import ShortenerManager from './ShortenerManager';
import ShortUsersManager from './ShortUsersManager';
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

const isSundayInIndia = (): boolean => {
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.getDay() === 0;
};

// SVG icon factory - each returns a tiny SVG component for consistent sizing
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// Pre-defined paths for sidebar icons (Heroicons outline style)
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
  shortusers:      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  partners:        'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

// Tab labels with pure text (no emojis)
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
};

// Tab content stays the same
const TabContent: React.FC<{ activeTab: string; token: string }> = React.memo(({ activeTab, token }) => {
  switch (activeTab) {
    case 'list':           return <AnimeListTable />;
    case 'add':            return <AddAnimeForm />;
    case 'episodes':       return <EpisodesManager />;
    case 'featured':       return <FeaturedAnimeManager />;
    case 'reports':        return <ReportsManager />;
    case 'social':         return <SocialMediaManager />;
    case 'polls':          return <PollManager token={token} apiBase={API_BASE} />;
    case 'episode-status': return <EpisodeStatusManager />;
    case 'partners':       return <PartnerManager token={token} apiBase={API_BASE} />;
    case 'downloadPages':  return <DownloadPageManager />;
    case 'shortener':      return <ShortenerManager />;
    case 'shortusers':     return <ShortUsersManager />;
    default:               return <AnimeListTable />;
  }
});

// Scroll to top button (unchanged)
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

// Sidebar nav item (now uses SVG icon)
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

  return (
    <button
      onClick={() => onClick(tabId)}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left
        ${isActive
          ? 'bg-purple-900/60 text-purple-200'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-400 rounded-r-full" />
      )}
      <span className="flex-shrink-0 w-5 h-5">
        <SvgIcon d={iconPath} className="w-5 h-5" />
      </span>
      <span className="text-sm font-medium truncate flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
};

// Sidebar section (unchanged logic, but now passed proper collapsible control)
const SidebarSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-1">
    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">
      {label}
    </p>
    <div className="space-y-0.5 px-2">{children}</div>
  </div>
);

// Brand logo SVG for the top
const BrandLogo: React.FC = () => (
  <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white text-base font-bold select-none">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  </div>
);

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
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

  const [loading, setLoading] = useState(true);
  const [linkSettingsLoading, setLinkSettingsLoading] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState({
    totalAnimes: 0,
    totalMovies: 0,
    totalEpisodes: 0,
    todayUsers: 0,
    totalUsers: 0,
    totalManga: 0,
  });
  const [user, setUser] = useState({ username: '', email: '', profileImage: '' });
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true, link2: true, link3: true, link4: true, link5: true,
    autoSundayMode: false,
  });
  const [downloadStats, setDownloadStats] = useState({ totalPages: 0, totalDownloadEpisodes: 0 });
  const [autoLoading, setAutoLoading] = useState(false);

  const token = localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting...');
      setTimeout(() => { window.location.href = '/admin-login'; }, 2000);
      return;
    }
    loadInitialData();
    fetchLinkSettings();
    fetchDownloadStats();
  }, []);

  const loadInitialData = async () => {
    setLoading(true); setError('');
    try {
      const inst = axios.create({ timeout: 10000, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const [userRes, analyticsRes] = await Promise.all([
        inst.get(`${API_BASE}/admin/user-info`),
        inst.get(`${API_BASE}/admin/analytics`),
      ]);
      setUser(userRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load dashboard data.';
      setError(msg);
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        window.location.href = '/admin-login';
      }
    } finally {
      setLoading(false);
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

  const fetchDownloadStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/download-pages/stats`, { timeout: 5000, headers: { Authorization: `Bearer ${token}` } });
      setDownloadStats(res.data);
    } catch (e) {
      console.error('Download stats fetch failed', e);
    }
  };

  const toggleAutoMode = async () => {
    setAutoLoading(true);
    const id = toast.loading('Updating auto Sunday mode...');
    try {
      const res = await axios.put(`${API_BASE}/link-settings/toggle-autosunday`, {}, authHeaders());
      if (res.data.settings) setLinkSettings(res.data.settings);
      toast.success(`Auto Sunday mode is now ${res.data.settings.autoSundayMode ? 'ON' : 'OFF'}`, { id });
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.error || err.message}`, { id });
    } finally {
      setAutoLoading(false);
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
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const getLinkStatus = (num: number): boolean => {
    const map: Record<number, boolean> = {
      1: linkSettings.link1, 2: linkSettings.link2, 3: linkSettings.link3,
      4: linkSettings.link4, 5: linkSettings.link5,
    };
    return map[num] ?? false;
  };

  const activeLinkCount = [1,2,3,4,5].filter(getLinkStatus).length;
  const isSunday = isSundayInIndia();
  const areTogglesDisabled = linkSettingsLoading || (linkSettings.autoSundayMode && isSunday);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      if (onLogout) onLogout();
      else window.location.href = '/admin-login';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center flex-col gap-3">
        <Spinner />
        <p className="text-purple-400 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0e17] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-3">Dashboard Error</h2>
          <p className="text-gray-300 mb-6 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={loadInitialData} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition">↻ Retry</button>
            <button onClick={() => window.location.href = '/admin-login'} className="px-5 py-2 bg-red-700/60 hover:bg-red-600/80 rounded-lg text-sm font-medium transition">🔑 Login</button>
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

      {/* Icon Strip (always visible) – now uses SVG icons */}
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed top-0 left-0 h-full w-[52px] z-50 flex flex-col bg-[#13121e] border-r border-white/[0.06]"
      >
        <div className="h-14 flex items-center justify-center border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
        </div>

        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden">
          {Object.keys(TAB_LABELS).map(tabId => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              title={TAB_LABELS[tabId]}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                ${activeTab === tabId ? 'bg-purple-900/60' : 'hover:bg-white/5'}
              `}
            >
              <SvgIcon d={ICONS[tabId] || ICONS.list} className="w-5 h-5" />
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 border-t border-white/[0.06] h-14 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
            {(user.username || 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Expanded Sidebar – full labels with icons */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{ transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease' }}
        className={`fixed top-0 left-0 h-full z-50 flex flex-col w-[220px] bg-[#13121e] border-r border-white/[0.08] overflow-hidden shadow-2xl
          ${sidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}
        `}
      >
        <div className="flex items-center gap-3 h-14 px-3 border-b border-white/[0.06] flex-shrink-0">
          <BrandLogo />
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold text-white leading-tight truncate">AnimaBing</p>
            <p className="text-[10px] text-gray-500 truncate">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarPinned(v => !v)}
            className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ml-auto
              ${sidebarPinned ? 'text-purple-400 bg-purple-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            <svg className="w-3.5 h-3.5" fill={sidebarPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          <SidebarSection label="Content">
            <NavItem tabId="list"            activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="add"             activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="episodes"        activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="episode-status"  activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
          </SidebarSection>
          <SidebarSection label="Manage">
            <NavItem tabId="featured"        activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="reports"         activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="polls"           activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="social"          activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
          </SidebarSection>
          <SidebarSection label="Downloads">
            <NavItem tabId="downloadPages"   activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="shortener"       activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="shortusers"      activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem tabId="partners"        activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
          </SidebarSection>
        </nav>

        <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(user.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.username || 'Admin'}</p>
              <p className="text-[10px] text-gray-500">{window.location.hostname === 'localhost' ? 'Development' : 'Production'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div id="main-scroll" className="h-full flex flex-col overflow-y-auto pl-[52px]">
        <header className="sticky top-0 z-40 h-14 flex-shrink-0 flex items-center px-5 gap-3 bg-[#13121e]/80 backdrop-blur border-b border-white/[0.06]">
          <span className="w-5 h-5">
            <SvgIcon d={ICONS[activeTab] || ICONS.list} className="w-5 h-5" />
          </span>
          <h1 className="text-sm font-semibold text-white">{TAB_LABELS[activeTab]}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={loadInitialData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/[0.06]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-4">
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: 'Total Content', value: analytics.totalAnimes + analytics.totalMovies + analytics.totalManga, sub: 'Anime · Movies · Manga', color: 'text-purple-400' },
              { label: 'Anime',         value: analytics.totalAnimes,   sub: 'Series',      color: 'text-cyan-400'    },
              { label: 'Movies',        value: analytics.totalMovies,   sub: 'Collection',  color: 'text-emerald-400' },
              { label: 'Manga',         value: analytics.totalManga,    sub: 'Comics',      color: 'text-amber-400'   },
              { label: 'Episodes',      value: analytics.totalEpisodes, sub: 'Total',       color: 'text-rose-400'    },
              { label: 'DL Pages',      value: downloadStats.totalPages, sub: `${downloadStats.totalDownloadEpisodes} eps`, color: 'text-sky-400' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.06] transition-colors">
                <p className="text-[11px] text-gray-500 mb-1.5 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-semibold ${color}`}>{value.toLocaleString()}</p>
                <p className="text-[11px] text-gray-600 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Link Control Panel */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-white">Download Link Control</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                  {activeLinkCount}/5 active
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleAutoMode}
                  disabled={linkSettingsLoading || autoLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition
                    ${linkSettings.autoSundayMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                    } disabled:opacity-50`}
                >
                  {autoLoading
                    ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <span>☀️</span>
                  }
                  Auto Sunday {linkSettings.autoSundayMode ? 'ON' : 'OFF'}
                </button>
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
                    className={`rounded-xl py-3 px-2 text-center transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed
                      ${active
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

            {linkSettings.autoSundayMode && isSunday && (
              <p className="mt-3 text-center text-xs text-amber-400/80 bg-amber-500/10 rounded-lg py-2 border border-amber-500/20">
                ⚠️ Auto Sunday mode is active — manual toggles are disabled today.
              </p>
            )}
          </div>

          {/* Active Tab Content */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 sm:p-6 min-h-[300px]">
            <TabContent activeTab={activeTab} token={token || ''} />
          </div>
        </main>
      </div>

      <ScrollToTopButton />
    </div>
  );
};

export default AdminDashboard;