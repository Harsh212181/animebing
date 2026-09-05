// src/components/admin/SubAdminEarningsManager.tsx — MAIN ADMIN ONLY
// 🆕 EARNINGS: view→$ tracking per sub-admin. Only download-page views tagged
// 'normal' (short link 1-4 was used) count toward $. Link5-direct and
// special-mode-forced views are shown separately and never counted.
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface SubAdminEarningsManagerProps {
  token: string;
}

interface AnimeEarning {
  animeId: string;
  animeTitle: string;
  normalViews: number;
  link5DirectViews: number;
  specialModeViews: number;
  earnings: number;
}

interface SummaryRow {
  subAdminId: string;
  username: string;
  realName: string;
  rate: number;
  rateSource: 'custom' | 'global';
  totalNormalViews: number;
  totalLink5DirectViews: number;
  totalSpecialModeViews: number;
  totalEarnings: number;
}

interface DetailData extends SummaryRow {
  byAnime: AnimeEarning[];
}

const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  dollar: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-14a9 9 0 100 18 9 9 0 000-18z',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  sparkle: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.197-1.539-1.118l1.286-3.96a1 1 0 00-.363-1.117L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  chevron: 'M19 9l-7 7-7-7',
  save: 'M17 21v-8H7v8M7 3v5h8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
};

const RateBadge: React.FC<{ source: 'custom' | 'global' }> = ({ source }) => (
  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
    source === 'custom'
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      : 'bg-white/10 text-gray-400 border border-white/10'
  }`}>
    {source === 'custom' ? 'Custom rate' : 'Global rate'}
  </span>
);

const SubAdminEarningsManager: React.FC<SubAdminEarningsManagerProps> = ({ token }) => {
  const [globalRate, setGlobalRate] = useState<number>(0);
  const [globalRateInput, setGlobalRateInput] = useState<string>('0');
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editingRateFor, setEditingRateFor] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');
  const [savingRate, setSavingRate] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin-earnings/all-summary`, authHeaders);
      setRows(data.data || []);
      setGlobalRate(data.globalRate || 0);
      setGlobalRateInput(String(data.globalRate ?? 0));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load earnings summary');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const saveGlobalRate = async () => {
    const rate = parseFloat(globalRateInput);
    if (isNaN(rate) || rate < 0) {
      toast.error('Enter a valid non-negative rate');
      return;
    }
    setSavingGlobal(true);
    try {
      await axios.put(`${API_BASE}/link-settings/global-rate`, { rate }, authHeaders);
      toast.success('Global rate updated');
      setGlobalRate(rate);
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update global rate');
    } finally {
      setSavingGlobal(false);
    }
  };

  const toggleExpand = async (subAdminId: string) => {
    if (expandedId === subAdminId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(subAdminId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin-earnings/${subAdminId}`, authHeaders);
      setDetail(data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const startEditRate = (row: SummaryRow) => {
    setEditingRateFor(row.subAdminId);
    setEditRateValue(row.rateSource === 'custom' ? String(row.rate) : '');
  };

  const saveCustomRate = async (subAdminId: string) => {
    const trimmed = editRateValue.trim();
    const rate = trimmed === '' ? null : parseFloat(trimmed);
    if (rate !== null && (isNaN(rate) || rate < 0)) {
      toast.error('Enter a valid non-negative rate, or leave blank for global');
      return;
    }
    setSavingRate(true);
    try {
      await axios.put(`${API_BASE}/sub-admin-earnings/${subAdminId}/rate`, { rate }, authHeaders);
      toast.success(rate === null ? 'Reverted to global rate' : 'Custom rate saved');
      setEditingRateFor(null);
      fetchSummary();
      // Agar is sub-admin ka detail panel khula hua hai, use fresh rate ke saath reload karo
      if (expandedId === subAdminId) {
        setDetailLoading(true);
        try {
          const { data } = await axios.get(`${API_BASE}/sub-admin-earnings/${subAdminId}`, authHeaders);
          setDetail(data.data);
        } finally {
          setDetailLoading(false);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save rate');
    } finally {
      setSavingRate(false);
    }
  };

  const totalEarningsAll = rows.reduce((s, r) => s + r.totalEarnings, 0);
  const totalNormalAll = rows.reduce((s, r) => s + r.totalNormalViews, 0);
  const totalLink5All = rows.reduce((s, r) => s + r.totalLink5DirectViews, 0);
  const totalSpecialAll = rows.reduce((s, r) => s + r.totalSpecialModeViews, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/15 rounded-xl">
          <SvgIcon d={ICONS.dollar} className="w-6 h-6 text-purple-300" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Sub-Admin Earnings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Views → $ from download pages, per sub-admin</p>
        </div>
      </div>

      {/* Global rate control */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Global rate</p>
          <p className="text-[11px] text-gray-600 mt-0.5">Default $ per 1000 counted views — used when a sub-admin has no custom rate</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={globalRateInput}
            onChange={e => setGlobalRateInput(e.target.value)}
            className="w-24 px-2.5 py-1.5 text-sm bg-[#1c1b29] border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
          />
          <span className="text-gray-500 text-xs">/ 1000 views</span>
          <button
            onClick={saveGlobalRate}
            disabled={savingGlobal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
          >
            <SvgIcon d={ICONS.save} className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Overall totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Total Earnings</p>
          <p className="text-2xl font-semibold text-emerald-400">${totalEarningsAll.toFixed(2)}</p>
          <p className="text-[11px] text-gray-600 mt-1">All sub-admins combined</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Normal Views</p>
          <p className="text-2xl font-semibold text-purple-400">{totalNormalAll.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">Counted toward earnings</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Link 5 Direct Views</p>
          <p className="text-2xl font-semibold text-cyan-400">{totalLink5All.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">Not counted — direct link was on</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Special Mode Views</p>
          <p className="text-2xl font-semibold text-amber-400">{totalSpecialAll.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">Not counted — mode forced link 5</p>
        </div>
      </div>

      {/* Per sub-admin list */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sub-Admins</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">No sub-admins yet</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rows.map(row => {
              const isExpanded = expandedId === row.subAdminId;
              const isEditingRate = editingRateFor === row.subAdminId;
              return (
                <div key={row.subAdminId}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-300 text-xs font-semibold">{row.realName.charAt(0).toUpperCase()}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{row.realName}</p>
                      <p className="text-[10px] text-gray-500">@{row.username}</p>
                    </div>

                    {/* Rate */}
                    <div className="flex-shrink-0">
                      {isEditingRate ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="global"
                            value={editRateValue}
                            onChange={e => setEditRateValue(e.target.value)}
                            className="w-16 px-2 py-1 text-xs bg-[#1c1b29] border border-white/10 rounded-md text-white focus:outline-none focus:border-purple-500/50"
                          />
                          <button
                            onClick={() => saveCustomRate(row.subAdminId)}
                            disabled={savingRate}
                            className="px-2 py-1 text-[10px] font-medium rounded-md bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRateFor(null)}
                            className="px-2 py-1 text-[10px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-gray-400 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEditRate(row)} className="flex items-center gap-1.5 group">
                          <span className="text-xs text-gray-300">${row.rate.toFixed(2)}/1000</span>
                          <RateBadge source={row.rateSource} />
                          <SvgIcon d={ICONS.edit} className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </button>
                      )}
                    </div>

                    {/* Earnings */}
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-sm font-semibold text-emerald-400">${row.totalEarnings.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-600">earned</p>
                    </div>

                    <button
                      onClick={() => toggleExpand(row.subAdminId)}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors"
                    >
                      <SvgIcon d={ICONS.chevron} className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-white/[0.02] px-4 py-4 space-y-4">
                      {detailLoading ? (
                        <div className="flex justify-center py-4">
                          <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : !detail ? (
                        <p className="text-gray-600 text-xs text-center py-4">No data</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <SvgIcon d={ICONS.eye} className="w-3 h-3 text-purple-400" /> Normal
                              </p>
                              <p className="text-base font-semibold text-purple-300 mt-1">{detail.totalNormalViews.toLocaleString()}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <SvgIcon d={ICONS.link} className="w-3 h-3 text-cyan-400" /> Link 5 direct
                              </p>
                              <p className="text-base font-semibold text-cyan-300 mt-1">{detail.totalLink5DirectViews.toLocaleString()}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <SvgIcon d={ICONS.sparkle} className="w-3 h-3 text-amber-400" /> Special mode
                              </p>
                              <p className="text-base font-semibold text-amber-300 mt-1">{detail.totalSpecialModeViews.toLocaleString()}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Per anime</p>
                            {detail.byAnime.length === 0 ? (
                              <p className="text-gray-600 text-xs">No download-page views yet</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                                      <th className="px-3 py-2 text-left text-gray-500">Anime</th>
                                      <th className="px-3 py-2 text-right text-gray-500">Normal</th>
                                      <th className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">Link 5</th>
                                      <th className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">Special</th>
                                      <th className="px-3 py-2 text-right text-gray-500">$</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.byAnime.map(a => (
                                      <tr key={a.animeId} className="border-b border-white/[0.03]">
                                        <td className="px-3 py-2 text-white truncate max-w-[180px]">{a.animeTitle}</td>
                                        <td className="px-3 py-2 text-right text-purple-300">{a.normalViews.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right text-cyan-300 hidden sm:table-cell">{a.link5DirectViews.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right text-amber-300 hidden sm:table-cell">{a.specialModeViews.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right text-emerald-300 font-medium">${a.earnings.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubAdminEarningsManager;