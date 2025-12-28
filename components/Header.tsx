  // components/Header.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FilterType, ContentType } from '../src/types';
import { SearchIcon } from './icons/SearchIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onNavigate: (destination: 'home' | 'list') => void;
  onFilterAndNavigateHome: (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => void;
  onContentTypeNavigate: (contentType: ContentType) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  onSearchChange, 
  searchQuery, 
  onNavigate, 
  onFilterAndNavigateHome, 
  onContentTypeNavigate 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize local state from prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery || '');
  }, [searchQuery]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Debounced search function
  const handleSearchInputChange = useCallback((value: string) => {
    setLocalSearchQuery(value);
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout for debouncing
    debounceTimeoutRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300); // 300ms debounce for smooth typing
  }, [onSearchChange]);

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
    
    // Focus back to input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isMobileSearchOpen) {
        setIsMobileSearchOpen(false);
      }
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    }
  };

  const handleNavClick = (destination: 'home' | 'list') => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    if (destination === 'list') {
      onNavigate('list');
    } else {
      onNavigate('home');
    }
    setIsMenuOpen(false);
    setTimeout(() => setIsNavigating(false), 800);
  };

  const handleFilterClick = (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    window.location.href = `${window.location.origin}/?filter=${encodeURIComponent(filter)}`;
    setIsMenuOpen(false);
    
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const handleContentTypeClick = (contentType: ContentType) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    window.location.href = `${window.location.origin}/?contentType=${encodeURIComponent(contentType)}`;
    setIsMenuOpen(false);
    
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const toggleMobileSearch = () => {
    const newState = !isMobileSearchOpen;
    setIsMobileSearchOpen(newState);
    setIsMenuOpen(false);
    
    // Focus the input when opening mobile search
    if (newState) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  };

  const NavigationLoader = () => (
    isNavigating ? (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h3 className="text-white text-xl font-semibold mb-2">Loading animebing.in</h3>
          <p className="text-slate-400">Preparing your content...</p>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <NavigationLoader />
      
      <header className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-lg sticky top-0 z-40 border-b border-purple-500/20">
        <div className="container mx-auto px-2 md:px-3">
          <div className="flex justify-between items-center h-12 md:h-16">
            <button 
              onClick={() => handleNavClick('home')} 
              className="text-base md:text-xl font-bold text-white flex items-center"
              disabled={isNavigating}
            >
              {/* Skull emoji with decreased size */}
              <span 
                className="text-lg md:text-xl mr-1" // Changed from text-xl md:text-2xl to text-lg md:text-xl
                style={{
                  fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif',
                  textShadow: '0 0 1px rgba(255,255,255,0.5)',
                  filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.3))'
                }}
              >
                ☠️
              </span>
              <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                anime<span className="text-purple-400">bing.in</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-4">
              <button 
                onClick={() => handleNavClick('home')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Home
              </button>
              <button 
                onClick={() => handleFilterClick('Hindi Dub')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Hindi Dub
              </button>
              <button 
                onClick={() => handleFilterClick('Hindi Sub')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Hindi Sub
              </button>
              <button 
                onClick={() => handleFilterClick('English Sub')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                English Sub
              </button>
              <button 
                onClick={() => handleContentTypeClick('Movie')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Movies
              </button>
              <button 
                onClick={() => handleContentTypeClick('Manga')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Manga
              </button>
              <button 
                onClick={() => handleNavClick('list')} 
                className="text-slate-300 hover:text-purple-400 transition-colors font-medium disabled:opacity-50"
                disabled={isNavigating}
              >
                Anime List
              </button>
            </nav>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex items-center relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search anime/manga..."
                  value={localSearchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-64 pl-10 pr-10 p-2.5 transition backdrop-blur-sm"
                  disabled={isNavigating}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <SearchIcon className="w-5 h-5 text-slate-400" />
                </div>
                
                {/* Clear button - shows when there's text */}
                {localSearchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white transition-colors"
                    type="button"
                    disabled={isNavigating}
                    aria-label="Clear search"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: Search Icon and Menu Button */}
            <div className="flex items-center md:hidden">
              {/* Mobile Search Icon - increased size */}
              <button 
                onClick={toggleMobileSearch}
                className="text-slate-300 hover:text-purple-400 disabled:opacity-50 p-1"
                disabled={isNavigating}
              >
                <SearchIcon className="w-5 h-5" /> {/* Changed from w-4 h-4 to w-5 h-5 */}
              </button>
              
              {/* Mobile Menu Button - increased size */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="text-slate-300 hover:text-purple-400 disabled:opacity-50 p-1 ml-1"
                disabled={isNavigating}
              >
                {isMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />} {/* Changed from w-4 h-4 to w-5 h-5 */}
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isMobileSearchOpen && (
            <div className="md:hidden mt-2 pb-4">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search anime/manga..."
                  value={localSearchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 pr-10 p-2.5 transition backdrop-blur-sm"
                  autoFocus
                  disabled={isNavigating}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <SearchIcon className="w-5 h-5 text-slate-400" />
                </div>
                
                {/* Clear button - shows when there's text */}
                {localSearchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-10 flex items-center pr-3 text-slate-400 hover:text-white transition-colors"
                    type="button"
                    disabled={isNavigating}
                    aria-label="Clear search"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                )}
                
                {/* Close mobile search button */}
                <button
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                  type="button"
                  disabled={isNavigating}
                  aria-label="Close search"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu - Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-md shadow-lg animate-fade-in-down border-b border-purple-500/20">
            <div className="container mx-auto px-4 pb-4">
              <nav className="flex flex-col pt-2 space-y-1">
                <button 
                  onClick={() => handleNavClick('home')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Home
                </button>
                <button 
                  onClick={() => handleFilterClick('Hindi Dub')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Hindi Dub
                </button>
                <button 
                  onClick={() => handleFilterClick('Hindi Sub')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Hindi Sub
                </button>
                <button 
                  onClick={() => handleFilterClick('English Sub')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  English Sub
                </button>
                <button 
                  onClick={() => handleContentTypeClick('Movie')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Movies
                </button>
                <button 
                  onClick={() => handleContentTypeClick('Manga')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Manga
                </button>
                <button 
                  onClick={() => handleNavClick('list')} 
                  className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium disabled:opacity-50"
                  disabled={isNavigating}
                >
                  Anime List
                </button>
              </nav>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;
