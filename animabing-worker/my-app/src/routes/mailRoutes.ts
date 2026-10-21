// src/routes/mailRoutes.ts
import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { withDb, toObjectId, isValidObjectId } from '../services/mongoService'
import {
  signState, verifyState, buildAuthUrl, exchangeCode, emailFromIdToken,
  encryptToken, decryptToken, getAccessToken, revokeToken, sendGmail,
} from '../services/gmailService'

const mailRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const DAILY_LIMIT = 450 // Gmail free ~500/day — thoda margin rakha
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

const mainOnly = async (c: any, next: any) => {
  if (c.get('admin')?.role !== 'admin') return c.json({ error: 'Only main admin can use mail' }, 403)
  await next()
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

const safeOrigin = (url: string) => { try { return new URL(url).origin } catch { return '*' } }

const callbackPage = (ok: boolean, msg: string, origin: string) => `<!doctype html><meta charset="utf-8"><title>Gmail</title>
<body style="font-family:system-ui,sans-serif;background:#0b0b12;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:16px">
<div><div style="font-size:40px">${ok ? '✅' : '⚠️'}</div><p>${esc(msg)}</p><p style="color:#888;font-size:12px">You can close this window.</p></div>
<script>try{window.opener&&window.opener.postMessage({type:'gmail-connected',ok:${ok}},${JSON.stringify(origin)})}catch(e){};setTimeout(function(){window.close()},1500)</script></body>`

// last-24h sent count per account (Gmail limit rolling hai)
async function sentCounts(db: any): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db.collection('mailLogs').aggregate([
    { $match: { status: 'sent', createdAt: { $gte: since } } },
    { $group: { _id: '$accountId', n: { $sum: 1 } } },
  ]).toArray()
  return new Map(rows.map((r: any) => [String(r._id), r.n]))
}

// ============ OAuth: start (admin) ============
mailRoutes.get('/connect-url', adminAuth, mainOnly, async (c) => {
  const admin = c.get('admin')
  const redirectUri = new URL(c.req.url).origin + '/api/mail/oauth/callback'
  const state = await signState(c.env, String(admin.id))
  return c.json({ url: buildAuthUrl(c.env, redirectUri, state), redirectUri })
})

// ============ OAuth: callback (public — Google redirects here) ============
mailRoutes.get('/oauth/callback', async (c) => {
  const url = new URL(c.req.url)
  const origin = safeOrigin(c.env.FRONTEND_URL)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err || !code || !state) return c.html(callbackPage(false, `Cancelled or failed: ${err || 'missing code'}`, origin), 400)

  const st = await verifyState(c.env, state)
  if (!st) return c.html(callbackPage(false, 'Link expired. Please click "Add Gmail" again.', origin), 400)

  try {
    const tok = await exchangeCode(c.env, code, url.origin + '/api/mail/oauth/callback')
    if (!tok.refresh_token) {
      throw new Error('Google did not return a refresh token. Remove this app at myaccount.google.com/permissions and try again.')
    }
    const email = emailFromIdToken(tok.id_token)
    const { encrypted, iv } = await encryptToken(c.env, tok.refresh_token)
    const now = new Date()

    await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/connect', async (db) => {
      await db.collection('mailAccounts').updateOne(
        { email },
        {
          $set: { email, encryptedRefreshToken: encrypted, iv, isActive: true, lastError: null, connectedBy: st.a, updatedAt: now },
          $setOnInsert: { label: email, createdAt: now },
        },
        { upsert: true }
      )
    })
    return c.html(callbackPage(true, `Connected ${email}`, origin))
  } catch (e: any) {
    return c.html(callbackPage(false, e.message || 'Failed to connect Gmail', origin), 500)
  }
})

// ============ LIST ACCOUNTS ============
mailRoutes.get('/accounts', adminAuth, mainOnly, async (c) => {
  try {
    const accounts = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/accounts', async (db) => {
      const list = await db.collection('mailAccounts')
        .find({}, { projection: { encryptedRefreshToken: 0, iv: 0 } })
        .sort({ createdAt: 1 }).toArray()
      const counts = await sentCounts(db)
      return list.map((a: any) => ({ ...a, sent24h: counts.get(String(a._id)) || 0, dailyLimit: DAILY_LIMIT }))
    })
    return c.json({ success: true, accounts })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============ UPDATE (label / active) ============
mailRoutes.put('/accounts/:id', adminAuth, mainOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const body = await c.req.json()
    const set: any = { updatedAt: new Date() }
    if (typeof body.label === 'string') set.label = body.label.trim().slice(0, 60)
    if (typeof body.isActive === 'boolean') { set.isActive = body.isActive; if (body.isActive) set.lastError = null }

    const r = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/update', (db) =>
      db.collection('mailAccounts').updateOne({ _id: toObjectId(id) }, { $set: set })
    )
    if (!r.matchedCount) return c.json({ error: 'Account not found' }, 404)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============ DELETE ============
mailRoutes.delete('/accounts/:id', adminAuth, mainOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const acc = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/delete', async (db) => {
      const a = await db.collection('mailAccounts').findOne({ _id: toObjectId(id) })
      if (a) await db.collection('mailAccounts').deleteOne({ _id: toObjectId(id) })
      return a
    })
    if (!acc) return c.json({ error: 'Account not found' }, 404)

    // Google side se bhi access hata do (best effort)
    try { await revokeToken(await decryptToken(c.env, acc.encryptedRefreshToken, acc.iv)) } catch {}
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============ SEND ============
// body: { accountId?, to, subject, message, reportId?, markFixed? }
// accountId na do to sabse kam use hui active Gmail auto-select hoti hai.
mailRoutes.post('/send', adminAuth, mainOnly, async (c) => {
  try {
    const { accountId, to, subject, message, reportId, markFixed } = await c.req.json()

    if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) return c.json({ error: 'Valid recipient email required' }, 400)
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) return c.json({ error: 'Subject required (max 200 chars)' }, 400)
    if (typeof message !== 'string' || !message.trim() || message.length > 10000) return c.json({ error: 'Message required (max 10000 chars)' }, 400)
    if (accountId && !isValidObjectId(accountId)) return c.json({ error: 'Invalid accountId' }, 400)
    if (reportId && !isValidObjectId(reportId)) return c.json({ error: 'Invalid reportId' }, 400)

    // 1) account choose karo
    const picked = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/pick', async (db) => {
      const counts = await sentCounts(db)
      const filter: any = { isActive: true }
      if (accountId) filter._id = toObjectId(accountId)
      const list = await db.collection('mailAccounts').find(filter).toArray()
      const usable = list
        .map((a: any) => ({ a, n: counts.get(String(a._id)) || 0 }))
        .filter((x: any) => x.n < DAILY_LIMIT)
        .sort((x: any, y: any) => x.n - y.n)
      return { account: usable[0]?.a || null, hadAny: list.length > 0 }
    })

    if (!picked.account) {
      return c.json({
        error: picked.hadAny ? 'Daily limit reached on all selected Gmail accounts. Add another Gmail or try later.' : 'No active Gmail account connected.',
      }, picked.hadAny ? 429 : 400)
    }
    const acc = picked.account
    const accIdStr = String(acc._id)

    // 2) mail bhejo
    let status: 'sent' | 'failed' = 'sent'
    let errorMsg = ''
    let gmailId = ''
    try {
      const refreshToken = await decryptToken(c.env, acc.encryptedRefreshToken, acc.iv)
      const accessToken = await getAccessToken(c.env, refreshToken)
      gmailId = await sendGmail(accessToken, {
        from: acc.email,
        fromName: 'AnimaBing',
        to: to.trim(),
        subject: subject.trim(),
        text: message.trim(),
      })
    } catch (e: any) {
      status = 'failed'
      errorMsg = e.message || 'Send failed'
      if (e.code === 'invalid_grant') errorMsg = 'Gmail access expired/revoked — remove and re-add this Gmail.'
      // token dead ho gaya to account ko inactive mark karo taaki auto-select skip kare
      if (e.code === 'invalid_grant') {
        await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/mark-dead', (db) =>
          db.collection('mailAccounts').updateOne({ _id: acc._id }, { $set: { isActive: false, lastError: errorMsg, updatedAt: new Date() } })
        ).catch(() => {})
      }
    }

    // 3) log + (optional) report update
    const now = new Date()
    await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/log', async (db) => {
      await db.collection('mailLogs').insertOne({
        accountId: accIdStr, accountEmail: acc.email, to: to.trim(), subject: subject.trim(),
        status, error: errorMsg || null, gmailId: gmailId || null, reportId: reportId || null,
        sentBy: String(c.get('admin')?.id || ''), createdAt: now,
      })
      if (status === 'sent' && reportId) {
        const set: any = { adminResponse: message.trim(), responseDate: now, repliedByEmail: acc.email, updatedAt: now }
        if (markFixed) { set.status = 'Fixed'; set.resolvedAt = now }
        await db.collection('reports').updateOne({ _id: toObjectId(reportId) }, { $set: set })
      }
    }).catch((e: any) => console.error('mail log failed', e))

    if (status === 'failed') return c.json({ success: false, error: errorMsg }, 502)
    return c.json({ success: true, message: `Mail sent from ${acc.email}`, from: acc.email })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============ LOGS ============
mailRoutes.get('/logs', adminAuth, mainOnly, async (c) => {
  try {
    const logs = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'mail/logs', (db) =>
      db.collection('mailLogs').find({}).sort({ createdAt: -1 }).limit(50).toArray()
    )
    return c.json({ success: true, logs })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default mailRoutes