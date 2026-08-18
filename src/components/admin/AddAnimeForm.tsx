 import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import type { SubDubStatus } from '../../types';
import Spinner from '../Spinner';
import { getAdminToken } from '../../../utils/authToken'; // ✅ fresh token per submit

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

// Complete unique genre list (46 genres)
const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Horror',
  'Mystery', 'Thriller', 'Psychological', 'Slice of Life', 'Supernatural', 'Magic',
  'Isekai', 'Mecha', 'Sports', 'Music', 'School', 'Historical', 'Military', 'Samurai',
  'Martial Arts', 'Detective', 'Crime', 'Survival', 'Apocalyptic', 'Cyberpunk',
  'Space', 'Time Travel', 'Vampire', 'Demons', 'Ecchi', 'Harem', 'Reverse Harem',
  'Seinen', 'Shounen', 'Shoujo', 'Josei', 'Parody', 'Idol', 'Cooking', 'Game',
  'Racing', 'Workplace', 'Iyashikei', 'Murim', 'Reincarnation', 'Trap','Vr Game',
] as const;

// ─── 📱🖥️ Auto-resize helper: grows a textarea to fit its content so text
// is never hidden/clipped behind a fixed-height scroll box, on phone or PC.
const useAutoResizeTextArea = (ref: React.RefObject<HTMLTextAreaElement | null>, value: string) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);
};

// =============== CUSTOM SVG ICONS ===============
const Icons = {
  Plus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Title: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3M12 4v16M8 20h8" />
    </svg>
  ),
  Type: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.5" />
      <line x1="8" y1="2" x2="8" y2="22" />
      <line x1="16" y1="2" x2="16" y2="22" />
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="2" y1="16" x2="22" y2="16" />
    </svg>
  ),
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Status: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Description: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  Image: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Genre: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  SEO: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33-1.82 8 8 0 00-14.06 0A1.65 1.65 0 005.6 15" />
      <path d="M12 19v4" />
      <path d="M8 23h8" />
    </svg>
  ),
  Keyword: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78z" />
      <line x1="12" y1="12" x2="21" y2="21" />
    </svg>
  ),
  Slug: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  Generate: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Clear: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  AddCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Info: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1 4 4 1-4 1-1 4-1-4-4-1 4-1z" />
      <path d="M18 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <path d="M6 15l-1 2-2 1 2 1 1 2 1-2 2-1-2-1z" />
    </svg>
  ),
  Eye: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
};

// Helper to get gradient for each genre
const getGenreGradient = (genre: string): string => {
  const colors: Record<string, string> = {
    'Action': 'from-red-500 to-orange-500',
    'Adventure': 'from-emerald-500 to-teal-500',
    'Comedy': 'from-yellow-500 to-amber-500',
    'Drama': 'from-indigo-500 to-purple-500',
    'Fantasy': 'from-fuchsia-500 to-purple-500',
    'Romance': 'from-pink-500 to-rose-500',
    'Sci-Fi': 'from-cyan-500 to-blue-500',
    'Horror': 'from-gray-700 to-red-900',
    'Mystery': 'from-slate-500 to-indigo-500',
    'Thriller': 'from-orange-600 to-red-600',
    'Psychological': 'from-violet-500 to-indigo-500',
    'Slice of Life': 'from-teal-400 to-emerald-400',
    'Supernatural': 'from-purple-600 to-pink-600',
    'Magic': 'from-purple-400 to-fuchsia-400',
    'Isekai': 'from-blue-500 to-purple-500',
    'Mecha': 'from-slate-600 to-blue-700',
    'Sports': 'from-green-500 to-emerald-600',
    'Music': 'from-rose-400 to-pink-500',
    'School': 'from-blue-400 to-cyan-400',
    'Historical': 'from-amber-700 to-yellow-700',
    'Military': 'from-gray-600 to-slate-700',
    'Samurai': 'from-red-800 to-orange-800',
    'Martial Arts': 'from-orange-700 to-red-700',
    'Detective': 'from-slate-600 to-blue-800',
    'Crime': 'from-gray-800 to-red-800',
    'Survival': 'from-green-800 to-emerald-800',
    'Post-Apocalyptic': 'from-gray-800 to-amber-800',
    'Cyberpunk': 'from-cyan-700 to-purple-700',
    'Space': 'from-indigo-700 to-blue-800',
    'Time Travel': 'from-purple-700 to-blue-700',
    'Vampire': 'from-red-800 to-purple-800',
    'Demons': 'from-red-900 to-orange-900',
    'Ecchi': 'from-pink-600 to-red-500',
    'Harem': 'from-pink-500 to-purple-500',
    'Reverse Harem': 'from-purple-500 to-pink-500',
    'Seinen': 'from-gray-700 to-blue-700',
    'Shounen': 'from-orange-500 to-red-500',
    'Shoujo': 'from-pink-400 to-rose-400',
    'Josei': 'from-purple-400 to-pink-400',
    'Parody': 'from-yellow-400 to-orange-400',
    'Idol': 'from-pink-400 to-fuchsia-400',
    'Cooking': 'from-orange-400 to-amber-400',
    'Game': 'from-blue-500 to-cyan-500',
    'Racing': 'from-red-500 to-orange-500',
    'Workplace': 'from-slate-400 to-gray-400',
    'Iyashikei': 'from-emerald-400 to-teal-400',
  };
  return colors[genre] || 'from-purple-500 to-pink-500';
};

// New helper: group content types into SEO categories
const getContentGroup = (contentType: string): 'single' | 'chapter' | 'episode' => {
  switch (contentType) {
    case 'Movie':
    case 'Hollywood Movie':
    case 'Bollywood Movie':
      return 'single';
    case 'Manga':
    case 'Ai Manhwa':
      return 'chapter';
    default: // Anime, Ai Anime, Web Series
      return 'episode';
  }
};

// ============ CUSTOM STYLED DROPDOWN ============
interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  color?: string; // tailwind gradient classes for the dot/badge
}

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
}> = ({ value, onChange, options, icon, label, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-1.5 flexl items-center gap-2">
        {icon}
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full bg-slate-900/80 border text-white rounded-xl px-4 py-3 text-sm text-left transition-all flex items-center justify-between gap-2 ${
          isOpen ? 'border-purple-500/60 ring-2 ring-purple-500/30' : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selected.color} flex-shrink-0`} />}
          <span className="truncate">{selected?.label || 'Select...'}</span>
        </span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 py-1.5 max-h-72 overflow-y-auto animate-fadeIn">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-600/20 text-purple-200' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {opt.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${opt.color} flex-shrink-0`} />}
                  <span className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{opt.label}</span>
                    {opt.hint && <span className="text-[11px] text-slate-500 truncate">{opt.hint}</span>}
                  </span>
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface AddAnimeFormProps {
  token?: string;   // ✅ ADD
}

const AddAnimeForm: React.FC<AddAnimeFormProps> = ({ token: tokenProp }) => {
  // Updated contentType type union
  type ContentType = 'Anime' | 'Ai Anime' | 'Movie' | 'Hollywood Movie' | 'Bollywood Movie' | 'Manga' | 'Ai Manhwa' | 'Web Series';

  const [form, setForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as SubDubStatus,
    genreList: [] as string[],
    status: 'Ongoing',
    contentType: 'Anime' as ContentType,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    slug: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [autoGenerateSEO, setAutoGenerateSEO] = useState(true);
  const [customGenre, setCustomGenre] = useState('');
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [searchGenre, setSearchGenre] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // ✅ New touched states for SEO manual editing detection
  const [seoTitleTouched, setSeoTitleTouched] = useState(false);
  const [seoDescriptionTouched, setSeoDescriptionTouched] = useState(false);
  const [seoKeywordsTouched, setSeoKeywordsTouched] = useState(false);

  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 📱🖥️ Refs for the fields that must auto-grow to show their FULL text
  // (no more clipped 1-2 line boxes that need scrolling — on phone or PC)
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const seoDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const seoKeywordsRef = useRef<HTMLTextAreaElement>(null);
  useAutoResizeTextArea(descriptionRef, form.description);
  useAutoResizeTextArea(seoDescriptionRef, form.seoDescription);
  useAutoResizeTextArea(seoKeywordsRef, form.seoKeywords);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccess(''), 4000);
    }
    return () => { if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current); };
  }, [success]);

  useEffect(() => {
    if (error) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setError(''), 4000);
    }
    return () => { if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); };
  }, [error]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setIsGenreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const token = tokenProp || getAdminToken();   // ✅ updated
      const formData = { ...form };
      if (!formData.slug?.trim()) formData.slug = generateSlug(form.title);
      // If autoGenerateSEO is ON and fields are empty, auto-generate them once more before submit
      if (autoGenerateSEO && form.title.trim()) {
        if (!formData.seoTitle?.trim()) {
          formData.seoTitle = `Watch ${form.title} Online in ${form.subDubStatus} | AnimeBing`;
        }
        if (!formData.seoDescription?.trim()) {
          formData.seoDescription = generateSEODescription(form.title, form.subDubStatus, form.contentType);
        }
        if (!formData.seoKeywords?.trim()) {
          formData.seoKeywords = generateSEOKeywords(form.title, form.genreList, form.subDubStatus, form.contentType);
        }
      }

      await axios.post(`${API_BASE}/admin/add-anime`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Anime added successfully. Details will appear in Google Search within 24-48 hours.`);
      // ✅ Reset touched flags on success
      setSeoTitleTouched(false);
      setSeoDescriptionTouched(false);
      setSeoKeywordsTouched(false);
      
      setForm({
        title: '',
        description: '',
        thumbnail: '',
        releaseYear: new Date().getFullYear(),
        subDubStatus: 'Hindi Sub',
        genreList: [],
        status: 'Ongoing',
        contentType: 'Anime',
        seoTitle: '',
        seoDescription: '',
        seoKeywords: '',
        slug: ''
      });
    } catch (err: any) {
      console.error('Error adding anime:', err);
      setError(err.response?.data?.error || 'Failed to add anime. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string): string => {
    if (!title.trim()) return '';
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };

  const generateSEODescription = (title: string, subDubStatus: string, contentType: string): string => {
    const group = getContentGroup(contentType);
    let contentText;
    if (group === 'single') contentText = 'Full movie available';
    else if (group === 'chapter') contentText = 'Read online in HD quality';
    else contentText = 'All episodes available';
    return `Watch ${title} online in ${subDubStatus}. ${contentText} on AnimeBing. Free streaming and downloads.`;
  };

  const generateSEOKeywords = (title: string, genres: string[], subDubStatus: string, contentType: string): string => {
    const keywords = [];
    keywords.push(`${title} anime`, `watch ${title} online`, `${title} ${subDubStatus.toLowerCase()}`, `${title} free download`);
    genres.forEach(g => keywords.push(`${title} ${g.toLowerCase()} anime`, `${g.toLowerCase()} anime`, `${g.toLowerCase()} anime in hindi`));
    const statuses = subDubStatus.toLowerCase().split(',').map(s => s.trim());
    if (statuses.includes('hindi dub')) keywords.push('hindi dubbed anime', 'anime in hindi', 'hindi dub', `${title} hindi dubbed`, 'watch anime in hindi');
    if (statuses.includes('hindi sub')) keywords.push('hindi subbed anime', 'anime with hindi subtitles', 'hindi sub', `${title} hindi subbed`, 'hindi subtitles anime');
    if (statuses.includes('english sub')) keywords.push('english subbed anime', 'anime in english', 'english sub', `${title} english sub`, 'english subtitles anime');
    
    const group = getContentGroup(contentType);
    if (group === 'single') {
      keywords.push(`${title} movie`, `watch ${title} movie online`, `${title} full movie`, 'movies online', 'full movie download');
    } else if (group === 'chapter') {
      keywords.push(`${title} manga`, `read ${title} online`, `${title} chapters`, 'read manga online', 'manga chapters');
    } else {
      keywords.push(`${title} episodes`, `watch ${title} episodes`, `${title} all episodes`, 'anime episodes', 'hindi dubbed episodes');
    }
    
    keywords.push('animebing', 'animebing.in', 'anime streaming site', 'free anime downloads');
    return [...new Set(keywords)].join(', ');
  };

  // ===== HANDLERS WITH TOUCH FLAG LOGIC =====

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setForm(prev => ({
      ...prev,
      title: newTitle,
      slug: autoGenerateSEO ? generateSlug(newTitle) : prev.slug,
      seoTitle: (autoGenerateSEO && !seoTitleTouched)
        ? `Watch ${newTitle} Online in ${prev.subDubStatus} | AnimeBing`
        : prev.seoTitle,
      seoDescription: (autoGenerateSEO && !seoDescriptionTouched)
        ? generateSEODescription(newTitle, prev.subDubStatus, prev.contentType)
        : prev.seoDescription,
      seoKeywords: (autoGenerateSEO && !seoKeywordsTouched)
        ? generateSEOKeywords(newTitle, prev.genreList, prev.subDubStatus, prev.contentType)
        : prev.seoKeywords,
    }));
  };

  const handleSubDubStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as SubDubStatus;
    setForm(prev => ({
      ...prev,
      subDubStatus: newStatus,
      seoTitle: (autoGenerateSEO && !seoTitleTouched && prev.title.trim())
        ? `Watch ${prev.title} Online in ${newStatus} | AnimeBing`
        : prev.seoTitle,
      seoDescription: (autoGenerateSEO && !seoDescriptionTouched && prev.title.trim())
        ? generateSEODescription(prev.title, newStatus, prev.contentType)
        : prev.seoDescription,
      seoKeywords: (autoGenerateSEO && !seoKeywordsTouched && prev.title.trim())
        ? generateSEOKeywords(prev.title, prev.genreList, newStatus, prev.contentType)
        : prev.seoKeywords,
    }));
  };

  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newContentType = e.target.value as ContentType;
    setForm(prev => ({
      ...prev,
      contentType: newContentType,
      seoTitle: (autoGenerateSEO && !seoTitleTouched && prev.title.trim())
        ? `Watch ${prev.title} Online in ${prev.subDubStatus} | AnimeBing`
        : prev.seoTitle,
      seoDescription: (autoGenerateSEO && !seoDescriptionTouched && prev.title.trim())
        ? generateSEODescription(prev.title, prev.subDubStatus, newContentType)
        : prev.seoDescription,
      seoKeywords: (autoGenerateSEO && !seoKeywordsTouched && prev.title.trim())
        ? generateSEOKeywords(prev.title, prev.genreList, prev.subDubStatus, newContentType)
        : prev.seoKeywords,
    }));
  };

  const toggleGenre = (genre: string) => {
    setForm(prev => {
      const newGenreList = prev.genreList.includes(genre)
        ? prev.genreList.filter(g => g !== genre)
        : [...prev.genreList, genre];
      return {
        ...prev,
        genreList: newGenreList,
        seoKeywords: (autoGenerateSEO && !seoKeywordsTouched && prev.title.trim())
          ? generateSEOKeywords(prev.title, newGenreList, prev.subDubStatus, prev.contentType)
          : prev.seoKeywords,
      };
    });
  };

  const clearAllGenres = () => {
    setForm(prev => ({
      ...prev,
      genreList: [],
      seoKeywords: (autoGenerateSEO && !seoKeywordsTouched && prev.title.trim())
        ? generateSEOKeywords(prev.title, [], prev.subDubStatus, prev.contentType)
        : prev.seoKeywords,
    }));
  };

  const addCustomGenre = () => {
    if (customGenre.trim() && !form.genreList.includes(customGenre.trim())) {
      setForm(prev => {
        const newGenreList = [...prev.genreList, customGenre.trim()];
        return {
          ...prev,
          genreList: newGenreList,
          seoKeywords: (autoGenerateSEO && !seoKeywordsTouched && prev.title.trim())
            ? generateSEOKeywords(prev.title, newGenreList, prev.subDubStatus, prev.contentType)
            : prev.seoKeywords,
        };
      });
      setCustomGenre('');
    }
  };

  const handleCustomGenreKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomGenre(); }
  };

  const filteredGenres = GENRE_OPTIONS.filter(g => g.toLowerCase().includes(searchGenre.toLowerCase()));

  const isFormValid = form.title.trim() && form.slug.trim() && form.genreList.length > 0 && form.thumbnail.trim();

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6 lg:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Icons.Plus className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Add New <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Anime</span>
              </h1>
            </div>
            <p className="text-slate-400 text-sm ml-13">Fill in the details below to publish new content to your website</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-300 text-sm font-medium">Auto SEO</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateSEO}
                onChange={() => setAutoGenerateSEO(!autoGenerateSEO)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-pink-500"></div>
            </label>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${autoGenerateSEO ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/40 text-amber-300'}`}>
              {autoGenerateSEO ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* ===== FORM (FULL WIDTH) ===== */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* BASIC INFORMATION – Thumbnail Preview now inside */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-5 md:p-6 transition-all duration-300 hover:border-slate-600/50">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-700/50">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
              <h2 className="text-lg font-semibold text-white">Basic Information</h2>
              <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">Required</span>
            </div>

            <div className="space-y-4">
              {/* Title — counter no longer overlaps the text (extra right padding) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flexl items-center gap-2">
                  <Icons.Title className="w-4 h-4 text-slate-400" />
                  Title <span className="text-red-400">*</span>
                </label>
                <div className={`relative transition-all duration-200 rounded-xl ${focusedField === 'title' ? 'ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10' : ''}`}>
                  <input
                    type="text"
                    value={form.title}
                    onChange={handleTitleChange}
                    onFocus={() => setFocusedField('title')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl pl-4 pr-14 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-500"
                    placeholder='e.g., "Naruto Shippuden"'
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                    {form.title.length > 0 && <span className="text-slate-400">{form.title.length}</span>}
                  </div>
                </div>
              </div>

              {/* Content Type & Year & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <CustomSelect
                  label="Type"
                  icon={<Icons.Type className="w-4 h-4 text-slate-400" />}
                  value={form.contentType}
                  onChange={(v) => handleContentTypeChange({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
                  options={[
                    { value: 'Anime', label: 'Anime Series', color: 'from-blue-500 to-cyan-500' },
                    { value: 'Ai Anime', label: 'Ai Anime',color: 'from-violet-500 to-fuchsia-500' },
                    { value: 'Movie', label: 'Movie',color: 'from-purple-500 to-pink-500' },
                    { value: 'Hollywood Movie', label: 'Hollywood Movie', color: 'from-amber-500 to-orange-500' },
                    { value: 'Bollywood Movie', label: 'Bollywood Movie', color: 'from-red-500 to-rose-500' },
                    { value: 'Manga', label: 'Manga', color: 'from-emerald-500 to-teal-500' },
                    { value: 'Ai Manhwa', label: 'Ai Manhwa', color: 'from-fuchsia-500 to-purple-500' },
                    { value: 'Web Series', label: 'Web Series', color: 'from-indigo-500 to-blue-500' },
                  ]}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5 flexl items-center gap-2">
                    <Icons.Calendar className="w-4 h-4 text-slate-400" />
                    Year
                  </label>
                  <input
                    type="number"
                    value={form.releaseYear}
                    onChange={(e) => setForm({ ...form, releaseYear: Number(e.target.value) })}
                    className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    min="1900"
                    max="2030"
                    required
                  />
                </div>
                <CustomSelect
                  label="Status"
                  icon={<Icons.Status className="w-4 h-4 text-slate-400" />}
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                    { value: 'Ongoing', label: 'Ongoing', color: 'from-yellow-500 to-orange-500' },
                    { value: 'Complete', label: 'Complete', color: 'from-green-500 to-emerald-500' },
                  ]}
                />
              </div>

              {/* Sub/Dub */}
              <CustomSelect
                label="Sub / Dub Status"
                icon={<Icons.Info className="w-4 h-4 text-slate-400" />}
                value={form.subDubStatus}
                onChange={(v) => handleSubDubStatusChange({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
                options={[
                  { value: 'Hindi Dub', label: 'Hindi Dub', color: 'from-red-500 to-orange-500' },
                  { value: 'Hindi Sub', label: 'Hindi Sub', color: 'from-orange-500 to-amber-500' },
                  { value: 'English Sub', label: 'English Sub', color: 'from-blue-500 to-cyan-500' },
                  { value: 'Both', label: 'Both (Hindi Dub & Sub)', color: 'from-purple-500 to-pink-500' },
                  { value: 'Sub & Dub', label: 'Sub & Dub Available', color: 'from-violet-500 to-purple-500' },
                  { value: 'Dual Audio', label: 'Dual Audio', color: 'from-indigo-500 to-blue-500' },
                ]}
              />

              {/* Thumbnail Preview + Description — stacked on phone, side-by-side on larger screens.
                  Description box now auto-grows to fit ALL the text, no more hidden/clipped lines. */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flexl items-center gap-2">
                  <Icons.Description className="w-4 h-4 text-slate-400" />
                  Description <span className="text-slate-500 text-xs font-normal">(optional)</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-normal hidden sm:inline">Box grows to show full text</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Thumbnail Preview — fixed size, matches poster ratio, centered on phone */}
                  <div className="flex-shrink-0 self-center sm:self-start">
                    <div className="relative bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700/30 w-[100px] h-[150px]">
                      {form.thumbnail ? (
                        <img
                          src={form.thumbnail}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800';
                              fallback.innerHTML = `
                                <svg class="w-6 h-6 text-slate-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span class="text-slate-400 text-[9px]">No Image</span>
                              `;
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-700/50 to-slate-800/50">
                          <Icons.Image className="w-6 h-6 text-slate-500 mb-1 opacity-40" />
                          <span className="text-slate-400 text-[9px]">No thumb</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Description — auto-resizing textarea, full width on phone */}
                  <textarea
                    ref={descriptionRef}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full sm:flex-1 bg-slate-900/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none overflow-hidden placeholder:text-slate-500 min-h-[150px]"
                    placeholder="Write a brief description of the anime..."
                    rows={5}
                  />
                </div>
              </div>

              {/* Thumbnail URL input — icon padding fixed so text/checkmark never overlaps */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flexl items-center gap-2">
                  <Icons.Image className="w-4 h-4 text-slate-400" />
                  Thumbnail URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={form.thumbnail}
                    onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                    className={`w-full bg-slate-900/80 border ${form.thumbnail ? 'border-emerald-500/50' : 'border-slate-700'} text-white rounded-xl pl-11 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500`}
                    placeholder="https://res.cloudinary.com/.../thumbnail.jpg"
                    title={form.thumbnail}
                    required
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Image className="w-4 h-4" />
                  </div>
                  {form.thumbnail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Icons.CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1">
                  <Icons.Info className="w-3 h-3 text-yellow-400" />
                  Recommended: Cloudinary URL (WebP, 193×289px) — tap/hover the field to see the full link
                </p>
              </div>
            </div>
          </div>

          {/* GENRE SELECTOR */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-5 md:p-6 transition-all duration-300 hover:border-slate-600/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-fuchsia-500 to-pink-500"></div>
                <h2 className="text-lg font-semibold text-white">Genres</h2>
                <span className="text-red-400">*</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-purple-300 font-medium bg-purple-900/30 px-3 py-1 rounded-full border border-purple-800/30">
                  {form.genreList.length} selected
                </span>
                {form.genreList.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllGenres}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded-full bg-red-900/20 hover:bg-red-900/40 transition-all border border-red-800/20 hover:border-red-700/30 flex items-center gap-1"
                  >
                    <Icons.Clear className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Selected Genres Preview — wraps freely, every chip shows its full label */}
            {form.genreList.length > 0 && (
              <div className="mb-5 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <p className="text-slate-400 text-xs font-medium mb-2.5 flex items-center gap-2">
                  <span>Selected Genres</span>
                  <span className="w-8 h-px bg-slate-700"></span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.genreList.map(genre => (
                    <span
                      key={genre}
                      className={`inline-flex items-center gap-1.5 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-lg bg-gradient-to-r ${getGenreGradient(genre)} transition-all hover:scale-105 hover:shadow-xl max-w-full`}
                    >
                      <span className="break-words">{genre}</span>
                      <button
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className="hover:text-white/70 ml-0.5 text-sm font-bold transition-transform hover:scale-125 flex-shrink-0"
                        title="Remove genre"
                      >
                        <Icons.X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Genre Input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flexl items-center gap-1">
                <Icons.AddCircle className="w-3 h-3" />
                Add Custom Genre
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  onKeyPress={handleCustomGenreKeyPress}
                  className="flex-1 bg-slate-900/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500"
                  placeholder="Type custom genre..."
                />
                <button
                  type="button"
                  onClick={addCustomGenre}
                  disabled={!customGenre.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 flex items-center justify-center gap-1"
                >
                  <Icons.AddCircle className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Genre Search & Grid — 1 column on very small phones so long names never get cramped */}
            <div>
              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchGenre}
                  onChange={(e) => setSearchGenre(e.target.value)}
                  onFocus={() => setIsGenreDropdownOpen(true)}
                  placeholder="Search genres..."
                  className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icons.Search className="w-4 h-4" />
                </div>
              </div>

              <div
                ref={genreDropdownRef}
                className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-3 bg-slate-900/30 rounded-xl border border-slate-700/30 transition-all duration-300 ${isGenreDropdownOpen || searchGenre ? 'opacity-100' : 'opacity-90'}`}
              >
                {filteredGenres.length > 0 ? (
                  filteredGenres.map(genre => {
                    const isSelected = form.genreList.includes(genre);
                    const gradient = getGenreGradient(genre);
                    return (
                      <div
                        key={genre}
                        className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-all duration-200 border-2 ${isSelected
                            ? `bg-gradient-to-r ${gradient} border-transparent shadow-lg shadow-purple-500/20`
                            : 'bg-slate-800/40 border-slate-700 hover:bg-slate-700/40 hover:border-slate-600'
                          }`}
                        onClick={() => toggleGenre(genre)}
                      >
                        <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 mr-2 rounded-md border-2 transition-all ${isSelected
                            ? 'bg-white/20 border-white/40'
                            : 'bg-slate-700 border-slate-600'
                          }`}>
                          {isSelected && <Icons.Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-xs font-medium leading-tight break-words ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {genre}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-6 text-slate-500 text-sm">
                    No genres found matching "{searchGenre}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEO SETTINGS */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-5 md:p-6 transition-all duration-300 hover:border-slate-600/50">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-700/50">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-orange-500"></div>
              <h2 className="text-lg font-semibold text-white">SEO Settings</h2>
              <span className="ml-auto text-[10px] font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-1">
                <Icons.Sparkles className="w-3 h-3" />
                Google
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 flex items-center justify-between">
                <div>
                  <span className="text-white text-sm font-medium flex items-center gap-2">
                    <Icons.Sparkles className="w-4 h-4 text-amber-400" />
                    Auto-Generate SEO
                  </span>
                  <p className="text-slate-400 text-xs mt-0.5">Automatically create titles, descriptions & keywords</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateSEO}
                    onChange={() => setAutoGenerateSEO(!autoGenerateSEO)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-orange-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 flex flex-wrap items-center gap-2">
                    <Icons.Title className="w-3 h-3" />
                    SEO Title
                    {seoTitleTouched && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">Manual</span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${form.seoTitle.length <= 60 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {form.seoTitle.length}/60
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={(e) => { setForm({ ...form, seoTitle: e.target.value }); setSeoTitleTouched(true); }}
                    className={`w-full bg-slate-900/80 border ${form.seoTitle.length <= 60 ? 'border-slate-700' : 'border-red-500/50'} text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-slate-500`}
                    placeholder="Watch Naruto Shippuden Online..."
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 flex flex-wrap items-center gap-2">
                    <Icons.Description className="w-3 h-3" />
                    SEO Description
                    {seoDescriptionTouched && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">Manual</span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${form.seoDescription.length <= 160 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {form.seoDescription.length}/160
                    </span>
                  </label>
                  {/* Auto-resizing textarea — full description always visible, no scroll needed */}
                  <textarea
                    ref={seoDescriptionRef}
                    value={form.seoDescription}
                    onChange={(e) => { setForm({ ...form, seoDescription: e.target.value }); setSeoDescriptionTouched(true); }}
                    className={`w-full bg-slate-900/80 border ${form.seoDescription.length <= 160 ? 'border-slate-700' : 'border-red-500/50'} text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-slate-500 resize-none overflow-hidden min-h-[44px]`}
                    placeholder="Watch Naruto Shippuden online in Hindi Dub..."
                    maxLength={160}
                    rows={1}
                  />
                </div>
              </div>

              {/* SEO Keywords — auto-resizing textarea with Regenerate button */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flexl items-center gap-2">
                  <Icons.Keyword className="w-3 h-3" />
                  SEO Keywords
                  {seoKeywordsTouched && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">Manual</span>
                  )}
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                  <textarea
                    ref={seoKeywordsRef}
                    value={form.seoKeywords}
                    onChange={(e) => { setForm({ ...form, seoKeywords: e.target.value }); setSeoKeywordsTouched(true); }}
                    className="flex-1 bg-slate-900/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-slate-500 resize-none overflow-hidden min-h-[44px]"
                    placeholder="naruto shippuden hindi dub, watch naruto online..."
                    rows={1}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const regenerated = generateSEOKeywords(form.title, form.genreList, form.subDubStatus, form.contentType);
                      setForm(prev => ({ ...prev, seoKeywords: regenerated }));
                      setSeoKeywordsTouched(false);
                    }}
                    disabled={!form.title.trim()}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-all text-sm font-medium shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    <Icons.Generate className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* URL Slug */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flexl items-center gap-2">
                  <Icons.Slug className="w-3 h-3" />
                  URL Slug
                  <span className="text-red-400 text-xs">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="flex-1 bg-slate-900/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500 font-mono"
                    placeholder="naruto-shippuden-hindi-dub"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (form.title.trim()) {
                        const newSlug = generateSlug(form.title);
                        setForm(prev => ({ ...prev, slug: newSlug }));
                      }
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 flex items-center justify-center gap-1"
                  >
                    <Icons.Generate className="w-4 h-4" />
                    Generate
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-900/60 rounded-xl border border-slate-700/30">
                  <p className="text-slate-400 text-xs flex flex-wrap items-center gap-2">
                    <Icons.Slug className="w-3 h-3" />
                    <span>Preview:</span>
                    <span className="text-purple-300 font-mono text-xs break-all">
                      https://animebing.in/detail/{form.slug || 'your-anime-slug'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FORM STATUS */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50 px-4 py-3 transition-all duration-300">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Status</span>

              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${form.title.trim() ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`text-xs ${form.title.trim() ? 'text-slate-300' : 'text-slate-500'}`}>Title</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${form.slug.trim() ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`text-xs ${form.slug.trim() ? 'text-slate-300' : 'text-slate-500'}`}>Slug</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${form.genreList.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`text-xs ${form.genreList.length > 0 ? 'text-slate-300' : 'text-slate-500'}`}>Genres</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${form.thumbnail.trim() ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`text-xs ${form.thumbnail.trim() ? 'text-slate-300' : 'text-slate-500'}`}>Thumbnail</span>
              </div>

              <span className="w-px h-4 bg-slate-700 hidden sm:block" />

              <span className="text-slate-500 text-xs">SEO: {autoGenerateSEO ? 'Auto' : 'Manual'}</span>
              <span className="text-slate-500 text-xs">Indexing: 24-48h</span>

              <span
                className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-md border ${
                  isFormValid
                    ? 'text-emerald-300 border-emerald-800/40 bg-emerald-900/20'
                    : 'text-amber-300 border-amber-800/40 bg-amber-900/20'
                }`}
              >
                {isFormValid ? 'Ready to publish' : 'Incomplete'}
              </span>
            </div>
          </div>

          {/* SUBMIT */}
          <div className="mt-2 pt-4 border-t border-slate-700/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-slate-900/20 rounded-2xl border border-purple-800/30">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Icons.Sparkles className="w-5 h-5 text-purple-400" />
                  Ready to Publish
                </h3>
                <p className="text-slate-400 text-sm">Your content will go live immediately</p>
              </div>
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-12 rounded-xl transition-all duration-300 flex items-center justify-center shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 text-base group min-w-[200px]"
              >
                {loading ? (
                  <>
                    <Spinner className="inline h-5 w-5 mr-2" />
                    <span className="animate-pulse">Adding...</span>
                  </>
                ) : (
                  <>
                    <Icons.Plus className="w-5 h-5 mr-2 transform group-hover:scale-110 transition-transform" />
                    ADD ANIME
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-slate-500 text-xs mt-3 flex items-center justify-center gap-1">
              <Icons.Info className="w-3 h-3" />
              This anime will be added to your website and submitted to Google Search for indexing
            </p>
          </div>
        </form>

        {/* ===== TOASTS ===== */}
        {success && (
          <div className="fixed bottom-6 right-6 max-w-md animate-slide-up z-50">
            <div className="bg-gradient-to-br from-emerald-900/95 to-green-900/95 backdrop-blur-md border border-emerald-700/60 rounded-2xl p-6 shadow-2xl shadow-emerald-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Icons.CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-300 text-lg font-bold mb-1">Successfully Added!</p>
                  <p className="text-emerald-200/80 text-sm mb-3">{success}</p>
                  <div className="p-3 bg-emerald-900/40 rounded-xl border border-emerald-800/40">
                    <p className="text-emerald-300/70 text-xs font-medium flex items-center gap-1">
                      <Icons.Slug className="w-3 h-3" />
                      SEO URL Created:
                    </p>
                    <p className="text-emerald-200 text-sm font-mono break-all">
                      https://animebing.in/detail/{form.slug || '...'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSuccess('')}
                  className="text-emerald-400/60 hover:text-emerald-300 transition-colors flex-shrink-0"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-6 right-6 max-w-md animate-slide-up z-50">
            <div className="bg-gradient-to-br from-red-900/95 to-orange-900/95 backdrop-blur-md border border-red-700/60 rounded-2xl p-6 shadow-2xl shadow-red-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Icons.AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-red-300 text-lg font-bold mb-1">Error Adding Anime</p>
                  <p className="text-red-200/80 text-sm">{error}</p>
                  <div className="mt-3 p-3 bg-red-900/40 rounded-xl border border-red-800/40">
                    <p className="text-red-300/70 text-xs font-medium">Troubleshooting:</p>
                    <ul className="text-red-200/70 text-xs list-disc list-inside mt-1 space-y-0.5">
                      <li>Check if anime title already exists</li>
                      <li>Verify thumbnail URL is valid</li>
                      <li>Ensure you're logged in as admin</li>
                      <li>Check network connection</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => setError('')}
                  className="text-red-400/60 hover:text-red-300 transition-colors flex-shrink-0"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default AddAnimeForm;