 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { ObjectId } from 'mongodb'

const referralRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ JWT VERIFY (reuse same logic) ============
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

// ============ REWARD CONSTANTS ============
const REFERRER_REWARD = 40   // ₹40 to referrer
const REFERRED_REWARD = 25   // ₹25 to new user
const COMMISSION_PERCENT = 5 // 5% lifetime commission on referred user's earnings
const UNLOCK_CLICK_THRESHOLD = 1000

// ============ GENERATE UNIQUE REFERRAL CODE ============
function generateCode(username: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const base = username.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `${base}${random}`
}

// ============ GET MY REFERRAL INFO ============
referralRoutes.get('/my-code', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne({ _id: new ObjectId(id) })
    if (!user) return c.json({ error: 'User not found' }, 404)

    let referralCode = (user as any).referralCode

    // Agar code nahi hai to generate karo (one-time, retry on collision)
    if (!referralCode) {
      let attempts = 0
      while (attempts < 5) {
        const candidate = generateCode(user.username)
        const exists = await db.collection('shortusers').findOne({ referralCode: candidate })
        if (!exists) {
          referralCode = candidate
          await db.collection('shortusers').updateOne(
            { _id: new ObjectId(id) },
            { $set: { referralCode: candidate } }
          )
          break
        }
        attempts++
      }
    }

    return c.json({
      referralCode,
      referralLink: `https://animebing.in/dashboard?ref=${referralCode}`,
      rewards: {
        referrerReward: REFERRER_REWARD,
        referredReward: REFERRED_REWARD,
        commissionPercent: COMMISSION_PERCENT,
        unlockThreshold: UNLOCK_CLICK_THRESHOLD
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ VALIDATE REFERRAL CODE (used at registration) ============
referralRoutes.get('/validate/:code', async (c) => {
  try {
    const code = c.req.param('code').toUpperCase().trim()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const referrer = await db.collection('shortusers').findOne({ referralCode: code })
    if (!referrer || !referrer.isActive) {
      return c.json({ valid: false, error: 'Invalid or inactive referral code' })
    }

    return c.json({
      valid: true,
      referrerName: referrer.realName
    })
  } catch (err: any) {
    return c.json({ valid: false, error: err.message })
  }
})

// ============ MY REFERRAL STATS & LIST ============
referralRoutes.get('/my-referrals', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const referrals = await db.collection('shortreferrals')
      .find({ referrerId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray()

    // har referred user ke current clicks fetch karo
    const referredIds = referrals.map((r: any) => r.referredId)
    const referredUsers = await db.collection('shortusers')
      .find({ _id: { $in: referredIds } })
      .project({ _id: 1, totalClicks: 1, realName: 1, username: 1, createdAt: 1, isActive: 1 })
      .toArray()

    const userMap: Record<string, any> = {}
    referredUsers.forEach((u: any) => { userMap[u._id.toString()] = u })

    const list = referrals.map((r: any) => {
      const u = userMap[r.referredId.toString()]
      const currentClicks = u?.totalClicks || 0
      const remaining = Math.max(0, UNLOCK_CLICK_THRESHOLD - currentClicks)
      return {
        _id: r._id,
        referredUsername: r.referredUsername,
        referredRealName: u?.realName || r.referredUsername,
        status: r.status,
        referrerReward: r.referrerReward,
        currentClicks,
        unlockThreshold: UNLOCK_CLICK_THRESHOLD,
        clicksRemaining: remaining,
        progressPercent: Math.min(100, Math.round((currentClicks / UNLOCK_CLICK_THRESHOLD) * 100)),
        joinedAt: r.createdAt,
        unlockedAt: r.unlockedAt || null,
        isActive: u?.isActive ?? true
      }
    })

    // Summary
    const totalReferred = referrals.length
    const unlockedCount = referrals.filter((r: any) => r.status === 'unlocked').length
    const pendingCount = referrals.filter((r: any) => r.status === 'pending').length
    const totalEarnedFromReferrals = referrals
      .filter((r: any) => r.referrerRewardCredited)
      .reduce((sum: number, r: any) => sum + r.referrerReward, 0)

    // Commission earnings (5% of referred users' total earnings, ongoing)
    let totalCommission = 0
    for (const u of referredUsers) {
      const fullUser = await db.collection('shortusers').findOne({ _id: u._id })
      if (fullUser) {
        totalCommission += ((fullUser.totalEarnings || 0) * COMMISSION_PERCENT) / 100
      }
    }

    return c.json({
      summary: {
        totalReferred,
        unlockedCount,
        pendingCount,
        totalEarnedFromReferrals,
        estimatedCommissionEarnings: Math.round(totalCommission * 100) / 100,
        commissionPercent: COMMISSION_PERCENT
      },
      referrals: list
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ INTERNAL: CREATE REFERRAL RECORD (called from register route) ============
// Yeh function shortUserRoutes.ts ke /register route se call hoga (direct DB insert)
// Isliye yahan koi extra route nahi — logic shortUserRoutes mein hi rahega
// But exporting helper constants for reuse:

export { REFERRER_REWARD, REFERRED_REWARD, COMMISSION_PERCENT, UNLOCK_CLICK_THRESHOLD }

export default referralRoutes