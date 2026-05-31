import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users';

// TypeScript interfaces (simplified, you can move to types.ts)
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

const UserDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('shortUserToken')
  );
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loginError, setLoginError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-load dashboard if token exists
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

  // If not logged in, show login form
  if (!token) {
    return <LoginForm onLogin={handleLogin} loginError={loginError} />;
  }

  // Loading state
  if (!dashData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-600 border-t-purple-500"></div>
      </div>
    );
  }

  const user = dashData.user;
  const name = localStorage.getItem('shortUserName') || user.realName || user.username;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          AnimaBing
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-400">{name}</span>
          <button
            onClick={() => setActiveTab('messages')}
            className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs relative"
          >
            💬 Messages
            {dashData.unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-slate-800"></span>
            )}
          </button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-xs">
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 flex gap-0 overflow-x-auto">
        {['overview', 'links', 'profile', 'messages', 'requests'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs whitespace-nowrap border-b-2 transition ${
              activeTab === tab
                ? 'text-purple-400 border-purple-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'links' && '🔗 My Links'}
            {tab === 'profile' && '👤 Profile'}
            {tab === 'messages' && (
              <>
                💬 Messages
                {dashData.unreadMessages > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-pink-500 text-white rounded-full text-[0.65rem]">
                    {dashData.unreadMessages}
                  </span>
                )}
              </>
            )}
            {tab === 'requests' && '📋 Requests'}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'overview' && <OverviewTab data={dashData} onRefresh={loadDashboard} onToast={showToast} />}
        {activeTab === 'links' && <LinksTab links={dashData.links} />}
        {activeTab === 'profile' && <ProfileTab user={user} onProfileUpdate={loadDashboard} token={token!} onToast={showToast} />}
        {activeTab === 'messages' && <MessagesTab token={token!} onRead={() => loadDashboard()} onToast={showToast} />}
        {activeTab === 'requests' && <RequestsTab data={dashData} onRefresh={loadDashboard} token={token!} onToast={showToast} />}
      </main>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-2 rounded-lg text-sm shadow-lg ${
              toastMsg.type === 'success' ? 'bg-green-900/90 border border-green-700 text-green-300' : 'bg-red-900/90 border border-red-700 text-red-300'
            }`}
          >
            {toastMsg.type === 'success' ? '✅ ' : '❌ '}{toastMsg.text}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Subcomponents (you can extract into separate files) ----------

const LoginForm: React.FC<{ onLogin: (cred: any) => void; loginError: string }> = ({ onLogin, loginError }) => {
  const [loginType, setLoginType] = useState<'password' | 'gmail'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gmail, setGmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginType === 'password') {
      if (!username || !password) return;
      onLogin({ username, password });
    } else {
      if (!gmail) return;
      onLogin({ gmail });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AnimaBing
          </h1>
          <p className="text-slate-500 text-sm mt-1">User Dashboard</p>
        </div>
        {/* Login Tabs */}
        <div className="flex mb-5 bg-slate-900 rounded-lg p-0.5">
          <button
            className={`flex-1 py-1.5 text-xs rounded-md transition ${loginType === 'password' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}
            onClick={() => setLoginType('password')}
          >
            Username & Password
          </button>
          <button
            className={`flex-1 py-1.5 text-xs rounded-md transition ${loginType === 'gmail' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}
            onClick={() => setLoginType('gmail')}
          >
            Gmail Login
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {loginType === 'password' ? (
            <>
              <input
                type="text"
                placeholder="Username"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-3 focus:border-purple-500 outline-none"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-4 focus:border-purple-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="yourname@gmail.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-3 focus:border-purple-500 outline-none"
                value={gmail}
                onChange={e => setGmail(e.target.value)}
              />
              <p className="text-slate-500 text-xs mb-4">
                Your Gmail must be saved in your profile. Admin links accounts manually.
              </p>
            </>
          )}
          {loginError && <p className="text-red-400 text-xs mb-3">{loginError}</p>}
          <button
            type="submit"
            className="w-full py-2 rounded-lg font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90 transition"
          >
            Login
          </button>
        </form>
        <div className="flex items-center gap-3 my-4 text-slate-600 text-xs">
          <div className="flex-1 h-px bg-slate-700"></div>
          OR
          <div className="flex-1 h-px bg-slate-700"></div>
        </div>
        <button
          onClick={() => setLoginType('gmail')}
          className="w-full py-2 rounded-lg bg-white text-slate-800 font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition"
        >
          Login with Gmail
        </button>
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ data: DashboardData; onRefresh: () => void; onToast: (msg: string, type: 'success' | 'error') => void }> = ({ data, onRefresh, onToast }) => {
  const { user, last7Days, topCountries } = data;
  const maxClicks = Math.max(...last7Days.map(d => d.clicks), 1);
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
    <div className="space-y-5">
      {/* Payment banner logic (same as before, converted to JSX) */}
      {canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-emerald-400 font-semibold text-sm">🎉 Payment Request Available!</h3>
            <p className="text-slate-400 text-xs">You can now request your ₹{user.unpaidEarnings.toFixed(2)} pending payment.</p>
          </div>
          <button onClick={requestPayment} className="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition">
            Request Payment
          </button>
        </div>
      )}
      {data.pendingPaymentRequest && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="text-amber-400 font-semibold text-sm">⏳ Payment Request Pending</h3>
            <p className="text-slate-400 text-xs">Your payment request is under review.</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs">Pending</span>
        </div>
      )}
      {!canPayRequest && !data.pendingPaymentRequest && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="text-purple-400 font-semibold text-sm">📈 Keep Going!</h3>
            <p className="text-slate-400 text-xs">
              You need {Math.max(0, 1000 - (user.totalClicks || 0))} more clicks to unlock payment request. Total: {user.totalClicks || 0}/1000
            </p>
          </div>
          <div className="px-4 py-1 bg-purple-500/20 rounded text-purple-300 text-xs font-semibold">
            {user.totalClicks || 0}/1000
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Total Clicks</div>
          <div className="text-2xl font-bold text-purple-400">{user.totalClicks.toLocaleString()}</div>
          <div className="text-xs text-slate-600">All links combined</div>
        </div>
        <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Today's Clicks</div>
          <div className="text-2xl font-bold text-emerald-400">{user.todayClicks.toLocaleString()}</div>
          <div className="text-xs text-slate-600">Today</div>
        </div>
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-amber-400">₹{user.totalEarnings.toFixed(2)}</div>
          <div className="text-xs text-slate-600">Rate: ₹{user.ratePerThousand}/1000</div>
        </div>
        <div className="bg-slate-800 border border-pink-500/30 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-1">Pending Payment</div>
          <div className="text-2xl font-bold text-pink-400">₹{user.unpaidEarnings.toFixed(2)}</div>
          <div className="text-xs text-slate-600">Paid: ₹{user.paidEarnings.toFixed(2)}</div>
        </div>
      </div>

      {/* Last 7 Days Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">Last 7 Days Clicks</h3>
        <div className="flex items-end gap-2 h-28">
          {last7Days.map(day => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
              <span className="text-xs text-slate-500">{day.clicks}</span>
              <div
                className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm"
                style={{ height: `${Math.max((day.clicks / maxClicks) * 100, 3)}%` }}
              ></div>
              <span className="text-xs text-slate-600">{day.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Countries & Earning Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Top Countries</h3>
          {topCountries.length === 0 ? (
            <p className="text-slate-600 text-sm">No data yet</p>
          ) : (
            topCountries.map(c => (
              <div key={c._id} className="flex justify-between py-2 border-b border-slate-700 last:border-0">
                <span className="text-sm text-slate-300">{c._id}</span>
                <span className="text-sm text-purple-400 font-medium">{c.count} clicks</span>
              </div>
            ))
          )}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Earning Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Rate per 1000 clicks</span><span className="text-slate-200">₹{user.ratePerThousand}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Rate per click</span><span className="text-slate-200">₹{(user.ratePerThousand/1000).toFixed(4)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total earned</span><span className="text-slate-200">₹{user.totalEarnings.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Already paid</span><span className="text-slate-200">₹{user.paidEarnings.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-amber-400">Pending payment</span><span className="text-amber-400">₹{user.unpaidEarnings.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-700 mt-8">
        AnimaBing © 2026
        <button onClick={onRefresh} className="ml-2 text-purple-500 hover:underline">↻ Refresh</button>
      </div>
    </div>
  );
};

const LinksTab: React.FC<{ links: DashboardData['links'] }> = ({ links }) => {
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://go.animebing.in/${code}`);
    // You could show a toast, but for simplicity we just alert
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-200 mb-4">My Short Links</h2>
      {links.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-500">
          No links assigned yet. Request a link from the Requests tab.
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3 text-xs text-slate-500 uppercase">Short URL</th>
                <th className="text-left p-3 text-xs text-slate-500 uppercase">Label</th>
                <th className="text-left p-3 text-xs text-slate-500 uppercase">Clicks</th>
                <th className="text-left p-3 text-xs text-slate-500 uppercase">Last Click</th>
                <th className="text-left p-3 text-xs text-slate-500 uppercase">Copy</th>
              </tr>
            </thead>
            <tbody>
              {links.map(link => (
                <tr key={link.code} className="border-t border-slate-700 hover:bg-white/5">
                  <td className="p-3 text-purple-400 font-mono text-xs">go.animebing.in/{link.code}</td>
                  <td className="p-3 text-slate-400">{link.label || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      link.clicks > 100 ? 'bg-emerald-500/20 text-emerald-400' :
                      link.clicks > 10 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-500'
                    }`}>
                      {link.clicks || 0}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 text-xs">
                    {link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => copyLink(link.code)}
                      className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600 text-slate-400"
                    >
                      Copy
                    </button>
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
        onToast('Profile saved! Gmail login is now enabled.', 'success');
        onProfileUpdate();
      }
    } catch {
      onToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-200 mb-1">Personal Information</h2>
      <p className="text-xs text-slate-500 mb-6">Fill in your details for payment processing.</p>

      {user.gmailLinked && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-0.5 text-xs">✉️ Gmail linked: {user.gmailLinked}</span>
          <span className="text-slate-500 text-xs">You can login with this Gmail.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Mobile', key: 'mobile', type: 'tel', placeholder: '9876543210' },
          { label: 'Gmail', key: 'gmail', type: 'email', placeholder: 'you@gmail.com' },
          { label: 'UPI ID', key: 'upiId', type: 'text', placeholder: 'name@upi' },
          { label: 'UPI Phone', key: 'upiPhone', type: 'tel', placeholder: '9876543210' },
          { label: 'Age', key: 'age', type: 'number', placeholder: '22', min: 14, max: 80 },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs text-slate-500 uppercase mb-1 block">{field.label}</label>
            <input
              type={field.type}
              placeholder={field.placeholder}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none"
              value={(form as any)[field.key]}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
              {...(field.min ? { min: field.min } : {})}
              {...(field.max ? { max: field.max } : {})}
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-500 uppercase mb-1 block">Gender</label>
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none"
            value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value })}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

const MessagesTab: React.FC<{ token: string; onRead: () => void; onToast: any }> = ({ token, onRead, onToast }) => {
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
      onRead(); // clear notification badge
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

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 h-96 overflow-y-auto flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center"><div className="animate-spin h-6 w-6 border-4 border-slate-600 border-t-purple-500 rounded-full"></div></div>
        ) : messages.length === 0 ? (
          <p className="text-slate-500 text-center py-10">No messages yet. Send a message to admin.</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`max-w-[80%] ${msg.fromAdmin ? 'self-start' : 'self-end'}`}>
              <div className={`px-3 py-2 rounded-lg text-sm ${
                msg.fromAdmin ? 'bg-purple-500/20 border border-purple-500/30 text-purple-200' : 'bg-slate-700 text-slate-300'
              }`}>
                {msg.text}
              </div>
              <div className="text-xs text-slate-600 mt-1 text-right">
                {msg.fromAdmin ? 'Admin' : 'You'} · {new Date(msg.createdAt).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          placeholder="Type a message to admin..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-500">
          Send
        </button>
      </div>
    </div>
  );
};

const RequestsTab: React.FC<{ data: DashboardData; onRefresh: () => void; token: string; onToast: any }> = ({ data, onRefresh, token, onToast }) => {
  const [linkMsg, setLinkMsg] = useState('');

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
    try {
      const res = await fetch(`${API_BASE}/request/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: linkMsg })
      });
      const d = await res.json();
      if (!res.ok) { onToast(d.error || 'Request failed', 'error'); return; }
      onToast(d.message || 'Link request sent!', 'success');
      setLinkMsg('');
      onRefresh();
    } catch { onToast('Network error', 'error'); }
  };

  const canPayRequest = (data.user.totalClicks || 0) >= 1000 && (data.user.unpaidEarnings || 0) > 0;

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">💰 Payment Request</h3>
        <p className="text-sm text-slate-400 mb-4">Once you reach 1000 total clicks and have pending earnings, you can request payment. Ensure UPI details are filled in Profile.</p>
        {data.pendingPaymentRequest ? (
          <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold">⏳ Request Pending — Admin will process soon</span>
        ) : canPayRequest ? (
          <div>
            <p className="text-emerald-400 text-sm mb-3">✅ You are eligible! Pending amount: ₹{data.user.unpaidEarnings.toFixed(2)}</p>
            <button onClick={requestPayment} className="px-5 py-2 bg-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-500">Request Payment</button>
          </div>
        ) : (
          <div>
            <p className="text-slate-500 text-sm">Progress: {data.user.totalClicks || 0}/1000 clicks</p>
            <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${Math.min(((data.user.totalClicks||0)/1000)*100,100)}%` }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">🔗 Request More Links</h3>
        <p className="text-sm text-slate-400 mb-4">Need more short links? Send a request to admin.</p>
        {data.pendingLinkRequest ? (
          <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold">⏳ Link Request Pending — Admin will assign soon</span>
        ) : (
          <div>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 mb-3 resize-none h-20"
              placeholder="Tell admin why you need more links (optional)..."
              value={linkMsg}
              onChange={e => setLinkMsg(e.target.value)}
            />
            <button onClick={requestLink} className="px-5 py-2 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-500">
              Request More Links
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;