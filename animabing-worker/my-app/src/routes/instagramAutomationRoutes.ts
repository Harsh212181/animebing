import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { findMany, insertOne, updateOne, deleteOne, deleteMany, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { refreshOneAccountToken } from '../services/tokenRefreshService'
import { isCodeScheduleOpen, effectiveSchedule } from './instagramWebhookRoutes'

const instagramAutomationRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// Only logged-in admin/sub-admin can access these routes
instagramAutomationRoutes.use('*', adminAuth)

// ============ PROFILE PICTURE HELPERS ============
const PIC_REFRESH_MS = 6 * 60 * 60 * 1000 // 6 hours

async function fetchIgProfilePicture(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v23.0/me?fields=profile_picture_url&access_token=${accessToken}`
    )
    if (!res.ok) return null
    const data: any = await res.json()
    return data.profile_picture_url || null
  } catch {
    return null
  }
}

// 👇 Helper: To get the igUserId of instagram accounts owned by a sub-admin
async function getOwnedIgUserIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (!admin || admin.role !== 'subadmin') return null // null = no restriction (main admin)
  const accounts = await findMany<any>(
    'instagramAccounts', { createdBy: admin.id }, {}, mongoUri, dbName
  )
  return accounts.map((a: any) => a.igUserId)
}

// ---------------- ACCOUNTS ----------------

instagramAutomationRoutes.get('/accounts', async (c) => {
  const admin = c.get('admin')
  const filter = admin?.role === 'subadmin' ? { createdBy: admin.id } : {}

  const accounts = await findMany<any>(
    'instagramAccounts', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  // 👇 Refresh stale profile picture URLs (Instagram CDN URLs expire ~24h).
  // Runs in parallel; failures are silent so the list still loads.
  const now = Date.now()
  await Promise.all(accounts.map(async (a: any) => {
    if (!a.accessToken) return
    const last = a.profilePictureRefreshedAt ? new Date(a.profilePictureRefreshedAt).getTime() : 0
    if (a.profilePictureUrl && now - last < PIC_REFRESH_MS) return

    const fresh = await fetchIgProfilePicture(a.accessToken)
    if (!fresh) return // token expired → keep old URL so UI at least shows something (or falls back)

    a.profilePictureUrl = fresh
    try {
      await updateOne(
        'instagramAccounts',
        { _id: toObjectId(String(a._id)) },
        { profilePictureUrl: fresh, profilePictureRefreshedAt: new Date() },
        c.env.MONGODB_URI, c.env.MONGODB_DB
      )
    } catch {
      /* non-fatal */
    }
  }))

  const safeAccounts = accounts.map((a: any) => ({
    _id: a._id,
    igUsername: a.igUsername,
    igUserId: a.igUserId,
    isActive: a.isActive,
    connectedAt: a.connectedAt,
    profilePictureUrl: a.profilePictureUrl || null,
    createdBy: a.createdBy || null,
    createdByUsername: a.createdByUsername || 'Admin',   // for badge
    tokenExpiresAt: a.tokenExpiresAt || null,
    tokenStatus: a.tokenStatus || null,
    tokenError: a.tokenError || null,
  }))
  return c.json({ success: true, accounts: safeAccounts })
})

instagramAutomationRoutes.post('/accounts', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json()
  const { igUsername, igUserId, accessToken } = body

  if (!igUsername || !igUserId || !accessToken) {
    return c.json({ success: false, error: 'igUsername, igUserId and accessToken are required' }, 400)
  }

  // 👇 Fetch profile picture right away so the UI has an avatar from the start.
  const profilePictureUrl = await fetchIgProfilePicture(accessToken)

  const result = await insertOne('instagramAccounts', {
    igUsername,
    igUserId,
    accessToken,
    isActive: true,
    connectedAt: new Date(),
    profilePictureUrl: profilePictureUrl || null,
    profilePictureRefreshedAt: new Date(),
    createdBy: admin?.role === 'subadmin' ? admin.id : null,
    createdByUsername: admin?.role === 'subadmin' ? admin.username : 'Admin',
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, account: result })
})

instagramAutomationRoutes.put('/accounts/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  if (admin?.role === 'subadmin') {
    const owned = await findMany<any>(
      'instagramAccounts', { _id: toObjectId(id), createdBy: admin.id }, { limit: 1 },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (owned.length === 0) return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  const body = await c.req.json()
  await updateOne('instagramAccounts', { _id: toObjectId(id) }, { isActive: body.isActive }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

instagramAutomationRoutes.delete('/accounts/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]

  if (admin?.role === 'subadmin' && account?.createdBy !== admin.id) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  await deleteOne('instagramAccounts', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  if (account?.igUserId) {
    await deleteMany('automationRules', { accountId: account.igUserId }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }

  return c.json({ success: true })
})

// Manual "Refresh token" button
instagramAutomationRoutes.post('/accounts/:id/refresh-token', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) return c.json({ success: false, error: 'Account not found' }, 404)
  if (admin?.role === 'subadmin' && account.createdBy !== admin.id) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }
  if (!account.accessToken) {
    return c.json({ success: false, error: 'No access token saved. Reconnect the account.' }, 400)
  }

  const result = await refreshOneAccountToken(account.accessToken)

  if (!result.ok) {
    await updateOne('instagramAccounts', { _id: toObjectId(id) }, {
      tokenStatus: result.expired ? 'expired' : 'error',
      tokenError: result.error,
      tokenLastCheckedAt: new Date(),
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({
      success: false,
      error: result.expired
        ? 'Token has expired. Click "Connect Instagram" to reconnect this account.'
        : result.error,
    }, 502)
  }

  await updateOne('instagramAccounts', { _id: toObjectId(id) }, {
    accessToken: result.accessToken,
    tokenExpiresAt: result.expiresAt,
    tokenStatus: 'ok',
    tokenError: null,
    tokenLastCheckedAt: new Date(),
    tokenRefreshedAt: new Date(),
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, tokenExpiresAt: result.expiresAt })
})

// ---------------- ACCOUNT'S POSTS (live fetch from Instagram) ----------------

instagramAutomationRoutes.get('/accounts/:id/posts', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) return c.json({ success: false, error: 'Account not found' }, 404)

  if (admin?.role === 'subadmin' && account.createdBy !== admin.id) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  const res = await fetch(
    `https://graph.instagram.com/me/media` +
    `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
    `&limit=25&access_token=${account.accessToken}`
  )
  const data: any = await res.json()

  if (!res.ok) {
    console.error('Posts fetch failed', data)
    return c.json({
      success: false,
      error: data?.error?.message || 'Could not fetch posts from Instagram',
      igError: data?.error || null,
    }, 502)
  }

  return c.json({ success: true, posts: data.data || [] })
})

// ---------------- RULES ----------------

instagramAutomationRoutes.get('/rules', async (c) => {
  const admin = c.get('admin')
  const accountId = c.req.query('accountId')

  if (admin?.role === 'subadmin') {
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    if (accountId && !ownedIds.includes(accountId)) {
      return c.json({ success: true, rules: [] })
    }
    const filter = accountId ? { accountId } : { accountId: { $in: ownedIds } }
    const rules = await findMany<any>('automationRules', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, rules })
  }

  const filter = accountId ? { accountId } : {}
  const rules = await findMany<any>('automationRules', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true, rules })
})

instagramAutomationRoutes.post('/rules', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json()
  const { accountId, postId, postThumbnail, postCaption, keyword, matchType, dmMessage } = body

  if (!accountId || !keyword || !dmMessage) {
    return c.json({ success: false, error: 'accountId, keyword and dmMessage are required' }, 400)
  }

  if (admin?.role === 'subadmin') {
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    if (!ownedIds.includes(accountId)) {
      return c.json({ success: false, error: 'This account is not yours' }, 403)
    }
  }

  const result = await insertOne('automationRules', {
    accountId,
    postId: postId || null,
    postThumbnail: postThumbnail || null,
    postCaption: postCaption || null,
    keyword: keyword.trim(),
    matchType: matchType === 'exact' ? 'exact' : 'contains',
    dmMessage,
    isActive: true,
    createdAt: new Date(),
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, rule: result })
})

instagramAutomationRoutes.put('/rules/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid rule id' }, 400)

  if (admin?.role === 'subadmin') {
    const existing = await findMany<any>(
      'automationRules', { _id: toObjectId(id) }, { limit: 1 },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    if (!existing[0] || !ownedIds.includes(existing[0].accountId)) {
      return c.json({ success: false, error: 'This rule is not yours' }, 403)
    }
  }

  const body = await c.req.json()
  const updateData: any = {}
  if (body.keyword !== undefined) updateData.keyword = body.keyword.trim()
  if (body.matchType !== undefined) updateData.matchType = body.matchType
  if (body.dmMessage !== undefined) updateData.dmMessage = body.dmMessage
  if (body.isActive !== undefined) updateData.isActive = body.isActive
  if (body.postId !== undefined) updateData.postId = body.postId

  await updateOne('automationRules', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

instagramAutomationRoutes.delete('/rules/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid rule id' }, 400)

  if (admin?.role === 'subadmin') {
    const existing = await findMany<any>(
      'automationRules', { _id: toObjectId(id) }, { limit: 1 },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    if (!existing[0] || !ownedIds.includes(existing[0].accountId)) {
      return c.json({ success: false, error: 'This rule is not yours' }, 403)
    }
  }

  await deleteOne('automationRules', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ---------------- LOGS ----------------

instagramAutomationRoutes.get('/logs', async (c) => {
  const admin = c.get('admin')
  let filter: any = {}
  if (admin?.role === 'subadmin') {
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    filter = { accountId: { $in: ownedIds } }
  }

  const logs = await findMany<any>(
    'automationLogs', filter, { limit: 100, sort: { createdAt: -1 } },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, logs })
})

// ============================================================
// ---------------- POST CODES (auto-generated 6-digit caption codes) ----------------
// ============================================================

// main admin = always allowed, sub-admin = only their own IG accounts
async function ownsIgAccount(admin: any, igUserId: string, env: Env): Promise<boolean> {
  if (!admin || admin.role !== 'subadmin') return true
  const owned = (await getOwnedIgUserIds(admin, env.MONGODB_URI, env.MONGODB_DB)) || []
  return owned.includes(igUserId)
}

function randomSixDigit(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100000 + (arr[0] % 900000)) // always 6 digits
}

// ---------- Post code SCHEDULE (India time / IST) ----------
// schedule = { enabled, days: [0..6] (0 = Sun), slots: [{ startTime, endTime }] }  — times are 24h "HH:mm"
const MAX_SLOTS = 6
const DEFAULT_SCHEDULE = {
  enabled: false,
  days: [0, 1, 2, 3, 4, 5, 6],
  slots: [{ startTime: '00:00', endTime: '23:59' }],
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function sanitizeSchedule(s: any) {
  if (!s || !s.enabled) return { ...DEFAULT_SCHEDULE }

  const days = Array.from(new Set(
    (Array.isArray(s.days) ? s.days : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)
  )).sort() as number[]

  // accept both new format (slots[]) and old format (startTime/endTime)
  const rawSlots = Array.isArray(s.slots) ? s.slots : [{ startTime: s.startTime, endTime: s.endTime }]
  const slots = rawSlots
    .filter((sl: any) => TIME_RE.test(sl?.startTime) && TIME_RE.test(sl?.endTime))
    .slice(0, MAX_SLOTS)
    .map((sl: any) => ({ startTime: sl.startTime, endTime: sl.endTime }))

  return { enabled: true, days, slots }
}

// "21:30" -> "9:30 PM"
function fmt12(t: string): string {
  const [h, m] = String(t || '00:00').split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// 'global' = use the account's global schedule, 'custom' = this code's own schedule, 'always' = no schedule
type ScheduleMode = 'global' | 'custom' | 'always'
function parseScheduleMode(v: any): ScheduleMode {
  return v === 'custom' || v === 'always' ? v : 'global'
}

// ---------- GLOBAL schedule (one schedule for ALL post codes of an Instagram account) ----------
// Stored on the instagramAccounts document as `postCodeSchedule`.
// Codes with scheduleMode = 'global' follow it.
instagramAutomationRoutes.get('/post-code-schedule', async (c) => {
  const admin = c.get('admin')
  const accountId = c.req.query('accountId')
  if (!accountId) return c.json({ success: false, error: 'accountId is required' }, 400)
  if (!(await ownsIgAccount(admin, accountId, c.env))) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  const accounts = await findMany<any>(
    'instagramAccounts', { igUserId: accountId }, { limit: 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!accounts[0]) return c.json({ success: false, error: 'Instagram account not found' }, 404)

  return c.json({ success: true, schedule: accounts[0].postCodeSchedule || { ...DEFAULT_SCHEDULE } })
})

instagramAutomationRoutes.put('/post-code-schedule', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json()
  const accountId: string = body.accountId
  if (!accountId) return c.json({ success: false, error: 'accountId is required' }, 400)
  if (!(await ownsIgAccount(admin, accountId, c.env))) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  const schedule = sanitizeSchedule(body.schedule)
  if (schedule.enabled && (schedule.days.length === 0 || schedule.slots.length === 0)) {
    return c.json({ success: false, error: 'Select at least one day and one time slot' }, 400)
  }

  await updateOne(
    'instagramAccounts', { igUserId: accountId }, { postCodeSchedule: schedule },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, schedule })
})

// LIST
instagramAutomationRoutes.get('/post-codes', async (c) => {
  const admin = c.get('admin')
  const accountId = c.req.query('accountId')
  if (!accountId) return c.json({ success: false, error: 'accountId is required' }, 400)
  if (!(await ownsIgAccount(admin, accountId, c.env))) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }

  const codes = await findMany<any>(
    'postCodes', { accountId }, { limit: 100, sort: { createdAt: -1 } },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, codes })
})

// AUTO-GENERATE (single click)
instagramAutomationRoutes.post('/post-codes/generate', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json()
  const accountId: string = body.accountId
  const link: string = (body.link || '').trim()
  const label: string = (body.label || '').trim().slice(0, 80)
  const dmMessage: string = String(body.dmMessage || '').trim().slice(0, 1000)
  const triggerMode: string = ['exact', 'contains'].includes(body.triggerMode) ? body.triggerMode : 'any'
  const keyword: string = String(body.keyword || '').trim().slice(0, 100)
  if (triggerMode !== 'any' && !keyword) {
    return c.json({ success: false, error: 'Keyword is required' }, 400)
  }

  // ⏰ schedule: 'global' (account-wide) | 'custom' (this code only) | 'always'
  const scheduleMode = parseScheduleMode(body.scheduleMode)
  const schedule = sanitizeSchedule(scheduleMode === 'custom' ? { ...body.schedule, enabled: true } : null)
  if (scheduleMode === 'custom' && (schedule.days.length === 0 || schedule.slots.length === 0)) {
    return c.json({ success: false, error: 'Select at least one day and one time slot' }, 400)
  }

  if (!accountId) return c.json({ success: false, error: 'accountId is required' }, 400)
  if (!(await ownsIgAccount(admin, accountId, c.env))) {
    return c.json({ success: false, error: 'This account is not yours' }, 403)
  }
  if (link && !/^https?:\/\//i.test(link)) {
    return c.json({ success: false, error: 'Link must start with http:// or https://' }, 400)
  }

  // find a code that is not used yet on this account
  let code = ''
  for (let i = 0; i < 20; i++) {
    const candidate = randomSixDigit()
    const exists = await findMany<any>(
      'postCodes', { accountId, code: candidate }, { limit: 1 },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (exists.length === 0) { code = candidate; break }
  }
  if (!code) return c.json({ success: false, error: 'Could not generate a unique code, try again' }, 500)

  await insertOne('postCodes', {
    accountId,
    code,
    link,
    dmMessage,
    triggerMode,
    keyword: triggerMode === 'any' ? '' : keyword,
    scheduleMode,
    schedule,
    label,
    isActive: true,
    postId: null,      // filled automatically on the first comment after the post goes live
    hits: 0,
    createdAt: new Date(),
    createdBy: admin?.role === 'subadmin' ? admin.id : null,
    createdByUsername: admin?.role === 'subadmin' ? admin.username : 'Admin',
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, code, captionText: `ID:${code}` })
})

// UPDATE (change link / message / trigger / schedule / label / pause)
instagramAutomationRoutes.put('/post-codes/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid id' }, 400)

  const found = await findMany<any>(
    'postCodes', { _id: toObjectId(id) }, { limit: 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const doc = found[0]
  if (!doc) return c.json({ success: false, error: 'Code not found' }, 404)
  if (!(await ownsIgAccount(admin, doc.accountId, c.env))) {
    return c.json({ success: false, error: 'This code is not yours' }, 403)
  }

  const body = await c.req.json()
  const update: any = {}
  if (body.link !== undefined) {
    const link = String(body.link).trim()
    if (link && !/^https?:\/\//i.test(link)) {
      return c.json({ success: false, error: 'Link must start with http:// or https://' }, 400)
    }
    update.link = link
  }
  if (body.dmMessage !== undefined) update.dmMessage = String(body.dmMessage).trim().slice(0, 1000)
  if (body.triggerMode !== undefined) {
    const mode = ['exact', 'contains'].includes(body.triggerMode) ? body.triggerMode : 'any'
    const kw = String(body.keyword || '').trim().slice(0, 100)
    if (mode !== 'any' && !kw) {
      return c.json({ success: false, error: 'Keyword is required' }, 400)
    }
    update.triggerMode = mode
    update.keyword = mode === 'any' ? '' : kw
  }
  // ⏰ schedule mode + schedule can be changed any time
  if (body.scheduleMode !== undefined || body.schedule !== undefined) {
    const mode: ScheduleMode = body.scheduleMode !== undefined
      ? parseScheduleMode(body.scheduleMode)
      : (doc.scheduleMode || (doc.schedule?.enabled ? 'custom' : 'global'))
    const schedule = sanitizeSchedule(mode === 'custom' ? { ...(body.schedule ?? doc.schedule), enabled: true } : null)
    if (mode === 'custom' && (schedule.days.length === 0 || schedule.slots.length === 0)) {
      return c.json({ success: false, error: 'Select at least one day and one time slot' }, 400)
    }
    update.scheduleMode = mode
    update.schedule = schedule
  }
  if (body.label !== undefined) update.label = String(body.label).trim().slice(0, 80)
  if (body.isActive !== undefined) update.isActive = !!body.isActive

  await updateOne('postCodes', { _id: toObjectId(id) }, update, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// CHECK — find the post that has this code, link it now, report if DM is ready
instagramAutomationRoutes.post('/post-codes/:id/check', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid id' }, 400)

  const found = await findMany<any>(
    'postCodes', { _id: toObjectId(id) }, { limit: 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const doc = found[0]
  if (!doc) return c.json({ success: false, error: 'Code not found' }, 404)
  if (!(await ownsIgAccount(admin, doc.accountId, c.env))) {
    return c.json({ success: false, error: 'This code is not yours' }, 403)
  }

  const accounts = await findMany<any>(
    'instagramAccounts', { igUserId: doc.accountId }, { limit: 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) return c.json({ success: false, error: 'Instagram account not found' }, 404)

  const checks: { key: string; ok: boolean | null; text: string }[] = []

  checks.push({
    key: 'account', ok: !!account.isActive,
    text: account.isActive ? 'Account is active' : 'Account is paused. Resume it.',
  })
  const tokenOk = account.tokenStatus !== 'expired' && account.tokenStatus !== 'error'
  checks.push({
    key: 'token', ok: tokenOk,
    text: tokenOk ? 'Access token looks fine' : 'Token problem. Refresh it or reconnect the account.',
  })
  checks.push({
    key: 'code', ok: !!doc.isActive,
    text: doc.isActive ? 'Code is active' : 'Code is paused. Resume it.',
  })

  // ⏰ schedule status (India time)
  const sch = effectiveSchedule(doc, account)
  const schMode = doc.scheduleMode || (doc.schedule?.enabled ? 'custom' : 'global')
  if (sch?.enabled) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const slotText = (Array.isArray(sch.slots) && sch.slots.length
      ? sch.slots
      : [{ startTime: sch.startTime, endTime: sch.endTime }]
    ).map((s: any) => `${fmt12(s.startTime)}–${fmt12(s.endTime)}`).join(', ')
    const open = isCodeScheduleOpen(sch)
    checks.push({
      key: 'schedule', ok: open,
      text: `${schMode === 'custom' ? 'Own' : 'Global'} schedule: ${(sch.days || []).map((d: number) => names[d]).join(', ')} · ${slotText} IST. ${open ? 'Abhi ON hai' : 'Abhi OFF hai (comment pe DM nahi jayega)'}`,
    })
  } else {
    checks.push({
      key: 'schedule', ok: null,
      text: schMode === 'always' ? 'Schedule: Always on' : 'No schedule set. Code is always on',
    })
  }

  // find the post whose caption has this code
  let post: any = null
  let fetchError = ''
  try {
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,permalink,timestamp&limit=50&access_token=${account.accessToken}`
    )
    const data: any = await res.json()
    if (!res.ok) {
      fetchError = data?.error?.message || 'Instagram returned an error'
    } else {
      const re = new RegExp(`\\bID:\\s?${doc.code}\\b`, 'i')
      post = (data.data || []).find((p: any) => re.test(p.caption || '')) || null
    }
  } catch {
    fetchError = 'Could not reach Instagram'
  }

  if (fetchError) {
    checks.push({ key: 'post', ok: false, text: `Could not read your posts: ${fetchError}` })
  } else if (post) {
    checks.push({ key: 'post', ok: true, text: 'Post found and linked to this code. Trigger is on' })
  } else {
    checks.push({
      key: 'post', ok: false,
      text: `No post has ID:${doc.code} in its caption (checked latest 50 posts). Add it to the caption and save.`,
    })
  }

  let logs: any[] = []
  await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'checkPostCode', async (db) => {
    if (post) {
      await db.collection('postCodeCache').updateOne(
        { accountId: doc.accountId, postId: post.id },
        { $set: { accountId: doc.accountId, postId: post.id, code: doc.code, createdAt: new Date() } },
        { upsert: true }
      )
      await db.collection('postCodes').updateOne(
        { _id: toObjectId(id) },
        { $set: { postId: post.id, usedAt: new Date() } }
      )
    }

    const rules = await db.collection('automationRules')
      .find({ accountId: doc.accountId, isActive: true }).toArray()
    const usable = rules.filter((r: any) => !r.postId || (post && r.postId === post.id))

    const hasOwnMessage = !!(doc.dmMessage || '').trim()
    const mode = doc.triggerMode || 'any'

    if (hasOwnMessage) {
      checks.push({
        key: 'rule', ok: true,
        text: mode === 'any'
          ? 'No rule needed. Every comment on this post gets this code\'s message'
          : `No rule needed. A comment ${mode === 'exact' ? 'exactly' : 'containing'} "${doc.keyword}" gets this code's message`,
      })
    } else {
      checks.push(
        usable.length > 0
          ? { key: 'rule', ok: true, text: `${usable.length} active rule(s) will respond. Keywords: ${usable.map((r: any) => r.keyword).slice(0, 5).join(', ')}` }
          : { key: 'rule', ok: false, text: 'This code has no DM message and no rule matches. Add a message to the code or add a rule.' }
      )
    }

    if (post) {
      logs = await db.collection('automationLogs')
        .find({ accountId: doc.accountId, postId: post.id })
        .sort({ createdAt: -1 }).limit(5).toArray()
    }
  })

  checks.push(
    logs.length > 0
      ? { key: 'activity', ok: true, text: `${logs.length} recent comment(s) were handled on this post` }
      : { key: 'activity', ok: null, text: 'No comments handled on this post yet' }
  )

  return c.json({
    success: true,
    found: !!post,
    post: post ? { id: post.id, permalink: post.permalink } : null,
    checks,
    logs: logs.map((l: any) => ({
      status: l.status, matchedText: l.matchedText, createdAt: l.createdAt, error: l.error,
    })),
  })
})

// DELETE
instagramAutomationRoutes.delete('/post-codes/:id', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid id' }, 400)

  const found = await findMany<any>(
    'postCodes', { _id: toObjectId(id) }, { limit: 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const doc = found[0]
  if (!doc) return c.json({ success: false, error: 'Code not found' }, 404)
  if (!(await ownsIgAccount(admin, doc.accountId, c.env))) {
    return c.json({ success: false, error: 'This code is not yours' }, 403)
  }

  await deleteOne('postCodes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await deleteMany('postCodeCache', { accountId: doc.accountId, code: doc.code }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

export default instagramAutomationRoutes