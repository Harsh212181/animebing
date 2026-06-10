 import React, { useState, useEffect, useRef } from 'react';
import OverviewTab from './dashboard/OverviewTab';
import LinksTab from './dashboard/LinksTab';
import ProfileTab from './dashboard/ProfileTab';
import MessagesTab from './dashboard/MessagesTab';
import RequestsTab from './dashboard/RequestsTab';
import CreateLinkTab from './dashboard/CreateLinkTab';
import GettingStartedTab from './dashboard/GettingStartedTab'; // ← added

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

interface DashboardData {
  user: {
    username: string;
    realName: string;
    totalClicks: number;
    todayClicks: number;
    totalEarnings: number;
    unpaidEarnings: number;
    paidEarnings: number;
    ratePerThousand: number;
    profile: any;
    gmailLinked?: string;
    canCreateLinks?: boolean;
    avatarId?: number | null;
  };
  links: Array<{ code: string; label?: string; clicks: number; lastClicked: string | null }>;
  last7Days: Array<{ date: string; clicks: number }>;
  topCountries: Array<{ _id: string; count: number }>;
  unreadMessages: number;
  pendingPaymentRequest: boolean;
  pendingLinkRequest: boolean;
}

const AVATARS = [
  { id: 1,  emoji: '🦊', bg: 'linear-gradient(135deg,#f97316,#ef4444)', label: 'Fox' },
  { id: 2,  emoji: '🐉', bg: 'linear-gradient(135deg,#a855f7,#6366f1)', label: 'Dragon' },
  { id: 3,  emoji: '⚡', bg: 'linear-gradient(135deg,#eab308,#f97316)', label: 'Thunder' },
  { id: 4,  emoji: '👻', bg: 'linear-gradient(135deg,#ec4899,#f43f5e)', label: 'Sakura' },
  { id: 5,  emoji: '🗡️', bg: 'linear-gradient(135deg,#64748b,#334155)', label: 'Sword' },
  { id: 6,  emoji: '🌙', bg: 'linear-gradient(135deg,#3b82f6,#6366f1)', label: 'Moon' },
  { id: 7,  emoji: '🔥', bg: 'linear-gradient(135deg,#ef4444,#f97316)', label: 'Fire' },
  { id: 8,  emoji: '🦚', bg: 'linear-gradient(135deg,#38bdf8,#06b6d4)', label: 'Ice' },
  { id: 9,  emoji: '🧌', bg: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', label: 'Wave' },
  { id: 10, emoji: '🦋', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', label: 'Butterfly' },
  { id: 11, emoji: '🎮', bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', label: 'Eye' },
  { id: 12, emoji: '🧙‍♂️', bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', label: 'Star' },
  { id: 13, emoji: '🐺', bg: 'linear-gradient(135deg,#78716c,#57534e)', label: 'Wolf' },
  { id: 14, emoji: '⚖️', bg: 'linear-gradient(135deg,#22c55e,#16a34a)', label: 'Leaf' },
  { id: 15, emoji: '💀', bg: 'linear-gradient(135deg,#374151,#111827)', label: 'Skull' },
  { id: 16, emoji: '🦅', bg: 'linear-gradient(135deg,#0369a1,#1d4ed8)', label: 'Eagle' },
  { id: 17, emoji: '🛸', bg: 'linear-gradient(135deg,#f43f5e,#e11d48)', label: 'Hibiscus' },
  { id: 18, emoji: '⛈️', bg: 'linear-gradient(135deg,#475569,#1e293b)', label: 'Cross Swords' },
  { id: 19, emoji: '🐉', bg: 'linear-gradient(135deg,#10b981,#059669)', label: 'Green Dragon' },
  { id: 20, emoji: '💎', bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', label: 'Diamond' },
  { id: 21, emoji: '🌪️', bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', label: 'Spiral' },
  { id: 22, emoji: '🏔️', bg: 'linear-gradient(135deg,#64748b,#475569)', label: 'Mountain' },
  { id: 23, emoji: '🦁', bg: 'linear-gradient(135deg,#d97706,#92400e)', label: 'Lion' },
  { id: 24, emoji: '🌌', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)', label: 'Galaxy' },
  { id: 25, emoji: '🎙️', bg: 'linear-gradient(135deg,#be185d,#9d174d)', label: 'Mask' },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
const HamburgerIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const BellIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
  </svg>
);

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AvatarDisplay: React.FC<{ avatarId: number | null; name: string; size?: number }> = ({
  avatarId, name, size = 36,
}) => {
  const av = AVATARS.find(a => a.id === avatarId);
  const radius = size * 0.28;
  if (av) {
    return (
      <div style={{
        width: size, height: size, background: av.bg, borderRadius: radius,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.48, flexShrink: 0,
      }}>
        {av.emoji}
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size,
      background: 'linear-gradient(135deg,#534AB7,#AFA9EC)',
      borderRadius: radius,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, color: 'white', flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─── Avatar Picker ────────────────────────────────────────────────────────────
const AvatarPicker: React.FC<{
  current: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}> = ({ current, onSelect, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, backdropFilter: 'blur(6px)',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#ffffff', border: '1px solid #e2e2f0',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 420,
        maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(83,74,183,0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>Choose Your Avatar</span>
        <button
          onClick={onClose}
          style={{
            background: '#f4f4f8', border: 'none', borderRadius: 8,
            width: 30, height: 30, cursor: 'pointer', color: '#666',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {AVATARS.map(av => (
          <button
            key={av.id}
            onClick={() => { onSelect(av.id); onClose(); }}
            title={av.label}
            style={{
              background: av.bg,
              border: current === av.id ? '3px solid #534AB7' : '2px solid transparent',
              borderRadius: 14, aspectRatio: '1', fontSize: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s',
              transform: current === av.id ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {av.emoji}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ─── Login Form ───────────────────────────────────────────────────────────────
const LoginForm: React.FC<{ onLogin: (cred: any) => void; loginError: string }> = ({
  onLogin, loginError,
}) => {
  const [loginMode, setLoginMode] = useState<'password' | 'gmail'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gmail, setGmail] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f8f8fc', border: '1px solid #e2e2f0',
    borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#1a1a2e',
    outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit',
  };
  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: 12, fontWeight: 600,
    fontSize: 14, background: 'linear-gradient(135deg,#534AB7,#7c72d8)',
    color: 'white', border: 'none', cursor: 'pointer', letterSpacing: '0.02em',
    transition: 'opacity 0.2s',
  };
  const btnSecondary: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: 12, fontWeight: 500,
    fontSize: 14, background: '#f8f8fc', color: '#4a4a6a',
    border: '1px solid #e2e2f0', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0efff 0%,#f8f4ff 50%,#eff5ff 100%)',
      padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 36, width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(83,74,183,0.12)', border: '1px solid #ece9ff',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg,#534AB7,#7c72d8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 12px',
          }}>✨</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
            AnimaBing
          </div>
          <div style={{ fontSize: 13, color: '#8888aa', marginTop: 3 }}>Creator Dashboard</div>
        </div>

        {loginMode === 'password' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text" placeholder="Username" style={inputStyle}
                value={username} onChange={e => setUsername(e.target.value)}
              />
              <input
                type="password" placeholder="Password" style={inputStyle}
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onLogin({ username, password })}
              />
              {loginError && (
                <p style={{ color: '#d85a30', fontSize: 12, margin: 0 }}>{loginError}</p>
              )}
              <button style={btnPrimary} onClick={() => onLogin({ username, password })}>
                Sign In
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: '#b0b0cc', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e8e8f4' }} />OR
              <div style={{ flex: 1, height: 1, background: '#e8e8f4' }} />
            </div>
            <button onClick={() => setLoginMode('gmail')} style={btnSecondary}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57C21.36 18.5 22.56 15.68 22.56 12.25z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Gmail
              </span>
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" placeholder="yourname@gmail.com" style={inputStyle}
                value={gmail} onChange={e => setGmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onLogin({ gmail })}
              />
              <p style={{ color: '#9999bb', fontSize: 12, margin: 0 }}>
                Your Gmail must be linked in your profile.
              </p>
              {loginError && (
                <p style={{ color: '#d85a30', fontSize: 12, margin: 0 }}>{loginError}</p>
              )}
              <button style={btnPrimary} onClick={() => onLogin({ gmail })}>
                Login via Gmail
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: '#b0b0cc', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e8e8f4' }} />OR
              <div style={{ flex: 1, height: 1, background: '#e8e8f4' }} />
            </div>
            <button onClick={() => setLoginMode('password')} style={btnSecondary}>
              Login with Username &amp; Password
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Dashboard (FULL SCREEN WIDTH) ──────────────────────────────────────
const UserDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('shortUserToken'));
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loginError, setLoginError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarId, setAvatarId] = useState<number | null>(() => {
    const saved = localStorage.getItem('userAvatarId');
    return saved ? parseInt(saved) : null;
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // YouTube-style header hide/show on scroll
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 10) setHeaderVisible(true);
      else if (currentY < lastScrollY.current) setHeaderVisible(true);
      else setHeaderVisible(false);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { if (token) loadDashboard(); }, [token]);

  useEffect(() => {
    if (dashData?.user?.avatarId) {
      setAvatarId(dashData.user.avatarId);
      localStorage.setItem('userAvatarId', String(dashData.user.avatarId));
    }
  }, [dashData]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setDashData(data);
    } catch { showToast('Network error', 'error'); }
  };

  const handleLogin = async (credentials: { username?: string; password?: string; gmail?: string }) => {
    setLoginError('');
    try {
      const endpoint = credentials.gmail ? '/login/gmail' : '/login';
      const res = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok || !data.token) { setLoginError(data.error || 'Login failed'); return; }
      localStorage.setItem('shortUserToken', data.token);
      localStorage.setItem('shortUserName', data.user.realName);
      localStorage.setItem('shortUsername', data.user.username);
      setToken(data.token);
      showToast('Welcome back!', 'success');
    } catch { setLoginError('Network error'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('shortUserToken');
    localStorage.removeItem('shortUserName');
    localStorage.removeItem('shortUsername');
    setToken(null); setDashData(null);
  };

  const handleAvatarSelect = async (id: number) => {
    setAvatarId(id);
    localStorage.setItem('userAvatarId', String(id));
    try {
      await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarId: id }),
      });
    } catch {}
  };

  if (!token) return <LoginForm onLogin={handleLogin} loginError={loginError} />;

  if (!dashData) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0efff,#f8f4ff,#eff5ff)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #e0deff',
          borderTopColor: '#534AB7', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: '#9999bb', fontSize: 13 }}>Loading dashboard…</p>
      </div>
    </div>
  );

  const user = dashData.user;
  const name = localStorage.getItem('shortUserName') || user.realName || user.username;
  const showCreateTab = user.canCreateLinks === true;

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'links',     label: 'My Links' },
    { id: 'profile',   label: 'Profile' },
    { id: 'messages',  label: 'Messages', badge: dashData.unreadMessages },
    { id: 'requests',  label: 'Requests', badge: (dashData.pendingPaymentRequest || dashData.pendingLinkRequest) ? 1 : 0 },
    ...(showCreateTab ? [{ id: 'create', label: 'Create Link' }] : []),
    { id: 'getting-started', label: 'Creator Guide' },    
  ];

  const switchTab = (tabId: string) => { setActiveTab(tabId); setMenuOpen(false); };

  // ✅ Bell icon toggle: if already on messages → go to overview, else → messages
  const handleBellClick = () => {
    if (activeTab === 'messages') {
      setActiveTab('overview');
    } else {
      setActiveTab('messages');
    }
    setMenuOpen(false);
  };

  // ── FULL WIDTH STYLES (removed maxWidth constraints) ─────────────────────
  const S: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: '#f5f5fb',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #ece9ff',
      transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
    },
    headerInner: {
      width: '100%',
      padding: '12px 24px 0',
      boxSizing: 'border-box',
    },
    headerTop: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 10,
    },
    logoWrap: { display: 'flex', alignItems: 'center', gap: 10 },
    logoIcon: {
      width: 34, height: 34, borderRadius: 10,
      background: 'linear-gradient(135deg,#534AB7,#7c72d8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16,
    },
    logoText: { fontSize: 17, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.02em' },
    logoSub: { fontSize: 11, color: '#9999bb' },
    headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
    notifBtn: {
      width: 36, height: 36, borderRadius: 10,
      background: '#f4f3ff', border: '1px solid #ece9ff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: '#534AB7', position: 'relative',
    },
    notifDot: {
      position: 'absolute', top: 7, right: 7,
      width: 7, height: 7, borderRadius: '50%',
      background: '#e05a20', border: '1.5px solid white',
    },
    avatarBtn: {
      cursor: 'pointer', border: 'none', background: 'none', padding: 0,
    },
    logoutBtn: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 12px', borderRadius: 8,
      background: '#fff5f5', border: '1px solid #ffe0e0',
      color: '#c0392b', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    },
    navRow: {
      display: 'flex', gap: 0,
      overflowX: 'auto', scrollbarWidth: 'none',
    },
    mobileMenu: {
      background: 'white', borderTop: '1px solid #f0eeff',
      padding: '12px 16px 16px',
    },
    mobileUserCard: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', marginBottom: 8,
      background: '#f8f7ff', borderRadius: 14, border: '1px solid #ece9ff',
    },
    mobileMenuBtn: {
      display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
      padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500,
      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      transition: 'background 0.15s',
    },
    main: {
      width: '100%',
      maxWidth: '100%',
      padding: '28px 24px',
      boxSizing: 'border-box',
    },
  };

  const tabStyle = (id: string): React.CSSProperties => ({
    padding: '10px 16px', fontSize: 13, fontWeight: 500,
    color: activeTab === id ? '#534AB7' : '#7878a0',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: activeTab === id ? '2px solid #534AB7' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'color 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
  });

  const mobileTabActive = (id: string): React.CSSProperties => ({
    ...S.mobileMenuBtn,
    background: activeTab === id ? '#f0eeff' : 'transparent',
    color: activeTab === id ? '#534AB7' : '#555577',
  });

  return (
    <div style={S.page}>
      {/* ── Header (full width) ─────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.headerTop}>
            <div style={S.logoWrap}>
              <div style={S.logoIcon}>☠️</div>
              <div>
                <div style={S.logoText}>AnimaBing</div>
                <div style={S.logoSub}>Creator Dashboard</div>
              </div>
            </div>

            <div style={{ ...S.headerActions, display: 'flex' }}>
              {/* ✅ Bell icon with toggle handler */}
              <button
                onClick={handleBellClick}
                style={{ ...S.notifBtn, border: '1px solid #ece9ff' } as React.CSSProperties}
                title="Messages (toggle)"
              >
                <BellIcon />
                {dashData.unreadMessages > 0 && <div style={S.notifDot} />}
              </button>

              <button
                onClick={() => setShowAvatarPicker(true)}
                style={S.avatarBtn}
                title="Change avatar"
              >
                <AvatarDisplay avatarId={avatarId} name={name} size={36} />
              </button>

              <button onClick={handleLogout} style={{ ...S.logoutBtn, display: 'none' }} className="desktop-logout">
                <LogoutIcon /> Logout
              </button>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  padding: '7px', borderRadius: 10, background: '#f4f3ff',
                  border: '1px solid #ece9ff', cursor: 'pointer', color: '#534AB7',
                  display: 'flex', alignItems: 'center',
                }}
                className="mobile-hamburger"
              >
                {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
              </button>
            </div>
          </div>

          <nav style={{ ...S.navRow }} className="desktop-nav">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
                {tab.label}
                {tab.badge ? (
                  <span style={{
                    marginLeft: 5, display: 'inline-block',
                    background: '#d85a30', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', borderRadius: 20,
                  }}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>

        {menuOpen && (
          <div style={S.mobileMenu} className="mobile-menu">
            <div style={S.mobileUserCard}>
              <button onClick={() => { setShowAvatarPicker(true); setMenuOpen(false); }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
                <AvatarDisplay avatarId={avatarId} name={name} size={44} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{name}</div>
                <button
                  onClick={() => { setShowAvatarPicker(true); setMenuOpen(false); }}
                  style={{ fontSize: 12, color: '#7868d0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Change avatar
                </button>
              </div>
            </div>

            {tabs.map(tab => (
              <button key={tab.id} onClick={() => switchTab(tab.id)} style={mobileTabActive(tab.id)}>
                {tab.label}
                {tab.badge ? (
                  <span style={{
                    marginLeft: 8, background: '#d85a30', color: 'white',
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                  }}>{tab.badge}</span>
                ) : null}
              </button>
            ))}

            <button
              onClick={handleLogout}
              style={{ ...S.mobileMenuBtn, color: '#c0392b', marginTop: 4 } as React.CSSProperties}
            >
              <LogoutIcon />
              <span style={{ marginLeft: 8 }}>Logout</span>
            </button>
          </div>
        )}
      </header>

      <style>{`
        @media (min-width: 640px) {
          .mobile-hamburger { display: none !important; }
          .mobile-menu { display: none !important; }
          .desktop-logout { display: flex !important; }
        }
        @media (max-width: 639px) {
          .desktop-nav { display: none !important; }
        }
        .nav-tab-btn:hover { color: #1a1a2e !important; }
        input:focus { border-color: #7c72d8 !important; box-shadow: 0 0 0 3px rgba(83,74,183,0.12); }
      `}</style>

      <main style={S.main}>
        {activeTab === 'overview'  && <OverviewTab data={dashData} onRefresh={loadDashboard} onToast={showToast} />}
        {activeTab === 'links'     && <LinksTab links={dashData.links} onToast={showToast} />}
        {activeTab === 'profile'   && (
          <ProfileTab
            user={user}
            onProfileUpdate={loadDashboard}
            token={token!}
            onToast={showToast}
            avatarId={avatarId}
            name={name}
            onOpenAvatarPicker={() => setShowAvatarPicker(true)}
          />
        )}
        {activeTab === 'messages'  && (
          <MessagesTab
            token={token!}
            onRead={() => loadDashboard()}
            onToast={showToast}
            userName={name}
            avatarId={avatarId}
          />
        )}
        {activeTab === 'requests'  && (
          <RequestsTab data={dashData} onRefresh={loadDashboard} token={token!} onToast={showToast} />
        )}
        {activeTab === 'create' && showCreateTab && (
          <CreateLinkTab
            token={token!}
            onRefresh={loadDashboard}
            onToast={showToast}
            existingLinksCount={dashData.links.length}
          />
        )}
        {activeTab === 'getting-started' && <GettingStartedTab />}   {/* ✅ Start tab rendering */}
      </main>

      {showAvatarPicker && (
        <AvatarPicker
          current={avatarId}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
          <div style={{
            padding: '11px 18px', borderRadius: 12, fontSize: 13, fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            background: toastMsg.type === 'success' ? '#f0fdf4' : '#fff5f5',
            border: `1px solid ${toastMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: toastMsg.type === 'success' ? '#15803d' : '#b91c1c',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{toastMsg.type === 'success' ? '✓' : '✕'}</span>
            {toastMsg.text}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;