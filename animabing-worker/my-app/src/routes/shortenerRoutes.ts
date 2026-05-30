import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { ObjectId } from 'mongodb'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ ADMIN — SAARE LINKS DEKHO ============
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

// ============ ADMIN — NAYA LINK BANAO ============
shortenerRoutes.post('/admin/links', adminAuth, async (c) => {
  try {
    const { code, url, label, userId } = await c.req.json()
    if (!code || !url) {
      return c.json({ error: 'code aur url dono required hain' }, 400)
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return c.json({ error: 'Code mein sirf letters, numbers, - aur _ allowed hain' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) {
      return c.json({ error: `"${code}" already exist karta hai` }, 400)
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
    return c.json({ success: true, message: 'Link ban gaya!', link: newLink })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — LINK UPDATE KARO ============
shortenerRoutes.put('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const { url, label, userId } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const updateData: any = { url, label, updatedAt: new Date() }
    if (userId) updateData.userId = new ObjectId(userId)
    await db.collection('shortlinks').updateOne({ code }, { $set: updateData })
    return c.json({ success: true, message: 'Link update ho gaya!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — LINK DELETE KARO ============
shortenerRoutes.delete('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('shortlinks').deleteOne({ code })
    return c.json({ success: true, message: 'Link delete ho gaya!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ STATS ============
shortenerRoutes.get('/admin/links/:code/stats', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })
    if (!link) return c.json({ error: 'Link nahi mila' }, 404)
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
    
    /* LOGIN PAGE */
    #login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .login-box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; width: 100%; max-width: 400px; }
    .login-logo { text-align: center; margin-bottom: 1.5rem; }
    .login-logo h1 { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .login-logo p { color: #64748b; font-size: 0.875rem; margin-top: 0.25rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group input { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.75rem 1rem; color: #e2e8f0; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #7c3aed; }
    .btn { width: 100%; padding: 0.75rem; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .error-msg { color: #f87171; font-size: 0.75rem; margin-top: 0.75rem; text-align: center; }

    /* DASHBOARD */
    #dashboard-page { display: none; }
    .header { background: #1e293b; border-bottom: 1px solid #334155; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-right { display: flex; align-items: center; gap: 1rem; }
    .user-badge { background: #334155; border-radius: 20px; padding: 0.25rem 0.75rem; font-size: 0.75rem; color: #94a3b8; }
    .logout-btn { background: #ef44441a; border: 1px solid #ef444433; color: #fca5a5; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.75rem; cursor: pointer; }
    
    .container { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
    
    /* STATS CARDS */
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

    /* CHART */
    .chart-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .chart-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; margin-bottom: 1rem; }
    .chart-bars { display: flex; align-items: flex-end; gap: 0.5rem; height: 120px; }
    .chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; height: 100%; justify-content: flex-end; }
    .chart-bar { width: 100%; background: linear-gradient(to top, #7c3aed, #a78bfa); border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.5s ease; }
    .chart-label { font-size: 0.6rem; color: #64748b; text-align: center; }
    .chart-count { font-size: 0.65rem; color: #94a3b8; }

    /* LINKS TABLE */
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

    /* COUNTRIES */
    .countries-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    @media(min-width: 640px) { .countries-grid { grid-template-columns: 1fr 1fr; } }
    .country-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
    .country-row:last-child { border-bottom: none; }
    .country-name { font-size: 0.8rem; color: #cbd5e1; }
    .country-count { font-size: 0.8rem; font-weight: 600; color: #a78bfa; }

    /* LOADING */
    .loading { display: flex; align-items: center; justify-content: center; padding: 3rem; }
    .spinner { width: 32px; height: 32px; border: 3px solid #334155; border-top-color: #7c3aed; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty { text-align: center; padding: 2rem; color: #64748b; font-size: 0.875rem; }
  </style>
</head>
<body>

<!-- LOGIN PAGE -->
<div id="login-page">
  <div class="login-box">
    <div class="login-logo">
      <h1>AnimaBing</h1>
      <p>User Dashboard — Login karo</p>
    </div>
    <div class="form-group">
      <label>Username</label>
      <input type="text" id="username-input" placeholder="apna username" autocomplete="username">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="password-input" placeholder="apna password" autocomplete="current-password">
    </div>
    <button class="btn btn-primary" id="login-btn" onclick="handleLogin()">Login</button>
    <div id="login-error" class="error-msg"></div>
  </div>
</div>

<!-- DASHBOARD PAGE -->
<div id="dashboard-page">
  <div class="header">
    <h1>AnimaBing Dashboard</h1>
    <div class="header-right">
      <span class="user-badge" id="user-badge">...</span>
      <button class="logout-btn" onclick="handleLogout()">Logout</button>
    </div>
  </div>

  <div class="container">
    <div id="dashboard-content">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  </div>
</div>

<script>
  const API = 'https://animabing-backend.animabingwatch.workers.dev/api/short-users'
  let token = localStorage.getItem('shortUserToken')

  // Auto login check
  if (token) {
    showDashboard()
    loadDashboard()
  }

  async function handleLogin() {
    const username = document.getElementById('username-input').value.trim()
    const password = document.getElementById('password-input').value.trim()
    const btn = document.getElementById('login-btn')
    const errEl = document.getElementById('login-error')

    if (!username || !password) {
      errEl.textContent = 'Username aur password required hai'
      return
    }

    btn.disabled = true
    btn.textContent = 'Login ho raha hai...'
    errEl.textContent = ''

    try {
      const res = await fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()

      if (!res.ok || !data.token) {
        errEl.textContent = data.error || 'Login fail hua'
        btn.disabled = false
        btn.textContent = 'Login'
        return
      }

      localStorage.setItem('shortUserToken', data.token)
      localStorage.setItem('shortUserName', data.user.realName)
      localStorage.setItem('shortUsername', data.user.username)
      token = data.token

      showDashboard()
      loadDashboard()
    } catch (err) {
      errEl.textContent = 'Network error — dobara try karo'
      btn.disabled = false
      btn.textContent = 'Login'
    }
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
    token = null
    document.getElementById('login-page').style.display = 'flex'
    document.getElementById('dashboard-page').style.display = 'none'
    document.getElementById('username-input').value = ''
    document.getElementById('password-input').value = ''
  }

  async function loadDashboard() {
    const content = document.getElementById('dashboard-content')
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

    try {
      const res = await fetch(API + '/dashboard', {
        headers: { 'Authorization': 'Bearer ' + token }
      })

      if (res.status === 401) {
        handleLogout()
        return
      }

      const data = await res.json()
      if (data.error) {
        content.innerHTML = '<div class="empty">Error: ' + data.error + '</div>'
        return
      }

      renderDashboard(data)
    } catch (err) {
      content.innerHTML = '<div class="empty">Network error — page reload karo</div>'
    }
  }

  function renderDashboard(data) {
    const { user, links, last7Days, topCountries } = data
    const maxClicks = Math.max(...last7Days.map(d => d.clicks), 1)

    const earningPerClick = (user.ratePerThousand / 1000).toFixed(4)

    document.getElementById('dashboard-content').innerHTML = \`
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card purple">
          <div class="stat-label">Total Clicks</div>
          <div class="stat-value">\${(user.totalClicks || 0).toLocaleString()}</div>
          <div class="stat-sub">Sabhi links mila ke</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Aaj Ke Clicks</div>
          <div class="stat-value">\${(user.todayClicks || 0).toLocaleString()}</div>
          <div class="stat-sub">Today</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-label">Total Kamayi</div>
          <div class="stat-value">₹\${(user.totalEarnings || 0).toFixed(2)}</div>
          <div class="stat-sub">Rate: ₹\${user.ratePerThousand}/1000</div>
        </div>
        <div class="stat-card pink">
          <div class="stat-label">Pending Payment</div>
          <div class="stat-value">₹\${(user.unpaidEarnings || 0).toFixed(2)}</div>
          <div class="stat-sub">Paid: ₹\${(user.paidEarnings || 0).toFixed(2)}</div>
        </div>
      </div>

      <!-- Chart -->
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

      <!-- Countries + Links -->
      <div class="countries-grid">
        <!-- Top Countries -->
        <div>
          <div class="section-title">Top Countries</div>
          <div class="table-wrap" style="padding: 1rem;">
            \${topCountries.length === 0
              ? '<div class="empty">Abhi koi data nahi</div>'
              : topCountries.map(c => \`
                <div class="country-row">
                  <span class="country-name">\${c._id || 'Unknown'}</span>
                  <span class="country-count">\${c.count} clicks</span>
                </div>
              \`).join('')
            }
          </div>
        </div>

        <!-- Earning Info -->
        <div>
          <div class="section-title">Earning Details</div>
          <div class="table-wrap" style="padding: 1rem;">
            <div class="country-row">
              <span class="country-name">Rate per 1000 clicks</span>
              <span class="country-count">₹\${user.ratePerThousand}</span>
            </div>
            <div class="country-row">
              <span class="country-name">Rate per click</span>
              <span class="country-count">₹\${earningPerClick}</span>
            </div>
            <div class="country-row">
              <span class="country-name">Total earned</span>
              <span class="country-count">₹\${(user.totalEarnings || 0).toFixed(2)}</span>
            </div>
            <div class="country-row">
              <span class="country-name">Already paid</span>
              <span class="country-count">₹\${(user.paidEarnings || 0).toFixed(2)}</span>
            </div>
            <div class="country-row">
              <span class="country-name" style="color:#fbbf24">Pending payment</span>
              <span class="country-count" style="color:#fbbf24">₹\${(user.unpaidEarnings || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Links Table -->
      <div class="section-title">Mere Links</div>
      <div class="table-wrap">
        \${links.length === 0
          ? '<div class="empty">Abhi koi link assign nahi hua. Admin se contact karo.</div>'
          : \`<table>
            <thead>
              <tr>
                <th>Short URL</th>
                <th>Label</th>
                <th>Clicks</th>
                <th>Last Click</th>
                <th>Copy</th>
              </tr>
            </thead>
            <tbody>
              \${links.map(link => \`
                <tr>
                  <td><span class="code-badge">go.animebing.in/\${link.code}</span></td>
                  <td>\${link.label || '—'}</td>
                  <td>
                    <span class="clicks-badge \${
                      link.clicks > 100 ? 'clicks-high' :
                      link.clicks > 10 ? 'clicks-mid' : 'clicks-low'
                    }">\${link.clicks || 0}</span>
                  </td>
                  <td>\${link.lastClicked ? new Date(link.lastClicked).toLocaleDateString('en-IN') : 'Never'}</td>
                  <td>
                    <button class="copy-btn" onclick="copyLink('\${link.code}', this)">Copy</button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>\`
        }
      </div>

      <div style="text-align:center;margin-top:2rem;color:#334155;font-size:0.75rem;">
        AnimaBing © 2026 • Refresh karo latest data ke liye •
        <button onclick="loadDashboard()" style="background:none;border:none;color:#7c3aed;cursor:pointer;font-size:0.75rem;">↻ Refresh</button>
      </div>
    \`
  }

  function copyLink(code, btn) {
    navigator.clipboard.writeText('https://go.animebing.in/' + code)
    btn.textContent = '✓ Copied!'
    setTimeout(() => { btn.textContent = 'Copy' }, 2000)
  }

  // Enter key se login
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') {
      handleLogin()
    }
  })
</script>
</body>
</html>`

  return c.html(html)
})

// ============ REDIRECT — SABSE LAST MEIN ============
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
        <body><div class="box"><h2>404 — Link nahi mila</h2><p>Yeh short link exist nahi karta.</p>
        <a href="https://animebing.in">← Animebing.in pe jao</a></div></body></html>
      `, 404)
    }

    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') ||
               c.req.header('X-Real-IP') || 'unknown'

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentClick = await db.collection('shortclicks').findOne({
      code,
      ip,
      clickedAt: { $gte: last24h }
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