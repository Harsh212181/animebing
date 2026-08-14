// ⚠️ Ye API_BASE alag hai — shortenerRoutes root '/' par mounted hai, '/api' ke neeche nahi
const SHORTENER_API_BASE = 'https://go.animebing.in';
const STORAGE_KEY = 'ab_click_token';

export const captureTokenFromUrl = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('cs');
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
      url.searchParams.delete('cs');
      window.history.replaceState({}, '', url.toString());
      return token;
    }
  } catch (e) {
    console.error('captureTokenFromUrl error:', e);
  }
  return sessionStorage.getItem(STORAGE_KEY);
};

export const getStoredToken = (): string | null => sessionStorage.getItem(STORAGE_KEY);
export const clearStoredToken = () => sessionStorage.removeItem(STORAGE_KEY);

// STEP 2 — anime detail page pe pahunchne ka signal
export const advanceFunnel = async (animeId?: string) => {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch(`${SHORTENER_API_BASE}/click/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, animeId }),
    });
  } catch (e) {
    console.error('advanceFunnel error:', e);
  }
};

// STEP 3 — final watch/download click = cycle complete
export const completeFunnel = () => {
  const token = getStoredToken();
  if (!token) return;
  const payload = JSON.stringify({ token });
  try {
    const sent = navigator.sendBeacon?.(
      `${SHORTENER_API_BASE}/click/complete`,
      new Blob([payload], { type: 'application/json' })
    );
    if (!sent) {
      fetch(`${SHORTENER_API_BASE}/click/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } finally {
    clearStoredToken();
  }
};

// download-page ka internal link banate waqt token forward karo
export const appendTokenToPath = (path: string): string => {
  const token = getStoredToken();
  if (!token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}cs=${encodeURIComponent(token)}`;
};