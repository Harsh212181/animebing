 import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Partner, Anime } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import AnimeListTable from './AnimeListTable';
import toast from 'react-hot-toast'; // ✅ added toast

interface DropdownItem {
  _id: string;
  title: string;
  [key: string]: any;
}

interface PartnerManagerProps {
  token: string;
  apiBase: string;
}

const PartnerManager: React.FC<PartnerManagerProps> = ({ token, apiBase }) => {
  // ---------- ALL ORIGINAL STATE ----------
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // kept for inline error, but toasts also used

  const [partnerAnimeMap, setPartnerAnimeMap] = useState<Record<string, Anime[]>>({});
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [focusSearchForPartner, setFocusSearchForPartner] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'partner' | 'anime';
    partnerId?: string;
    partnerName?: string;
    animeId?: string;
    animeTitle?: string;
  } | null>(null);

  // ---------- NEW: per‑partner media type counts ----------
  const [partnerCounts, setPartnerCounts] = useState<
    Record<string, { anime: number; movie: number; manga: number }>
  >({});

  const expandedSectionRef = useRef<HTMLDivElement>(null);

  const axiosInstance = axios.create({
    baseURL: apiBase,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // ---------- HELPER: compute counts from anime list (using contentType) ----------
  const computeCounts = (animeList: Anime[]) => {
    const counts = { anime: 0, movie: 0, manga: 0 };
    animeList.forEach((anime) => {
      const type = anime.contentType; // 'Anime' | 'Movie' | 'Manga'
      if (type === 'Anime') counts.anime += 1;
      else if (type === 'Movie') counts.movie += 1;
      else if (type === 'Manga') counts.manga += 1;
    });
    return counts;
  };

  // ---------- EXTENDED: fetch partner anime + update counts ----------
  const fetchPartnerAnime = async (partnerId: string, force = false) => {
    if (!force && partnerAnimeMap[partnerId]) {
      return partnerAnimeMap[partnerId];
    }
    try {
      const response = await axiosInstance.get(`/partners/${partnerId}/anime`);
      const animeList = response.data;
      setPartnerAnimeMap(prev => ({ ...prev, [partnerId]: animeList }));

      // Update counts for this partner
      const counts = computeCounts(animeList);
      setPartnerCounts(prev => ({ ...prev, [partnerId]: counts }));

      return animeList;
    } catch (err: any) {
      console.error('Failed to fetch partner anime:', err);
      toast.error(err.response?.data?.error || 'Failed to load anime for this partner.');
      return [];
    }
  };

  // ---------- FETCH ALL COUNTS AFTER PARTNERS LOAD ----------
  const fetchAllPartnerCounts = async () => {
    const promises = partners.map(async (partner) => {
      if (!partnerCounts[partner._id]) {
        await fetchPartnerAnime(partner._id);
      }
    });
    await Promise.allSettled(promises);
  };

  // ---------- ORIGINAL fetchPartners ----------
  const fetchPartners = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get('/partners');
      setPartners(response.data);
    } catch (err: any) {
      console.error('Failed to fetch partners:', err);
      setError(err.response?.data?.error || 'Failed to load partners. Please try again.');
      toast.error(err.response?.data?.error || 'Failed to load partners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && apiBase) fetchPartners();
  }, [token, apiBase]);

  // after partners are loaded, fetch their anime counts
  useEffect(() => {
    if (partners.length > 0) {
      fetchAllPartnerCounts();
    }
  }, [partners]);

  // ---------- ORIGINAL HANDLERS (updated to use toast) ----------
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      toast.error('Partner name cannot be empty');
      return;
    }
    setLoading(true);
    setError(null);
    const toastId = toast.loading('Creating partner...');
    try {
      await axiosInstance.post('/partners', { name: newPartnerName.trim() });
      setNewPartnerName('');
      toast.success(`Partner "${newPartnerName}" created successfully!`, { id: toastId });
      fetchPartners();
    } catch (err: any) {
      console.error('Failed to create partner:', err);
      toast.error(err.response?.data?.error || 'Failed to create partner. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePartner = async (partnerId: string, partnerName: string) => {
    // Show confirmation modal instead of browser confirm
    setConfirmDialog({
      type: 'partner',
      partnerId,
      partnerName,
    });
  };

  const confirmDeletePartner = async () => {
    if (!confirmDialog || confirmDialog.type !== 'partner') return;
    const { partnerId, partnerName } = confirmDialog;
    setConfirmDialog(null);
    setLoading(true);
    const toastId = toast.loading(`Deleting partner "${partnerName}"...`);
    try {
      await axiosInstance.delete(`/partners/${partnerId}`);
      toast.success(`Partner "${partnerName}" deleted successfully.`, { id: toastId });
      setPartnerAnimeMap(prev => {
        const newMap = { ...prev };
        delete newMap[partnerId];
        return newMap;
      });
      setPartnerCounts(prev => {
        const newCounts = { ...prev };
        delete newCounts[partnerId];
        return newCounts;
      });
      if (expandedPartnerId === partnerId) setExpandedPartnerId(null);
      fetchPartners();
    } catch (err: any) {
      console.error('Failed to delete partner:', err);
      toast.error(err.response?.data?.error || 'Failed to delete partner. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAnime = (animeId: string, partnerId: string) => {
    // Find anime title from partnerAnimeMap for modal
    const anime = partnerAnimeMap[partnerId]?.find(a => a.id === animeId);
    setConfirmDialog({
      type: 'anime',
      partnerId,
      animeId,
      animeTitle: anime?.title || 'this anime',
    });
  };

  const confirmRemoveAnime = async () => {
    if (!confirmDialog || confirmDialog.type !== 'anime') return;
    const { partnerId, animeId, animeTitle } = confirmDialog;
    setConfirmDialog(null);
    setModalLoading(true);
    const toastId = toast.loading(`Removing "${animeTitle}" from partner...`);
    try {
      await axiosInstance.delete(`/partners/${partnerId}/anime/${animeId}`);
      const updatedList = await axiosInstance.get(`/partners/${partnerId}/anime`);
      setPartnerAnimeMap(prev => ({ ...prev, [partnerId]: updatedList.data }));
      // Update counts
      const counts = computeCounts(updatedList.data);
      setPartnerCounts(prev => ({ ...prev, [partnerId]: counts }));
      fetchPartners();
      toast.success(`"${animeTitle}" removed successfully!`, { id: toastId });
    } catch (err: any) {
      console.error('Failed to remove anime:', err);
      toast.error(err.response?.data?.error || 'Failed to remove anime. Please try again.', { id: toastId });
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleExpand = async (partner: Partner) => {
    if (expandedPartnerId === partner._id) {
      setExpandedPartnerId(null);
      setFocusSearchForPartner(null);
      return;
    }
    await fetchPartnerAnime(partner._id);
    setExpandedPartnerId(partner._id);
    setFocusSearchForPartner(null);
  };

  const handleAddAnimeClick = async (partner: Partner) => {
    await fetchPartnerAnime(partner._id);
    setExpandedPartnerId(partner._id);
    setFocusSearchForPartner(partner._id);
    setTimeout(() => {
      expandedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleAssignAnime = async (selected: DropdownItem, partnerId: string) => {
    const animeId = selected._id;
    if (!animeId) {
      toast.error('Invalid anime selection');
      return;
    }
    setModalLoading(true);
    const toastId = toast.loading('Assigning anime...');
    try {
      await axiosInstance.post(`/partners/${partnerId}/anime`, { animeId });
      const updatedList = await axiosInstance.get(`/partners/${partnerId}/anime`);
      setPartnerAnimeMap(prev => ({ ...prev, [partnerId]: updatedList.data }));
      // Update counts
      const counts = computeCounts(updatedList.data);
      setPartnerCounts(prev => ({ ...prev, [partnerId]: counts }));
      fetchPartners();
      toast.success('Anime assigned successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Failed to assign anime:', err);
      toast.error(err.response?.data?.error || 'Failed to assign anime. Please try again.', { id: toastId });
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    if (focusSearchForPartner) {
      const timer = setTimeout(() => setFocusSearchForPartner(null), 500);
      return () => clearTimeout(timer);
    }
  }, [focusSearchForPartner]);

  // ---------- HELPER: render media type badges (only non‑zero) ----------
  const renderMediaCounts = (partnerId: string) => {
    const counts = partnerCounts[partnerId];
    if (!counts) return null;

    const types: { key: keyof typeof counts; label: string }[] = [
      { key: 'anime', label: 'Anime' },
      { key: 'movie', label: 'Movie' },
      { key: 'manga', label: 'Manga' }
    ];

    const activeTypes = types.filter(t => counts[t.key] > 0);

    if (activeTypes.length === 0) {
      return <span className="text-white/50 italic">No content</span>;
    }

    return (
      <>
        {activeTypes.map((t, idx) => (
          <span key={t.key} className="inline-flex items-center">
            {idx > 0 && <span className="mx-1.5 text-white/30">•</span>}
            <span className="text-emerald-300 font-medium">{counts[t.key]}</span>
            <span className="ml-1 text-white/70">{t.label}</span>
          </span>
        ))}
      </>
    );
  };

  // ---------- JSX – COMPLETE REDESIGN (with counts integrated) ----------
  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-xl">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-emerald-300">
          Partner Manager
        </h1>
      </div>

      {/* Create Partner – glass card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white/90 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-emerald-400 rounded-full"></span>
          Create New Partner
        </h2>
        <form onSubmit={handleCreatePartner} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="e.g.animebing"
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            className="flex-1 px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-indigo-800/50 disabled:to-indigo-900/50 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Partner
              </>
            )}
          </button>
        </form>
      </div>

      {/* Partners List – redesign as stacked glass cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2 px-1">
          <span className="w-1.5 h-6 bg-indigo-400 rounded-full"></span>
          All Partners
          {partners.length > 0 && (
            <span className="ml-2 text-sm font-normal px-3 py-1 bg-white/5 rounded-full text-white/60">
              {partners.length} total
            </span>
          )}
        </h2>

        {loading && partners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-white/60">Loading partners...</p>
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            <svg className="w-16 h-16 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-4 text-white/60 text-lg">No partners found.</p>
            <p className="text-white/40">Create your first partner above.</p>
          </div>
        ) : (
          partners.map((partner) => {
            const isExpanded = expandedPartnerId === partner._id;
            const animeList = partnerAnimeMap[partner._id] || [];

            return (
              <div
                key={partner._id}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-xl transition-all hover:shadow-2xl hover:border-white/20"
              >
                {/* Partner Row – redesigned with larger presence */}
                <div className="relative p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Colored left accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 to-emerald-400 rounded-l-2xl"></div>

                  <div className="flex-1 pl-3">
                    <div className="flex items-center flex-wrap gap-3">
                      <h3 className="text-xl font-bold text-white">{partner.name}</h3>

                      {/* Dynamic media‑type badges */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {renderMediaCounts(partner._id)}
                      </div>

                      <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md">
                        ID: {partner._id.slice(-6)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-white/40 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Created: {new Date(partner.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Button group */}
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleToggleExpand(partner)}
                      title={isExpanded ? 'Hide anime' : 'View anime'}
                      className="p-2.5 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl text-white/80 hover:text-indigo-300 transition-all"
                    >
                      <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleAddAnimeClick(partner)}
                      title="Add anime"
                      className="p-2.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl text-white/80 hover:text-emerald-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDeletePartner(partner._id, partner.name)}
                      title="Delete partner"
                      className="p-2.5 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-xl text-white/80 hover:text-rose-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div ref={expandedSectionRef} className="relative mt-2 p-6 bg-gray-900/60 border-t border-white/10 backdrop-blur-sm">
                    {/* Header with partner name and extra delete button */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">{partner.name}</h3>
                          <p className="text-xs text-white/40">ID: {partner._id}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePartner(partner._id, partner.name)}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-xl text-rose-200 text-sm font-medium transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Partner
                      </button>
                    </div>

                    {/* Add Anime Section */}
                    <div className="mb-8">
                      <h4 className="text-md font-medium text-white/80 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-emerald-400 rounded-full"></span>
                        Assign new anime to {partner.name}
                      </h4>
                      <div className="[&>div>input]:w-full [&>div>input]:px-5 [&>div>input]:py-3 [&>div>input]:bg-gray-800/80 [&>div>input]:border [&>div>input]:border-white/10 [&>div>input]:rounded-xl [&>div>input]:text-white [&>div>input]:placeholder-gray-500 [&>div>input]:focus:outline-none [&>div>input]:focus:ring-2 [&>div>input]:focus:ring-indigo-500 [&>div>input]:focus:border-transparent [&>div>input]:transition">
                        <SearchableDropdown
                          fetchUrl={`${apiBase}/anime/unassigned`}
                          apiBase={apiBase}
                          token={token}
                          onSelect={(item: DropdownItem) => { void handleAssignAnime(item, partner._id); }}
                          placeholder="Search anime by title..."
                          disabled={modalLoading}
                          autoFocus={focusSearchForPartner === partner._id}
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-2 ml-1">
                        Only unassigned anime are shown.
                      </p>
                    </div>

                    {/* Assigned Anime List */}
                    <div>
                      <h4 className="text-md font-medium text-white/80 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-indigo-400 rounded-full"></span>
                        Assigned Anime ({animeList.length})
                      </h4>
                      <div className="bg-gray-800/40 border border-white/5 rounded-xl p-1">
                        {modalLoading && animeList.length === 0 ? (
                          <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                          </div>
                        ) : animeList.length === 0 ? (
                          <div className="text-center py-10">
                            <svg className="w-12 h-12 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <p className="mt-4 text-white/60">No anime assigned yet.</p>
                            <p className="text-sm text-white/40">Use the search above to assign.</p>
                          </div>
                        ) : (
                          <AnimeListTable
                            animeList={animeList}
                            onRemoveFromPartner={(animeId) => handleRemoveAnime(animeId, partner._id)}
                            showRemoveButton={true}
                            isLoading={modalLoading}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">
              {confirmDialog.type === 'partner' ? 'Delete Partner' : 'Remove Anime'}
            </h3>
            <p className="text-slate-300 mb-6">
              {confirmDialog.type === 'partner'
                ? `Are you sure you want to delete "${confirmDialog.partnerName}"? All associated anime will be unlinked.`
                : `Are you sure you want to remove "${confirmDialog.animeTitle}" from this partner?`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.type === 'partner' ? confirmDeletePartner : confirmRemoveAnime}
                className="bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {confirmDialog.type === 'partner' ? 'Delete' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerManager;