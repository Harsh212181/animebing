// utils/authToken.ts

export function getAdminToken(): string {
  return (
    sessionStorage.getItem('adminToken') ||
    localStorage.getItem('adminToken') ||
    sessionStorage.getItem('subAdminToken') ||
    localStorage.getItem('subAdminToken') ||
    ''
  );
}

export function isSuperAdminSession(): boolean {
  return !!(sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken'));
}

export function getSubAdminPermissions(): string[] {
  try {
    const raw = sessionStorage.getItem('subAdminPermissions') || localStorage.getItem('subAdminPermissions') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearAllAuthTokens() {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminUsername');
  sessionStorage.removeItem('subAdminToken');
  sessionStorage.removeItem('subAdminUsername');
  sessionStorage.removeItem('subAdminPermissions');
  sessionStorage.removeItem('subAdminAnimeAccess');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUsername');
  localStorage.removeItem('subAdminToken');
  localStorage.removeItem('subAdminUsername');
  localStorage.removeItem('subAdminPermissions');
  localStorage.removeItem('subAdminAnimeAccess');
}