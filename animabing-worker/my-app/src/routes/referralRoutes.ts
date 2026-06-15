import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { ObjectId } from 'mongodb'

const referralRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

const adminAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Admin login required' }, 401)
  }
  const token = authHeader.slice(7)
  const payload = await verifyJWT(token, c.env.JWT_SECRET)
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
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

// ============ UNLOCK HELPER FUNCTION ============
// Yeh function shortenerRoutes.ts se bhi call hoga
export async function checkAndUnlockReferral(
  referredUserId: ObjectId,
  db: any
): Promise<void> {
  try {
    // Check karo koi pending referral hai is user ke liye
    const referral = await db.collection('shortreferrals').findOne({
      referredId: referredUserId,
      status: 'pending'
    })
    if (!referral) return

    // Referred user ke current clicks fetch karo
    const referredUser = await db.collection('shortusers').findOne({ _id: referredUserId })
    if (!referredUser) return

    const currentClicks = referredUser.totalClicks || 0
    if (currentClicks < UNLOCK_CLICK_THRESHOLD) return

    // ✅ 1000 clicks ho gaye — UNLOCK karo
    await db.collection('shortreferrals').updateOne(
      { _id: referral._id },
      {
        $set: {
          status: 'unlocked',
          unlockedAt: new Date(),
          referrerRewardCredited: true,
          referredRewardCredited: true
        }
      }
    )

    // ✅ Referrer ko ₹40 do
    await db.collection('shortusers').updateOne(
      { _id: referral.referrerId },
      {
        $inc: {
          totalEarnings: REFERRER_REWARD,
          unpaidEarnings: REFERRER_REWARD
        }
      }
    )

    // ✅ Referred user ko ₹25 do
    await db.collection('shortusers').updateOne(
      { _id: referredUserId },
      {
        $inc: {
          totalEarnings: REFERRED_REWARD,
          unpaidEarnings: REFERRED_REWARD
        }
      }
    )

    // ✅ Referrer ko notification message
    await db.collection('shortmessages').insertOne({
      userId: referral.referrerId,
      username: referral.referrerUsername,
      realName: referral.referrerUsername,
      text: `🎉 Congratulations! Your referral @${referral.referredUsername} has completed ${UNLOCK_CLICK_THRESHOLD} clicks! You earned ₹${REFERRER_REWARD} bonus + ${COMMISSION_PERCENT}% lifetime commission on their earnings.`,
      fromAdmin: true,
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date()
    })

    // ✅ Referred user ko notification message
    await db.collection('shortmessages').insertOne({
      userId: referredUserId,
      username: referredUser.username,
      realName: referredUser.realName,
      text: `🎉 Congratulations! You completed ${UNLOCK_CLICK_THRESHOLD} clicks! You earned ₹${REFERRED_REWARD} referral bonus. Keep it up!`,
      fromAdmin: true,
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date()
    })

  } catch (err) {
    console.error('checkAndUnlockReferral error:', err)
  }
}

// ============ COMMISSION CREDIT HELPER ============
// Jab bhi referred user earnings kare, referrer ka 5% commission update karo
export async function creditCommissionToReferrer(
  referredUserId: ObjectId,
  newEarnings: number,
  db: any
): Promise<void> {
  try {
    // Check karo koi unlocked referral hai is user ke liye
    const referral = await db.collection('shortreferrals').findOne({
      referredId: referredUserId,
      status: 'unlocked'
    })
    if (!referral) return

    const commission = (newEarnings * COMMISSION_PERCENT) / 100
    if (commission <= 0) return

    // Commission referrer ke earnings mein add karo
    await db.collection('shortusers').updateOne(
      { _id: referral.referrerId },
      {
        $inc: {
          totalEarnings: commission,
          unpaidEarnings: commission,
          totalCommissionEarned: commission
        }
      }
    )

    // Commission record track karo
    await db.collection('shortcommissions').insertOne({
      referralId: referral._id,
      referrerId: referral.referrerId,
      referrerUsername: referral.referrerUsername,
      referredId: referredUserId,
      referredUsername: referral.referredUsername,
      baseEarnings: newEarnings,
      commissionPercent: COMMISSION_PERCENT,
      commissionAmount: commission,
      creditedAt: new Date()
    })

  } catch (err) {
    console.error('creditCommissionToReferrer error:', err)
  }
}

// ============ GET MY REFERRAL INFO ============
referralRoutes.get('/my-code', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne({ _id: new ObjectId(id) })
    if (!user) return c.json({ error: 'User not found' }, 404)

    let referralCode = (user as any).referralCode

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

    const referredIds = referrals.map((r: any) => r.referredId)
    const referredUsers = await db.collection('shortusers')
      .find({ _id: { $in: referredIds } })
      .project({ _id: 1, totalClicks: 1, realName: 1, username: 1, createdAt: 1, isActive: 1, totalEarnings: 1 })
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

    const totalReferred = referrals.length
    const unlockedCount = referrals.filter((r: any) => r.status === 'unlocked').length
    const pendingCount = referrals.filter((r: any) => r.status === 'pending').length
    const flaggedCount = referrals.filter((r: any) => r.status === 'flagged').length
    const totalEarnedFromReferrals = referrals
      .filter((r: any) => r.referrerRewardCredited)
      .reduce((sum: number, r: any) => sum + r.referrerReward, 0)

    // Commission earnings — referred users ki totalEarnings ka 5%
    let totalCommission = 0
    for (const u of referredUsers) {
      totalCommission += ((u.totalEarnings || 0) * COMMISSION_PERCENT) / 100
    }

    // Actual credited commission from shortcommissions collection
    const commissionResult = await db.collection('shortcommissions').aggregate([
      { $match: { referrerId: new ObjectId(id) } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } }
    ]).toArray()
    const actualCommissionCredited = commissionResult[0]?.total || 0

    return c.json({
      summary: {
        totalReferred,
        unlockedCount,
        pendingCount,
        flaggedCount,
        totalEarnedFromReferrals,
        estimatedCommissionEarnings: Math.round(totalCommission * 100) / 100,
        actualCommissionCredited: Math.round(actualCommissionCredited * 100) / 100,
        commissionPercent: COMMISSION_PERCENT
      },
      referrals: list
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — FLAGGED REFERRALS LIST ============
referralRoutes.get('/admin/flagged', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const flagged = await db.collection('shortreferrals')
      .find({ status: 'flagged' })
      .sort({ createdAt: -1 })
      .toArray()

    // Har flagged referral ke liye referrer aur referred user ki info fetch karo
    const enriched = await Promise.all(flagged.map(async (r: any) => {
      const referrer = await db.collection('shortusers').findOne(
        { _id: r.referrerId },
        { projection: { username: 1, realName: 1, registrationIp: 1, totalClicks: 1 } }
      )
      const referred = await db.collection('shortusers').findOne(
        { _id: r.referredId },
        { projection: { username: 1, realName: 1, registrationIp: 1, totalClicks: 1, isActive: 1 } }
      )
      return {
        _id: r._id,
        status: r.status,
        ip: r.ip,
        createdAt: r.createdAt,
        referrer: {
          username: referrer?.username || r.referrerUsername,
          realName: referrer?.realName || '',
          ip: referrer?.registrationIp || 'unknown',
          totalClicks: referrer?.totalClicks || 0
        },
        referred: {
          username: referred?.username || r.referredUsername,
          realName: referred?.realName || '',
          ip: referred?.registrationIp || 'unknown',
          totalClicks: referred?.totalClicks || 0,
          isActive: referred?.isActive ?? true
        },
        sameIp: r.ip === referrer?.registrationIp || r.ip === referred?.registrationIp
      }
    }))

    return c.json({
      total: flagged.length,
      flagged: enriched
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE FLAGGED REFERRAL STATUS ============
referralRoutes.put('/admin/flagged/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { action } = await c.req.json() // 'approve' ya 'reject'
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const referral = await db.collection('shortreferrals').findOne({ _id: new ObjectId(id) })
    if (!referral) return c.json({ error: 'Referral not found' }, 404)

    if (action === 'approve') {
      // Pending mein wapas lao taaki unlock trigger kaam kare
      await db.collection('shortreferrals').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'pending', reviewedAt: new Date(), reviewAction: 'approved' } }
      )

      // Turant check karo unlock hona chahiye ya nahi
      await checkAndUnlockReferral(referral.referredId, db)

      return c.json({ success: true, message: 'Referral approved and unlock check done.' })

    } else if (action === 'reject') {
      await db.collection('shortreferrals').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', reviewedAt: new Date(), reviewAction: 'rejected' } }
      )
      return c.json({ success: true, message: 'Referral rejected.' })

    } else {
      return c.json({ error: 'Invalid action. Use approve or reject.' }, 400)
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MANUAL UNLOCK TRIGGER ============
referralRoutes.post('/admin/unlock/:referredUserId', adminAuth, async (c) => {
  try {
    const referredUserId = c.req.param('referredUserId')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    await checkAndUnlockReferral(new ObjectId(referredUserId), db)

    return c.json({ success: true, message: 'Unlock check completed.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — COMMISSION HISTORY ============
referralRoutes.get('/admin/commissions', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const commissions = await db.collection('shortcommissions')
      .find({})
      .sort({ creditedAt: -1 })
      .limit(100)
      .toArray()

    const totalResult = await db.collection('shortcommissions').aggregate([
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } }
    ]).toArray()

    return c.json({
      total: totalResult[0]?.total || 0,
      commissions
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export { REFERRER_REWARD, REFERRED_REWARD, COMMISSION_PERCENT, UNLOCK_CLICK_THRESHOLD }

export default referralRoutes