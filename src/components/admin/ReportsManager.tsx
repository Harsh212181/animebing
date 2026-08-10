 // src/components/admin/ReportsManager.tsx - REDESIGNED v2 (fully clickable cards, no popups)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../Spinner';

interface Report {
  _id: string;
  animeId?: {
    _id: string;
    title: string;
    thumbnail: string;
  };
  episodeId?: string;
  episodeNumber?: number;
  issueType?: string;
  description?: string;
  name?: string;
  email: string;
  subject?: string;
  message: string;
  type: 'episode' | 'contact';
  username: string;
  status: 'Pending' | 'In Progress' | 'Fixed' | 'Invalid';
  createdAt: string;
  userIP: string;
  userAgent: string;
  resolvedAt?: string;
  resolvedBy?: {
    username: string;
  };
  adminResponse?: string;
  responseDate?: string;
  subAdminUsername?: string;
}

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

interface ReportsManagerProps {
  token?: string;
}

// ── design tokens ────────────────────────────────────────────────────────
const STATUS_TOKENS: Record<Report['status'], { dot: string; text: string; bg: string; border: string; spine: string }> = {
  'Pending':     { dot: 'bg-amber-400',    text: 'text-amber-300',    bg: 'bg-amber-500/10',    border: 'border-amber-500/25',    spine: 'bg-gradient-to-b from-amber-400 to-amber-500' },
  'In Progress': { dot: 'bg-sky-400',      text: 'text-sky-300',      bg: 'bg-sky-500/10',      border: 'border-sky-500/25',      spine: 'bg-gradient-to-b from-sky-400 to-sky-500' },
  'Fixed':       { dot: 'bg-emerald-400',  text: 'text-emerald-300',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/25',  spine: 'bg-gradient-to-b from-emerald-400 to-emerald-500' },
  'Invalid':     { dot: 'bg-rose-400',     text: 'text-rose-300',     bg: 'bg-rose-500/10',     border: 'border-rose-500/25',     spine: 'bg-gradient-to-b from-rose-400 to-rose-500' },
};

const ISSUE_TOKENS: Record<string, string> = {
  'Link Not Working': 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  'Wrong Episode':    'text-orange-300 bg-orange-500/10 border-orange-500/20',
  'Poor Quality':     'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'Audio Issue':      'text-violet-300 bg-violet-500/10 border-violet-500/20',
  'Subtitle Issue':   'text-sky-300 bg-sky-500/10 border-sky-500/20',
};

const FilmIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 10h4M3 15h4M17 10h4M17 15h4" />
  </svg>
);

const MailIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg className={`w-4 h-4 transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7h10z" />
  </svg>
);

const PlayIcon: React.FC = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);

const CopyIcon: React.FC = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15V5a2 2 0 012-2h10" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);

const GlobeIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z" />
  </svg>
);

const DeviceIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" />
  </svg>
);

const TagIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L4 3a1 1 0 00-1 1l.24 5.59a2 2 0 00.58 1.41l9.59 9.59a2 2 0 002.83 0l4.35-4.35a2 2 0 000-2.83z" />
    <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

// ── relative time ─────────────────────────────────────────────────────────
const timeAgo = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── small building blocks ────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">{label}</p>
    <div className="text-sm text-gray-200">{children}</div>
  </div>
);

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
  <div className={`bg-white/[0.025] border border-white/[0.06] rounded-xl p-4 ${className}`}>
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-500">{icon}</span>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{title}</p>
    </div>
    {children}
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean; copyValue?: string; copiedKey?: string | null; rowKey?: string; onCopy?: (text: string, key: string) => void }> = ({
  icon, label, value, mono, copyValue, copiedKey, rowKey, onCopy
}) => (
  <div className="flex items-start gap-2.5 py-1.5">
    <span className="mt-0.5 text-gray-600 flex-shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</p>
      <p className={`text-xs text-gray-300 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
    {copyValue && onCopy && rowKey && (
      <button
        onClick={() => onCopy(copyValue, rowKey)}
        title="Copy"
        className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-gray-200 hover:bg-white/10 transition"
      >
        {copiedKey === rowKey ? <CheckIcon className="w-3 h-3 text-emerald-400" /> : <CopyIcon />}
      </button>
    )}
  </div>
);

const SegmentedControl = <T extends string>({ options, value, onChange, labels }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>>;
}) => (
  <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.07] p-1 rounded-lg">
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
          value === opt ? 'bg-purple-600 text-white shadow-[0_1px_8px_rgba(147,51,234,0.4)]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
        }`}
      >
        {labels?.[opt] ?? opt}
      </button>
    ))}
  </div>
);

const ReportsManager: React.FC<ReportsManagerProps> = ({ token: tokenProp }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Report['status']>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'episode' | 'contact'>('All');
  const [expandedReports, setExpandedReports] = useState<string[]>([]);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [adminResponses, setAdminResponses] = useState<{ [key: string]: string }>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => { fetchReports(); }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500);
    }).catch(() => {});
  };

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const { data } = await axios.get(`${API_BASE}/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setBusyId(reportId);
    try {
      const token = getToken();
      await axios.delete(`${API_BASE}/admin/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteArmed(null);
      setReports(prev => prev.filter(r => r._id !== reportId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete report');
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReports.length === 0) return;
    try {
      const token = getToken();
      await axios.post(`${API_BASE}/admin/reports/bulk-delete`,
        { reportIds: selectedReports },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBulkDeleteMode(false);
      setSelectedReports([]);
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete reports');
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => prev.includes(reportId) ? prev.filter(id => id !== reportId) : [...prev, reportId]);
  };

  const toggleSelectAll = () => {
    setSelectedReports(prev => prev.length === filteredReports.length ? [] : filteredReports.map(r => r._id));
  };

  const toggleReportExpansion = (reportId: string) => {
    if (bulkDeleteMode) return;
    setExpandedReports(prev => prev.includes(reportId) ? prev.filter(id => id !== reportId) : [...prev, reportId]);
    setDeleteArmed(null);
  };

  const handleResponseChange = (reportId: string, response: string) => {
    setAdminResponses(prev => ({ ...prev, [reportId]: response }));
  };

  const updateReportStatus = async (reportId: string, status: Report['status']) => {
    setBusyId(reportId);
    try {
      const token = getToken();
      const updateData: any = { status };
      const response = adminResponses[reportId];
      if (response && status === 'Fixed') {
        updateData.adminResponse = response;
        updateData.responseDate = new Date();
      }
      if (status === 'Fixed') updateData.resolvedAt = new Date();

      await axios.put(`${API_BASE}/admin/reports/${reportId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAdminResponses(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update report');
    } finally {
      setBusyId(null);
    }
  };

  const quickUpdateStatus = async (reportId: string, status: Report['status']) => {
    setBusyId(reportId);
    try {
      const token = getToken();
      await axios.put(`${API_BASE}/admin/reports/${reportId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update report');
    } finally {
      setBusyId(null);
    }
  };

  const filteredReports = reports.filter(report =>
    (statusFilter === 'All' || report.status === statusFilter) &&
    (typeFilter === 'All' || report.type === typeFilter)
  );

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const counts = {
    total: reports.length,
    episode: reports.filter(r => r.type === 'episode').length,
    contact: reports.filter(r => r.type === 'contact').length,
    pending: reports.filter(r => r.status === 'Pending').length,
    fixed: reports.filter(r => r.status === 'Fixed').length,
    invalid: reports.filter(r => r.status === 'Invalid').length,
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="text-center py-12">
      <p className="text-rose-400 text-sm mb-3">{error}</p>
      <button onClick={fetchReports} className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition">
        Try again
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header / toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">Report Queue</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {filteredReports.length} of {reports.length} report{reports.length !== 1 ? 's' : ''}
            {statusFilter !== 'All' && <> &middot; {statusFilter}</>}
            {typeFilter !== 'All' && <> &middot; {typeFilter === 'episode' ? 'Episode' : 'Contact'}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={['All', 'episode', 'contact'] as const}
            value={typeFilter}
            onChange={setTypeFilter}
            labels={{ episode: 'Episode', contact: 'Contact' }}
          />
          <SegmentedControl
            options={['All', 'Pending', 'In Progress', 'Fixed', 'Invalid'] as const}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          {filteredReports.length > 0 && (
            <button
              onClick={() => { setBulkDeleteMode(v => !v); setSelectedReports([]); setExpandedReports([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                bulkDeleteMode
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {bulkDeleteMode ? 'Cancel select' : 'Select'}
            </button>
          )}
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-all duration-150 shadow-[0_1px_10px_rgba(147,51,234,0.35)]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkDeleteMode && filteredReports.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-rose-500/[0.06] border border-rose-500/20 rounded-xl px-4 py-2.5 animate-[fadeIn_0.2s_ease]">
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-xs font-medium text-rose-300 hover:text-rose-200 transition">
              {selectedReports.length === filteredReports.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-gray-500">{selectedReports.length} selected</span>
          </div>
          {selectedReports.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
            >
              <TrashIcon /> Delete {selectedReports.length}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-300">Queue is clear</p>
          <p className="text-xs text-gray-600 mt-1">
            {statusFilter !== 'All' || typeFilter !== 'All' ? 'No reports match this filter.' : 'No user reports yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredReports.map(report => {
            const tokens = STATUS_TOKENS[report.status];
            const isOpen = expandedReports.includes(report._id);
            const isBusy = busyId === report._id;
            const isSelected = selectedReports.includes(report._id);

            return (
              <div
                key={report._id}
                className={`group relative flex bg-white/[0.03] border rounded-xl overflow-hidden transition-all duration-200 ${
                  isOpen
                    ? 'border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.35)] bg-white/[0.045]'
                    : isSelected
                      ? 'border-purple-500/40'
                      : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04]'
                }`}
              >
                {/* status spine */}
                <div className={`w-1 flex-shrink-0 ${tokens.spine}`} />

                <div className="flex-1 min-w-0">
                  {/* Row header — whole area is clickable */}
                  <div
                    onClick={() => toggleReportExpansion(report._id)}
                    className={`flex items-center gap-3 px-4 py-3.5 select-none ${bulkDeleteMode ? '' : 'cursor-pointer'}`}
                  >
                    {bulkDeleteMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleReportSelection(report._id)}
                        className="w-4 h-4 flex-shrink-0 accent-purple-600 rounded cursor-pointer"
                      />
                    )}

                    <span className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      report.type === 'episode' ? 'bg-sky-500/10 text-sky-300 group-hover:bg-sky-500/15' : 'bg-purple-500/10 text-purple-300 group-hover:bg-purple-500/15'
                    }`}>
                      {report.type === 'episode' ? <FilmIcon /> : <MailIcon />}
                    </span>

                    {report.type === 'episode' && report.animeId?.thumbnail && (
                      <img src={report.animeId.thumbnail} alt="" className="w-8 h-11 object-cover rounded-md flex-shrink-0 ring-1 ring-white/10" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">
                          {report.type === 'episode'
                            ? (report.animeId?.title || 'Unknown Anime')
                            : (report.subject || 'No subject')}
                        </p>
                        {report.type === 'episode' && report.episodeNumber && (
                          <span className="flex-shrink-0 text-[10px] font-semibold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                            EP {report.episodeNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {report.type === 'episode' ? report.username : (report.name || 'Anonymous')}
                        {report.subAdminUsername && <span className="text-purple-400/80"> &middot; added by {report.subAdminUsername}</span>}
                      </p>
                    </div>

                    <span className="hidden sm:block flex-shrink-0 text-[11px] text-gray-600 tabular-nums" title={formatDate(report.createdAt)}>
                      {timeAgo(report.createdAt)}
                    </span>

                    <span className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tokens.bg} ${tokens.border} ${tokens.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tokens.dot}`} />
                      {report.status}
                    </span>

                    {!bulkDeleteMode && report.status === 'Pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); quickUpdateStatus(report._id, 'In Progress'); }}
                        disabled={isBusy}
                        title="Start progress"
                        className="flex-shrink-0 w-7 h-7 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 flex items-center justify-center transition disabled:opacity-40"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    {!bulkDeleteMode && report.status === 'In Progress' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); quickUpdateStatus(report._id, 'Fixed'); }}
                        disabled={isBusy}
                        title="Mark fixed"
                        className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center justify-center transition disabled:opacity-40"
                      >
                        <CheckIcon />
                      </button>
                    )}

                    {!bulkDeleteMode && (
                      <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isOpen ? 'bg-white/10 text-white' : 'text-gray-500 group-hover:text-gray-300'
                      }`}>
                        <ChevronIcon open={isOpen} />
                      </span>
                    )}
                  </div>

                  {/* Inline expanded panel — no modal, smooth reveal */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="border-t border-white/[0.07] bg-gradient-to-b from-black/30 to-black/10 px-4 sm:px-5 py-5 space-y-5 cursor-default"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                          {/* ── main column ── */}
                          <div className="lg:col-span-7 space-y-4">
                            {report.type === 'episode' ? (
                              <Panel title="Issue report" icon={<TagIcon />}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${ISSUE_TOKENS[report.issueType || ''] || 'text-gray-300 bg-white/5 border-white/10'}`}>
                                    {report.issueType || 'N/A'}
                                  </span>
                                  {report.episodeId && (
                                    <span className="text-[11px] font-mono text-gray-600">ID {report.episodeId}</span>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                                  {report.description || 'No description provided.'}
                                </p>
                              </Panel>
                            ) : (
                              <Panel title="Message" icon={<MailIcon className="w-3.5 h-3.5" />}>
                                <p className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                                  {report.message || 'No message provided.'}
                                </p>
                              </Panel>
                            )}

                            {report.adminResponse ? (
                              <Panel title="Admin response" icon={<CheckIcon className="w-3.5 h-3.5" />} className="!bg-emerald-500/[0.05] !border-emerald-500/20">
                                <p className="text-sm text-emerald-200 whitespace-pre-wrap leading-relaxed">{report.adminResponse}</p>
                                {report.responseDate && (
                                  <p className="text-[11px] text-emerald-500/60 mt-2">Sent {formatDate(report.responseDate)}</p>
                                )}
                              </Panel>
                            ) : (
                              <Panel title="Write a response" icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></svg>}>
                                <textarea
                                  value={adminResponses[report._id] || ''}
                                  onChange={(e) => handleResponseChange(report._id, e.target.value)}
                                  className="w-full bg-white/[0.03] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 h-24 placeholder:text-gray-600 transition"
                                  placeholder="Add a note — it's saved when you mark this report as Fixed."
                                />
                              </Panel>
                            )}
                          </div>

                          {/* ── sidebar column ── */}
                          <div className="lg:col-span-5 space-y-4">
                            <Panel title="Reporter" icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>}>
                              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/[0.06]">
                                <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {(report.type === 'episode' ? report.username : report.name || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {report.type === 'episode' ? report.username : (report.name || 'Anonymous')}
                                  </p>
                                  {report.subAdminUsername && (
                                    <p className="text-[11px] text-purple-400/80 truncate">via {report.subAdminUsername}</p>
                                  )}
                                </div>
                              </div>
                              <div className="divide-y divide-white/[0.05]">
                                <InfoRow icon={<MailIcon className="w-3.5 h-3.5" />} label="Email" value={<span className="text-sky-400">{report.email}</span>}
                                  copyValue={report.email} copiedKey={copiedKey} rowKey={`email-${report._id}`} onCopy={copyToClipboard} />
                                <InfoRow icon={<GlobeIcon />} label="IP address" value={report.userIP} mono
                                  copyValue={report.userIP} copiedKey={copiedKey} rowKey={`ip-${report._id}`} onCopy={copyToClipboard} />
                                <InfoRow icon={<DeviceIcon />} label="User agent" value={report.userAgent}
                                  copyValue={report.userAgent} copiedKey={copiedKey} rowKey={`ua-${report._id}`} onCopy={copyToClipboard} />
                              </div>
                            </Panel>

                            <Panel title="Timeline" icon={<ClockIcon />}>
                              <div className="space-y-0">
                                <div className="flex gap-3">
                                  <div className="flex flex-col items-center flex-shrink-0">
                                    <span className="w-2 h-2 rounded-full bg-purple-400 ring-4 ring-purple-400/15" />
                                    {report.resolvedAt && <span className="w-px flex-1 bg-white/10 my-1" />}
                                  </div>
                                  <div className="pb-3">
                                    <p className="text-xs text-gray-300 font-medium">Reported</p>
                                    <p className="text-[11px] text-gray-600">{formatDate(report.createdAt)}</p>
                                  </div>
                                </div>
                                {report.resolvedAt && (
                                  <div className="flex gap-3">
                                    <div className="flex flex-col items-center flex-shrink-0">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/15" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-300 font-medium">Resolved</p>
                                      <p className="text-[11px] text-gray-600">{formatDate(report.resolvedAt)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Panel>
                          </div>
                        </div>

                        {/* Action bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.07]">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => updateReportStatus(report._id, 'Fixed')}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
                            >
                              <CheckIcon className="w-3.5 h-3.5" /> Mark fixed
                            </button>
                            <button
                              onClick={() => updateReportStatus(report._id, 'In Progress')}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-40"
                            >
                              <PlayIcon /> In progress
                            </button>
                            <button
                              onClick={() => updateReportStatus(report._id, 'Invalid')}
                              disabled={isBusy}
                              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition disabled:opacity-40"
                            >
                              Mark invalid
                            </button>
                          </div>

                          {/* Inline delete — no popup */}
                          {deleteArmed === report._id ? (
                            <div className="flex items-center gap-2 bg-rose-500/[0.08] border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                              <p className="text-xs text-rose-300 pr-1">Delete permanently?</p>
                              <button
                                onClick={() => setDeleteArmed(null)}
                                className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteReport(report._id)}
                                disabled={isBusy}
                                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-40"
                              >
                                {isBusy ? 'Deleting…' : 'Confirm'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteArmed(report._id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-rose-400 transition"
                            >
                              <TrashIcon /> Delete report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 pt-2">
        {[
          { label: 'Total', value: counts.total, color: 'text-white' },
          { label: 'Episode', value: counts.episode, color: 'text-sky-400' },
          { label: 'Contact', value: counts.contact, color: 'text-purple-400' },
          { label: 'Pending', value: counts.pending, color: 'text-amber-400' },
          { label: 'Fixed', value: counts.fixed, color: 'text-emerald-400' },
          { label: 'Invalid', value: counts.invalid, color: 'text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 hover:bg-white/[0.05] transition-colors">
            <p className={`text-lg font-semibold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsManager;