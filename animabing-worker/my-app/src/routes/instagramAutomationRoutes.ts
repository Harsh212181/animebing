 import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { findMany, insertOne, updateOne, deleteOne, deleteMany, toObjectId, isValidObjectId } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'

const instagramAutomationRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// Sirf logged-in admin/sub-admin hi in routes ko access kar sakta hai
instagramAutomationRoutes.use('*', adminAuth)

// ---------------- ACCOUNTS ----------------

instagramAutomationRoutes.get('/accounts', async (c) => {
  const accounts = await findMany<any>(
    'instagramAccounts', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const safeAccounts = accounts.map((a: any) => ({
    _id: a._id,
    igUsername: a.igUsername,
    igUserId: a.igUserId,
    isActive: a.isActive,
    connectedAt: a.connectedAt,
    profilePictureUrl: a.profilePictureUrl || null,   // 👈 naya field
  }))
  return c.json({ success: true, accounts: safeAccounts })
})

instagramAutomationRoutes.post('/accounts', async (c) => {
  const body = await c.req.json()
  const { igUsername, igUserId, accessToken } = body

  if (!igUsername || !igUserId || !accessToken) {
    return c.json({ success: false, error: 'igUsername, igUserId aur accessToken zaroori hain' }, 400)
  }

  const result = await insertOne('instagramAccounts', {
    igUsername,
    igUserId,
    accessToken,
    isActive: true,
    connectedAt: new Date(),
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, account: result })
})

instagramAutomationRoutes.put('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)
  const body = await c.req.json()

  await updateOne('instagramAccounts', { _id: toObjectId(id) }, { isActive: body.isActive }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

instagramAutomationRoutes.delete('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  // 👇 Pehle account nikaalo taaki uska igUserId mile (rules isi se linked hote hain, mongo _id se nahi)
  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]

  await deleteOne('instagramAccounts', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  // 👇 Account ke saare automation rules bhi delete karo — warna orphan rules DB me reh jaate hain
  if (account?.igUserId) {
    await deleteMany('automationRules', { accountId: account.igUserId }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }

  return c.json({ success: true })
})

// ---------------- ACCOUNT KE POSTS (Instagram se live fetch) ----------------

instagramAutomationRoutes.get('/accounts/:id/posts', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) return c.json({ success: false, error: 'Account nahi mila' }, 404)

  // 👇 /me/media use karte hain, igUserId ki jagah
  // ⚠️ FIX: 'v23.0' version prefix hata diya — graph.instagram.com
  // (Instagram Login API) unversioned calls expect karta hai, warna Meta
  // "Unsupported request" jaisa misleading error deta hai.
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
      error: data?.error?.message || 'Instagram se posts fetch nahi ho paye',
      igError: data?.error || null,
    }, 502)
  }

  return c.json({ success: true, posts: data.data || [] })
})

// ---------------- RULES ----------------

instagramAutomationRoutes.get('/rules', async (c) => {
  const accountId = c.req.query('accountId')
  const filter = accountId ? { accountId } : {}
  const rules = await findMany<any>(
    'automationRules', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, rules })
})

instagramAutomationRoutes.post('/rules', async (c) => {
  const body = await c.req.json()
  const { accountId, postId, postThumbnail, postCaption, keyword, matchType, dmMessage } = body

  if (!accountId || !keyword || !dmMessage) {
    return c.json({ success: false, error: 'accountId, keyword aur dmMessage zaroori hain' }, 400)
  }

  const result = await insertOne('automationRules', {
    accountId,
    postId: postId || null,
    postThumbnail: postThumbnail || null,   // 👈 naya field
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
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid rule id' }, 400)
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
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid rule id' }, 400)
  await deleteOne('automationRules', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ---------------- LOGS ----------------

instagramAutomationRoutes.get('/logs', async (c) => {
  const logs = await findMany<any>(
    'automationLogs', {}, { limit: 100, sort: { createdAt: -1 } },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, logs })
})

export default instagramAutomationRoutes