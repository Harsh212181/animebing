 // App.tsx - ADS REMOVED + FIXED SEARCH RELOAD ISSUE + REMOVED SECRET CODE CONSOLE LOGS + GA4 ANALYTICS FIX
// ✅ ALL ADS-RELATED CODE REMOVED
// ✅ SECRET CODE TYPING LOGS REMOVED
// ✅ GA4 ANALYTICS ADDED - UTM FIXED

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { Anime, FilterType, ContentType, ContentTypeFilter } from './src/types';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import AnimeListPage from './components/AnimeListPage';
import AnimeDetailPage from './components/AnimeDetailPage';
import DownloadRedirectPage from './components/DownloadRedirectPage';
import ScrollToTopButton from './components/ScrollToTopButton';
import Spinner from './components/Spinner';
import AdminLogin from './src/components/admin/AdminLogin';
import AdminDashboard from './src/components/admin/AdminDashboard';
import PrivacyPolicy from './components/PrivacyPolicy';
import DMCA from './components/DMCA';
import TermsAndConditions from './components/TermsAndConditions';
import Contact from './components/Contact';
import { getAllAnime } from './services/animeService';
import AnalyticsTracker from './src/components/AnalyticsTracker'; // ✅ GA4 ANALYTICS IMPORT

type ViewType = 'home' | 'list' | 'detail';
type AdminViewType = 'login' | 'dashboard';

const DetailPageWrapper: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { animeId } = useParams<{ animeId: string }>();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnimeData = async () => {
      if (!animeId) {
        setError('No anime ID provided');
        setIsLoading(false);
        return;
      }

      try {
        // Production mein log show nahi hoga
        if (import.meta.env.DEV) {
          console.log('🔍 Fetching anime data for ID:', animeId);
        }
        
        setIsLoading(true);
        setError(null);
        
        const allAnime = await getAllAnime();
        
        if (import.meta.env.DEV) {
          console.log('📚 All anime loaded:', allAnime.length);
        }
        
        const foundAnime = allAnime.find(a => a.id === animeId || a._id === animeId);
        
        if (import.meta.env.DEV) {
          console.log('🎯 Found anime:', foundAnime);
        }
        
        if (foundAnime) {
          setAnime(foundAnime);
        } else {
          setError('Anime not found');
        }
      } catch (err) {
        // Error sirf development mein show hoga
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching anime:', err);
        }
        setError('Failed to load anime data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimeData();
  }, [animeId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" text="Loading anime..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-semibold text-slate-300 mb-2">Error Loading Anime</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="text-center py-16">
        <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold text-slate-300 mb-2">Anime Not Found</h2>
          <p className="text-slate-400 mb-4">
            The anime you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={onBack}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <AnimeDetailPage anime={anime} onBack={onBack} />;
};

const MainApp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [adminView, setAdminView] = useState<AdminViewType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [contentType, setContentType] = useState<ContentTypeFilter>('All');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [showAdminButton, setShowAdminButton] = useState(false);
  
  // ✅ SECRET CODE STATES
  const [typedText, setTypedText] = useState('');
  const [showCodeHint, setShowCodeHint] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ SEARCH DEBOUNCE REF
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ DUMMY FUNCTIONS FOR HEADER PROPS
  const dummyFilterFunction = (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => {
    // Empty function because Header handles navigation itself
  };

  const dummyContentTypeFunction = (contentType: ContentType) => {
    // Empty function because Header handles navigation itself
  };

  useEffect(() => {
    // Sirf development mode mein logs show karein
    if (import.meta.env.DEV) {
      console.log('📍 URL Changed:', location.search);
      
      const urlContentType = searchParams.get('contentType') as ContentTypeFilter | null;
      const urlFilter = searchParams.get('filter') as FilterType | null;
      const urlSearchQuery = searchParams.get('search') || '';

      console.log('📋 URL Parameters:', {
        contentType: urlContentType,
        filter: urlFilter,
        searchQuery: urlSearchQuery
      });

      if (urlContentType && urlContentType !== contentType) {
        console.log('🔄 Updating contentType from URL:', urlContentType);
        setContentType(urlContentType);
      }

      if (urlFilter && urlFilter !== filter) {
        console.log('🔄 Updating filter from URL:', urlFilter);
        setFilter(urlFilter);
      }

      if (urlSearchQuery && urlSearchQuery !== searchQuery) {
        console.log('🔄 Updating searchQuery from URL:', urlSearchQuery);
        setSearchQuery(urlSearchQuery);
      }
    }
  }, [location.search, searchParams]);

  useEffect(() => {
    // ✅ URL se state update karein (jab koi URL seedhe open kare)
    const urlContentType = searchParams.get('contentType') as ContentTypeFilter | null;
    const urlFilter = searchParams.get('filter') as FilterType | null;
    const urlSearchQuery = searchParams.get('search') || '';

    if (urlContentType && urlContentType !== contentType) {
      setContentType(urlContentType);
    }
    
    if (urlFilter && urlFilter !== filter) {
      setFilter(urlFilter);
    }
    
    if (urlSearchQuery !== searchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }, [location.search]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
       
        const token = localStorage.getItem('adminToken');
        const username = localStorage.getItem('adminUsername');
        if (token && username) {
          setIsAdminAuthenticated(true);
        }
      } catch (error) {
        // Sirf development mein error show karein
        if (import.meta.env.DEV) {
          console.error('App initialization error:', error);
        }
      } finally {
        setIsAppLoading(false);
      }
    };
    initializeApp();
  }, []);

  // ✅ SECRET CODE KEYBOARD LISTENER - TYPE "2007harsh" FOR DIRECT ADMIN
  // ✅ CONSOLE LOGS REMOVED - NO TEXT WILL SHOW IN CONSOLE WHEN TYPING
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if typing in input/textarea, then ignore
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Secret code typing logic
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const newTypedText = (typedText + e.key).toLowerCase();
        setTypedText(newTypedText);
        setShowCodeHint(true);
        
        // ✅ NO CONSOLE LOG HERE - TYPING WON'T SHOW IN CONSOLE
        
        // Check for secret code "2007harsh"
        if (newTypedText.includes('2007harsh')) {
          // ✅ NO CONSOLE LOG HERE EITHER
          e.preventDefault();
          
          setAdminView('login');
          setTypedText('');
          setShowCodeHint(false);
          
          // Show success notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #8b5cf6, #3b82f6);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 99999;
            box-shadow: 0 5px 15px rgba(139, 92, 246, 0.3);
            animation: fadeInOut 3s ease-in-out;
            font-size: 16px;
          `;
          notification.innerHTML = '✅ Admin Access Granted!';
          document.body.appendChild(notification);
          
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
        
        // Reset typing after 3 seconds of inactivity
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          setTypedText('');
          setShowCodeHint(false);
        }, 3000);
      }
      
      // Keep old shortcut as backup (optional)
      if (e.ctrlKey && e.altKey && e.shiftKey) {
        e.preventDefault();
        setShowAdminButton(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Cleanup search debounce
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [typedText]);

  const handleAdminLogin = (token: string, username: string) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUsername', username);
    setIsAdminAuthenticated(true);
    setAdminView('dashboard');
    setShowAdminButton(false);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    setIsAdminAuthenticated(false);
    setAdminView(null);
    // Home page par redirect karein
    window.location.href = window.location.origin + '/';
    setShowAdminButton(false);
  };

  const handleAnimeSelect = (anime: Anime) => {
    navigate(`/detail/${anime.id}`);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    navigate(-1);
  };

  // ✅ FIXED: handleSearchChange WITHOUT PAGE RELOAD
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Debounce the search to avoid rapid updates
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Update URL without reloading page
    searchDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      
      if (query.trim()) {
        params.set('search', query.trim());
      } else {
        params.delete('search');
      }
      
      // Update URL without reloading page
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState({}, '', newUrl);
      
      // Log in development only
      if (import.meta.env.DEV) {
        console.log('🔍 Search updated to:', query);
      }
    }, 400); // 400ms debounce
  }, []);
  
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const handleNavigate = (destination: 'home' | 'list') => {
    if (destination === 'list') {
      navigate('/anime');
    } else {
      navigate('/');
    }
    if (destination === 'home') {
      setFilter('All');
      setContentType('All');
      setSearchQuery('');
    }
  };

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-[#0a0c1c] flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="text-6xl mb-4 animate-bounce">🎬</div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Anim<span className="text-purple-500">abing</span>
            </h1>
            <p className="text-slate-400">Your ultimate anime destination</p>
          </div>
          <Spinner size="lg" text="Loading your anime world..." />
          <div className="mt-8 bg-slate-800/50 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-slate-400 text-sm">
              • Fast Downloads<br/>
              • Hindi Dubbed & Subbed<br/>
              • English Subbed<br/>
              • High Quality Content
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (adminView === 'login') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (adminView === 'dashboard' && isAdminAuthenticated) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  return (
    <div className="bg-[#0a0c1c] text-white min-h-screen font-sans">
      {/* ✅ GA4 ANALYTICS TRACKER - UTM FIX KA MANTRA */}
      <AnalyticsTracker />
      
      {/* ✅ Header ko sabhi 5 props dein */}
      <Header 
        onSearchChange={handleSearchChange} 
        searchQuery={searchQuery}
        onNavigate={handleNavigate}
        onFilterAndNavigateHome={dummyFilterFunction}
        onContentTypeNavigate={dummyContentTypeFunction}
      />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={
            <HomePage 
              onAnimeSelect={handleAnimeSelect} 
              searchQuery={searchQuery} 
              filter={filter}
              contentType={contentType}
            />
          } />
          
          {/* ✅ Anime List Route */}
          <Route path="/anime" element={
            <AnimeListPage 
              onAnimeSelect={handleAnimeSelect}
            />
          } />
          
          <Route path="/detail/:animeId" element={<DetailPageWrapper onBack={handleBack} />} />
          
          {/* ✅ FIXED: Both Download Routes Added */}
          <Route path="/download" element={<DownloadRedirectPage />} />
          <Route path="/download-redirect" element={<DownloadRedirectPage />} />
          
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/dmca" element={<DMCA />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      
      <Footer />
      <ScrollToTopButton />
      
      {/* Secret Code Typing Hint */}
      {showCodeHint && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[99999]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-sm min-w-[300px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-600/20 p-2 rounded-lg">
                  <span className="text-cyan-400">🔐</span>
                </div>
                <div>
                  <div className="text-sm text-cyan-300 font-medium">Secret Code Active</div>
                  <div className="text-xs text-slate-400">Type "2007harsh" for admin access</div>
                </div>
              </div>
              <div className="text-slate-500 text-sm">
                {typedText.length}/9
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">Current typing:</div>
              <div className="flex items-center gap-1">
                {Array.from('2007harsh').map((char, index) => (
                  <div 
                    key={index}
                    className={`w-7 h-8 flex items-center justify-center rounded text-sm font-mono font-bold
                      ${index < typedText.length 
                        ? typedText[index] === char
                          ? 'bg-green-600 text-white border border-green-400' 
                          : 'bg-red-600 text-white border border-red-400'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                  >
                    {char}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500 h-full transition-all duration-300"
                style={{ width: `${(typedText.length / 9) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Old button (optional - keep or remove) */}
      {showAdminButton && (
        <div className="fixed bottom-4 left-4 z-50 animate-fade-in">
          <button
            onClick={() => setAdminView('login')}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
          >
            <span>⚙️</span>
            Admin Access
          </button>
          <p className="text-xs text-slate-400 mt-1 bg-black/50 p-1 rounded">
            Press Ctrl+Shift+Alt to hide
          </p>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <MainApp />
    </Router>
  );
};

export default App;