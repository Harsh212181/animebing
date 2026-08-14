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
    const res = await fetch(`${SHORTENER_API_BASE}/click/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, animeId }),
    });
    const data = await res.json();
    // 🆕 TEMP DEBUG
    alert('🔵 DEBUG /click/advance response: ' + JSON.stringify(data));
  } catch (e) {
    console.error('advanceFunnel error:', e);
    alert('❌ DEBUG /click/advance network error: ' + (e as Error).message);
  }
};

// STEP 3 — final watch/download click = cycle complete
export const completeFunnel = () => {
  const token = getStoredToken();
  if (!token) {
    // 🆕 TEMP DEBUG
    alert('❌ DEBUG: No token found in sessionStorage — funnel token hi missing hai');
    return;
  }
  const payload = JSON.stringify({ token });

  // 🆕 TEMP DEBUG — sendBeacon ki jagah fetch use kar rahe hain taaki
  // response mobile par bhi alert() ke through dikh jaye.
  // ⚠️ Testing khatam hone ke baad iss poore function ko wapas
  //     neeche diye "ORIGINAL VERSION" se replace kar dena.
  fetch(`${SHORTENER_API_BASE}/click/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  })
    .then(res => res.json())
    .then(data => {
      alert('✅ DEBUG /click/complete response: ' + JSON.stringify(data));
    })
    .catch(err => {
      alert('❌ DEBUG /click/complete network error: ' + err.message);
    });

  clearStoredToken();
};

/* ============================================================
   ORIGINAL VERSION — testing khatam hone ke baad completeFunnel
   ko isse replace kar dena (production-safe, silent, sendBeacon wala):

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
============================================================ */

// download-page ka internal link banate waqt token forward karo
export const appendTokenToPath = (path: string): string => {
  const token = getStoredToken();
  if (!token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}cs=${encodeURIComponent(token)}`;
};