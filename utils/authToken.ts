// utils/authToken.ts

const ADMIN_KEY = 'adminToken';
const SUB_KEY = 'subAdminToken';

// ───────── JWT expiry check (token ke andar ka exp padhta hai) ─────────
function getExp(token: string): number | null {
  try {
    let part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (part.length % 4) part += '=';
    return JSON.parse(atob(part)).exp ?? null;
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const exp = getExp(token);
  return !!exp && Date.now() / 1000 < exp;
}

// localStorage pehle, phir purana sessionStorage (purane logins ke liye fallback)
function readKey(key: string): string | null {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function removeKey(key: string) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

// ───────── Main admin ─────────
export function saveAdminSession(token: string, username = 'admin') {
  localStorage.setItem(ADMIN_KEY, token);
  localStorage.setItem('adminUsername', username);
}

export function clearAdminSession() {
  removeKey(ADMIN_KEY);
  removeKey('adminUsername');
}

export function getAdminUsername(): string | null {
  if (!isTokenValid(readKey(ADMIN_KEY))) return null;
  const u = readKey('adminUsername');
  return u && u !== 'undefined' ? u : 'admin';
}

// ───────── Sub admin ─────────
export function saveSubAdminSession(
  token: string,
  sub: { username: string; permissions?: string[]; animeAccess?: string }
) {
  localStorage.setItem(SUB_KEY, token);
  localStorage.setItem('subAdminUsername', sub.username);
  localStorage.setItem('subAdminPermissions', JSON.stringify(sub.permissions || []));
  localStorage.setItem('subAdminAnimeAccess', sub.animeAccess || 'own');
}

export function getSubAdminToken(): string {
  const t = readKey(SUB_KEY);
  if (isTokenValid(t)) return t as string;
  clearSubAdminSession();
  return '';
}

export function clearSubAdminSession() {
  ['subAdminToken', 'subAdminUsername', 'subAdminPermissions', 'subAdminAnimeAccess']
    .forEach(removeKey);
}

// ───────── Purane functions (naam same, taaki baaki files na toote) ─────────

// Admin token pehle, na mile to sub-admin token. Sirf valid (expire na hua) token milega.
export function getAdminToken(): string {
  const a = readKey(ADMIN_KEY);
  if (isTokenValid(a)) return a as string;
  if (a) clearAdminSession();

  const s = readKey(SUB_KEY);
  if (isTokenValid(s)) return s as string;
  if (s) clearSubAdminSession();

  return '';
}

export function isSuperAdminSession(): boolean {
  return isTokenValid(readKey(ADMIN_KEY));
}

export function getSubAdminPermissions(): string[] {
  try {
    return JSON.parse(readKey('subAdminPermissions') || '[]');
  } catch {
    return [];
  }
}

export function clearAllAuthTokens() {
  clearAdminSession();
  clearSubAdminSession();
}