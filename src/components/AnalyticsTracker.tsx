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

// ─── Session-level dedupe: एक सेशन में एक पथ सिर्फ 1 बार काउंट हो ──────
const VISITED_KEY = '_ab_visited_paths';

function hasVisitedInSession(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    const visited: string[] = raw ? JSON.parse(raw) : [];
    return visited.includes(path);
  } catch {
    return false;
  }
}

function markVisitedInSession(path: string) {
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    const visited: string[] = raw ? JSON.parse(raw) : [];
    if (!visited.includes(path)) {
      visited.push(path);
      sessionStorage.setItem(VISITED_KEY, JSON.stringify(visited));
    }
  } catch {
    // sessionStorage unavailable — ignore
  }
}

// ─── Module-level guard: same render-cycle / StrictMode double-fire ─────
let lastSentPath = '';

// ✅ FIX: timeOnPage पूरी तरह हटाया, अब हर पेज सिर्फ पहली बार भेजा जाएगा
function sendToBackend(path: string) {
  const { pageType, slug } = getPageMeta(path);
  const payload = { path, pageType, slug, sessionId: getSessionId() };

  // StrictMode double-mount / re-render guard
  if (path === lastSentPath) return;
  lastSentPath = path;

  // Session-level dedupe: अगर इस सेशन में पहले ही भेज चुके हैं तो न भेजें
  if (hasVisitedInSession(path)) return;
  markVisitedInSession(path);

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
  const sentRef = useRef<boolean>(false);

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // ❌ time‑on‑page भेजने का कोड हटा दिया (यही डबल काउंटिंग का कारण था)

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

  // ❌ Tab hide पर time‑on‑page भेजना हटाया

  return null;
};

export default AnalyticsTracker;