 // src/components/admin/PollManager.tsx - UPDATED WITH CORRECT API ROUTE

import React, { useState, useEffect } from 'react';
import { Poll, CreatePollData, Anime } from '../../types';
import { toast } from 'react-hot-toast';
import {
  Search, X, Plus, Trash2, Eye, EyeOff, Calendar, Clock, Link,
  Edit2, Save, ChevronDown, ChevronUp, RefreshCw, AlertCircle,
  CheckCircle, Pencil, Copy, Download, BarChart3, Users, FileText,
  Smartphone, Tablet, Monitor
} from 'lucide-react';

interface PollManagerProps {
  token: string;
  apiBase: string;
}

const formatDeviceType = (type?: string): string => {
  if (!type) return 'Unknown';
  const map: Record<string, string> = {
    mobile: 'Phone',
    tablet: 'Tablet',
    desktop: 'PC',
  };
  return map[type.toLowerCase()] || type;
};

const getDeviceIcon = (type?: string) => {
  const t = type?.toLowerCase();
  if (t === 'mobile') return <Smartphone size={14} className="text-blue-400" />;
  if (t === 'tablet') return <Tablet size={14} className="text-purple-400" />;
  if (t === 'desktop') return <Monitor size={14} className="text-green-400" />;
  return <Monitor size={14} className="text-gray-400" />;
};

const PollManager: React.FC<PollManagerProps> = ({ token, apiBase }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [updatingPoll, setUpdatingPoll] = useState(false);

  const [newPoll, setNewPoll] = useState<CreatePollData>({
    question: '',
    options: [],
    expiresAt: ''
  });

  const [availableAnime, setAvailableAnime] = useState<Anime[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalAnime, setTotalAnime] = useState(0);
  const [hasMoreAnime, setHasMoreAnime] = useState(true);

  const [customOption, setCustomOption] = useState({
    title: '',
    imageUrl: ''
  });

  const [viewMode, setViewMode] = useState<'create' | 'manage'>('manage');
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [showAllAnime, setShowAllAnime] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [showVotersModal, setShowVotersModal] = useState(false);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/polls/admin/all`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(`Failed to fetch polls: ${res.status}`);
      const data = await res.json();
      let pollsData: Poll[] = [];
      if (Array.isArray(data)) {
        pollsData = data.map((poll: any) => ({
          ...poll,
          isExpired: poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()),
          votersCount: poll.votersCount || poll.voters?.length || 0
        }));
      } else {
        toast.error('Unexpected poll data format received');
      }
      setPolls(pollsData);
    } catch (err: any) {
      toast.error(`Failed to load polls: ${err.message}`);
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollDetails = async (pollId: string) => {
    try {
      const res = await fetch(`${apiBase}/polls/admin/${pollId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch poll details');
      const result = await res.json();
      if (result.success && result.poll) {
        setSelectedPoll({
          ...result.poll,
          votersCount: result.poll.votersCount || result.poll.voters?.length || 0
        });
        return result.poll;
      }
    } catch (err: any) {
      toast.error('Failed to load poll details');
    }
    return null;
  };

  const fetchAnime = async (query = '', page = 1, limit = 50) => {
    try {
      const url = query
        ? `${apiBase}/anime?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
        : `${apiBase}/anime?page=${page}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch anime');
      const data = await res.json();
      let animeList: Anime[] = [];
      let total = 0;
      if (Array.isArray(data)) {
        animeList = data; total = data.length;
      } else if (data && Array.isArray(data.data)) {
        animeList = data.data; total = data.total || data.data.length;
      } else if (data?.success && Array.isArray(data.data)) {
        animeList = data.data; total = data.total || data.data.length;
      }
      if (page === 1) setAvailableAnime(animeList);
      else setAvailableAnime(prev => [...prev, ...animeList]);
      setTotalAnime(total);
      setHasMoreAnime(animeList.length === limit);
      setCurrentPage(page);
    } catch (error) {
      toast.error('Failed to load anime');
      setAvailableAnime([]);
    }
  };

  const loadMoreAnime = () => fetchAnime(searchQuery, currentPage + 1, 50);

  useEffect(() => {
    const timer = setTimeout(() => fetchAnime(searchQuery, 1, 50), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchPolls();
    fetchAnime('', 1, 50);
  }, []);

  const addAnimeToOptions = (anime: Anime) => {
    if (selectedAnimeIds.includes(anime._id)) { toast.error('Already added'); return; }
    if (newPoll.options.length >= 10) { toast.error('Maximum 10 options'); return; }
    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, {
        animeId: anime._id,
        title: anime.title,
        image: anime.thumbnail || anime.posterImage || anime.coverImage || ''
      }]
    }));
    setSelectedAnimeIds(prev => [...prev, anime._id]);
    toast.success(`${anime.title} added`);
  };

  const startEditingTitle = (index: number, currentTitle: string) => {
    setEditingIndex(index); setEditedTitle(currentTitle);
  };

  const saveEditedTitle = (index: number) => {
    if (!editedTitle.trim()) { toast.error('Title cannot be empty'); return; }
    const updatedOptions = [...newPoll.options];
    updatedOptions[index].title = editedTitle.trim();
    setNewPoll(prev => ({ ...prev, options: updatedOptions }));
    setEditingIndex(null); setEditedTitle('');
    toast.success('Title updated');
  };

  const addCustomOption = () => {
    if (!customOption.title.trim()) { toast.error('Title is required'); return; }
    if (!customOption.imageUrl.trim()) { toast.error('Image URL is required'); return; }
    try { new URL(customOption.imageUrl); } catch { toast.error('Invalid image URL'); return; }
    if (newPoll.options.length >= 10) { toast.error('Maximum 10 options'); return; }
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, { animeId: id, title: customOption.title.trim(), image: customOption.imageUrl }]
    }));
    setCustomOption({ title: '', imageUrl: '' });
    toast.success('Custom option added');
  };

  const removeAnimeOption = (index: number) => {
    const updatedOptions = [...newPoll.options];
    const removed = updatedOptions.splice(index, 1)[0];
    setNewPoll(prev => ({ ...prev, options: updatedOptions }));
    if (removed?.animeId && !removed.animeId.startsWith('custom_')) {
      setSelectedAnimeIds(prev => prev.filter(id => id !== removed.animeId));
    }
    toast.success('Option removed');
  };

  const handleCreatePoll = async () => {
    if (!newPoll.question.trim()) { toast.error('Question required'); return; }
    if (newPoll.options.length < 4) { toast.error('Minimum 4 options'); return; }
    if (newPoll.options.length > 10) { toast.error('Maximum 10 options'); return; }
    if (!newPoll.expiresAt) { toast.error('Expiration date required'); return; }
    if (new Date(newPoll.expiresAt) <= new Date()) { toast.error('Expiry must be future'); return; }
    try {
      setCreatingPoll(true);
      const pollData = {
        question: newPoll.question.trim(),
        options: newPoll.options.map(o => ({ animeId: o.animeId, title: o.title, image: o.image })),
        expiresAt: new Date(newPoll.expiresAt).toISOString()
      };
      const res = await fetch(`${apiBase}/polls/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pollData)
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toast.success('Poll created!');
      resetForm(); setViewMode('manage'); fetchPolls();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create poll');
    } finally {
      setCreatingPoll(false);
    }
  };

  const handleEditPoll = (poll: Poll) => {
    setEditingPollId(poll._id);
    setIsEditing(true);
    const formattedExpiresAt = poll.expiresAt ? new Date(poll.expiresAt).toISOString().slice(0, 16) : '';
    setNewPoll({
      question: poll.question,
      options: poll.options?.map(opt => ({ animeId: opt.animeId || '', title: opt.title, image: opt.image || '' })) || [],
      expiresAt: formattedExpiresAt
    });
    const animeIds = poll.options?.filter(opt => opt.animeId && !opt.animeId.startsWith('custom_')).map(opt => opt.animeId!) || [];
    setSelectedAnimeIds(animeIds);
    setViewMode('create');
    toast.success('Editing poll. Make changes and click Update.');
  };

  const handleUpdatePoll = async () => {
    if (!editingPollId) return;
    if (!newPoll.question.trim()) { toast.error('Question required'); return; }
    if (newPoll.options.length < 4) { toast.error('Minimum 4 options'); return; }
    if (newPoll.options.length > 10) { toast.error('Maximum 10 options'); return; }
    if (!newPoll.expiresAt) { toast.error('Expiration date required'); return; }
    if (new Date(newPoll.expiresAt) <= new Date()) { toast.error('Expiry must be future'); return; }
    try {
      setUpdatingPoll(true);
      const pollData = {
        question: newPoll.question.trim(),
        options: newPoll.options.map(o => ({ animeId: o.animeId, title: o.title, image: o.image })),
        expiresAt: new Date(newPoll.expiresAt).toISOString()
      };
      const res = await fetch(`${apiBase}/polls/admin/${editingPollId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pollData)
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toast.success('Poll updated!');
      resetForm(); setEditingPollId(null); setIsEditing(false); setViewMode('manage'); fetchPolls();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update poll');
    } finally {
      setUpdatingPoll(false);
    }
  };

  const handleDuplicatePoll = (poll: Poll) => {
    setNewPoll({
      question: `${poll.question} (Copy)`,
      options: poll.options?.map(opt => ({ animeId: opt.animeId || '', title: opt.title, image: opt.image || '' })) || [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    });
    const animeIds = poll.options?.filter(opt => opt.animeId && !opt.animeId.startsWith('custom_')).map(opt => opt.animeId!) || [];
    setSelectedAnimeIds(animeIds);
    setIsEditing(false); setViewMode('create');
    toast.success('Poll duplicated.');
  };

  const togglePollStatus = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/polls/admin/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Poll status updated');
      fetchPolls();
    } catch { toast.error('Failed to update status'); }
  };

  const deletePoll = async (id: string) => {
    if (!confirm('Delete this poll?')) return;
    try {
      const res = await fetch(`${apiBase}/polls/admin/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Poll deleted');
      fetchPolls();
    } catch { toast.error('Failed to delete'); }
  };

  const deleteExpiredPolls = async () => {
    if (!confirm('Delete all expired polls?')) return;
    try {
      const res = await fetch(`${apiBase}/polls/admin/cleanup/expired`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      toast.success(`Deleted ${result.deletedCount || 0} expired polls`);
      fetchPolls();
    } catch { toast.error('Failed to delete expired polls'); }
  };

  const viewPollDetails = async (poll: Poll) => {
    const details = await fetchPollDetails(poll._id);
    if (details) setSelectedPoll(details);
    else setSelectedPoll(poll);
  };

  const viewVotersList = async (poll: Poll) => {
    const details = await fetchPollDetails(poll._id);
    if (details && details.voters) {
      setSelectedPoll(details);
      setShowVotersModal(true);
    } else {
      toast.error('No voters data available');
    }
  };

  const resetForm = () => {
    setNewPoll({ question: '', options: [], expiresAt: '' });
    setSelectedAnimeIds([]);
    setCustomOption({ title: '', imageUrl: '' });
    setSearchQuery('');
    setSelectedPoll(null);
    setEditingIndex(null);
    setEditedTitle('');
    setEditingPollId(null);
    setIsEditing(false);
  };

  const exportPollResults = (poll: Poll) => {
    const csvContent = [
      ['Poll ID', poll._id],
      ['Question', poll.question],
      ['Total Votes', poll.totalVotes || 0],
      ['Unique Voters', poll.votersCount || 0],
      ['Status', poll.isActive ? 'Active' : 'Inactive'],
      ['Created', poll.createdAt ? new Date(poll.createdAt).toLocaleString() : 'Unknown'],
      ['Expires', poll.expiresAt ? new Date(poll.expiresAt).toLocaleString() : 'Never'],
      [''],
      ['Option Title', 'Votes', 'Percentage']
    ];
    if (poll.options) {
      poll.options.forEach(option => {
        const percentage = poll.totalVotes ? ((option.votes || 0) / poll.totalVotes * 100).toFixed(2) : '0.00';
        csvContent.push([option.title, (option.votes || 0).toString(), `${percentage}%`]);
      });
    }
    const csvString = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll-results-${poll._id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  const exportVotersList = (poll: Poll) => {
    const votersList = poll.voters as any[];
    if (!votersList || votersList.length === 0) { toast.error('No voters to export'); return; }
    const csvContent = [
      ['Poll ID', poll._id],
      ['Question', poll.question],
      [''],
      ['#', 'Device Type', 'Voted At', 'Voted For']
    ];
    votersList.forEach((voter: any, index: number) => {
      const votedOption = poll.options?.find(opt => opt._id === voter.optionId || opt.animeId === voter.optionId);
      csvContent.push([
        (index + 1).toString(),
        formatDeviceType(voter.deviceType),
        voter.votedAt ? new Date(voter.votedAt).toLocaleString() : 'Unknown',
        votedOption ? votedOption.title : 'Unknown Option'
      ]);
    });
    const csvString = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll-voters-${poll._id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Voters exported');
  };

  const checkFormValidity = () => {
    const expiryDate = newPoll.expiresAt ? new Date(newPoll.expiresAt) : null;
    return !!(newPoll.question.trim() && newPoll.options.length >= 4 && newPoll.options.length <= 10 && expiryDate && expiryDate.getTime() > new Date().getTime());
  };

  if (loading && viewMode === 'manage') {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (viewMode === 'create') {
    const isFormValid = checkFormValidity();
    return (
      <div className="relative min-h-screen bg-gray-900">
        <div className="pb-32">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{isEditing ? 'Edit Poll' : 'Create New Poll'}</h2>
                {isEditing && <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">Editing Mode</span>}
              </div>
              <button onClick={() => { resetForm(); setViewMode('manage'); }} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition">
                <X size={18} /> Cancel
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <label className="block text-white mb-2 font-medium">Poll Question *</label>
              <input className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Which anime should we watch next week?" value={newPoll.question} onChange={e => setNewPoll({ ...newPoll, question: e.target.value })} />
              {!newPoll.question.trim() && <p className="text-red-400 text-sm mt-1">Question is required</p>}
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <label className="block text-white mb-2 font-medium flexl items-center gap-2"><Calendar size={18} /> Expiration Date *</label>
              <input type="datetime-local" className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" value={newPoll.expiresAt} onChange={e => setNewPoll({ ...newPoll, expiresAt: e.target.value })} min={new Date().toISOString().slice(0, 16)} />
              {!newPoll.expiresAt && <p className="text-red-400 text-sm mt-1">Expiration date is required</p>}
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <label className="text-white font-medium">Search Anime</label>
                <span className="text-gray-400 text-sm">{totalAnime} available</span>
              </div>
              <div className="relative mb-4">
                <input type="text" className="w-full p-3 pl-10 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Search anime..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-gray-400 hover:text-white"><X size={20} /></button>}
              </div>
              <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2 max-h-96 overflow-y-auto p-2">
                {availableAnime.map((anime) => (
                  <div key={anime._id} className={`relative group cursor-pointer rounded-lg overflow-hidden border transition-all ${selectedAnimeIds.includes(anime._id) ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-700 hover:border-purple-400'}`} onClick={() => addAnimeToOptions(anime)} title={anime.title}>
                    <div className="aspect-[2/3] relative">
                      <img src={anime.thumbnail || anime.posterImage || ''} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80x120?text=No+Image'; }} />
                      {selectedAnimeIds.includes(anime._id) && <div className="absolute top-1 right-1 bg-purple-600 text-white p-1 rounded-full"><Plus size={12} /></div>}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black to-transparent">
                      <h3 className="text-white text-xs font-semibold truncate">{anime.title}</h3>
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreAnime && <div className="mt-4 text-center"><button onClick={loadMoreAnime} className="px-4 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white text-sm">Load More ({totalAnime - availableAnime.length} more)</button></div>}
              {availableAnime.length === 0 && <div className="text-center py-8 text-gray-400">No anime found.</div>}
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="text-white mb-4 font-medium flex items-center gap-2"><Link size={18} /> Add Custom Option</h3>
              <div className="space-y-4">
                <input type="text" className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400" placeholder="Custom option title" value={customOption.title} onChange={e => setCustomOption({...customOption, title: e.target.value})} />
                <div className="flex items-center gap-4">
                  <input type="url" className="flex-1 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400" placeholder="Image URL" value={customOption.imageUrl} onChange={e => setCustomOption({...customOption, imageUrl: e.target.value})} />
                  <button onClick={addCustomOption} disabled={!customOption.title.trim() || !customOption.imageUrl.trim()} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition flex items-center gap-2"><Plus size={18} /> Add</button>
                </div>
                {customOption.imageUrl && <img src={customOption.imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-600" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96x96?text=Invalid'; }} />}
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium">Selected Options ({newPoll.options.length}/10) *</h3>
                  <span className="text-gray-400 text-sm">Minimum 4 required</span>
                </div>
                <button onClick={() => setShowAllAnime(!showAllAnime)} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
                  {showAllAnime ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showAllAnime ? 'Show Less' : 'Show All'}
                </button>
              </div>
              {newPoll.options.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No options added yet.</div>
              ) : (
                <div className={`space-y-3 ${!showAllAnime && newPoll.options.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                  {newPoll.options.map((option, index) => (
                    <div key={option.animeId} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-700 group">
                      <div className="flex-shrink-0 w-12 h-12">
                        <img src={option.image} alt={option.title} className="w-full h-full object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x48?text=No+Image'; }} />
                      </div>
                      <div className="flex-1">
                        {editingIndex === index ? (
                          <div className="flex items-center gap-2">
                            <input type="text" className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded text-white" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} autoFocus onKeyPress={(e) => e.key === 'Enter' && saveEditedTitle(index)} />
                            <button onClick={() => saveEditedTitle(index)} className="p-2 text-green-400 hover:text-green-300 rounded"><Save size={16} /></button>
                            <button onClick={() => setEditingIndex(null)} className="p-2 text-gray-400 hover:text-white rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-white font-medium cursor-pointer hover:text-purple-300" onClick={() => startEditingTitle(index, option.title)}>{option.title} <Edit2 size={12} className="inline ml-2 opacity-50" /></h4>
                              <p className="text-gray-400 text-xs">{option.animeId.startsWith('custom_') ? 'Custom' : 'Anime'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeAnimeOption(index)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              {newPoll.options.length < 4 && <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg"><p className="text-yellow-400 text-sm">⚠️ Need {4 - newPoll.options.length} more options</p></div>}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 border-t border-gray-700 shadow-lg z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <p className={`text-sm font-medium ${isFormValid ? 'text-green-400' : 'text-yellow-400'}`}>
              {isFormValid ? '✅ Ready to submit' : `⚠️ Incomplete (${newPoll.options.length}/4 options)`}
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => { resetForm(); setViewMode('manage'); }} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition">Cancel</button>
              <button onClick={() => isEditing ? handleUpdatePoll() : handleCreatePoll()} disabled={!isFormValid || creatingPoll || updatingPoll} className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold text-lg transition-all min-w-[180px] flex items-center justify-center">
                {(creatingPoll || updatingPoll) ? <span className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>{isEditing ? 'Updating...' : 'Creating...'}</span> : isEditing ? 'Update Poll' : 'Create Poll'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredPolls = showExpired
    ? polls.filter(poll => poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()))
    : polls.filter(poll => !poll.isExpired && (!poll.expiresAt || new Date(poll.expiresAt) >= new Date()));

  const activePolls = polls.filter(p => p.isActive && !p.isExpired);
  const expiredPolls = polls.filter(p => p.isExpired || (p.expiresAt && new Date(p.expiresAt) < new Date()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Poll Manager</h2>
          <p className="text-gray-400">Manage and control your polls</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={deleteExpiredPolls} disabled={expiredPolls.length === 0} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"><Trash2 size={18} /> Delete Expired ({expiredPolls.length})</button>
          <button onClick={fetchPolls} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition"><RefreshCw size={18} /> Refresh</button>
          <button onClick={() => { resetForm(); setViewMode('create'); }} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-bold transition-all"><Plus size={20} /> Create New Poll</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700"><p className="text-gray-400 text-sm">Total Polls</p><p className="text-3xl font-bold text-white">{polls.length}</p></div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700"><p className="text-gray-400 text-sm">Active Polls</p><p className="text-3xl font-bold text-green-400">{activePolls.length}</p></div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700"><p className="text-gray-400 text-sm">Expired Polls</p><p className="text-3xl font-bold text-yellow-400">{expiredPolls.length}</p></div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700"><p className="text-gray-400 text-sm">Total Voters</p><p className="text-3xl font-bold text-blue-400">{polls.reduce((total, poll) => total + (poll.votersCount || 0), 0)}</p></div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-gray-400">Show:</span>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button onClick={() => setShowExpired(false)} className={`px-4 py-2 rounded-md transition ${!showExpired ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Active ({polls.length - expiredPolls.length})</button>
          <button onClick={() => setShowExpired(true)} className={`px-4 py-2 rounded-md transition ${showExpired ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}>Expired ({expiredPolls.length})</button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {filteredPolls.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">{showExpired ? 'No expired polls' : 'No active polls'}</div>
            <button onClick={() => { resetForm(); setViewMode('create'); }} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white">Create Poll</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Question</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Options</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Votes/Voters</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Expires</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900">
                {filteredPolls.map((poll) => {
                  const isPollExpired = !!(poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()));
                  return (
                    <tr key={poll._id} className={`hover:bg-gray-900/50 transition ${isPollExpired ? 'opacity-70' : ''}`}>
                      <td className="p-4">
                        <div className="max-w-xs">
                          <p className="text-white font-medium truncate">{poll.question}</p>
                          <p className="text-gray-400 text-sm">Created: {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'Unknown'}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${poll.isActive && !isPollExpired ? 'bg-green-900/30 text-green-400' : isPollExpired ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-900 text-gray-400'}`}>
                          {isPollExpired ? <><AlertCircle size={12} /> Expired</> : poll.isActive ? <><Eye size={12} /> Active</> : <><EyeOff size={12} /> Inactive</>}
                        </span>
                      </td>
                      <td className="p-4"><span className="text-white">{poll.options?.length || 0}</span></td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{poll.totalVotes || 0} votes</span>
                          <span className="text-gray-400 text-sm flex items-center gap-1"><Users size={12} /> {poll.votersCount || 0} voters</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-gray-300"><Clock size={14} />{poll.expiresAt ? new Date(poll.expiresAt).toLocaleDateString() : 'Never'}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {!isPollExpired && <button onClick={() => togglePollStatus(poll._id)} className={`px-3 py-1 rounded text-sm font-medium ${poll.isActive ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>{poll.isActive ? 'Pause' : 'Activate'}</button>}
                          <button onClick={() => viewPollDetails(poll)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white" title="View"><Eye size={14} /></button>
                          <button onClick={() => viewVotersList(poll)} disabled={!poll.votersCount} className={`px-3 py-1 rounded text-sm ${poll.votersCount ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-600 cursor-not-allowed text-gray-400'}`} title="Voters"><Users size={14} /></button>
                          {/* ✅ FIX: !!isPollExpired — boolean force */}
                          <button onClick={() => handleEditPoll(poll)} disabled={!!isPollExpired} className={`px-3 py-1 rounded text-sm font-medium ${isPollExpired ? 'bg-gray-600 cursor-not-allowed text-gray-400' : 'bg-purple-600 hover:bg-purple-700 text-white'}`} title={isPollExpired ? "Cannot edit expired" : "Edit"}><Pencil size={14} /></button>
                          <button onClick={() => handleDuplicatePoll(poll)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-sm text-white" title="Duplicate"><Copy size={14} /></button>
                          <button onClick={() => exportPollResults(poll)} className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm text-white" title="Export"><Download size={14} /></button>
                          <button onClick={() => deletePoll(poll._id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm text-white" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Poll Details Modal */}
      {selectedPoll && !showVotersModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 size={24} /> Poll Details</h3>
              <button onClick={() => setSelectedPoll(null)} className="p-2 text-gray-400 hover:text-white rounded-lg"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Question</h4>
                <p className="text-gray-300 text-lg">{selectedPoll.question}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><h4 className="text-lg font-semibold text-white mb-2">Status</h4>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${selectedPoll.isActive && !selectedPoll.isExpired ? 'bg-green-900/30 text-green-400' : selectedPoll.isExpired ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-900 text-gray-400'}`}>
                    {selectedPoll.isExpired ? <><AlertCircle size={12} /> Expired</> : selectedPoll.isActive ? <><CheckCircle size={12} /> Active</> : <><EyeOff size={12} /> Inactive</>}
                  </span>
                </div>
                <div><h4 className="text-lg font-semibold text-white mb-2">Total Votes</h4><p className="text-2xl font-bold text-purple-400">{selectedPoll.totalVotes || 0}</p></div>
                <div><h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Users size={16} /> Voters</h4><p className="text-2xl font-bold text-teal-400">{selectedPoll.votersCount || 0}</p></div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Options & Results</h4>
                <div className="space-y-3">
                  {selectedPoll.options?.map((option, index) => {
                    const voteCount = option.votes || 0;
                    const percentage = selectedPoll.totalVotes ? Math.round((voteCount / selectedPoll.totalVotes) * 100) : 0;
                    return (
                      <div key={option.animeId || index} className="bg-gray-900 rounded-lg p-4">
                        <div className="flex items-center gap-4 mb-3">
                          <img src={option.image} alt={option.title} className="w-12 h-12 object-cover rounded flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x48?text=No'; }} />
                          <div className="flex-1"><h5 className="text-white font-medium">{option.title}</h5></div>
                          <div className="text-right"><p className="text-white font-bold text-xl">{voteCount}</p><p className="text-gray-400">{percentage}%</p></div>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${percentage}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-700 flex items-center justify-between">
                <button onClick={() => exportPollResults(selectedPoll)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-medium"><Download size={16} /> Export Results</button>
                <button onClick={() => setSelectedPoll(null)} className="px-6 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voters Modal */}
      {selectedPoll && showVotersModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Users size={24} /> Voters List</h3>
                <p className="text-gray-400 text-sm mt-1">{selectedPoll.question}</p>
              </div>
              <button onClick={() => { setShowVotersModal(false); setSelectedPoll(null); }} className="p-2 text-gray-400 hover:text-white rounded-lg"><X size={24} /></button>
            </div>
            <div className="p-6">
              {/* ✅ FIX: (selectedPoll.voters as any[]) */}
              {(selectedPoll.voters as any[]) && (selectedPoll.voters as any[]).length > 0 && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {['mobile', 'tablet', 'desktop'].map(type => {
                    const count = (selectedPoll.voters as any[]).filter((v: any) => (v.deviceType || '').toLowerCase() === type).length;
                    const percentage = (selectedPoll.voters as any[]).length ? ((count / (selectedPoll.voters as any[]).length) * 100).toFixed(1) : '0';
                    return (
                      <div key={type} className="bg-gray-900 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">{getDeviceIcon(type)}<span>{formatDeviceType(type)}</span></div>
                        <p className="text-2xl font-bold text-white">{count}</p>
                        <p className="text-sm text-gray-400">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-4 rounded-lg"><p className="text-gray-400 text-sm">Total Voters</p><p className="text-2xl font-bold text-white">{selectedPoll.votersCount || 0}</p></div>
                <div className="bg-gray-900 p-4 rounded-lg"><p className="text-gray-400 text-sm">Total Votes</p><p className="text-2xl font-bold text-purple-400">{selectedPoll.totalVotes || 0}</p></div>
              </div>
              {/* ✅ FIX: (selectedPoll.voters as any[]) */}
              {(selectedPoll.voters as any[]) && (selectedPoll.voters as any[]).length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-4 p-3 bg-gray-900 rounded-lg font-medium text-gray-300 text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Device</div>
                    <div className="col-span-4">Voted At</div>
                    <div className="col-span-4">Voted For</div>
                  </div>
                  {(selectedPoll.voters as any[]).map((voter: any, index: number) => {
                    const votedOption = selectedPoll.options?.find(opt => opt._id === voter.optionId || opt.animeId === voter.optionId);
                    return (
                      <div key={index} className="grid grid-cols-12 gap-4 p-3 bg-gray-900/50 hover:bg-gray-900 rounded-lg items-center">
                        <div className="col-span-1 text-gray-400">{index + 1}</div>
                        <div className="col-span-3 flex items-center gap-2 text-gray-300">{getDeviceIcon(voter.deviceType)}<span className="truncate">{formatDeviceType(voter.deviceType)}</span></div>
                        <div className="col-span-4 text-gray-400 text-sm">{voter.votedAt ? new Date(voter.votedAt).toLocaleString() : 'Unknown'}</div>
                        <div className="col-span-4 text-gray-300 truncate">{votedOption ? votedOption.title : 'Unknown'}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">No voters data available</div>
              )}
              <div className="pt-6 border-t border-gray-700 flex items-center justify-between">
                <button onClick={() => exportVotersList(selectedPoll)} disabled={!(selectedPoll.voters as any[]) || (selectedPoll.voters as any[]).length === 0} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium"><FileText size={16} /> Export Voters</button>
                <button onClick={() => { setShowVotersModal(false); setSelectedPoll(null); }} className="px-6 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollManager;