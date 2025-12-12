  // App.tsx - FULLY FIXED VERSION
// ⭐⭐⭐ SABSE PEHLE YE 4 LINES ADD KAREIN ⭐⭐⭐
if (import.meta.env.PROD) {
  // Saare console methods completely disable karein
  console.log = console.info = console.debug = console.warn = 
  console.error = console.trace = console.table = console.dir = 
  console.group = console.groupEnd = console.groupCollapsed = 
  console.time = console.timeEnd = () => {};
}

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { Anime, FilterType, ContentType, ContentTypeFilter } from './src/types';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import AnimeListPage from './components/AnimeListPage';
import AnimeDetailPage from './components/AnimeDetailPage';
import DownloadRedirectPage from './components/DownloadRedirectPage'; // ✅ ADDED
import ScrollToTopButton from './components/ScrollToTopButton';
import Spinner from './components/Spinner';
import AdminLogin from './src/components/admin/AdminLogin';
import AdminDashboard from './src/components/admin/AdminDashboard';
import PrivacyPolicy from './components/PrivacyPolicy';
import DMCA from './components/DMCA';
import TermsAndConditions from './components/TermsAndConditions';
import Contact from './components/Contact';
import { getAllAnime } from './services/animeService';

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
    // ✅ URL से state update करें (जब कोई URL सीधे ओपन करे)
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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.altKey) {
        e.preventDefault();
        setShowAdminButton(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
    // Home page पर redirect करें
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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Search के लिए भी page reload करें
    if (query.trim()) {
      window.location.href = `/?search=${encodeURIComponent(query.trim())}`;
    } else {
      window.location.href = '/';
    }
  };
  
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const handleNavigate = (destination: 'home' | 'list') => {
    if (destination === 'list') {
      navigate('/anime');
    } else {
      window.location.href = '/';
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
      {/* ✅ Header को सभी 5 props दें - लाल रेखा चली जाएगी */}
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
