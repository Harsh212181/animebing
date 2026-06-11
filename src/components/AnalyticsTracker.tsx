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

// ─── Page type detect ────────────────────────────────────────────────────
function getPageMeta(pathname: string): { pageType: string; slug?: string } {
  if (pathname === '/') return { pageType: 'home' };
  const episodeMatch = pathname.match(/^\/detail\/([^/]+)\/episode/);
  if (episodeMatch) return { pageType: 'episode', slug: episodeMatch[1] };
  const detailMatch = pathname.match(/^\/detail\/([^/]+)/);
  if (detailMatch) return { pageType: 'anime-detail', slug: detailMatch[1] };
  const downloadMatch = pathname.match(/^\/download\/([^/]+)/);
  if (downloadMatch) return { pageType: 'download', slug: downloadMatch[1] };
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

function getSessionId(): string {
  let id = sessionStorage.getItem('_ab_sid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_ab_sid', id);
  }
  return id;
}

// ─── Dedupe: same path ka repeat pageview tab tak block jab tak path change na ho ──
let lastSentPath = '';

function sendToBackend(path: string, timeOnPage?: number) {
  const { pageType, slug } = getPageMeta(path);
  const payload: Record<string, any> = { path, pageType, slug, sessionId: getSessionId() };

  if (timeOnPage === undefined) {
    // StrictMode double-mount / re-render guard — same path dobara count nahi hoga
    if (path === lastSentPath) return;
    lastSentPath = path;
  }

  if (timeOnPage !== undefined) payload.timeOnPage = timeOnPage;

  fetch(`${API_BASE}/analytics/pageview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────
const AnalyticsTracker = () => {
  const location = useLocation();
  const enterTimeRef = useRef<number>(Date.now());
  const prevPathRef = useRef<string>('');
  const sentRef = useRef<boolean>(false); // Strict Mode double-fire guard

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // Time-on-page for previous page
    if (prevPathRef.current && prevPathRef.current !== currentPath) {
      const timeOnPage = Math.round((Date.now() - enterTimeRef.current) / 1000);
      sendToBackend(prevPathRef.current, timeOnPage);
      sentRef.current = false;
    }

    // Send new page view only once
    if (!sentRef.current) {
      sentRef.current = true;
      enterTimeRef.current = Date.now();
      prevPathRef.current = currentPath;
      sendToBackend(currentPath);
    }

    // GA4
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

  // Tab close / hide pe time-on-page bhejo
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden') {
        const timeOnPage = Math.round((Date.now() - enterTimeRef.current) / 1000);
        sendToBackend(location.pathname + location.search, timeOnPage);
      }
    };
    document.addEventListener('visibilitychange', handleHide);
    return () => document.removeEventListener('visibilitychange', handleHide);
  }, [location]);

  return null;
};

export default AnalyticsTracker;