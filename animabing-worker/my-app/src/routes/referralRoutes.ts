import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { withDb } from '../services/mongoService'
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
const REFERRER_REWARD = 40
const REFERRED_REWARD = 25
const COMMISSION_PERCENT = 5
const UNLOCK_CLICK_THRESHOLD = 1000

// ============ GENERATE UNIQUE REFERRAL CODE ============
function generateCode(username: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const base = username.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `${base}${random}`
}

// ============ UNLOCK HELPER FUNCTION ============
export async function checkAndUnlockReferral(
  referredUserId: ObjectId,
  db: any
): Promise<void> {
  try {
    const referral = await db.collection('shortreferrals').findOne({
      referredId: referredUserId,
      status: 'pending'
    })
    if (!referral) return

    const referredUser = await db.collection('shortusers').findOne({ _id: referredUserId })
    if (!referredUser) return

    const currentClicks = referredUser.totalClicks || 0
    if (currentClicks < UNLOCK_CLICK_THRESHOLD) return

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

    await db.collection('shortusers').updateOne(
      { _id: referral.referrerId },
      {
        $inc: {
          totalEarnings: REFERRER_REWARD,
          unpaidEarnings: REFERRER_REWARD
        }
      }
    )

    await db.collection('shortusers').updateOne(
      { _id: referredUserId },
      {
        $inc: {
          totalEarnings: REFERRED_REWARD,
          unpaidEarnings: REFERRED_REWARD
        }
      }
    )

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
export async function creditCommissionToReferrer(
  referredUserId: ObjectId,
  newEarnings: number,
  db: any
): Promise<void> {
  try {
    const referral = await db.collection('shortreferrals').findOne({
      referredId: referredUserId,
      status: 'unlocked'
    })
    if (!referral) return

    const commission = (newEarnings * COMMISSION_PERCENT) / 100
    if (commission <= 0) return

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
// ✅ FIX: getDb → withDb
referralRoutes.get('/my-code', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/my-code', async (db) => {
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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ VALIDATE REFERRAL CODE ============
// ✅ FIX: getDb → withDb
referralRoutes.get('/validate/:code', async (c) => {
  try {
    const code = c.req.param('code').toUpperCase().trim()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/validate', async (db) => {
      const referrer = await db.collection('shortusers').findOne({ referralCode: code })
      if (!referrer || !referrer.isActive) {
        return c.json({ valid: false, error: 'Invalid or inactive referral code' })
      }

      return c.json({
        valid: true,
        referrerName: referrer.realName
      })
    })
  } catch (err: any) {
    return c.json({ valid: false, error: err.message })
  }
})

// ============ MY REFERRAL STATS & LIST ============
// ✅ FIX: getDb → withDb
referralRoutes.get('/my-referrals', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/my-referrals', async (db) => {
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

      let totalCommission = 0
      for (const u of referredUsers) {
        totalCommission += ((u.totalEarnings || 0) * COMMISSION_PERCENT) / 100
      }

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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — FLAGGED REFERRALS LIST ============
// ✅ FIX: getDb → withDb + N+1 problem solved
// Pehle: har flagged referral ke liye 2 findOne = 2N connections
// Ab: 1 withDb + 2 aggregation-style batched queries
referralRoutes.get('/admin/flagged', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/admin/flagged', async (db) => {
      const flagged = await db.collection('shortreferrals')
        .find({ status: 'flagged' })
        .sort({ createdAt: -1 })
        .toArray()

      if (flagged.length === 0) {
        return c.json({ total: 0, flagged: [] })
      }

      const referrerIds = flagged.map((r: any) => r.referrerId).filter(Boolean)
      const referredIds = flagged.map((r: any) => r.referredId).filter(Boolean)

      const [referrers, referred] = await Promise.all([
        db.collection('shortusers')
          .find(
            { _id: { $in: referrerIds } },
            { projection: { username: 1, realName: 1, registrationIp: 1, totalClicks: 1 } }
          )
          .toArray(),
        db.collection('shortusers')
          .find(
            { _id: { $in: referredIds } },
            { projection: { username: 1, realName: 1, registrationIp: 1, totalClicks: 1, isActive: 1 } }
          )
          .toArray()
      ])

      const referrerMap = new Map(referrers.map((u: any) => [u._id.toString(), u]))
      const referredMap = new Map(referred.map((u: any) => [u._id.toString(), u]))

      const enriched = flagged.map((r: any) => {
        const referrer = referrerMap.get(r.referrerId?.toString())
        const referredUser = referredMap.get(r.referredId?.toString())
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
            username: referredUser?.username || r.referredUsername,
            realName: referredUser?.realName || '',
            ip: referredUser?.registrationIp || 'unknown',
            totalClicks: referredUser?.totalClicks || 0,
            isActive: referredUser?.isActive ?? true
          },
          sameIp: r.ip === referrer?.registrationIp || r.ip === referredUser?.registrationIp
        }
      })

      return c.json({
        total: flagged.length,
        flagged: enriched
      })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE FLAGGED REFERRAL STATUS ============
// ✅ FIX: getDb → withDb
referralRoutes.put('/admin/flagged/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { action } = await c.req.json()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/admin/flagged-update', async (db) => {
      const referral = await db.collection('shortreferrals').findOne({ _id: new ObjectId(id) })
      if (!referral) return c.json({ error: 'Referral not found' }, 404)

      if (action === 'approve') {
        await db.collection('shortreferrals').updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'pending', reviewedAt: new Date(), reviewAction: 'approved' } }
        )

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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MANUAL UNLOCK TRIGGER ============
// ✅ FIX: getDb → withDb
referralRoutes.post('/admin/unlock/:referredUserId', adminAuth, async (c) => {
  try {
    const referredUserId = c.req.param('referredUserId')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/admin/unlock', async (db) => {
      await checkAndUnlockReferral(new ObjectId(referredUserId), db)
      return c.json({ success: true, message: 'Unlock check completed.' })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — COMMISSION HISTORY ============
// ✅ FIX: getDb → withDb
referralRoutes.get('/admin/commissions', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'referral/admin/commissions', async (db) => {
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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export { REFERRER_REWARD, REFERRED_REWARD, COMMISSION_PERCENT, UNLOCK_CLICK_THRESHOLD }

export default referralRoutes