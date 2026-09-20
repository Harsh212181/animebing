 import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Partner, Anime } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import AnimeListTable from './AnimeListTable';
import toast from 'react-hot-toast';

interface DropdownItem {
  _id: string;
  title: string;
  [key: string]: any;
}

interface PartnerManagerProps {
  token: string;
  apiBase: string;
  isMainAdmin?: boolean;
}

const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  partners:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  plus:       'M12 6v6m0 0v6m0-6h6m-6 0H6',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  chevronDown:'M19 9l-7 7-7-7',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  admin:      'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  user:       'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  folder:     'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  empty:      'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  warning:    'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  check:      'M5 13l4 4L19 7',
};

// ── Confirm Modal ─────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            danger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <SvgIcon d={ICONS.warning} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const PartnerManager: React.FC<PartnerManagerProps> = ({ token, apiBase, isMainAdmin = false }) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partnerAnimeMap, setPartnerAnimeMap] = useState<Record<string, Anime[]>>({});
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [focusSearchForPartner, setFocusSearchForPartner] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'partner' | 'anime';
    partnerId?: string;
    partnerName?: string;
    animeId?: string;
    animeTitle?: string;
  } | null>(null);

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

  const computeCounts = (animeList: Anime[]) => {
    const counts = { anime: 0, movie: 0, manga: 0 };
    animeList.forEach((anime) => {
      const type = anime.contentType;
      if (type === 'Anime') counts.anime += 1;
      else if (type === 'Movie') counts.movie += 1;
      else if (type === 'Manga') counts.manga += 1;
    });
    return counts;
  };

  const fetchPartnerAnime = async (partnerId: string, force = false) => {
    if (!force && partnerAnimeMap[partnerId]) {
      return partnerAnimeMap[partnerId];
    }
    try {
      const response = await axiosInstance.get(`/partners/${partnerId}/anime`);
      const animeList = response.data;
      setPartnerAnimeMap(prev => ({ ...prev, [partnerId]: animeList }));
      const counts = computeCounts(animeList);
      setPartnerCounts(prev => ({ ...prev, [partnerId]: counts }));
      return animeList;
    } catch (err: any) {
      console.error('Failed to fetch partner anime:', err);
      toast.error(err.response?.data?.error || 'Failed to load anime for this partner.');
      return [];
    }
  };

  const fetchAllPartnerCounts = async () => {
    const promises = partners.map(async (partner) => {
      if (!partnerCounts[partner._id]) {
        await fetchPartnerAnime(partner._id);
      }
    });
    await Promise.allSettled(promises);
  };

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

  useEffect(() => {
    if (partners.length > 0) {
      fetchAllPartnerCounts();
    }
  }, [partners]);

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
    setConfirmDialog({
      type: 'partner',
      partnerId,
      partnerName,
    });
  };

  const confirmDeletePartner = async () => {
    if (!confirmDialog || confirmDialog.type !== 'partner') return;
    const { partnerId, partnerName } = confirmDialog;
    if (!partnerId) return;
    setConfirmDialog(null);
    setLoading(true);
    const toastId = toast.loading(`Deleting partner "${partnerName}"...`);
    try {
      await axiosInstance.delete(`/partners/${partnerId}`);
      toast.success(`Partner "${partnerName}" deleted successfully.`, { id: toastId });

      setPartnerAnimeMap(prev => {
        const { [partnerId]: _removed, ...rest } = prev;
        return rest;
      });
      setPartnerCounts(prev => {
        const { [partnerId]: _removed2, ...rest } = prev;
        return rest;
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
    if (!partnerId || !animeId) return;
    setConfirmDialog(null);
    setModalLoading(true);
    const toastId = toast.loading(`Removing "${animeTitle}" from partner...`);
    try {
      await axiosInstance.delete(`/partners/${partnerId}/anime/${animeId}`);
      const updatedList = await axiosInstance.get(`/partners/${partnerId}/anime`);
      setPartnerAnimeMap(prev => ({ ...prev, [partnerId]: updatedList.data }));
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

  const renderMediaCounts = (partnerId: string) => {
    const counts = partnerCounts[partnerId];
    if (!counts) return null;

    const types: { key: keyof typeof counts; label: string; color: string }[] = [
      { key: 'anime', label: 'Anime', color: 'text-purple-300 bg-purple-500/15 border-purple-500/25' },
      { key: 'movie', label: 'Movie', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25' },
      { key: 'manga', label: 'Manga', color: 'text-amber-300 bg-amber-500/15 border-amber-500/25' },
    ];

    const activeTypes = types.filter(t => counts[t.key] > 0);

    if (activeTypes.length === 0) {
      return <span className="text-[10px] text-gray-500 italic">No content</span>;
    }

    return (
      <>
        {activeTypes.map((t) => (
          <span
            key={t.key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${t.color}`}
          >
            {counts[t.key]}
            <span className="font-medium opacity-80">{t.label}</span>
          </span>
        ))}
      </>
    );
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 min-h-screen bg-[#0b0a14] text-white">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
          <SvgIcon d={ICONS.partners} className="w-6 h-6 text-indigo-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Partner Manager</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create partners and assign content to them</p>
        </div>
        {partners.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
            {partners.length} total
          </span>
        )}
      </div>

      {/* ─── Create Partner ────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-4 bg-emerald-400 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Create New Partner</h2>
        </div>
        <form onSubmit={handleCreatePartner} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            placeholder="e.g. animebing"
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <SvgIcon d={ICONS.plus} className="w-4 h-4" />
                Create Partner
              </>
            )}
          </button>
        </form>
      </div>

      {/* ─── Partners List ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="w-1 h-4 bg-indigo-400 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">All Partners</h2>
        </div>

        {loading && partners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="mt-3 text-xs text-gray-500">Loading partners...</p>
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <SvgIcon d={ICONS.partners} className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 font-medium">No partners found</p>
            <p className="text-xs text-gray-600 mt-1">Create your first partner above</p>
          </div>
        ) : (
          partners.map((partner) => {
            const isExpanded = expandedPartnerId === partner._id;
            const animeList = partnerAnimeMap[partner._id] || [];

            return (
              <div
                key={partner._id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden transition-all hover:border-white/[0.1] hover:bg-white/[0.04]"
              >
                {/* Partner Header Row */}
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <span className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-400 to-emerald-400 rounded-r-full" />

                  <div className="flex-1 pl-3 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-sm font-bold text-white truncate">{partner.name}</h3>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderMediaCounts(partner._id)}
                      </div>

                      {isMainAdmin && (
                        (!partner.createdBy || partner.createdBy === 'admin') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            <SvgIcon d={ICONS.admin} className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25"
                            title={`Created by sub-admin: ${partner.createdByUsername}`}
                          >
                            <SvgIcon d={ICONS.user} className="w-2.5 h-2.5" />
                            {partner.createdByUsername || 'Sub-Admin'}
                          </span>
                        )
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <SvgIcon d={ICONS.calendar} className="w-3 h-3" />
                      Created {new Date(partner.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="flex gap-1.5 items-center shrink-0">
                    <button
                      onClick={() => handleToggleExpand(partner)}
                      title={isExpanded ? 'Hide anime' : 'View anime'}
                      className={`group p-2 rounded-lg border transition-all ${
                        isExpanded
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-indigo-300'
                      }`}
                    >
                      <SvgIcon d={ICONS.chevronDown} className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleAddAnimeClick(partner)}
                      title="Add anime"
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 transition-all"
                    >
                      <SvgIcon d={ICONS.plus} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePartner(partner._id, partner.name)}
                      title="Delete partner"
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-rose-500/10 hover:border-rose-500/25 hover:text-rose-300 transition-all"
                    >
                      <SvgIcon d={ICONS.trash} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div ref={expandedSectionRef} className="relative border-t border-white/[0.06] bg-black/20 p-4 sm:p-5 space-y-5">
                    {/* Assign New Anime */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-1 h-3.5 bg-emerald-400 rounded-full" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Assign new anime
                        </h4>
                      </div>
                      <div className="[&>div>input]:w-full [&>div>input]:px-4 [&>div>input]:py-2.5 [&>div>input]:bg-white/[0.04] [&>div>input]:border [&>div>input]:border-white/[0.08] [&>div>input]:rounded-xl [&>div>input]:text-sm [&>div>input]:text-white [&>div>input]:placeholder-gray-500 [&>div>input]:focus:outline-none [&>div>input]:focus:border-indigo-500/50 [&>div>input]:focus:ring-2 [&>div>input]:focus:ring-indigo-500/20 [&>div>input]:transition-all">
                        <SearchableDropdown
                          fetchUrl={`${apiBase}/anime/unassigned`}
                          apiBase={apiBase}
                          token={token}
                          onSelect={(item: DropdownItem) => { void handleAssignAnime(item, partner._id); }}
                          placeholder="Type to search anime..."
                          disabled={modalLoading}
                          autoFocus={focusSearchForPartner === partner._id}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1.5 ml-1">
                        Only unassigned anime are shown
                      </p>
                    </div>

                    {/* Assigned Anime */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-3.5 bg-indigo-400 rounded-full" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                            Assigned Anime
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-md">
                          {animeList.length}
                        </span>
                      </div>

                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                        {modalLoading && animeList.length === 0 ? (
                          <div className="flex justify-center py-10">
                            <div className="w-7 h-7 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                          </div>
                        ) : animeList.length === 0 ? (
                          <div className="text-center py-10">
                            <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                              <SvgIcon d={ICONS.empty} className="w-6 h-6 text-gray-600" />
                            </div>
                            <p className="text-xs text-gray-400 font-medium">No anime assigned yet</p>
                            <p className="text-[10px] text-gray-600 mt-1">Use the search above to assign content</p>
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

      {/* ─── Confirm Modal ─────────────────────────────────────── */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.type === 'partner' ? 'Delete Partner?' : 'Remove Anime?'}
        message={
          confirmDialog?.type === 'partner'
            ? `Are you sure you want to delete "${confirmDialog.partnerName}"? All associated anime will be unlinked. This action cannot be undone.`
            : `Are you sure you want to remove "${confirmDialog?.animeTitle}" from this partner?`
        }
        confirmLabel={confirmDialog?.type === 'partner' ? 'Delete' : 'Remove'}
        onConfirm={confirmDialog?.type === 'partner' ? confirmDeletePartner : confirmRemoveAnime}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default PartnerManager;