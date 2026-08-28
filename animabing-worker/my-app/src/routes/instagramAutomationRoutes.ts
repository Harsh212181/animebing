 import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { findMany, insertOne, updateOne, deleteOne, deleteMany, toObjectId, isValidObjectId } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'

const instagramAutomationRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// Sirf logged-in admin/sub-admin hi in routes ko access kar sakta hai
instagramAutomationRoutes.use('*', adminAuth)

// 👇 Helper: Sub-admin ke owned instagram accounts ke igUserId nikaalne ke liye
async function getOwnedIgUserIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (!admin || admin.role !== 'subadmin') return null // null = restriction nahi (main admin)
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
  const safeAccounts = accounts.map((a: any) => ({
    _id: a._id,
    igUsername: a.igUsername,
    igUserId: a.igUserId,
    isActive: a.isActive,
    connectedAt: a.connectedAt,
    profilePictureUrl: a.profilePictureUrl || null,
    createdBy: a.createdBy || null,
    createdByUsername: a.createdByUsername || 'Admin',   // badge ke liye
  }))
  return c.json({ success: true, accounts: safeAccounts })
})

instagramAutomationRoutes.post('/accounts', async (c) => {
  const admin = c.get('admin')
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
    if (owned.length === 0) return c.json({ success: false, error: 'Ye account aapka nahi hai' }, 403)
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
    return c.json({ success: false, error: 'Ye account aapka nahi hai' }, 403)
  }

  await deleteOne('instagramAccounts', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  if (account?.igUserId) {
    await deleteMany('automationRules', { accountId: account.igUserId }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }

  return c.json({ success: true })
})

// ---------------- ACCOUNT KE POSTS (Instagram se live fetch) ----------------

instagramAutomationRoutes.get('/accounts/:id/posts', async (c) => {
  const admin = c.get('admin')
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid account id' }, 400)

  const accounts = await findMany<any>(
    'instagramAccounts', { _id: toObjectId(id) }, { limit: 1 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) return c.json({ success: false, error: 'Account nahi mila' }, 404)

  if (admin?.role === 'subadmin' && account.createdBy !== admin.id) {
    return c.json({ success: false, error: 'Ye account aapka nahi hai' }, 403)
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
      error: data?.error?.message || 'Instagram se posts fetch nahi ho paye',
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
    return c.json({ success: false, error: 'accountId, keyword aur dmMessage zaroori hain' }, 400)
  }

  if (admin?.role === 'subadmin') {
    const ownedIds = await getOwnedIgUserIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB) || []
    if (!ownedIds.includes(accountId)) {
      return c.json({ success: false, error: 'Ye account aapka nahi hai' }, 403)
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
      return c.json({ success: false, error: 'Ye rule aapki nahi hai' }, 403)
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
      return c.json({ success: false, error: 'Ye rule aapki nahi hai' }, 403)
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

export default instagramAutomationRoutes