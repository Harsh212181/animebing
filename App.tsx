 // App.tsx - FINAL FIXED VERSION (with HelmetProvider + AnimeContext for no re-fetch)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async'; // ✅ CRITICAL: For dynamic SEO tags

import type { Anime, FilterType, ContentType, ContentTypeFilter } from './src/types';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import AnimeListPage from './components/AnimeListPage';
import DownloadRedirectPage from './components/DownloadRedirectPage';
import ScrollToTopButton from './components/ScrollToTopButton';
import Spinner from './components/Spinner';
import AdminLogin from './src/components/admin/AdminLogin';
import AdminDashboard from './src/components/admin/AdminDashboard';
import PrivacyPolicy from './components/PrivacyPolicy';
import DMCA from './components/DMCA';
import TermsAndConditions from './components/TermsAndConditions';
import Contact from './components/Contact';
import AnalyticsTracker from './src/components/AnalyticsTracker';
import AnimeDetailWrapper from './components/AnimeDetailWrapper';
import Top100Page from './components/Top100Page';
import EarnMoney from './components/EarnMoney';
import WelcomePage from './components/WelcomePage';
import DownloadLinkPage from './components/DownloadLinkPage';

// ✅ ADDED: AnimeContext Provider import
import { AnimeProvider } from './src/context/AnimeContext';

// ✅ 404 ERROR PAGE COMPONENT
const ErrorPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
      <style>{`
        .error-glow {
          animation: errorPulse 2s infinite alternate;
        }
        @keyframes errorPulse {
          0% { box-shadow: 0 0 10px rgba(220, 38, 38, 0.3); }
          100% { box-shadow: 0 0 25px rgba(220, 38, 38, 0.6); }
        }
      `}</style>
      
      <div className="error-glow border-2 border-red-500/50 rounded-2xl p-8 bg-purple-900/40 backdrop-blur-sm max-w-md w-full">
        <div className="text-8xl mb-6 animate-bounce">
          <span className="text-red-400">4</span>
          <span className="text-purple-400">0</span>
          <span className="text-red-400">4</span>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4">
          Page Not Found
        </h1>
        
        <p className="text-purple-300 mb-6">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <span className="text-xl">👾</span>
            <span>Go Back to Home</span>
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-gradient-to-r from-purple-800 to-gray-800 hover:from-purple-700 hover:to-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-all border border-purple-700/50"
          >
            ← Go Back to Previous Page
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-purple-800/50">
          <p className="text-purple-400 text-sm">
            If you believe this is an error, please check the URL or contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

type ViewType = 'home' | 'list' | 'detail' | 'top100';
type AdminViewType = 'login' | 'dashboard';

// ✅ SCROLL TO TOP COMPONENT
const ScrollToTop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });
    
    requestAnimationFrame(() => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    });
    
    const timer = setTimeout(() => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    }, 10);
    
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);
  
  return <>{children}</>;
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
  
  const [typedText, setTypedText] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const dummyFilterFunction = (filter: 'Hindi Dub' | 'Hindi Sub' | 'English Sub') => {};
  const dummyContentTypeFunction = (contentType: ContentType) => {};

  useEffect(() => {
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
        if (import.meta.env.DEV) {
          console.error('App initialization error:', error);
        }
      } finally {
        setIsAppLoading(false);
      }
    };
    initializeApp();
  }, []);

  // ✅ SECRET CODE KEYBOARD LISTENER
  useEffect(() => {
    const showAdminNotification = () => {
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
      setTimeout(() => notification.remove(), 3000);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const newTypedText = (typedText + e.key).toLowerCase();
        setTypedText(newTypedText);

        if (newTypedText.includes('2007harsh')) {
          e.preventDefault();
          setAdminView('login');
          setTypedText('');
          showAdminNotification();
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypedText('');
        }, 3000);
      }

      if (e.ctrlKey && e.shiftKey && e.altKey) {
        e.preventDefault();
        setAdminView('login');
        showAdminNotification();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [typedText]);

  const handleAdminLogin = (token: string, username: string) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUsername', username);
    setIsAdminAuthenticated(true);
    setAdminView('dashboard');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    setIsAdminAuthenticated(false);
    setAdminView(null);
    window.location.href = window.location.origin + '/';
  };

  const handleAnimeSelect = (anime: Anime) => {
    const identifier = anime.slug || anime.id || anime._id;
    if (identifier) {
      navigate(`/detail/${identifier}`);
      
      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant' as ScrollBehavior
        });
      });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      
      if (query.trim()) {
        params.set('search', query.trim());
      } else {
        params.delete('search');
      }
      
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState({}, '', newUrl);
      
      if (import.meta.env.DEV) {
        console.log('🔍 Search updated to:', query);
      }
    }, 400);
  }, []);
  
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const handleNavigate = (destination: 'home' | 'list' | 'top100') => {
    if (destination === 'list') {
      navigate('/anime');
    } else if (destination === 'top100') {
      navigate('/top-100');
    } else {
      navigate('/');
    }
    
    if (destination === 'home') {
      setFilter('All');
      setContentType('All');
      setSearchQuery('');
    }
    
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      });
    });
  };

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 flex flex-col items-center justify-center p-4">
        <style>{`
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
          .glow-green-border {
            border: 2px solid rgba(115, 245, 138, 0.5);
            box-shadow: 0 0 20px rgba(115, 245, 138, 0.3);
            margin: 0.1rem !important;
          }
        `}</style>
        
        <div className="text-center glow-green-border rounded-2xl p-8 bg-purple-800/50 backdrop-blur-sm">
          <div className="relative mb-8">
            <div 
              className="text-6xl mb-4 animate-bounce"
              style={{ textShadow: '0 0 10px rgba(115, 245, 138, 0.5)' }}
            >🎬</div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Anime<span className="text-green-400">bing</span>
            </h1>
            <p className="text-purple-300">Your ultimate anime destination</p>
          </div>
          <Spinner size="lg" text="Loading your anime world..." />
          <div className="mt-8 bg-purple-800/50 rounded-lg p-4 max-w-md mx-auto border border-green-500/30">
            <p className="text-purple-300 text-sm">
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
    return (
      <div className="print:hidden">
        <AdminLogin onLogin={handleAdminLogin} />
      </div>
    );
  }

  if (adminView === 'dashboard' && isAdminAuthenticated) {
    return (
      <div className="print:hidden">
        <AdminDashboard onLogout={handleAdminLogout} />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white min-h-screen font-sans">
      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .glow-green-border {
          border: 2px solid rgba(115, 245, 138, 0.5);
          box-shadow: 0 0 20px rgba(115, 245, 138, 0.3);
          margin: 0.1rem !important;
        }
        .hover-glow-green:hover {
          box-shadow: 0 0 15px rgba(115, 245, 138, 0.5);
          border-color: rgba(115, 245, 138, 0.7);
        }
        .border-green-custom {
          border-color: #73F58A;
        }
        .border-green-custom-30 {
          border-color: rgba(115, 245, 138, 0.3);
        }
        html {
          scroll-behavior: auto !important;
        }
        body {
          overflow-anchor: none;
        }
      `}</style>
      
      <AnalyticsTracker />
      
      <ScrollToTop>
        <Header 
          onSearchChange={handleSearchChange} 
          searchQuery={searchQuery}
          onNavigate={handleNavigate}
          onFilterAndNavigateHome={dummyFilterFunction}
          onContentTypeNavigate={dummyContentTypeFunction}
        />
        
        {/* ✅ FIX: container hatakar w-full kiya — ab full width har browser mein */}
        <main className="w-full px-2 py-2">
          <div 
            className="rounded-xl"
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Routes>
              <Route path="/" element={
                <div className="rounded-lg overflow-hidden">
                  <HomePage 
                    onAnimeSelect={handleAnimeSelect} 
                    searchQuery={searchQuery} 
                    filter={filter}
                    contentType={contentType}
                  />
                </div>
              } />
              
              <Route path="/anime" element={
                <div className="rounded-lg overflow-hidden">
                  <AnimeListPage onAnimeSelect={handleAnimeSelect} />
                </div>
              } />
              
              <Route path="/detail/:idOrSlug" element={
                <div className="rounded-lg overflow-hidden">
                  <AnimeDetailWrapper />
                </div>
              } />
              
              <Route path="/top-100" element={
                <div className="rounded-lg overflow-hidden">
                  <Top100Page 
                    onAnimeSelect={handleAnimeSelect}
                    onBack={handleBackToHome}
                  />
                </div>
              } />
              
              <Route path="/download" element={
                <div className="rounded-lg overflow-hidden">
                  <DownloadRedirectPage />
                </div>
              } />
              <Route path="/download-redirect" element={
                <div className="rounded-lg overflow-hidden">
                  <DownloadRedirectPage />
                </div>
              } />
              
              <Route path="/download/:slug" element={
                <div className="rounded-lg overflow-hidden">
                  <DownloadLinkPage />
                </div>
              } />
              
              <Route path="/privacy" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <PrivacyPolicy />
                </div>
              } />
              <Route path="/dmca" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <DMCA />
                </div>
              } />
              <Route path="/terms" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <TermsAndConditions />
                </div>
              } />
              <Route path="/contact" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <Contact />
                </div>
              } />
              <Route path="/earn-money" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <EarnMoney />
                </div>
              } />
              <Route path="/promotion-plan" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <EarnMoney />
                </div>
              } />
              <Route path="/welcome" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <WelcomePage />
                </div>
              } />
              <Route path="*" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <ErrorPage />
                </div>
              } />
            </Routes>
          </div>
        </main>
        
        <Footer />
        <ScrollToTopButton />
      </ScrollToTop>
    </div>
  );
};

// ✅ FINAL APP WITH HELMETPROVIDER + ANIMEPROVIDER WRAPPER
const App: React.FC = () => {
  return (
    <HelmetProvider>
      <Router>
        <AnimeProvider>   {/* ✅ ADDED: AnimeContext wraps the whole app */}
          <MainApp />
        </AnimeProvider>
      </Router>
    </HelmetProvider>
  );
};

export default App;