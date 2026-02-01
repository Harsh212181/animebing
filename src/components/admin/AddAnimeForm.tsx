 // src/components/admin/AddAnimeForm.tsx - FULL SCREEN VERSION
import React, { useState } from 'react';
import axios from 'axios';
import type { SubDubStatus } from '../../types';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';
const token = localStorage.getItem('adminToken') || '';

// Genre options array
const GENRE_OPTIONS = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Sci-Fi',
  'Horror',
  'Mystery',
  'Thriller / Psychological',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Mecha',
  'Isekai',
  'Harem',
  'Ecchi',
  'Music',
  'School',
  'Historical'
] as const;

const AddAnimeForm: React.FC = () => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as SubDubStatus,
    genreList: [] as string[],
    status: 'Ongoing',
    contentType: 'Anime' as 'Anime' | 'Movie' | 'Manga',
    
    // SEO FIELDS
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
  const [showGenreSelector, setShowGenreSelector] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      // Prepare form data
      const formData = { ...form };
      
      // Ensure slug is generated properly
      if (!formData.slug || formData.slug.trim() === '') {
        formData.slug = generateSlug(form.title);
      }
      
      // If auto-generate SEO is enabled, generate SEO data from title
      if (autoGenerateSEO && form.title.trim()) {
        // Generate SEO Title
        if (!formData.seoTitle || formData.seoTitle.trim() === '') {
          formData.seoTitle = `Watch ${form.title} Online in ${form.subDubStatus} | AnimeBing`;
        }
        
        // Generate SEO Description
        if (!formData.seoDescription || formData.seoDescription.trim() === '') {
          formData.seoDescription = generateSEODescription(form.title, form.subDubStatus, form.contentType);
        }
        
        // Generate SEO Keywords
        if (!formData.seoKeywords || formData.seoKeywords.trim() === '') {
          formData.seoKeywords = generateSEOKeywords(form.title, form.genreList, form.subDubStatus, form.contentType);
        }
      }
      
      const response = await axios.post(`${API_BASE}/admin/protected/add-anime`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(`Anime added successfully! ✅ Details will appear in Google Search within 24-48 hours.`);
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

  // Function to generate SEO-friendly slug
  const generateSlug = (title: string): string => {
    if (!title.trim()) return '';
    
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Function to generate SEO Description
  const generateSEODescription = (title: string, subDubStatus: string, contentType: string): string => {
    const contentText = contentType === 'Movie' 
      ? 'Full movie available' 
      : contentType === 'Manga'
      ? 'Read manga online'
      : 'All episodes available';
    
    return `Watch ${title} online in ${subDubStatus}. ${contentText} in HD quality. Free streaming and downloads on AnimeBing.`;
  };

  // Function to generate SEO Keywords
  const generateSEOKeywords = (
    title: string, 
    genres: string[], 
    subDubStatus: string, 
    contentType: string
  ): string => {
    const keywords = [];
    
    // Title-based keywords
    keywords.push(
      `${title} anime`,
      `watch ${title} online`,
      `${title} ${subDubStatus.toLowerCase()}`,
      `${title} free download`
    );
    
    // Genre-based keywords
    if (genres && genres.length > 0) {
      genres.forEach((genre: string) => {
        keywords.push(
          `${title} ${genre.toLowerCase()} anime`,
          `${genre.toLowerCase()} anime`,
          `${genre.toLowerCase()} anime in hindi`
        );
      });
    }
    
    // Language/Type based keywords
    const statuses = subDubStatus.toLowerCase().split(',').map(s => s.trim());
    
    if (statuses.includes('hindi dub')) {
      keywords.push(
        'hindi dubbed anime',
        'anime in hindi',
        'hindi dub',
        `${title} hindi dubbed`,
        'watch anime in hindi'
      );
    }
    
    if (statuses.includes('hindi sub')) {
      keywords.push(
        'hindi subbed anime',
        'anime with hindi subtitles',
        'hindi sub',
        `${title} hindi subbed`,
        'hindi subtitles anime'
      );
    }
    
    if (statuses.includes('english sub')) {
      keywords.push(
        'english subbed anime',
        'anime in english',
        'english sub',
        `${title} english sub`,
        'english subtitles anime'
      );
    }
    
    // Content type keywords
    if (contentType === 'Movie') {
      keywords.push(
        `${title} movie`,
        `watch ${title} movie online`,
        `${title} anime movie`,
        'anime movies',
        'full anime movie'
      );
    } else if (contentType === 'Manga') {
      keywords.push(
        `${title} manga`,
        `read ${title} manga online`,
        `${title} manga chapters`,
        'read manga online',
        'manga in hindi'
      );
    } else {
      keywords.push(
        `${title} episodes`,
        `watch ${title} episodes`,
        `${title} all episodes`,
        'anime episodes',
        'hindi dubbed episodes'
      );
    }
    
    // Platform keywords
    keywords.push(
      'animebing',
      'animebing.in',
      'anime streaming site',
      'free anime downloads'
    );
    
    // Remove duplicates and join
    return [...new Set(keywords)].join(', ');
  };

  // Handle genre selection
  const toggleGenre = (genre: string) => {
    if (form.genreList.includes(genre)) {
      // Remove genre if already selected
      setForm({
        ...form,
        genreList: form.genreList.filter(g => g !== genre)
      });
    } else {
      // Add genre if not selected
      setForm({
        ...form,
        genreList: [...form.genreList, genre]
      });
    }
  };

  // Clear all genres
  const clearAllGenres = () => {
    setForm({
      ...form,
      genreList: []
    });
  };

  // Add custom genre
  const addCustomGenre = () => {
    if (customGenre.trim() && !form.genreList.includes(customGenre.trim())) {
      setForm({
        ...form,
        genreList: [...form.genreList, customGenre.trim()]
      });
      setCustomGenre('');
    }
  };

  // Handle Enter key for custom genre
  const handleCustomGenreKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomGenre();
    }
  };

  // Auto-generate SEO fields when title changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setForm({ ...form, title: newTitle });
    
    // Auto-generate SEO fields if autoGenerateSEO is enabled
    if (autoGenerateSEO && newTitle.trim()) {
      const generatedSlug = generateSlug(newTitle);
      
      setForm(prev => ({ 
        ...prev, 
        slug: generatedSlug,
        seoTitle: prev.seoTitle || `Watch ${newTitle} Online in ${prev.subDubStatus} | AnimeBing`,
        seoDescription: prev.seoDescription || generateSEODescription(newTitle, prev.subDubStatus, prev.contentType),
        seoKeywords: prev.seoKeywords || generateSEOKeywords(newTitle, prev.genreList, prev.subDubStatus, prev.contentType)
      }));
    }
  };

  // Auto-generate SEO fields when subDubStatus changes
  const handleSubDubStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as SubDubStatus;
    setForm({ ...form, subDubStatus: newStatus });
    
    if (autoGenerateSEO && form.title.trim()) {
      setForm(prev => ({ 
        ...prev, 
        seoTitle: `Watch ${prev.title} Online in ${newStatus} | AnimeBing`,
        seoDescription: generateSEODescription(prev.title, newStatus, prev.contentType),
        seoKeywords: generateSEOKeywords(prev.title, prev.genreList, newStatus, prev.contentType)
      }));
    }
  };

  // Auto-generate SEO fields when contentType changes
  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newContentType = e.target.value as 'Anime' | 'Movie' | 'Manga';
    setForm({ ...form, contentType: newContentType });
    
    if (autoGenerateSEO && form.title.trim()) {
      setForm(prev => ({ 
        ...prev, 
        seoTitle: `Watch ${prev.title} Online in ${prev.subDubStatus} | AnimeBing`,
        seoDescription: generateSEODescription(prev.title, prev.subDubStatus, newContentType),
        seoKeywords: generateSEOKeywords(prev.title, prev.genreList, prev.subDubStatus, newContentType)
      }));
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 p-4 md:p-6 lg:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Add New Anime</h1>
            <p className="text-slate-400">Fill in all required fields to publish anime to your website</p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-slate-300 text-sm">Auto SEO</p>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateSEO}
                  onChange={() => setAutoGenerateSEO(!autoGenerateSEO)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Basic Information */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-6 pb-3 border-b border-slate-700 flex items-center">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 w-1.5 h-6 mr-3 rounded-full"></span>
                  Basic Information
                </h2>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Title <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={handleTitleChange}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        placeholder="e.g., Naruto Shippuden"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Content Type
                      </label>
                      <select
                        value={form.contentType}
                        onChange={handleContentTypeChange}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      >
                        <option value="Anime">Anime Series</option>
                        <option value="Movie">Movie</option>
                        <option value="Manga">Manga</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition h-32"
                      placeholder="Brief description of the anime..."
                      rows={5}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Thumbnail URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      value={form.thumbnail}
                      onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      placeholder="https://res.cloudinary.com/.../thumbnail.jpg"
                      required
                    />
                    <p className="text-slate-400 text-xs mt-2 flex items-center">
                      <span className="text-yellow-400 mr-1">💡</span>
                      Recommended: Cloudinary URL with optimized image (WebP format, 193x289px)
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Release Year
                      </label>
                      <input
                        type="number"
                        value={form.releaseYear}
                        onChange={(e) => setForm({ ...form, releaseYear: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        min="1900"
                        max="2030"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Sub/Dub Status
                      </label>
                      <select
                        value={form.subDubStatus}
                        onChange={handleSubDubStatusChange}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      >
                        <option value="Hindi Dub">Hindi Dub</option>
                        <option value="Hindi Sub">Hindi Sub</option>
                        <option value="English Sub">English Sub</option>
                        <option value="Both">Both (Hindi Dub & Sub)</option>
                        <option value="Sub & Dub">Sub & Dub Available</option>
                        <option value="Dual Audio">Dual Audio</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Complete">Complete</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Genre Selector - FULL WIDTH */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mb-6">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center">
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 w-1.5 h-6 mr-3 rounded-full"></span>
                      Genres <span className="text-red-400 ml-2">*</span>
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="text-purple-300 font-medium">
                        {form.genreList.length} selected
                      </span>
                      {form.genreList.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllGenres}
                          className="text-sm text-red-400 hover:text-red-300 px-3 py-1 rounded bg-red-900/30 hover:bg-red-900/50 transition"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Selected Genres Preview */}
                  {form.genreList.length > 0 && (
                    <div className="mb-6 p-4 bg-slate-900/30 rounded-lg">
                      <p className="text-slate-300 text-sm font-medium mb-3">Selected Genres:</p>
                      <div className="flex flex-wrap gap-3">
                        {form.genreList.map(genre => (
                          <span
                            key={genre}
                            className={`inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
                              GENRE_OPTIONS.includes(genre as any)
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                                : 'bg-gradient-to-r from-pink-600 to-rose-600'
                            }`}
                          >
                            {genre}
                            <button
                              type="button"
                              onClick={() => toggleGenre(genre)}
                              className="hover:text-red-200 ml-1 text-lg font-bold transition-transform hover:scale-125"
                              title="Remove genre"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Custom Genre Input */}
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Add Custom Genre
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={customGenre}
                        onChange={(e) => setCustomGenre(e.target.value)}
                        onKeyPress={handleCustomGenreKeyPress}
                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        placeholder="Type custom genre (e.g., Martial Arts, Shounen)"
                      />
                      <button
                        type="button"
                        onClick={addCustomGenre}
                        disabled={!customGenre.trim()}
                        className="bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition shadow-lg hover:shadow-purple-500/30 font-medium"
                      >
                        Add Genre
                      </button>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">
                      Custom genres will appear in <span className="text-pink-300">pink color</span>
                    </p>
                  </div>
                  
                  {/* Genre Checkbox Grid - 5 COLUMNS FOR FULL WIDTH */}
                  <div>
                    <p className="text-slate-300 text-sm font-medium mb-4">Popular Genres:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 bg-slate-900/30 rounded-xl">
                      {GENRE_OPTIONS.map(genre => {
                        const isSelected = form.genreList.includes(genre);
                        
                        return (
                          <div
                            key={genre}
                            className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-purple-900/40 to-purple-900/20 border-purple-500 shadow-xl shadow-purple-900/30 scale-[1.02]' 
                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600'
                            }`}
                            onClick={() => toggleGenre(genre)}
                          >
                            <div className={`flex items-center justify-center w-6 h-6 mr-3 rounded border-2 ${
                              isSelected 
                                ? 'bg-purple-500 border-purple-400' 
                                : 'bg-slate-700 border-slate-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-medium ${
                              isSelected ? 'text-white' : 'text-slate-300'
                            }`}>
                              {genre}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Quick Select Buttons */}
                  <div className="mt-8 pt-6 border-t border-slate-700">
                    <p className="text-slate-300 text-sm font-medium mb-4">Quick Select Genre Groups:</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newGenres = ['Action', 'Adventure', 'Fantasy'];
                          setForm(prev => ({
                            ...prev,
                            genreList: [...new Set([...prev.genreList, ...newGenres])]
                          }));
                        }}
                        className="bg-gradient-to-r from-blue-900/40 to-blue-800/40 hover:from-blue-800/60 hover:to-blue-700/60 text-blue-300 hover:text-white text-sm px-4 py-2.5 rounded-lg transition border border-blue-800 hover:border-blue-600"
                      >
                        + Shounen (Action, Adventure, Fantasy)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newGenres = ['Romance', 'Comedy', 'Slice of Life'];
                          setForm(prev => ({
                            ...prev,
                            genreList: [...new Set([...prev.genreList, ...newGenres])]
                          }));
                        }}
                        className="bg-gradient-to-r from-pink-900/40 to-rose-800/40 hover:from-pink-800/60 hover:to-rose-700/60 text-pink-300 hover:text-white text-sm px-4 py-2.5 rounded-lg transition border border-pink-800 hover:border-pink-600"
                      >
                        + Romance (Romance, Comedy, Slice of Life)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newGenres = ['Horror', 'Mystery', 'Thriller / Psychological'];
                          setForm(prev => ({
                            ...prev,
                            genreList: [...new Set([...prev.genreList, ...newGenres])]
                          }));
                        }}
                        className="bg-gradient-to-r from-red-900/40 to-orange-800/40 hover:from-red-800/60 hover:to-orange-700/60 text-red-300 hover:text-white text-sm px-4 py-2.5 rounded-lg transition border border-red-800 hover:border-red-600"
                      >
                        + Horror/Thriller
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newGenres = ['Isekai', 'Fantasy', 'Adventure'];
                          setForm(prev => ({
                            ...prev,
                            genreList: [...new Set([...prev.genreList, ...newGenres])]
                          }));
                        }}
                        className="bg-gradient-to-r from-purple-900/40 to-indigo-800/40 hover:from-purple-800/60 hover:to-indigo-700/60 text-purple-300 hover:text-white text-sm px-4 py-2.5 rounded-lg transition border border-purple-800 hover:border-purple-600"
                      >
                        + Isekai
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - SEO Settings */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-6">
                  <h2 className="text-xl font-bold text-white mb-6 pb-3 border-b border-slate-700 flex items-center">
                    <span className="bg-gradient-to-r from-yellow-500 to-orange-500 w-1.5 h-6 mr-3 rounded-full"></span>
                    SEO Settings
                    <span className="ml-2 text-xs bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-2 py-1 rounded-full">
                      GOOGLE
                    </span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Auto SEO Toggle */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">Auto-Generate SEO</span>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoGenerateSEO}
                            onChange={() => setAutoGenerateSEO(!autoGenerateSEO)}
                            className="sr-only peer"
                          />
                          <div className="relative w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                      <p className="text-slate-400 text-xs">
                        Automatically generate SEO titles, descriptions, and keywords for better Google search results
                      </p>
                    </div>
                    
                    {/* SEO Title */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-yellow-400">🍻</span>
                          SEO Title
                        </span>
                      </label>
                      <textarea
                        value={form.seoTitle}
                        onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition h-24"
                        placeholder="e.g., Watch Naruto Shippuden Online in Hindi Dub | AnimeBing"
                        maxLength={60}
                        rows={3}
                      />
                      <div className="flex justify-between mt-2">
                        <p className="text-slate-400 text-xs">
                          {form.seoTitle.length}/60
                        </p>
                        <p className={`text-xs font-medium ${form.seoTitle.length <= 60 ? 'text-green-400' : 'text-red-400'}`}>
                          {form.seoTitle.length <= 60 ? '✅ Good' : '❌ Too long'}
                        </p>
                      </div>
                    </div>
                    
                    {/* SEO Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-yellow-400">🎗️</span>
                          SEO Description
                        </span>
                      </label>
                      <textarea
                        value={form.seoDescription}
                        onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition h-32"
                        placeholder="e.g., Watch Naruto Shippuden online in Hindi Dub. HD quality streaming and downloads. All episodes available."
                        maxLength={160}
                        rows={4}
                      />
                      <div className="flex justify-between mt-2">
                        <p className="text-slate-400 text-xs">
                          {form.seoDescription.length}/160
                        </p>
                        <p className={`text-xs font-medium ${form.seoDescription.length <= 160 ? 'text-green-400' : 'text-red-400'}`}>
                          {form.seoDescription.length <= 160 ? '✅ Good' : '❌ Too long'}
                        </p>
                      </div>
                    </div>
                    
                    {/* SEO Keywords */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-yellow-400">🦋</span>
                          SEO Keywords
                        </span>
                      </label>
                      <textarea
                        value={form.seoKeywords}
                        onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition h-32"
                        placeholder="e.g., naruto shippuden hindi dub, watch naruto shippuden online, naruto anime in hindi, shounen anime, action anime"
                        rows={4}
                      />
                    </div>
                    
                    {/* URL Slug */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-yellow-400">🔗</span>
                          URL Slug <span className="text-red-400">*</span>
                        </span>
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={form.slug}
                          onChange={(e) => setForm({ ...form, slug: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
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
                          className="bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg transition shadow-md hover:shadow-purple-500/20"
                        >
                          Generate
                        </button>
                      </div>
                      <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-700">
                        <p className="text-slate-400 text-xs font-medium mb-1">Preview URL:</p>
                        <p className="text-purple-300 text-sm font-mono break-all">
                          https://animebing.in/detail/{form.slug || 'your-anime-slug'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Status Card */}
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-800/40 to-slate-900/40 rounded-xl border border-slate-700 p-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-4">🪁</div>
                    <h3 className="text-white font-bold text-xl mb-2">Form Status</h3>
                    <p className="text-slate-300 text-sm">Check if all required fields are filled</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg">
                      <span className="text-slate-300">SEO Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${autoGenerateSEO ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                        {autoGenerateSEO ? 'Auto SEO ✅' : 'Manual SEO ⚠️'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg">
                      <span className="text-slate-300">Google Indexing</span>
                      <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-xs font-medium">
                        24-48 hours
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg">
                      <span className="text-slate-300">Required Fields</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        form.title.trim() && form.slug.trim() && form.genreList.length > 0
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}>
                        {form.title.trim() && form.slug.trim() && form.genreList.length > 0 ? 'Complete ✅' : 'Incomplete ❌'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Add Anime Button at the bottom */}
          <div className="mt-8 pt-8 border-t border-slate-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-gradient-to-r from-purple-900/30 via-pink-900/30 to-slate-900/30 rounded-xl border border-purple-800/50">
              <div className="text-center md:text-left">
                <h3 className="text-white font-bold text-xl mb-2">Ready to Add Anime</h3>
                <p className="text-slate-300 text-sm">Click the button below to add this anime to your database</p>
              </div>
              
              <button
                type="submit"
                disabled={loading || !form.title.trim() || !form.slug.trim() || form.genreList.length === 0}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-12 rounded-xl transition-all duration-300 flex items-center justify-center shadow-xl hover:shadow-2xl hover:shadow-purple-500/30 text-lg group min-w-[200px]"
              >
                {loading ? (
                  <>
                    <Spinner className="inline h-6 w-6 mr-3" />
                    <span className="animate-pulse">Adding...</span>
                  </>
                ) : (
                  <>
                    <span className="mr-3 transform group-hover:scale-110 transition-transform">➕</span>
                    ADD ANIME
                  </>
                )}
              </button>
            </div>
            
            <p className="text-center text-slate-400 text-xs mt-4">
              This anime will be added to your website and submitted to Google Search for indexing
            </p>
          </div>
        </form>
        
        {/* Success/Error Messages */}
        {success && (
          <div className="fixed bottom-6 right-6 max-w-md animate-slide-up">
            <div className="bg-gradient-to-r from-green-900/90 to-emerald-900/90 border border-green-700 rounded-xl p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🎉</div>
                <div>
                  <p className="text-green-400 text-lg font-bold mb-2">Successfully Added!</p>
                  <p className="text-green-300 text-sm mb-3">{success}</p>
                  <div className="p-3 bg-green-900/40 rounded-lg border border-green-800">
                    <p className="text-green-300 text-xs font-medium mb-1">SEO URL Created:</p>
                    <p className="text-green-200 text-sm font-mono break-all">https://animebing.in/detail/{form.slug}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="fixed bottom-6 right-6 max-w-md animate-slide-up">
            <div className="bg-gradient-to-r from-red-900/90 to-orange-900/90 border border-red-700 rounded-xl p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="text-4xl">❌</div>
                <div>
                  <p className="text-red-400 text-lg font-bold mb-2">Error Adding Anime</p>
                  <p className="text-red-300 text-sm">{error}</p>
                  <div className="mt-3 p-3 bg-red-900/40 rounded-lg">
                    <p className="text-red-300 text-xs font-medium">Troubleshooting:</p>
                    <ul className="text-red-300 text-xs list-disc list-inside mt-1 space-y-1">
                      <li>Check if anime title already exists</li>
                      <li>Verify thumbnail URL is valid</li>
                      <li>Ensure you're logged in as admin</li>
                      <li>Check network connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddAnimeForm;