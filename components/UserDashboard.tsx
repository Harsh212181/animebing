 import React, { useState, useEffect } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';
const ANIME_API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/anime';

// TypeScript interfaces
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
    canCreateLinks?: boolean;     // ✨ NEW
  };
  links: Array<{
    code: string;
    label?: string;
    clicks: number;
    lastClicked: string | null;
  }>;
  last7Days: Array<{ date: string; clicks: number }>;
  topCountries: Array<{ _id: string; count: number }>;
  unreadMessages: number;
  pendingPaymentRequest: boolean;
  pendingLinkRequest: boolean;
}

interface AnimeItem {
  _id: string;
  title: string;
  slug?: string;    // ✨ NEW (used for link creation)
}

const UserDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('shortUserToken')
  );
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loginError, setLoginError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (token) loadDashboard();
  }, [token]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }
      setDashData(data);
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleLogin = async (credentials: { username?: string; password?: string; gmail?: string }) => {
    setLoginError('');
    try {
      const endpoint = credentials.gmail ? '/login/gmail' : '/login';
      const res = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      localStorage.setItem('shortUserToken', data.token);
      localStorage.setItem('shortUserName', data.user.realName);
      localStorage.setItem('shortUsername', data.user.username);
      setToken(data.token);
      showToast('Login successful', 'success');
    } catch {
      setLoginError('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('shortUserToken');
    localStorage.removeItem('shortUserName');
    localStorage.removeItem('shortUsername');
    setToken(null);
    setDashData(null);
  };

  if (!token) {
    return <LoginForm onLogin={handleLogin} loginError={loginError} />;
  }

  if (!dashData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-600"></div>
      </div>
    );
  }

  const user = dashData.user;
  const name = localStorage.getItem('shortUserName') || user.realName || user.username;
  const showCreateTab = user.canCreateLinks === true;   // ✨ NEW

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            AnimaBing
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{name}</span>
            </div>
            <button
              onClick={() => setActiveTab('messages')}
              className="relative px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
            >
              Messages
              {dashData.unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-8 overflow-x-auto">
          {['overview', 'links', 'profile', 'messages', 'requests'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'links' && 'My Links'}
              {tab === 'profile' && 'Profile'}
              {tab === 'messages' && (
                <span className="flex items-center gap-1.5">
                  Messages
                  {dashData.unreadMessages > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-xs font-semibold">
                      {dashData.unreadMessages}
                    </span>
                  )}
                </span>
              )}
              {tab === 'requests' && 'Requests'}
            </button>
          ))}
          {/* ✨ NEW: Create Link tab (only if user has permission) */}
          {showCreateTab && (
            <button
              onClick={() => setActiveTab('create')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'create'
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Create Link
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'overview' && <OverviewTab data={dashData} onRefresh={loadDashboard} onToast={showToast} />}
        {activeTab === 'links' && <LinksTab links={dashData.links} onToast={showToast} />}
        {activeTab === 'profile' && <ProfileTab user={user} onProfileUpdate={loadDashboard} token={token!} onToast={showToast} />}
        {activeTab === 'messages' && <MessagesTab token={token!} onRead={() => loadDashboard()} onToast={showToast} userName={name} />}
        {activeTab === 'requests' && <RequestsTab data={dashData} onRefresh={loadDashboard} token={token!} onToast={showToast} />}
        {/* ✨ NEW: Create Link Tab */}
        {activeTab === 'create' && showCreateTab && (
          <CreateLinkTab token={token!} onRefresh={loadDashboard} onToast={showToast} />
        )}
      </main>

      {/* Toast Notifications */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 duration-200">
          <div
            className={`px-4 py-2 rounded-lg text-sm shadow-lg ${
              toastMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toastMsg.text}
          </div>
        </div>
      )}
    </div>
  );
};

// ======================= LOGIN FORM (unchanged) =======================
const LoginForm: React.FC<{ onLogin: (cred: any) => void; loginError: string }> = ({ onLogin, loginError }) => {
  const [loginMode, setLoginMode] = useState<'password' | 'gmail'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gmail, setGmail] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    onLogin({ username, password });
  };

  const handleGmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmail) return;
    onLogin({ gmail });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            AnimaBing
          </h1>
          <p className="text-gray-500 text-sm mt-1">User Dashboard</p>
        </div>

        {loginMode === 'password' && (
          <>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="text"
                placeholder="Username"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 mb-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 mb-4 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {loginError && <p className="text-red-500 text-xs mb-3">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-md transition"
              >
                Login
              </button>
            </form>

            <div className="flex items-center gap-3 my-6 text-gray-400 text-xs">
              <div className="flex-1 h-px bg-gray-200"></div>
              OR
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            <button
              onClick={() => setLoginMode('gmail')}
              className="w-full py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition"
            >
              Login with Gmail
            </button>
          </>
        )}

        {loginMode === 'gmail' && (
          <>
            <form onSubmit={handleGmailSubmit}>
              <input
                type="email"
                placeholder="yourname@gmail.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 mb-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                value={gmail}
                onChange={e => setGmail(e.target.value)}
              />
              <p className="text-gray-400 text-xs mb-3">
                Your Gmail must be saved in your profile. Admin links accounts manually.
              </p>
              {loginError && <p className="text-red-500 text-xs mb-3">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-md transition"
              >
                Login via Gmail
              </button>
            </form>

            <div className="flex items-center gap-3 my-6 text-gray-400 text-xs">
              <div className="flex-1 h-px bg-gray-200"></div>
              OR
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            <button
              onClick={() => setLoginMode('password')}
              className="w-full py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition"
            >
              Login with Username &amp; Password
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ======================= CHART COMPONENT (unchanged) =======================
const ClicksLineChart: React.FC<{ data: Array<{ date: string; clicks: number }> }> = ({ data }) => {
  const [hoverPoint, setHoverPoint] = useState<{ index: number; x: number; y: number } | null>(null);
  const chartRef = React.useRef<SVGSVGElement>(null);

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No click data available
      </div>
    );
  }

  const width = 800;
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const clicks = data.map(d => d.clicks);
  const maxClicks = Math.max(...clicks, 1);
  const yMax = Math.ceil(maxClicks * 1.1);

  const getX = (index: number) => margin.left + (index / (data.length - 1)) * innerWidth;
  const getY = (clicks: number) => margin.top + innerHeight - (clicks / yMax) * innerHeight;

  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.clicks), clicks: d.clicks, date: d.date }));
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${getX(data.length - 1)} ${margin.top + innerHeight} L ${getX(0)} ${margin.top + innerHeight} Z`;
  const yTicks = [0, Math.floor(yMax / 2), yMax];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const svgRect = chartRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const svgWidth = svgRect.width;
    const scale = width / svgWidth;
    const xCoord = mouseX * scale;

    let minDist = Infinity;
    let closestIndex = -1;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - xCoord);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = idx;
      }
    });
    if (closestIndex !== -1 && minDist < 30) {
      setHoverPoint({ index: closestIndex, x: points[closestIndex].x, y: points[closestIndex].y });
    } else {
      setHoverPoint(null);
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={chartRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPoint(null)}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <defs>
          <linearGradient id="areaGradientLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="lineGradientLight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {yTicks.map(tick => {
          const y = margin.top + innerHeight - (tick / yMax) * innerHeight;
          return (
            <g key={tick}>
              <line x1={margin.left} y1={y} x2={margin.left + innerWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
              <text x={margin.left - 8} y={y + 4} fill="#9ca3af" fontSize="11" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="#d1d5db" strokeWidth="1.5" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#d1d5db" strokeWidth="1.5" />

        <path d={areaPath} fill="url(#areaGradientLight)" />
        <path d={linePath} fill="none" stroke="url(#lineGradientLight)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, i) => (
          <g key={i}>
            <circle cx={point.x} cy={point.y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" style={{ cursor: 'pointer' }} />
            <text x={point.x} y={point.y - 8} fill="#374151" fontSize="10" textAnchor="middle" className="font-medium">
              {point.clicks}
            </text>
          </g>
        ))}

        {points.map((point, i) => (
          <text
            key={`label-${i}`}
            x={point.x}
            y={margin.top + innerHeight + 18}
            fill="#6b7280"
            fontSize="10"
            textAnchor="middle"
            transform={i % 2 === 1 ? `rotate(-15, ${point.x}, ${margin.top + innerHeight + 18})` : undefined}
          >
            {point.date}
          </text>
        ))}

        {hoverPoint && (
          <g transform={`translate(${hoverPoint.x + 10}, ${hoverPoint.y - 15})`}>
            <rect x="-30" y="-20" width="60" height="24" rx="4" fill="#1f2937" opacity="0.95" />
            <text x="0" y="-2" fill="#f3f4f6" fontSize="11" textAnchor="middle" className="font-medium">
              {data[hoverPoint.index].clicks} clicks
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// ======================= OVERVIEW TAB (unchanged) =======================
const OverviewTab: React.FC<{ data: DashboardData; onRefresh: () => void; onToast: (msg: string, type: 'success' | 'error') => void }> = ({ data, onRefresh, onToast }) => {
  const { user, last7Days, topCountries } = data;
  const canPayRequest = (user.totalClicks || 0) >= 1000 && (user.unpaidEarnings || 0) > 0;

  const requestPayment = async () => {
    try {
      const res = await fetch(`${API_BASE}/request/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('shortUserToken')}` }
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success');
      onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  return (
    <div className="space-y-6">
      {canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-emerald-700 font-semibold text-base">Payment Request Available</h3>
            <p className="text-emerald-600 text-sm">You can now request your ₹{user.unpaidEarnings.toFixed(2)} pending payment.</p>
          </div>
          <button onClick={requestPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">
            Request Payment
          </button>
        </div>
      )}
      {data.pendingPaymentRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-amber-700 font-semibold text-base">Payment Request Pending</h3>
            <p className="text-amber-600 text-sm">Your payment request is under review.</p>
          </div>
          <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>
        </div>
      )}
      {!canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-indigo-700 font-semibold text-base">Keep Growing</h3>
            <p className="text-indigo-600 text-sm">
              You need {Math.max(0, 1000 - (user.totalClicks || 0))} more clicks to unlock payment requests. Total: {user.totalClicks || 0}/1000
            </p>
          </div>
          <div className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
            {user.totalClicks || 0}/1000
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Clicks</div>
          <div className="text-3xl font-bold text-indigo-600">{user.totalClicks.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">All links combined</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Today's Clicks</div>
          <div className="text-3xl font-bold text-emerald-600">{user.todayClicks.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Last 24 hours</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Earned</div>
          <div className="text-3xl font-bold text-amber-600">₹{user.totalEarnings.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">Rate: ₹{user.ratePerThousand}/1000</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pending Payment</div>
          <div className="text-3xl font-bold text-rose-500">₹{user.unpaidEarnings.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">Paid: ₹{user.paidEarnings.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Last 7 Days Clicks</h3>
          <button onClick={onRefresh} className="text-xs text-indigo-600 hover:text-indigo-700 transition">Refresh</button>
        </div>
        <ClicksLineChart data={last7Days} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Top Countries</h3>
          {topCountries.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topCountries.map(c => (
                <div key={c._id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{c._id}</span>
                  <span className="text-sm text-indigo-600 font-medium">{c.count} clicks</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Earning Details</h3>
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

// ======================= LINKS TAB (unchanged) =======================
const LinksTab: React.FC<{ links: DashboardData['links']; onToast: (msg: string, type: 'success' | 'error') => void }> = ({ links, onToast }) => {
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    onToast('Link copied to clipboard', 'success');
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-5">My Short Links</h2>
      {links.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-sm">
          No links assigned yet. Request a link from the Requests tab.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Short URL</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Label</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Click</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {links.map(link => (
                  <tr key={link.code} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-indigo-600 font-mono text-sm">go.animebing.in/{link.code}</td>
                    <td className="p-4 text-gray-600">{link.label || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        link.clicks > 100 ? 'bg-emerald-100 text-emerald-700' :
                        link.clicks > 10 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {link.clicks || 0}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      {link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => copyLink(link.code)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-200 transition"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ======================= PROFILE TAB (unchanged) =======================
const ProfileTab: React.FC<{ user: DashboardData['user']; onProfileUpdate: () => void; token: string; onToast: any }> = ({ user, onProfileUpdate, token, onToast }) => {
  const [form, setForm] = useState({
    mobile: user.profile?.mobile || '',
    gmail: user.profile?.gmail || '',
    upiId: user.profile?.upiId || '',
    upiPhone: user.profile?.upiPhone || '',
    age: user.profile?.age || '',
    gender: user.profile?.gender || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mobile: form.mobile,
          gmail: form.gmail.toLowerCase(),
          upiId: form.upiId,
          upiPhone: form.upiPhone,
          age: form.age ? parseInt(form.age as string) : null,
          gender: form.gender
        })
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Save failed', 'error'); }
      else {
        onToast('Profile saved successfully. Gmail login is now enabled.', 'success');
        onProfileUpdate();
      }
    } catch {
      onToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-3xl shadow-sm">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Personal Information</h2>
      <p className="text-sm text-gray-500 mb-6">Fill in your details for payment processing.</p>

      {user.gmailLinked && (
        <div className="flex items-center gap-2 mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <span className="text-emerald-700 text-sm font-medium">Gmail linked: {user.gmailLinked}</span>
          <span className="text-gray-500 text-xs">You can login with this Gmail.</span>
        </div>
      )}

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
            <input
              type={field.type}
              placeholder={field.placeholder}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              value={(form as any)[field.key]}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
              {...(field.min ? { min: field.min } : {})}
              {...(field.max ? { max: field.max } : {})}
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Gender</label>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value })}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-md transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ======================= MESSAGES TAB (unchanged) =======================
const MessagesTab: React.FC<{ token: string; onRead: () => void; onToast: any; userName: string }> = ({ token, onRead, onToast, userName }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      onRead();
    } catch {
      onToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, []);

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.error || 'Send failed', 'error'); return; }
      setText('');
      loadMessages();
    } catch {
      onToast('Network error', 'error');
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        backgroundColor: '#f3f4f6'
      }}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-6 w-6 border-4 border-gray-200 border-t-indigo-600 rounded-full"></div>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No messages yet. Send a message to admin.</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.fromAdmin ? 'justify-start' : 'justify-end'}`}>
              {msg.fromAdmin ? (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-300 flex-shrink-0 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                    A
                  </div>
                  <div className="max-w-[70%] flex flex-col">
                    <div className="px-4 py-2.5 bg-white text-gray-800 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-sm leading-relaxed break-words shadow-sm">
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <span className="text-[10px] text-gray-400">
                        {formatTime(msg.createdAt)}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">Admin</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[70%] flex flex-col items-end">
                  <div className="px-4 py-2.5 bg-[#dcf8c6] text-gray-800 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl text-sm leading-relaxed break-words shadow-sm">
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1 mr-1">
                    <span className="text-[10px] text-gray-400">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-100 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ======================= REQUESTS TAB (unchanged) =======================
const RequestsTab: React.FC<{ data: DashboardData; onRefresh: () => void; token: string; onToast: any }> = ({ data, onRefresh, token, onToast }) => {
  const [linkMsg, setLinkMsg] = useState('');
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [animeSearch, setAnimeSearch] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [fetchingAnime, setFetchingAnime] = useState(false);
  const [animeFetchError, setAnimeFetchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [displayCount, setDisplayCount] = useState(30);

  useEffect(() => {
    const fetchAnime = async () => {
      setFetchingAnime(true);
      setAnimeFetchError(null);
      try {
        const res = await fetch(`${ANIME_API_BASE}?limit=1000`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAnimeList(json.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching anime:', err);
        setAnimeFetchError('Could not load anime list. Please try again later.');
      } finally {
        setFetchingAnime(false);
      }
    };
    fetchAnime();
  }, []);

  const filteredAnime = animeSearch.trim()
    ? animeList.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase()))
    : animeList.slice(0, displayCount);

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (animeSearch.trim()) return;
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      setDisplayCount(prev => prev + 30);
    }
  };

  const requestPayment = async () => {
    try {
      const res = await fetch(`${API_BASE}/request/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Payment request sent!', 'success');
      onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  const requestLink = async () => {
    let finalMessage = linkMsg;
    if (selectedAnime) {
      const animeInfo = `Link request for anime: ${selectedAnime.title} (ID: ${selectedAnime._id})`;
      finalMessage = finalMessage ? `${animeInfo}\n${finalMessage}` : animeInfo;
    }
    if (!finalMessage.trim() && !selectedAnime) {
      onToast('Please select an anime or add a message.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/request/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: finalMessage })
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Link request sent!', 'success');
      setLinkMsg('');
      setSelectedAnime(null);
      setAnimeSearch('');
      setShowDropdown(false);
      setDisplayCount(30);
      onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  const canPayRequest = (data.user.totalClicks || 0) >= 1000 && (data.user.unpaidEarnings || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Payment Request */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Payment Request</h3>
        <p className="text-sm text-gray-500 mb-5">Once you reach 1000 total clicks and have pending earnings, you can request payment. Ensure UPI details are filled in Profile.</p>
        {data.pendingPaymentRequest ? (
          <span className="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">Request Pending — Admin will process soon</span>
        ) : canPayRequest ? (
          <div>
            <p className="text-emerald-600 text-sm mb-4">You are eligible! Pending amount: ₹{data.user.unpaidEarnings.toFixed(2)}</p>
            <button onClick={requestPayment} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">Request Payment</button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-2">Progress: {data.user.totalClicks || 0}/1000 clicks</p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{ width: `${Math.min(((data.user.totalClicks||0)/1000)*100,100)}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Request More Links */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Request More Links</h3>
        <p className="text-sm text-gray-500 mb-5">Select an anime for which you need a short link. You can also add a note.</p>
        {data.pendingLinkRequest ? (
          <span className="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">Link Request Pending — Admin will assign soon</span>
        ) : (
          <div className="space-y-4">
            {selectedAnime && (
              <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <span className="text-sm font-medium text-indigo-700">Selected: {selectedAnime.title}</span>
                <button onClick={() => setSelectedAnime(null)} className="ml-auto text-indigo-400 hover:text-indigo-600 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="relative">
              <input type="text" placeholder="Search anime..." value={animeSearch} onChange={e => { setAnimeSearch(e.target.value); setDisplayCount(30); if (!showDropdown) setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 150)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" />
              {fetchingAnime && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}
            </div>
            {animeFetchError && !fetchingAnime && <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{animeFetchError}</p>}
            {showDropdown && !animeFetchError && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm" onScroll={handleDropdownScroll}>
                {filteredAnime.length === 0 ? <p className="text-gray-400 text-center py-4 text-sm">No anime found</p> : (
                  <>
                    {filteredAnime.map(anime => (
                      <button key={anime._id} onMouseDown={() => { setSelectedAnime(anime); setAnimeSearch(''); setShowDropdown(false); setDisplayCount(30); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition border-b border-gray-100 last:border-0">
                        {anime.title}
                      </button>
                    ))}
                    {!animeSearch.trim() && displayCount < animeList.length && <div className="text-center py-2.5 text-xs text-gray-400 border-t border-gray-100">↓ Scroll karo — {animeList.length - displayCount} aur anime baaki hain</div>}
                    {!animeSearch.trim() && displayCount >= animeList.length && animeList.length > 30 && <div className="text-center py-2.5 text-xs text-gray-400 border-t border-gray-100">✓ Saari anime load ho gayi ({animeList.length} total)</div>}
                  </>
                )}
              </div>
            )}
            <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 mb-2 resize-none h-24 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Additional note for admin (optional)..." value={linkMsg} onChange={e => setLinkMsg(e.target.value)} />
            <button onClick={requestLink} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm">Request More Links</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ======================= ✨ NEW CREATE LINK TAB =======================
const CreateLinkTab: React.FC<{ token: string; onRefresh: () => void; onToast: (msg: string, type: 'success' | 'error') => void }> = ({ token, onRefresh, onToast }) => {
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
      setFetchingAnime(true);
      setAnimeFetchError(null);
      try {
        const res = await fetch(`${ANIME_API_BASE}?limit=1000`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAnimeList(json.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching anime:', err);
        setAnimeFetchError('Could not load anime list. Please try again later.');
      } finally {
        setFetchingAnime(false);
      }
    };
    fetchAnime();
  }, []);

  const filteredAnime = animeSearch.trim()
    ? animeList.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase()))
    : animeList.slice(0, displayCount);

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (animeSearch.trim()) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setDisplayCount(prev => prev + 30);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedAnime) {
      onToast('Please select an anime first.', 'error');
      return;
    }
    if (customCode && !/^[a-zA-Z0-9-_]+$/.test(customCode)) {
      onToast('Custom code can only contain letters, numbers, - and _', 'error');
      return;
    }
    if (customCode && (customCode.length < 3 || customCode.length > 30)) {
      onToast('Custom code must be 3–30 characters', 'error');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        animeId: selectedAnime._id,
        animeTitle: selectedAnime.title,
        animeSlug: selectedAnime.slug || selectedAnime.title.replace(/\s+/g, '-').toLowerCase(),
        customCode: customCode || undefined,
        label: label.trim() || selectedAnime.title
      };
      const res = await fetch(`${API_BASE}/create-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || 'Failed to create link', 'error');
        return;
      }
      onToast(data.message || 'Link created successfully!', 'success');
      // Reset form
      setSelectedAnime(null);
      setAnimeSearch('');
      setCustomCode('');
      setLabel('');
      setShowDropdown(false);
      setDisplayCount(30);
      // Refresh dashboard to show the new link in "My Links"
      onRefresh();
    } catch (err) {
      onToast('Network error', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-3xl shadow-sm">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Create Your Own Short Link</h2>
      <p className="text-sm text-gray-500 mb-5">
        Select an anime from our website. A short link will be generated automatically (or you can provide a custom code).
      </p>

      {selectedAnime && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4">
          <span className="text-sm font-medium text-indigo-700">Selected: {selectedAnime.title}</span>
          <button onClick={() => setSelectedAnime(null)} className="ml-auto text-indigo-400 hover:text-indigo-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="relative mb-4">
        <input type="text" placeholder="Search anime..." value={animeSearch} onChange={e => { setAnimeSearch(e.target.value); setDisplayCount(30); if (!showDropdown) setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 150)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" />
        {fetchingAnime && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}
      </div>

      {showDropdown && !animeFetchError && (
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm mb-4" onScroll={handleDropdownScroll}>
          {filteredAnime.length === 0 ? <p className="text-gray-400 text-center py-4 text-sm">No anime found</p> : (
            <>
              {filteredAnime.map(anime => (
                <button key={anime._id} onMouseDown={() => { setSelectedAnime(anime); setAnimeSearch(''); setShowDropdown(false); setDisplayCount(30); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition border-b border-gray-100 last:border-0">
                  {anime.title}
                </button>
              ))}
              {!animeSearch.trim() && displayCount < animeList.length && <div className="text-center py-2.5 text-xs text-gray-400 border-t border-gray-100">↓ Scroll karo — {animeList.length - displayCount} aur anime baaki hain</div>}
              {!animeSearch.trim() && displayCount >= animeList.length && animeList.length > 30 && <div className="text-center py-2.5 text-xs text-gray-400 border-t border-gray-100">✓ All anime loaded ({animeList.length} total)</div>}
            </>
          )}
        </div>
      )}

      {animeFetchError && !fetchingAnime && (
        <p className="text-sm text-red-500 bg-red-50 p-2 rounded mb-4">{animeFetchError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Custom Code (optional)</label>
          <input type="text" placeholder="e.g., naruto-shippuden" value={customCode} onChange={e => setCustomCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" />
          <p className="text-gray-400 text-xs mt-1">3–30 characters, only letters, numbers, - and _</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Label (optional)</label>
          <input type="text" placeholder="Anime title or description" value={label} onChange={e => setLabel(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" />
        </div>
      </div>

      <button onClick={handleCreateLink} disabled={creating || !selectedAnime} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
        {creating ? 'Creating...' : 'Create Link'}
      </button>

      <p className="text-xs text-gray-400 mt-4">
        ✅ After creation, your link will appear in the <strong>My Links</strong> tab. You can copy and share it anywhere.
      </p>
    </div>
  );
};

export default UserDashboard;