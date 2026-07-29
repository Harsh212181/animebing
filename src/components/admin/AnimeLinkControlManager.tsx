 import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface AnimeLite {
  _id: string;
  title: string;
  thumbnail?: string;
  contentType?: string;
  subAdminId?: string;
  subAdminUsername?: string;
  createdByUsername?: string; // NEW
}
interface LinkGroup {
  _id: string;
  name: string;
  animeIds: string[];
  link1: boolean;
  link2: boolean;
  link3: boolean;
  link4: boolean;
  animeDetails?: AnimeLite[];
}

const LINK_NAMES: Record<number, string> = { 1: 'Cuty.io', 2: 'Shrinkme', 3: 'Linkjust.com', 4: 'Gplinks' };

interface AnimeLinkControlManagerProps {
  token?: string;
  isMainAdmin?: boolean;
}

const AnimeLinkControlManager: React.FC<AnimeLinkControlManagerProps> = ({ token: propToken, isMainAdmin = false }) => {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [allAnime, setAllAnime] = useState<AnimeLite[]>([]);
  const [animeListLoading, setAnimeListLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<AnimeLite[]>([]);
  const [linkFlags, setLinkFlags] = useState({ link1: true, link2: true, link3: true, link4: true });
  const [saving, setSaving] = useState(false);

  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const token = propToken || localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/anime-link-control`, authHeaders());
      setGroups(data.data || []);
    } catch { toast.error('Failed to load link control groups'); }
    finally { setLoading(false); }
  };

  const fetchAllAnime = async () => {
    setAnimeListLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/admin/anime-list`, authHeaders());
      const list = Array.isArray(data) ? data : (data.data || []);
      setAllAnime(list.map((a: any) => ({
        _id: a._id,
        title: a.title,
        thumbnail: a.thumbnail,
        contentType: a.contentType,
        subAdminId: a.subAdminId || a.subAdmin?._id,
        subAdminUsername: a.subAdminUsername || a.subAdmin?.username,
        createdByUsername: a.createdByUsername // NEW: map from backend
      })));
    } catch {
      toast.error('Failed to load anime list');
    } finally {
      setAnimeListLoading(false);
    }
  };

  const openNewForm = () => {
    setShowForm(true);
    fetchAllAnime();
  };

  const displayedAnime = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return allAnime;
    return allAnime.filter(a => a.title.toLowerCase().includes(q));
  }, [filterQuery, allAnime]);

  const resetForm = () => {
    setName(''); setFilterQuery('');
    setSelectedAnime([]); setLinkFlags({ link1: true, link2: true, link3: true, link4: true });
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (g: LinkGroup) => {
    setEditingId(g._id); setName(g.name);
    setSelectedAnime(g.animeDetails || []);
    setLinkFlags({ link1: g.link1, link2: g.link2, link3: g.link3, link4: g.link4 });
    setShowForm(true);
    fetchAllAnime();
  };

  const toggleAnime = (a: AnimeLite) => {
    setSelectedAnime(prev => {
      const exists = prev.find(x => x._id === a._id);
      if (exists) return prev.filter(x => x._id !== a._id);
      return [...prev, a];
    });
  };
  const removeAnime = (id: string) => setSelectedAnime(prev => prev.filter(a => a._id !== id));

  const handleSave = async () => {
    if (selectedAnime.length === 0) { toast.error('Kam se kam ek anime select karo'); return; }
    setSaving(true);
    const payload = {
      name: name.trim() || selectedAnime.map(a => a.title).join(', ').slice(0, 60),
      animeIds: selectedAnime.map(a => a._id),
      ...linkFlags
    };
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/anime-link-control/${editingId}`, payload, authHeaders());
        toast.success('Group updated!');
      } else {
        await axios.post(`${API_BASE}/anime-link-control`, payload, authHeaders());
        toast.success('Group created!');
      }
      resetForm(); fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ye group delete karna hai? Anime global settings pe wapas chala jayega.')) return;
    try {
      await axios.delete(`${API_BASE}/anime-link-control/${id}`, authHeaders());
      toast.success('Deleted!'); fetchGroups();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const toggleGroupLink = useCallback(async (groupId: string, linkNum: number, currentValue: boolean) => {
    const key = `${groupId}_${linkNum}`;
    setToggling(prev => ({ ...prev, [key]: true }));

    setGroups(prev => prev.map(g => {
      if (g._id === groupId) {
        return { ...g, [`link${linkNum}`]: !currentValue };
      }
      return g;
    }));

    try {
      const payload = { [`link${linkNum}`]: !currentValue };
      await axios.put(`${API_BASE}/anime-link-control/${groupId}`, payload, authHeaders());
      toast.success(`Link ${linkNum} ${!currentValue ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setGroups(prev => prev.map(g => {
        if (g._id === groupId) {
          return { ...g, [`link${linkNum}`]: currentValue };
        }
        return g;
      }));
      toast.error(err.response?.data?.error || 'Toggle failed');
    } finally {
      setToggling(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  // Ownership badge for anime (Sub / Main based on subAdminId)
  const OwnershipBadge: React.FC<{ anime: AnimeLite }> = ({ anime }) => {
    if (!isMainAdmin) return null;
    if (anime.subAdminId) {
      return (
        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
          Sub: {anime.subAdminUsername || anime.subAdminId.slice(-4)}
        </span>
      );
    }
    return (
      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
        Main
      </span>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">🔗 Anime Link Control</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Customise link availability per anime/group. <span className="text-purple-400 font-medium">Link 5</span> is always global.
          </p>
        </div>
        <button
          onClick={() => showForm ? resetForm() : openNewForm()}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/20 flex items-center gap-2 self-start"
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Group
            </>
          )}
        </button>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl shadow-black/10">
          <h4 className="text-sm font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
            {editingId ? 'Edit Group' : 'Create New Group'}
          </h4>
          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Group Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Naruto Shippuden"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {/* Selected Anime Tags */}
          {selectedAnime.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-semibold">Selected Anime ({selectedAnime.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedAnime.map(a => (
                  <span key={a._id} className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                    {a.title}
                    <OwnershipBadge anime={a} />
                    <button onClick={() => removeAnime(a._id)} className="text-purple-300 hover:text-red-400 transition-colors ml-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Anime Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400">Select Anime</label>
              {animeListLoading && <span className="text-[10px] text-slate-500 animate-pulse">Loading anime list...</span>}
            </div>
            <input
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Filter anime by name..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all mb-3"
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-white/5 bg-black/30 backdrop-blur-sm divide-y divide-white/5 custom-scroll">
              {animeListLoading ? (
                <p className="text-sm text-slate-500 text-center py-10">Loading anime catalog...</p>
              ) : displayedAnime.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No anime found.</p>
              ) : (
                displayedAnime.map(a => {
                  const isSelected = !!selectedAnime.find(x => x._id === a._id);
                  return (
                    <button
                      key={a._id}
                      onClick={() => toggleAnime(a)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${isSelected ? 'bg-purple-600/20 border-l-2 border-purple-400' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                    >
                      <span className={`w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-500 border-purple-400' : 'border-slate-600'}`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {a.thumbnail ? (
                        <img src={a.thumbnail} className="w-8 h-10 object-cover rounded-lg flex-shrink-0 border border-white/10" />
                      ) : (
                        <div className="w-8 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0">N/A</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.contentType && <p className="text-[10px] text-slate-500">{a.contentType}</p>}
                          {/* NEW: show creator name (only main admin) */}
                          {isMainAdmin && a.createdByUsername && (
                            <span className="text-[10px] text-amber-400/80 font-medium">
                              • {a.createdByUsername === 'admin' ? 'Main Admin' : a.createdByUsername}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Link Toggles */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-3 block">Link Controls (1-4)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(num => {
                const key = `link${num}` as keyof typeof linkFlags;
                const active = linkFlags[key];
                return (
                  <button
                    key={num}
                    onClick={() => setLinkFlags(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 text-left group ${
                      active
                        ? 'bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border-purple-500/50 shadow-lg shadow-purple-500/10'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${active ? 'text-purple-200' : 'text-slate-500'}`}>{LINK_NAMES[num]}</span>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-purple-300 bg-purple-400' : 'border-slate-600'}`}>
                        {active && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-1 font-medium ${active ? 'text-emerald-400' : 'text-red-400'}`}>
                      {active ? 'Active' : 'Disabled'}
                    </p>
                    {active && <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 rounded-full opacity-50 blur-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : editingId ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      )}

      {/* Existing Groups List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-slate-800/60 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h4 className="text-slate-400 font-medium mb-2">No custom groups yet</h4>
            <p className="text-sm text-slate-600 max-w-xs mx-auto"></p>
          </div>
        ) : (
          groups.map(g => (
            <div key={g._id} className="bg-slate-800/30 backdrop-blur-md border border-white/10 rounded-2xl p-5 transition-all duration-300 hover:bg-slate-800/40 hover:shadow-lg hover:shadow-purple-500/5 group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="text-base font-bold text-white truncate">{g.name}</h5>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
                      {g.animeIds.length} anime
                    </span>
                    {/* NEW: "created by" badge (only main admin) */}
                    {isMainAdmin && (g as any).createdByUsername && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                        by {(g as any).createdByUsername === 'admin' ? 'Main Admin' : (g as any).createdByUsername}
                      </span>
                    )}
                  </div>
                  {/* Anime badges with ownership */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(g.animeDetails || []).map(a => (
                      <span key={a._id} className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-xs px-2.5 py-1 rounded-full">
                        {a.title}
                        <OwnershipBadge anime={a} />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Link toggle buttons */}
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map(num => {
                      const active = (g as any)[`link${num}`];
                      const isToggling = toggling[`${g._id}_${num}`];
                      return (
                        <button
                          key={num}
                          onClick={() => toggleGroupLink(g._id, num, active)}
                          disabled={isToggling}
                          className={`text-[10px] px-2 py-1 rounded-md font-semibold border cursor-pointer transition-all duration-200 ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                          } ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}
                          title={`Toggle ${LINK_NAMES[num]} (${active ? 'ON' : 'OFF'})`}
                        >
                          {isToggling ? (
                            <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>{LINK_NAMES[num].split('.')[0]} {active ? 'ON' : 'OFF'}</>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(g)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(g._id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default AnimeLinkControlManager;