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

// Helper to format device type
const formatDeviceType = (type?: string): string => {
  if (!type) return 'Unknown';
  const map: Record<string, string> = {
    mobile: 'Phone',
    tablet: 'Tablet',
    desktop: 'PC',
  };
  return map[type.toLowerCase()] || type;
};

// Helper to get device icon
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

  // For pagination
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

  /* =========================
     FETCH POLLS WITH EXPIRED STATUS
  ========================= */

  const fetchPolls = async () => {
    try {
      setLoading(true);
      console.log(`📡 Fetching polls from: ${apiBase}/polls/admin/all`);
      
      const res = await fetch(`${apiBase}/polls/admin/all`, {
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });

      console.log('📊 Polls API response status:', res.status);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch polls: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('📊 Polls API response data:', data);
      
      let pollsData: Poll[] = [];
      
      if (Array.isArray(data)) {
        pollsData = data.map((poll: any) => ({
          ...poll,
          isExpired: poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()),
          votersCount: poll.votersCount || poll.voters?.length || 0
        }));
        console.log(`✅ Loaded ${data.length} polls (array format)`);
      } else {
        console.warn('⚠️ Unexpected poll data format:', data);
        toast.error('Unexpected poll data format received');
      }
      
      setPolls(pollsData);
      
      if (pollsData.length === 0) {
        console.log('📭 No polls found');
      }
      
    } catch (err: any) {
      console.error('❌ Fetch polls error:', err);
      toast.error(`Failed to load polls: ${err.message}`);
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     FETCH POLL DETAILS WITH VOTERS
  ========================= */

  const fetchPollDetails = async (pollId: string) => {
    try {
      console.log(`📡 Fetching poll details: ${apiBase}/polls/admin/${pollId}`);
      
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
      console.error('❌ Fetch poll details error:', err);
      toast.error('Failed to load poll details');
    }
    return null;
  };

  /* =========================
     FETCH ANIME WITH PAGINATION & SEARCH
  ========================= */

  const fetchAnime = async (query = '', page = 1, limit = 50) => {
    try {
      const url = query 
        ? `${apiBase}/anime?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
        : `${apiBase}/anime?page=${page}&limit=${limit}`;
      
      console.log(`🔍 Fetching anime from: ${url}`);
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch anime');
      
      const data = await res.json();
      console.log('📺 Anime API response:', data);
      
      let animeList: Anime[] = [];
      let total = 0;
      
      if (Array.isArray(data)) {
        animeList = data;
        total = data.length;
      } else if (data && Array.isArray(data.data)) {
        animeList = data.data;
        total = data.total || data.count || data.data.length;
      } else if (data && Array.isArray(data.anime)) {
        animeList = data.anime;
        total = data.total || data.count || data.anime.length;
      } else if (data?.success && Array.isArray(data.data)) {
        animeList = data.data;
        total = data.total || data.data.length;
      } else {
        console.error('Invalid anime data format:', data);
      }
      
      if (page === 1) {
        setAvailableAnime(animeList);
      } else {
        setAvailableAnime(prev => [...prev, ...animeList]);
      }
      
      setTotalAnime(total);
      setHasMoreAnime(animeList.length === limit);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Fetch anime error:', error);
      toast.error('Failed to load anime');
      setAvailableAnime([]);
    }
  };

  /* =========================
     LOAD MORE ANIME
  ========================= */

  const loadMoreAnime = () => {
    fetchAnime(searchQuery, currentPage + 1, 50);
  };

  /* =========================
     SEARCH ANIME WITH DEBOUNCE
  ========================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnime(searchQuery, 1, 50);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    fetchPolls();
    fetchAnime('', 1, 50);
  }, []);

  /* =========================
     ADD EXISTING ANIME
  ========================= */

  const addAnimeToOptions = (anime: Anime) => {
    if (selectedAnimeIds.includes(anime._id)) {
      toast.error('This anime is already added');
      return;
    }

    if (newPoll.options.length >= 10) {
      toast.error('Maximum 10 options allowed');
      return;
    }

    setNewPoll(prev => ({
      ...prev,
      options: [
        ...prev.options,
        {
          animeId: anime._id,
          title: anime.title,
          image: anime.thumbnail || anime.posterImage || anime.coverImage || ''
        }
      ]
    }));

    setSelectedAnimeIds(prev => [...prev, anime._id]);
    toast.success(`${anime.title} added to poll`);
  };

  /* =========================
     EDIT OPTION TITLE
  ========================= */

  const startEditingTitle = (index: number, currentTitle: string) => {
    setEditingIndex(index);
    setEditedTitle(currentTitle);
  };

  const saveEditedTitle = (index: number) => {
    if (!editedTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    const updatedOptions = [...newPoll.options];
    updatedOptions[index].title = editedTitle.trim();
    setNewPoll(prev => ({ ...prev, options: updatedOptions }));
    setEditingIndex(null);
    setEditedTitle('');
    toast.success('Title updated');
  };

  /* =========================
     ADD CUSTOM OPTION (DIRECT URL)
  ========================= */

  const addCustomOption = () => {
    if (!customOption.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!customOption.imageUrl.trim()) {
      toast.error('Image URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(customOption.imageUrl);
    } catch {
      toast.error('Please enter a valid image URL');
      return;
    }

    if (newPoll.options.length >= 10) {
      toast.error('Maximum 10 options allowed');
      return;
    }

    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setNewPoll(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { 
          animeId: id, 
          title: customOption.title.trim(), 
          image: customOption.imageUrl 
        }
      ]
    }));

    // Reset form
    setCustomOption({ title: '', imageUrl: '' });
    toast.success('Custom option added');
  };

  /* =========================
     REMOVE OPTION
  ========================= */

  const removeAnimeOption = (index: number) => {
    const updatedOptions = [...newPoll.options];
    const removedOption = updatedOptions.splice(index, 1)[0];

    setNewPoll(prev => ({ ...prev, options: updatedOptions }));

    if (removedOption?.animeId && !removedOption.animeId.startsWith('custom_')) {
      setSelectedAnimeIds(prev => prev.filter(id => id !== removedOption.animeId));
    }

    toast.success('Option removed');
  };

  /* =========================
     CREATE POLL
  ========================= */

  const handleCreatePoll = async () => {
    console.log('🟢 Create Poll button clicked!');
    
    // Validation
    const validationErrors = [];
    
    if (!newPoll.question.trim()) {
      validationErrors.push('Poll question is required');
      toast.error('Poll question is required');
    }

    if (newPoll.options.length < 4) {
      validationErrors.push('Minimum 4 options required');
      toast.error('Minimum 4 options required');
    }

    if (newPoll.options.length > 10) {
      validationErrors.push('Maximum 10 options allowed');
      toast.error('Maximum 10 options allowed');
    }

    if (!newPoll.expiresAt) {
      validationErrors.push('Expiration date is required');
      toast.error('Expiration date is required');
    } else {
      const expiryDate = new Date(newPoll.expiresAt);
      const now = new Date();
      
      if (expiryDate <= now) {
        validationErrors.push('Expiration date must be in the future');
        toast.error('Expiration date must be in the future');
      }
    }

    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      return;
    }

    try {
      setCreatingPoll(true);

      // Clean data
      const pollData = {
        question: newPoll.question.trim(),
        options: newPoll.options.map(option => ({
          animeId: option.animeId,
          title: option.title,
          image: option.image
        })),
        expiresAt: new Date(newPoll.expiresAt).toISOString()
      };

      console.log('📤 Creating poll with data:', pollData);

      const res = await fetch(`${apiBase}/polls/admin/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(pollData)
      });

      console.log('📥 Server response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Server response error:', errorText);
        throw new Error(`Failed to create poll: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('✅ Poll created successfully:', result);
      
      toast.success('Poll created successfully!');
      
      // Reset form
      resetForm();
      setViewMode('manage');
      
      // Refresh polls list
      fetchPolls();
    } catch (error: any) {
      console.error('❌ Create poll error:', error);
      toast.error(error.message || 'Failed to create poll');
    } finally {
      setCreatingPoll(false);
    }
  };

  /* =========================
     EDIT POLL
  ========================= */

  const handleEditPoll = (poll: Poll) => {
    console.log('🪶 Editing poll:', poll._id);
    setEditingPollId(poll._id);
    setIsEditing(true);
    
    // Format expiresAt for datetime-local input
    const formattedExpiresAt = poll.expiresAt 
      ? new Date(poll.expiresAt).toISOString().slice(0, 16)
      : '';
    
    setNewPoll({
      question: poll.question,
      options: poll.options?.map(opt => ({
        animeId: opt.animeId,
        title: opt.title,
        image: opt.image || ''
      })) || [],
      expiresAt: formattedExpiresAt
    });

    // Extract selected anime IDs
    const animeIds = poll.options
      ?.filter(opt => opt.animeId && !opt.animeId.startsWith('custom_'))
      .map(opt => opt.animeId) || [];
    setSelectedAnimeIds(animeIds);

    setViewMode('create');
    toast.success('Editing poll. Make your changes and click Update Poll.');
  };

  /* =========================
     UPDATE POLL
  ========================= */

  const handleUpdatePoll = async () => {
    if (!editingPollId) return;

    console.log('🟡 Update Poll button clicked for:', editingPollId);
    
    // Validation
    const validationErrors = [];
    
    if (!newPoll.question.trim()) {
      validationErrors.push('Poll question is required');
      toast.error('Poll question is required');
    }

    if (newPoll.options.length < 4) {
      validationErrors.push('Minimum 4 options required');
      toast.error('Minimum 4 options required');
    }

    if (newPoll.options.length > 10) {
      validationErrors.push('Maximum 10 options allowed');
      toast.error('Maximum 10 options allowed');
    }

    if (!newPoll.expiresAt) {
      validationErrors.push('Expiration date is required');
      toast.error('Expiration date is required');
    } else {
      const expiryDate = new Date(newPoll.expiresAt);
      const now = new Date();
      
      if (expiryDate <= now) {
        validationErrors.push('Expiration date must be in the future');
        toast.error('Expiration date must be in the future');
      }
    }

    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      return;
    }

    try {
      setUpdatingPoll(true);

      const pollData = {
        question: newPoll.question.trim(),
        options: newPoll.options.map(option => ({
          animeId: option.animeId,
          title: option.title,
          image: option.image
        })),
        expiresAt: new Date(newPoll.expiresAt).toISOString()
      };

      console.log('📤 Updating poll with data:', pollData);

      const res = await fetch(`${apiBase}/polls/admin/${editingPollId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(pollData)
      });

      console.log('📥 Server response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Server response error:', errorText);
        throw new Error(`Failed to update poll: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('✅ Poll updated successfully:', result);
      
      toast.success('Poll updated successfully!');
      
      // Reset form
      resetForm();
      setEditingPollId(null);
      setIsEditing(false);
      setViewMode('manage');
      
      // Refresh polls list
      fetchPolls();
    } catch (error: any) {
      console.error('❌ Update poll error:', error);
      toast.error(error.message || 'Failed to update poll');
    } finally {
      setUpdatingPoll(false);
    }
  };

  /* =========================
     DUPLICATE POLL
  ========================= */

  const handleDuplicatePoll = (poll: Poll) => {
    setNewPoll({
      question: `${poll.question} (Copy)`,
      options: poll.options?.map(opt => ({
        animeId: opt.animeId,
        title: opt.title,
        image: opt.image || ''
      })) || [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16) // 7 days from now
    });

    // Extract selected anime IDs
    const animeIds = poll.options
      ?.filter(opt => opt.animeId && !opt.animeId.startsWith('custom_'))
      .map(opt => opt.animeId) || [];
    setSelectedAnimeIds(animeIds);

    setIsEditing(false);
    setViewMode('create');
    toast.success('Poll duplicated. Edit and create a new poll.');
  };

  /* =========================
     POLL MANAGEMENT ACTIONS
  ========================= */

  const togglePollStatus = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/polls/admin/${id}/toggle`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });

      if (!res.ok) throw new Error('Failed to toggle poll status');
      
      toast.success('Poll status updated');
      fetchPolls();
    } catch (error) {
      toast.error('Failed to update poll status');
    }
  };

  const deletePoll = async (id: string) => {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`${apiBase}/polls/admin/${id}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });

      if (!res.ok) throw new Error('Failed to delete poll');
      
      toast.success('Poll deleted successfully');
      fetchPolls();
    } catch (error) {
      toast.error('Failed to delete poll');
    }
  };

  const deleteExpiredPolls = async () => {
    if (!confirm('Are you sure you want to delete all expired polls? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`${apiBase}/polls/admin/cleanup/expired`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });

      if (!res.ok) throw new Error('Failed to delete expired polls');
      
      const result = await res.json();
      toast.success(`Deleted ${result.deletedCount || 0} expired polls`);
      fetchPolls();
    } catch (error) {
      toast.error('Failed to delete expired polls');
    }
  };

  const viewPollDetails = async (poll: Poll) => {
    const pollDetails = await fetchPollDetails(poll._id);
    if (pollDetails) {
      setSelectedPoll(pollDetails);
    } else {
      setSelectedPoll(poll);
    }
  };

  /* =========================
     VIEW VOTERS LIST
  ========================= */

  const viewVotersList = async (poll: Poll) => {
    try {
      const pollDetails = await fetchPollDetails(poll._id);
      if (pollDetails && pollDetails.voters) {
        setSelectedPoll(pollDetails);
        setShowVotersModal(true);
      } else {
        toast.error('No voters data available');
      }
    } catch (error) {
      toast.error('Failed to load voters list');
    }
  };

  /* =========================
     RESET FORM
  ========================= */

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

  /* =========================
     EXPORT POLL RESULTS - FIXED VERSION
  ========================= */

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
        const percentage = poll.totalVotes 
          ? ((option.votes || 0) / poll.totalVotes * 100).toFixed(2)
          : '0.00';
        csvContent.push([
          option.title, 
          (option.votes || 0).toString(), 
          `${percentage}%`
        ]);
      });
    }

    const csvString = csvContent.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll-results-${poll._id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Poll results exported successfully');
  };

  /* =========================
     EXPORT VOTERS LIST (WITH DEVICE TYPE)
  ========================= */

  const exportVotersList = (poll: Poll) => {
    if (!poll.voters || poll.voters.length === 0) {
      toast.error('No voters to export');
      return;
    }

    const csvContent = [
      ['Poll ID', poll._id],
      ['Question', poll.question],
      [''],
      ['#', 'Device Type', 'Voted At', 'Voted For']
    ];

    poll.voters.forEach((voter: any, index: number) => {
      const votedOption = poll.options?.find(opt => 
        opt._id === voter.optionId || opt.animeId === voter.optionId
      );
      csvContent.push([
        (index + 1).toString(),
        formatDeviceType(voter.deviceType),
        voter.votedAt ? new Date(voter.votedAt).toLocaleString() : 'Unknown',
        votedOption ? votedOption.title : 'Unknown Option'
      ]);
    });

    const csvString = csvContent.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll-voters-${poll._id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Voters list exported successfully');
  };

  /* =========================
     CHECK FORM VALIDITY
  ========================= */

  const checkFormValidity = () => {
    const now = new Date();
    const expiryDate = newPoll.expiresAt ? new Date(newPoll.expiresAt) : null;
    
    const isValid = 
      newPoll.question.trim() && 
      newPoll.options.length >= 4 && 
      newPoll.options.length <= 10 &&
      expiryDate !== null &&
      expiryDate.getTime() > now.getTime();
    
    return isValid;
  };

  /* =========================
     RENDER LOADING
  ========================= */

  if (loading && viewMode === 'manage') {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  /* =========================
     CREATE/EDIT POLL VIEW
  ========================= */

  if (viewMode === 'create') {
    const isFormValid = checkFormValidity();

    return (
      <div className="relative min-h-screen bg-gray-900">
        {/* Main Content */}
        <div className="pb-32">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">
                  {isEditing ? 'Edit Poll' : 'Create New Poll'}
                </h2>
                {isEditing && (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                    Editing Mode
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setViewMode('manage');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
              >
                <X size={18} />
                Cancel
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Poll Question */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <label className="block text-white mb-2 font-medium">Poll Question *</label>
              <input
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Which anime should we watch next week?"
                value={newPoll.question}
                onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
              />
              {!newPoll.question.trim() && (
                <p className="text-red-400 text-sm mt-1">Poll question is required</p>
              )}
            </div>

            {/* Expiration Date */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <label className="block text-white mb-2 font-medium flexl items-center gap-2">
                <Calendar size={18} />
                Expiration Date & Time *
              </label>
              <input
                type="datetime-local"
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={newPoll.expiresAt}
                onChange={e => setNewPoll({ ...newPoll, expiresAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-gray-400 text-sm mt-2">Poll will automatically close at this time</p>
              {newPoll.expiresAt && new Date(newPoll.expiresAt) <= new Date() && (
                <p className="text-yellow-400 text-sm mt-1">⚠️ Expiration date must be in the future</p>
              )}
              {!newPoll.expiresAt && (
                <p className="text-red-400 text-sm mt-1">Expiration date is required</p>
              )}
            </div>

            {/* Search Anime */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-white font-medium flexl items-center gap-2">
                  <Search size={18} />
                  Search Anime to Add
                </label>
                <div className="text-gray-400 text-sm">
                  {totalAnime} anime available
                </div>
              </div>
              
              <div className="relative mb-4">
                <input
                  type="text"
                  className="w-full p-3 pl-10 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Type to search anime by title..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Anime Results */}
              <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2 max-h-96 overflow-y-auto p-2">
                {availableAnime.map((anime) => (
                  <div
                    key={anime._id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border transition-all ${
                      selectedAnimeIds.includes(anime._id)
                        ? 'border-purple-500 ring-1 ring-purple-500'
                        : 'border-gray-700 hover:border-purple-400'
                    }`}
                    onClick={() => addAnimeToOptions(anime)}
                    title={anime.title}
                  >
                    <div className="aspect-[2/3] relative">
                      <img
                        src={anime.thumbnail || anime.posterImage || ''}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80x120?text=No+Image';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      {selectedAnimeIds.includes(anime._id) && (
                        <div className="absolute top-1 right-1 bg-purple-600 text-white p-1 rounded-full">
                          <Plus size={12} />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black to-transparent">
                      <h3 className="text-white text-xs font-semibold truncate">{anime.title}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasMoreAnime && (
                <div className="mt-4 text-center">
                  <button
                    onClick={loadMoreAnime}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    Load More Anime ({totalAnime - availableAnime.length} more)
                  </button>
                </div>
              )}

              {availableAnime.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>No anime found. Try a different search term.</p>
                </div>
              )}
            </div>

            {/* Custom Option */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="text-white mb-4 font-medium flex items-center gap-2">
                <Link size={18} />
                Add Custom Option (Direct Image URL)
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  placeholder="Custom option title (e.g., 'Movie Night', 'New Anime')"
                  value={customOption.title}
                  onChange={e => setCustomOption({...customOption, title: e.target.value})}
                />
                
                <div className="flex items-center gap-4">
                  <input
                    type="url"
                    className="flex-1 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                    placeholder="Image URL (e.g., https://example.com/image.jpg)"
                    value={customOption.imageUrl}
                    onChange={e => setCustomOption({...customOption, imageUrl: e.target.value})}
                  />
                  
                  <button
                    onClick={addCustomOption}
                    disabled={!customOption.title.trim() || !customOption.imageUrl.trim()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
                
                <p className="text-gray-400 text-sm">
                  Tip: Use direct image URLs from Cloudinary, ImgBB, or any image hosting service
                </p>
                
                {customOption.imageUrl && (
                  <div className="mt-4">
                    <p className="text-white mb-2">Image Preview:</p>
                    <img
                      src={customOption.imageUrl}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg border border-gray-600"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96x96?text=Invalid+URL';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Selected Options */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium">Selected Options ({newPoll.options.length}/10) *</h3>
                  <span className="text-gray-400 text-sm">Minimum 4 options required • Click title to edit</span>
                </div>
                <button
                  onClick={() => setShowAllAnime(!showAllAnime)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white text-sm"
                >
                  {showAllAnime ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showAllAnime ? 'Show Less' : 'Show All'}
                </button>
              </div>
              
              {newPoll.options.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No options added yet. Search anime or add custom options above.</p>
                </div>
              ) : (
                <div className={`space-y-3 ${!showAllAnime && newPoll.options.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                  {newPoll.options.map((option, index) => (
                    <div
                      key={option.animeId}
                      className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-700 group"
                    >
                      <div className="flex-shrink-0 w-12 h-12">
                        <img
                          src={option.image}
                          alt={option.title}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x48?text=No+Image';
                          }}
                        />
                      </div>
                      
                      <div className="flex-1">
                        {editingIndex === index ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded text-white"
                              value={editedTitle}
                              onChange={(e) => setEditedTitle(e.target.value)}
                              autoFocus
                              onKeyPress={(e) => e.key === 'Enter' && saveEditedTitle(index)}
                            />
                            <button
                              onClick={() => saveEditedTitle(index)}
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 
                                className="text-white font-medium cursor-pointer hover:text-purple-300 transition-colors"
                                onClick={() => startEditingTitle(index, option.title)}
                                title="Click to edit title"
                              >
                                {option.title}
                                <Edit2 size={12} className="inline ml-2 opacity-50" />
                              </h4>
                              <p className="text-gray-400 text-xs">
                                {option.animeId.startsWith('custom_') ? 'Custom Option' : 'Anime'}
                              </p>
                            </div>
                            <button
                              onClick={() => startEditingTitle(index, option.title)}
                              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit title"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => removeAnimeOption(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition"
                        title="Remove option"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {newPoll.options.length < 4 && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Need {4 - newPoll.options.length} more options (minimum 4 required)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 border-t border-gray-700 shadow-lg z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <p className={`text-sm font-medium ${
                isFormValid ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {isFormValid 
                  ? '✅ Ready to submit (All requirements met)' 
                  : `⚠️ Form incomplete (${newPoll.options.length}/4 options, ${newPoll.question ? '✓' : '✗'} question, ${newPoll.expiresAt ? '✓' : '✗'} expiry)`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  resetForm();
                  setViewMode('manage');
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleUpdatePoll();
                  } else {
                    handleCreatePoll();
                  }
                }}
                disabled={!isFormValid || creatingPoll || updatingPoll}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold text-lg transition-all transform hover:scale-105 disabled:hover:scale-100 min-w-[180px] flex items-center justify-center"
              >
                {(creatingPoll || updatingPoll) ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </span>
                ) : isEditing ? (
                  'Update Poll'
                ) : (
                  'Create Poll'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     MANAGE POLLS VIEW
  ========================= */

  // Filter polls based on showExpired toggle
  const filteredPolls = showExpired 
    ? polls.filter(poll => poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()))
    : polls.filter(poll => !poll.isExpired && (!poll.expiresAt || new Date(poll.expiresAt) >= new Date()));

  const activePolls = polls.filter(p => p.isActive && !p.isExpired);
  const expiredPolls = polls.filter(p => p.isExpired || (p.expiresAt && new Date(p.expiresAt) < new Date()));

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Poll Manager</h2>
          <p className="text-gray-400">Manage and control your polls from this panel</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={deleteExpiredPolls}
            disabled={expiredPolls.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
          >
            <Trash2 size={18} />
            Delete Expired ({expiredPolls.length})
          </button>
          <button
            onClick={fetchPolls}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={() => {
              resetForm();
              setViewMode('create');
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-bold transition-all transform hover:scale-105"
          >
            <Plus size={20} />
            Create New Poll
          </button>
        </div>
      </div>

      {/* Poll Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm">Total Polls</p>
          <p className="text-3xl font-bold text-white">{polls.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm">Active Polls</p>
          <p className="text-3xl font-bold text-green-400">
            {activePolls.length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm">Expired Polls</p>
          <p className="text-3xl font-bold text-yellow-400">
            {expiredPolls.length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm">Total Voters</p>
          <p className="text-3xl font-bold text-blue-400">
            {polls.reduce((total, poll) => total + (poll.votersCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Toggle for showing expired polls */}
      <div className="flex items-center gap-3">
        <span className="text-gray-400">Show:</span>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setShowExpired(false)}
            className={`px-4 py-2 rounded-md transition ${!showExpired ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Active Polls ({polls.length - expiredPolls.length})
          </button>
          <button
            onClick={() => setShowExpired(true)}
            className={`px-4 py-2 rounded-md transition ${showExpired ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Expired Polls ({expiredPolls.length})
          </button>
        </div>
      </div>

      {/* Polls List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {filteredPolls.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {showExpired ? 'No expired polls found' : 'No active polls found'}
            </div>
            <button
              onClick={() => {
                resetForm();
                setViewMode('create');
              }}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
            >
              {showExpired ? 'Create New Active Poll' : 'Create Your First Poll'}
            </button>
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
                  const isPollExpired = poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date());
                  
                  return (
                    <tr key={poll._id} className={`hover:bg-gray-900/50 transition ${isPollExpired ? 'opacity-70' : ''}`}>
                      <td className="p-4">
                        <div className="max-w-xs">
                          <p className="text-white font-medium truncate">{poll.question}</p>
                          <p className="text-gray-400 text-sm truncate">
                            Created: {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            poll.isActive && !isPollExpired
                              ? 'bg-green-900/30 text-green-400'
                              : isPollExpired
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : 'bg-gray-900 text-gray-400'
                          }`}>
                            {isPollExpired ? (
                              <>
                                <AlertCircle size={12} />
                                Expired
                              </>
                            ) : poll.isActive ? (
                              <>
                                <Eye size={12} />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff size={12} />
                                Inactive
                              </>
                            )}
                          </span>
                          {isPollExpired && poll.expiresAt && (
                            <span className="text-xs text-yellow-400">
                              {new Date(poll.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white">{poll.options?.length || 0}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{poll.totalVotes || 0} votes</span>
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <Users size={12} />
                            {poll.votersCount || 0} voters
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-gray-300">
                          <Clock size={14} />
                          {poll.expiresAt 
                            ? new Date(poll.expiresAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {!isPollExpired && (
                            <button
                              onClick={() => togglePollStatus(poll._id)}
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                poll.isActive
                                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {poll.isActive ? 'Pause' : 'Activate'}
                            </button>
                          )}
                          <button
                            onClick={() => viewPollDetails(poll)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => viewVotersList(poll)}
                            disabled={!poll.votersCount}
                            className={`px-3 py-1 rounded text-sm font-medium ${poll.votersCount 
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                              : 'bg-gray-600 cursor-not-allowed text-gray-400'}`}
                            title={poll.votersCount ? "View Voters" : "No voters data"}
                          >
                            <Users size={14} />
                          </button>
                          <button
                            onClick={() => handleEditPoll(poll)}
                            disabled={isPollExpired}
                            className={`px-3 py-1 rounded text-sm font-medium ${isPollExpired 
                              ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                              : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                            title={isPollExpired ? "Cannot edit expired poll" : "Edit Poll"}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDuplicatePoll(poll)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium text-white"
                            title="Duplicate Poll"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => exportPollResults(poll)}
                            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm font-medium text-white"
                            title="Export Results"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => deletePoll(poll._id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium text-white"
                            title="Delete Poll"
                          >
                            <Trash2 size={14} />
                          </button>
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
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 size={24} />
                  Poll Details
                </h3>
                <button
                  onClick={() => setSelectedPoll(null)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-900"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Question</h4>
                <p className="text-gray-300 text-lg">{selectedPoll.question}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Status</h4>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                    selectedPoll.isActive && !selectedPoll.isExpired
                      ? 'bg-green-900/30 text-green-400'
                      : selectedPoll.isExpired
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : 'bg-gray-900 text-gray-400'
                  }`}>
                    {selectedPoll.isExpired ? (
                      <>
                        <AlertCircle size={12} />
                        Expired
                      </>
                    ) : selectedPoll.isActive ? (
                      <>
                        <CheckCircle size={12} />
                        Active
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} />
                        Inactive
                      </>
                    )}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Total Votes</h4>
                  <p className="text-2xl font-bold text-purple-400">{selectedPoll.totalVotes || 0}</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Users size={16} />
                    Unique Voters
                  </h4>
                  <p className="text-2xl font-bold text-teal-400">{selectedPoll.votersCount || 0}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                  <span>Options & Results</span>
                  <span className="text-sm text-gray-400">
                    {selectedPoll.options?.length || 0} options
                  </span>
                </h4>
                <div className="space-y-3">
                  {selectedPoll.options && selectedPoll.options.length > 0 ? (
                    selectedPoll.options.map((option, index) => {
                      const voteCount = option.votes || 0;
                      const percentage = selectedPoll.totalVotes 
                        ? Math.round((voteCount / selectedPoll.totalVotes) * 100)
                        : 0;
                      
                      return (
                        <div key={option.animeId || index} className="bg-gray-900 rounded-lg p-4">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 flex-shrink-0">
                              <img
                                src={option.image}
                                alt={option.title}
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x48?text=No+Image';
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <h5 className="text-white font-medium">{option.title}</h5>
                              <p className="text-gray-400 text-sm">
                                {option.animeId && option.animeId.startsWith('custom_') ? 'Custom Option' : 'Anime'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold text-xl">{voteCount} votes</p>
                              <p className="text-gray-400">{percentage}%</p>
                            </div>
                          </div>
                          
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      No options available for this poll
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => exportPollResults(selectedPoll)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-medium transition"
                >
                  <Download size={16} />
                  Export Results
                </button>
                <button
                  onClick={() => setSelectedPoll(null)}
                  className="px-6 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voters List Modal */}
      {selectedPoll && showVotersModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users size={24} />
                    Voters List
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">{selectedPoll.question}</p>
                </div>
                <button
                  onClick={() => {
                    setShowVotersModal(false);
                    setSelectedPoll(null);
                  }}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-900"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Device Type Summary */}
              {selectedPoll.voters && selectedPoll.voters.length > 0 && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {['mobile', 'tablet', 'desktop'].map(type => {
                    const count = selectedPoll.voters.filter((v: any) => 
                      (v.deviceType || '').toLowerCase() === type
                    ).length;
                    const percentage = selectedPoll.voters.length 
                      ? ((count / selectedPoll.voters.length) * 100).toFixed(1)
                      : '0';
                    return (
                      <div key={type} className="bg-gray-900 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          {getDeviceIcon(type)}
                          <span>{formatDeviceType(type)}</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{count}</p>
                        <p className="text-sm text-gray-400">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Total Voters</p>
                  <p className="text-2xl font-bold text-white">{selectedPoll.votersCount || 0}</p>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Total Votes</p>
                  <p className="text-2xl font-bold text-purple-400">{selectedPoll.totalVotes || 0}</p>
                </div>
              </div>

              {selectedPoll.voters && selectedPoll.voters.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-4 p-3 bg-gray-900 rounded-lg font-medium text-gray-300 text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Device Type</div>
                    <div className="col-span-4">Voted At</div>
                    <div className="col-span-4">Voted For</div>
                  </div>
                  {selectedPoll.voters.map((voter: any, index: number) => {
                    const votedOption = selectedPoll.options?.find(opt => 
                      opt._id === voter.optionId || opt.animeId === voter.optionId
                    );
                    
                    return (
                      <div key={index} className="grid grid-cols-12 gap-4 p-3 bg-gray-900/50 hover:bg-gray-900 rounded-lg items-center">
                        <div className="col-span-1 text-gray-400">{index + 1}</div>
                        <div className="col-span-3 flex items-center gap-2 text-gray-300">
                          {getDeviceIcon(voter.deviceType)}
                          <span className="truncate">{formatDeviceType(voter.deviceType)}</span>
                        </div>
                        <div className="col-span-4 text-gray-400 text-sm">
                          {voter.votedAt ? new Date(voter.votedAt).toLocaleString() : 'Unknown'}
                        </div>
                        <div className="col-span-4 text-gray-300 truncate">
                          {votedOption ? votedOption.title : 'Unknown Option'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    No voters data available for this poll
                  </div>
                  <p className="text-gray-500 text-sm">
                    This might be an older poll created before voter tracking was implemented
                  </p>
                </div>
              )}
              
              <div className="pt-6 border-t border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => exportVotersList(selectedPoll)}
                  disabled={!selectedPoll.voters || selectedPoll.voters.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
                >
                  <FileText size={16} />
                  Export Voters List
                </button>
                <button
                  onClick={() => {
                    setShowVotersModal(false);
                    setSelectedPoll(null);
                  }}
                  className="px-6 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-white font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollManager;