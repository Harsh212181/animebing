// src/components/admin/ShortenerManager.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const SHORTENER_BASE = 'https://go.animebing.in';
const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';
const getToken = () => localStorage.getItem('adminToken') || '';

interface ShortLink {
  _id: string;
  code: string;
  url: string;
  label: string;
  clicks: number;
  userId?: string;
  createdAt: string;
  lastClicked: string | null;
}

interface ShortUser {
  _id: string;
  username: string;
  password: string;
  realName: string;
  ratePerThousand: number;
  isActive: boolean;
  totalClicks: number;
  totalEarnings: number;
  unpaidEarnings: number;
  paidEarnings: number;
  createdAt: string;
}

const ShortenerManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'links' | 'users'>('links');

  // ===== LINKS STATE =====
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [addForm, setAddForm] = useState({ code: '', url: '', label: '', userId: '' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ url: '', label: '', userId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // ===== USERS STATE =====
  const [users, setUsers] = useState<ShortUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [addUserForm, setAddUserForm] = useState({
    username: '', password: '', realName: '', ratePerThousand: 10
  });
  const [addingUser, setAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    password: '', realName: '', ratePerThousand: 10, isActive: true
  });
  const [paymentModal, setPaymentModal] = useState<ShortUser | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
    fetchUsers();
  }, []);

  // ===== LINKS FUNCTIONS =====
  const fetchLinks = async () => {
    setLinksLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setLinks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Links load nahi hue: ' + (err.response?.data?.error || err.message));
      setLinks([]);
    } finally {
      setLinksLoading(false);
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
          label: addForm.label.trim() || addForm.code.trim(),
          userId: addForm.userId || null
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ Link ban gaya!', { id: toastId });
      setAddForm({ code: '', url: '', label: '', userId: '' });
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
      setEditForm({ url: link.url || '', label: link.label || '', userId: link.userId || '' });
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
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    setCopiedCode(code);
    toast.success('Link copy ho gaya!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ===== USERS FUNCTIONS =====
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/users`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Users load nahi hue: ' + (err.response?.data?.error || err.message));
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserForm.username.trim() || !addUserForm.password.trim() || !addUserForm.realName.trim()) {
      toast.error('Sab fields required hain');
      return;
    }
    setAddingUser(true);
    const toastId = toast.loading('User ban raha hai...');
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/users`,
        addUserForm,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ User ban gaya!', { id: toastId });
      setAddUserForm({ username: '', password: '', realName: '', ratePerThousand: 10 });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'User banana fail hua', { id: toastId });
    } finally {
      setAddingUser(false);
    }
  };

  const handleEditUser = (user: ShortUser) => {
    if (editingUserId === user._id) {
      setEditingUserId(null);
    } else {
      setEditingUserId(user._id);
      setEditUserForm({
        password: user.password === '***' ? '' : user.password,
        realName: user.realName,
        ratePerThousand: user.ratePerThousand,
        isActive: user.isActive
      });
    }
  };

  const handleUpdateUser = async (userId: string) => {
    const toastId = toast.loading('Update ho raha hai...');
    try {
      const updateData: any = {
        realName: editUserForm.realName,
        ratePerThousand: editUserForm.ratePerThousand,
        isActive: editUserForm.isActive
      };
      if (editUserForm.password.trim()) {
        updateData.password = editUserForm.password.trim();
      }
      await axios.put(
        `${API_BASE}/short-users/admin/users/${userId}`,
        updateData,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ User update ho gaya!', { id: toastId });
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update fail hua', { id: toastId });
    }
  };

  const handlePayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valid amount dalo');
      return;
    }
    setPayingId(paymentModal._id);
    const toastId = toast.loading('Payment mark ho rahi hai...');
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/users/${paymentModal._id}/pay`,
        { amount, note: paymentNote },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`✅ ₹${amount} payment mark ho gaya!`, { id: toastId });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNote('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Payment fail hua', { id: toastId });
    } finally {
      setPayingId(null);
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '—';
    const user = users.find(u => u._id === userId);
    return user ? `${user.realName} (${user.username})` : 'Unknown';
  };

  const filteredLinks = links.filter(link =>
    (link.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const totalUnpaid = users.reduce((sum, u) => sum + (u.unpaidEarnings || 0), 0);

  return (
    <div className="p-4 space-y-6 min-h-screen">

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">Link Delete Karo?</h3>
            <p className="text-slate-300 text-sm mb-5">
              <span className="text-teal-300 font-mono">go.animebing.in/{deleteConfirm}</span> delete ho jayega.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Payment Mark Karo</h3>
            <p className="text-slate-400 text-sm mb-4">
              {paymentModal.realName} ({paymentModal.username}) —
              Pending: <span className="text-yellow-300">₹{(paymentModal.unpaidEarnings || 0).toFixed(2)}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Amount (₹) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="100"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder="UPI se bheja"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setPaymentModal(null); setPaymentAmount(''); setPaymentNote(''); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
              <button
                onClick={handlePayment}
                disabled={!!payingId}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2"
              >
                {payingId ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                ✓ Payment Mark Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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
            👆 {totalClicks} Clicks
          </div>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-full px-4 py-1.5 text-sm text-yellow-300">
            💰 ₹{totalUnpaid.toFixed(2)} Pending
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-300">
            👥 {users.length} Users
          </div>
          <button onClick={() => { fetchLinks(); fetchUsers(); }}
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white transition">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab('links')}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition ${
            activeTab === 'links'
              ? 'bg-teal-600 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          🔗 Links Manager
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition ${
            activeTab === 'users'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          👥 Users Manager
        </button>
      </div>

      {/* ===== LINKS TAB ===== */}
      {activeTab === 'links' && (
        <>
          {/* Add New Link Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-teal-400">+</span> Naya Short Link Banao
            </h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Short Code *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/30 whitespace-nowrap">go.../</span>
                  <input
                    type="text"
                    value={addForm.code}
                    onChange={e => setAddForm({ ...addForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
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
                  placeholder="https://cuty.io/abc"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Label</label>
                <input
                  type="text"
                  value={addForm.label}
                  onChange={e => setAddForm({ ...addForm, label: e.target.value })}
                  placeholder="Naruto Ep 1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Assign User</label>
                <select
                  value={addForm.userId}
                  onChange={e => setAddForm({ ...addForm, userId: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">— Kisi ko assign nahi —</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-4">
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
                  {adding ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Ban raha hai...</> : '+ Link Banao'}
                </button>
              </div>
            </form>
          </div>

          {/* Links Table */}
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
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-xs text-white/40">{filteredLinks.length} / {links.length} links</span>
            </div>

            {linksLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Short URL</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Label</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Target URL</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Clicks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Last Click</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredLinks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                          {links.length === 0 ? 'Abhi koi link nahi hai.' : 'Koi match nahi hua.'}
                        </td>
                      </tr>
                    ) : (
                      filteredLinks.map(link => (
                        <React.Fragment key={link.code}>
                          <tr className={`hover:bg-white/5 transition ${editingId === link.code ? 'bg-white/10' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-teal-300 text-xs">go.../{link.code}</span>
                                <button onClick={() => copyToClipboard(link.code)} className="text-white/40 hover:text-white transition">
                                  {copiedCode === link.code ? (
                                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="text-white/80 text-xs">{link.label || '—'}</span></td>
                            <td className="px-4 py-3 max-w-[160px]">
                              <a href={link.url || '#'} target="_blank" rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-[150px]" title={link.url || ''}>
                                {link.url ? (link.url.length > 35 ? link.url.substring(0, 35) + '...' : link.url) : 'No URL'}
                              </a>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-purple-300">{getUserName(link.userId)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                (link.clicks || 0) > 100 ? 'bg-green-500/20 text-green-300' :
                                (link.clicks || 0) > 10 ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-white/10 text-white/60'
                              }`}>{link.clicks || 0}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white/40 text-xs">
                                {link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => handleEdit(link)}
                                  className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition ${
                                    editingId === link.code
                                      ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200'
                                      : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40'
                                  }`}>
                                  {editingId === link.code ? '✕' : '✎'}
                                </button>
                                <button onClick={() => setDeleteConfirm(link.code)}
                                  className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs transition">
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Edit Row */}
                          {editingId === link.code && (
                            <tr key={`edit-${link.code}`} className="bg-white/5">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="border-l-4 border-indigo-500 pl-4 space-y-3">
                                  <h4 className="text-sm font-semibold text-white">Edit: go.animebing.in/{link.code}</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Target URL</label>
                                      <input type="url" value={editForm.url}
                                        onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Label</label>
                                      <input type="text" value={editForm.label}
                                        onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Assign User</label>
                                      <select value={editForm.userId}
                                        onChange={e => setEditForm({ ...editForm, userId: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                        <option value="">— Kisi ko assign nahi —</option>
                                        {users.map(u => (
                                          <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleUpdate(link.code)}
                                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-1.5 px-4 rounded-lg text-sm">
                                      ✓ Save
                                    </button>
                                    <button onClick={() => setEditingId(null)}
                                      className="bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 px-4 rounded-lg text-sm">
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
            )}
          </div>
        </>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <>
          {/* Add User Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-purple-400">+</span> Naya User Banao
            </h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Username *</label>
                <input type="text" value={addUserForm.username}
                  onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="harsh"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Password *</label>
                <input type="text" value={addUserForm.password}
                  onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })}
                  placeholder="harsh123"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Real Name *</label>
                <input type="text" value={addUserForm.realName}
                  onChange={e => setAddUserForm({ ...addUserForm, realName: e.target.value })}
                  placeholder="Harsh Rathore"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Rate per 1000 clicks (₹)</label>
                <input type="number" value={addUserForm.ratePerThousand}
                  onChange={e => setAddUserForm({ ...addUserForm, ratePerThousand: Number(e.target.value) })}
                  min="1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <button type="submit" disabled={addingUser}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg text-sm transition flex items-center gap-2">
                  {addingUser ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Ban raha hai...</> : '+ User Banao'}
                </button>
              </div>
            </form>
          </div>

          {/* Users Table */}
          <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <span className="text-sm text-white/60">{users.length} users total</span>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Real Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Password</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Rate/1000</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Clicks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Earned</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Pending</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-white/40">
                          Abhi koi user nahi hai. Upar se banao!
                        </td>
                      </tr>
                    ) : (
                      users.map(user => (
                        <React.Fragment key={user._id}>
                          <tr className={`hover:bg-white/5 transition ${editingUserId === user._id ? 'bg-white/10' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="text-white font-medium text-xs">{user.realName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-teal-300 text-xs">{user.username}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-yellow-300 text-xs bg-yellow-500/10 px-2 py-0.5 rounded">
                                {user.password === '***' ? '••••••' : user.password}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-green-300 text-xs">₹{user.ratePerThousand}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-purple-300 text-xs">{(user.totalClicks || 0).toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white/70 text-xs">₹{(user.totalEarnings || 0).toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold ${(user.unpaidEarnings || 0) > 0 ? 'text-yellow-300' : 'text-white/40'}`}>
                                ₹{(user.unpaidEarnings || 0).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.isActive
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                {user.isActive ? '✅ Active' : '❌ Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => handleEditUser(user)}
                                  className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition ${
                                    editingUserId === user._id
                                      ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200'
                                      : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40'
                                  }`}>
                                  {editingUserId === user._id ? '✕' : '✎'}
                                </button>
                                <button
                                  onClick={() => setPaymentModal(user)}
                                  className="px-2 py-1.5 bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 rounded-lg text-green-200 text-xs font-medium transition"
                                >
                                  💰 Pay
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Edit User Row */}
                          {editingUserId === user._id && (
                            <tr key={`edit-user-${user._id}`} className="bg-white/5">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="border-l-4 border-purple-500 pl-4 space-y-3">
                                  <h4 className="text-sm font-semibold text-white">Edit: {user.realName}</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Real Name</label>
                                      <input type="text" value={editUserForm.realName}
                                        onChange={e => setEditUserForm({ ...editUserForm, realName: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Naya Password (blank = same)</label>
                                      <input type="text" value={editUserForm.password}
                                        onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })}
                                        placeholder="Naya password ya blank"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Rate per 1000 (₹)</label>
                                      <input type="number" value={editUserForm.ratePerThousand}
                                        onChange={e => setEditUserForm({ ...editUserForm, ratePerThousand: Number(e.target.value) })}
                                        min="1"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-white/50 mb-1 block">Status</label>
                                      <select value={editUserForm.isActive ? 'true' : 'false'}
                                        onChange={e => setEditUserForm({ ...editUserForm, isActive: e.target.value === 'true' })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500">
                                        <option value="true">✅ Active</option>
                                        <option value="false">❌ Inactive</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleUpdateUser(user._id)}
                                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-1.5 px-4 rounded-lg text-sm">
                                      ✓ Save
                                    </button>
                                    <button onClick={() => setEditingUserId(null)}
                                      className="bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 px-4 rounded-lg text-sm">
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
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ShortenerManager;