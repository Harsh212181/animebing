import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { IShortUser } from '../models/types'
import { ObjectId } from 'mongodb'

const shortUserRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ JWT CREATE ============
async function createJWT(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  }))
  const keyData = encoder.encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${header}.${body}`))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${header}.${body}.${sigB64}`
}

// ============ JWT VERIFY ============
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, sig, encoder.encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ============ USER AUTH MIDDLEWARE ============
const userAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Login required' }, 401)
  }
  const token = authHeader.slice(7)
  const payload = await verifyJWT(token, c.env.JWT_SECRET)
  if (!payload || payload.role !== 'shortuser') {
    return c.json({ error: 'Invalid token' }, 401)
  }
  c.set('shortUser', payload)
  await next()
}

// ============ USER LOGIN ============
shortUserRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) {
      return c.json({ error: 'Username aur password required hai' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne({ username }) as IShortUser | null
    if (!user || user.password !== password) {
      return c.json({ error: 'Invalid username ya password' }, 401)
    }
    if (!user.isActive) {
      return c.json({ error: 'Account inactive hai. Admin se contact karo.' }, 403)
    }
    const token = await createJWT(
      { id: user._id!.toString(), username: user.username, role: 'shortuser' },
      c.env.JWT_SECRET
    )
    return c.json({
      success: true,
      token,
      user: {
        username: user.username,
        realName: user.realName,
        totalClicks: user.totalClicks,
        totalEarnings: user.totalEarnings,
        unpaidEarnings: user.unpaidEarnings,
        ratePerThousand: user.ratePerThousand
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER DASHBOARD ============
shortUserRoutes.get('/dashboard', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User nahi mila' }, 404)

    // User ke saare links
    const links = await db.collection('shortlinks')
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray()

    // Aaj ke clicks
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayClicks = await db.collection('shortclicks').countDocuments({
      userId: new ObjectId(id),
      clickedAt: { $gte: todayStart }
    })

    // Last 7 days clicks
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const count = await db.collection('shortclicks').countDocuments({
        userId: new ObjectId(id),
        clickedAt: { $gte: dayStart, $lte: dayEnd }
      })

      last7Days.push({
        date: dayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        clicks: count
      })
    }

    // Top countries
    const topCountries = await db.collection('shortclicks').aggregate([
      { $match: { userId: new ObjectId(id) } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray()

    return c.json({
      user: {
        username: user.username,
        realName: user.realName,
        totalClicks: user.totalClicks || 0,
        todayClicks,
        totalEarnings: user.totalEarnings || 0,
        unpaidEarnings: user.unpaidEarnings || 0,
        paidEarnings: user.paidEarnings || 0,
        ratePerThousand: user.ratePerThousand || 0
      },
      links,
      last7Days,
      topCountries
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — USER BANAO ============
shortUserRoutes.post('/admin/users', adminAuth, async (c) => {
  try {
    const { username, password, realName, ratePerThousand } = await c.req.json()
    if (!username || !password || !realName) {
      return c.json({ error: 'username, password aur realName required hain' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortusers').findOne({ username })
    if (existing) return c.json({ error: 'Yeh username already exist karta hai' }, 400)

    const newUser = {
      username,
      password,
      realName,
      ratePerThousand: ratePerThousand || 10,
      isActive: true,
      totalClicks: 0,
      totalEarnings: 0,
      unpaidEarnings: 0,
      paidEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    await db.collection('shortusers').insertOne(newUser)
    return c.json({ success: true, message: 'User ban gaya!', user: { ...newUser, password: '***' } })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — SAARE USERS DEKHO ============
shortUserRoutes.get('/admin/users', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const users = await db.collection('shortusers')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(users.map((u: any) => ({ ...u, password: '***' })))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — USER UPDATE KARO ============
shortUserRoutes.put('/admin/users/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { password, realName, ratePerThousand, isActive } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const updateData: any = { updatedAt: new Date() }
    if (password) updateData.password = password
    if (realName) updateData.realName = realName
    if (ratePerThousand !== undefined) updateData.ratePerThousand = ratePerThousand
    if (isActive !== undefined) updateData.isActive = isActive

    await db.collection('shortusers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    return c.json({ success: true, message: 'User update ho gaya!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — PAYMENT MARK KARO ============
shortUserRoutes.post('/admin/users/:id/pay', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { amount, note } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User nahi mila' }, 404)

    await db.collection('shortusers').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: {
          paidEarnings: amount,
          unpaidEarnings: -amount
        },
        $set: { updatedAt: new Date() }
      }
    )

    // Payment history save karo
    await db.collection('payments').insertOne({
      userId: new ObjectId(id),
      username: user.username,
      realName: user.realName,
      amount,
      note: note || '',
      paidAt: new Date()
    })

    return c.json({ success: true, message: `₹${amount} payment mark ho gaya!` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — SAARE STATS ============
shortUserRoutes.get('/admin/stats', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const totalUsers = await db.collection('shortusers').countDocuments({})
    const activeUsers = await db.collection('shortusers').countDocuments({ isActive: true })
    const totalClicks = await db.collection('shortclicks').countDocuments({})

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayClicks = await db.collection('shortclicks').countDocuments({
      clickedAt: { $gte: todayStart }
    })

    // Last 7 days
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const count = await db.collection('shortclicks').countDocuments({
        clickedAt: { $gte: dayStart, $lte: dayEnd }
      })
      last7Days.push({
        date: dayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        clicks: count
      })
    }

    // Top countries
    const topCountries = await db.collection('shortclicks').aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    // Unpaid total
    const unpaidResult = await db.collection('shortusers').aggregate([
      { $group: { _id: null, total: { $sum: '$unpaidEarnings' } } }
    ]).toArray()
    const totalUnpaid = unpaidResult[0]?.total || 0

    // All users with stats
    const users = await db.collection('shortusers')
      .find({})
      .sort({ totalClicks: -1 })
      .toArray()

    return c.json({
      totalUsers,
      activeUsers,
      totalClicks,
      todayClicks,
      totalUnpaid,
      last7Days,
      topCountries,
      users: users.map((u: any) => ({ ...u, password: '***' }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortUserRoutes