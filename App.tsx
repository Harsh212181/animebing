 // App.tsx - UPDATED WITH DOWNLOAD LINK PAGE ROUTE & PRINT HIDDEN FOR ADMIN ELEMENTS
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import AnalyticsTracker from './src/components/AnalyticsTracker'; // ✅ GA4 ANALYTICS IMPORT

// ✅ NEW IMPORT: AnimeDetailWrapper
import AnimeDetailWrapper from './components/AnimeDetailWrapper';

// ✅ NEW IMPORT: Top100Page
import Top100Page from './components/Top100Page';

// ✅ IMPORT: EarnMoney (merged page - contains both simple earn + promotion plan)
import EarnMoney from './components/EarnMoney';

// ✅ NEW IMPORT: WelcomePage for referral redirects
import WelcomePage from './components/WelcomePage';

// ✅ NEW IMPORT: DownloadLinkPage for grouped download pages
import DownloadLinkPage from './components/DownloadLinkPage';

// ❌ PromotionPlan import removed – now merged into EarnMoney

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
    // ✅ HAR PAGE CHANGE PAR TOP PAR SCROLL
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });
    
    // ✅ EXTRA SAFETY: RequestAnimationFrame use karein
    requestAnimationFrame(() => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    });
    
    // ✅ EXTRA SAFETY: 10ms baad bhi check karein
    const timer = setTimeout(() => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    }, 10);
    
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]); // ✅ Path aur search params change hone par trigger hoga
  
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
  
  // ✅ SECRET CODE STATES (hint removed)
  const [typedText, setTypedText] = useState('');
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

  // ✅ SECRET CODE KEYBOARD LISTENER - TYPE "2007harsh" OR PRESS Ctrl+Shift+Alt FOR DIRECT ADMIN (HINT REMOVED)
  useEffect(() => {
    // Helper to show the green success notification
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
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Secret code "2007harsh" (typed without modifiers)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const newTypedText = (typedText + e.key).toLowerCase();
        setTypedText(newTypedText);

        if (newTypedText.includes('2007harsh')) {
          e.preventDefault();
          setAdminView('login');
          setTypedText('');
          showAdminNotification();
        }

        // Reset typing after 3 seconds of inactivity
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypedText('');
        }, 3000);
      }

      // DIRECT SHORTCUT: Ctrl + Shift + Alt
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
    // Home page par redirect karein
    window.location.href = window.location.origin + '/';
  };

  const handleAnimeSelect = (anime: Anime) => {
    // ✅ FIXED: Use anime.slug if available, else use anime.id
    const identifier = anime.slug || anime.id || anime._id;
    if (identifier) {
      navigate(`/detail/${identifier}`);
      
      // ✅ INSTANT SCROLL TO TOP ON ANIME SELECT
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
    
    // ✅ INSTANT SCROLL TO TOP ON NAVIGATION
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
        /* ✅ FIXED: Green border styling - keep for other elements but removed from main container */
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
        /* ✅ REMOVED: Main content container border styling */
        /* ✅ FORCE SCROLL TO TOP STYLES */
        html {
          scroll-behavior: auto !important;
        }
        body {
          overflow-anchor: none;
        }
      `}</style>
      
      {/* ✅ GA4 ANALYTICS TRACKER - UTM FIX KA MANTRA */}
      <AnalyticsTracker />
      
      {/* ✅ ScrollToTop component wrap karein */}
      <ScrollToTop>
        {/* ✅ Header ko sabhi 5 props dein - Updated with top100 navigation */}
        <Header 
          onSearchChange={handleSearchChange} 
          searchQuery={searchQuery}
          onNavigate={handleNavigate}
          onFilterAndNavigateHome={dummyFilterFunction}
          onContentTypeNavigate={dummyContentTypeFunction}
        />
        
        {/* ✅ MAIN CONTAINER WITHOUT GREEN BORDER - MORE SPACE FOR ANIME CARDS */}
        <main className="container mx-auto px-2 py-2"> {/* ✅ Reduced padding even more */}
          {/* ✅ REMOVED: glow-green-border class for more space */}
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
              
              {/* ✅ Anime List Route */}
              <Route path="/anime" element={
                <div className="rounded-lg overflow-hidden">
                  <AnimeListPage 
                    onAnimeSelect={handleAnimeSelect}
                  />
                </div>
              } />
              
              {/* ✅ FIXED: Anime Detail Route with ID/Slug Support */}
              <Route path="/detail/:idOrSlug" element={
                <div className="rounded-lg overflow-hidden">
                  <AnimeDetailWrapper />
                </div>
              } />
              
              {/* ✅ NEW: Top 100 Rankings Route */}
              <Route path="/top-100" element={
                <div className="rounded-lg overflow-hidden">
                  <Top100Page 
                    onAnimeSelect={handleAnimeSelect}
                    onBack={handleBackToHome}
                  />
                </div>
              } />
              
              {/* ✅ FIXED: Both Download Routes Added */}
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
              
              {/* ✅ NEW: Download Link Page Route for grouped episodes */}
              <Route path="/download/:slug" element={
                <div className="rounded-lg overflow-hidden">
                  <DownloadLinkPage />
                </div>
              } />
              
              {/* Other Pages with Green Outline - KEEP border for these */}
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

              {/* ✅ NEW: Earn Money Page (merged with Promotion Plan) */}
              <Route path="/earn-money" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <EarnMoney />
                </div>
              } />

              {/* ✅ Promotion Plan now shows the same merged EarnMoney page */}
              <Route path="/promotion-plan" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <EarnMoney />
                </div>
              } />
              
              {/* ✅ NEW: Welcome Page for Referral Redirects - NOW REDIRECTS TO HOME */}
              <Route path="/welcome" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <WelcomePage />
                </div>
              } />
              
              {/* ✅ 404 ERROR PAGE FOR NON-EXISTENT ROUTES */}
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
        
        {/* ❌ Secret Code Hint Removed – No hint box shown anymore */}
      </ScrollToTop>
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