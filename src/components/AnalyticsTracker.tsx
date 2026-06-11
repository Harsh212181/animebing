// src/components/AnalyticsTracker.tsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

// ─── Page type detect (path se) ──────────────────────────────────────────
function getPageMeta(pathname: string): {
  pageType: string;
  slug?: string;
  animeTitle?: string;
} {
  if (pathname === '/') return { pageType: 'home' };
  // /detail/:slug/episode/:num
  const episodeMatch = pathname.match(/^\/detail\/([^/]+)\/episode/);
  if (episodeMatch) return { pageType: 'episode', slug: episodeMatch[1] };
  // /detail/:slug
  const detailMatch = pathname.match(/^\/detail\/([^/]+)/);
  if (detailMatch) return { pageType: 'anime-detail', slug: detailMatch[1] };
  // /download/:slug
  const downloadMatch = pathname.match(/^\/download\/([^/]+)/);
  if (downloadMatch) return { pageType: 'download', slug: downloadMatch[1] };
  // /anime — list page
  if (pathname === '/anime' || pathname.startsWith('/anime?')) return { pageType: 'anime-list' };
  if (pathname.startsWith('/anime-list')) return { pageType: 'anime-list' };
  if (pathname.startsWith('/top-100')) return { pageType: 'top-100' };
  if (pathname.startsWith('/contact')) return { pageType: 'contact' };
  if (pathname.startsWith('/privacy')) return { pageType: 'privacy' };
  if (pathname.startsWith('/terms')) return { pageType: 'terms' };
  if (pathname.startsWith('/dmca')) return { pageType: 'dmca' };
  if (pathname.startsWith('/earn')) return { pageType: 'earn-money' };
  return { pageType: 'other' };
}

// ─── Simple session ID (tab-level) ───────────────────────────────────────
function getSessionId(): string {
  let id = sessionStorage.getItem('_ab_sid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_ab_sid', id);
  }
  return id;
}

const AnalyticsTracker = () => {
  const location = useLocation();
  const enterTimeRef = useRef<number>(Date.now());
  const prevPathRef = useRef<string>('');

  // Send page view to our backend
  const sendToBackend = (
    path: string,
    timeOnPage?: number
  ) => {
    const { pageType, slug } = getPageMeta(path);
    const payload: any = {
      path,
      pageType,
      slug,
      sessionId: getSessionId(),
    };
    if (timeOnPage !== undefined) payload.timeOnPage = timeOnPage;

    // fire-and-forget (non-blocking, no await needed)
    fetch(`${API_BASE}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,    // page unload pe bhi send ho
    }).catch(() => {});   // silently ignore errors
  };

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // Time-on-page for PREVIOUS page before we navigate away
    if (prevPathRef.current && prevPathRef.current !== currentPath) {
      const timeOnPage = Math.round((Date.now() - enterTimeRef.current) / 1000);
      sendToBackend(prevPathRef.current, timeOnPage);
    }

    // Reset timer for new page
    enterTimeRef.current = Date.now();
    prevPathRef.current = currentPath;

    // Send new page view (no timeOnPage — user just arrived)
    sendToBackend(currentPath);

    // GA4 page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: currentPath,
        page_title: document.title,
        page_location: window.location.href,
      });
    }

    if (import.meta.env.DEV) {
      console.log('📊 Page View:', { path: currentPath, ...getPageMeta(location.pathname) });
    }
  }, [location]);

  // Send time-on-page when tab closes
  useEffect(() => {
    const handleUnload = () => {
      const timeOnPage = Math.round((Date.now() - enterTimeRef.current) / 1000);
      const path = location.pathname + location.search;
      sendToBackend(path, timeOnPage);
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleUnload();
    });
    return () => window.removeEventListener('visibilitychange', handleUnload as any);
  }, []);

  return null;
};

export default AnalyticsTracker;