  // src/components/admin/SocialMediaManager.tsx - ULTIMATE FIX VERSION
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

  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    switch (platform) {
      case 'facebook':
        return (
          <svg className={className} fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg className={className} viewBox="0 0 24 24">
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdf497"/>
                <stop offset="30%" stopColor="#fd5949"/>
                <stop offset="60%" stopColor="#d6249f"/>
                <stop offset="100%" stopColor="#285AEB"/>
              </linearGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="url(#instagram-gradient)"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg className={className} fill="#0088CC" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.139l-1.671 7.894c-.236 1.001-.837 1.248-1.697.775l-4.688-3.454-2.26 2.178c-.249.249-.459.459-.935.459l.336-4.773 8.665-5.515c.387-.247.741-.112.45.141l-7.07 6.389-3.073-.967c-1.071-.336-1.092-1.071.223-1.585l12.18-4.692c.892-.336 1.674.223 1.383 1.383z"/>
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
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Refresh
          </button>
          <button 
            onClick={applyDirectLinks}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Apply Direct Fix
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-900/30 border border-green-500 text-green-300 p-4 rounded-lg">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
        <h4 className="text-lg font-medium text-blue-300 mb-2">🔧 FIX INSTRUCTIONS:</h4>
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  link.platform === 'instagram' ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500' :
                  link.platform === 'facebook' ? 'bg-blue-600' :
                  'bg-blue-500'
                }`}>
                  <SocialIcon platform={link.platform} className="w-6 h-6 text-white" />
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Test Link
                    </button>
                    {link.platform === 'instagram' && link.url.includes('?igsh=') && (
                      <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded">
                        ❌ Wrong format (remove ?igsh=...)
                      </span>
                    )}
                    {link.platform === 'telegram' && link.url.includes('animebingofficile') && (
                      <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded">
                        ❌ Typo (should be animebingofficial)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(link)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors text-sm"
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
              <h3 className="text-xl font-bold text-white">
                Edit {editingLink.displayName}
              </h3>
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
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex-1"
                >
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
                <div className={`w-8 h-8 rounded-full ${
                  editingLink.platform === 'instagram' ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500' :
                  editingLink.platform === 'facebook' ? 'bg-blue-600' :
                  'bg-blue-500'
                } flex items-center justify-center`}>
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
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Test this link
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/30 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-3">✅ VERIFICATION STEPS:</h4>
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
