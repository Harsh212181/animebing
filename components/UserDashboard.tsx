 import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';
const ANIME_API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/anime';

// ─── TypeScript interfaces ─────────────────────────────────────
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

interface AnimeItem { _id: string; title: string; slug?: string; }

// ─── 25 Emoji Avatars ────────────────────────────────────────
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

// ─── SVG icons ─────────────────────────────────────────────────
const HamburgerIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ─── AvatarDisplay ──────────────────────────────────────────────
const AvatarDisplay: React.FC<{ avatarId: number | null; name: string; size?: number }> = ({ avatarId, name, size = 36 }) => {
  const av = AVATARS.find(a => a.id === avatarId);
  if (av) {
    return (
      <div style={{ width: size, height: size, background: av.bg, borderRadius: size * 0.28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.48, flexShrink: 0 }}>
        {av.emoji}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius: size * 0.28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: 'white', flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─── AvatarPicker Modal ─────────────────────────────────────────
const AvatarPicker: React.FC<{ current: number | null; onSelect: (id: number) => void; onClose: () => void }> = ({ current, onSelect, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
    <div style={{ background: '#161829', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#e0e7ff' }}>Choose Your Avatar</span>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#94a3b8', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {AVATARS.map(av => (
          <button key={av.id} onClick={() => { onSelect(av.id); onClose(); }} title={av.label}
            style={{ background: av.bg, border: current === av.id ? '3px solid #a5b4fc' : '2px solid transparent', borderRadius: 14, aspectRatio: '1', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s', transform: current === av.id ? 'scale(1.1)' : 'scale(1)' }}>
            {av.emoji}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ─── Main Dashboard ────────────────────────────────────────────
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

  useEffect(() => { if (token) loadDashboard(); }, [token]);

  useEffect(() => {
    if (dashData?.user?.avatarId) {
      const backendId = dashData.user.avatarId;
      setAvatarId(backendId);
      localStorage.setItem('userAvatarId', String(backendId));
    }
  }, [dashData]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(API_BASE + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
      const data = await res.json();
      if (!res.ok || !data.token) { setLoginError(data.error || 'Login failed'); return; }
      localStorage.setItem('shortUserToken', data.token);
      localStorage.setItem('shortUserName', data.user.realName);
      localStorage.setItem('shortUsername', data.user.username);
      setToken(data.token);
      showToast('Login successful', 'success');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatarId: id })
      });
    } catch {
      // silent fail
    }
  };

  if (!token) return <LoginForm onLogin={handleLogin} loginError={loginError} />;
  if (!dashData) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-indigo-600"></div>
    </div>
  );

  const user = dashData.user;
  const name = localStorage.getItem('shortUserName') || user.realName || user.username;
  const showCreateTab = user.canCreateLinks === true;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'links', label: 'My Links' },
    { id: 'profile', label: 'Profile' },
    { id: 'messages', label: 'Messages', badge: dashData.unreadMessages },
    { id: 'requests', label: 'Requests' },
    ...(showCreateTab ? [{ id: 'create', label: 'Create Link' }] : []),
  ];

  const switchTab = (tabId: string) => { setActiveTab(tabId); setMenuOpen(false); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              AnimaBing
            </h1>
            <p className="text-xs text-gray-500">Creator Dashboard</p>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition sm:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        <nav className="hidden sm:block max-w-7xl mx-auto px-4 pb-2 overflow-x-auto">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-sm font-medium whitespace-nowrap py-1.5 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-xs font-semibold">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </nav>

        {menuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-100 shadow-lg px-4 py-3 space-y-1">
            <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-indigo-50 rounded-xl border border-indigo-100">
              <button onClick={() => { setShowAvatarPicker(true); }} className="focus:outline-none" title="Change avatar">
                <AvatarDisplay avatarId={avatarId} name={name} size={44} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{name}</div>
                <button onClick={() => { setShowAvatarPicker(true); setMenuOpen(false); }} className="text-xs text-indigo-500 hover:text-indigo-700 transition">Change Avatar</button>
              </div>
            </div>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex items-center w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {tab.label}
                {tab.badge ? <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-xs font-semibold">{tab.badge}</span> : null}
              </button>
            ))}
            <button onClick={handleLogout} className="flex items-center w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {activeTab === 'overview' && <OverviewTab data={dashData} onRefresh={loadDashboard} onToast={showToast} />}
        {activeTab === 'links' && <LinksTab links={dashData.links} onToast={showToast} />}
        {activeTab === 'profile' && <ProfileTab user={user} onProfileUpdate={loadDashboard} token={token!} onToast={showToast} avatarId={avatarId} name={name} onOpenAvatarPicker={() => setShowAvatarPicker(true)} />}
        {activeTab === 'messages' && <MessagesTab token={token!} onRead={() => loadDashboard()} onToast={showToast} userName={name} avatarId={avatarId} />}
        {activeTab === 'requests' && <RequestsTab data={dashData} onRefresh={loadDashboard} token={token!} onToast={showToast} />}
        {activeTab === 'create' && showCreateTab && <CreateLinkTab token={token!} onRefresh={loadDashboard} onToast={showToast} />}
      </main>

      {showAvatarPicker && (
        <AvatarPicker current={avatarId} onSelect={handleAvatarSelect} onClose={() => setShowAvatarPicker(false)} />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-4 py-2.5 rounded-xl text-sm shadow-lg font-medium ${toastMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {toastMsg.text}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Login Form ────────────────────────────────────
const LoginForm: React.FC<{ onLogin: (cred: any) => void; loginError: string }> = ({ onLogin, loginError }) => {
  const [loginMode, setLoginMode] = useState<'password' | 'gmail'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gmail, setGmail] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200/80 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AnimaBing</h1>
          <p className="text-gray-500 text-sm mt-1">Creator Dashboard</p>
        </div>
        {loginMode === 'password' ? (
          <>
            <div className="space-y-4">
              <input type="text" placeholder="Username" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" value={username} onChange={e => setUsername(e.target.value)} />
              <input type="password" placeholder="Password" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin({ username, password })} />
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-md transition" onClick={() => onLogin({ username, password })}>Login</button>
            </div>
            <div className="flex items-center gap-3 my-6 text-gray-400 text-xs"><div className="flex-1 h-px bg-gray-200"></div>OR<div className="flex-1 h-px bg-gray-200"></div></div>
            <button onClick={() => setLoginMode('gmail')} className="w-full py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Login with Gmail
            </button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <input type="email" placeholder="yourname@gmail.com" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" value={gmail} onChange={e => setGmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin({ gmail })} />
              <p className="text-gray-400 text-xs">Your Gmail must be saved in your profile.</p>
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-md transition" onClick={() => onLogin({ gmail })}>Login via Gmail</button>
            </div>
            <div className="flex items-center gap-3 my-6 text-gray-400 text-xs"><div className="flex-1 h-px bg-gray-200"></div>OR<div className="flex-1 h-px bg-gray-200"></div></div>
            <button onClick={() => setLoginMode('password')} className="w-full py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition">Login with Username &amp; Password</button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Chart Component ──────────────────────────────
const ClicksLineChart: React.FC<{ data: Array<{ date: string; clicks: number }> }> = ({ data }) => {
  const [hoverPoint, setHoverPoint] = useState<{ index: number; x: number; y: number } | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No click data available</div>;

  const width = 800, height = 260, margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right, innerHeight = height - margin.top - margin.bottom;
  const clicks = data.map(d => d.clicks);
  const maxClicks = Math.max(...clicks, 1);
  const yMax = Math.ceil(maxClicks * 1.1);
  const getX = (i: number) => margin.left + (i / Math.max(data.length - 1, 1)) * innerWidth;
  const getY = (c: number) => margin.top + innerHeight - (c / yMax) * innerHeight;
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.clicks), clicks: d.clicks, date: d.date }));
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${getX(data.length - 1)} ${margin.top + innerHeight} L ${getX(0)} ${margin.top + innerHeight} Z`;
  const yTicks = [0, Math.floor(yMax / 2), yMax];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const svgRect = chartRef.current.getBoundingClientRect();
    const xCoord = ((e.clientX - svgRect.left) / svgRect.width) * width;
    let minDist = Infinity, closestIndex = -1;
    points.forEach((p, idx) => { const dist = Math.abs(p.x - xCoord); if (dist < minDist) { minDist = dist; closestIndex = idx; } });
    if (closestIndex !== -1 && minDist < 30) setHoverPoint({ index: closestIndex, x: points[closestIndex].x, y: points[closestIndex].y });
    else setHoverPoint(null);
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={chartRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverPoint(null)} style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15"/><stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01"/></linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4f46e5"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
        </defs>
        {yTicks.map(tick => { const y = margin.top + innerHeight - (tick / yMax) * innerHeight; return (<g key={tick}><line x1={margin.left} y1={y} x2={margin.left + innerWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4"/><text x={margin.left - 8} y={y + 4} fill="#9ca3af" fontSize="11" textAnchor="end">{tick}</text></g>);})}
        <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="#d1d5db" strokeWidth="1.5"/>
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#d1d5db" strokeWidth="1.5"/>
        <path d={areaPath} fill="url(#areaGradient)"/>
        <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p, i) => (<g key={i}><circle cx={p.x} cy={p.y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" style={{cursor:'pointer'}}/><text x={p.x} y={p.y - 8} fill="#374151" fontSize="10" textAnchor="middle">{p.clicks}</text></g>))}
        {points.map((p, i) => (<text key={`lbl-${i}`} x={p.x} y={margin.top + innerHeight + 18} fill="#6b7280" fontSize="10" textAnchor="middle" transform={i%2===1?`rotate(-15,${p.x},${margin.top+innerHeight+18})`:undefined}>{p.date}</text>))}
        {hoverPoint && (<g transform={`translate(${hoverPoint.x+10},${hoverPoint.y-15})`}><rect x="-30" y="-20" width="60" height="24" rx="4" fill="#1f2937" opacity="0.95"/><text x="0" y="-2" fill="#f3f4f6" fontSize="11" textAnchor="middle">{data[hoverPoint.index].clicks} clicks</text></g>)}
      </svg>
    </div>
  );
};

// ─── Overview Tab ──────────────────────────────────
const OverviewTab: React.FC<{ data: DashboardData; onRefresh: () => void; onToast: any }> = ({ data, onRefresh, onToast }) => {
  const { user, last7Days, topCountries } = data;
  const canPayRequest = (user.totalClicks || 0) >= 1000 && (user.unpaidEarnings || 0) > 0;
  const requestPayment = async () => {
    try {
      const res = await fetch(`${API_BASE}/request/payment`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('shortUserToken')}` } });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success'); onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  return (
    <div className="space-y-6">
      {canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="flex-1">
            <h3 className="text-emerald-800 font-semibold">Payment Request Available</h3>
            <p className="text-emerald-700 text-sm">Request your ₹{user.unpaidEarnings.toFixed(2)} pending payment.</p>
            <p className="text-xs text-emerald-600 mt-1">💡 Minimum 1,000 clicks | Maximum payable clicks: 100,000</p>
          </div>
          <button onClick={requestPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">Request Payment</button>
        </div>
      )}
      {data.pendingPaymentRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="flex-1">
            <h3 className="text-amber-800 font-semibold">Payment Request Pending</h3>
            <p className="text-amber-700 text-sm">Under review.</p>
            <p className="text-xs text-amber-600 mt-1">💡 Minimum 1,000 clicks | Maximum payable clicks: 100,000</p>
          </div>
          <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>
        </div>
      )}
      {!canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="flex-1">
            <h3 className="text-indigo-800 font-semibold">Keep Growing</h3>
            <p className="text-indigo-700 text-sm">{Math.max(0, 1000 - (user.totalClicks || 0))} more clicks needed to unlock payment requests · {user.totalClicks || 0}/1,000</p>
            <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{width:`${Math.min(((user.totalClicks||0)/1000)*100,100)}%`}}/>
            </div>
            <p className="text-xs text-indigo-600 mt-1">💡 Minimum 1,000 clicks | Maximum payable clicks: 100,000</p>
          </div>
          <div className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">{user.totalClicks || 0}/1000</div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clicks', value: (user.totalClicks||0).toLocaleString(), sub: 'All links combined', color: 'text-indigo-600' },
          { label: "Today's Clicks", value: (user.todayClicks||0).toLocaleString(), sub: 'Last 24 hours', color: 'text-emerald-600' },
          { label: 'Total Earned', value: `₹${user.totalEarnings.toFixed(2)}`, sub: `Rate: ₹${user.ratePerThousand}/1000`, color: 'text-amber-600' },
          { label: 'Pending Payment', value: `₹${user.unpaidEarnings.toFixed(2)}`, sub: `Paid: ₹${user.paidEarnings.toFixed(2)}`, color: 'text-rose-500' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Last 7 Days Clicks</h3>
          <button onClick={onRefresh} className="text-xs text-indigo-600 hover:text-indigo-700">Refresh</button>
        </div>
        <ClicksLineChart data={last7Days} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase mb-4">Top Countries</h3>
          {topCountries.length === 0 ? <p className="text-gray-400 text-sm">No data yet</p> : (
            <div className="space-y-2">{topCountries.map(c => <div key={c._id} className="flex justify-between py-2 border-b border-gray-100 last:border-0"><span className="text-sm text-gray-600">{c._id}</span><span className="text-sm text-indigo-600 font-medium">{c.count} clicks</span></div>)}</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase mb-4">Earning Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b border-gray-100"><span className="text-gray-500">Rate per 1000 clicks</span><span className="text-gray-800 font-medium">₹{user.ratePerThousand}</span></div>
            <div className="flex justify-between pb-2 border-b border-gray-100"><span className="text-gray-500">Rate per click</span><span className="text-gray-800 font-medium">₹{(user.ratePerThousand/1000).toFixed(4)}</span></div>
            <div className="flex justify-between pb-2 border-b border-gray-100"><span className="text-gray-500">Total earned</span><span className="text-gray-800 font-medium">₹{user.totalEarnings.toFixed(2)}</span></div>
            <div className="flex justify-between pb-2 border-b border-gray-100"><span className="text-gray-500">Already paid</span><span className="text-gray-800 font-medium">₹{user.paidEarnings.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-amber-600">Pending payment</span><span className="text-amber-600 font-semibold">₹{user.unpaidEarnings.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 pt-4">AnimaBing © 2026</div>
    </div>
  );
};

// ─── Links Tab (WITH NULL SAFETY FIX) ─────────────────────
const LinksTab: React.FC<{ links: DashboardData['links']; onToast: any }> = ({ links, onToast }) => {
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    onToast('Link copied to clipboard', 'success');
  };

  // 🛡️ SAFE: handles null/undefined codes
  const displayCode = (code: string | null | undefined): string => {
    if (!code) return '—';
    if (code.length > 15) return code.substring(0, 15) + '...';
    return code;
  };

  // filter out links that are missing a code
  const validLinks = links.filter(link => link && link.code);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-5">My Short Links</h2>
      {validLinks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-sm">
          No links assigned yet. Request a link from the Requests tab.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm table-fixed sm:table-auto">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="text-left p-2 sm:p-4 text-xs font-semibold text-gray-500 uppercase w-[45%] sm:w-auto">
                  Short URL
                </th>
                <th className="text-left p-2 sm:p-4 text-xs font-semibold text-gray-500 uppercase w-[30%] sm:w-auto">
                  Label
                </th>
                <th className="text-left p-2 sm:p-4 text-xs font-semibold text-gray-500 uppercase w-[15%] sm:w-auto">
                  Clicks
                </th>
                <th className="text-left p-2 sm:p-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell sm:w-auto">
                  Last Click
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {validLinks.map((link) => (
                <tr key={link.code} className="hover:bg-gray-50/80 transition">
                  <td className="p-2 sm:p-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Mobile: truncated code */}
                      <span className="sm:hidden text-indigo-600 font-mono text-xs truncate" title={`go.animebing.in/${link.code}`}>
                        go.animebing.in/{displayCode(link.code)}
                      </span>
                      {/* Desktop: full code */}
                      <span className="hidden sm:inline text-indigo-600 font-mono text-sm break-all" title={`go.animebing.in/${link.code}`}>
                        go.animebing.in/{link.code}
                      </span>
                      <button
                        onClick={() => copyLink(link.code)}
                        className="px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200 transition flex-shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm truncate max-w-[120px] sm:overflow-visible sm:whitespace-normal sm:max-w-none"
                    title={link.label || ''}>
                    {link.label || '—'}
                  </td>
                  <td className="p-2 sm:p-4">
                    <span
                      className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold ${
                        link.clicks > 100
                          ? 'bg-emerald-100 text-emerald-700'
                          : link.clicks > 10
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {link.clicks || 0}
                    </span>
                  </td>
                  <td className="p-2 sm:p-4 text-gray-500 text-xs hidden sm:table-cell">
                    {link.lastClicked
                      ? new Date(link.lastClicked).toLocaleDateString('en-IN')
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Profile Tab ──────────────────────────────────
const ProfileTab: React.FC<{ user: any; onProfileUpdate: () => void; token: string; onToast: any; avatarId: number | null; name: string; onOpenAvatarPicker: () => void }> = ({ user, onProfileUpdate, token, onToast, avatarId, name, onOpenAvatarPicker }) => {
  const [form, setForm] = useState({
    mobile: user.profile?.mobile || '', gmail: user.profile?.gmail || '', upiId: user.profile?.upiId || '',
    upiPhone: user.profile?.upiPhone || '', age: user.profile?.age || '', gender: user.profile?.gender || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mobile: form.mobile, gmail: form.gmail.toLowerCase(), upiId: form.upiId, upiPhone: form.upiPhone, age: form.age ? parseInt(form.age as string) : null, gender: form.gender }) });
      const data = await res.json();
      if (!res.ok) onToast(data.error || 'Save failed', 'error');
      else { onToast('Profile saved successfully.', 'success'); onProfileUpdate(); }
    } catch { onToast('Network error', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-3xl shadow-sm">
      <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
        <AvatarDisplay avatarId={avatarId} name={name} size={60} />
        <div>
          <div className="text-base font-semibold text-gray-800">{name}</div>
          <div className="text-xs text-gray-500 mb-2">@{user.username}</div>
          <button onClick={onOpenAvatarPicker} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Change Avatar</button>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-1">Personal Information</h2>
      <p className="text-sm text-gray-500 mb-6">Fill in your details for payment processing.</p>
      {user.gmailLinked && <div className="flex items-center gap-2 mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm"><span className="text-emerald-700 font-medium">Gmail linked:</span><span className="text-gray-600">{user.gmailLinked}</span></div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: 'Mobile', key: 'mobile', type: 'tel', placeholder: '9876543210' },
          { label: 'Gmail', key: 'gmail', type: 'email', placeholder: 'you@gmail.com' },
          { label: 'UPI ID', key: 'upiId', type: 'text', placeholder: 'name@upi' },
          { label: 'UPI Phone', key: 'upiPhone', type: 'tel', placeholder: '9876543210' },
          { label: 'Age', key: 'age', type: 'number', placeholder: '22', min: 14, max: 80 },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">{field.label}</label>
            <input type={field.type} placeholder={field.placeholder} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" value={(form as any)[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} {...(field.min?{min:field.min}:{})} {...(field.max?{max:field.max}:{})} />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Gender</label>
          <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Messages Tab (with emoji avatar) ──────────────────────────
const MessagesTab: React.FC<{ token: string; onRead: () => void; onToast: any; userName: string; avatarId: number | null }> = ({ token, onRead, onToast, userName, avatarId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      onRead();
    } catch { onToast('Failed to load messages', 'error'); } finally { setLoading(false); }
  };
  useEffect(() => { loadMessages(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Send failed', 'error'); return; }
      setText(''); loadMessages();
    } catch { onToast('Network error', 'error'); }
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const av = AVATARS.find(a => a.id === avatarId);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f3f4f6' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-full"><div className="animate-spin h-6 w-6 border-4 border-gray-200 border-t-indigo-600 rounded-full"/></div>
        ) : messages.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No messages yet.</p>
        ) : messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.fromAdmin ? 'justify-start' : 'justify-end'}`}>
            {msg.fromAdmin ? (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-300 flex-shrink-0 flex items-center justify-center text-indigo-600 font-semibold text-xs">A</div>
                <div className="max-w-[70%] flex flex-col">
                  <div className="px-4 py-2.5 bg-white text-gray-800 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-sm leading-relaxed break-words shadow-sm">{msg.text}</div>
                  <div className="flex items-center gap-1 mt-1 ml-1"><span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span><span className="text-[10px] text-gray-500 font-medium">Admin</span></div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 flex-row-reverse">
                {av ? (
                  <div style={{ width: 28, height: 28, background: av.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{av.emoji}</div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex-shrink-0 flex items-center justify-center text-emerald-700 font-semibold text-xs">{userName.charAt(0).toUpperCase()}</div>
                )}
                <div className="max-w-[70%] flex flex-col items-end">
                  <div className="px-4 py-2.5 bg-[#dcf8c6] text-gray-800 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl text-sm leading-relaxed break-words shadow-sm">{msg.text}</div>
                  <div className="flex items-center gap-1 mt-1 mr-1"><span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span></div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>
      <div className="p-3 border-t border-gray-200 bg-gray-100 flex gap-3 items-center">
        <input type="text" placeholder="Type a message..." className="flex-1 bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
        <button onClick={sendMessage} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"/></svg>
        </button>
      </div>
    </div>
  );
};

// ─── Requests Tab ──────────────────────────────────
const RequestsTab: React.FC<{ data: DashboardData; onRefresh: () => void; token: string; onToast: any }> = ({ data, onRefresh, token, onToast }) => {
  const [linkMsg, setLinkMsg] = useState('');

  const canPayRequest = (data.user.totalClicks || 0) >= 1000 && (data.user.unpaidEarnings || 0) > 0;

  const requestPayment = async () => {
    try {
      const res = await fetch(`${API_BASE}/request/payment`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success'); onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  const requestLink = async () => {
    if (!linkMsg.trim()) { onToast('Please add a message for the admin.', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/request/link`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: linkMsg }) });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Link request sent!', 'success');
      setLinkMsg(''); onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Payment Request</h3>
        <p className="text-sm text-gray-500 mb-5">Reach 1,000 total clicks with pending earnings to request payment (max payable clicks: 100,000).</p>
        {data.pendingPaymentRequest ? (
          <span className="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium">Request Pending</span>
        ) : canPayRequest ? (
          <div>
            <p className="text-emerald-600 text-sm mb-4">You are eligible! Pending amount: ₹{data.user.unpaidEarnings.toFixed(2)}</p>
            <button onClick={requestPayment} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">Request Payment</button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-2">Progress: {data.user.totalClicks || 0}/1000 clicks</p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{width:`${Math.min(((data.user.totalClicks||0)/1000)*100,100)}%`}}/>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Request More Links</h3>
        <p className="text-sm text-gray-500 mb-5">Write a message to admin describing which link you need.</p>
        {data.pendingLinkRequest ? (
          <span className="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium">Link Request Pending</span>
        ) : (
          <div className="space-y-4">
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 resize-none h-28 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              placeholder="e.g. Mujhe Naruto Shippuden ke liye ek link chahiye..."
              value={linkMsg}
              onChange={e => setLinkMsg(e.target.value)}
            />
            <button onClick={requestLink} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-sm">Send Request</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Create Link Tab ──────────────────────────────
const CreateLinkTab: React.FC<{ token: string; onRefresh: () => void; onToast: any }> = ({ token, onRefresh, onToast }) => {
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [animeSearch, setAnimeSearch] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [fetchingAnime, setFetchingAnime] = useState(false);
  const [animeFetchError, setAnimeFetchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [displayCount, setDisplayCount] = useState(30);

  useEffect(() => {
    const fetchAnime = async () => {
      setFetchingAnime(true); setAnimeFetchError(null);
      try {
        const res = await fetch(`${ANIME_API_BASE}?limit=1000`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) setAnimeList(json.data);
        else throw new Error('Invalid response format');
      } catch { setAnimeFetchError('Could not load anime list.'); }
      finally { setFetchingAnime(false); }
    };
    fetchAnime();
  }, []);

  const filteredAnime = animeSearch.trim() ? animeList.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase())) : animeList.slice(0, displayCount);
  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => { if (animeSearch.trim()) return; if (e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 40) setDisplayCount(prev => prev + 30); };

  const handleCreateLink = async () => {
    if (!selectedAnime) { onToast('Please select an anime first.', 'error'); return; }
    if (customCode && !/^[a-zA-Z0-9-_]+$/.test(customCode)) { onToast('Custom code: only letters, numbers, - and _', 'error'); return; }
    if (customCode && (customCode.length < 3 || customCode.length > 30)) { onToast('Custom code must be 3–30 characters', 'error'); return; }
    setCreating(true);
    try {
      const payload = { animeId: selectedAnime._id, animeTitle: selectedAnime.title, animeSlug: selectedAnime.slug || selectedAnime.title.replace(/\s+/g, '-').toLowerCase(), customCode: customCode || undefined, label: label.trim() || selectedAnime.title };
      const res = await fetch(`${API_BASE}/create-link`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Failed to create link', 'error'); return; }
      onToast(data.message || 'Link created successfully!', 'success');
      setSelectedAnime(null); setAnimeSearch(''); setCustomCode(''); setLabel(''); setShowDropdown(false); setDisplayCount(30);
      onRefresh();
    } catch { onToast('Network error', 'error'); } finally { setCreating(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-3xl shadow-sm">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Create Your Own Short Link</h2>
      <p className="text-sm text-gray-500 mb-5">Select an anime from our website. A short link will be generated automatically (or you can provide a custom code).</p>
      {selectedAnime && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl mb-4">
          <span className="text-sm font-medium text-indigo-700">Selected: {selectedAnime.title}</span>
          <button onClick={() => setSelectedAnime(null)} className="ml-auto text-indigo-400 hover:text-indigo-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      )}
      <div className="relative mb-4">
        <input type="text" placeholder="Search anime..." value={animeSearch} onChange={e => { setAnimeSearch(e.target.value); setDisplayCount(30); if (!showDropdown) setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 150)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" />
        {fetchingAnime && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"/></div>}
      </div>
      {showDropdown && !animeFetchError && (
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-sm mb-4" onScroll={handleDropdownScroll}>
          {filteredAnime.length === 0 ? <p className="text-gray-400 text-center py-4 text-sm">No anime found</p> : filteredAnime.map(anime => <button key={anime._id} onMouseDown={() => { setSelectedAnime(anime); setAnimeSearch(''); setShowDropdown(false); setDisplayCount(30); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition border-b border-gray-100 last:border-0">{anime.title}</button>)}
          {!animeSearch.trim() && displayCount < animeList.length && <div className="text-center py-2.5 text-xs text-gray-400 border-t border-gray-100">↓ Scroll for more ({animeList.length - displayCount} remaining)</div>}
        </div>
      )}
      {animeFetchError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded mb-4">{animeFetchError}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Custom Code (optional)</label>
          <input type="text" placeholder="e.g., naruto-shippuden" value={customCode} onChange={e => setCustomCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" />
          <p className="text-gray-400 text-xs mt-1">3–30 characters, only letters, numbers, - and _</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Label (optional)</label>
          <input type="text" placeholder="Anime title or description" value={label} onChange={e => setLabel(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition" />
        </div>
      </div>
      <button onClick={handleCreateLink} disabled={creating || !selectedAnime} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition disabled:opacity-50">
        {creating ? 'Creating...' : 'Create Link'}
      </button>
      <p className="text-xs text-gray-400 mt-4">✅ After creation, your link will appear in the <strong>My Links</strong> tab.</p>
    </div>
  );
};

export default UserDashboard;