 // src/components/admin/FormBuilderManager.tsx
// Enhanced Form Builder Manager — polished UI, custom dropdown, live preview, better UX.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import FormSubmissionsViewer from './FormSubmissionsViewer';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

type FieldType = 'text' | 'textarea' | 'email' | 'number' | 'date' | 'radio' | 'checkbox' | 'dropdown';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  order: number;
}

interface FormItem {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  fields: FormField[];
  isActive?: boolean;
  submissionCount?: number;
  createdAt?: string;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short Answer',
  textarea: 'Paragraph',
  email: 'Email',
  number: 'Number',
  date: 'Date',
  radio: 'Multiple Choice (single select)',
  checkbox: 'Checkboxes (multi select)',
  dropdown: 'Dropdown',
};

const needsOptions = (t: FieldType) => t === 'radio' || t === 'checkbox' || t === 'dropdown';

const newField = (order: number): FormField => ({
  id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type: 'text',
  label: '',
  required: false,
  options: [],
  order,
});

const PUBLIC_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

// ---------- SVG Icons (no emojis) ----------
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);
const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
);
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
);
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const ArrowUpIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
);
const ArrowDownIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const TextIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" /></svg>
);
const ParagraphIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h16M4 19h10" /></svg>
);
const EmailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);
const NumberIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
);
const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const RadioIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const CheckboxIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const DropdownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <TextIcon />,
  textarea: <ParagraphIcon />,
  email: <EmailIcon />,
  number: <NumberIcon />,
  date: <CalendarIcon />,
  radio: <RadioIcon />,
  checkbox: <CheckboxIcon />,
  dropdown: <DropdownIcon />,
};

// ---------- Custom Dropdown Component ----------
interface CustomDropdownProps {
  value: FieldType;
  onChange: (val: FieldType) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, onChange }) => {
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

  const currentLabel = FIELD_TYPE_LABELS[value];

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white hover:border-purple-500/50 focus:outline-none focus:border-purple-500 transition-all min-w-[180px] justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-gray-400">{FIELD_TYPE_ICONS[value]}</span>
          <span className="truncate">{currentLabel}</span>
        </span>
        <ChevronDownIcon />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
          {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => {
            const isSelected = val === value;
            return (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onChange(val as FieldType);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs text-left transition-colors ${
                  isSelected
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="text-gray-400 flex-shrink-0">{FIELD_TYPE_ICONS[val as FieldType]}</span>
                <span className="flex-1 truncate">{label}</span>
                {isSelected && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FormBuilderManager: React.FC<{ token: string }> = ({ token }) => {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'responses'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [responsesForm, setResponsesForm] = useState<FormItem | null>(null);

  // editor state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [fields, setFields] = useState<FormField[]>([newField(0)]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const authHeaders = useCallback(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/forms/admin/list`, authHeaders());
      setForms(data.forms || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const resetEditor = () => {
    setTitle(''); setDescription(''); setSlug('');
    setFields([newField(0)]);
    setEditingId(null);
    setPreviewOpen(false);
  };

  const startCreate = () => { resetEditor(); setView('edit'); };

  const startEdit = async (id: string) => {
    try {
      const { data } = await axios.get(`${API_BASE}/forms/admin/${id}`, authHeaders());
      const f: FormItem = data.form;
      setEditingId(id);
      setTitle(f.title);
      setDescription(f.description || '');
      setSlug(f.slug);
      setFields(f.fields && f.fields.length ? f.fields : [newField(0)]);
      setView('edit');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load form');
    }
  };

  const openResponses = (f: FormItem) => { setResponsesForm(f); setView('responses'); };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const addField = () => setFields(prev => [...prev, newField(prev.length)]);

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    setFields(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
  };

  const addOption = (idx: number) => {
    setFields(prev => prev.map((f, i) => i === idx
      ? { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] }
      : f));
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setFields(prev => prev.map((f, i) => i === idx
      ? { ...f, options: (f.options || []).map((o, oi) => oi === optIdx ? value : o) }
      : f));
  };

  const removeOption = (idx: number, optIdx: number) => {
    setFields(prev => prev.map((f, i) => i === idx
      ? { ...f, options: (f.options || []).filter((_, oi) => oi !== optIdx) }
      : f));
  };

  const saveForm = async () => {
    if (!title.trim()) { toast.error('Form title is required'); return; }
    if (fields.some(f => !f.label.trim())) { toast.error('Every question needs a label'); return; }
    if (fields.some(f => needsOptions(f.type) && (!f.options || f.options.length === 0))) {
      toast.error('Multiple choice / checkbox / dropdown fields need at least one option');
      return;
    }
    try {
      setSaving(true);
      const payload = { title, description, slug, fields };
      if (editingId) {
        await axios.put(`${API_BASE}/forms/admin/${editingId}`, payload, authHeaders());
        toast.success('Form updated!');
      } else {
        await axios.post(`${API_BASE}/forms/admin/create`, payload, authHeaders());
        toast.success('Form created!');
      }
      setView('list');
      resetEditor();
      fetchForms();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: FormItem) => {
    try {
      await axios.patch(`${API_BASE}/forms/admin/${f._id}/toggle-active`, {}, authHeaders());
      fetchForms();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to toggle');
    }
  };

  const deleteForm = async (f: FormItem) => {
    if (!confirm(`Delete "${f.title}" and all its responses? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE}/forms/admin/${f._id}`, authHeaders());
      toast.success('Form deleted');
      fetchForms();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const copyLink = (f: FormItem) => {
    const link = `${PUBLIC_ORIGIN}/form/${f.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  // ---------- RESPONSES VIEW ----------
  if (view === 'responses' && responsesForm) {
    return (
      <FormSubmissionsViewer
        token={token}
        form={responsesForm}
        onBack={() => { setView('list'); setResponsesForm(null); }}
      />
    );
  }

  // ---------- EDITOR VIEW ----------
  if (view === 'edit') {
    return (
      <div className="p-4 space-y-5 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => { setView('list'); resetEditor(); }} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-1 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to forms
            </button>
            <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Form' : 'Create New Form'}</h2>
          </div>
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border border-white/[0.08] flex items-center gap-2 transition-all"
          >
            <EyeIcon />
            {previewOpen ? 'Close Preview' : 'Preview'}
          </button>
        </div>

        {/* Title/Description/Slug Card */}
        <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Form Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Feedback Survey"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Custom URL Slug (optional)</label>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-gray-600 truncate">{PUBLIC_ORIGIN}/form/</span>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="auto-generated-from-title"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {fields.map((field, idx) => (
            <div key={field.id} className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 space-y-4 hover:border-white/[0.15] transition-all">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 text-gray-500 pt-2">
                  <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="hover:text-white disabled:opacity-30 transition-colors">
                    <ArrowUpIcon />
                  </button>
                  <span className="text-[10px]">{idx + 1}</span>
                  <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="hover:text-white disabled:opacity-30 transition-colors">
                    <ArrowDownIcon />
                  </button>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    value={field.label}
                    onChange={e => updateField(idx, { label: e.target.value })}
                    placeholder={`Question ${idx + 1}`}
                    className="w-full bg-transparent border-b-2 border-white/10 px-1 py-2 text-base font-medium text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <CustomDropdown
                    value={field.type}
                    onChange={(newType) => {
                      updateField(idx, {
                        type: newType,
                        options: needsOptions(newType) ? (field.options?.length ? field.options : ['Option 1']) : undefined,
                      });
                    }}
                  />
                </div>
                <button
                  onClick={() => removeField(idx)}
                  disabled={fields.length === 1}
                  className="text-gray-500 hover:text-red-400 disabled:opacity-30 p-1.5 transition-colors"
                  title="Delete question"
                >
                  <TrashIcon />
                </button>
              </div>

              {!needsOptions(field.type) && (
                <input
                  value={field.placeholder || ''}
                  onChange={e => updateField(idx, { placeholder: e.target.value })}
                  placeholder="Placeholder text (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              )}

              {needsOptions(field.type) && (
                <div className="space-y-2 pl-1">
                  {(field.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className="text-gray-600 text-sm w-5">{field.type === 'checkbox' ? '☐' : '○'}</span>
                      <input
                        value={opt}
                        onChange={e => updateOption(idx, oi, e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                      <button onClick={() => removeOption(idx, oi)} className="text-gray-500 hover:text-red-400 text-xs px-1">✕</button>
                    </div>
                  ))}
                  <button onClick={() => addOption(idx)} className="text-xs text-purple-300 hover:text-purple-200 pl-7 flex items-center gap-1">
                    <PlusIcon /> Add option
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={e => updateField(idx, { required: e.target.checked })}
                    className="accent-purple-500"
                  />
                  Required
                </label>
              </div>
            </div>
          ))}

          <button
            onClick={addField}
            className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm text-gray-400 hover:text-purple-300 hover:border-purple-500/50 transition-all flex items-center justify-center gap-2"
          >
            <PlusIcon />
            Add question
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button
            onClick={() => { setView('list'); resetEditor(); }}
            className="px-5 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveForm}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : editingId ? 'Save Changes' : 'Create Form'}
          </button>
        </div>

        {/* Preview Modal */}
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#0f0e17] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Form Preview</h3>
                <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="bg-white/[0.06] border border-white/[0.1] rounded-xl p-4 border-t-4 border-t-purple-500 mb-4">
                <h2 className="text-xl font-bold text-white">{title || 'Untitled Form'}</h2>
                {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
              </div>
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div key={f.id} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      {f.label || `Question ${idx + 1}`}
                      {f.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {f.type === 'text' && <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg" />}
                    {f.type === 'textarea' && <div className="w-full h-20 bg-white/5 border border-white/10 rounded-lg" />}
                    {f.type === 'email' && <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg" />}
                    {f.type === 'number' && <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg" />}
                    {f.type === 'date' && <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg" />}
                    {f.type === 'dropdown' && (
                      <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between px-3 text-gray-500 text-sm">
                        <span>Select...</span>
                        <ChevronDownIcon />
                      </div>
                    )}
                    {f.type === 'radio' && (
                      <div className="space-y-2">
                        {(f.options || []).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 text-gray-300">
                            <span className="w-4 h-4 rounded-full border border-gray-500"></span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {f.type === 'checkbox' && (
                      <div className="space-y-2">
                        {(f.options || []).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 text-gray-300">
                            <span className="w-4 h-4 rounded-sm border border-gray-500"></span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="p-4 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Forms</h2>
          <p className="text-sm text-gray-400 mt-0.5">Create and manage public forms</p>
        </div>
        <button
          onClick={startCreate}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all"
        >
          <PlusIcon />
          Create Form
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/10 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-white mb-1">No forms yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first form to start collecting responses.</p>
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white"
          >
            Create Form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(f => (
            <div key={f._id} className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 flex flex-wrap items-center gap-4 hover:border-white/[0.15] transition-all">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{f.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${f.isActive !== false ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                    {f.isActive !== false ? 'Active' : 'Closed'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 truncate">
                  /form/{f.slug} · {f.fields?.length || 0} questions · {f.submissionCount || 0} responses
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => copyLink(f)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors flex items-center gap-1.5"
                  title="Copy public link"
                >
                  <CopyIcon />
                  Link
                </button>
                <button
                  onClick={() => openResponses(f)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/20 transition-colors flex items-center gap-1.5"
                >
                  <EyeIcon />
                  Responses
                </button>
                <button
                  onClick={() => startEdit(f._id)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors flex items-center gap-1.5"
                >
                  <EditIcon />
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(f)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                >
                  {f.isActive !== false ? 'Close' : 'Reopen'}
                </button>
                <button
                  onClick={() => deleteForm(f)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5"
                >
                  <TrashIcon />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormBuilderManager;