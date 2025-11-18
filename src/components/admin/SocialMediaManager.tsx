 // src/components/admin/SocialMediaManager.tsx - UPDATED WITH REAL SVG ICONS
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
const token = localStorage.getItem('adminToken') || '';

const SocialMediaManager: React.FC = () => {
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLink, setEditingLink] = useState<SocialMedia | null>(null);
  const [editForm, setEditForm] = useState({
    url: '',
    isActive: true
  });

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE}/admin/protected/social-media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSocialLinks(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load social media links');
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
      await axios.put(`${API_BASE}/admin/protected/social-media/${editingLink.platform}`, 
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Social media link updated successfully!');
      setEditingLink(null);
      fetchSocialLinks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  const toggleActive = async (link: SocialMedia) => {
    try {
      await axios.put(`${API_BASE}/admin/protected/social-media/${link.platform}`, 
        { ...link, isActive: !link.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchSocialLinks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update');
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'bg-blue-600';
      case 'instagram': return 'bg-pink-600';
      case 'telegram': return 'bg-blue-500';
      case 'twitter': return 'bg-sky-500';
      case 'youtube': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  // Real SVG Icons for Social Media (with currentColor for theme integration)
  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    switch (platform) {
      case 'facebook':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
            <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
            <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
            <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.007-.423A6.485 6.485 0 0 0 16 3.542a6.658 6.658 0 0 1-1.088.281 3.13 3.13 0 0 0 1.437-1.721 6.204 6.204 0 0 1-1.967.766A3.08 3.08 0 0 0 9.082 4.1a3.16 3.16 0 0 1-2.846-1.568 1.965 1.965 0 0 0 1.523-.577 3.917 3.917 0 0 1-1.605-.933 3.683 3.683 0 0 0 1.597-.635A3.845 3.845 0 0 1 1.152 3.9 5.73 5.73 0 0 0 3.713 9.5a3.84 3.84 0 0 1-1.735.228 3.044 3.044 0 0 0 1.383.775A7.42 7.42 0 0 1 .44 13.6a8.599 8.599 0 0 0 2.551.31 5.265 5.265 0 0 1-.982-.123 5.39 5.39 0 0 0 5.016 3.745A10.606 10.606 0 0 0 15 15.483a10.964 10.964 0 0 1-6.866 2.39"/>
          </svg>
        );
      case 'youtube':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
            <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.605 1.605c.265 1.23.307 4.288.307 6.11 0 1.823-.042 4.88-.307 6.11a2.01 2.01 0 0 1-1.605 1.605c-1.123.302-5.288.332-6.11.335h-.089c-.822-.003-4.987-.033-6.11-.335A2.01 2.01 0 0 1 .85 9.126c-.265-1.23-.307-4.288-.307-6.11 0-1.823.042-4.88.307-6.11A2.01 2.01 0 0 1 1.94 1.999C3.063 1.697 7.228 1.667 8.051 1.999zM6.5 5.5v7l5.5-3.5-5.5-3.5z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Social Media Links</h3>
        <button 
          onClick={fetchSocialLinks}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-6">
        {socialLinks.map(link => (
          <div key={link.platform} className="bg-slate-700/50 rounded-lg p-6 border border-slate-600/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${getPlatformColor(link.platform)} flex items-center justify-center`}>
                  <SocialIcon platform={link.platform} className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white capitalize">{link.displayName}</h4>
                  <p className="text-slate-400 text-sm break-all">{link.url}</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${
                    link.isActive 
                      ? 'bg-green-600/20 text-green-400' 
                      : 'bg-red-600/20 text-red-400'
                  }`}>
                    {link.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(link)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors"
                >
                  Edit Link
                </button>
                <button
                  onClick={() => toggleActive(link)}
                  className={`px-4 py-2 rounded transition-colors ${
                    link.isActive
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  } text-white`}
                >
                  {link.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingLink && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl max-w-md w-full animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                Edit {editingLink.displayName} Link
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
                  placeholder={`https://${editingLink.platform}.com/yourusername`}
                  required
                />
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
                  Active (show on website)
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
              <h4 className="text-sm font-medium text-slate-300 mb-2">Preview:</h4>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${getPlatformColor(editingLink.platform)} flex items-center justify-center`}>
                  <SocialIcon platform={editingLink.platform} className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white text-sm">{editingLink.displayName}</div>
                  <div className="text-slate-400 text-xs truncate max-w-xs">{editForm.url}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/30 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-3">💡 Tips</h4>
        <ul className="text-slate-400 text-sm space-y-2">
          <li>• Make sure URLs are complete (include https://)</li>
          <li>• Test links after updating to ensure they work</li>
          <li>• Disable platforms you don't want to display</li>
          <li>• Changes appear immediately on the website footer</li>
        </ul>
      </div>
    </div>
  );
};

export default SocialMediaManager;