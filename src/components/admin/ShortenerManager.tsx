// src/components/admin/ShortenerManager.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const SHORTENER_BASE = 'https://go.animebing.in';
const getToken = () => localStorage.getItem('adminToken') || '';

interface ShortLink {
  _id: string;
  code: string;
  url: string;
  label: string;
  clicks: number;
  createdAt: string;
  lastClicked: string | null;
}

const ShortenerManager: React.FC = () => {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({ code: '', url: '', label: '' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ url: '', label: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setLinks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Links load nahi hue: ' + (err.response?.data?.error || err.message));
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.code.trim() || !addForm.url.trim()) {
      toast.error('Code aur URL dono required hain');
      return;
    }
    setAdding(true);
    const toastId = toast.loading('Link ban raha hai...');
    try {
      await axios.post(
        `${SHORTENER_BASE}/admin/links`,
        {
          code: addForm.code.trim().toLowerCase(),
          url: addForm.url.trim(),
          label: addForm.label.trim() || addForm.code.trim()
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ Link ban gaya!', { id: toastId });
      setAddForm({ code: '', url: '', label: '' });
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Link banana fail hua', { id: toastId });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (link: ShortLink) => {
    if (editingId === link.code) {
      setEditingId(null);
    } else {
      setEditingId(link.code);
      setEditForm({ url: link.url || '', label: link.label || '' });
    }
  };

  const handleUpdate = async (code: string) => {
    const toastId = toast.loading('Update ho raha hai...');
    try {
      await axios.put(
        `${SHORTENER_BASE}/admin/links/${code}`,
        editForm,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ Update ho gaya!', { id: toastId });
      setEditingId(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update fail hua', { id: toastId });
    }
  };

  const handleDelete = async (code: string) => {
    const toastId = toast.loading('Delete ho raha hai...');
    try {
      await axios.delete(`${SHORTENER_BASE}/admin/links/${code}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('✅ Link delete ho gaya!', { id: toastId });
      setDeleteConfirm(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete fail hua', { id: toastId });
    }
  };

  const copyToClipboard = (code: string) => {
    const shortUrl = `https://go.animebing.in/${code}`;
    navigator.clipboard.writeText(shortUrl);
    setCopiedCode(code);
    toast.success('Link copy ho gaya!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredLinks = links.filter(link =>
    (link.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-lg">Links load ho rahe hain...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 min-h-screen">

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">Link Delete Karo?</h3>
            <p className="text-slate-300 text-sm mb-5">
              <span className="text-teal-300 font-mono">go.animebing.in/{deleteConfirm}</span> delete ho jayega. Yeh undo nahi hoga.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + Stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/20 rounded-xl">
            <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">
              URL Shortener
            </h1>
            <p className="text-xs text-white/40">go.animebing.in</p>
          </div>
        </div>

        <div className="flex gap-2 ml-auto flex-wrap">
          <div className="bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 text-sm text-teal-300">
            🔗 {links.length} Links
          </div>
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300">
            👆 {totalClicks} Total Clicks
          </div>
          <button
            onClick={fetchLinks}
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Add New Link Form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-teal-400">+</span> Naya Short Link Banao
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Short Code *</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/30 whitespace-nowrap">go.animebing.in/</span>
              <input
                type="text"
                value={addForm.code}
                onChange={e => setAddForm({
                  ...addForm,
                  code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')
                })}
                placeholder="ep1"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Target URL *</label>
            <input
              type="url"
              value={addForm.url}
              onChange={e => setAddForm({ ...addForm, url: e.target.value })}
              placeholder="https://cuty.io/abc123"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Label (optional)</label>
            <input
              type="text"
              value={addForm.label}
              onChange={e => setAddForm({ ...addForm, label: e.target.value })}
              placeholder="Naruto Ep 1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="md:col-span-3">
            {addForm.code && (
              <p className="text-xs text-teal-400 mb-2">
                Preview: <span className="font-mono">https://go.animebing.in/{addForm.code}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={adding}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg text-sm transition flex items-center gap-2"
            >
              {adding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Ban raha hai...
                </>
              ) : '+ Link Banao'}
            </button>
          </div>
        </form>
      </div>

      {/* Search + Links Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search links..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-xs text-white/40">{filteredLinks.length} / {links.length} links</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Short URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Label</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Target URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Clicks</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Last Click</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                    {links.length === 0
                      ? 'Abhi koi link nahi hai. Upar se banao!'
                      : 'Koi link match nahi hua.'}
                  </td>
                </tr>
              ) : (
                filteredLinks.map(link => (
                  <React.Fragment key={link.code}>
                    <tr className={`hover:bg-white/5 transition ${editingId === link.code ? 'bg-white/10' : ''}`}>

                      {/* Short URL */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-teal-300 text-xs">
                            go.animebing.in/{link.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(link.code)}
                            className="text-white/40 hover:text-white transition"
                            title="Copy"
                          >
                            {copiedCode === link.code ? (
                              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Label */}
                      <td className="px-4 py-3">
                        <span className="text-white/80 text-xs">{link.label || '—'}</span>
                      </td>

                      {/* Target URL */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <a
                          href={link.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-[180px]"
                          title={link.url || ''}
                          onClick={e => { if (!link.url) e.preventDefault(); }}
                        >
                          {link.url
                            ? (link.url.length > 40 ? link.url.substring(0, 40) + '...' : link.url)
                            : 'No URL'}
                        </a>
                      </td>

                      {/* Clicks */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          (link.clicks || 0) > 100
                            ? 'bg-green-500/20 text-green-300'
                            : (link.clicks || 0) > 10
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-white/10 text-white/60'
                        }`}>
                          {link.clicks || 0}
                        </span>
                      </td>

                      {/* Last Click */}
                      <td className="px-4 py-3">
                        <span className="text-white/40 text-xs">
                          {link.lastClicked
                            ? new Date(link.lastClicked).toLocaleDateString('en-IN')
                            : 'Never'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEdit(link)}
                            className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                              editingId === link.code
                                ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200'
                                : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40'
                            }`}
                          >
                            {editingId === link.code ? '✕ Cancel' : '✎ Edit'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(link.code)}
                            className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium transition"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Edit Row */}
                    {editingId === link.code && (
                      <tr key={`edit-${link.code}`} className="bg-white/5">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="border-l-4 border-indigo-500 pl-4 space-y-3">
                            <h4 className="text-sm font-semibold text-white">
                              Edit: go.animebing.in/{link.code}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-white/50 mb-1 block">Target URL</label>
                                <input
                                  type="url"
                                  value={editForm.url}
                                  onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-white/50 mb-1 block">Label</label>
                                <input
                                  type="text"
                                  value={editForm.label}
                                  onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(link.code)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-1.5 px-4 rounded-lg text-sm"
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 px-4 rounded-lg text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShortenerManager;