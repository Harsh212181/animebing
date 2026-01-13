 // src/components/admin/SocialMediaManager.tsx - FIXED ICONS WITHOUT REACT-ICONS
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../Spinner';

interface SocialMedia {
  _id?: string;
  platform: string;
  url: string;
  isActive: boolean;
  icon: string;
  displayName: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const SocialMediaManager: React.FC = () => {
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>([
    {
      platform: 'instagram',
      url: 'https://instagram.com/animebingofficial',
      isActive: true,
      icon: 'instagram',
      displayName: 'Instagram'
    },
    {
      platform: 'telegram',
      url: 'https://t.me/animebingofficial',
      isActive: true,
      icon: 'telegram',
      displayName: 'Telegram'
    },
    {
      platform: 'facebook',
      url: 'https://facebook.com/animebingofficial',
      isActive: true,
      icon: 'facebook',
      displayName: 'Facebook'
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingLink, setEditingLink] = useState<SocialMedia | null>(null);
  const [editForm, setEditForm] = useState({
    url: '',
    isActive: true
  });
  const [successMessage, setSuccessMessage] = useState('');

  const getToken = () => {
    return localStorage.getItem('adminToken') || '';
  };

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const { data } = await axios.get(`${API_BASE}/social/admin/all`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // यदि कोई डेटा नहीं है तो डिफ़ॉल्ट सेट करें
      if (data && data.length > 0) {
        setSocialLinks(data);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      // API error होने पर भी डिफ़ॉल्ट दिखाएं
      setError('API connection failed. Using default links.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (link: SocialMedia) => {
    setEditingLink(link);
    setEditForm({
      url: link.url,
      isActive: link.isActive
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    try {
      const token = getToken();
      
      // URL validation और formatting
      let formattedUrl = editForm.url.trim();
      
      // Instagram के लिए सही फॉर्मेट
      if (editingLink.platform === 'instagram') {
        // Remove query parameters and ensure correct format
        if (formattedUrl.includes('?')) {
          formattedUrl = formattedUrl.split('?')[0];
        }
        if (formattedUrl.includes('www.')) {
          formattedUrl = formattedUrl.replace('www.', '');
        }
        if (!formattedUrl.startsWith('https://instagram.com/')) {
          if (formattedUrl.includes('instagram.com/')) {
            formattedUrl = 'https://instagram.com/' + formattedUrl.split('instagram.com/')[1];
          } else {
            formattedUrl = 'https://instagram.com/' + formattedUrl.split('/').pop();
          }
        }
      }
      
      // Telegram के लिए सही फॉर्मेट
      if (editingLink.platform === 'telegram') {
        if (!formattedUrl.startsWith('https://t.me/')) {
          if (formattedUrl.includes('t.me/')) {
            formattedUrl = 'https://t.me/' + formattedUrl.split('t.me/')[1];
          } else {
            formattedUrl = 'https://t.me/' + formattedUrl.split('/').pop();
          }
        }
      }
      
      // Facebook के लिए सही फॉर्मेट
      if (editingLink.platform === 'facebook') {
        if (!formattedUrl.startsWith('https://facebook.com/') && 
            !formattedUrl.startsWith('https://www.facebook.com/')) {
          if (formattedUrl.includes('facebook.com/')) {
            formattedUrl = 'https://facebook.com/' + formattedUrl.split('facebook.com/')[1];
          } else {
            formattedUrl = 'https://facebook.com/' + formattedUrl.split('/').pop();
          }
        }
      }

      await axios.put(
        `${API_BASE}/social/admin/${editingLink.platform}`, 
        { url: formattedUrl, isActive: editForm.isActive },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      setSuccessMessage(`✅ ${editingLink.displayName} link updated successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setEditingLink(null);
      fetchSocialLinks();
    } catch (err: any) {
      console.error('Update error:', err);
      alert(err.response?.data?.error || 'Update failed. Please check URL format.');
    }
  };

  const applyDirectLinks = async () => {
    if (!confirm('This will directly update all social media links. Continue?')) return;
    
    try {
      const token = getToken();
      
      // Directly set all links with correct format
      const linksToUpdate = [
        { platform: 'instagram', url: 'https://instagram.com/animebingofficial' },
        { platform: 'telegram', url: 'https://t.me/animebingofficial' },
        { platform: 'facebook', url: 'https://facebook.com/animebingofficial' }
      ];
      
      for (const link of linksToUpdate) {
        await axios.put(
          `${API_BASE}/social/admin/${link.platform}`, 
          { url: link.url, isActive: true },
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
      }
      
      setSuccessMessage('✅ All social media links updated directly!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchSocialLinks();
    } catch (err: any) {
      console.error('Direct update error:', err);
      alert('Direct update failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const testLink = (url: string, platform: string) => {
    window.open(url, '_blank');
  };

  // Simple SVG Icons - FIXED VERSION
  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    const svgClass = `${className} ${platform === 'instagram' ? 'text-white' : 
                     platform === 'facebook' ? 'text-white' : 'text-white'}`;
    
    // Instagram Icon
    if (platform === 'instagram') {
      return (
        <svg className={svgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="8" fill="url(#instagram-gradient)" />
          <defs>
            <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="25%" stopColor="#fd5949" />
              <stop offset="50%" stopColor="#d6249f" />
              <stop offset="100%" stopColor="#285AEB" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="17" cy="7" r="1.5" fill="white" />
        </svg>
      );
    }
    
    // Facebook Icon
    if (platform === 'facebook') {
      return (
        <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    }
    
    // Telegram Icon
    if (platform === 'telegram') {
      return (
        <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.139l-1.671 7.894c-.236 1.001-.837 1.248-1.697.775l-4.688-3.454-2.26 2.178c-.249.249-.459.459-.935.459l.336-4.773 8.665-5.515c.387-.247.741-.112.45.141l-7.07 6.389-3.073-.967c-1.071-.336-1.092-1.071.223-1.585l12.18-4.692c.892-.336 1.674.223 1.383 1.383z" />
        </svg>
      );
    }
    
    // Default icon
    return (
      <svg className={svgClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    );
  };

  // Platform Background Colors
  const getPlatformBgColor = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return 'bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500';
      case 'facebook':
        return 'bg-blue-600';
      case 'telegram':
        return 'bg-blue-500';
      default:
        return 'bg-gray-600';
    }
  };

  // Simple Icon Component for UI
  const SimpleIcon = ({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) => {
    switch (icon) {
      case 'refresh':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'check':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'external-link':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Social Media Links</h3>
        <div className="flex gap-2">
          <button 
            onClick={fetchSocialLinks}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
          >
            <SimpleIcon icon="refresh" className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={applyDirectLinks}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
          >
            <SimpleIcon icon="check" className="w-4 h-4" />
            Apply Direct Fix
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-900/30 border border-green-500 text-green-300 p-4 rounded-lg flex items-center gap-2">
          <SimpleIcon icon="check" className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 p-4 rounded-lg flex items-center gap-2">
          <SimpleIcon icon="warning" className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
        <h4 className="text-lg font-medium text-blue-300 mb-2 flex items-center gap-2">
          <SimpleIcon icon="warning" className="w-5 h-5" />
          FIX INSTRUCTIONS:
        </h4>
        <ul className="text-blue-200 text-sm space-y-2">
          <li>1. Click <strong>"Apply Direct Fix"</strong> button to automatically fix all links</li>
          <li>2. Or manually edit each link with correct format:</li>
          <li className="ml-4">• Instagram: <code className="bg-black/40 px-2 py-1 rounded">https://instagram.com/animebingofficial</code></li>
          <li className="ml-4">• Telegram: <code className="bg-black/40 px-2 py-1 rounded">https://t.me/animebingofficial</code></li>
          <li className="ml-4">• Facebook: <code className="bg-black/40 px-2 py-1 rounded">https://facebook.com/animebingofficial</code></li>
        </ul>
      </div>

      <div className="grid gap-6">
        {socialLinks.map(link => (
          <div key={link.platform} className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getPlatformBgColor(link.platform)}`}>
                  <SocialIcon platform={link.platform} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-white capitalize">{link.displayName}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      link.isActive 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {link.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm break-all mt-1">{link.url}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => testLink(link.url, link.platform)}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                    >
                      <SimpleIcon icon="external-link" className="w-4 h-4" />
                      Test Link
                    </button>
                    {link.platform === 'instagram' && link.url.includes('?igsh=') && (
                      <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded flex items-center gap-1">
                        <SimpleIcon icon="warning" className="w-3 h-3" />
                        Wrong format (remove ?igsh=...)
                      </span>
                    )}
                    {link.platform === 'telegram' && link.url.includes('animebingofficile') && (
                      <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded flex items-center gap-1">
                        <SimpleIcon icon="warning" className="w-3 h-3" />
                        Typo (should be animebingofficial)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(link)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors text-sm flex items-center gap-2"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingLink && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getPlatformBgColor(editingLink.platform)}`}>
                  <SocialIcon platform={editingLink.platform} className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Edit {editingLink.displayName}
                </h3>
              </div>
              <button
                onClick={() => setEditingLink(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL *
                </label>
                <input
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder={
                    editingLink.platform === 'instagram' 
                      ? 'https://instagram.com/animebingofficial'
                      : editingLink.platform === 'telegram'
                      ? 'https://t.me/animebingofficial'
                      : 'https://facebook.com/animebingofficial'
                  }
                  required
                />
                <div className="text-xs text-slate-400 mt-2">
                  <strong>Correct format:</strong><br/>
                  {editingLink.platform === 'instagram' && 'https://instagram.com/username (NO ?igsh=...)'}<br/>
                  {editingLink.platform === 'telegram' && 'https://t.me/channelname'}<br/>
                  {editingLink.platform === 'facebook' && 'https://facebook.com/pagename'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-purple-600 bg-slate-800 border-slate-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-300">
                  Show on website
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2"
                >
                  <SimpleIcon icon="check" className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full ${getPlatformBgColor(editingLink.platform)} flex items-center justify-center`}>
                  <SocialIcon platform={editingLink.platform} className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{editingLink.displayName}</div>
                  <div className="text-slate-400 text-xs truncate max-w-xs">
                    {editForm.url || 'No URL set'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => testLink(editForm.url || '#', editingLink.platform)}
                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                disabled={!editForm.url}
              >
                <SimpleIcon icon="external-link" className="w-3 h-3" />
                Test this link
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/30 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <SimpleIcon icon="check" className="w-5 h-5 text-green-400" />
          VERIFICATION STEPS:
        </h4>
        <ol className="text-slate-400 text-sm space-y-2">
          <li>1. Click "Apply Direct Fix" button</li>
          <li>2. Open website in another device</li>
          <li>3. Click social media icons in footer</li>
          <li>4. They should open correct Instagram/TG/FB profiles</li>
          <li>5. If not working, use MongoDB Compass to directly update database</li>
        </ol>
      </div>
    </div>
  );
};

export default SocialMediaManager;