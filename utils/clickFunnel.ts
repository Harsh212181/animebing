 const SHORTENER_API_BASE = 'https://go.animebing.in';
const STORAGE_KEY = 'ab_click_tokens'; // ✅ ab per-anime MAP store hoga

type TokenMap = Record<string, { token: string }>;

const loadTokenMap = (): TokenMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveTokenMap = (map: TokenMap) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('saveTokenMap error:', e);
  }
};

// STEP 1 — URL se token nikal ke "pending" slot me park karo
export const captureTokenFromUrl = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('cs');
    if (token) {
      const map = loadTokenMap();
      map['pending'] = { token };
      saveTokenMap(map);
      url.searchParams.delete('cs');
      window.history.replaceState({}, '', url.toString());
      return token;
    }
  } catch (e) {
    console.error('captureTokenFromUrl error:', e);
  }
  return null;
};

// STEP 2 — anime detail page pe pahuncha, pending token ko is animeId se link karo
export const advanceFunnel = async (animeId?: string) => {
  if (!animeId) return;
  const map = loadTokenMap();
  const pending = map['pending'];
  if (!pending) return; // koi naya shortlink-token nahi tha (normal navigation)

  delete map['pending'];
  map[animeId] = { token: pending.token };
  saveTokenMap(map);

  try {
    const res = await fetch(`${SHORTENER_API_BASE}/click/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pending.token, animeId }),
    });
    await res.json();
  } catch (e) {
    console.error('advanceFunnel error:', e);
  }
};

// STEP 3 — final watch/download click = is anime ka cycle complete
export const completeFunnel = (animeId?: string) => {
  if (!animeId) return;
  const map = loadTokenMap();
  const entry = map[animeId];
  if (!entry) return; // is anime ke liye koi shortlink-token tha hi nahi

  const payload = JSON.stringify({ token: entry.token, animeId });
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
    // ✅ sirf isi anime ka token clear hoga, baaki anime ke tokens safe rahenge
    delete map[animeId];
    saveTokenMap(map);
  }
};

// Link5 (internal /download/) ke liye — optional safety, ab zaroori nahi
// kyunki localStorage already cross-tab shared hai, par future-proofing ke liye rakha
export const appendTokenToPath = (path: string, animeId?: string): string => {
  if (!animeId) return path;
  const map = loadTokenMap();
  const entry = map[animeId];
  if (!entry) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}cs=${encodeURIComponent(entry.token)}`;
};