// src/components/admin/ShortenerManager.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  gmailLinked?: string;
  profile?: {
    mobile?: string;
    gmail?: string;
    upiId?: string;
    upiPhone?: string;
    age?: number;
    gender?: string;
  };
  createdAt: string;
}

interface ShortRequest {
  _id: string;
  userId: string;
  username: string;
  realName: string;
  type: 'payment' | 'link';
  status: 'pending' | 'done' | 'rejected';
  amount?: number;
  profile?: any;
  message?: string;
  createdAt: string;
}

interface ShortMessage {
  _id: string;
  userId: string;
  username: string;
  realName: string;
  text: string;
  fromAdmin: boolean;
  readByAdmin: boolean;
  readByUser: boolean;
  createdAt: string;
}

const ShortenerManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'links' | 'users' | 'requests' | 'messages'>('links');

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
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', realName: '', ratePerThousand: 10 });
  const [addingUser, setAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({ password: '', realName: '', ratePerThousand: 10, isActive: true });
  const [paymentModal, setPaymentModal] = useState<ShortUser | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  // Create link for user modal
  const [createLinkModal, setCreateLinkModal] = useState<ShortUser | null>(null);
  const [createLinkForm, setCreateLinkForm] = useState({ code: '', url: '', label: '' });
  const [creatingLink, setCreatingLink] = useState(false);
  // Profile view
  const [profileModal, setProfileModal] = useState<ShortUser | null>(null);

  // ===== REQUESTS STATE =====
  const [requests, setRequests] = useState<ShortRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // ===== MESSAGES STATE =====
  const [selectedUserMsg, setSelectedUserMsg] = useState<ShortUser | null>(null);
  const [messages, setMessages] = useState<ShortMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLinks();
    fetchUsers();
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== UNREAD COUNT =====
  const fetchUnreadCount = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages-count`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUnreadCount(data.unread || 0);
    } catch {}
  };

  // ===== LINKS =====
  const fetchLinks = async () => {
    setLinksLoading(true);
    try {
      const { data } = await axios.get(`${SHORTENER_BASE}/admin/links`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setLinks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Links load failed: ' + (err.response?.data?.error || err.message));
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.code.trim() || !addForm.url.trim()) { toast.error('Code and URL are required'); return; }
    setAdding(true);
    const tid = toast.loading('Creating link...');
    try {
      await axios.post(`${SHORTENER_BASE}/admin/links`,
        { code: addForm.code.trim().toLowerCase(), url: addForm.url.trim(), label: addForm.label.trim() || addForm.code.trim(), userId: addForm.userId || null },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('✅ Link created!', { id: tid });
      setAddForm({ code: '', url: '', label: '', userId: '' });
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Create failed', { id: tid });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (code: string) => {
    const tid = toast.loading('Updating...');
    try {
      await axios.put(`${SHORTENER_BASE}/admin/links/${code}`, editForm, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('✅ Updated!', { id: tid });
      setEditingId(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed', { id: tid });
    }
  };

  const handleDelete = async (code: string) => {
    const tid = toast.loading('Deleting...');
    try {
      await axios.delete(`${SHORTENER_BASE}/admin/links/${code}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('✅ Link deleted!', { id: tid });
      setDeleteConfirm(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed', { id: tid });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    setCopiedCode(code);
    toast.success('Link copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ===== USERS =====
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/users`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Users load failed');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserForm.username.trim() || !addUserForm.password.trim() || !addUserForm.realName.trim()) {
      toast.error('All fields are required'); return;
    }
    setAddingUser(true);
    const tid = toast.loading('Creating user...');
    try {
      await axios.post(`${API_BASE}/short-users/admin/users`, addUserForm, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('✅ User created!', { id: tid });
      setAddUserForm({ username: '', password: '', realName: '', ratePerThousand: 10 });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Create failed', { id: tid });
    } finally {
      setAddingUser(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    const tid = toast.loading('Updating...');
    try {
      const updateData: any = { realName: editUserForm.realName, ratePerThousand: editUserForm.ratePerThousand, isActive: editUserForm.isActive };
      if (editUserForm.password.trim()) updateData.password = editUserForm.password.trim();
      await axios.put(`${API_BASE}/short-users/admin/users/${userId}`, updateData, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success('✅ User updated!', { id: tid });
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed', { id: tid });
    }
  };

  const handlePayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setPayingId(paymentModal._id);
    const tid = toast.loading('Processing payment...');
    try {
      await axios.post(`${API_BASE}/short-users/admin/users/${paymentModal._id}/pay`,
        { amount, note: paymentNote },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`✅ ₹${amount} payment marked!`, { id: tid });
      setPaymentModal(null); setPaymentAmount(''); setPaymentNote('');
      fetchUsers(); fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Payment failed', { id: tid });
    } finally {
      setPayingId(null);
    }
  };

  // ===== CREATE LINK FOR USER =====
  const handleCreateLinkForUser = async () => {
    if (!createLinkModal) return;
    if (!createLinkForm.code.trim() || !createLinkForm.url.trim()) { toast.error('Code and URL required'); return; }
    setCreatingLink(true);
    const tid = toast.loading('Creating link...');
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/users/${createLinkModal._id}/create-link`,
        { code: createLinkForm.code.trim().toLowerCase(), url: createLinkForm.url.trim(), label: createLinkForm.label.trim() || createLinkForm.code.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(`✅ Link created for ${createLinkModal.realName}!`, { id: tid });
      setCreateLinkModal(null); setCreateLinkForm({ code: '', url: '', label: '' });
      fetchLinks(); fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Create failed', { id: tid });
    } finally {
      setCreatingLink(false);
    }
  };

  // ===== REQUESTS =====
  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/requests`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      setPendingCount(list.filter((r: ShortRequest) => r.status === 'pending').length);
    } catch (err: any) {
      toast.error('Requests load failed');
    } finally {
      setRequestsLoading(false);
    }
  };

  const updateRequestStatus = async (reqId: string, status: string) => {
    try {
      await axios.put(`${API_BASE}/short-users/admin/requests/${reqId}`, { status }, { headers: { Authorization: `Bearer ${getToken()}` } });
      toast.success(`Request marked as ${status}`);
      fetchRequests();
    } catch (err: any) {
      toast.error('Update failed');
    }
  };

  // ===== MESSAGES =====
  const loadMessages = async (user: ShortUser) => {
    setSelectedUserMsg(user);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const { data } = await axios.get(`${API_BASE}/short-users/admin/messages/${user._id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMessages(Array.isArray(data) ? data : []);
      fetchUnreadCount();
    } catch (err: any) {
      toast.error('Messages load failed');
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendAdminMessage = async () => {
    if (!selectedUserMsg || !msgText.trim()) return;
    const text = msgText.trim();
    setMsgText('');
    try {
      await axios.post(
        `${API_BASE}/short-users/admin/messages/${selectedUserMsg._id}`,
        { text },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      loadMessages(selectedUserMsg);
    } catch (err: any) {
      toast.error('Send failed');
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '—';
    const u = users.find(u => u._id === userId);
    return u ? `${u.realName} (${u.username})` : 'Unknown';
  };

  const filteredLinks = links.filter(link =>
    (link.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (link.url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const totalUnpaid = users.reduce((sum, u) => sum + (u.unpaidEarnings || 0), 0);

  return (
    <div className="p-4 space-y-6 min-h-screen">

      {/* ===== DELETE MODAL ===== */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-3">Delete Link?</h3>
            <p className="text-slate-300 text-sm mb-5">
              <span className="text-teal-300 font-mono">go.animebing.in/{deleteConfirm}</span> will be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT MODAL ===== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-1">Mark Payment</h3>
            <p className="text-slate-400 text-sm mb-1">{paymentModal.realName} ({paymentModal.username})</p>
            <p className="text-sm mb-3">Pending: <span className="text-yellow-300 font-bold">₹{(paymentModal.unpaidEarnings || 0).toFixed(2)}</span></p>

            {/* Show UPI info */}
            {paymentModal.profile && (paymentModal.profile.upiId || paymentModal.profile.upiPhone) && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3 text-xs space-y-1">
                {paymentModal.profile.upiId && <div className="text-green-300">UPI ID: <span className="font-mono">{paymentModal.profile.upiId}</span></div>}
                {paymentModal.profile.upiPhone && <div className="text-green-300">UPI Phone: <span className="font-mono">{paymentModal.profile.upiPhone}</span></div>}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Amount (₹) *</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="100"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Note (optional)</label>
                <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Sent via UPI"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setPaymentModal(null); setPaymentAmount(''); setPaymentNote(''); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handlePayment} disabled={!!payingId}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2">
                {payingId && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                ✓ Mark Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CREATE LINK FOR USER MODAL ===== */}
      {createLinkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-1">Create Link for User</h3>
            <p className="text-slate-400 text-sm mb-4">{createLinkModal.realName} ({createLinkModal.username})</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Short Code *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/30">go.../</span>
                  <input type="text" value={createLinkForm.code}
                    onChange={e => setCreateLinkForm({ ...createLinkForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                    placeholder="ep1"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Target URL *</label>
                <input type="url" value={createLinkForm.url}
                  onChange={e => setCreateLinkForm({ ...createLinkForm, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Label</label>
                <input type="text" value={createLinkForm.label}
                  onChange={e => setCreateLinkForm({ ...createLinkForm, label: e.target.value })}
                  placeholder="Naruto Ep 1"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
              {createLinkForm.code && (
                <p className="text-xs text-teal-400">Preview: https://go.animebing.in/{createLinkForm.code}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setCreateLinkModal(null); setCreateLinkForm({ code: '', url: '', label: '' }); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreateLinkForUser} disabled={creatingLink}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2">
                {creatingLink && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                + Create & Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PROFILE VIEW MODAL ===== */}
      {profileModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Profile: {profileModal.realName}</h3>
              <button onClick={() => setProfileModal(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Username</span>
                <span className="font-mono text-teal-300">{profileModal.username}</span>
              </div>
              {profileModal.gmailLinked && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">Gmail Linked</span>
                  <span className="text-green-300 text-xs">{profileModal.gmailLinked}</span>
                </div>
              )}
              {profileModal.profile?.mobile && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">Mobile</span>
                  <span className="text-white">{profileModal.profile.mobile}</span>
                </div>
              )}
              {profileModal.profile?.gmail && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">Gmail</span>
                  <span className="text-white text-xs">{profileModal.profile.gmail}</span>
                </div>
              )}
              {profileModal.profile?.upiId && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">UPI ID</span>
                  <span className="text-yellow-300 font-mono text-xs">{profileModal.profile.upiId}</span>
                </div>
              )}
              {profileModal.profile?.upiPhone && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">UPI Phone</span>
                  <span className="text-yellow-300 font-mono">{profileModal.profile.upiPhone}</span>
                </div>
              )}
              {profileModal.profile?.age && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">Age</span>
                  <span className="text-white">{profileModal.profile.age}</span>
                </div>
              )}
              {profileModal.profile?.gender && (
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-white/50">Gender</span>
                  <span className="text-white">{profileModal.profile.gender}</span>
                </div>
              )}
              {!profileModal.profile?.upiId && !profileModal.profile?.upiPhone && (
                <p className="text-center text-yellow-400 text-xs py-2">⚠️ No UPI details filled yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/20 rounded-xl">
            <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">URL Shortener</h1>
            <p className="text-xs text-white/40">go.animebing.in</p>
          </div>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <div className="bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 text-sm text-teal-300">🔗 {links.length} Links</div>
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300">👆 {totalClicks} Clicks</div>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-full px-4 py-1.5 text-sm text-yellow-300">💰 ₹{totalUnpaid.toFixed(2)} Pending</div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-300">👥 {users.length} Users</div>
          {pendingCount > 0 && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-full px-4 py-1.5 text-sm text-red-300">🔔 {pendingCount} Pending</div>
          )}
          <button onClick={() => { fetchLinks(); fetchUsers(); fetchUnreadCount(); if (activeTab === 'requests') fetchRequests(); }}
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white transition">↻ Refresh</button>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {[
          { key: 'links', label: '🔗 Links', color: 'teal' },
          { key: 'users', label: '👥 Users', color: 'purple' },
          { key: 'requests', label: `📋 Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`, color: 'yellow' },
          { key: 'messages', label: `💬 Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`, color: 'blue' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition ${
              activeTab === tab.key
                ? tab.color === 'teal' ? 'bg-teal-600 text-white' : tab.color === 'purple' ? 'bg-purple-600 text-white' : tab.color === 'yellow' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== LINKS TAB ===== */}
      {activeTab === 'links' && (
        <>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4"><span className="text-teal-400">+</span> Create New Short Link</h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Short Code *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/30 whitespace-nowrap">go.../</span>
                  <input type="text" value={addForm.code}
                    onChange={e => setAddForm({ ...addForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                    placeholder="ep1"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Target URL *</label>
                <input type="url" value={addForm.url} onChange={e => setAddForm({ ...addForm, url: e.target.value })} placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Label</label>
                <input type="text" value={addForm.label} onChange={e => setAddForm({ ...addForm, label: e.target.value })} placeholder="Naruto Ep 1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Assign to User</label>
                <select value={addForm.userId} onChange={e => setAddForm({ ...addForm, userId: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                  <option value="">— No assignment —</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>)}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                {addForm.code && <p className="text-xs text-teal-400 mb-2">Preview: https://go.animebing.in/{addForm.code}</p>}
                <button type="submit" disabled={adding}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg text-sm flex items-center gap-2">
                  {adding ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</> : '+ Create Link'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <input type="text" placeholder="Search links..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-xs text-white/40">{filteredLinks.length} / {links.length}</span>
            </div>

            {linksLoading ? (
              <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {['Short URL', 'Label', 'Target URL', 'User', 'Clicks', 'Last Click', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredLinks.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-white/40">{links.length === 0 ? 'No links yet.' : 'No matches.'}</td></tr>
                    ) : filteredLinks.map(link => (
                      <React.Fragment key={link.code}>
                        <tr className={`hover:bg-white/5 transition ${editingId === link.code ? 'bg-white/10' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-teal-300 text-xs">go.../{link.code}</span>
                              <button onClick={() => copyToClipboard(link.code)} className="text-white/40 hover:text-white">
                                {copiedCode === link.code
                                  ? <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-white/80 text-xs">{link.label || '—'}</span></td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <a href={link.url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-[150px]" title={link.url || ''}>
                              {link.url ? (link.url.length > 35 ? link.url.substring(0, 35) + '...' : link.url) : 'No URL'}
                            </a>
                          </td>
                          <td className="px-4 py-3"><span className="text-xs text-purple-300">{getUserName(link.userId)}</span></td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(link.clicks || 0) > 100 ? 'bg-green-500/20 text-green-300' : (link.clicks || 0) > 10 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/60'}`}>{link.clicks || 0}</span>
                          </td>
                          <td className="px-4 py-3"><span className="text-white/40 text-xs">{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button onClick={() => { if (editingId === link.code) { setEditingId(null); } else { setEditingId(link.code); setEditForm({ url: link.url || '', label: link.label || '', userId: link.userId || '' }); } }}
                                className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition ${editingId === link.code ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40'}`}>
                                {editingId === link.code ? '✕' : '✎'}
                              </button>
                              <button onClick={() => setDeleteConfirm(link.code)} className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs">🗑</button>
                            </div>
                          </td>
                        </tr>
                        {editingId === link.code && (
                          <tr className="bg-white/5">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="border-l-4 border-indigo-500 pl-4 space-y-3">
                                <h4 className="text-sm font-semibold text-white">Edit: go.animebing.in/{link.code}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Target URL</label>
                                    <input type="url" value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Label</label>
                                    <input type="text" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Assign to User</label>
                                    <select value={editForm.userId} onChange={e => setEditForm({ ...editForm, userId: e.target.value })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                      <option value="">— No assignment —</option>
                                      {users.map(u => <option key={u._id} value={u._id}>{u.realName} ({u.username})</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleUpdate(link.code)} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-medium py-1.5 px-4 rounded-lg text-sm">✓ Save</button>
                                  <button onClick={() => setEditingId(null)} className="bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 px-4 rounded-lg text-sm">Cancel</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4"><span className="text-purple-400">+</span> Create New User</h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Username *</label>
                <input type="text" value={addUserForm.username}
                  onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="harsh" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Password *</label>
                <input type="text" value={addUserForm.password} onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })}
                  placeholder="harsh123" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Real Name *</label>
                <input type="text" value={addUserForm.realName} onChange={e => setAddUserForm({ ...addUserForm, realName: e.target.value })}
                  placeholder="Harsh Rathore" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Rate per 1000 clicks (₹)</label>
                <input type="number" value={addUserForm.ratePerThousand} min="1"
                  onChange={e => setAddUserForm({ ...addUserForm, ratePerThousand: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <button type="submit" disabled={addingUser}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg text-sm flex items-center gap-2">
                  {addingUser ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</> : '+ Create User'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <span className="text-sm text-white/60">{users.length} users total</span>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {['Real Name', 'Username', 'Password', 'Rate/1000', 'Clicks', 'Earned', 'Pending', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-12 text-center text-white/40">No users yet. Create one above!</td></tr>
                    ) : users.map(user => (
                      <React.Fragment key={user._id}>
                        <tr className={`hover:bg-white/5 transition ${editingUserId === user._id ? 'bg-white/10' : ''}`}>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-white font-medium text-xs">{user.realName}</span>
                              {user.gmailLinked && <div className="text-green-400 text-xs">✉️ Gmail linked</div>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="font-mono text-teal-300 text-xs">{user.username}</span></td>
                          <td className="px-4 py-3"><span className="font-mono text-yellow-300 text-xs bg-yellow-500/10 px-2 py-0.5 rounded">{user.password}</span></td>
                          <td className="px-4 py-3"><span className="text-green-300 text-xs">₹{user.ratePerThousand}</span></td>
                          <td className="px-4 py-3"><span className="text-purple-300 text-xs">{(user.totalClicks || 0).toLocaleString()}</span></td>
                          <td className="px-4 py-3"><span className="text-white/70 text-xs">₹{(user.totalEarnings || 0).toFixed(2)}</span></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${(user.unpaidEarnings || 0) > 0 ? 'text-yellow-300' : 'text-white/40'}`}>
                              ₹{(user.unpaidEarnings || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                              {user.isActive ? '✅ Active' : '❌ Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => { if (editingUserId === user._id) { setEditingUserId(null); } else { setEditingUserId(user._id); setEditUserForm({ password: user.password, realName: user.realName, ratePerThousand: user.ratePerThousand, isActive: user.isActive }); } }}
                                className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition ${editingUserId === user._id ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40'}`}>
                                {editingUserId === user._id ? '✕' : '✎'}
                              </button>
                              <button onClick={() => setPaymentModal(user)} className="px-2 py-1.5 bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 rounded-lg text-green-200 text-xs">💰 Pay</button>
                              <button onClick={() => { setCreateLinkModal(user); setCreateLinkForm({ code: '', url: '', label: '' }); }}
                                className="px-2 py-1.5 bg-teal-500/20 hover:bg-teal-500/40 border border-teal-500/30 rounded-lg text-teal-200 text-xs">🔗 Link</button>
                              <button onClick={() => setProfileModal(user)} className="px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-lg text-blue-200 text-xs">👤</button>
                              <button onClick={() => { setActiveTab('messages'); loadMessages(user); }} className="px-2 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-lg text-purple-200 text-xs">💬</button>
                            </div>
                          </td>
                        </tr>
                        {editingUserId === user._id && (
                          <tr className="bg-white/5">
                            <td colSpan={9} className="px-4 py-4">
                              <div className="border-l-4 border-purple-500 pl-4 space-y-3">
                                <h4 className="text-sm font-semibold text-white">Edit: {user.realName}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Real Name</label>
                                    <input type="text" value={editUserForm.realName} onChange={e => setEditUserForm({ ...editUserForm, realName: e.target.value })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">New Password (blank = keep)</label>
                                    <input type="text" value={editUserForm.password} onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })}
                                      placeholder="New password or blank"
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Rate/1000 (₹)</label>
                                    <input type="number" value={editUserForm.ratePerThousand} min="1"
                                      onChange={e => setEditUserForm({ ...editUserForm, ratePerThousand: Number(e.target.value) })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                                    <select value={editUserForm.isActive ? 'true' : 'false'} onChange={e => setEditUserForm({ ...editUserForm, isActive: e.target.value === 'true' })}
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500">
                                      <option value="true">✅ Active</option>
                                      <option value="false">❌ Inactive</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleUpdateUser(user._id)} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-medium py-1.5 px-4 rounded-lg text-sm">✓ Save</button>
                                  <button onClick={() => setEditingUserId(null)} className="bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 px-4 rounded-lg text-sm">Cancel</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== REQUESTS TAB ===== */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requestsLoading ? (
            <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div></div>
          ) : requests.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-white/40">No requests yet.</div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm text-white/60">{requests.length} requests · {pendingCount} pending</span>
              </div>
              <div className="divide-y divide-white/10">
                {requests.map(req => (
                  <div key={req._id} className="p-4 flex flex-wrap gap-4 items-start">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${req.type === 'payment' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {req.type === 'payment' ? '💰 Payment' : '🔗 Link'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : req.status === 'done' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                          {req.status === 'pending' ? '⏳ Pending' : req.status === 'done' ? '✅ Done' : '❌ Rejected'}
                        </span>
                      </div>
                      <p className="text-white font-medium text-sm">{req.realName} <span className="text-white/40 font-normal">({req.username})</span></p>
                      {req.type === 'payment' && req.amount && (
                        <p className="text-yellow-300 text-sm font-semibold">Amount: ₹{req.amount.toFixed(2)}</p>
                      )}
                      {req.type === 'payment' && req.profile && (
                        <div className="mt-1 text-xs text-white/50 space-x-3">
                          {req.profile.upiId && <span>UPI: <span className="text-yellow-300 font-mono">{req.profile.upiId}</span></span>}
                          {req.profile.upiPhone && <span>Phone: <span className="text-yellow-300 font-mono">{req.profile.upiPhone}</span></span>}
                        </div>
                      )}
                      {req.type === 'link' && req.message && (
                        <p className="text-white/60 text-xs mt-1">"{req.message}"</p>
                      )}
                      <p className="text-white/30 text-xs mt-1">{new Date(req.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-wrap">
                        {req.type === 'payment' && (
                          <button
                            onClick={() => {
                              const user = users.find(u => u._id === req.userId);
                              if (user) { setPaymentModal(user); setPaymentAmount(String(req.amount || '')); }
                            }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium">
                            💰 Process Payment
                          </button>
                        )}
                        {req.type === 'link' && (
                          <button
                            onClick={() => {
                              const user = users.find(u => u._id === req.userId);
                              if (user) { setCreateLinkModal(user); setCreateLinkForm({ code: '', url: '', label: '' }); }
                            }}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium">
                            🔗 Create Link
                          </button>
                        )}
                        <button onClick={() => updateRequestStatus(req._id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/60 border border-red-500/30 text-red-300 rounded-lg text-xs font-medium">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MESSAGES TAB ===== */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* User list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <span className="text-sm text-white/60">Select a user to chat</span>
            </div>
            <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
              {users.map(user => (
                <button key={user._id} onClick={() => loadMessages(user)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/10 transition ${selectedUserMsg?._id === user._id ? 'bg-white/10 border-l-2 border-purple-500' : ''}`}>
                  <div className="text-sm text-white font-medium">{user.realName}</div>
                  <div className="text-xs text-white/40">{user.username}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl flex flex-col" style={{ minHeight: '500px' }}>
            {!selectedUserMsg ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Select a user to start messaging</div>
            ) : (
              <>
                <div className="p-4 border-b border-white/10 flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedUserMsg.realName}</p>
                    <p className="text-xs text-white/40">{selectedUserMsg.username}</p>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3" style={{ maxHeight: '380px' }}>
                  {messagesLoading ? (
                    <div className="flex justify-center py-8"><div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-white/30 text-sm py-8">No messages yet. Start the conversation!</div>
                  ) : messages.map(msg => (
                    <div key={msg._id} className={`flex ${msg.fromAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.fromAdmin ? 'bg-purple-600/50 text-purple-100 rounded-br-sm' : 'bg-white/10 text-white/80 rounded-bl-sm'}`}>
                          {msg.text}
                        </div>
                        <div className={`text-xs text-white/30 mt-1 ${msg.fromAdmin ? 'text-right' : 'text-left'}`}>
                          {msg.fromAdmin ? 'You (Admin)' : selectedUserMsg.realName} · {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input
                    type="text"
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendAdminMessage(); }}
                    placeholder={`Message to ${selectedUserMsg.realName}...`}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button onClick={sendAdminMessage} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Send</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortenerManager;