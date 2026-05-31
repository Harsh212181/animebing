// App.tsx - FINAL FIXED VERSION (with HelmetProvider + AnimeContext for no re-fetch)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

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
import UserDashboard from './components/UserDashboard'; // ✅ NEW IMPORT

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

// ✅ FIXED ScrollToTop — back navigation par scroll to top NAHI karta
const ScrollToTop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // ✅ Agar homeScrollPosition hai, user back aa raha hai
    // Us case mein scroll restore HomePage khud karega — yahan kuch mat karo
    const isComingBack = !!sessionStorage.getItem('homeScrollPosition');
    if (isComingBack) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.search]);

  return <>{children}</>;
};

// ✅ NEW LOADING SCREEN — Anime Portal Style
const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loadingText, setLoadingText] = useState('Connecting to Anime World...');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const messages = [
    'Connecting to Anime World...',
    'Syncing Episode Library...',
    'Loading Hindi Dubs...',
    'Preparing Your Portal...',
    'Entering Anime Universe...',
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const lines: { angle: number; speed: number; len: number; opacity: number; color: string }[] = [];
    const colors = ['#c084fc', '#a855f7', '#9333ea', '#d8b4fe', '#7c3aed'];

    for (let i = 0; i < 80; i++) {
      lines.push({
        angle: (Math.PI * 2 * i) / 80 + Math.random() * 0.05,
        speed: Math.random() * 4 + 2,
        len: Math.random() * 120 + 40,
        opacity: Math.random() * 0.4 + 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let tick = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick += 0.6;
      lines.forEach(line => {
        const dist = 80 + ((tick * line.speed) % (Math.max(canvas.width, canvas.height)));
        const x1 = cx + Math.cos(line.angle) * (dist - line.len);
        const y1 = cy + Math.sin(line.angle) * (dist - line.len);
        const x2 = cx + Math.cos(line.angle) * dist;
        const y2 = cy + Math.sin(line.angle) * dist;

        const fade = Math.min(dist / 300, 1) * line.opacity;
        ctx.strokeStyle = line.color;
        ctx.globalAlpha = fade;
        ctx.lineWidth = Math.random() > 0.8 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);

    let cur = 0;
    const interval = setInterval(() => {
      cur += Math.random() * 2.5 + 0.8;
      if (cur >= 100) { cur = 100; clearInterval(interval); }
      setProgress(Math.min(cur, 100));
      const idx = Math.min(Math.floor((cur / 100) * messages.length), messages.length - 1);
      setLoadingText(messages[idx]);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (circ * progress) / 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 40%, #4c1d95 0%, #3b0764 40%, #1e0533 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes ls-fadeIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes ls-titleDrop {
          0%  { opacity: 0; transform: translateY(-40px) skewX(-8deg); letter-spacing: 12px; }
          60% { opacity: 1; transform: translateY(4px)  skewX(1deg);  letter-spacing: 1px; }
          100%{ opacity: 1; transform: translateY(0)    skewX(0);     letter-spacing: -1px; }
        }
        @keyframes ls-subtitleFade {
          from { opacity: 0; letter-spacing: 8px; }
          to   { opacity: 1; letter-spacing: 4px; }
        }
        @keyframes ls-ring {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ls-ringRev {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes ls-portalPulse {
          0%,100% { transform: scale(1);    opacity: 0.7; }
          50%     { transform: scale(1.06); opacity: 1; }
        }
        @keyframes ls-sakura {
          0%   { transform: translateY(-10px) rotate(0deg);   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes ls-dot {
          0%,80%,100% { transform: scale(0); opacity: 0; }
          40%          { transform: scale(1); opacity: 1; }
        }
        @keyframes ls-progressGlow {
          0%,100% { filter: drop-shadow(0 0 4px #c084fc); }
          50%      { filter: drop-shadow(0 0 12px #c084fc) drop-shadow(0 0 24px #7c3aed); }
        }
        @keyframes ls-barShine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .ls-card { animation: ls-fadeIn 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .ls-title { animation: ls-titleDrop 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .ls-subtitle { animation: ls-subtitleFade 0.8s ease 0.7s both; opacity: 0; }
        .ls-ring-a { animation: ls-ring    3.2s linear infinite; }
        .ls-ring-b { animation: ls-ringRev 2.1s linear infinite; }
        .ls-ring-c { animation: ls-ring    5s   linear infinite; }
        .ls-portal { animation: ls-portalPulse 2.5s ease-in-out infinite; }
        .ls-progress-svg { animation: ls-progressGlow 2s ease-in-out infinite; }
        .ls-bar-shine {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: ls-barShine 1.4s linear infinite;
        }
      `}</style>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${5 + (i * 5.5) % 92}%`,
          top: `-${10 + (i * 7) % 20}px`,
          fontSize: i % 3 === 0 ? 12 : i % 3 === 1 ? 9 : 7,
          opacity: 0,
          pointerEvents: 'none',
          animation: `ls-sakura ${5 + (i % 5)}s linear ${(i * 0.4) % 4}s infinite`,
          userSelect: 'none',
        }}>
          {i % 4 === 0 ? '🌸' : i % 4 === 1 ? '✦' : i % 4 === 2 ? '⋆' : '✿'}
        </div>
      ))}

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,0,20,0.55) 100%)',
      }} />

      <div className="ls-card" style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '44px 40px 36px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(192,132,252,0.25)',
        borderRadius: 28,
        backdropFilter: 'blur(18px)',
        boxShadow: '0 0 60px rgba(124,58,237,0.25), 0 0 120px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.08)',
        maxWidth: 360, width: '90%',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}>
        <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 28 }}>
          <div className="ls-ring-c" style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '1px dashed rgba(192,132,252,0.2)',
          }} />
          <div className="ls-ring-a" style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor: '#c084fc',
            borderRightColor: 'rgba(192,132,252,0.3)',
          }} />
          <div className="ls-ring-b" style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            border: '2px solid transparent',
            borderBottomColor: '#7c3aed',
            borderLeftColor: 'rgba(124,58,237,0.3)',
          }} />

          <svg className="ls-progress-svg" style={{
            position: 'absolute', inset: 18, width: 'calc(100% - 36px)', height: 'calc(100% - 36px)',
            transform: 'rotate(-90deg)',
          }} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(192,132,252,0.12)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r={r} fill="none"
              stroke="url(#progressGrad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.2s ease' }}
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>

          <div className="ls-portal" style={{
            position: 'absolute', inset: 26,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(76,29,149,0.6) 100%)',
            boxShadow: '0 0 30px rgba(124,58,237,0.5), inset 0 0 20px rgba(192,132,252,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 34, filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.8))' }}>☠️</span>
          </div>

          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 11, fontWeight: 800,
            borderRadius: 99, padding: '3px 8px',
            boxShadow: '0 2px 8px rgba(124,58,237,0.5)',
            letterSpacing: 0.5,
            transition: 'all 0.2s',
          }}>
            {Math.round(progress)}%
          </div>
        </div>

        <h1 className="ls-title" style={{
          margin: '0 0 6px', lineHeight: 1,
          fontSize: 44, fontWeight: 900, letterSpacing: '-1px',
        }}>
          <span style={{ color: '#e9d5ff' }}>Anime</span>
          <span style={{
            background: 'linear-gradient(90deg, #c084fc, #a855f7, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>bing</span>
        </h1>

        <p className="ls-subtitle" style={{
          margin: '0 0 28px', color: 'rgba(196,181,253,0.55)',
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 4,
        }}>
          アニメ • Hindi • English
        </p>

        <div style={{ width: '100%', marginBottom: 10 }}>
          <div style={{
            width: '100%', height: 5, borderRadius: 99,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden', position: 'relative',
          }}>
            <div style={{
              height: '100%', borderRadius: 99, position: 'relative', overflow: 'hidden',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
              transition: 'width 0.2s ease',
              boxShadow: '0 0 10px rgba(192,132,252,0.6)',
            }}>
              <div className="ls-bar-shine" style={{ position: 'absolute', inset: 0 }} />
            </div>
          </div>
        </div>

        <p style={{
          margin: '0 0 24px', color: 'rgba(196,181,253,0.6)',
          fontSize: 11, fontWeight: 500, letterSpacing: 0.5,
          minHeight: 16, textAlign: 'center',
          transition: 'color 0.3s',
        }}>
          {loadingText}
        </p>

        <div style={{ display: 'flex', gap: 6, marginTop: 24 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i === 1 ? '#c084fc' : 'rgba(192,132,252,0.4)',
              animation: `ls-dot 1.2s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      </div>

      <p style={{
        position: 'absolute', bottom: 18,
        color: 'rgba(139,92,246,0.3)', fontSize: 10,
        letterSpacing: 2, textTransform: 'uppercase',
        animation: 'ls-fadeIn 0.5s ease 1.2s both', opacity: 0,
      }}>
        ✦ Animebing — Watch Free ✦
      </p>
    </div>
  );
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

      if (urlContentType && urlContentType !== contentType) setContentType(urlContentType);
      if (urlFilter && urlFilter !== filter) setFilter(urlFilter);
      if (urlSearchQuery && urlSearchQuery !== searchQuery) setSearchQuery(urlSearchQuery);
    }
  }, [location.search, searchParams]);

  useEffect(() => {
    const urlContentType = searchParams.get('contentType') as ContentTypeFilter | null;
    const urlFilter = searchParams.get('filter') as FilterType | null;
    const urlSearchQuery = searchParams.get('search') || '';

    if (urlContentType && urlContentType !== contentType) setContentType(urlContentType);
    if (urlFilter && urlFilter !== filter) setFilter(urlFilter);
    if (urlSearchQuery !== searchQuery) setSearchQuery(urlSearchQuery);
  }, [location.search]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        position: fixed; top: 20px; right: 20px;
        background: linear-gradient(135deg, #8b5cf6, #3b82f6);
        color: white; padding: 15px 20px; border-radius: 10px;
        font-weight: bold; z-index: 99999;
        box-shadow: 0 5px 15px rgba(139, 92, 246, 0.3);
        animation: fadeInOut 3s ease-in-out; font-size: 16px;
      `;
      notification.innerHTML = '✅ Admin Access Granted!';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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
        typingTimeoutRef.current = setTimeout(() => setTypedText(''), 3000);
      }

      // ✅ CHANGED: Ctrl + Shift + Alt + H combo to trigger admin login
      if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'h' || e.key === 'H')) {
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

  // ✅ FIXED handleAnimeSelect — scroll position pehle save, phir navigate
  const handleAnimeSelect = (anime: Anime) => {
    const identifier = anime.slug || anime.id || anime._id;
    if (identifier) {
      // ✅ Pehle position save karo
      sessionStorage.setItem('homeScrollPosition', String(window.scrollY));
      // ✅ Phir navigate karo — scroll to top NAHI karna (ScrollToTop component handle karega)
      navigate(`/detail/${identifier}`);
    }
  };

  const handleBack = () => navigate(-1);
  const handleBackToHome = () => navigate('/');

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (query.trim()) {
        params.set('search', query.trim());
      } else {
        params.delete('search');
      }
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState({}, '', newUrl);

      if (import.meta.env.DEV) console.log('🔍 Search updated to:', query);
    }, 400);
  }, []);

  const handleFilterChange = (newFilter: FilterType) => setFilter(newFilter);

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
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    });
  };

  if (isAppLoading) return <LoadingScreen />;

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
        .border-green-custom { border-color: #73F58A; }
        .border-green-custom-30 { border-color: rgba(115, 245, 138, 0.3); }
        html { scroll-behavior: auto !important; }
        body { overflow-anchor: none; }
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

              {/* ✅ NEW USER DASHBOARD ROUTE */}
              <Route path="/dashboard" element={
                <div className="rounded-lg overflow-hidden glow-green-border">
                  <UserDashboard />
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
        <AnimeProvider>
          <MainApp />
        </AnimeProvider>
      </Router>
    </HelmetProvider>
  );
};

export default App;