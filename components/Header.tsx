 // components/Header.tsx - UPDATED WITH MANGA NAVIGATION
import React, { useState } from 'react';
import type { FilterType, ContentType } from '../src/types';
import { SearchIcon } from './icons/SearchIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';
import AdSlot from './AdSlot';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onNavigate: (destination: 'home' | 'list') => void;
  onFilterAndNavigateHome: (filter: 'Hindi Dub' | 'Hindi Sub') => void;
  onContentTypeNavigate: (contentType: ContentType) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearchChange, searchQuery, onNavigate, onFilterAndNavigateHome, onContentTypeNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (destination: 'home' | 'list') => {
    onNavigate(destination);
    setIsMenuOpen(false);
  };

  const handleFilterClick = (filter: 'Hindi Dub' | 'Hindi Sub') => {
    onFilterAndNavigateHome(filter);
    setIsMenuOpen(false);
  };

  const handleContentTypeClick = (contentType: ContentType) => {
    onContentTypeNavigate(contentType);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-[#0a0c1c]/80 backdrop-blur-lg sticky top-0 z-40 relative">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <button onClick={() => handleNavClick('home')} className="text-2xl font-bold text-white">
            Anim<span className="text-purple-500">abing</span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => handleNavClick('home')} className="text-slate-300 hover:text-purple-400 transition-colors">Home</button>
            <button onClick={() => handleFilterClick('Hindi Dub')} className="text-slate-300 hover:text-purple-400 transition-colors">Hindi Dub</button>
            <button onClick={() => handleFilterClick('Hindi Sub')} className="text-slate-300 hover:text-purple-400 transition-colors">Hindi Sub</button>
            <button onClick={() => handleContentTypeClick('Movie')} className="text-slate-300 hover:text-purple-400 transition-colors">Movies</button>
            <button onClick={() => handleContentTypeClick('Manga')} className="text-slate-300 hover:text-purple-400 transition-colors">Manga</button> {/* ✅ NEW */}
            <button onClick={() => handleNavClick('list')} className="text-slate-300 hover:text-purple-400 transition-colors">Content List</button>
          </nav>

          <div className="hidden md:flex items-center relative">
            <input
              type="text"
              placeholder="Search anime/manga..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 transition"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-300 hover:text-purple-400">
              {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Header Ad Slot */}
        <div className="hidden lg:block w-full max-w-[728px] mx-auto mt-4">
          <AdSlot position="header" />
        </div>
      </div>

      {/* Mobile Menu - Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-[#0a0c1c]/95 backdrop-blur-md shadow-lg animate-fade-in-down">
          <div className="container mx-auto px-4 pb-4">
            <nav className="flex flex-col pt-2 space-y-1">
                <button onClick={() => handleNavClick('home')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Home</button>
                <button onClick={() => handleFilterClick('Hindi Dub')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Hindi Dub</button>
                <button onClick={() => handleFilterClick('Hindi Sub')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Hindi Sub</button>
                <button onClick={() => handleContentTypeClick('Movie')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Movies</button>
                <button onClick={() => handleContentTypeClick('Manga')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Manga</button> {/* ✅ NEW */}
                <button onClick={() => handleNavClick('list')} className="text-left w-full px-3 py-3 rounded-md text-slate-200 hover:bg-purple-700 hover:text-white transition-colors">Content List</button>
            </nav>
            <div className="mt-4 relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 transition"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;