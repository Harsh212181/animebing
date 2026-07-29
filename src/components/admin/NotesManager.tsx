 // src/components/admin/NotesManager.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface Note {
  _id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  labels: string[];
  checklist?: ChecklistItem[];
  createdBy: string;
  createdByName?: string;
  createdByRole?: 'admin' | 'subadmin';
  createdAt?: string;
  updatedAt?: string;
}

interface NotesManagerProps {
  token: string;
  apiBase: string;
  isSuperAdmin?: boolean;
}

// ── Color palette ──────────────────────────────────────────────────
const COLORS = [
  { name: 'Default', value: '#1c1b29', ring: 'ring-white/20' },
  { name: 'Red',     value: '#4a1e1e', ring: 'ring-red-500/50' },
  { name: 'Orange',  value: '#4a331a', ring: 'ring-orange-500/50' },
  { name: 'Yellow',  value: '#4a441a', ring: 'ring-yellow-500/50' },
  { name: 'Green',   value: '#1e4a2a', ring: 'ring-emerald-500/50' },
  { name: 'Teal',    value: '#1a4a44', ring: 'ring-teal-500/50' },
  { name: 'Blue',    value: '#1a334a', ring: 'ring-blue-500/50' },
  { name: 'Purple',  value: '#2e1a4a', ring: 'ring-purple-500/50' },
  { name: 'Pink',    value: '#4a1a3d', ring: 'ring-pink-500/50' },
];

// ── Icons ──────────────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string; fill?: boolean }> = ({ d, className = 'w-4 h-4', fill = false }) => (
  <svg
    className={className}
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={1.8}
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  pin: 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM12 14v8',
  archive: 'M4 8h16M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8M4 8L6 4h12l2 4M10 12h4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  restore: 'M4 4v5h5M4.5 9A8 8 0 0119 8',
  deleteForever: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  close: 'M6 18L18 6M6 6l12 12',
  palette: 'M12 21a9 9 0 110-18 9 9 0 010 18zM7.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4-4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4 1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm.5 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  checkbox: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
  tag: 'M7 7h.01M3 11V6a3 3 0 013-3h5.172a2 2 0 011.414.586l7.828 7.828a2 2 0 010 2.828l-6.172 6.172a2 2 0 01-2.828 0L3.586 12.414A2 2 0 013 11z',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  check: 'M5 13l4 4L19 7',
  plusSmall: 'M12 4v16m8-8H4',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  emptyTrash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16M9 3h6',
  restoreAll: 'M4 4v5h5M4.5 9A8 8 0 0119 8M19 8v5m0 0h-5m5 0a8 8 0 01-14.5 3',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  admin: 'M12 4l8 4v5c0 5.25-3.13 10.15-8 11.5-4.87-1.35-8-6.25-8-11.5V8l8-4z',
  all: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
};

const StickyNoteIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ── Link preview helpers ────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/i;

const extractFirstUrl = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match) return null;
  return match[0].replace(/[.,)>\]]+$/, ''); // trailing punctuation hata do
};

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  domain: string;
}

// Session ke liye simple in-memory cache — same link baar baar fetch nahi hoga
const linkPreviewCache = new Map<string, LinkPreview | null>();

const LinkPreviewCard: React.FC<{ url: string; apiBase: string; token: string }> = ({ url, apiBase, token }) => {
  const [preview, setPreview] = useState<LinkPreview | null>(linkPreviewCache.get(url) ?? null);
  const [loading, setLoading] = useState(!linkPreviewCache.has(url));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (linkPreviewCache.has(url)) {
      const cached = linkPreviewCache.get(url) ?? null;
      setPreview(cached);
      setFailed(!cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${apiBase}/notes/link-preview`, {
        params: { url },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const p: LinkPreview | null = data.success ? data.preview : null;
        linkPreviewCache.set(url, p);
        setPreview(p);
        setFailed(!p);
      })
      .catch(() => {
        if (cancelled) return;
        linkPreviewCache.set(url, null);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [url, apiBase, token]);

  if (loading) {
    return <div className="mt-1.5 rounded-xl border border-white/10 bg-black/20 h-14 animate-pulse" />;
  }
  if (failed || !preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-1.5 flex items-stretch rounded-xl border border-white/10 bg-black/20 overflow-hidden hover:border-white/25 hover:bg-black/30 transition-all group/link"
    >
      {preview.image && (
        <div className="w-20 sm:w-24 flex-shrink-0 bg-white/5">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center gap-0.5">
        <p className="text-[11px] font-medium text-white/85 line-clamp-1 group-hover/link:text-purple-300 transition-colors">
          {preview.title}
        </p>
        {preview.description && (
          <p className="text-[10px] text-white/45 line-clamp-2">{preview.description}</p>
        )}
        <p className="text-[9px] text-white/30 flex items-center gap-1 mt-0.5">
          <SvgIcon d={ICONS.link} className="w-2.5 h-2.5" />
          {preview.domain}
        </p>
      </div>
    </a>
  );
};

type ViewTab = 'notes' | 'archive' | 'trash';
type CreatorFilter = 'all' | 'admin' | 'subadmin';

// ── Relative time helper ──────────────────────────────────────────
const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const NotesManager: React.FC<NotesManagerProps> = ({ token, apiBase, isSuperAdmin }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>('notes');
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>('all');

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [composerColor, setComposerColor] = useState('#1c1b29');
  const [composerChecklist, setComposerChecklist] = useState<ChecklistItem[]>([]);
  const [composerLabels, setComposerLabels] = useState<string[]>([]);
  const [composerLabelInput, setComposerLabelInput] = useState('');
  const [composerChecklistInput, setComposerChecklistInput] = useState('');
  const [composerShowChecklist, setComposerShowChecklist] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [composerLabelFocused, setComposerLabelFocused] = useState(false);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('#1c1b29');
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editLabelInput, setEditLabelInput] = useState('');
  const [editChecklistInput, setEditChecklistInput] = useState('');
  const [editLabelFocused, setEditLabelFocused] = useState(false);

  const composerRef = useRef<HTMLDivElement>(null);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ── Fetch notes ─────────────────────────────────────────────
  const fetchNotes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = {
        archived: activeView === 'archive' ? 'true' : 'false',
        trashed: activeView === 'trash' ? 'true' : 'false',
      };
      if (search.trim()) params.search = search.trim();
      if (labelFilter) params.label = labelFilter;
      if (creatorFilter !== 'all') params.createdByRole = creatorFilter;

      const { data } = await axios.get(`${apiBase}/notes`, { ...authHeaders, params });
      setNotes(data.notes || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, creatorFilter]);

  useEffect(() => {
    const t = setTimeout(fetchNotes, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, labelFilter]);

  const allLabels = useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach(n => n.labels?.forEach(l => { map[l] = (map[l] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const labelSuggestions = useMemo(() => allLabels.map(([l]) => l), [allLabels]);

  // ── Composer save/reset ─────────────────────────────────────
  const composerHasContent = () =>
    composerTitle.trim() || composerContent.trim() || composerChecklist.length > 0 || composerLabels.length > 0;

  const resetComposer = () => {
    setComposerOpen(false);
    setComposerTitle('');
    setComposerContent('');
    setComposerColor('#1c1b29');
    setComposerChecklist([]);
    setComposerLabels([]);
    setComposerLabelInput('');
    setComposerChecklistInput('');
    setComposerShowChecklist(false);
    setShowColorPicker(null);
  };

  const saveComposerNote = useCallback(async () => {
    if (!composerHasContent()) {
      resetComposer();
      return;
    }
    try {
      await axios.post(
        `${apiBase}/notes`,
        {
          title: composerTitle.trim(),
          content: composerContent.trim(),
          color: composerColor,
          checklist: composerChecklist,
          labels: composerLabels,
        },
        authHeaders
      );
      resetComposer();
      fetchNotes(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerTitle, composerContent, composerColor, composerChecklist, composerLabels]);

  // Click-outside → auto-save composer, Keep-style
  useEffect(() => {
    if (!composerOpen) return;
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        saveComposerNote();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [composerOpen, saveComposerNote]);

  const addComposerChecklistItem = () => {
    if (!composerChecklistInput.trim()) return;
    setComposerChecklist(prev => [...prev, { text: composerChecklistInput.trim(), checked: false }]);
    setComposerChecklistInput('');
  };

  const addComposerLabel = (val?: string) => {
    const v = (val ?? composerLabelInput).trim();
    if (!v || composerLabels.includes(v)) return;
    setComposerLabels(prev => [...prev, v]);
    setComposerLabelInput('');
  };

  // ── Note actions (with undo) ─────────────────────────────────
  const togglePin = async (note: Note) => {
    setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, pinned: !n.pinned } : n)));
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { pinned: !note.pinned }, authHeaders);
    } catch {
      toast.error('Failed to update pin');
      fetchNotes(true);
    }
  };

  const changeColor = async (note: Note, color: string) => {
    setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, color } : n)));
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { color }, authHeaders);
    } catch {
      toast.error('Failed to update color');
      fetchNotes(true);
    }
  };

  const archiveNote = async (note: Note) => {
    const wasArchived = note.archived;
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { archived: !wasArchived }, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            {wasArchived ? 'Unarchived' : 'Archived'}
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.put(`${apiBase}/notes/${note._id}`, { archived: wasArchived }, authHeaders);
                  fetchNotes(true);
                } catch { /* ignore */ }
              }}
              className="text-purple-300 font-semibold hover:text-purple-200"
            >
              UNDO
            </button>
          </span>
        )
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const trashNote = async (note: Note) => {
    try {
      await axios.delete(`${apiBase}/notes/${note._id}`, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            Moved to trash
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.post(`${apiBase}/notes/${note._id}/restore`, {}, authHeaders);
                  fetchNotes(true);
                } catch { /* ignore */ }
              }}
              className="text-purple-300 font-semibold hover:text-purple-200"
            >
              UNDO
            </button>
          </span>
        )
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const restoreNote = async (note: Note) => {
    try {
      await axios.post(`${apiBase}/notes/${note._id}/restore`, {}, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success('Note restored');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const deleteForever = async (note: Note) => {
    if (!confirm('Permanently delete this note? This cannot be undone.')) return;
    try {
      await axios.delete(`${apiBase}/notes/${note._id}/permanent`, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success('Note deleted forever');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const emptyTrash = async () => {
    if (notes.length === 0) return;
    if (!confirm(`Permanently delete all ${notes.length} note(s) in trash? This cannot be undone.`)) return;
    const toastId = toast.loading('Emptying trash...');
    try {
      await Promise.all(notes.map(n => axios.delete(`${apiBase}/notes/${n._id}/permanent`, authHeaders)));
      setNotes([]);
      toast.success('Trash emptied', { id: toastId });
    } catch {
      toast.error('Some notes failed to delete', { id: toastId });
      fetchNotes(true);
    }
  };

  const restoreAll = async () => {
    if (notes.length === 0) return;
    const toastId = toast.loading('Restoring all...');
    try {
      await Promise.all(notes.map(n => axios.post(`${apiBase}/notes/${n._id}/restore`, {}, authHeaders)));
      setNotes([]);
      toast.success('All notes restored', { id: toastId });
    } catch {
      toast.error('Some notes failed to restore', { id: toastId });
      fetchNotes(true);
    }
  };

  const toggleChecklistItem = async (note: Note, index: number) => {
    const updated = [...(note.checklist || [])];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, checklist: updated } : n)));
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { checklist: updated }, authHeaders);
    } catch {
      toast.error('Failed to update checklist');
      fetchNotes(true);
    }
  };

  // ── Edit modal ──────────────────────────────────────────────
  const openEdit = (note: Note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color || '#1c1b29');
    setEditChecklist(note.checklist || []);
    setEditLabels(note.labels || []);
    setEditLabelInput('');
    setEditChecklistInput('');
  };

  const closeEdit = useCallback(async () => {
    if (editingNote) {
      const changed =
        editTitle.trim() !== editingNote.title ||
        editContent.trim() !== editingNote.content ||
        editColor !== editingNote.color ||
        JSON.stringify(editChecklist) !== JSON.stringify(editingNote.checklist || []) ||
        JSON.stringify(editLabels) !== JSON.stringify(editingNote.labels || []);

      if (changed) {
        try {
          const { data } = await axios.put(
            `${apiBase}/notes/${editingNote._id}`,
            {
              title: editTitle.trim(),
              content: editContent.trim(),
              color: editColor,
              checklist: editChecklist,
              labels: editLabels,
            },
            authHeaders
          );
          setNotes(prev => prev.map(n => (n._id === editingNote._id ? { ...n, ...data.note } : n)));
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to save changes');
        }
      }
    }
    setEditingNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNote, editTitle, editContent, editColor, editChecklist, editLabels]);

  // Keyboard shortcuts for edit modal
  useEffect(() => {
    if (!editingNote) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdit();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) closeEdit();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingNote, closeEdit]);

  const addEditChecklistItem = () => {
    if (!editChecklistInput.trim()) return;
    setEditChecklist(prev => [...prev, { text: editChecklistInput.trim(), checked: false }]);
    setEditChecklistInput('');
  };

  const toggleEditChecklistItem = (index: number) => {
    setEditChecklist(prev => prev.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it)));
  };

  const removeEditChecklistItem = (index: number) => {
    setEditChecklist(prev => prev.filter((_, i) => i !== index));
  };

  const addEditLabel = (val?: string) => {
    const v = (val ?? editLabelInput).trim();
    if (!v || editLabels.includes(v)) return;
    setEditLabels(prev => [...prev, v]);
    setEditLabelInput('');
  };

  const removeEditLabel = (label: string) => {
    setEditLabels(prev => prev.filter(l => l !== label));
  };

  // ── Sorting ──────────────────────────────────────────────────
  const pinnedNotes = notes.filter(n => n.pinned);
  const otherNotes = notes.filter(n => !n.pinned);

  const checklistProgress = (checklist?: ChecklistItem[]) => {
    if (!checklist || checklist.length === 0) return null;
    const done = checklist.filter(c => c.checked).length;
    return { done, total: checklist.length };
  };

  // ── Skeleton loader card ────────────────────────────────────
  const SkeletonCard: React.FC<{ h?: number }> = ({ h = 140 }) => (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] mb-4 break-inside-avoid animate-pulse"
      style={{ height: h }}
    />
  );

  // ── Note Card ────────────────────────────────────────────────
  const NoteCard: React.FC<{ note: Note }> = ({ note }) => {
    const progress = checklistProgress(note.checklist);
    return (
      <div
        className="group relative rounded-2xl border border-white/10 p-4 flex flex-col gap-2 break-inside-avoid mb-4 transition-all duration-200 hover:border-white/30 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer"
        style={{ backgroundColor: note.color || '#1c1b29' }}
        onClick={() => activeView === 'notes' && openEdit(note)}
      >
        {/* Pin button */}
        {activeView !== 'trash' && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(note); }}
            className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all z-10 ${
              note.pinned
                ? 'opacity-100 text-amber-300 bg-black/20'
                : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-white hover:bg-black/20'
            }`}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <SvgIcon d={ICONS.pin} className="w-4 h-4" fill={note.pinned} />
          </button>
        )}

        {note.title && <h3 className="text-sm font-semibold text-white pr-6 break-words leading-snug">{note.title}</h3>}
        {note.content && (
          <p className="text-xs text-white/70 whitespace-pre-wrap break-words leading-relaxed line-clamp-[10]">
            {note.content}
          </p>
        )}

        {/* Checklist */}
        {note.checklist && note.checklist.length > 0 && (
          <div className="space-y-1 mt-1">
            {note.checklist.slice(0, 6).map((item, idx) => (
              <label
                key={idx}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-xs cursor-pointer group/item"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecklistItem(note, idx)}
                  className="rounded accent-purple-500 w-3.5 h-3.5"
                />
                <span className={`transition-colors ${item.checked ? 'line-through text-white/30' : 'text-white/80'}`}>
                  {item.text}
                </span>
              </label>
            ))}
            {note.checklist.length > 6 && (
              <p className="text-[10px] text-white/30 pl-5">+{note.checklist.length - 6} more</p>
            )}
            {progress && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400/70 transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-white/30 shrink-0">{progress.done}/{progress.total}</span>
              </div>
            )}
          </div>
        )}

        {/* Labels */}
        {note.labels && note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.labels.map(l => (
              <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Link preview */}
        {(() => {
          const url = extractFirstUrl(note.content) || extractFirstUrl(note.title);
          return url ? <LinkPreviewCard url={url} apiBase={apiBase} token={token} /> : null;
        })()}

        {/* Footer meta row */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Sub‑admin badge — sirf super-admin ko dikhega, sub-admin ko khud pe nahi */}
            {isSuperAdmin && note.createdByRole === 'subadmin' && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
                by {note.createdByName || 'Sub-Admin'}
              </span>
            )}
            <span className="text-[9px] text-white/25 flex items-center gap-1">
              <SvgIcon d={ICONS.clock} className="w-2.5 h-2.5" />
              {timeAgo(note.updatedAt || note.createdAt)}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-1 mt-1 pt-2 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {activeView === 'trash' ? (
            <>
              <button onClick={() => restoreNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-emerald-300 hover:bg-white/10" title="Restore">
                <SvgIcon d={ICONS.restore} className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteForever(note)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10" title="Delete forever">
                <SvgIcon d={ICONS.deleteForever} className="w-3.5 h-3.5" />
              </button>
              <span className="ml-auto text-[9px] text-white/20">Deletes permanently soon</span>
            </>
          ) : (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === note._id ? null : note._id)}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                  title="Change color"
                >
                  <SvgIcon d={ICONS.palette} className="w-3.5 h-3.5" />
                </button>
                {showColorPicker === note._id && (
                  <div className="absolute z-20 top-8 left-0 flex gap-1.5 p-2 rounded-xl bg-[#1a1926] border border-white/10 shadow-xl flex-wrap w-44 animate-[fadeIn_0.15s_ease]">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => { changeColor(note, c.value); setShowColorPicker(null); }}
                        className={`w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 ${note.color === c.value ? 'ring-2 ring-offset-1 ring-offset-[#1a1926] ' + c.ring : ''}`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => archiveNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-blue-300 hover:bg-white/10" title={note.archived ? 'Unarchive' : 'Archive'}>
                <SvgIcon d={ICONS.archive} className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => trashNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10" title="Delete">
                <SvgIcon d={ICONS.trash} className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 px-1" onClick={() => setShowColorPicker(null)}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Notes
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {isSuperAdmin && <span className="text-purple-300/60 ml-1">· showing all admins' notes</span>}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <SvgIcon d={ICONS.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-8 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
            >
              <SvgIcon d={ICONS.close} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* View tabs + Creator filter (combined row) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {(['notes', 'archive', 'trash'] as ViewTab[]).map(v => (
            <button
              key={v}
              onClick={() => { setActiveView(v); setLabelFilter(null); }}
              className={`rounded-xl border px-4 py-2 text-xs font-medium capitalize transition-all ${
                activeView === v
                  ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                  : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Creator filter */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">Created by:</span>
            {(['all', 'admin', 'subadmin'] as CreatorFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setCreatorFilter(f)}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium capitalize transition-all flex items-center gap-1 ${
                  creatorFilter === f
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                    : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                }`}
              >
                {f === 'all' && <SvgIcon d={ICONS.all} className="w-3 h-3" />}
                {f === 'admin' && <SvgIcon d={ICONS.admin} className="w-3 h-3" />}
                {f === 'subadmin' && <SvgIcon d={ICONS.user} className="w-3 h-3" />}
                {f}
              </button>
            ))}
          </div>
        )}

        {activeView === 'trash' && notes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={restoreAll}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
            >
              <SvgIcon d={ICONS.restoreAll} className="w-3.5 h-3.5" />
              Restore all
            </button>
            <button
              onClick={emptyTrash}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20 transition-all"
            >
              <SvgIcon d={ICONS.emptyTrash} className="w-3.5 h-3.5" />
              Empty trash
            </button>
          </div>
        )}
      </div>

      {/* Label filter chips */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <SvgIcon d={ICONS.tag} className="w-3.5 h-3.5 text-white/30" />
          {allLabels.map(([l, count]) => (
            <button
              key={l}
              onClick={() => setLabelFilter(labelFilter === l ? null : l)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                labelFilter === l
                  ? 'border-purple-500/50 bg-purple-500/15 text-purple-200'
                  : 'border-white/10 bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              {l}
              <span className="text-white/30">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      {activeView === 'notes' && (
        <div className="max-w-xl mx-auto sm:mx-0" onClick={(e) => e.stopPropagation()}>
          {!composerOpen ? (
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40 hover:border-white/20 hover:bg-white/[0.05] transition-all flex items-center gap-2"
            >
              <SvgIcon d={ICONS.plus} className="w-4 h-4" />
              Take a note...
            </button>
          ) : (
            <div
              ref={composerRef}
              className="rounded-2xl border border-purple-500/40 p-4 space-y-3 shadow-2xl shadow-purple-900/20 animate-[popIn_0.15s_ease]"
              style={{ backgroundColor: composerColor }}
            >
              <input
                type="text"
                value={composerTitle}
                onChange={e => setComposerTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/30 outline-none"
              />
              <textarea
                value={composerContent}
                onChange={e => setComposerContent(e.target.value)}
                placeholder="Take a note..."
                rows={3}
                className="w-full bg-transparent text-xs text-white/80 placeholder-white/30 outline-none resize-none"
              />

              {composerShowChecklist && (
                <div className="space-y-1.5">
                  {composerChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-white/70">
                      <SvgIcon d={ICONS.check} className="w-3 h-3 text-emerald-400" />
                      <span className="flex-1">{item.text}</span>
                      <button onClick={() => setComposerChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-white/30 hover:text-red-400">
                        <SvgIcon d={ICONS.close} className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <SvgIcon d={ICONS.plusSmall} className="w-3.5 h-3.5 text-white/30" />
                    <input
                      type="text"
                      value={composerChecklistInput}
                      onChange={e => setComposerChecklistInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComposerChecklistItem())}
                      placeholder="List item"
                      autoFocus
                      className="flex-1 bg-transparent text-[11px] text-white/60 placeholder-white/25 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Labels */}
              {composerLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {composerLabels.map(l => (
                    <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                      {l}
                      <button onClick={() => setComposerLabels(prev => prev.filter(x => x !== l))}>
                        <SvgIcon d={ICONS.close} className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={composerLabelInput}
                  onChange={e => setComposerLabelInput(e.target.value)}
                  onFocus={() => setComposerLabelFocused(true)}
                  onBlur={() => setTimeout(() => setComposerLabelFocused(false), 150)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComposerLabel())}
                  placeholder="+ Add label (press Enter)"
                  className="w-full bg-transparent text-[11px] text-white/60 placeholder-white/25 outline-none"
                />
                {composerLabelFocused && composerLabelInput.trim() && (
                  <div className="absolute z-20 top-6 left-0 w-full bg-[#1a1926] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {labelSuggestions
                      .filter(l => l.toLowerCase().includes(composerLabelInput.toLowerCase()) && !composerLabels.includes(l))
                      .slice(0, 5)
                      .map(l => (
                        <button
                          key={l}
                          onMouseDown={() => addComposerLabel(l)}
                          className="block w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
                        >
                          {l}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Toolbar row */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <div className="flex items-center gap-1 pt-2">
                  <button
                    onClick={() => setComposerShowChecklist(v => !v)}
                    className={`p-1.5 rounded-lg transition-colors ${composerShowChecklist ? 'text-emerald-300 bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                    title="Toggle checklist"
                  >
                    <SvgIcon d={ICONS.checkbox} className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === 'composer' ? null : 'composer')}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                      title="Color"
                    >
                      <SvgIcon d={ICONS.palette} className="w-4 h-4" />
                    </button>
                    {showColorPicker === 'composer' && (
                      <div className="absolute z-20 top-9 left-0 flex gap-1.5 p-2 rounded-xl bg-[#1a1926] border border-white/10 shadow-xl flex-wrap w-44 animate-[fadeIn_0.15s_ease]">
                        {COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => { setComposerColor(c.value); setShowColorPicker(null); }}
                            className={`w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 ${composerColor === c.value ? 'ring-2 ring-offset-1 ring-offset-[#1a1926] ' + c.ring : ''}`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={resetComposer} className="px-3 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/5">
                    Cancel
                  </button>
                  <button onClick={saveComposerNote} className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {[180, 120, 220, 140, 160, 100, 200, 130].map((h, i) => <SkeletonCard key={i} h={h} />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-3">
          <StickyNoteIcon className="w-14 h-14" />
          <p className="text-sm">
            {search
              ? 'No notes match your search'
              : activeView === 'trash' ? 'Trash is empty'
              : activeView === 'archive' ? 'No archived notes'
              : 'No notes yet — start typing above'}
          </p>
        </div>
      ) : (
        <>
          {pinnedNotes.length > 0 && activeView === 'notes' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1.5">
                <SvgIcon d={ICONS.pin} className="w-3 h-3" fill /> Pinned
              </p>
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {pinnedNotes.map(n => <NoteCard key={n._id} note={n} />)}
              </div>
            </div>
          )}
          {otherNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && activeView === 'notes' && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2 mt-4">Others</p>
              )}
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {otherNotes.map(n => <NoteCard key={n._id} note={n} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editingNote && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 p-5 space-y-3 shadow-2xl max-h-[85vh] overflow-y-auto animate-[popIn_0.15s_ease]"
            style={{ backgroundColor: editColor }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                className="flex-1 bg-transparent text-base font-semibold text-white placeholder-white/30 outline-none"
              />
              <button onClick={closeEdit} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10">
                <SvgIcon d={ICONS.close} className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sub‑admin badge — sirf super-admin ko dikhega */}
              {isSuperAdmin && editingNote.createdByRole === 'subadmin' && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
                  by {editingNote.createdByName || 'Sub-Admin'}
                </span>
              )}
              <span className="text-[9px] text-white/30 flex items-center gap-1">
                <SvgIcon d={ICONS.clock} className="w-2.5 h-2.5" />
                Edited {timeAgo(editingNote.updatedAt || editingNote.createdAt)}
              </span>
            </div>

            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Note"
              rows={5}
              className="w-full bg-transparent text-sm text-white/85 placeholder-white/30 outline-none resize-none"
            />

            {/* Link preview in edit modal */}
            {(() => {
              const url = extractFirstUrl(editContent) || extractFirstUrl(editTitle);
              return url ? <LinkPreviewCard url={url} apiBase={apiBase} token={token} /> : null;
            })()}

            {/* Checklist */}
            <div className="space-y-1.5">
              {editChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs group/edit">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleEditChecklistItem(idx)}
                    className="rounded accent-purple-500"
                  />
                  <span className={`flex-1 ${item.checked ? 'line-through text-white/30' : 'text-white/80'}`}>{item.text}</span>
                  <button onClick={() => removeEditChecklistItem(idx)} className="text-white/20 group-hover/edit:text-white/50 hover:!text-red-400">
                    <SvgIcon d={ICONS.close} className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <SvgIcon d={ICONS.plusSmall} className="w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={editChecklistInput}
                  onChange={e => setEditChecklistInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditChecklistItem())}
                  placeholder="List item"
                  className="flex-1 bg-transparent text-xs text-white/60 placeholder-white/25 outline-none"
                />
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5 items-center">
                <SvgIcon d={ICONS.tag} className="w-3.5 h-3.5 text-white/30" />
                {editLabels.map(l => (
                  <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                    {l}
                    <button onClick={() => removeEditLabel(l)}>
                      <SvgIcon d={ICONS.close} className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative pl-5">
                <input
                  type="text"
                  value={editLabelInput}
                  onChange={e => setEditLabelInput(e.target.value)}
                  onFocus={() => setEditLabelFocused(true)}
                  onBlur={() => setTimeout(() => setEditLabelFocused(false), 150)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditLabel())}
                  placeholder="+ Add label"
                  className="bg-transparent text-[10px] text-white/60 placeholder-white/25 outline-none w-32"
                />
                {editLabelFocused && editLabelInput.trim() && (
                  <div className="absolute z-20 top-5 left-5 w-40 bg-[#1a1926] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {labelSuggestions
                      .filter(l => l.toLowerCase().includes(editLabelInput.toLowerCase()) && !editLabels.includes(l))
                      .slice(0, 5)
                      .map(l => (
                        <button
                          key={l}
                          onMouseDown={() => addEditLabel(l)}
                          className="block w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
                        >
                          {l}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10 mt-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setEditColor(c.value)}
                  className={`w-6 h-6 mt-2 rounded-full border border-white/20 transition-transform hover:scale-110 ${editColor === c.value ? 'ring-2 ring-offset-1 ' + c.ring : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[9px] text-white/20">Esc to close · Ctrl+Enter to save</p>
              <button onClick={closeEdit} className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesManager;