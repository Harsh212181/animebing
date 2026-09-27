// src/components/AnalyticsTracker.tsx
import { useEffect } from 'react';
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

// 🆕 24h dedupe ke liye stable visitor id
function getVisitorId(): string {
  try {
    let id = localStorage.getItem('_ab_vid');
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_ab_vid', id);
    }
    return id;
  } catch {
    return ''; // private mode: server IP+UA fallback use karega
  }
}

// 🆕 Admin preview detection (?adminPreview=1)
function isAdminPreviewUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('adminPreview') === '1';
  } catch {
    return false;
  }
}

// ─── Module-level guard: same render-cycle / StrictMode double-fire ─────
let lastSentPath = '';
let lastSentAt = 0;

function sendToBackend(path: string) {
  const { pageType, slug } = getPageMeta(path.split('?')[0]);   // ← query hata ke slug nikalo
  const payload = {
    path,
    pageType,
    slug,
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    isAdminPreview: isAdminPreviewUrl(), // 🆕 admin preview flag
  };

  // ✅ FIX: sirf 1 second ke andar wale exact duplicate ko guard karo
  // (StrictMode double-fire isi window mein hota hai). Genuine revisit
  // (back-button se dobara aana, ya kisi aur page se wapas download page
  // par aana) ab silently drop nahi hoga.
  const now = Date.now();
  if (path === lastSentPath && now - lastSentAt < 1000) return;
  lastSentPath = path;
  lastSentAt = now;

  fetch(`${API_BASE}/analytics/pageview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// 🆕 ?l=, ?ls= aur ?adminPreview= ko address bar se hata do
// (share karne par signed URL ya admin preview flag leak na ho)
function stripLinkTagFromUrl() {
  const p = new URLSearchParams(window.location.search);
  if (!p.has('l') && !p.has('ls') && !p.has('adminPreview')) return;
  p.delete('l');
  p.delete('ls');
  p.delete('adminPreview');
  const q = p.toString();
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + (q ? `?${q}` : '') + window.location.hash
  );
}

// ─── 🆕 Time-on-page tracking ───────────────────────────────────────────
let pageEnteredAt = Date.now();
let currentTrackedPath = '';
let lastTimeSentFor = '';   // ek path ke liye sirf ek hi time-beacon bhejein

function sendTimeOnPage() {
  if (!currentTrackedPath) return;
  if (lastTimeSentFor === currentTrackedPath) return; // double-send guard

  const seconds = Math.round((Date.now() - pageEnteredAt) / 1000);
  if (seconds < 1 || seconds > 3599) return; // junk filter (<1s, >1h)

  const { pageType, slug } = getPageMeta(currentTrackedPath.split('?')[0]);
  const payload = {
    path: currentTrackedPath,
    pageType,
    slug,
    timeOnPage: seconds,
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    isAdminPreview: isAdminPreviewUrl(),
  };

  lastTimeSentFor = currentTrackedPath;

  // sendBeacon: tab close / route change par reliable delivery
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const ok = navigator.sendBeacon?.(`${API_BASE}/analytics/pageview`, blob);
    if (!ok) throw new Error('beacon blocked');
  } catch {
    // Fallback: fetch with keepalive
    fetch(`${API_BASE}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

// ─── Component ────────────────────────────────────────────────────────────
const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // ✅ Pichle page ka time bhejo, navigate hone se pehle
    sendTimeOnPage();

    const currentPath = location.pathname + location.search;
    currentTrackedPath = currentPath;
    pageEnteredAt = Date.now();
    lastTimeSentFor = ''; // naye path ke liye reset

    // ✅ Har route change par ek pageview bhejein
    sendToBackend(currentPath);

    // 🆕 pageview bhejne ke BAAD address bar saaf karo
    stripLinkTagFromUrl();

    // GA4
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: currentPath,
        page_title: document.title,
        page_location: window.location.href,
      });
    }

    if (import.meta.env.DEV) {
      console.log('📊 Page View:', {
        path: currentPath,
        ...getPageMeta(location.pathname),
        isAdminPreview: isAdminPreviewUrl(),
      });
    }

    return () => {
      // Route change cleanup: agar component unmount ho raha hai to bhi time bhejo
      sendTimeOnPage();
    };
  }, [location]);

  // 🆕 Tab close / reload / browser back (hard nav) par time bhejo
  useEffect(() => {
    const handleBeforeUnload = () => {
      lastTimeSentFor = ''; // force send
      sendTimeOnPage();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastTimeSentFor = ''; // force send on tab switch
        sendTimeOnPage();
      } else if (document.visibilityState === 'visible') {
        // Wapas aane par timer reset karo (idle time count na ho)
        pageEnteredAt = Date.now();
        lastTimeSentFor = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
};

export default AnalyticsTracker;