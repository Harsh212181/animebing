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

// ─── Module-level guard: same render-cycle / StrictMode double-fire ─────
let lastSentPath = '';
let lastSentAt = 0;

function sendToBackend(path: string) {
  const { pageType, slug } = getPageMeta(path.split('?')[0]);   // ← query hata ke slug nikalo
  const payload = { path, pageType, slug, sessionId: getSessionId(), visitorId: getVisitorId() };

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

// 🆕 ?l= aur ?ls= ko address bar se hata do (share karne par signed URL leak na ho)
function stripLinkTagFromUrl() {
  const p = new URLSearchParams(window.location.search);
  if (!p.has('l') && !p.has('ls')) return;
  p.delete('l');
  p.delete('ls');
  const q = p.toString();
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + (q ? `?${q}` : '') + window.location.hash
  );
}

// ─── Component ────────────────────────────────────────────────────────────
const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // ✅ हर रूट चेंज पर एक पेज व्यू भेजें (payload isi call mein ban jata hai, l/ls ke saath)
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
      console.log('📊 Page View:', { path: currentPath, ...getPageMeta(location.pathname) });
    }
  }, [location]);

  return null;
};

export default AnalyticsTracker;