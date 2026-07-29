import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface TrackedTitle {
  id: string;
  keyword: string;
  lastKnownPart: number;
}
interface TrackedChannel {
  _id: string;
  channelId: string;
  channelName: string;
  channelHandle: string;
  titles: TrackedTitle[];
}
interface Capacity {
  channelsUsed: number;
  channelsLimit: number;
  unitsUsedPerCheck: number;
  unitsLimit: number;
}

const TrackListManager: React.FC = () => {
  const [channels, setChannels] = useState<TrackedChannel[]>([]);
  const [capacity, setCapacity] = useState<Capacity>({ channelsUsed: 0, channelsLimit: 5000, unitsUsedPerCheck: 0, unitsLimit: 10000 });
  const [loading, setLoading] = useState(true);
  const [newHandle, setNewHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [titleInputs, setTitleInputs] = useState<Record<string, string>>({});
  const [checkingNow, setCheckingNow] = useState<Record<string, boolean>>({});

  const token = localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const loadData = async () => {
    try {
      const [channelsRes, capacityRes] = await Promise.all([
        axios.get(`${API_BASE}/track/channels`, authHeaders()),
        axios.get(`${API_BASE}/track/capacity`, authHeaders()),
      ]);
      setChannels(channelsRes.data || []);
      setCapacity(capacityRes.data);
    } catch (err: any) {
      toast.error('Track list load nahi ho saka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const addChannel = async () => {
    if (!newHandle.trim()) return;
    setAdding(true);
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/add`, { handle: newHandle.trim() }, authHeaders());
      if (data.success) {
        toast.success(`"${data.channelName}" add ho gaya!`);
        setNewHandle('');
        loadData();
      } else {
        toast.error(data.error || 'Add nahi ho saka');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Add nahi ho saka');
    } finally {
      setAdding(false);
    }
  };

  const removeChannel = async (channelId: string) => {
    if (!confirm('Poora channel remove karna hai?')) return;
    try {
      await axios.delete(`${API_BASE}/track/channel/${channelId}`, authHeaders());
      toast.success('Channel remove ho gaya');
      loadData();
    } catch {
      toast.error('Remove nahi ho saka');
    }
  };

  const addTitle = async (channelId: string) => {
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword) return;
    try {
      await axios.post(`${API_BASE}/track/channel/${channelId}/title/add`,
        { keyword, currentKnownPart: 0 }, authHeaders());
      toast.success(`"${keyword}" add ho gaya`);
      setTitleInputs({ ...titleInputs, [channelId]: '' });
      loadData();
    } catch {
      toast.error('Title add nahi ho saka');
    }
  };

  const removeTitle = async (channelId: string, titleId: string) => {
    try {
      await axios.delete(`${API_BASE}/track/channel/${channelId}/title/${titleId}`, authHeaders());
      toast.success('Title remove ho gaya');
      loadData();
    } catch {
      toast.error('Remove nahi ho saka');
    }
  };

  const checkNow = async (channelId: string) => {
    setCheckingNow(prev => ({ ...prev, [channelId]: true }));
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/check-now`, {}, authHeaders());
      toast.success(data.updatesFound > 0 ? `${data.updatesFound} naya update mila!` : 'Koi naya update nahi mila');
      loadData();
    } catch {
      toast.error('Check fail ho gaya');
    } finally {
      setCheckingNow(prev => ({ ...prev, [channelId]: false }));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const channelPercent = Math.min(100, (capacity.channelsUsed / capacity.channelsLimit) * 100);
  const unitsPercent = Math.min(100, (capacity.unitsUsedPerCheck / capacity.unitsLimit) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white">📺 YouTube Track List</h3>
        <p className="text-sm text-slate-400 mt-1">Channels aur series select karo — naya episode/part upload hote hi notification milegi.</p>
      </div>

      {/* Capacity Meter */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Channels Tracked</span>
            <span className="text-purple-300 font-semibold">{capacity.channelsUsed} / {capacity.channelsLimit}</span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all" style={{ width: `${channelPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">YouTube API Units (per check cycle)</span>
            <span className="text-sky-300 font-semibold">{capacity.unitsUsedPerCheck} / {capacity.unitsLimit}</span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all" style={{ width: `${unitsPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Add Channel */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
        <label className="block text-xs font-semibold text-slate-400 mb-2">Naya Channel Add Karo</label>
        <div className="flex gap-2">
          <input
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            placeholder="@channelhandle likho"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <button
            onClick={addChannel}
            disabled={adding}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
          >
            {adding ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '+ Add'}
          </button>
        </div>
      </div>

      {/* Channel List */}
      <div className="space-y-4">
        {channels.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-slate-800/60 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-slate-400 font-medium">Koi channel track nahi ho raha abhi</h4>
          </div>
        ) : (
          channels.map(ch => (
            <div key={ch._id} className="bg-slate-800/30 backdrop-blur-md border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h5 className="text-base font-bold text-white">{ch.channelName}</h5>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
                    {ch.titles.length} titles
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkNow(ch._id)}
                    disabled={checkingNow[ch._id]}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition disabled:opacity-50"
                  >
                    {checkingNow[ch._id] ? 'Checking...' : '⚡ Check Now'}
                  </button>
                  <button
                    onClick={() => removeChannel(ch._id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {ch.titles.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs px-3 py-1.5 rounded-full">
                    {t.keyword} · last part: {t.lastKnownPart}
                    <button onClick={() => removeTitle(ch._id, t.id)} className="text-purple-300 hover:text-red-400 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={titleInputs[ch._id] || ''}
                  onChange={e => setTitleInputs({ ...titleInputs, [ch._id]: e.target.value })}
                  placeholder="Naya series naam (jaise 'Naruto')"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button
                  onClick={() => addTitle(ch._id)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 rounded-lg transition"
                >
                  + Title
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrackListManager;