 // src/components/admin/SocialMediaManager.tsx - IMPROVED UI (Instructions removed)
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

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

const SocialMediaManager: React.FC = () => {
  // Default list includes all five platforms, Twitter & YouTube inactive
  const defaultSocialLinks: SocialMedia[] = [
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
    },
    {
      platform: 'twitter',
      url: 'https://twitter.com/animebing',
      isActive: false,
      icon: 'twitter',
      displayName: 'Twitter'
    },
    {
      platform: 'youtube',
      url: 'https://youtube.com/c/animebing',
      isActive: false,
      icon: 'youtube',
      displayName: 'YouTube'
    }
  ];
  
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>(defaultSocialLinks);
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
      
      if (data && data.length > 0) {
        // Merge fetched data with default list so missing platforms are kept
        const merged = defaultSocialLinks.map(defaultItem => {
          const found = data.find((item: SocialMedia) => item.platform === defaultItem.platform);
          return found ? { ...defaultItem, ...found } : defaultItem;
        });
        setSocialLinks(merged);
      } else {
        // No data from API, keep defaults
        setSocialLinks(defaultSocialLinks);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
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
      
      // URL validation and formatting
      let formattedUrl = editForm.url.trim();
      
      // Platform-specific formatting
      switch (editingLink.platform) {
        case 'instagram':
          if (formattedUrl.includes('?')) formattedUrl = formattedUrl.split('?')[0];
          if (formattedUrl.includes('www.')) formattedUrl = formattedUrl.replace('www.', '');
          if (!formattedUrl.startsWith('https://instagram.com/')) {
            if (formattedUrl.includes('instagram.com/')) {
              formattedUrl = 'https://instagram.com/' + formattedUrl.split('instagram.com/')[1];
            } else {
              formattedUrl = 'https://instagram.com/' + formattedUrl.split('/').pop();
            }
          }
          break;
        case 'telegram':
          if (!formattedUrl.startsWith('https://t.me/')) {
            if (formattedUrl.includes('t.me/')) {
              formattedUrl = 'https://t.me/' + formattedUrl.split('t.me/')[1];
            } else {
              formattedUrl = 'https://t.me/' + formattedUrl.split('/').pop();
            }
          }
          break;
        case 'facebook':
          if (!formattedUrl.startsWith('https://facebook.com/') && !formattedUrl.startsWith('https://www.facebook.com/')) {
            if (formattedUrl.includes('facebook.com/')) {
              formattedUrl = 'https://facebook.com/' + formattedUrl.split('facebook.com/')[1];
            } else {
              formattedUrl = 'https://facebook.com/' + formattedUrl.split('/').pop();
            }
          }
          break;
        case 'twitter':
          if (!formattedUrl.startsWith('https://twitter.com/') && !formattedUrl.startsWith('https://x.com/')) {
            if (formattedUrl.includes('twitter.com/')) {
              formattedUrl = 'https://twitter.com/' + formattedUrl.split('twitter.com/')[1];
            } else if (formattedUrl.includes('x.com/')) {
              formattedUrl = 'https://twitter.com/' + formattedUrl.split('x.com/')[1];
            } else {
              formattedUrl = 'https://twitter.com/' + formattedUrl.split('/').pop();
            }
          }
          break;
        case 'youtube':
          if (!formattedUrl.startsWith('https://youtube.com/') && !formattedUrl.startsWith('https://www.youtube.com/')) {
            if (formattedUrl.includes('youtube.com/')) {
              formattedUrl = 'https://youtube.com/' + formattedUrl.split('youtube.com/')[1];
            } else {
              formattedUrl = 'https://youtube.com/@' + formattedUrl.split('/').pop();
            }
          }
          break;
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
        { platform: 'facebook', url: 'https://facebook.com/animebingofficial' },
        { platform: 'twitter', url: 'https://twitter.com/animebing' },
        { platform: 'youtube', url: 'https://youtube.com/c/animebing' }
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

  // ✅ CLEAN INSTAGRAM ICON (same as before)
  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    if (platform === 'instagram') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    }
    if (platform === 'twitter') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    }
    if (platform === 'youtube') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    }
    if (platform === 'facebook') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    }
    if (platform === 'telegram') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    }
    // Default fallback
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    );
  };

  // Platform background gradients (modern)
  const getPlatformBg = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400';
      case 'facebook':
        return 'bg-gradient-to-br from-blue-700 to-blue-500';
      case 'telegram':
        return 'bg-gradient-to-br from-blue-600 to-sky-500';
      case 'twitter':
        return 'bg-gradient-to-br from-gray-800 to-gray-700';
      case 'youtube':
        return 'bg-gradient-to-br from-red-700 to-red-500';
      default:
        return 'bg-gradient-to-br from-gray-700 to-gray-600';
    }
  };

  // Simple icon helper for buttons
  const UIIcon = ({ type, className = "w-4 h-4" }: { type: string; className?: string }) => {
    if (type === 'refresh') {
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }
    if (type === 'check') {
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (type === 'external') {
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      );
    }
    if (type === 'edit') {
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    }
    return null;
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Header with buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
            Social Media Links
          </h2>
          <p className="text-sm text-white/50 mt-1">Manage your brand presence across platforms</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchSocialLinks}
            className="bg-[#1f2330] hover:bg-[#2a2f3f] text-white px-4 py-2 rounded-xl text-sm transition flex items-center gap-2 border border-[#2a2f3f]"
          >
            <UIIcon type="refresh" />
            Refresh
          </button>
          <button 
            onClick={applyDirectLinks}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-sm transition flex items-center gap-2 shadow-md"
          >
            <UIIcon type="check" />
            Apply Direct Fix
          </button>
        </div>
      </div>

      {/* Success / Error messages */}
      {successMessage && (
        <div className="bg-emerald-900/30 border border-emerald-500/50 text-emerald-300 p-4 rounded-xl flex items-center gap-2">
          <UIIcon type="check" className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-4 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </div>
      )}

      {/* Social Links Grid */}
      <div className="grid gap-4">
        {socialLinks.map(link => (
          <div
            key={link.platform}
            className="bg-[#1a1e2a] border border-[#2a2f3f] rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/5"
          >
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Icon with gradient background */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${getPlatformBg(link.platform)}`}>
                  <SocialIcon platform={link.platform} className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{link.displayName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      link.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {link.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[#8a8fa8] text-sm break-all mt-1 font-mono">{link.url}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => testLink(link.url, link.platform)}
                      className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 transition"
                    >
                      <UIIcon type="external" className="w-3 h-3" />
                      Test Link
                    </button>
                    {link.platform === 'instagram' && link.url.includes('?igsh=') && (
                      <span className="text-red-400 text-xs bg-red-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Wrong format (remove ?igsh=...)
                      </span>
                    )}
                    {link.platform === 'telegram' && link.url.includes('animebingofficile') && (
                      <span className="text-red-400 text-xs bg-red-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Typo – correct: animebingofficial
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleEdit(link)}
                className="bg-[#2a2f3f] hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm transition flex items-center gap-2 self-start md:self-center"
              >
                <UIIcon type="edit" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal – same clean modal, but with better spacing */}
      {editingLink && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1e2a] border border-[#2a2f3f] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2f3f]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getPlatformBg(editingLink.platform)}`}>
                  <SocialIcon platform={editingLink.platform} className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Edit {editingLink.displayName}
                </h3>
              </div>
              <button
                onClick={() => setEditingLink(null)}
                className="text-[#8a8fa8] hover:text-white text-2xl transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#cbd5e6] mb-2">URL *</label>
                <input
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full bg-[#0f1219] border border-[#2a2f3f] text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition"
                  placeholder={`https://${editingLink.platform}.com/...`}
                  required
                />
                <div className="text-xs text-[#8a8fa8] mt-2 space-y-1">
                  <p className="font-semibold text-amber-400">Correct format:</p>
                  {editingLink.platform === 'instagram' && <p>https://instagram.com/username (NO ?igsh=...)</p>}
                  {editingLink.platform === 'telegram' && <p>https://t.me/channelname</p>}
                  {editingLink.platform === 'facebook' && <p>https://facebook.com/pagename</p>}
                  {editingLink.platform === 'twitter' && <p>https://twitter.com/username</p>}
                  {editingLink.platform === 'youtube' && <p>https://youtube.com/@channel or /c/channel</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-500 bg-[#0f1219] border-[#2a2f3f] rounded focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-sm text-white/80">
                  Show on website
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <UIIcon type="check" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-6 bg-[#2a2f3f] hover:bg-[#3a3f55] text-white font-semibold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="bg-[#0f1219] p-4 border-t border-[#2a2f3f]">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getPlatformBg(editingLink.platform)}`}>
                  <SocialIcon platform={editingLink.platform} className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{editingLink.displayName}</div>
                  <div className="text-[#8a8fa8] text-xs truncate">{editForm.url || 'No URL set'}</div>
                </div>
                <button
                  onClick={() => testLink(editForm.url || '#', editingLink.platform)}
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                  disabled={!editForm.url}
                >
                  <UIIcon type="external" className="w-3 h-3" />
                  Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialMediaManager;