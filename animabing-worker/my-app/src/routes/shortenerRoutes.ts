 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { ObjectId } from 'mongodb'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ ADMIN — ALL LINKS ============
shortenerRoutes.get('/admin/links', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const links = await db.collection('shortlinks')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — CREATE LINK ============
shortenerRoutes.post('/admin/links', adminAuth, async (c) => {
  try {
    const { code, url, label, userId } = await c.req.json()
    if (!code || !url) {
      return c.json({ error: 'code and url are required' }, 400)
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return c.json({ error: 'Code can only contain letters, numbers, - and _' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) {
      return c.json({ error: `"${code}" already exists` }, 400)
    }
    const newLink = {
      code,
      url,
      label: label || code,
      userId: userId ? new ObjectId(userId) : null,
      clicks: 0,
      createdAt: new Date(),
      lastClicked: null
    }
    await db.collection('shortlinks').insertOne(newLink)
    return c.json({ success: true, message: 'Link created!', link: newLink })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE LINK ============
shortenerRoutes.put('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const { url, label, userId } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const updateData: any = { url, label, updatedAt: new Date() }
    if (userId) updateData.userId = new ObjectId(userId)
    await db.collection('shortlinks').updateOne({ code }, { $set: updateData })
    return c.json({ success: true, message: 'Link updated!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — DELETE LINK ============
shortenerRoutes.delete('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('shortlinks').deleteOne({ code })
    return c.json({ success: true, message: 'Link deleted!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ LINK STATS ============
shortenerRoutes.get('/admin/links/:code/stats', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })
    if (!link) return c.json({ error: 'Link not found' }, 404)
    return c.json(link)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER DASHBOARD PAGE ============
shortenerRoutes.get('/dashboard', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AnimaBing — User Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }

    /* ===== LOGIN PAGE ===== */
    #login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .login-box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; width: 100%; max-width: 420px; }
    .login-logo { text-align: center; margin-bottom: 1.5rem; }
    .login-logo h1 { font-size: 1.75rem; font-weight: 700; background: linear-gradient(135deg, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .login-logo p { color: #64748b; font-size: 0.875rem; margin-top: 0.25rem; }
    .login-tabs { display: flex; gap: 0; margin-bottom: 1.25rem; background: #0f172a; border-radius: 10px; padding: 3px; }
    .login-tab { flex: 1; padding: 0.5rem; border: none; background: none; color: #64748b; font-size: 0.8rem; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
    .login-tab.active { background: #7c3aed; color: white; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group input, .form-group select { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.75rem 1rem; color: #e2e8f0; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    .form-group input:focus, .form-group select:focus { border-color: #7c3aed; }
    .btn { width: 100%; padding: 0.75rem; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-gmail { background: #fff; color: #374151; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.75rem; }
    .btn-gmail:hover { background: #f9fafb; transform: translateY(-1px); }
    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0; color: #475569; font-size: 0.75rem; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #334155; }
    .error-msg { color: #f87171; font-size: 0.75rem; margin-top: 0.75rem; text-align: center; }
    .success-msg { color: #34d399; font-size: 0.75rem; margin-top: 0.75rem; text-align: center; }

    /* ===== DASHBOARD ===== */
    #dashboard-page { display: none; }
    .header { background: #1e293b; border-bottom: 1px solid #334155; padding: 0.875rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .header h1 { font-size: 1.1rem; font-weight: 700; background: linear-gradient(135deg, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; flex-wrap: wrap; }
    .user-badge { background: #334155; border-radius: 20px; padding: 0.25rem 0.75rem; font-size: 0.75rem; color: #94a3b8; }
    .notif-btn { position: relative; background: #7c3aed22; border: 1px solid #7c3aed44; color: #a78bfa; padding: 0.35rem 0.6rem; border-radius: 8px; font-size: 0.75rem; cursor: pointer; }
    .notif-dot { position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; background: #ec4899; border-radius: 50%; border: 2px solid #1e293b; display: none; }
    .logout-btn { background: #ef44441a; border: 1px solid #ef444433; color: #fca5a5; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.75rem; cursor: pointer; }

    /* ===== NAV TABS ===== */
    .nav-tabs { background: #1e293b; border-bottom: 1px solid #334155; padding: 0 1.5rem; display: flex; gap: 0; overflow-x: auto; }
    .nav-tab { padding: 0.75rem 1rem; font-size: 0.8rem; color: #64748b; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
    .nav-tab.active { color: #a78bfa; border-bottom-color: #7c3aed; }
    .nav-tab:hover { color: #e2e8f0; }
    .nav-tab .badge { background: #ec4899; color: white; border-radius: 10px; padding: 0.1rem 0.4rem; font-size: 0.65rem; margin-left: 0.25rem; }

    .container { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }

    /* ===== STATS CARDS ===== */
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    @media(min-width: 640px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }
    .stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; }
    .stat-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .stat-value { font-size: 1.75rem; font-weight: 700; color: #e2e8f0; }
    .stat-sub { font-size: 0.7rem; color: #64748b; margin-top: 0.25rem; }
    .stat-card.green { border-color: #10b98133; background: #10b9811a; }
    .stat-card.green .stat-value { color: #34d399; }
    .stat-card.purple { border-color: #7c3aed33; background: #7c3aed1a; }
    .stat-card.purple .stat-value { color: #a78bfa; }
    .stat-card.pink { border-color: #ec489933; background: #ec48991a; }
    .stat-card.pink .stat-value { color: #f9a8d4; }
    .stat-card.amber { border-color: #f59e0b33; background: #f59e0b1a; }
    .stat-card.amber .stat-value { color: #fbbf24; }

    /* ===== PAYMENT REQUEST BANNER ===== */
    .pay-banner { background: linear-gradient(135deg, #10b98115, #0d947415); border: 1px solid #10b98133; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .pay-banner-text { flex: 1; }
    .pay-banner-text h3 { font-size: 0.9rem; font-weight: 600; color: #34d399; margin-bottom: 0.25rem; }
    .pay-banner-text p { font-size: 0.8rem; color: #64748b; }
    .btn-pay { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-pay:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-pay:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* ===== CHART ===== */
    .chart-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .chart-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; margin-bottom: 1rem; }
    .chart-bars { display: flex; align-items: flex-end; gap: 0.5rem; height: 120px; }
    .chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; height: 100%; justify-content: flex-end; }
    .chart-bar { width: 100%; background: linear-gradient(to top, #7c3aed, #a78bfa); border-radius: 4px 4px 0 0; min-height: 4px; }
    .chart-label { font-size: 0.6rem; color: #64748b; text-align: center; }
    .chart-count { font-size: 0.65rem; color: #94a3b8; }

    /* ===== TABLE ===== */
    .section-title { font-size: 1rem; font-weight: 600; color: #e2e8f0; margin-bottom: 1rem; }
    .table-wrap { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th { background: #ffffff08; padding: 0.75rem 1rem; text-align: left; font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #1e293b33; color: #cbd5e1; }
    tr:hover td { background: #ffffff05; }
    .code-badge { font-family: monospace; color: #a78bfa; font-size: 0.8rem; }
    .clicks-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
    .clicks-high { background: #10b9811a; color: #34d399; }
    .clicks-mid { background: #f59e0b1a; color: #fbbf24; }
    .clicks-low { background: #ffffff0d; color: #64748b; }
    .copy-btn { background: #334155; border: none; color: #94a3b8; padding: 0.25rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; }
    .copy-btn:hover { background: #475569; color: white; }

    /* ===== COUNTRIES ===== */
    .countries-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    @media(min-width: 640px) { .countries-grid { grid-template-columns: 1fr 1fr; } }
    .country-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
    .country-row:last-child { border-bottom: none; }
    .country-name { font-size: 0.8rem; color: #cbd5e1; }
    .country-count { font-size: 0.8rem; font-weight: 600; color: #a78bfa; }

    /* ===== PROFILE SECTION ===== */
    .profile-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; }
    .profile-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
    @media(min-width: 640px) { .profile-grid { grid-template-columns: 1fr 1fr; } }
    @media(min-width: 900px) { .profile-grid { grid-template-columns: 1fr 1fr 1fr; } }
    .profile-field label { display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
    .profile-field input, .profile-field select { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.65rem 0.875rem; color: #e2e8f0; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    .profile-field input:focus, .profile-field select:focus { border-color: #7c3aed; }
    .profile-save-btn { background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; border: none; border-radius: 8px; padding: 0.65rem 1.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 1rem; }
    .profile-save-btn:hover { opacity: 0.9; }
    .profile-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .gmail-linked-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: #10b9811a; border: 1px solid #10b98133; color: #34d399; border-radius: 20px; padding: 0.2rem 0.65rem; font-size: 0.7rem; margin-top: 0.5rem; }

    /* ===== MESSAGES SECTION ===== */
    .messages-wrap { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
    .messages-list { padding: 1rem; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .msg-bubble { max-width: 80%; padding: 0.65rem 0.875rem; border-radius: 12px; font-size: 0.82rem; line-height: 1.4; }
    .msg-bubble.from-admin { background: #7c3aed22; border: 1px solid #7c3aed33; color: #c4b5fd; align-self: flex-start; border-radius: 4px 12px 12px 12px; }
    .msg-bubble.from-user { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; align-self: flex-end; border-radius: 12px 4px 12px 12px; }
    .msg-meta { font-size: 0.65rem; color: #475569; margin-top: 0.25rem; }
    .msg-input-wrap { padding: 1rem; border-top: 1px solid #334155; display: flex; gap: 0.75rem; }
    .msg-input { flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.65rem 0.875rem; color: #e2e8f0; font-size: 0.875rem; outline: none; }
    .msg-input:focus { border-color: #7c3aed; }
    .msg-send-btn { background: #7c3aed; color: white; border: none; border-radius: 8px; padding: 0.65rem 1.25rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .msg-send-btn:hover { background: #6d28d9; }
    .msg-empty { text-align: center; padding: 2rem; color: #475569; font-size: 0.8rem; }

    /* ===== REQUESTS SECTION ===== */
    .request-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
    .request-card h3 { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.5rem; }
    .request-card p { font-size: 0.8rem; color: #64748b; margin-bottom: 1rem; line-height: 1.5; }
    .status-pill { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 20px; padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 600; }
    .status-pending { background: #f59e0b1a; color: #fbbf24; border: 1px solid #f59e0b33; }
    .status-done { background: #10b9811a; color: #34d399; border: 1px solid #10b98133; }
    .status-rejected { background: #ef44441a; color: #fca5a5; border: 1px solid #ef444433; }
    .link-request-btn { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; border: none; border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .link-request-btn:hover { opacity: 0.9; }
    .link-request-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .link-request-msg { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.65rem 0.875rem; color: #e2e8f0; font-size: 0.875rem; outline: none; margin-bottom: 0.75rem; resize: vertical; min-height: 70px; }

    /* ===== LOADING ===== */
    .loading { display: flex; align-items: center; justify-content: center; padding: 3rem; }
    .spinner { width: 32px; height: 32px; border: 3px solid #334155; border-top-color: #7c3aed; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { text-align: center; padding: 2rem; color: #64748b; font-size: 0.875rem; }

    /* ===== TOAST ===== */
    #toast { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; }
    .toast-item { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.8rem; color: #e2e8f0; box-shadow: 0 4px 20px #0005; display: flex; align-items: center; gap: 0.5rem; animation: slideIn 0.3s ease; }
    .toast-item.success { border-color: #10b98144; }
    .toast-item.error { border-color: #ef444444; }
    @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    .section-hidden { display: none; }
  </style>
</head>
<body>

<!-- ===== LOGIN PAGE ===== -->
<div id="login-page">
  <div class="login-box">
    <div class="login-logo">
      <h1>AnimaBing</h1>
      <p>User Dashboard</p>
    </div>

    <div class="login-tabs">
      <button class="login-tab active" onclick="switchLoginTab('password')">Username & Password</button>
      <button class="login-tab" onclick="switchLoginTab('gmail')">Gmail Login</button>
    </div>

    <!-- Password Login -->
    <div id="tab-password">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="username-input" placeholder="Enter username" autocomplete="username">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password-input" placeholder="Enter password" autocomplete="current-password">
      </div>
      <button class="btn btn-primary" id="login-btn" onclick="handleLogin()">Login</button>
    </div>

    <!-- Gmail Login -->
    <div id="tab-gmail" class="section-hidden">
      <div class="form-group">
        <label>Gmail Address</label>
        <input type="email" id="gmail-login-input" placeholder="yourname@gmail.com" autocomplete="email">
      </div>
      <p style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;">
        Your Gmail must be saved in your profile. Admin links accounts manually.
      </p>
      <button class="btn btn-primary" id="gmail-login-btn" onclick="handleGmailLogin()">Login with Gmail</button>
    </div>

    <div id="login-error" class="error-msg"></div>
  </div>
</div>

<!-- ===== DASHBOARD PAGE ===== -->
<div id="dashboard-page">
  <div class="header">
    <h1>AnimaBing</h1>
    <div class="header-right">
      <span class="user-badge" id="user-badge">...</span>
      <button class="notif-btn" onclick="switchTab('messages')" id="notif-btn">
        💬 Messages
        <span class="notif-dot" id="notif-dot"></span>
      </button>
      <button class="logout-btn" onclick="handleLogout()">Logout</button>
    </div>
  </div>

  <!-- Nav Tabs -->
  <div class="nav-tabs">
    <button class="nav-tab active" data-tab="overview" onclick="switchTab('overview')">📊 Overview</button>
    <button class="nav-tab" data-tab="links" onclick="switchTab('links')">🔗 My Links</button>
    <button class="nav-tab" data-tab="profile" onclick="switchTab('profile')">👤 Profile</button>
    <button class="nav-tab" data-tab="messages" onclick="switchTab('messages')">
      💬 Messages <span class="badge" id="msg-badge" style="display:none">0</span>
    </button>
    <button class="nav-tab" data-tab="requests" onclick="switchTab('requests')">📋 Requests</button>
  </div>

  <div class="container">

    <!-- ===== OVERVIEW TAB ===== -->
    <div id="tab-overview">
      <div id="overview-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ===== LINKS TAB ===== -->
    <div id="tab-links" class="section-hidden">
      <div id="links-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ===== PROFILE TAB ===== -->
    <div id="tab-profile" class="section-hidden">
      <div class="profile-card">
        <h2 style="font-size:1rem;font-weight:600;color:#e2e8f0;margin-bottom:0.25rem;">Personal Information</h2>
        <p style="font-size:0.8rem;color:#64748b;margin-bottom:1.25rem;">Fill in your details for payment processing. Your UPI info is required for payment requests.</p>

        <div id="gmail-linked-info" style="display:none;margin-bottom:1rem;"></div>

        <div class="profile-grid">
          <div class="profile-field">
            <label>Mobile Number</label>
            <input type="tel" id="p-mobile" placeholder="9876543210">
          </div>
          <div class="profile-field">
            <label>Gmail Address</label>
            <input type="email" id="p-gmail" placeholder="you@gmail.com">
          </div>
          <div class="profile-field">
            <label>UPI ID</label>
            <input type="text" id="p-upiId" placeholder="name@upi">
          </div>
          <div class="profile-field">
            <label>UPI Phone Number</label>
            <input type="tel" id="p-upiPhone" placeholder="9876543210">
          </div>
          <div class="profile-field">
            <label>Age</label>
            <input type="number" id="p-age" placeholder="22" min="14" max="80">
          </div>
          <div class="profile-field">
            <label>Gender</label>
            <select id="p-gender">
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <button class="profile-save-btn" id="profile-save-btn" onclick="saveProfile()">Save Profile</button>
        <div id="profile-msg" style="font-size:0.8rem;margin-top:0.75rem;"></div>
      </div>
    </div>

    <!-- ===== MESSAGES TAB ===== -->
    <div id="tab-messages" class="section-hidden">
      <div class="messages-wrap">
        <div class="messages-list" id="messages-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div class="msg-input-wrap">
          <input class="msg-input" id="msg-input" placeholder="Type a message to admin..." maxlength="500">
          <button class="msg-send-btn" onclick="sendMessage()">Send</button>
        </div>
      </div>
    </div>

    <!-- ===== REQUESTS TAB ===== -->
    <div id="tab-requests" class="section-hidden">
      <div id="requests-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>

  </div>
</div>

<!-- Toast Container -->
<div id="toast"></div>

<script>
  const API = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users'
  let token = localStorage.getItem('shortUserToken')
  let dashData = null
  let currentTab = 'overview'

  // ===== TOAST =====
  function toast(msg, type = 'success') {
    const el = document.createElement('div')
    el.className = 'toast-item ' + type
    el.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg
    document.getElementById('toast').appendChild(el)
    setTimeout(() => el.remove(), 3500)
  }

  // ===== LOGIN TABS =====
  function switchLoginTab(tab) {
    document.getElementById('tab-password').classList.toggle('section-hidden', tab !== 'password')
    document.getElementById('tab-gmail').classList.toggle('section-hidden', tab !== 'gmail')
    document.querySelectorAll('.login-tab').forEach((btn, i) => {
      btn.classList.toggle('active', (i === 0 && tab === 'password') || (i === 1 && tab === 'gmail'))
    })
    document.getElementById('login-error').textContent = ''
  }

  // ===== AUTO LOGIN =====
  if (token) {
    showDashboard()
    loadDashboard()
  }

  // ===== PASSWORD LOGIN =====
  async function handleLogin() {
    const username = document.getElementById('username-input').value.trim()
    const password = document.getElementById('password-input').value.trim()
    const btn = document.getElementById('login-btn')
    const errEl = document.getElementById('login-error')
    if (!username || !password) { errEl.textContent = 'Username and password are required'; return }
    btn.disabled = true; btn.textContent = 'Logging in...'
    errEl.textContent = ''
    try {
      const res = await fetch(API + '/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok || !data.token) { errEl.textContent = data.error || 'Login failed'; btn.disabled = false; btn.textContent = 'Login'; return }
      onLoginSuccess(data)
    } catch (err) {
      errEl.textContent = 'Network error — please try again'
      btn.disabled = false; btn.textContent = 'Login'
    }
  }

  // ===== GMAIL LOGIN =====
  async function handleGmailLogin() {
    const gmail = document.getElementById('gmail-login-input').value.trim()
    const btn = document.getElementById('gmail-login-btn')
    const errEl = document.getElementById('login-error')
    if (!gmail) { errEl.textContent = 'Gmail address is required'; return }
    btn.disabled = true; btn.textContent = 'Verifying...'
    errEl.textContent = ''
    try {
      const res = await fetch(API + '/login/gmail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmail })
      })
      const data = await res.json()
      if (!res.ok || !data.token) { errEl.textContent = data.error || 'Gmail login failed'; btn.disabled = false; btn.textContent = 'Login with Gmail'; return }
      onLoginSuccess(data)
    } catch (err) {
      errEl.textContent = 'Network error — please try again'
      btn.disabled = false; btn.textContent = 'Login with Gmail'
    }
  }

  function onLoginSuccess(data) {
    localStorage.setItem('shortUserToken', data.token)
    localStorage.setItem('shortUserName', data.user.realName)
    localStorage.setItem('shortUsername', data.user.username)
    token = data.token
    showDashboard()
    loadDashboard()
  }

  function showDashboard() {
    document.getElementById('login-page').style.display = 'none'
    document.getElementById('dashboard-page').style.display = 'block'
    const name = localStorage.getItem('shortUserName') || localStorage.getItem('shortUsername') || 'User'
    document.getElementById('user-badge').textContent = name
  }

  function handleLogout() {
    localStorage.removeItem('shortUserToken')
    localStorage.removeItem('shortUserName')
    localStorage.removeItem('shortUsername')
    token = null; dashData = null
    document.getElementById('login-page').style.display = 'flex'
    document.getElementById('dashboard-page').style.display = 'none'
    document.getElementById('username-input').value = ''
    document.getElementById('password-input').value = ''
  }

  // ===== SWITCH TABS =====
  function switchTab(tab) {
    currentTab = tab
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab)
    })
    ;['overview','links','profile','messages','requests'].forEach(t => {
      document.getElementById('tab-' + t).classList.toggle('section-hidden', t !== tab)
    })
    if (tab === 'messages') loadMessages()
    if (tab === 'requests' && dashData) renderRequests(dashData)
    if (tab === 'profile' && dashData) fillProfile(dashData.user)
  }

  // ===== LOAD DASHBOARD =====
  async function loadDashboard() {
    document.getElementById('overview-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>'
    try {
      const res = await fetch(API + '/dashboard', { headers: { 'Authorization': 'Bearer ' + token } })
      if (res.status === 401) { handleLogout(); return }
      const data = await res.json()
      if (data.error) { document.getElementById('overview-content').innerHTML = '<div class="empty">Error: ' + data.error + '</div>'; return }
      dashData = data
      renderOverview(data)
      renderLinks(data)

      // Notification dot
      if (data.unreadMessages > 0) {
        document.getElementById('notif-dot').style.display = 'block'
        document.getElementById('msg-badge').style.display = 'inline'
        document.getElementById('msg-badge').textContent = data.unreadMessages
      }

      // Fill profile if already on profile tab
      if (currentTab === 'profile') fillProfile(data.user)
      if (currentTab === 'requests') renderRequests(data)
    } catch (err) {
      document.getElementById('overview-content').innerHTML = '<div class="empty">Network error — please reload the page</div>'
    }
  }

  // ===== RENDER OVERVIEW =====
  function renderOverview(data) {
    const { user, last7Days, topCountries } = data
    const maxClicks = Math.max(...last7Days.map(d => d.clicks), 1)
    const earningPerClick = (user.ratePerThousand / 1000).toFixed(4)
    const clicksNeeded = Math.max(0, 1000 - (user.totalClicks || 0))
    const canPayRequest = (user.totalClicks || 0) >= 1000 && (user.unpaidEarnings || 0) > 0

    let payBanner = ''
    if (canPayRequest && !data.pendingPaymentRequest) {
      payBanner = \`
        <div class="pay-banner">
          <div class="pay-banner-text">
            <h3>🎉 Payment Request Available!</h3>
            <p>You have crossed 1000 clicks. You can now request your ₹\${(user.unpaidEarnings || 0).toFixed(2)} pending payment.</p>
          </div>
          <button class="btn-pay" onclick="requestPayment()">Request Payment</button>
        </div>\`
    } else if (data.pendingPaymentRequest) {
      payBanner = \`
        <div class="pay-banner" style="border-color:#f59e0b33;background:#f59e0b0d;">
          <div class="pay-banner-text">
            <h3 style="color:#fbbf24;">⏳ Payment Request Pending</h3>
            <p>Your payment request is under review. Admin will process it soon.</p>
          </div>
          <span class="status-pill status-pending">Pending</span>
        </div>\`
    } else if ((user.totalClicks || 0) < 1000) {
      payBanner = \`
        <div class="pay-banner" style="border-color:#7c3aed33;background:#7c3aed0d;">
          <div class="pay-banner-text">
            <h3 style="color:#a78bfa;">📈 Keep Going!</h3>
            <p>You need \${clicksNeeded} more clicks to unlock payment request. Total so far: \${user.totalClicks || 0}/1000</p>
          </div>
          <div style="background:#7c3aed22;border-radius:8px;padding:0.5rem 1rem;font-size:0.8rem;color:#a78bfa;font-weight:600;">\${user.totalClicks || 0}/1000</div>
        </div>\`
    }

    document.getElementById('overview-content').innerHTML = \`
      \${payBanner}

      <div class="stats-grid">
        <div class="stat-card purple">
          <div class="stat-label">Total Clicks</div>
          <div class="stat-value">\${(user.totalClicks || 0).toLocaleString()}</div>
          <div class="stat-sub">All links combined</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Today's Clicks</div>
          <div class="stat-value">\${(user.todayClicks || 0).toLocaleString()}</div>
          <div class="stat-sub">Today</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-label">Total Earned</div>
          <div class="stat-value">₹\${(user.totalEarnings || 0).toFixed(2)}</div>
          <div class="stat-sub">Rate: ₹\${user.ratePerThousand}/1000</div>
        </div>
        <div class="stat-card pink">
          <div class="stat-label">Pending Payment</div>
          <div class="stat-value">₹\${(user.unpaidEarnings || 0).toFixed(2)}</div>
          <div class="stat-sub">Paid: ₹\${(user.paidEarnings || 0).toFixed(2)}</div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Last 7 Days Clicks</div>
        <div class="chart-bars">
          \${last7Days.map(day => \`
            <div class="chart-bar-wrap">
              <div class="chart-count">\${day.clicks}</div>
              <div class="chart-bar" style="height:\${Math.max((day.clicks / maxClicks) * 100, 3)}%"></div>
              <div class="chart-label">\${day.date}</div>
            </div>
          \`).join('')}
        </div>
      </div>

      <div class="countries-grid">
        <div>
          <div class="section-title">Top Countries</div>
          <div class="table-wrap" style="padding: 1rem;">
            \${topCountries.length === 0
              ? '<div class="empty">No data yet</div>'
              : topCountries.map(c => \`
                <div class="country-row">
                  <span class="country-name">\${c._id || 'Unknown'}</span>
                  <span class="country-count">\${c.count} clicks</span>
                </div>\`).join('')}
          </div>
        </div>
        <div>
          <div class="section-title">Earning Details</div>
          <div class="table-wrap" style="padding: 1rem;">
            <div class="country-row"><span class="country-name">Rate per 1000 clicks</span><span class="country-count">₹\${user.ratePerThousand}</span></div>
            <div class="country-row"><span class="country-name">Rate per click</span><span class="country-count">₹\${earningPerClick}</span></div>
            <div class="country-row"><span class="country-name">Total earned</span><span class="country-count">₹\${(user.totalEarnings || 0).toFixed(2)}</span></div>
            <div class="country-row"><span class="country-name">Already paid</span><span class="country-count">₹\${(user.paidEarnings || 0).toFixed(2)}</span></div>
            <div class="country-row">
              <span class="country-name" style="color:#fbbf24">Pending payment</span>
              <span class="country-count" style="color:#fbbf24">₹\${(user.unpaidEarnings || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:2rem;color:#334155;font-size:0.75rem;">
        AnimaBing © 2026 •
        <button onclick="loadDashboard()" style="background:none;border:none;color:#7c3aed;cursor:pointer;font-size:0.75rem;">↻ Refresh</button>
      </div>
    \`
  }

  // ===== RENDER LINKS =====
  function renderLinks(data) {
    const { links } = data
    document.getElementById('links-content').innerHTML = \`
      <div class="section-title">My Short Links</div>
      <div class="table-wrap">
        \${links.length === 0
          ? '<div class="empty">No links assigned yet. Request a link from the Requests tab.</div>'
          : \`<table>
            <thead><tr>
              <th>Short URL</th><th>Label</th><th>Clicks</th><th>Last Click</th><th>Copy</th>
            </tr></thead>
            <tbody>
              \${links.map(link => \`
                <tr>
                  <td><span class="code-badge">go.animebing.in/\${link.code}</span></td>
                  <td>\${link.label || '—'}</td>
                  <td><span class="clicks-badge \${link.clicks > 100 ? 'clicks-high' : link.clicks > 10 ? 'clicks-mid' : 'clicks-low'}">\${link.clicks || 0}</span></td>
                  <td>\${link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</td>
                  <td><button class="copy-btn" onclick="copyLink('\${link.code}', this)">Copy</button></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>\`
        }
      </div>
    \`
  }

  // ===== FILL PROFILE =====
  function fillProfile(user) {
    const p = user.profile || {}
    document.getElementById('p-mobile').value = p.mobile || ''
    document.getElementById('p-gmail').value = p.gmail || ''
    document.getElementById('p-upiId').value = p.upiId || ''
    document.getElementById('p-upiPhone').value = p.upiPhone || ''
    document.getElementById('p-age').value = p.age || ''
    document.getElementById('p-gender').value = p.gender || ''

    // Gmail linked badge
    const gmailInfo = document.getElementById('gmail-linked-info')
    if (user.gmailLinked) {
      gmailInfo.style.display = 'block'
      gmailInfo.innerHTML = '<span class="gmail-linked-badge">✉️ Gmail linked: ' + user.gmailLinked + '</span> <span style="font-size:0.7rem;color:#64748b;margin-left:0.5rem;">You can login with this Gmail.</span>'
    } else {
      gmailInfo.style.display = 'none'
    }
  }

  // ===== SAVE PROFILE =====
  async function saveProfile() {
    const btn = document.getElementById('profile-save-btn')
    const msgEl = document.getElementById('profile-msg')
    btn.disabled = true; btn.textContent = 'Saving...'
    msgEl.textContent = ''
    try {
      const res = await fetch(API + '/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          mobile: document.getElementById('p-mobile').value.trim(),
          gmail: document.getElementById('p-gmail').value.trim().toLowerCase(),
          upiId: document.getElementById('p-upiId').value.trim(),
          upiPhone: document.getElementById('p-upiPhone').value.trim(),
          age: parseInt(document.getElementById('p-age').value) || null,
          gender: document.getElementById('p-gender').value
        })
      })
      const data = await res.json()
      if (!res.ok) { msgEl.style.color = '#f87171'; msgEl.textContent = data.error || 'Save failed'; }
      else {
        msgEl.style.color = '#34d399'; msgEl.textContent = '✅ Profile saved! Gmail login is now enabled with your email.'
        loadDashboard()
        toast('Profile updated successfully!')
      }
    } catch (err) {
      msgEl.style.color = '#f87171'; msgEl.textContent = 'Network error'
    } finally {
      btn.disabled = false; btn.textContent = 'Save Profile'
    }
  }

  // ===== PAYMENT REQUEST =====
  async function requestPayment() {
    try {
      const res = await fetch(API + '/request/payment', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Request failed', 'error'); return }
      toast(data.message || 'Payment request sent!')
      loadDashboard()
    } catch (err) {
      toast('Network error', 'error')
    }
  }

  // ===== MESSAGES =====
  async function loadMessages() {
    document.getElementById('messages-list').innerHTML = '<div class="loading"><div class="spinner"></div></div>'
    try {
      const res = await fetch(API + '/messages', { headers: { 'Authorization': 'Bearer ' + token } })
      const messages = await res.json()
      const list = document.getElementById('messages-list')

      if (!Array.isArray(messages) || messages.length === 0) {
        list.innerHTML = '<div class="msg-empty">No messages yet. Send a message to admin.</div>'
        return
      }

      list.innerHTML = messages.map(msg => \`
        <div>
          <div class="msg-bubble \${msg.fromAdmin ? 'from-admin' : 'from-user'}">\${msg.text}</div>
          <div class="msg-meta" style="text-align:\${msg.fromAdmin ? 'left' : 'right'}">
            \${msg.fromAdmin ? 'Admin' : 'You'} · \${new Date(msg.createdAt).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      \`).join('')
      list.scrollTop = list.scrollHeight

      // Clear notification
      document.getElementById('notif-dot').style.display = 'none'
      document.getElementById('msg-badge').style.display = 'none'
    } catch (err) {
      document.getElementById('messages-list').innerHTML = '<div class="msg-empty">Failed to load messages</div>'
    }
  }

  async function sendMessage() {
    const input = document.getElementById('msg-input')
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    try {
      const res = await fetch(API + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ text })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Send failed', 'error'); return }
      loadMessages()
    } catch (err) {
      toast('Network error', 'error')
    }
  }

  // ===== REQUESTS TAB =====
  function renderRequests(data) {
    const canPayRequest = (data.user.totalClicks || 0) >= 1000 && (data.user.unpaidEarnings || 0) > 0
    document.getElementById('requests-content').innerHTML = \`
      <!-- Payment Request -->
      <div class="request-card">
        <h3>💰 Payment Request</h3>
        <p>Once you reach 1000 total clicks and have pending earnings, you can request payment. Make sure your UPI details are filled in the Profile tab.</p>
        \${data.pendingPaymentRequest
          ? '<span class="status-pill status-pending">⏳ Request Pending — Admin will process soon</span>'
          : canPayRequest
            ? \`<div>
                <p style="color:#34d399;margin-bottom:0.75rem;">✅ You are eligible! Pending amount: ₹\${(data.user.unpaidEarnings || 0).toFixed(2)}</p>
                <button class="btn-pay" onclick="requestPayment()">Request Payment</button>
              </div>\`
            : \`<p style="color:#64748b;">Progress: \${data.user.totalClicks || 0}/1000 clicks</p>
               <div style="background:#0f172a;border-radius:8px;height:8px;margin-top:0.5rem;overflow:hidden;">
                 <div style="height:100%;background:linear-gradient(90deg,#7c3aed,#ec4899);width:\${Math.min(((data.user.totalClicks||0)/1000)*100,100)}%;transition:width 0.5s;"></div>
               </div>\`
        }
      </div>

      <!-- Link Request -->
      <div class="request-card">
        <h3>🔗 Request More Links</h3>
        <p>Need more short links? Send a request to admin and they will assign new links to your account.</p>
        \${data.pendingLinkRequest
          ? '<span class="status-pill status-pending">⏳ Link Request Pending — Admin will assign soon</span>'
          : \`<div>
              <textarea class="link-request-msg" id="link-req-msg" placeholder="Tell admin why you need more links (optional)..."></textarea>
              <button class="link-request-btn" onclick="requestLink()">Request More Links</button>
            </div>\`
        }
      </div>
    \`
  }

  async function requestLink() {
    const message = document.getElementById('link-req-msg')?.value?.trim() || ''
    try {
      const res = await fetch(API + '/request/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ message })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Request failed', 'error'); return }
      toast(data.message || 'Link request sent!')
      loadDashboard()
    } catch (err) {
      toast('Network error', 'error')
    }
  }

  function copyLink(code, btn) {
    navigator.clipboard.writeText('https://go.animebing.in/' + code)
    btn.textContent = '✓ Copied!'; btn.style.color = '#34d399'
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = '' }, 2000)
  }

  // Enter key handlers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (document.getElementById('login-page').style.display !== 'none') {
        if (!document.getElementById('tab-gmail').classList.contains('section-hidden')) handleGmailLogin()
        else handleLogin()
      }
      if (document.activeElement === document.getElementById('msg-input')) sendMessage()
    }
  })
</script>
</body>
</html>`

  return c.html(html)
})

// ============ REDIRECT — LAST ============
shortenerRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })

    if (!link) {
      return c.html(`
        <!DOCTYPE html><html><head><title>404</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:white;}
        .box{text-align:center;padding:2rem;}h2{color:#f87171;}a{color:#818cf8;}</style></head>
        <body><div class="box"><h2>404 — Link not found</h2><p>This short link does not exist.</p>
        <a href="https://animebing.in">← Go to Animebing.in</a></div></body></html>
      `, 404)
    }

    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') ||
               c.req.header('X-Real-IP') || 'unknown'

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentClick = await db.collection('shortclicks').findOne({
      code, ip, clickedAt: { $gte: last24h }
    })

    if (!recentClick) {
      const country = c.req.header('CF-IPCountry') || 'Unknown'
      const city = (c as any).req.raw?.cf?.city || 'Unknown'
      const device = c.req.header('User-Agent') || ''
      const deviceType = /mobile|android|iphone|ipad/i.test(device)
        ? 'mobile' : /tablet/i.test(device) ? 'tablet' : 'desktop'

      const clickData: any = {
        code, ip, country, city,
        device: deviceType,
        browser: device.substring(0, 100),
        clickedAt: new Date()
      }
      if (link.userId) clickData.userId = link.userId

      await db.collection('shortclicks').insertOne(clickData)
      await db.collection('shortlinks').updateOne(
        { code },
        { $inc: { clicks: 1 }, $set: { lastClicked: new Date() } }
      )

      if (link.userId) {
        const user = await db.collection('shortusers').findOne({ _id: link.userId })
        if (user) {
          const earningPerClick = (user.ratePerThousand || 10) / 1000
          await db.collection('shortusers').updateOne(
            { _id: link.userId },
            {
              $inc: {
                totalClicks: 1,
                totalEarnings: earningPerClick,
                unpaidEarnings: earningPerClick
              }
            }
          )
        }
      }
    }

    return c.redirect(link.url, 302)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortenerRoutes