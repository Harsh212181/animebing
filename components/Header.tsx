  // components/Header.tsx - WITH MOBILE SEARCH ICON
import React, { useState } from 'react';
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

const Header: React.FC<HeaderProps> = ({ onSearchChange, searchQuery, onNavigate, onFilterAndNavigateHome, onContentTypeNavigate }) => {
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
          <button onClick={() => handleNavClick('home')} className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Anime<span className="text-purple-400">bing</span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => handleNavClick('home')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Home</button>
            <button onClick={() => handleFilterClick('Hindi Dub')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Hindi Dub</button>
            <button onClick={() => handleFilterClick('Hindi Sub')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Hindi Sub</button>
            <button onClick={() => handleFilterClick('English Sub')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">English Sub</button>
            <button onClick={() => handleContentTypeClick('Movie')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Movies</button>
            <button onClick={() => handleContentTypeClick('Manga')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Manga</button>
            <button onClick={() => handleNavClick('list')} className="text-slate-300 hover:text-purple-400 transition-colors font-medium">Content List</button>
          </nav>

          {/* ✅ DESKTOP SEARCH BAR - Only visible on md and above */}
          <div className="hidden md:flex items-center relative">
            <input
              type="text"
              placeholder="Search anime/manga..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 transition backdrop-blur-sm"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* ✅ MOBILE: Search Icon and Menu Button */}
          <div className="flex items-center space-x-4 md:hidden">
            {/* Mobile Search Icon */}
            <button 
              onClick={toggleMobileSearch}
              className="text-slate-300 hover:text-purple-400"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            
            {/* Mobile Menu Button */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-300 hover:text-purple-400">
              {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* ✅ MOBILE SEARCH BAR - Shows when search icon is clicked */}
        {isMobileSearchOpen && (
          <div className="md:hidden mt-2 pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search anime/manga..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 transition backdrop-blur-sm"
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

      {/* Mobile Menu - Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-md shadow-lg animate-fade-in-down border-b border-purple-500/20">
          <div className="container mx-auto px-4 pb-4">
            <nav className="flex flex-col pt-2 space-y-1">
              <button onClick={() => handleNavClick('home')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Home</button>
              <button onClick={() => handleFilterClick('Hindi Dub')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Hindi Dub</button>
              <button onClick={() => handleFilterClick('Hindi Sub')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Hindi Sub</button>
              <button onClick={() => handleFilterClick('English Sub')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">English Sub</button>
              <button onClick={() => handleContentTypeClick('Movie')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Movies</button>
              <button onClick={() => handleContentTypeClick('Manga')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Manga</button>
              <button onClick={() => handleNavClick('list')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors font-medium">Content List</button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
