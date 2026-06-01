import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface ShortUser {
  _id: string;
  username: string;
  realName: string;
  password?: string;
  ratePerThousand: number;
  isActive: boolean;
  canCreateLinks: boolean;
  totalClicks: number;
  totalEarnings: number;
  unpaidEarnings: number;
  paidEarnings: number;
  gmailLinked?: string;
  profile?: any;
  createdAt: string;
}

const ShortUsersManager: React.FC = () => {
  const [users, setUsers] = useState<ShortUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ShortUser>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    realName: '',
    ratePerThousand: 10,
    canCreateLinks: false,
  });
  const [creating, setCreating] = useState(false);

  const token = localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/short-users/admin/users`, authHeaders());
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load short users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: ShortUser) => {
    setEditingId(user._id);
    setEditForm({
      realName: user.realName,
      ratePerThousand: user.ratePerThousand,
      isActive: user.isActive,
      canCreateLinks: user.canCreateLinks,
      password: '', // optional field
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      const payload: any = {};
      if (editForm.realName !== undefined) payload.realName = editForm.realName;
      if (editForm.ratePerThousand !== undefined) payload.ratePerThousand = editForm.ratePerThousand;
      if (editForm.isActive !== undefined) payload.isActive = editForm.isActive;
      if (editForm.canCreateLinks !== undefined) payload.canCreateLinks = editForm.canCreateLinks;
      if (editForm.password && editForm.password.trim()) payload.password = editForm.password;

      await axios.put(`${API_BASE}/short-users/admin/users/${id}`, payload, authHeaders());
      toast.success('User updated successfully');
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleCreate = async () => {
    if (!newUser.username || !newUser.password || !newUser.realName) {
      toast.error('Username, password and real name are required');
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API_BASE}/short-users/admin/users`, newUser, authHeaders());
      toast.success('User created successfully');
      setShowCreateForm(false);
      setNewUser({ username: '', password: '', realName: '', ratePerThousand: 10, canCreateLinks: false });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Creation failed');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Short Users</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 rounded-lg transition"
        >
          + Create User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={newUser.username}
              onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Real Name"
              value={newUser.realName}
              onChange={e => setNewUser({ ...newUser, realName: e.target.value })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="number"
              placeholder="Rate per 1000"
              value={newUser.ratePerThousand}
              onChange={e => setNewUser({ ...newUser, ratePerThousand: parseInt(e.target.value) || 0 })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={newUser.canCreateLinks}
                onChange={e => setNewUser({ ...newUser, canCreateLinks: e.target.checked })}
              />
              Can Create Links
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreateForm(false)} className="px-3 py-1.5 text-xs bg-gray-700 rounded">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="px-3 py-1.5 text-xs bg-purple-600 rounded disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] border-b border-white/10">
            <tr>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Username</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Real Name</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Rate/1k</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Clicks</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Earned</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Active</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Create Links</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Created</th>
              <th className="text-left p-3 text-xs font-semibold text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user._id} className="hover:bg-white/5 transition">
                <td className="p-3 text-white font-mono text-xs">{user.username}</td>
                <td className="p-3 text-gray-300">
                  {editingId === user._id ? (
                    <input
                      value={editForm.realName || ''}
                      onChange={e => setEditForm({ ...editForm, realName: e.target.value })}
                      className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs w-full"
                    />
                  ) : (
                    user.realName
                  )}
                </td>
                <td className="p-3">
                  {editingId === user._id ? (
                    <input
                      type="number"
                      value={editForm.ratePerThousand || 0}
                      onChange={e => setEditForm({ ...editForm, ratePerThousand: parseInt(e.target.value) || 0 })}
                      className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs w-20"
                    />
                  ) : (
                    <span className="text-amber-400">₹{user.ratePerThousand}</span>
                  )}
                </td>
                <td className="p-3 text-gray-300">{user.totalClicks.toLocaleString()}</td>
                <td className="p-3 text-emerald-400">₹{user.totalEarnings.toFixed(2)}</td>
                <td className="p-3">
                  {editingId === user._id ? (
                    <input
                      type="checkbox"
                      checked={editForm.isActive || false}
                      onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                    />
                  ) : (
                    <span className={user.isActive ? 'text-emerald-400' : 'text-red-400'}>
                      {user.isActive ? 'Yes' : 'No'}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {editingId === user._id ? (
                    <input
                      type="checkbox"
                      checked={editForm.canCreateLinks || false}
                      onChange={e => setEditForm({ ...editForm, canCreateLinks: e.target.checked })}
                    />
                  ) : (
                    <span className={user.canCreateLinks ? 'text-emerald-400' : 'text-gray-500'}>
                      {user.canCreateLinks ? '✅' : '❌'}
                    </span>
                  )}
                </td>
                <td className="p-3 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                <td className="p-3">
                  {editingId === user._id ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(user._id)} className="text-emerald-400 text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEdit(user)} className="text-purple-400 text-xs">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShortUsersManager;