 // src/components/admin/FormSubmissionsViewer.tsx
// Card-based responses view — no horizontal table scrolling.
// Each response is a vertical card. Pick which fields show in the compact
// preview; tap "expand" on any card to see the FULL response, all fields,
// stacked vertically. Search, sort, bulk delete, CSV export, pagination kept.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
const ChevronDownIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const ChevronUpIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);
const ExpandIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H4v4m16-4h-4v4M4 16v4h4m8 0h4v-4" />
  </svg>
);

// ---------- Custom Checkbox (themed — no native white checkbox) ----------
interface CustomCheckboxProps {
  checked: boolean;
  onChange: () => void;
  title?: string;
}
const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, title }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    title={title}
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center border transition-all duration-150 ${
      checked
        ? 'bg-purple-500 border-purple-500 shadow-sm shadow-purple-500/40'
        : 'bg-white/5 border-white/25 hover:border-purple-400/60'
    }`}
  >
    {checked && <span className="text-white"><CheckIcon className="w-2.5 h-2.5" /></span>}
  </button>
);

// ---------- Fields Picker Dropdown (click to open, not hover — works on mobile too) ----------
interface FieldsPickerDropdownProps {
  fields: FormField[];
  selectedIds: Set<string>;
  onToggle: (fieldId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

const FieldsPickerDropdown: React.FC<FieldsPickerDropdownProps> = ({ fields, selectedIds, onToggle, onSelectAll, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`px-3.5 py-2.5 text-xs rounded-xl border transition-all flex items-center gap-2 whitespace-nowrap ${
          isOpen
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
            : 'bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border-white/[0.08]'
        }`}
      >
        <CheckIcon className="w-3.5 h-3.5" />
        Card Preview Fields
        <span className="px-1.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 text-[10px] font-semibold">
          {selectedIds.size}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl z-30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Show on card</p>
            <div className="flex items-center gap-2">
              <button onClick={onSelectAll} className="text-[10px] text-purple-300 hover:text-purple-200 font-medium">
                Select all
              </button>
              <span className="text-white/10">|</span>
              <button onClick={onClearAll} className="text-[10px] text-gray-400 hover:text-white font-medium">
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {fields.map(f => (
              <label
                key={f.id}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-gray-300 hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
              >
                <CustomCheckbox checked={selectedIds.has(f.id)} onChange={() => onToggle(f.id)} />
                <span className="truncate">{f.label}</span>
              </label>
            ))}
            {fields.length === 0 && (
              <p className="text-xs text-gray-500 px-2.5 py-2">No questions in this form yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Skeleton ----------
const SkeletonCard = () => (
  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-4 h-4 bg-white/10 rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/10 rounded w-1/3" />
        <div className="h-2.5 bg-white/10 rounded w-1/4" />
      </div>
    </div>
  </div>
);

// ---------- Main Component ----------
const FormSubmissionsViewer: React.FC<{ token: string; form: FormItem; onBack: () => void }> = ({ token, form, onBack }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Which fields show directly on the compact card (rest are visible only after expanding)
  const [highlightedFieldIds, setHighlightedFieldIds] = useState<Set<string>>(new Set());
  const highlightedInitialized = React.useRef(false);

  // Cards expanded to show every question/answer for that response
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Only the first few cards show by default; "Show All" reveals the rest of the current page
  const [showAllCards, setShowAllCards] = useState(false);
  const CARDS_PREVIEW_COUNT = 3;

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const sortedFields = useMemo(() =>
    [...(form.fields || [])].sort((a, b) => a.order - b.order),
  [form.fields]);

  // Default: highlight the first 2 questions on the compact card
  useEffect(() => {
    if (!highlightedInitialized.current && sortedFields.length > 0) {
      setHighlightedFieldIds(new Set(sortedFields.slice(0, 2).map(f => f.id)));
      highlightedInitialized.current = true;
    }
  }, [sortedFields]);

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
      setSelectedIds(prev => { const n = new Set(prev); n.delete(subId); return n; });
      setExpandedIds(prev => { const n = new Set(prev); n.delete(subId); return n; });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed', { style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' } });
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected responses?`)) return;
    try {
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

  const toggleHighlighted = (fieldId: string) => {
    setHighlightedFieldIds(prev => {
      const n = new Set(prev);
      if (n.has(fieldId)) n.delete(fieldId); else n.add(fieldId);
      return n;
    });
  };

  const selectAllHighlighted = () => setHighlightedFieldIds(new Set(sortedFields.map(f => f.id)));
  const clearAllHighlighted = () => setHighlightedFieldIds(new Set());

  const filteredSubmissions = useMemo(() => {
    let result = [...submissions];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => {
        const fullText = s.answers.map(a => `${a.label} ${formatValue(a.value)}`.toLowerCase()).join(' ');
        return fullText.includes(q);
      });
    }
    result.sort((a, b) => {
      const diff = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
    return result;
  }, [submissions, search, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / perPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredSubmissions.slice(start, start + perPage);
  }, [filteredSubmissions, page, perPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Collapse back to the preview count whenever the visible dataset changes
  useEffect(() => {
    setShowAllCards(false);
  }, [page, search, sortOrder, perPage]);

  const exportCSV = () => {
    const headers = ['Submitted At', 'IP', ...sortedFields.map(f => f.label)];
    const rows = filteredSubmissions.map(s => {
      const answerMap: Record<string, string> = {};
      s.answers.forEach(a => { answerMap[a.fieldId] = formatValue(a.value); });
      return [
        new Date(s.submittedAt).toLocaleString(),
        s.ip || '',
        ...sortedFields.map(f => `"${(answerMap[f.id] || '').replace(/"/g, '""')}"`)
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

  const totalResponses = submissions.length;
  const lastResponse = submissions.length > 0 ? timeAgo(submissions[0]?.submittedAt || '') : '—';

  const allVisibleSelected = paginated.length > 0 && paginated.every(s => selectedIds.has(s._id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const n = new Set(prev); paginated.forEach(s => n.delete(s._id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); paginated.forEach(s => n.add(s._id)); return n; });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const cardsToRender = showAllCards ? paginated : paginated.slice(0, CARDS_PREVIEW_COUNT);
  const hiddenCardsCount = paginated.length - cardsToRender.length;

  const highlightedFields = useMemo(
    () => sortedFields.filter(f => highlightedFieldIds.has(f.id)),
    [sortedFields, highlightedFieldIds]
  );

  return (
    <div className="py-4 md:py-6 space-y-5 w-full">
      {/* ===== Header Card ===== */}
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] overflow-hidden">
        <div className="p-5 md:p-7">
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

          {/* Search, sort, and preview-field picker */}
          <div className="flex flex-col md:flex-row gap-3 mt-5">
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

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40 cursor-pointer"
            >
              <option value="newest" className="bg-[#1a1a2e]">Newest first</option>
              <option value="oldest" className="bg-[#1a1a2e]">Oldest first</option>
            </select>

            {/* Preview-fields dropdown — pick which questions show directly on each card */}
            <FieldsPickerDropdown
              fields={sortedFields}
              selectedIds={highlightedFieldIds}
              onToggle={toggleHighlighted}
              onSelectAll={selectAllHighlighted}
              onClearAll={clearAllHighlighted}
            />
          </div>

          {/* Select-all row */}
          {!loading && paginated.length > 0 && (
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
              <CustomCheckbox checked={allVisibleSelected} onChange={toggleSelectAll} title="Select all on this page" />
              <span>Select all on this page</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Cards Area ===== */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
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
        <div className="space-y-3">
          {cardsToRender.map(s => {
            const answerMap: Record<string, string> = {};
            s.answers.forEach(a => { answerMap[a.fieldId] = formatValue(a.value); });
            const isSelected = selectedIds.has(s._id);
            const isExpanded = expandedIds.has(s._id);

            return (
              <div
                key={s._id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isSelected ? 'border-purple-500/40 bg-purple-500/[0.06]' : 'border-white/[0.08] bg-[#12121f] hover:border-white/[0.15]'
                }`}
              >
                {/* Compact card row — no side-scrolling, everything wraps vertically */}
                <div className="p-4 flex items-start gap-3">
                  <div className="pt-0.5">
                    <CustomCheckbox checked={isSelected} onChange={() => toggleSelectRow(s._id)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {highlightedFields.length > 0 ? (
                      <div className="space-y-1">
                        {highlightedFields.map(f => (
                          <p key={f.id} className="text-sm text-white truncate">
                            <span className="text-gray-500 text-[11px]">{f.label}: </span>
                            <span className="font-medium">{answerMap[f.id] || '—'}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No preview fields selected — tap expand to view answers.</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      {timeAgo(s.submittedAt)} · {new Date(s.submittedAt).toLocaleDateString()}
                      {s.ip && <> · IP: {s.ip}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(s._id)}
                      className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'text-purple-300 bg-purple-500/15' : 'text-gray-500 hover:text-purple-300 hover:bg-purple-500/10'}`}
                      title={isExpanded ? 'Collapse full response' : 'View full response'}
                    >
                      <ExpandIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSubmission(s._id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded full response — every question stacked vertically, always readable */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] bg-black/10">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-3 mb-2">Full Response</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sortedFields.map(f => (
                        <div key={f.id} className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 truncate">{f.label}</p>
                          <p className="text-xs text-gray-200 whitespace-pre-wrap break-words">
                            {answerMap[f.id] ? answerMap[f.id] : <span className="text-gray-600">—</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ===== Show All / Show Less ===== */}
          {hiddenCardsCount > 0 && (
            <button
              onClick={() => setShowAllCards(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-400 hover:text-purple-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl transition-colors"
            >
              Show All ({hiddenCardsCount} more)
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {showAllCards && paginated.length > CARDS_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllCards(false)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-400 hover:text-purple-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl transition-colors"
            >
              Show Less
              <ChevronUpIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ===== Pagination ===== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2.5 border border-white/[0.08] rounded-xl bg-[#0f0f1a] flex-wrap gap-2">
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