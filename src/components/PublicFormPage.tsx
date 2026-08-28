 // src/components/PublicFormPage.tsx
// Enhanced Public Form Page — polished UI, animations, better UX.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

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

interface FormData {
  _id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

// ---------- Icons ----------
const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ArrowLeftIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const PublicFormPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [shakeFieldId, setShakeFieldId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_BASE}/forms/public/${slug}`);
        setForm(data.form);
      } catch (e: any) {
        setError(e.response?.data?.error || 'Form not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const setValue = (fieldId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    setFieldErrors(prev => ({ ...prev, [fieldId]: false }));
  };

  const toggleCheckbox = (fieldId: string, option: string) => {
    setAnswers(prev => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const next = current.includes(option) ? current.filter(o => o !== option) : [...current, option];
      return { ...prev, [fieldId]: next };
    });
    setFieldErrors(prev => ({ ...prev, [fieldId]: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const errors: Record<string, boolean> = {};
    for (const field of form.fields) {
      if (field.required) {
        const v = answers[field.id];
        const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) errors[field.id] = true;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrorId = Object.keys(errors)[0];
      setShakeFieldId(firstErrorId);
      // remove shake after animation
      setTimeout(() => setShakeFieldId(null), 500);
      const el = document.getElementById(`field-${firstErrorId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(`${API_BASE}/forms/public/${slug}/submit`, { answers });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedFields = useMemo(() => {
    return form ? [...form.fields].sort((a, b) => a.order - b.order) : [];
  }, [form]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-4">
          {/* Skeleton header */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 animate-pulse">
            <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
            <div className="h-4 bg-white/10 rounded w-full" />
          </div>
          {/* Skeleton fields */}
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
              <div className="h-10 bg-white/10 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center backdrop-blur">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-gray-300 text-sm mb-6">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Go Home
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
        </div>
        <div className="relative z-10 max-w-sm w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30 animate-bounce">
            <CheckIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
          <p className="text-sm text-gray-400 mb-6">Your response has been recorded successfully.</p>
          <button
            onClick={() => setSubmitted(false)}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-[#0f0e17] py-10 px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto">
        {/* Header Card */}
        <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-6 mb-6 border-t-4 border-t-purple-500 backdrop-blur-sm shadow-xl animate-fadeIn">
          <h1 className="text-2xl font-bold text-white mb-2">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-gray-400 whitespace-pre-wrap">{form.description}</p>
          )}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              {sortedFields.length} questions
            </span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              * Required
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-sm text-red-300 backdrop-blur-sm animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {sortedFields.map((field, index) => {
            const hasError = fieldErrors[field.id];
            const isShaking = shakeFieldId === field.id;
            return (
              <div
                key={field.id}
                id={`field-${field.id}`}
                className={`bg-white/[0.04] border rounded-2xl p-5 backdrop-blur-sm transition-all duration-300 ${
                  hasError ? 'border-red-500/60 bg-red-500/5' : 'border-white/[0.08] hover:border-white/[0.15]'
                } ${isShaking ? 'animate-shake' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <label className="block text-sm font-medium text-white mb-3">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={(answers[field.id] as string) || ''}
                    onChange={e => setValue(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                )}

                {field.type === 'textarea' && (
                  <div className="relative">
                    <textarea
                      value={(answers[field.id] as string) || ''}
                      onChange={e => setValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      maxLength={500}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all resize-none"
                    />
                    <span className="absolute bottom-2 right-3 text-[10px] text-gray-500">
                      {((answers[field.id] as string) || '').length}/500
                    </span>
                  </div>
                )}

                {field.type === 'email' && (
                  <input
                    type="email"
                    value={(answers[field.id] as string) || ''}
                    onChange={e => setValue(field.id, e.target.value)}
                    placeholder={field.placeholder || 'you@example.com'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={(answers[field.id] as string) || ''}
                    onChange={e => setValue(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    value={(answers[field.id] as string) || ''}
                    onChange={e => setValue(field.id, e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                )}

                {field.type === 'dropdown' && (
                  <select
                    value={(answers[field.id] as string) || ''}
                    onChange={e => setValue(field.id, e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all appearance-none"
                  >
                    <option value="" className="bg-[#13121e]">Select...</option>
                    {(field.options || []).map(opt => (
                      <option key={opt} value={opt} className="bg-[#13121e]">{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === 'radio' && (
                  <div className="space-y-2">
                    {(field.options || []).map(opt => (
                      <label key={opt} className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                        <input
                          type="radio"
                          name={field.id}
                          checked={answers[field.id] === opt}
                          onChange={() => setValue(field.id, opt)}
                          className="sr-only"
                        />
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          answers[field.id] === opt
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-gray-500 group-hover:border-gray-300'
                        }`}>
                          {answers[field.id] === opt && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                        </span>
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {field.type === 'checkbox' && (
                  <div className="space-y-2">
                    {(field.options || []).map(opt => (
                      <label key={opt} className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(opt)}
                          onChange={() => toggleCheckbox(field.id, opt)}
                          className="sr-only"
                        />
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(opt)
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-500 group-hover:border-gray-300'
                        }`}>
                          {Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(opt) && (
                            <CheckIcon className="w-3 h-3 text-white" />
                          )}
                        </span>
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {hasError && <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1">⚠ This field is required</p>}
              </div>
            );
          })}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : 'Submit'}
          </button>
        </form>
      </div>

      {/* Add custom CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default PublicFormPage;