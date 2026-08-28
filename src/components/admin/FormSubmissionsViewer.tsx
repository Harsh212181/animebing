 // src/components/admin/FormSubmissionsViewer.tsx
// Google Forms ke "Responses" tab jaisa — table view + CSV export + delete
// Enhanced: sorting, multi-select, bulk delete, column visibility, better UX.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface FormField {
  id: string;
  label: string;
  order: number;
}

interface FormItem {
  _id: string;
  title: string;
  fields: FormField[];
}

interface Answer {
  fieldId: string;
  label: string;
  value: string | string[];
}

interface Submission {
  _id: string;
  answers: Answer[];
  ip?: string;
  submittedAt: string;
}

const formatValue = (v: string | string[]) => Array.isArray(v) ? v.join(', ') : (v ?? '');

// ---------- Helper: relative time ----------
const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ---------- Icons ----------
const SearchIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
  </svg>
);

const DownloadIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
  </svg>
);

const RefreshIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114.5-3.5M20 15a8 8 0 01-14.5 3.5" />
  </svg>
);

const DeleteIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronUpIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ---------- Skeleton ----------
const SkeletonRow = ({ columns }: { columns: number }) => (
  <tr className="border-t border-white/[0.06] animate-pulse">
    <td className="px-4 py-4"><div className="h-3 bg-white/10 rounded w-6" /></td>
    <td className="px-4 py-4"><div className="h-3 bg-white/10 rounded w-20" /></td>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-4"><div className="h-3 bg-white/10 rounded w-28" /></td>
    ))}
    <td className="px-4 py-4"><div className="h-3 bg-white/10 rounded w-8" /></td>
  </tr>
);

// ---------- Main Component ----------
const FormSubmissionsViewer: React.FC<{ token: string; form: FormItem; onBack: () => void }> = ({ token, form, onBack }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Enhanced features
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(form.fields?.map(f => f.id) || [])
  );
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/forms/admin/${form._id}/submissions`, authHeaders());
      setSubmissions(data.submissions || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load responses', {
        style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' },
      });
    } finally {
      setLoading(false);
    }
  }, [form._id, token]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const deleteSubmission = async (subId: string) => {
    if (!confirm('Delete this response? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE}/forms/admin/${form._id}/submissions/${subId}`, authHeaders());
      toast.success('Response deleted', { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
      setSubmissions(prev => prev.filter(s => s._id !== subId));
      setSelectedIds(prev => { const newSet = new Set(prev); newSet.delete(subId); return newSet; });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed', { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected responses?`)) return;
    try {
      // Loop through each id and delete (no bulk endpoint given)
      await Promise.all([...selectedIds].map(id => 
        axios.delete(`${API_BASE}/forms/admin/${form._id}/submissions/${id}`, authHeaders())
      ));
      toast.success(`${selectedIds.size} responses deleted`, { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
      setSubmissions(prev => prev.filter(s => !selectedIds.has(s._id)));
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (e: any) {
      toast.error('Some deletions failed', { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
    }
  };

  const sortedFields = useMemo(() =>
    [...(form.fields || [])].sort((a, b) => a.order - b.order),
  [form.fields]);

  // Toggle column visibility
  const toggleColumnVisibility = (fieldId: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) newSet.delete(fieldId);
      else newSet.add(fieldId);
      return newSet;
    });
  };

  // Sorting logic
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortValue = (submission: Submission, key: string): string | number => {
    if (key === '#') return 0; // placeholder, we sort by index later
    if (key === 'submittedAt') return new Date(submission.submittedAt).getTime();
    if (key === 'ip') return submission.ip || '';
    // key is a fieldId
    const answer = submission.answers.find(a => a.fieldId === key);
    return answer ? formatValue(answer.value).toLowerCase() : '';
  };

  const filteredSubmissions = useMemo(() => {
    let result = [...submissions];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => {
        const fullText = s.answers.map(a => `${a.label} ${formatValue(a.value)}`.toLowerCase()).join(' ');
        return fullText.includes(q);
      });
    }
    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === '#') {
          aVal = submissions.indexOf(a);
          bVal = submissions.indexOf(b);
        } else {
          aVal = getSortValue(a, sortConfig.key);
          bVal = getSortValue(b, sortConfig.key);
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // default: newest first
      result.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }
    return result;
  }, [submissions, search, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / perPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredSubmissions.slice(start, start + perPage);
  }, [filteredSubmissions, page, perPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const exportCSV = () => {
    const headers = ['Submitted At', 'IP', ...sortedFields.filter(f => visibleColumns.has(f.id)).map(f => f.label)];
    const rows = filteredSubmissions.map(s => {
      const answerMap: Record<string, string> = {};
      s.answers.forEach(a => { answerMap[a.fieldId] = formatValue(a.value); });
      return [
        new Date(s.submittedAt).toLocaleString(),
        s.ip || '',
        ...sortedFields.filter(f => visibleColumns.has(f.id)).map(f => `"${(answerMap[f.id] || '').replace(/"/g, '""')}"`)
      ];
    });
    const csv = ['\uFEFF' + headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!', { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
  };

  // Stats
  const totalResponses = submissions.length;
  const lastResponse = submissions.length > 0 ? timeAgo(submissions[0]?.submittedAt || '') : '—';

  // Handle select all checkbox
  const allVisibleSelected = paginated.length > 0 && paginated.every(s => selectedIds.has(s._id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        paginated.forEach(s => newSet.delete(s._id));
        return newSet;
      });
    } else {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        paginated.forEach(s => newSet.add(s._id));
        return newSet;
      });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="py-4 md:py-6 space-y-5 w-full">
      {/* ===== Header Card ===== */}
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] overflow-hidden">
        <div className="p-5 md:p-7">
          {/* Top row */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <button onClick={onBack} className="text-xs text-gray-400 hover:text-white mb-2 flex items-center gap-1.5 transition-colors group">
                <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                Back to forms
              </button>
              <h2 className="text-lg md:text-2xl font-bold text-white truncate">{form.title}</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-0.5">Responses dashboard</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-3.5 py-2 text-xs rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all flex items-center gap-2"
                >
                  <DeleteIcon className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.size})
                </button>
              )}
              <button onClick={fetchSubmissions} className="px-3.5 py-2 text-xs rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border border-white/[0.08] transition-all flex items-center gap-2">
                <RefreshIcon className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button onClick={exportCSV} disabled={filteredSubmissions.length === 0} className="px-3.5 py-2 text-xs rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                <DownloadIcon className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total</p>
              <p className="text-2xl font-bold text-white mt-1">{totalResponses}</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Last Response</p>
              <p className="text-2xl font-bold text-white mt-1">{lastResponse}</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Questions</p>
              <p className="text-2xl font-bold text-white mt-1">{sortedFields.length}</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Filtered</p>
              <p className="text-2xl font-bold text-white mt-1">{filteredSubmissions.length}</p>
            </div>
          </div>

          {/* Search and column visibility */}
          <div className="flex flex-col md:flex-row gap-4 mt-5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search responses..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white">
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Column visibility dropdown */}
              <div className="relative group">
                <button className="px-3.5 py-2 text-xs rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border border-white/[0.08] transition-all flex items-center gap-2">
                  <CheckIcon className="w-3.5 h-3.5" />
                  Columns
                </button>
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1a1a2e] border border-white/[0.08] shadow-2xl z-30 hidden group-hover:block p-2 max-h-60 overflow-y-auto">
                  {sortedFields.map(f => (
                    <label key={f.id} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(f.id)}
                        onChange={() => toggleColumnVisibility(f.id)}
                        className="accent-purple-500"
                      />
                      <span className="truncate">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Table Area ===== */}
      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-gray-400 text-xs">
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap w-8">
                    <div className="h-3 bg-white/10 rounded w-4" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    <div className="h-3 bg-white/10 rounded w-16" />
                  </th>
                  {sortedFields.filter(f => visibleColumns.has(f.id)).map(f => (
                    <th key={f.id} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <div className="h-3 bg-white/10 rounded w-20" />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap w-16">
                    <div className="h-3 bg-white/10 rounded w-8" />
                  </th>
                  <th className="px-4 py-3 text-right font-medium w-8" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <SkeletonRow key={i} columns={sortedFields.filter(f => visibleColumns.has(f.id)).length + 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-16 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-white">
            {search ? 'No matching responses' : 'No responses yet'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">
            {search ? 'Try a different search term.' : 'Share the form link to start collecting responses.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-[#0f0f1a] overflow-hidden shadow-2xl">
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1a1a2e] text-gray-300 uppercase tracking-wider">
                  {/* Checkbox column */}
                  <th className="px-2 py-2.5 text-left font-semibold border-b border-r border-white/[0.08] whitespace-nowrap sticky left-0 bg-[#1a1a2e] z-20 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="accent-purple-500 cursor-pointer"
                    />
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-semibold border-b border-r border-white/[0.08] whitespace-nowrap cursor-pointer hover:bg-white/[0.05] transition-colors"
                    onClick={() => requestSort('submittedAt')}
                  >
                    <div className="flex items-center gap-1">
                      Submitted
                      {sortConfig?.key === 'submittedAt' && (
                        sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  {sortedFields.filter(f => visibleColumns.has(f.id)).map(f => (
                    <th
                      key={f.id}
                      className="px-3 py-2.5 text-left font-semibold border-b border-r border-white/[0.08] whitespace-nowrap cursor-pointer hover:bg-white/[0.05] transition-colors"
                      onClick={() => requestSort(f.id)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{f.label}</span>
                        {sortConfig?.key === f.id && (
                          sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 text-left font-semibold border-b border-r border-white/[0.08] whitespace-nowrap cursor-pointer hover:bg-white/[0.05] transition-colors"
                    onClick={() => requestSort('ip')}
                  >
                    <div className="flex items-center gap-1">
                      IP
                      {sortConfig?.key === 'ip' && (
                        sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold border-b border-white/[0.08] whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, idx) => {
                  const answerMap: Record<string, string> = {};
                  s.answers.forEach(a => { answerMap[a.fieldId] = formatValue(a.value); });
                  const rowIndex = (page - 1) * perPage + idx + 1;
                  const isSelected = selectedIds.has(s._id);
                  return (
                    <tr
                      key={s._id}
                      className={`transition-colors ${
                        idx % 2 === 0 ? 'bg-[#12121f]' : 'bg-[#161625]'
                      } hover:bg-[#1e1e32] ${isSelected ? 'bg-purple-500/10' : ''}`}
                    >
                      <td className="px-2 py-2 text-gray-500 border-b border-r border-white/[0.04] whitespace-nowrap sticky left-0 bg-inherit">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(s._id)}
                          className="accent-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-300 border-b border-r border-white/[0.04] whitespace-nowrap">
                        <span className="block text-[11px] font-medium">{timeAgo(s.submittedAt)}</span>
                        <span className="block text-[10px] text-gray-500">{new Date(s.submittedAt).toLocaleDateString()}</span>
                      </td>
                      {sortedFields.filter(f => visibleColumns.has(f.id)).map(f => (
                        <td key={f.id} className="px-3 py-2 text-gray-200 border-b border-r border-white/[0.04] whitespace-pre-wrap break-words align-top">
                          {answerMap[f.id] ? (
                            <span className="text-[11px]">{answerMap[f.id]}</span>
                          ) : (
                            <span className="text-gray-600 text-[11px]">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-300 border-b border-r border-white/[0.04] whitespace-nowrap align-top">
                        {s.ip || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right border-b border-white/[0.04] whitespace-nowrap">
                        <button
                          onClick={() => deleteSubmission(s._id)}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <DeleteIcon className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ===== Pagination ===== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/[0.06] bg-[#0f0f1a] flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Page {page} of {totalPages}</span>
                <span className="text-gray-600">•</span>
                <span>{filteredSubmissions.length} total</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="ml-2 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value={5} className="bg-[#1a1a2e]">5 / page</option>
                  <option value={10} className="bg-[#1a1a2e]">10 / page</option>
                  <option value={25} className="bg-[#1a1a2e]">25 / page</option>
                  <option value={50} className="bg-[#1a1a2e]">50 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs transition-all ${page === pageNum ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold shadow-md shadow-purple-500/25' : 'bg-white/[0.04] hover:bg-white/[0.1] text-gray-300'}`}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Bulk Delete Confirmation Modal ===== */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Selected Responses?</h3>
            <p className="text-sm text-gray-400 mb-6">
              You are about to delete <span className="font-bold text-white">{selectedIds.size}</span> response(s). This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={bulkDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormSubmissionsViewer;