 // src/components/admin/AdminDashboard.tsx - YouTube-Style Sidebar Layout
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
import ShortUsersManager from './ShortUsersManager';  // ✨ NEW
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

const TAB_LABELS: Record<string, { label: string; icon: string }> = {
  list:            { label: 'Content List',    icon: '🤖' },
  add:             { label: 'Add Content',     icon: '🐦‍🔥' },
  episodes:        { label: 'Episodes',        icon: '👀' },
  'episode-status':{ label: 'Episode Status',  icon: '🪼' },
  featured:        { label: 'Featured Anime',  icon: '🎈' },
  reports:         { label: 'User Reports',    icon: '🍂' },
  social:          { label: 'Social Media',    icon: '☣️' },
  polls:           { label: 'Poll Manager',    icon: '👻' },
  downloadPages:   { label: 'Download Pages',  icon: '🏴‍☠️' },
  shortener:       { label: 'URL Shortener',   icon: '🔗' },
  partners:        { label: 'Partner Manager', icon: '🎉' },
  shortusers:      { label: 'Short Users',     icon: '👥' },   // ✨ NEW
};

// Defined OUTSIDE so React never unmounts/remounts on parent re-render
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
    case 'shortusers':     return <ShortUsersManager />;   // ✨ NEW
    default:               return <AnimeListTable />;
  }
});

// ─── Scroll to top button (unchanged) ───────────────────────────────────────
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

// ─── Sidebar nav item (unchanged) ───────────────────────────────────────────
interface NavItemProps {
  icon: string;
  label: string;
  tabId: string;
  activeTab: string;
  collapsed: boolean;
  badge?: number;
  onClick: (id: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, tabId, activeTab, collapsed, badge, onClick }) => {
  const isActive = activeTab === tabId;
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
      <span className="text-[18px] flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium truncate flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
};

// ─── Section label (unchanged) ──────────────────────────────────────────────
const SidebarSection: React.FC<{ label: string; collapsed: boolean; children: React.ReactNode }> = ({
  label, children,
}) => (
  <div className="mb-1">
    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">
      {label}
    </p>
    <div className="space-y-0.5 px-2">{children}</div>
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

  const currentTab = TAB_LABELS[activeTab] ?? { label: activeTab, icon: '✦' };

  // Loading & error screens remain same
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

  // Main layout
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

      {/* Icon Strip (always visible) */}
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed top-0 left-0 h-full w-[52px] z-50 flex flex-col bg-[#13121e] border-r border-white/[0.06]"
      >
        <div className="h-14 flex items-center justify-center border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-base select-none">☠️</div>
        </div>

        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden">
          {[
            { icon: '🤖', tabId: 'list' },
            { icon: '🐦‍🔥', tabId: 'add' },
            { icon: '👀', tabId: 'episodes' },
            { icon: '🪼', tabId: 'episode-status' },
            { icon: '🎈', tabId: 'featured' },
            { icon: '🍂', tabId: 'reports' },
            { icon: '👻', tabId: 'polls' },
            { icon: '☣️', tabId: 'social' },
            { icon: '🏴‍☠️', tabId: 'downloadPages' },
            { icon: '🔗', tabId: 'shortener' },
            { icon: '👥', tabId: 'shortusers' },   // ✨ NEW
            { icon: '🎉', tabId: 'partners' },
          ].map(({ icon, tabId }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              title={TAB_LABELS[tabId]?.label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-[18px] transition-colors
                ${activeTab === tabId ? 'bg-purple-900/60' : 'hover:bg-white/5'}
              `}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 border-t border-white/[0.06] h-14 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
            {(user.username || 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Expanded Sidebar */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{ transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease' }}
        className={`fixed top-0 left-0 h-full z-50 flex flex-col w-[220px] bg-[#13121e] border-r border-white/[0.08] overflow-hidden shadow-2xl
          ${sidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}
        `}
      >
        <div className="flex items-center gap-3 h-14 px-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-base flex-shrink-0 select-none">☠️</div>
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
          <SidebarSection label="Content" collapsed={false}>
            <NavItem icon="🤖" label="Content List"   tabId="list"            activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="🐦‍🔥" label="Add Content"    tabId="add"             activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="👀" label="Episodes"       tabId="episodes"        activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="🪼" label="Episode Status" tabId="episode-status"  activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
          </SidebarSection>
          <SidebarSection label="Manage" collapsed={false}>
            <NavItem icon="🎈" label="Featured Anime" tabId="featured"        activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="🍂" label="User Reports"   tabId="reports"         activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="👻" label="Poll Manager"   tabId="polls"           activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="☣️" label="Social Media"   tabId="social"          activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
          </SidebarSection>
          <SidebarSection label="Downloads" collapsed={false}>
            <NavItem icon="🏴‍☠️" label="Download Pages" tabId="downloadPages"   activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="🔗" label="URL Shortener"  tabId="shortener"       activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
            <NavItem icon="👥" label="Short Users"    tabId="shortusers"      activeTab={activeTab} collapsed={false} onClick={setActiveTab} /> {/* ✨ NEW */}
            <NavItem icon="🎉" label="Partner Manager" tabId="partners"       activeTab={activeTab} collapsed={false} onClick={setActiveTab} />
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
          <span className="text-lg">{currentTab.icon}</span>
          <h1 className="text-sm font-semibold text-white">{currentTab.label}</h1>
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
          {/* Analytics Cards (unchanged) */}
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

          {/* Link Control Panel (unchanged) */}
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