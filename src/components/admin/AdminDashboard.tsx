 // src/components/admin/AdminDashboard.tsx - UPDATED WITHOUT SETTINGS
import React, { useState, useEffect } from 'react';
import AnimeListTable from './AnimeListTable';
import AddAnimeForm from './AddAnimeForm';
import EpisodesManager from './EpisodesManager';
import ReportsManager from './ReportsManager';
import SocialMediaManager from './SocialMediaManager';
import AdManager from './AdManager';
import Spinner from '../Spinner';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

interface AdminDashboardProps {
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState({ totalAnimes: 0, totalMovies: 0, totalEpisodes: 0, todayUsers: 0, totalUsers: 0 });
  const [user, setUser] = useState({ username: '', email: '' });
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
      // Fetch admin user info
      const { data: userData } = await axios.get(`${API_BASE}/admin/protected/user-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(userData);

      // Fetch analytics
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

  // UPDATED: Removed Settings tab
  const tabs = [
    { id: 'list', label: 'Content List', component: <AnimeListTable /> },
    { id: 'add', label: 'Add Content', component: <AddAnimeForm /> },
    { id: 'episodes', label: 'Episodes', component: <EpisodesManager /> },
    { id: 'reports', label: 'User Reports', component: <ReportsManager /> },
    { id: 'social', label: 'Social Media', component: <SocialMediaManager /> },
    { id: 'ads', label: 'Ad Management', component: <AdManager /> }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || <AnimeListTable />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-600/20 border border-red-500 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Error</h2>
            <p className="mb-4">{error}</p>
            <button
              onClick={loadInitialData}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <span className="text-sm text-slate-400">Welcome back, {user.username}!</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Desktop view */}
            <div className="text-sm text-slate-400 hidden md:block">
              <span className="text-purple-400">Content: {analytics.totalAnimes + analytics.totalMovies}</span>
              <span className="mx-2">•</span>
              <span className="text-blue-400">Anime: {analytics.totalAnimes}</span>
              <span className="mx-2">•</span>
              <span className="text-green-400">Movies: {analytics.totalMovies}</span>
              <span className="mx-2">•</span>
              <span className="text-yellow-400">Episodes: {analytics.totalEpisodes}</span>
              <span className="mx-2">•</span>
              <span className="text-pink-400">Users: {analytics.todayUsers}</span>
            </div>
            {/* Mobile view */}
            <div className="text-sm text-slate-400 md:hidden">
              Content: {analytics.totalAnimes + analytics.totalMovies} |
              A:{analytics.totalAnimes} M:{analytics.totalMovies} |
              E:{analytics.totalEpisodes}
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-wrap gap-2 mb-8 bg-slate-700/50 p-2 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 rounded-lg transition font-medium text-sm ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-800/50 rounded-lg p-6 shadow-lg">
          {ActiveComponent}
        </div>

        <footer className="mt-8 p-4 bg-slate-800/30 rounded-lg text-center text-sm text-slate-400">
          <p>Quick Actions:
            <button onClick={loadInitialData} className="ml-2 text-purple-400 hover:text-purple-300">Refresh Dashboard</button>
          </p>
          <p className="mt-2">Server Status: Online | Last Updated: {new Date().toLocaleString()}</p>
        </footer>
      </div>
    </div>
  );
};

export default AdminDashboard;