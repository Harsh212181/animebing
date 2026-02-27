 // src/components/admin/AdminDashboard.tsx - UPDATED WITH AUTO SUNDAY MODE + SCROLL TO TOP + EPISODE STATUS MANAGER (ONLY TOP BAR BUTTON)
import React, { useState, useEffect } from 'react';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import FeaturedAnimeManager from './FeaturedAnimeManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import PollManager from './PollManager'; // ✅ POLL MANAGER IMPORT
import PartnerManager from './PartnerManager'; // ✅ PARTNER MANAGER IMPORT
import EpisodeStatusManager from './EpisodeStatusManager'; // ✅ NEW EPISODE STATUS MANAGER
import Spinner from '../Spinner';
import axios from 'axios';

// ✅ FIXED: Production पर हमेशा full URL use करें
const getApiBase = () => {
  if (typeof window === 'undefined') return 'https://animabing.onrender.com/api';
  
  // Development में localhost use करें
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
  
  return isLocal ? 'http://localhost:3000/api' : 'https://animabing.onrender.com/api';
};

const API_BASE = getApiBase();

interface AdminDashboardProps {
  onLogout?: () => void;
}

interface LinkSettings {
  link1: boolean;
  link2: boolean;
  link3: boolean;
  link4: boolean;
  link5: boolean;
  _id?: string;
  lastUpdated?: string;
}

// Link name mapping
const LINK_NAMES = {
  1: "Cuty.io",
  2: "Shrinkme",
  3: "Linkjust.com",
  4: "Gplinks",
  5: "Link 5"
};

// Link colors for better visual distinction
const LINK_COLORS = {
  1: "from-cyan-500 to-blue-500",
  2: "from-emerald-500 to-green-500",
  3: "from-amber-500 to-orange-500",
  4: "from-rose-500 to-pink-500",
  5: "from-violet-500 to-purple-500"
};

// ✅ ScrollToTop Button Component (inline)
const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

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
    link5: true
  });
  
  // ✅ AUTO SUNDAY MODE STATES
  const [autoMode, setAutoMode] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/admin-login';
      }, 2000);
      return;
    }

    loadInitialData();
    fetchLinkSettings();
  }, [token]);

  // ✅ AUTO SUNDAY MODE: hourly check when autoMode is on
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (autoMode) {
      // Check every hour (3600000 ms)
      intervalId = setInterval(async () => {
        const today = new Date().getDay();
        if (today === 0) { // 0 = Sunday
          await applySundayRule();
        }
      }, 3600000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoMode]);

  // ✅ Apply Sunday rule: link5 ON, link1-4 OFF
  const applySundayRule = async () => {
    setAutoLoading(true);
    try {
      const target = {
        link1: false,
        link2: false,
        link3: false,
        link4: false,
        link5: true
      };
      // Only toggle links that need to change
      const toggles = [];
      if (linkSettings.link1 !== target.link1) toggles.push(1);
      if (linkSettings.link2 !== target.link2) toggles.push(2);
      if (linkSettings.link3 !== target.link3) toggles.push(3);
      if (linkSettings.link4 !== target.link4) toggles.push(4);
      if (linkSettings.link5 !== target.link5) toggles.push(5);
      
      for (const linkNum of toggles) {
        await toggleLink(linkNum); // toggleLink updates state and API
      }
    } catch (error) {
      console.error('Failed to apply Sunday rule:', error);
      alert('Failed to apply automatic Sunday rule. Please try manual.');
    } finally {
      setAutoLoading(false);
    }
  };

  // ✅ Toggle auto mode on/off
  const toggleAutoMode = async () => {
    const newMode = !autoMode;
    setAutoMode(newMode);
    if (newMode) {
      // Immediately apply if today is Sunday
      const today = new Date().getDay();
      if (today === 0) {
        await applySundayRule();
      }
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('📡 Loading admin data from:', `${API_BASE}/admin/protected/user-info`);
      
      // Axios instance with better error handling
      const axiosInstance = axios.create({
        timeout: 10000,
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Fetch user info
      const userResponse = await axiosInstance.get(`${API_BASE}/admin/protected/user-info`);
      setUser(userResponse.data);
      console.log('✅ User info loaded:', userResponse.data);

      // Fetch analytics
      const analyticsResponse = await axiosInstance.get(`${API_BASE}/admin/protected/analytics`);
      setAnalytics(analyticsResponse.data);
      console.log('✅ Analytics loaded:', analyticsResponse.data);

    } catch (err: any) {
      console.error('❌ Admin data error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        API_BASE: API_BASE
      });
      
      const errorMsg = err.response?.data?.error || 
                      err.message || 
                      'Failed to load dashboard data. Check API endpoint.';
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
      console.log('🔗 Fetching link settings from:', `${API_BASE}/link-settings`);
      
      const { data } = await axios.get(`${API_BASE}/link-settings`, {
        timeout: 5000
      });
      console.log('✅ Link settings fetched:', data);
      setLinkSettings(data);
    } catch (err: any) {
      console.error('❌ Error fetching link settings:', err);
      
      // Initialize default settings if API fails
      setLinkSettings({
        link1: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true
      });
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const toggleLink = async (linkNumber: number) => {
    if (linkNumber < 1 || linkNumber > 5) {
      console.error('Invalid link number:', linkNumber);
      return;
    }

    try {
      setLinkSettingsLoading(true);
      console.log(`🔄 Toggling link ${linkNumber} at:`, `${API_BASE}/link-settings/toggle/${linkNumber}`);
      
      // Use the toggle endpoint
      const { data } = await axios.put(`${API_BASE}/link-settings/toggle/${linkNumber}`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Link toggled successfully:', data);
      
      // Update local state with the response
      if (data.settings) {
        setLinkSettings(data.settings);
      }
      
      // Show success message
      const isActive = data.toggledLink?.status;
      alert(`✅ ${LINK_NAMES[linkNumber as keyof typeof LINK_NAMES]} is now ${isActive ? 'ACTIVE' : 'INACTIVE'} globally!`);
    } catch (err: any) {
      console.error('❌ Error toggling link:', err);
      
      // Fallback: Toggle locally if API fails
      const updatedSettings = { ...linkSettings };
      
      // Type-safe toggle
      switch (linkNumber) {
        case 1:
          updatedSettings.link1 = !updatedSettings.link1;
          break;
        case 2:
          updatedSettings.link2 = !updatedSettings.link2;
          break;
        case 3:
          updatedSettings.link3 = !updatedSettings.link3;
          break;
        case 4:
          updatedSettings.link4 = !updatedSettings.link4;
          break;
        case 5:
          updatedSettings.link5 = !updatedSettings.link5;
          break;
      }
      
      setLinkSettings(updatedSettings);
      
      alert(`⚠️ Updated locally (server might be unavailable)\n${LINK_NAMES[linkNumber as keyof typeof LINK_NAMES]} is now ${updatedSettings[`link${linkNumber}` as keyof LinkSettings] ? 'ON' : 'OFF'}`);
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  // Helper function to get link status
  const getLinkStatus = (linkNumber: number): boolean => {
    switch (linkNumber) {
      case 1:
        return linkSettings.link1;
      case 2:
        return linkSettings.link2;
      case 3:
        return linkSettings.link3;
      case 4:
        return linkSettings.link4;
      case 5:
        return linkSettings.link5;
      default:
        return false;
    }
  };

  // Get count of active links
  const getActiveLinkCount = () => {
    return [1, 2, 3, 4, 5].filter(num => getLinkStatus(num)).length;
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');

      if (onLogout) {
        onLogout();
      } else {
        window.location.href = '/admin-login';
      }
    }
  };

  // ✅ TABS: Removed Episode Status (now only in top bar)
  const tabs = [
    { id: 'list', label: 'Content List', icon: '🤖', color: 'from-purple-600 to-purple-700' },
    { id: 'add', label: 'Add Content', icon: '🐦‍🔥', color: 'from-emerald-600 to-green-600' },
    { id: 'episodes', label: 'Episodes', icon: '👀', color: 'from-cyan-600 to-blue-600' },
    { id: 'featured', label: 'Featured Anime', icon: '🎈', color: 'from-amber-600 to-orange-600' },
    { id: 'reports', label: 'User Reports', icon: '🍂', color: 'from-rose-600 to-pink-600' },
    { id: 'social', label: 'Social Media', icon: '☣️', color: 'from-violet-600 to-purple-600' },
    { id: 'polls', label: 'Poll Manager', icon: '🕶️', color: 'from-indigo-600 to-blue-600' }
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
      // ✅ Episode Status Manager (accessed via top bar only)
      case 'episode-status': return <EpisodeStatusManager />;
      // ✅ Partner Manager (accessed via top bar only)
      case 'partners': return <PartnerManager token={token || ''} apiBase={API_BASE} />;
      default: return <AnimeListTable />;
    }
  };

  // Updated Analytics cards colors - alag alag colors with improved contrast
  const analyticsColors = [
    { 
      gradient: 'from-red-500 via-orange-500 to-amber-500', 
      text: 'text-white', 
      border: 'border-red-400/50',
      bg: 'bg-gradient-to-br from-red-600/30 to-orange-600/20'
    },
    { 
      gradient: 'from-purple-500 via-pink-500 to-rose-500', 
      text: 'text-white', 
      border: 'border-purple-400/50',
      bg: 'bg-gradient-to-br from-purple-600/30 to-pink-600/20'
    },
    { 
      gradient: 'from-blue-500 via-cyan-500 to-teal-500', 
      text: 'text-white', 
      border: 'border-blue-400/50',
      bg: 'bg-gradient-to-br from-blue-600/30 to-cyan-600/20'
    },
    { 
      gradient: 'from-emerald-500 via-green-500 to-lime-500', 
      text: 'text-white', 
      border: 'border-emerald-400/50',
      bg: 'bg-gradient-to-br from-emerald-600/30 to-green-600/20'
    },
    { 
      gradient: 'from-indigo-500 via-violet-500 to-purple-500', 
      text: 'text-white', 
      border: 'border-indigo-400/50',
      bg: 'bg-gradient-to-br from-indigo-600/30 to-violet-600/20'
    },
    { 
      gradient: 'from-amber-500 via-orange-500 to-red-500', 
      text: 'text-white', 
      border: 'border-amber-400/50',
      bg: 'bg-gradient-to-br from-amber-600/30 to-orange-600/20'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 flex items-center justify-center flex-col">
        <Spinner />
        <div className="mt-4 text-purple-300">
          Loading from: {API_BASE.replace('/api', '')}
        </div>
        <div className="mt-2 text-sm text-purple-500">
          Token: {token ? 'Present' : 'Missing'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/50 backdrop-blur rounded-2xl p-8 text-center shadow-2xl shadow-purple-500/10">
            <h2 className="text-3xl font-bold mb-4 text-purple-300">Error Loading Dashboard</h2>
            <p className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200">
              {error}
            </p>
            <div className="bg-purple-900/40 p-4 rounded-lg mb-6 text-left">
              <p className="text-sm font-mono text-purple-300">
                <strong>API Base:</strong> {API_BASE}
              </p>
              <p className="text-sm font-mono text-purple-300">
                <strong>Current Host:</strong> {window.location.hostname}
              </p>
              <p className="text-sm font-mono text-purple-300">
                <strong>Token Status:</strong> {token ? 'Present' : 'Missing'}
              </p>
            </div>
            <div className="space-x-4">
              <button
                onClick={loadInitialData}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white px-8 py-3 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg shadow-purple-500/30"
              >
                ↻ Retry Loading
              </button>
              <button
                onClick={() => window.location.href = '/admin-login'}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-3 rounded-lg transition font-semibold"
              >
                🔑 Go to Login
              </button>
            </div>
            <p className="mt-6 text-xs text-purple-400">
              Check browser console (F12) for detailed error information
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-purple-900/80 via-purple-800/60 to-purple-900/80 backdrop-blur-xl border-b border-purple-700/50 p-6 shadow-2xl">
        {/* Top Bar - User Info and Actions */}
        <div className="flex justify-between items-center mb-6">
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
                  {window.location.hostname === 'localhost' ? 'Local Development' : 'Production'}
                </span>
              </p>
              {/* ✅ API URL display REMOVED as requested */}
            </div>
          </div>
          
          {/* ✅ Button group: Partner Manager → Episode Status → Refresh → Logout */}
          <div className="flex items-center gap-3">
            {/* Partner Manager Button */}
            <button
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-all duration-300 font-semibold text-sm shadow-lg ${
                activeTab === 'partners'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-2 border-white/20 shadow-teal-500/30'
                  : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
              }`}
            >
              <span className="text-lg">🎉</span>
              <span>Partner Manager</span>
              {activeTab === 'partners' && (
                <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
              )}
            </button>

            {/* ✅ Episode Status Button (only here, not in tabs) */}
            <button
              onClick={() => setActiveTab('episode-status')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-all duration-300 font-semibold text-sm shadow-lg ${
                activeTab === 'episode-status'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-2 border-white/20 shadow-blue-500/30'
                  : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
              }`}
            >
              <span className="text-lg">🪼</span>
              <span>Episode Status</span>
              {activeTab === 'episode-status' && (
                <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
              )}
            </button>

            {/* Refresh Data button */}
            <button
              onClick={loadInitialData}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-5 py-2 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg shadow-purple-500/30 whitespace-nowrap text-sm flex items-center gap-2"
            >
              <span>↻</span> Refresh Data
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-600 hover:to-red-700 text-white px-5 py-2 rounded-lg transition font-semibold text-sm border border-red-500/40 shadow-lg flex items-center gap-2"
            >
              <span>🚪</span> Logout
            </button>
          </div>
        </div>

        {/* Navigation Tabs - All main tabs (Partner Manager and Episode Status are in top bar) */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-300 group font-medium ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg border-2 border-white/20`
                    : 'bg-purple-800/40 text-purple-300 hover:bg-purple-700/60 hover:text-white border border-purple-600/40'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Global Link Settings Section */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-purple-900/50 via-purple-800/40 to-indigo-900/50 border border-purple-600/50 rounded-xl p-4 backdrop-blur shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-3">
                  🔗 Download Link Control Center
                  <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-full font-bold">
                    {getActiveLinkCount()}/5 Active
                  </span>
                </h3>
                <p className="text-xs text-purple-300 mt-1">
                  Toggle links to show/hide from all download pages
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* ✅ AUTO SUNDAY MODE BUTTON */}
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
                    '🔴 Auto Sunday ON'
                  ) : (
                    '⚪ Auto Sunday OFF'
                  )}
                </button>

                <button
                  onClick={fetchLinkSettings}
                  disabled={linkSettingsLoading}
                  className="text-xs bg-gradient-to-r from-purple-600/60 to-purple-700/60 hover:from-purple-500 hover:to-purple-600 text-purple-200 px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {linkSettingsLoading ? (
                    <>
                      <div className="animate-spin h-3 w-3 border-2 border-purple-300 border-t-transparent rounded-full"></div>
                      Loading...
                    </>
                  ) : '↻ Refresh Status'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((num) => {
                const isActive = getLinkStatus(num);
                const isLoading = linkSettingsLoading;
                const linkName = LINK_NAMES[num as keyof typeof LINK_NAMES];
                const linkColor = LINK_COLORS[num as keyof typeof LINK_COLORS];
                
                return (
                  <div key={num} className="text-center group">
                    <button
                      onClick={() => toggleLink(num)}
                      disabled={isLoading || autoMode} // ✅ Disable when autoMode is ON
                      className={`w-full py-4 rounded-xl font-bold transition-all duration-300 relative overflow-hidden ${
                        isActive
                          ? `bg-gradient-to-b ${linkColor} text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] border-2 border-white/30`
                          : 'bg-gradient-to-b from-gray-800 to-gray-900 text-gray-400 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-600/50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="relative z-10">
                        <div className="text-lg font-bold mb-1">{linkName}</div>
                        <div className="text-xs font-semibold flex items-center justify-center gap-2">
                          {isLoading ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Updating...
                            </>
                          ) : isActive ? (
                            <>
                              <span className="text-green-300 animate-pulse">●</span> ACTIVE
                            </>
                          ) : (
                            <>
                              <span className="text-red-300">●</span> INACTIVE
                            </>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-shimmer"></div>
                      )}
                    </button>
                    <div className="mt-2 h-2 rounded-full overflow-hidden bg-gray-800">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isActive ? 
                          `bg-gradient-to-r ${linkColor.replace('from-', 'from-').replace('to-', 'to-')}` : 
                          'bg-gray-600'
                        }`}
                        style={{ width: isActive ? '100%' : '0%' }}
                      ></div>
                    </div>
                    <p className="text-xs mt-2 font-medium opacity-80">
                      Link {num} • {isActive ? '✅ Visible to users' : '❌ Hidden'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Content Card */}
          <div className={`${analyticsColors[0].bg} border ${analyticsColors[0].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Total Content</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[0].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">TC</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[0].text} mb-2`}>
                {analytics.totalAnimes + analytics.totalMovies + analytics.totalManga}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Anime • Movies • Manga
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[0].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>

          {/* Anime Card */}
          <div className={`${analyticsColors[1].bg} border ${analyticsColors[1].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Anime</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[1].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">AN</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[1].text} mb-2`}>
                {analytics.totalAnimes}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Series Collection
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[1].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>

          {/* Movies Card */}
          <div className={`${analyticsColors[2].bg} border ${analyticsColors[2].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Movies</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[2].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">MV</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[2].text} mb-2`}>
                {analytics.totalMovies}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Movie Collection
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[2].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>

          {/* Manga Card */}
          <div className={`${analyticsColors[3].bg} border ${analyticsColors[3].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Manga</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[3].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">MG</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[3].text} mb-2`}>
                {analytics.totalManga}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Comic Collection
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[3].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>

          {/* Episodes Card */}
          <div className={`${analyticsColors[4].bg} border ${analyticsColors[4].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Episodes</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[4].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">EP</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[4].text} mb-2`}>
                {analytics.totalEpisodes}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Total Episodes
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[4].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>

          {/* Users Today Card */}
          <div className={`${analyticsColors[5].bg} border ${analyticsColors[5].border} rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Users Today</p>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${analyticsColors[5].gradient} flex items-center justify-center`}>
                  <span className="text-xs font-bold">UT</span>
                </div>
              </div>
              <p className={`text-3xl font-bold ${analyticsColors[5].text} mb-2`}>
                {analytics.todayUsers}
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Active Today
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${analyticsColors[5].gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-6">
        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 rounded-2xl p-6 shadow-2xl border border-purple-700/40 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-purple-300 mb-2 flex items-center gap-3">
              <span className="text-3xl">
                {tabs.find(t => t.id === activeTab)?.icon || 
                 (activeTab === 'episode-status' ? '🪼' : 
                  activeTab === 'partners' ? '🎉' : '🎉')}
              </span>
              {tabs.find(t => t.id === activeTab)?.label || 
               (activeTab === 'episode-status' ? 'Episode Status' : 
                activeTab === 'partners' ? 'Partner Manager' : '')} Management
            </h2>
            <p className="text-purple-400/70 text-sm">
              Manage and control your content from this panel
            </p>
          </div>
          <ActiveComponent />
        </div>
      </div>

      {/* ✅ Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
};

export default AdminDashboard;