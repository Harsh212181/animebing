// src/components/admin/SubAdminMyEarnings.tsx — SUB-ADMIN ONLY (read-only)
// 🆕 EARNINGS: sub-admin's own view→$ breakdown. Rate shown is whichever is
// effective (their own custom rate, or the main admin's global default).
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface SubAdminMyEarningsProps {
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

interface EarningsData {
  subAdminId: string;
  username: string;
  realName: string;
  rate: number;
  rateSource: 'custom' | 'global';
  totalNormalViews: number;
  totalLink5DirectViews: number;
  totalSpecialModeViews: number;
  totalEarnings: number;
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
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

const SubAdminMyEarnings: React.FC<SubAdminMyEarningsProps> = ({ token }) => {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/sub-admin-earnings/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Loading earnings…</span>
      </div>
    );
  }

  if (!data) {
    return <p className="text-gray-500 text-sm text-center py-16">No earnings data available</p>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/15 rounded-xl">
            <SvgIcon d={ICONS.dollar} className="w-6 h-6 text-purple-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">My Earnings</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Rate: ${data.rate.toFixed(2)} / 1000 views
              <span className={`ml-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                data.rateSource === 'custom'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-white/10 text-gray-400 border border-white/10'
              }`}>
                {data.rateSource === 'custom' ? 'Custom rate' : 'Global rate'}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={fetchEarnings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 transition"
        >
          <SvgIcon d={ICONS.refresh} className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Big earnings number */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-purple-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Total earned</p>
        <p className="text-4xl font-bold text-emerald-400">${data.totalEarnings.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-2">from {data.totalNormalViews.toLocaleString()} counted views</p>
      </div>

      {/* 3-category breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/[0.04] border border-purple-500/20 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1.5">
            <SvgIcon d={ICONS.eye} className="w-3.5 h-3.5 text-purple-400" /> Normal views
          </p>
          <p className="text-2xl font-semibold text-purple-300">{data.totalNormalViews.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">Counted toward your earnings</p>
        </div>
        <div className="bg-white/[0.04] border border-cyan-500/20 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1.5">
            <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-cyan-400" /> Link 5 direct views
          </p>
          <p className="text-2xl font-semibold text-cyan-300">{data.totalLink5DirectViews.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">Direct link was active — not counted</p>
        </div>
        <div className="bg-white/[0.04] border border-amber-500/20 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1.5">
            <SvgIcon d={ICONS.sparkle} className="w-3.5 h-3.5 text-amber-400" /> Special mode views
          </p>
          <p className="text-2xl font-semibold text-amber-300">{data.totalSpecialModeViews.toLocaleString()}</p>
          <p className="text-[11px] text-gray-600 mt-1">A special mode forced direct link — not counted</p>
        </div>
      </div>

      {/* Per anime table */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Earnings by anime</p>
        </div>
        {data.byAnime.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">No download-page views yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="px-4 py-2.5 text-left text-gray-500">Anime</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Normal</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">Link 5</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">Special</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {data.byAnime.map(a => (
                  <tr key={a.animeId} className="border-b border-white/[0.03]">
                    <td className="px-4 py-2.5 text-white truncate max-w-[220px]">{a.animeTitle}</td>
                    <td className="px-4 py-2.5 text-right text-purple-300 font-medium">{a.normalViews.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-cyan-300 hidden sm:table-cell">{a.link5DirectViews.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-amber-300 hidden sm:table-cell">{a.specialModeViews.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-300 font-semibold">${a.earnings.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubAdminMyEarnings;