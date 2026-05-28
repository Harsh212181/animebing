 // components/Header.tsx - HOME RESET + SAFE CONTEXT + MUTUAL FILTER RESET
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FilterType, ContentType } from '../src/types';
import { SearchIcon } from './icons/SearchIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';
import axios from 'axios';
import { useAnimeContext } from '../src/context/AnimeContext';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onNavigate: (destination: 'home' | 'list' | 'top100') => void;
  onFilterAndNavigateHome?: (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => void;
  onContentTypeNavigate?: (contentType: ContentType) => void;
}

interface SocialMedia {
  platform: string;
  url: string;
  isActive: boolean;
  icon: string;
  displayName: string;
}

const FALLBACK_SOCIAL_LINKS: SocialMedia[] = [
  {
    platform: 'instagram',
    url: 'https://instagram.com/animebingofficial',
    isActive: true,
    icon: 'instagram',
    displayName: 'Instagram'
  },
  {
    platform: 'telegram',
    url: 'https://t.me/animebingofficial',
    isActive: true,
    icon: 'telegram',
    displayName: 'Telegram'
  },
  {
    platform: 'facebook',
    url: 'https://facebook.com/animebingofficial',
    isActive: true,
    icon: 'facebook',
    displayName: 'Facebook'
  }
];

const Header: React.FC<HeaderProps> = ({ 
  onSearchChange, 
  searchQuery, 
  onNavigate,
  onFilterAndNavigateHome,
  onContentTypeNavigate
}) => {
  // Safe access to AnimeContext (may be undefined if rendered outside provider)
  const animeContext = (() => {
    try {
      return useAnimeContext();
    } catch (e) {
      return null;
    }
  })();
  
  const setFilter = animeContext?.setFilter;
  const setContentType = animeContext?.setContentType;
  
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialMedia[]>(FALLBACK_SOCIAL_LINKS);
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev';

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;
      if (currentScrollY <= 20) {
        setIsHeaderVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }
      if (scrollDelta > 5 && currentScrollY > 30 && isHeaderVisible) {
        setIsHeaderVisible(false);
        if (isMenuOpen) setIsMenuOpen(false);
        if (isMobileSearchOpen) setIsMobileSearchOpen(false);
      } else if (scrollDelta < -5 && !isHeaderVisible) {
        setIsHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeaderVisible, isMenuOpen, isMobileSearchOpen]);

  useEffect(() => {
    setLocalSearchQuery(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/social`, { timeout: 5000 });
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const merged = FALLBACK_SOCIAL_LINKS.map(fallback => {
            const apiLink = response.data.find((item: SocialMedia) => item.platform === fallback.platform && item.isActive);
            return apiLink ? { ...fallback, url: apiLink.url, isActive: true } : fallback;
          });
          setSocialLinks(merged);
        } else {
          setSocialLinks(FALLBACK_SOCIAL_LINKS);
        }
      } catch (error) {
        // keep fallback
      }
    };
    fetchSocialLinks();
  }, []);

  const handleSearchInputChange = useCallback((value: string) => {
    setLocalSearchQuery(value);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }, [onSearchChange]);

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
    searchInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isMobileSearchOpen) setIsMobileSearchOpen(false);
      searchInputRef.current?.blur();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      searchInputRef.current?.blur();
    }
  };

  // ✅ Home button: reset filters + navigate
  const handleNavClick = (destination: 'home' | 'list' | 'top100') => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    if (destination === 'home') {
      // Reset filters to 'All'
      if (setFilter) setFilter('All');
      if (setContentType) setContentType('All');
    }
    
    onNavigate(destination);
    setIsMenuOpen(false);
    setIsMobileSearchOpen(false);
    setTimeout(() => setIsNavigating(false), 800);
  };

  // ✅ Filter button: set filter + RESET content type
  const handleFilterClick = (filter: FilterType) => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    // Mutual reset: language filter always resets content type
    if (setFilter) {
      setFilter(filter);
      if (setContentType) setContentType('All');
    } else if (
      onFilterAndNavigateHome &&
      (filter === 'Hindi Dub' || filter === 'Hindi Sub' || filter === 'English Sub')
    ) {
      onFilterAndNavigateHome(filter);
      // also reset content type via navigation query
      window.location.href = `/?filter=${encodeURIComponent(filter)}&contentType=All`;
    } else {
      // ultimate fallback
      window.location.href = `/?filter=${encodeURIComponent(filter)}&contentType=All`;
    }
    
    setIsMenuOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => setIsNavigating(false), 300);
  };

  // ✅ Content type button: set contentType + RESET filter
  const handleContentTypeClick = (contentType: ContentType) => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    // Mutual reset: content type always resets language filter
    if (setContentType) {
      setContentType(contentType);
      if (setFilter) setFilter('All');
    } else if (onContentTypeNavigate) {
      onContentTypeNavigate(contentType);
      window.location.href = `/?contentType=${encodeURIComponent(contentType)}&filter=All`;
    } else {
      window.location.href = `/?contentType=${encodeURIComponent(contentType)}&filter=All`;
    }
    
    setIsMenuOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => setIsNavigating(false), 300);
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
    setIsMenuOpen(false);
    if (!isMobileSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const SocialIcon = ({ platform, className = "w-5 h-5" }: { platform: string; className?: string }) => {
    switch (platform) {
      case 'facebook':
        return (
          <svg className={className} fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdf497"/>
                <stop offset="30%" stopColor="#fd5949"/>
                <stop offset="60%" stopColor="#d6249f"/>
                <stop offset="100%" stopColor="#285AEB"/>
              </linearGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="url(#instagram-gradient)"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg className={className} fill="#0088CC" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.139l-1.671 7.894c-.236 1.001-.837 1.248-1.697.775l-4.688-3.454-2.26 2.178c-.249.249-.459.459-.935.459l.336-4.773 8.665-5.515c.387-.247.741-.112.45.141l-7.07 6.389-3.073-.967c-1.071-.336-1.092-1.071.223-1.585l12.18-4.692c.892-.336 1.674.223 1.383 1.383z"/>
          </svg>
        );
      default:
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z"/>
          </svg>
        );
    }
  };

  const NavigationLoader = () => (
    isNavigating ? (
      <div className="fixed inset-0 bg-purple-900/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mx-auto mb-4"></div>
          <h3 className="text-white text-xl font-semibold mb-2">Loading animebing.in</h3>
          <p className="text-purple-400">Preparing your content...</p>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <NavigationLoader />
      
      <style>{`
        @keyframes loadingBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-loadingBar { animation: loadingBar 1.5s ease-in-out infinite; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .border-green-custom { border-color: #73F58A; }
        .border-green-custom-30 { border-color: rgba(115, 245, 138, 0.3); }
        .border-green-custom-50 { border-color: rgba(115, 245, 138, 0.5); }
        .border-green-custom-20 { border-color: rgba(115, 245, 138, 0.2); }
        .border-green-custom-70 { border-color: rgba(115, 245, 138, 0.7); }
        .ring-green-custom { --tw-ring-color: #73F58A; }
        .shadow-green-custom { box-shadow: 0 0 0 1px #73F58A; }
        .hover\\:border-green-custom:hover { border-color: #73F58A; }
        .focus\\:ring-green-custom:focus { --tw-ring-color: #73F58A; border-color: #73F58A; }
        .focus\\:border-green-custom:focus { border-color: #73F58A; }
        .glow-green { box-shadow: 0 0 5px rgba(115, 245, 138, 0.3), 0 0 10px rgba(115, 245, 138, 0.1); }
        .hover-glow-green { transition: box-shadow 0.3s ease, transform 0.2s ease; }
        .hover-glow-green:hover { box-shadow: 0 0 10px rgba(115, 245, 138, 0.6), 0 0 20px rgba(115, 245, 138, 0.4), 0 0 30px rgba(115, 245, 138, 0.2); transform: translateY(-2px); }
        .hover-glow-green:active { box-shadow: 0 0 15px rgba(115, 245, 138, 0.8), 0 0 25px rgba(115, 245, 138, 0.6), 0 0 35px rgba(115, 245, 138, 0.4); transform: translateY(0); }
        .search-container { border: 2px solid rgba(115, 245, 138, 0.5); border-radius: 0.75rem; background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); transition: border-color 0.3s ease, box-shadow 0.3s ease; }
        .search-container:hover { border-color: #73F58A; box-shadow: 0 0 15px rgba(115, 245, 138, 0.3); }
        .search-input { border: 1px solid rgba(115, 245, 138, 0.4); transition: all 0.3s ease; }
        .search-input:focus { border: 2px solid #73F58A; box-shadow: 0 0 15px rgba(115, 245, 138, 0.4); }
        .anime-button { border: 1px solid rgba(115, 245, 138, 0.3); transition: all 0.3s ease; }
        .anime-button:hover { border: 1px solid #73F58A; box-shadow: 0 0 10px rgba(115, 245, 138, 0.4); }
        .top100-btn { border: 2px solid rgba(255, 215, 0, 0.6); background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; font-weight: bold; transition: all 0.3s ease; }
        .top100-btn:hover { border: 2px solid #FFD700; box-shadow: 0 0 15px rgba(255, 215, 0, 0.8), 0 0 25px rgba(255, 215, 0, 0.4); transform: translateY(-2px); }
        .top100-btn:active { transform: translateY(0); box-shadow: 0 0 20px rgba(255, 215, 0, 1), 0 0 30px rgba(255, 215, 0, 0.6); }
        .anime-list-btn { border: 2px solid rgba(115, 245, 138, 0.5); background: linear-gradient(135deg, #7c3aed 0%, #10b981 100%); transition: all 0.3s ease; }
        .anime-list-btn:hover { border: 2px solid #73F58A; box-shadow: 0 0 15px rgba(115, 245, 138, 0.6), 0 0 25px rgba(115, 245, 138, 0.4); transform: translateY(-2px); }
        .anime-list-btn:active { transform: translateY(0); box-shadow: 0 0 20px rgba(115, 245, 138, 0.8), 0 0 30px rgba(115, 245, 138, 0.6); }
        .mobile-menu-container { max-height: 85vh; overflow-y: auto; }
        .mobile-menu-container::-webkit-scrollbar { width: 6px; }
        .mobile-menu-container::-webkit-scrollbar-track { background: rgba(115, 245, 138, 0.1); border-radius: 3px; }
        .mobile-menu-container::-webkit-scrollbar-thumb { background: rgba(115, 245, 138, 0.5); border-radius: 3px; }
        .mobile-menu-container::-webkit-scrollbar-thumb:hover { background: rgba(115, 245, 138, 0.7); }
        .social-button-mobile { border: 1px solid rgba(115, 245, 138, 0.3); transition: all 0.3s ease; }
        .social-button-mobile:hover { border: 1px solid #73F58A; box-shadow: 0 0 10px rgba(115, 245, 138, 0.4); }
      `}</style>
      
      <header 
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 glow-green transform ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'} ${isScrolled ? 'bg-purple-900/95 backdrop-blur-xl shadow-lg shadow-black/20 py-2' : 'bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 backdrop-blur-xl py-1'}`}
        style={{ borderBottom: '3px solid #73F58A', boxShadow: '0 4px 20px rgba(115, 245, 138, 0.2)' }}
      >
        <div className="w-full px-2 md:px-4 relative">
          <div className="flex justify-between items-center h-12 md:h-16">
            
            {/* Logo */}
            <button onClick={() => handleNavClick('home')} className="flex items-center space-x-2 group relative anime-button hover-glow-green"
              style={{ border: '2px solid rgba(115, 245, 138, 0.5)', borderRadius: '0.75rem', padding: '0.5rem 1rem', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)' }}
              disabled={isNavigating}
            >
              <span className="text-lg md:text-xl group-hover:scale-110 transition-transform duration-300"
                style={{ fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif', textShadow: '0 0 3px rgba(115, 245, 138, 0.7)', filter: 'drop-shadow(0 0 2px rgba(115, 245, 138, 0.5))' }}>☠️</span>
              <div className="relative">
                <h1 className="relative text-base md:text-xl font-bold tracking-tight">
                  <span className="bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">anime<span className="text-green-400">bing.in</span></span>
                </h1>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-4 bg-purple-800/50 backdrop-blur-sm rounded-lg px-3 py-2 search-container hover-glow-green">
                <button onClick={() => handleNavClick('home')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>Home</button>
                <button onClick={() => handleFilterClick('Hindi Dub')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>Hindi Dub</button>
                <button onClick={() => handleFilterClick('Hindi Sub')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>Hindi Sub</button>
                <button onClick={() => handleFilterClick('English Sub')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>English Sub</button>
                <button onClick={() => handleContentTypeClick('Movie')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>Movies</button>
                <button onClick={() => handleContentTypeClick('Manga')} className="px-3 py-1.5 rounded-md text-purple-300 hover:text-white hover:bg-green-500/20 transition-all duration-300 font-medium text-sm disabled:opacity-50 anime-button" disabled={isNavigating}>Manga</button>
                <button onClick={() => handleNavClick('top100')} className="px-4 py-1.5 rounded-md top100-btn transition-all duration-300 font-bold text-sm disabled:opacity-50" disabled={isNavigating}>Top 100</button>
                <button onClick={() => handleNavClick('list')} className="px-4 py-1.5 rounded-md anime-list-btn text-white transition-all duration-300 font-semibold text-sm disabled:opacity-50" disabled={isNavigating}>Anime List</button>
              </div>
            </nav>

            {/* Desktop Search */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <div className="flex items-center search-container hover-glow-green">
                  <div className="absolute left-3"><SearchIcon className="w-4 h-4 text-green-400" /></div>
                  <input ref={searchInputRef} type="text" placeholder="Search anime/manga..." value={localSearchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)} onKeyDown={handleKeyDown}
                    className="w-48 lg:w-56 bg-transparent text-white placeholder-green-300 text-sm rounded-lg focus:outline-none pl-10 pr-8 py-2 search-input" disabled={isNavigating} />
                  {localSearchQuery && (
                    <button onClick={handleClearSearch} className="absolute right-2 text-green-400 hover:text-white transition-colors p-1 rounded-full bg-green-500/10" type="button" disabled={isNavigating} aria-label="Clear search">
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Controls */}
            <div className="flex md:hidden items-center space-x-2">
              <button onClick={toggleMobileSearch} className="p-2 rounded-lg bg-purple-800/50 text-green-400 hover:text-white hover:bg-green-500/20 disabled:opacity-50 transition-all duration-300 anime-button hover-glow-green" disabled={isNavigating} aria-label="Search">
                <SearchIcon className="w-5 h-5" />
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-lg bg-purple-800/50 text-green-400 hover:text-white hover:bg-green-500/20 disabled:opacity-50 transition-all duration-300 anime-button hover-glow-green" disabled={isNavigating} aria-label="Menu">
                {isMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isMobileSearchOpen && (
            <div className="md:hidden mt-2 pb-3 animate-slideDown">
              <div className="relative">
                <div className="flex items-center search-container hover-glow-green">
                  <div className="absolute left-3"><SearchIcon className="w-5 h-5 text-green-400" /></div>
                  <input ref={searchInputRef} type="text" placeholder="Search anime/manga..." value={localSearchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)} onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-white placeholder-green-300 text-sm rounded-lg focus:outline-none pl-10 pr-16 py-2.5 search-input" autoFocus disabled={isNavigating} />
                  {localSearchQuery && (
                    <button onClick={handleClearSearch} className="absolute right-10 text-green-400 hover:text-white transition-colors p-1 rounded-full bg-green-500/10" type="button" disabled={isNavigating} aria-label="Clear search">
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setIsMobileSearchOpen(false)} className="absolute right-3 text-green-400 hover:text-white transition-colors p-1 rounded-full bg-green-500/10" type="button" disabled={isNavigating} aria-label="Close search">
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 shadow-2xl shadow-black/50 animate-fadeIn glow-green mobile-menu-container"
               style={{ borderTop: '3px solid #73F58A' }}>
            <div className="w-full px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg" style={{ fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif', textShadow: '0 0 3px rgba(115, 245, 138, 0.7)' }}>☠️</span>
                  <h3 className="text-base font-bold text-white"><span className="bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">anime<span className="text-green-400">bing.in</span></span></h3>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-lg bg-purple-800 text-green-400 hover:text-white transition-colors anime-button hover-glow-green">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-2">
                <button onClick={() => handleNavClick('home')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}>
                  <span>Home</span><span className="text-green-400">→</span>
                </button>
                <div className="pt-2">
                  <h4 className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-3 px-1">Languages</h4>
                  <div className="space-y-2">
                    <button onClick={() => handleFilterClick('Hindi Dub')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}><span>Hindi Dub</span><span className="text-green-400">→</span></button>
                    <button onClick={() => handleFilterClick('Hindi Sub')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}><span>Hindi Sub</span><span className="text-green-400">→</span></button>
                    <button onClick={() => handleFilterClick('English Sub')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}><span>English Sub</span><span className="text-green-400">→</span></button>
                  </div>
                </div>
                <div className="pt-2">
                  <h4 className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-3 px-1">Categories</h4>
                  <div className="space-y-2">
                    <button onClick={() => handleContentTypeClick('Movie')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}><span>Movies</span><span className="text-green-400">→</span></button>
                    <button onClick={() => handleContentTypeClick('Manga')} className="w-full px-4 py-3 rounded-lg bg-purple-800/50 text-purple-300 hover:bg-green-500/20 hover:text-white transition-all duration-300 font-medium disabled:opacity-50 anime-button hover-glow-green flex items-center justify-between" disabled={isNavigating}><span>Manga</span><span className="text-green-400">→</span></button>
                  </div>
                </div>
                <div className="pt-2">
                  <button onClick={() => handleNavClick('top100')} className="w-full px-4 py-3 rounded-lg top100-btn text-black transition-all duration-300 font-bold disabled:opacity-50 flex items-center justify-center space-x-2 hover-glow-green" disabled={isNavigating}><span>🔥 Top 100</span><span className="text-lg">🏆</span></button>
                </div>
                <div className="pt-2">
                  <button onClick={() => handleNavClick('list')} className="w-full px-4 py-3 rounded-lg anime-list-btn text-white transition-all duration-300 font-semibold disabled:opacity-50 flex items-center justify-center space-x-2 hover-glow-green" disabled={isNavigating}><span>Anime List</span><span className="text-lg">→</span></button>
                </div>
                <div className="pt-6 border-t border-green-500/30">
                  <h4 className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-3 px-1 text-center">Follow Us</h4>
                  <div className="flex justify-center space-x-4">
                    {socialLinks.map(link => (
                      <button key={link.platform} onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                        className="group bg-purple-800/50 hover:bg-green-500/30 text-green-400 hover:text-white p-3 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-green-500/25 backdrop-blur-sm social-button-mobile"
                        title={`Follow us on ${link.displayName}`}>
                        <SocialIcon platform={link.platform} className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </nav>
              <div className="mt-6 pt-4 border-t border-green-500/20">
                <p className="text-center text-xs text-green-400 font-light">animebing.in © {new Date().getFullYear()}</p>
              </div>
            </div>
          </div>
        )}
      </header>
      <div className="h-12 md:h-16"></div>
    </>
  );
};

export default Header;