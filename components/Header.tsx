  // components/Header.tsx — FINAL STABLE VERSION
import React, { useState } from 'react';
import type { ContentType } from '../src/types';
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

  const handleNavClick = (destination: 'home' | 'list') => {
    onNavigate(destination);
    setIsMenuOpen(false);
  };

  const handleFilterClick = (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => {
    onFilterAndNavigateHome(filter);
    setIsMenuOpen(false);
  };

  const handleContentTypeClick = (contentType: ContentType) => {
    onContentTypeNavigate(contentType);
    setIsMenuOpen(false);
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-lg sticky top-0 z-40 relative border-b border-purple-500/20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">

          {/* LOGO */}
          <button
            onClick={() => handleNavClick('home')}
            className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
          >
            Anime<span className="text-purple-400">bing</span>
          </button>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => handleNavClick('home')} className="header-btn">Home</button>
            <button onClick={() => handleFilterClick('Hindi Dub')} className="header-btn">Hindi Dub</button>
            <button onClick={() => handleFilterClick('Hindi Sub')} className="header-btn">Hindi Sub</button>
            <button onClick={() => handleFilterClick('English Sub')} className="header-btn">English Sub</button>
            <button onClick={() => handleContentTypeClick('Movie')} className="header-btn">Movies</button>
            <button onClick={() => handleContentTypeClick('Manga')} className="header-btn">Manga</button>
            <button onClick={() => handleNavClick('list')} className="header-btn">Content List</button>
          </nav>

          {/* DESKTOP SEARCH BAR */}
          <div className="hidden md:flex items-center relative">
            <input
              type="text"
              placeholder="Search anime/manga..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* MOBILE: SEARCH ICON + MENU ICON */}
          <div className="flex items-center space-x-4 md:hidden">
            <button onClick={toggleMobileSearch} className="text-slate-300 hover:text-purple-400">
              <SearchIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-300 hover:text-purple-400"
            >
              {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* MOBILE SEARCH BAR */}
        {isMobileSearchOpen && (
          <div className="md:hidden mt-2 pb-4 animate-fade-in">
            <div className="relative">
              <input
                type="text"
                placeholder="Search anime/manga..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                autoFocus
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon className="w-5 h-5 text-slate-400" />
              </div>
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-b border-purple-500/20 shadow-lg animate-fade-in-down">
          <div className="container mx-auto px-4 pb-4">
            <nav className="flex flex-col pt-2 space-y-1">
              <button onClick={() => handleNavClick('home')} className="mobile-btn">Home</button>
              <button onClick={() => handleFilterClick('Hindi Dub')} className="mobile-btn">Hindi Dub</button>
              <button onClick={() => handleFilterClick('Hindi Sub')} className="mobile-btn">Hindi Sub</button>
              <button onClick={() => handleFilterClick('English Sub')} className="mobile-btn">English Sub</button>
              <button onClick={() => handleContentTypeClick('Movie')} className="mobile-btn">Movies</button>
              <button onClick={() => handleContentTypeClick('Manga')} className="mobile-btn">Manga</button>
              <button onClick={() => handleNavClick('list')} className="mobile-btn">Content List</button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
