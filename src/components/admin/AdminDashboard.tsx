  // src/components/admin/AdminDashboard.tsx - UPDATED WITH ENHANCED UI
import React, { useState, useEffect } from 'react';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import FeaturedAnimeManager from './FeaturedAnimeManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import Spinner from '../Spinner';
import axios from 'axios';

const API_BASE = 'https://animabing.onrender.com/api';

interface AdminDashboardProps {
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [analytics, setAnalytics] = useState({ 
    totalAnimes: 0, 
    totalMovies: 0, 
    totalEpisodes: 0, 
    todayUsers: 0, 
    totalUsers: 0,
    totalManga: 0
  });
  const [user, setUser] = useState({ username: '', email: '', profileImage: '' });
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      setError('No authentication token found. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return;
    }

    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: userData } = await axios.get(`${API_BASE}/admin/protected/user-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(userData);

      const { data: stats } = await axios.get(`${API_BASE}/admin/protected/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(stats);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');

      if (onLogout) {
        onLogout();
      } else {
        window.location.href = '/';
      }
    }
  };

  const tabs = [
    { id: 'list', label: 'Content List', icon: '📋', component: <AnimeListTable /> },
    { id: 'add', label: 'Add Content', icon: '➕', component: <AddAnimeForm /> },
    { id: 'episodes', label: 'Episodes', icon: '🎬', component: <EpisodesManager /> },
    { id: 'featured', label: 'Featured Anime', icon: '⭐', component: <FeaturedAnimeManager /> },
    { id: 'reports', label: 'User Reports', icon: '📊', component: <ReportsManager /> },
    { id: 'social', label: 'Social Media', icon: '📱', component: <SocialMediaManager /> },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || <AnimeListTable />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/50 backdrop-blur rounded-2xl p-8 text-center shadow-2xl shadow-red-500/10">
            <h2 className="text-3xl font-bold mb-4 text-red-300">Error</h2>
            <p className="mb-6 text-red-100">{error}</p>
            <button
              onClick={loadInitialData}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-3 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-xl border-r border-slate-700/50 p-4 sticky top-0 h-screen overflow-y-auto shadow-2xl transition-all duration-300`}>
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/50">
              ⚙️
            </div>
            {sidebarOpen && <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">AdminPanel</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition duration-200 hidden lg:block text-slate-400 hover:text-slate-200"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* User Info */}
        {sidebarOpen && (
          <div className="mb-8 p-4 bg-gradient-to-br from-purple-900/30 to-slate-800/50 rounded-xl border border-purple-500/20 shadow-lg hover:shadow-purple-500/30 transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">
                {user.username?.charAt(0).toUpperCase() || '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-purple-300 truncate text-sm">{user.username || 'Admin'}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-purple-500/20">
              <p className="text-xs text-slate-400 font-semibold">👑 Admin Access</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 group ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-lg shadow-purple-500/20 border border-purple-400/30'
                  : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
              }`}
              title={!sidebarOpen ? tab.label : ''}
            >
              <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{tab.icon}</span>
              {sidebarOpen && <span className="font-medium text-sm">{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="mt-8 pt-6 border-t border-slate-700/30">
            <button
              onClick={handleLogout}
              className="w-full bg-gradient-to-r from-red-600/40 to-red-700/40 hover:from-red-600/60 hover:to-red-700/60 text-red-200 px-4 py-2.5 rounded-lg transition font-semibold text-sm border border-red-500/40 shadow-lg"
            >
              🚪 Logout
            </button>
          </div>
        )}

        {!sidebarOpen && (
          <div className="mt-8 pt-6 border-t border-slate-700/30">
            <button
              onClick={handleLogout}
              className="w-full bg-gradient-to-r from-red-600/40 to-red-700/40 hover:from-red-600/60 hover:to-red-700/60 p-2 rounded-lg transition"
              title="Logout"
            >
              🚪
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-slate-800/50 via-slate-800/30 to-slate-700/50 backdrop-blur-xl border-b border-slate-700/50 p-6 shadow-xl">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                {tabs.find(t => t.id === activeTab)?.label}
              </h1>
              <p className="text-sm text-slate-400 mt-2">Manage your content efficiently •Welcome back Harsh Rathore, <span className="text-purple-300 font-semibold">{user.username || 'Admin'}</span>! 👋</p>
            </div>
            <button
              onClick={loadInitialData}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-2.5 rounded-lg transition transform hover:scale-105 font-semibold shadow-lg shadow-purple-500/30 whitespace-nowrap"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Analytics Cards */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-purple-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Total Content</p>
              <p className="text-2xl font-bold text-purple-300">{analytics.totalAnimes + analytics.totalMovies + analytics.totalManga}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-blue-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Anime</p>
              <p className="text-2xl font-bold text-blue-300">{analytics.totalAnimes}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-green-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Movies</p>
              <p className="text-2xl font-bold text-green-300">{analytics.totalMovies}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-orange-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Manga</p>
              <p className="text-2xl font-bold text-orange-300">{analytics.totalManga}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-yellow-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Episodes</p>
              <p className="text-2xl font-bold text-yellow-300">{analytics.totalEpisodes}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/40 rounded-xl p-4 backdrop-blur shadow-lg hover:shadow-pink-500/20 transition-shadow">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Users Today</p>
              <p className="text-2xl font-bold text-pink-300">{analytics.todayUsers}</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/20 rounded-2xl p-8 shadow-2xl border border-slate-700/40 backdrop-blur-sm">
            {ActiveComponent}
          </div>

          {/* Footer - REMOVED AS REQUESTED */}
          {/* Status indicator has been removed from the footer */}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
