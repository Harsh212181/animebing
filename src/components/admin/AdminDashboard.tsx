// src/components/admin/AdminDashboard.tsx - Mobile Responsive Fixes Applied
import React, { useState, useEffect } from 'react';
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

const LINK_NAMES = {
  1: "Cuty.io",
  2: "Shrinkme",
  3: "Linkjust.com",
  4: "Gplinks",
  5: "Link 5"
};

const LINK_COLORS = {
  1: "from-cyan-500 to-blue-500",
  2: "from-emerald-500 to-green-500",
  3: "from-amber-500 to-orange-500",
  4: "from-rose-500 to-pink-500",
  5: "from-violet-500 to-purple-500"
};

const isSundayInIndia = (): boolean => {
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.getDay() === 0;
};

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) setIsVisible(true);
      else setIsVisible(false);
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
      aria-label="Scroll to top"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [linkSettingsLoading, setLinkSettingsLoading] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState({ 
    totalAnimes: 0, 
    totalMovies: 0, 
    totalEpisodes: 0, 
    todayUsers: 0, 
    totalUsers: 0,
    totalManga: 0
  });
  const [user, setUser] = useState({ username: '', email: '', profileImage: '' });
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true,
    link2: true,
    link3: true,
    link4: true,
    link5: true,
    autoSundayMode: false
  });
  
  const [downloadStats, setDownloadStats] = useState({
    totalPages: 0,
    totalDownloadEpisodes: 0
  });

  const autoMode = linkSettings.autoSundayMode;
  const [autoLoading, setAutoLoading] = useState(false);

  const token = localStorage.getItem('adminToken');

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting to login...');
      setTimeout(() => { window.location.href = '/admin-login'; }, 2000);
      return;
    }
    loadInitialData();
    fetchLinkSettings();
    fetchDownloadStats();
  }, [token]);

  const toggleAutoMode = async () => {
    setAutoLoading(true);
    const toastId = toast.loading('Updating auto Sunday mode...');
    try {
      const response = await axios.put(`${API_BASE}/link-settings/toggle-autosunday`, {}, authHeaders());
      if (response.data.settings) setLinkSettings(response.data.settings);
      toast.success(`Auto Sunday mode is now ${response.data.settings.autoSundayMode ? 'ON' : 'OFF'}`, { id: toastId });
    } catch (error: any) {
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Failed to toggle auto Sunday mode: ${errorMessage}`, { id: toastId });
    } finally {
      setAutoLoading(false);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const axiosInstance = axios.create({
        timeout: 10000,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const userResponse = await axiosInstance.get(`${API_BASE}/admin/user-info`);
      setUser(userResponse.data);
      const analyticsResponse = await axiosInstance.get(`${API_BASE}/admin/analytics`);
      setAnalytics(analyticsResponse.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load dashboard data.';
      setError(errorMsg);
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
    } catch (err: any) {
      console.error('❌ Error fetching link settings:', err);
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const fetchDownloadStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/download-pages/stats`, {
        timeout: 5000,
        headers: { Authorization: `Bearer ${token}` }
      });
      setDownloadStats(response.data);
    } catch (err) {
      console.error('Failed to fetch download stats:', err);
    }
  };

  const toggleLink = async (linkNumber: number) => {
    if (linkNumber < 1 || linkNumber > 5) return;
    try {
      setLinkSettingsLoading(true);
      const { data } = await axios.put(`${API_BASE}/link-settings/toggle/${linkNumber}`, {}, authHeaders());
      if (data.settings) setLinkSettings(data.settings);
      const isActive = data.toggledLink?.status;
      toast.success(`${LINK_NAMES[linkNumber as keyof typeof LINK_NAMES]} is now ${isActive ? 'ACTIVE' : 'INACTIVE'} globally!`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || 'Unknown error';
      toast.error(`Failed to toggle link: ${errorMessage}`);
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const getLinkStatus = (linkNumber: number): boolean => {
    switch (linkNumber) {
      case 1: return linkSettings.link1;
      case 2: return linkSettings.link2;
      case 3: return linkSettings.link3;
      case 4: return linkSettings.link4;
      case 5: return linkSettings.link5;
      default: return false;
    }
  };

  const getActiveLinkCount = () => [1, 2, 3, 4, 5].filter(num => getLinkStatus(num)).length;

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      if (onLogout) onLogout();
      else window.location.href = '/admin-login';
    }
  };

  const tabs = [
    { id: 'list', label: 'Content List', icon: '🤖', color: 'from-purple-600 to-purple-700' },
    { id: 'add', label: 'Add Content', icon: '🐦‍🔥', color: 'from-emerald-600 to-green-600' },
    { id: 'episodes', label: 'Episodes', icon: '👀', color: 'from-cyan-600 to-blue-600' },
    { id: 'featured', label: 'Featured Anime', icon: '🎈', color: 'from-amber-600 to-orange-600' },
    { id: 'reports', label: 'User Reports', icon: '🍂', color: 'from-rose-600 to-pink-600' },
    { id: 'social', label: 'Social Media', icon: '☣️', color: 'from-violet-600 to-purple-600' },
    { id: 'polls', label: 'Poll Manager', icon: '👻', color: 'from-indigo-600 to-blue-600' },
    { id: 'shortener', label: 'URL Shortener', icon: '🔗', color: 'from-teal-600 to-cyan-600' },
  ];

  const ActiveComponent = () => {
    switch(activeTab) {
      case 'list': return <AnimeListTable />;
      case 'add': return <AddAnimeForm />;
      case 'episodes': return <EpisodesManager />;
      case 'featured': return <FeaturedAnimeManager />;
      case 'reports': return <ReportsManager />;
      case 'social': return <SocialMediaManager />;
      case 'polls': return <PollManager token={token || ''} apiBase={API_BASE} />;
      case 'episode-status': return <EpisodeStatusManager />;
      case 'partners': return <PartnerManager token={token || ''} apiBase={API_BASE} />;
      case 'downloadPages': return <DownloadPageManager />;
      case 'shortener': return <ShortenerManager />;
      default: return <AnimeListTable />;
    }
  };

  const analyticsColors = [
    { gradient: 'from-red-500 via-orange-500 to-amber-500', text: 'text-white', border: 'border-red-400/50', bg: 'bg-gradient-to-br from-red-600/30 to-orange-600/20' },
    { gradient: 'from-purple-500 via-pink-500 to-rose-500', text: 'text-white', border: 'border-purple-400/50', bg: 'bg-gradient-to-br from-purple-600/30 to-pink-600/20' },
    { gradient: 'from-blue-500 via-cyan-500 to-teal-500', text: 'text-white', border: 'border-blue-400/50', bg: 'bg-gradient-to-br from-blue-600/30 to-cyan-600/20' },
    { gradient: 'from-emerald-500 via-green-500 to-lime-500', text: 'text-white', border: 'border-emerald-400/50', bg: 'bg-gradient-to-br from-emerald-600/30 to-green-600/20' },
    { gradient: 'from-indigo-500 via-violet-500 to-purple-500', text: 'text-white', border: 'border-indigo-400/50', bg: 'bg-gradient-to-br from-indigo-600/30 to-violet-600/20' },
    { gradient: 'from-amber-500 via-orange-500 to-red-500', text: 'text-white', border: 'border-amber-400/50', bg: 'bg-gradient-to-br from-amber-600/30 to-orange-600/20' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 flex items-center justify-center flex-col">
        <Spinner />
        <div className="mt-4 text-purple-300">Loading from: {API_BASE.replace('/api', '')}</div>
        <div className="mt-2 text-sm text-purple-500">Token: {token ? 'Present' : 'Missing'}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/50 backdrop-blur rounded-2xl p-8 text-center shadow-2xl shadow-purple-500/10">
            <h2 className="text-3xl font-bold mb-4 text-purple-300">Error Loading Dashboard</h2>
            <p className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200">{error}</p>
            <div className="bg-purple-900/40 p-4 rounded-lg mb-6 text-left">
              <p className="text-sm font-mono text-purple-300"><strong>API Base:</strong> {API_BASE}</p>
              <p className="text-sm font-mono text-purple-300"><strong>Current Host:</strong> {window.location.hostname}</p>
              <p className="text-sm font-mono text-purple-300"><strong>Token Status:</strong> {token ? 'Present' : 'Missing'}</p>
            </div>
            <div className="space-x-4">
              <button onClick={loadInitialData} className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white px-8 py-3 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg shadow-purple-500/30">↻ Retry Loading</button>
              <button onClick={() => window.location.href = '/admin-login'} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-3 rounded-lg transition font-semibold">🔑 Go to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSunday = isSundayInIndia();
  const areTogglesDisabled = linkSettingsLoading || (autoMode && isSunday);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1f2937', color: '#fff', border: '1px solid #4b5563' },
          success: { style: { border: '1px solid #10b981' }, iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { style: { border: '1px solid #ef4444' }, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      
      <header className="bg-gradient-to-r from-purple-900/80 via-purple-800/60 to-purple-900/80 backdrop-blur-xl border-b border-purple-700/50 p-4 sm:p-6 shadow-2xl">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/50">
              ☠️
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-sm text-purple-300">
                Welcome back, <span className="font-semibold text-pink-300">{user.username || 'Admin'}</span> • 
                <span className="ml-2 text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded-full">
                  {window.location.hostname === 'localhost' ? 'Development' : 'Production'}
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-lg transition-all duration-300 font-semibold text-sm shadow-lg ${
                activeTab === 'partners'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-2 border-white/20 shadow-teal-500/30'
                  : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
              }`}
            >
              <span className="text-lg">🎉</span>
              <span className="hidden sm:inline">Partner Manager</span>
              <span className="sm:hidden">Partners</span>
              {activeTab === 'partners' && <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>}
            </button>

            <button
              onClick={() => setActiveTab('downloadPages')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-lg transition-all duration-300 font-semibold text-sm shadow-lg ${
                activeTab === 'downloadPages'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-2 border-white/20 shadow-amber-500/30'
                  : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
              }`}
            >
              <span className="text-lg">🏴‍☠️</span>
              <span className="hidden sm:inline">Download Pages</span>
              <span className="sm:hidden">Downloads</span>
              {activeTab === 'downloadPages' && <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>}
            </button>

            <button
              onClick={() => setActiveTab('episode-status')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-lg transition-all duration-300 font-semibold text-sm shadow-lg ${
                activeTab === 'episode-status'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-2 border-white/20 shadow-blue-500/30'
                  : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
              }`}
            >
              <span className="text-lg">🪼</span>
              <span className="hidden sm:inline">Episode Status</span>
              <span className="sm:hidden">Ep Status</span>
              {activeTab === 'episode-status' && <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>}
            </button>

            <button
              onClick={loadInitialData}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 sm:px-5 py-2 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg shadow-purple-500/30 text-sm flex items-center gap-2"
            >
              <span>↻</span> <span className="hidden sm:inline">Refresh Data</span><span className="sm:hidden">Refresh</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-600 hover:to-red-700 text-white px-3 sm:px-5 py-2 rounded-lg transition font-semibold text-sm border border-red-500/40 shadow-lg flex items-center gap-2"
            >
              <span>🚪</span> <span className="hidden sm:inline">Logout</span><span className="sm:hidden">Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-3 rounded-xl transition-all duration-300 group font-medium text-sm ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg border-2 border-white/20`
                    : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Global Link Settings */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-purple-900/50 via-purple-800/40 to-indigo-900/50 border border-purple-600/50 rounded-xl p-4 backdrop-blur shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-3">
                  🔗 Download Link Control Center
                  <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-full font-bold">
                    {getActiveLinkCount()}/5 Active
                  </span>
                </h3>
                <p className="text-xs text-purple-300 mt-1">Toggle links to show/hide from all download pages</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleAutoMode}
                  disabled={linkSettingsLoading || autoLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    autoMode
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                      : 'bg-purple-700/40 text-purple-300 hover:bg-purple-600/60 border border-purple-500/30'
                  }`}
                >
                  {autoLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : autoMode ? (
                    <><span className="hidden sm:inline">🔴 Auto Sunday ON</span><span className="sm:hidden">🔴 Auto</span></>
                  ) : (
                    <><span className="hidden sm:inline">⚪ Auto Sunday OFF</span><span className="sm:hidden">⚪ Auto</span></>
                  )}
                </button>
                <button
                  onClick={fetchLinkSettings}
                  disabled={linkSettingsLoading}
                  className="text-xs bg-gradient-to-r from-purple-600/60 to-purple-700/60 hover:from-purple-500 hover:to-purple-600 text-purple-200 px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {linkSettingsLoading ? (
                    <><div className="animate-spin h-3 w-3 border-2 border-purple-300 border-t-transparent rounded-full"></div>Loading...</>
                  ) : '↻ Refresh Status'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map((num) => {
                const isActive = getLinkStatus(num);
                const isLoading = linkSettingsLoading;
                const linkName = LINK_NAMES[num as keyof typeof LINK_NAMES];
                const linkColor = LINK_COLORS[num as keyof typeof LINK_COLORS];
                return (
                  <div key={num} className="text-center group">
                    <button
                      onClick={() => toggleLink(num)}
                      disabled={areTogglesDisabled}
                      className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 relative overflow-hidden ${
                        isActive
                          ? `bg-gradient-to-b ${linkColor} text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] border-2 border-white/30`
                          : 'bg-gradient-to-b from-gray-800 to-gray-900 text-gray-400 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-600/50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="relative z-10">
                        <div className="text-lg font-bold mb-1">{linkName}</div>
                        <div className="text-xs font-semibold flex items-center justify-center gap-2">
                          {isLoading ? (
                            <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>Updating...</>
                          ) : isActive ? (
                            <><span className="text-green-300 animate-pulse">●</span> ACTIVE</>
                          ) : (
                            <><span className="text-red-300">●</span> INACTIVE</>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 h-2 rounded-full overflow-hidden bg-gray-800">
                      <div className={`h-full transition-all duration-500 ${isActive ? `bg-gradient-to-r ${linkColor}` : 'bg-gray-600'}`}
                        style={{ width: isActive ? '100%' : '0%' }}></div>
                    </div>
                    <p className="text-xs mt-2 font-medium opacity-80">
                      Link {num} • {isActive ? '✅ Visible to users' : '❌ Hidden'}
                    </p>
                  </div>
                );
              })}
            </div>
            {autoMode && isSunday && (
              <div className="mt-3 text-center text-xs text-amber-300 bg-amber-900/30 rounded-lg p-2 border border-amber-500/50">
                ⚠️ Auto Sunday Mode is ON — links are automatically set. Manual changes are disabled on Sundays.
              </div>
            )}
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {[
            { label: 'Total Content', value: analytics.totalAnimes + analytics.totalMovies + analytics.totalManga, sub: 'Anime • Movies • Manga', icon: '^_^', idx: 0 },
            { label: 'Anime', value: analytics.totalAnimes, sub: 'Series Collection', icon: 'X_X', idx: 1 },
            { label: 'Movies', value: analytics.totalMovies, sub: 'Movie Collection', icon: '+_+', idx: 2 },
            { label: 'Manga', value: analytics.totalManga, sub: 'Comic Collection', icon: '¬_¬', idx: 3 },
            { label: 'Episodes', value: analytics.totalEpisodes, sub: 'Total Episodes', icon: '^_~', idx: 4 },
            { label: 'Download Pages', value: downloadStats.totalPages, sub: `Total Pages • ${downloadStats.totalDownloadEpisodes} Episodes`, icon: 'U_U', idx: 5 },
          ].map(({ label, value, sub, icon, idx }) => (
            <div key={label} className={`${analyticsColors[idx].bg} border ${analyticsColors[idx].border} rounded-xl p-3 sm:p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">{label}</p>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[idx].gradient} flex items-center justify-center`}>
                    <span className="text-xs font-bold">{icon}</span>
                  </div>
                </div>
                <p className={`text-2xl sm:text-3xl font-bold ${analyticsColors[idx].text} mb-2`}>{value}</p>
                <div className="text-xs text-gray-400 font-medium">{sub}</div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[idx].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
            </div>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <div className="p-3 sm:p-6">
        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 rounded-2xl p-3 sm:p-6 shadow-2xl border border-purple-700/40 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-purple-300 mb-2 flex items-center gap-3">
              <span className="text-3xl">
                {tabs.find(t => t.id === activeTab)?.icon ||
                 (activeTab === 'episode-status' ? '🪼' :
                  activeTab === 'partners' ? '🎉' :
                  activeTab === 'downloadPages' ? '🏴‍☠️' : '🎉')}
              </span>
              {tabs.find(t => t.id === activeTab)?.label ||
               (activeTab === 'episode-status' ? 'Episode Status' :
                activeTab === 'partners' ? 'Partner Manager' :
                activeTab === 'downloadPages' ? 'Download Pages' : '')} Management
            </h2>
            <p className="text-purple-400/70 text-sm">Manage and control your content from this panel</p>
          </div>
          <ActiveComponent />
        </div>
      </div>

      <ScrollToTopButton />
    </div>
  );
};

export default AdminDashboard;