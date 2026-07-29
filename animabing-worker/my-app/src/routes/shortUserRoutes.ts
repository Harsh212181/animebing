 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth, requirePermission } from '../middleware/auth'
import { IShortUser } from '../models/types'
import { ObjectId } from 'mongodb'
import { getUserSelfAnalytics } from '../services/analyticsService'
import { REFERRER_REWARD, REFERRED_REWARD, COMMISSION_PERCENT, UNLOCK_CLICK_THRESHOLD } from './referralRoutes'

const shortUserRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ HELPER: kya ye admin/subadmin is short-user ko manage kar sakta hai ============
function canManageShortUser(user: any, admin: any): boolean {
  if (!admin || admin.role !== 'subadmin') return true
  return user?.createdByAdminId === admin.id
}

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

// ============ USER LOGIN (username + password) ============
shortUserRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne({ username }) as IShortUser | null
    if (!user || user.password !== password) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }
    if (!user.isActive) {
      return c.json({ error: 'Account is inactive. Please contact admin.' }, 403)
    }
    const token = await createJWT(
      { id: user._id!.toString(), username: user.username, role: 'shortuser' },
      c.env.JWT_SECRET
    )

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    await db.collection('shortlogins').updateOne(
      { userId: user._id, date: dateStr },
      { $setOnInsert: { userId: user._id, username: user.username, loginAt: today, date: dateStr } },
      { upsert: true }
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
        ratePerThousand: user.ratePerThousand,
        profile: user.profile || {},
        avatarId: (user as any).avatarId || null,
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ GMAIL LOGIN ============
shortUserRoutes.post('/login/gmail', async (c) => {
  try {
    const { gmail } = await c.req.json()
    if (!gmail) {
      return c.json({ error: 'Gmail address is required' }, 400)
    }

    const normalizedGmail = gmail.toLowerCase().trim()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne({
      $or: [
        { gmailLinked: normalizedGmail },
        { 'profile.gmail': normalizedGmail }
      ]
    }) as IShortUser | null

    if (!user) {
      return c.json({ error: 'No account linked with this Gmail address. Please login with username and password.' }, 404)
    }
    if (!user.isActive) {
      return c.json({ error: 'Account is inactive. Please contact admin.' }, 403)
    }

    if (!user.gmailLinked && (user.profile as any)?.gmail === normalizedGmail) {
      await db.collection('shortusers').updateOne(
        { _id: user._id },
        { $set: { gmailLinked: normalizedGmail, updatedAt: new Date() } }
      )
    }

    const token = await createJWT(
      { id: user._id!.toString(), username: user.username, role: 'shortuser' },
      c.env.JWT_SECRET
    )

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    await db.collection('shortlogins').updateOne(
      { userId: user._id, date: dateStr },
      { $setOnInsert: { userId: user._id, username: user.username, loginAt: today, date: dateStr } },
      { upsert: true }
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
        ratePerThousand: user.ratePerThousand,
        profile: user.profile || {},
        avatarId: (user as any).avatarId || null,
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER SELF-REGISTER (WITH FULL FORMAT VALIDATION & REFERRAL LOGIC) ============
shortUserRoutes.post('/register', async (c) => {
  try {
    const { username, password, realName, mobile, gmail, upiId, upiPhone, age, gender, referredBy } = await c.req.json()

    if (!username || !password || !realName) {
      return c.json({ error: 'Username, password and realName are required' }, 400)
    }
    if (password.length < 4) {
      return c.json({ error: 'Password must be at least 4 characters' }, 400)
    }

    // Mobile validation
    if (!mobile?.trim() || !/^[6-9]\d{9}$/.test(mobile.trim())) {
      return c.json({ error: 'Enter a valid 10-digit mobile number' }, 400)
    }

    // Gmail validation
    if (!gmail?.trim() || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(gmail.trim().toLowerCase())) {
      return c.json({ error: 'Enter a valid Gmail address (must end with @gmail.com)' }, 400)
    }

    // UPI validation
    if (!upiId?.trim() && !upiPhone?.trim()) {
      return c.json({ error: 'UPI ID or UPI Phone is required' }, 400)
    }
    if (upiId?.trim() && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
      return c.json({ error: 'Enter a valid UPI ID (e.g. name@upi)' }, 400)
    }
    if (upiPhone?.trim() && !/^[6-9]\d{9}$/.test(upiPhone.trim())) {
      return c.json({ error: 'Enter a valid 10-digit UPI phone number' }, 400)
    }

    // Age validation
    if (!age || parseInt(age) < 13 || parseInt(age) > 100) {
      return c.json({ error: 'Enter a valid age (13-100)' }, 400)
    }

    if (!gender) {
      return c.json({ error: 'Gender is required' }, 400)
    }

    const cleanUsername = username.toLowerCase().trim().replace(/\s/g, '')
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return c.json({ error: 'Username 3-20 characters, letters/numbers/_ only' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortusers').findOne({ username: cleanUsername })
    if (existing) {
      return c.json({ error: 'This username already exists' }, 400)
    }

    const normalizedGmail = gmail.toLowerCase().trim()

    // ── Get registration IP for fraud check ──
    const registrationIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'

    // ── Validate referral code (if provided) ──
    let referrer: any = null
    let referralStatus: 'pending' | 'flagged' = 'pending'

    if (referredBy?.trim()) {
      const refCode = referredBy.trim().toUpperCase()
      referrer = await db.collection('shortusers').findOne({ referralCode: refCode })

      if (!referrer || !referrer.isActive) {
        return c.json({ error: 'Invalid referral code' }, 400)
      }

      // ── Anti-fraud: same IP check ──
      if (registrationIp !== 'unknown') {
        const sameIpCount = await db.collection('shortusers').countDocuments({
          registrationIp,
          $or: [{ referredBy: refCode }, { _id: referrer._id }]
        })
        if (sameIpCount > 0) {
          referralStatus = 'flagged'
        }

        // ── Anti-fraud: too many referrals from this referrer recently ──
        const recentReferrals = await db.collection('shortreferrals').countDocuments({
          referrerId: referrer._id,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
        if (recentReferrals >= 5) {
          referralStatus = 'flagged'
        }
      }
    }

    const newUser = {
      username: cleanUsername,
      password,
      realName: realName.trim(),
      ratePerThousand: 50,
      isActive: true,
      canCreateLinks: true,
      totalClicks: 0,
      totalEarnings: 0,
      unpaidEarnings: 0,
      paidEarnings: 0,
      gmailLinked: normalizedGmail,
      createdBy: 'self',
      profile: {
        mobile: mobile.trim(),
        gmail: normalizedGmail,
        upiId: upiId?.trim() || '',
        upiPhone: upiPhone?.trim() || '',
        age: parseInt(age),
        gender,
      },
      avatarId: null,
      referralCode: null,
      referredBy: referrer ? referrer.referralCode : null,
      registrationIp,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await db.collection('shortusers').insertOne(newUser)
    const userId = result.insertedId.toString()

    // ── Create referral record if referred ──
    if (referrer) {
      await db.collection('shortreferrals').insertOne({
        referrerId: referrer._id,
        referrerUsername: referrer.username,
        referredId: result.insertedId,
        referredUsername: newUser.username,
        referrerReward: REFERRER_REWARD,
        referredReward: REFERRED_REWARD,
        commissionPercent: COMMISSION_PERCENT,
        status: referralStatus,
        referrerRewardCredited: false,
        referredRewardCredited: false,
        ip: registrationIp,
        createdAt: new Date(),
        unlockedAt: null
      })
    }

    const token = await createJWT(
      { id: userId, username: newUser.username, role: 'shortuser' },
      c.env.JWT_SECRET
    )

    return c.json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        username: newUser.username,
        realName: newUser.realName,
        totalClicks: newUser.totalClicks,
        totalEarnings: newUser.totalEarnings,
        unpaidEarnings: newUser.unpaidEarnings,
        ratePerThousand: newUser.ratePerThousand,
        profile: newUser.profile,
        avatarId: null,
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER DASHBOARD (with daily tracking) ============
shortUserRoutes.get('/dashboard', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const today = new Date().toISOString().split('T')[0]
    await db.collection('shortlogins').updateOne(
      { userId: new ObjectId(id), date: today },
      {
        $setOnInsert: {
          userId: new ObjectId(id),
          date: today,
          loginAt: new Date(),
          firstSeenAt: new Date()
        },
        $set: { lastSeenAt: new Date() },
        $inc: { openCount: 1 }
      },
      { upsert: true }
    )

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const links = await db.collection('shortlinks')
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayClicks = await db.collection('shortclicks').countDocuments({
      userId: new ObjectId(id),
      clickedAt: { $gte: todayStart }
    })

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

    const topCountries = await db.collection('shortclicks').aggregate([
      { $match: { userId: new ObjectId(id) } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray()

    const unreadMessages = await db.collection('shortmessages').countDocuments({
      userId: new ObjectId(id),
      fromAdmin: true,
      readByUser: false
    })

    const pendingPaymentRequest = await db.collection('shortrequests').findOne({
      userId: new ObjectId(id),
      type: 'payment',
      status: 'pending'
    })

    const pendingLinkRequest = await db.collection('shortrequests').findOne({
      userId: new ObjectId(id),
      type: 'link',
      status: 'pending'
    })

    const canCreateLinks = (user as any).canCreateLinks === true

    return c.json({
      user: {
        username: user.username,
        realName: user.realName,
        totalClicks: user.totalClicks || 0,
        todayClicks,
        totalEarnings: user.totalEarnings || 0,
        unpaidEarnings: user.unpaidEarnings || 0,
        paidEarnings: user.paidEarnings || 0,
        ratePerThousand: user.ratePerThousand || 0,
        gmailLinked: user.gmailLinked || '',
        profile: user.profile || {},
        canCreateLinks,
        avatarId: (user as any).avatarId || null,
      },
      links,
      last7Days,
      topCountries,
      unreadMessages,
      pendingPaymentRequest: !!pendingPaymentRequest,
      pendingLinkRequest: !!pendingLinkRequest
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER PROFILE UPDATE ============
shortUserRoutes.put('/profile', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const { mobile, gmail, upiId, upiPhone, age, gender, avatarId } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const profileData: any = {}
    if (mobile !== undefined) profileData['profile.mobile'] = mobile
    if (gmail !== undefined) profileData['profile.gmail'] = gmail
    if (upiId !== undefined) profileData['profile.upiId'] = upiId
    if (upiPhone !== undefined) profileData['profile.upiPhone'] = upiPhone
    if (age !== undefined) profileData['profile.age'] = age
    if (gender !== undefined) profileData['profile.gender'] = gender

    if (gmail) {
      profileData['gmailLinked'] = gmail.toLowerCase().trim()
    }

    if (avatarId !== undefined) {
      profileData['avatarId'] = avatarId
    }

    profileData['updatedAt'] = new Date()

    await db.collection('shortusers').updateOne(
      { _id: new ObjectId(id) },
      { $set: profileData }
    )
    return c.json({ success: true, message: 'Profile updated successfully!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER SELF-CREATE LINK (UPDATED) ============
shortUserRoutes.post('/create-link', userAuth, async (c) => {
  try {
    const { id, username } = c.get('shortUser')
    const { animeId, animeTitle, animeSlug, customCode, label } = await c.req.json()

    if (!animeId || !animeSlug) {
      return c.json({ error: 'Please select an anime.' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    if (!(user as any).canCreateLinks) {
      return c.json({ error: 'You do not have permission to create links. Please contact admin.' }, 403)
    }

    let finalCode: string

    if (customCode?.trim()) {
      finalCode = customCode.trim()
      if (!/^[a-zA-Z0-9-_]+$/.test(finalCode)) {
        return c.json({ error: 'Code can only contain letters, numbers, - and _' }, 400)
      }
      if (finalCode.length < 3 || finalCode.length > 30) {
        return c.json({ error: 'Code must be between 3 and 30 characters' }, 400)
      }
      const existingCode = await db.collection('shortlinks').findOne({ code: finalCode })
      if (existingCode) {
        return c.json({ error: `"${finalCode}" is already taken. Please try another code.` }, 400)
      }
    } else {
      const baseLabel = label?.trim() || animeTitle || 'link'
      const slug = baseLabel
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 50)

      finalCode = slug
      let counter = 1
      while (await db.collection('shortlinks').findOne({ code: finalCode })) {
        finalCode = `${slug}-${counter}`
        counter++
      }
    }

    const existingAnimeLink = await db.collection('shortlinks').findOne({
      userId: new ObjectId(id),
      animeId: animeId
    })
    if (existingAnimeLink) {
      return c.json({
        error: `You already have a link for "${animeTitle}": go.animebing.in/${existingAnimeLink.code}`
      }, 400)
    }

    const destinationUrl = `https://animebing.in/detail/${animeSlug}`

    const newLink = {
      code: finalCode,
      url: destinationUrl,
      label: label?.trim() || animeTitle || finalCode,
      userId: new ObjectId(id),
      username,
      animeId,
      animeTitle,
      animeSlug,
      createdByUser: true,
      createdByAdminId: (user as any).createdByAdminId || 'admin',          // 👈 add
      createdByAdminUsername: (user as any).createdByAdminUsername || '',  // 👈 add
      clicks: 0,
      createdAt: new Date(),
      lastClicked: null
    }

    await db.collection('shortlinks').insertOne(newLink)

    return c.json({
      success: true,
      message: 'Link created successfully!',
      link: {
        code: finalCode,
        shortUrl: `https://go.animebing.in/${finalCode}`,
        destinationUrl,
        label: newLink.label,
        animeTitle
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ PAYMENT REQUEST — USER ============
shortUserRoutes.post('/request/payment', userAuth, async (c) => {
  try {
    const { id, username } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    if ((user.totalClicks || 0) < 1000) {
      return c.json({
        error: `You have ${user.totalClicks || 0} clicks. 1000 clicks are required to request payment.`
      }, 400)
    }

    if ((user.unpaidEarnings || 0) <= 0) {
      return c.json({ error: 'No pending payment available.' }, 400)
    }

    const profile = (user as any).profile || {}
    if (!profile.upiId && !profile.upiPhone) {
      return c.json({ error: 'Please update your UPI ID or UPI Phone in your profile before requesting payment.' }, 400)
    }

    const existing = await db.collection('shortrequests').findOne({
      userId: new ObjectId(id),
      type: 'payment',
      status: 'pending'
    })
    if (existing) {
      return c.json({ error: 'A payment request is already pending.' }, 400)
    }

    await db.collection('shortrequests').insertOne({
      userId: new ObjectId(id),
      username,
      realName: user.realName,
      type: 'payment',
      status: 'pending',
      amount: user.unpaidEarnings,
      profile: (user as any).profile || {},
      createdAt: new Date()
    })

    return c.json({ success: true, message: 'Payment request sent! Admin will process it soon.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ LINK REQUEST — USER ============
shortUserRoutes.post('/request/link', userAuth, async (c) => {
  try {
    const { id, username } = c.get('shortUser')
    const { message } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const existing = await db.collection('shortrequests').findOne({
      userId: new ObjectId(id),
      type: 'link',
      status: 'pending'
    })
    if (existing) {
      return c.json({ error: 'A link request is already pending.' }, 400)
    }

    await db.collection('shortrequests').insertOne({
      userId: new ObjectId(id),
      username,
      realName: user.realName,
      type: 'link',
      status: 'pending',
      message: message || 'I need more links',
      createdAt: new Date()
    })

    return c.json({ success: true, message: 'Link request sent! Admin will process it soon.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ MESSAGES — USER VIEW ============
shortUserRoutes.get('/messages', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const messages = await db.collection('shortmessages')
      .find({ userId: new ObjectId(id) })
      .sort({ createdAt: 1 })
      .limit(50)
      .toArray()

    await db.collection('shortmessages').updateMany(
      { userId: new ObjectId(id), fromAdmin: true, readByUser: false },
      { $set: { readByUser: true } }
    )

    return c.json(messages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ MESSAGES — USER SEND ============
shortUserRoutes.post('/messages', userAuth, async (c) => {
  try {
    const { id, username } = c.get('shortUser')
    const { text } = await c.req.json()
    if (!text?.trim()) return c.json({ error: 'Message cannot be empty' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne({ _id: new ObjectId(id) }) as IShortUser | null

    await db.collection('shortmessages').insertOne({
      userId: new ObjectId(id),
      username,
      realName: user?.realName || username,
      text: text.trim(),
      fromAdmin: false,
      readByAdmin: false,
      readByUser: true,
      createdAt: new Date()
    })

    return c.json({ success: true, message: 'Message sent!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — ALL USERS ============
shortUserRoutes.get('/admin/users', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const filter: any = {}
    if (admin.role === 'subadmin') {
      filter.createdByAdminId = admin.id
    }

    const users = await db.collection('shortusers')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(users)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — CREATE USER ============
shortUserRoutes.post('/admin/users', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const { username, password, realName, ratePerThousand, canCreateLinks } = await c.req.json()
    if (!username || !password || !realName) {
      return c.json({ error: 'username, password and realName are required' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortusers').findOne({ username })
    if (existing) return c.json({ error: 'This username already exists' }, 400)

    const admin = c.get('admin')

    const newUser = {
      username, password, realName,
      ratePerThousand: ratePerThousand || 100,
      isActive: true,
      canCreateLinks: canCreateLinks || false,
      totalClicks: 0,
      totalEarnings: 0,
      unpaidEarnings: 0,
      paidEarnings: 0,
      gmailLinked: '',
      profile: {},
      createdByAdminId: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByAdminUsername: admin.username,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    await db.collection('shortusers').insertOne(newUser)
    return c.json({ success: true, message: 'User created!', user: newUser })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE USER ============
shortUserRoutes.put('/admin/users/:id', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const id = c.req.param('id')
    const { password, realName, ratePerThousand, isActive, canCreateLinks } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const admin = c.get('admin')
    const existingUser = await db.collection('shortusers').findOne({ _id: new ObjectId(id) })
    if (!existingUser) return c.json({ error: 'User not found' }, 404)
    if (!canManageShortUser(existingUser, admin)) {
      return c.json({ error: 'You can only manage users you created.' }, 403)
    }

    const updateData: any = { updatedAt: new Date() }
    if (password) updateData.password = password
    if (realName) updateData.realName = realName
    if (ratePerThousand !== undefined) updateData.ratePerThousand = ratePerThousand
    if (isActive !== undefined) updateData.isActive = isActive
    if (canCreateLinks !== undefined) updateData.canCreateLinks = canCreateLinks

    await db.collection('shortusers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    return c.json({ success: true, message: 'User updated!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — DELETE USER ============
shortUserRoutes.delete('/admin/users/:id', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const admin = c.get('admin')
    if (!canManageShortUser(user, admin)) {
      return c.json({ error: 'You can only manage users you created.' }, 403)
    }

    await db.collection('shortusers').deleteOne({ _id: new ObjectId(id) })
    await db.collection('shortlinks').updateMany(
      { userId: new ObjectId(id) },
      { $set: { userId: null } }
    )
    await db.collection('shortmessages').deleteMany({ userId: new ObjectId(id) })
    await db.collection('shortrequests').deleteMany({ userId: new ObjectId(id) })

    return c.json({ success: true, message: `User "${user.realName}" deleted successfully.` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MARK PAYMENT DONE ============
shortUserRoutes.post('/admin/users/:id/pay', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const id = c.req.param('id')
    const { amount, note } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const admin = c.get('admin')
    if (!canManageShortUser(user, admin)) {
      return c.json({ error: 'You can only manage users you created.' }, 403)
    }

    await db.collection('shortusers').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { paidEarnings: amount, unpaidEarnings: -amount },
        $set: { updatedAt: new Date() }
      }
    )

    await db.collection('payments').insertOne({
      userId: new ObjectId(id),
      username: user.username,
      realName: user.realName,
      amount,
      note: note || '',
      paidAt: new Date()
    })

    await db.collection('shortrequests').updateMany(
      { userId: new ObjectId(id), type: 'payment', status: 'pending' },
      { $set: { status: 'done', updatedAt: new Date() } }
    )

    await db.collection('shortmessages').insertOne({
      userId: new ObjectId(id),
      username: user.username,
      realName: user.realName,
      text: `✅ Your ₹${amount} payment has been processed! ${note ? `Note: ${note}` : ''}`,
      fromAdmin: true,
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date()
    })

    return c.json({ success: true, message: `₹${amount} payment marked!` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — ALL REQUESTS ============
shortUserRoutes.get('/admin/requests', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    let filter: any = {}
    if (admin.role === 'subadmin') {
      const ownUsers = await db.collection('shortusers')
        .find({ createdByAdminId: admin.id }, { projection: { _id: 1 } })
        .toArray()
      filter.userId = { $in: ownUsers.map((u: any) => u._id) }
    }

    const requests = await db.collection('shortrequests')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(requests)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE REQUEST STATUS ============
shortUserRoutes.put('/admin/requests/:id', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const id = c.req.param('id')
    const { status } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const admin = c.get('admin')
    const request = await db.collection('shortrequests').findOne({ _id: new ObjectId(id) })
    if (!request) return c.json({ error: 'Request not found' }, 404)
    if (admin.role === 'subadmin') {
      const owner = await db.collection('shortusers').findOne({ _id: request.userId })
      if (!canManageShortUser(owner, admin)) {
        return c.json({ error: 'You can only manage requests from users you created.' }, 403)
      }
    }

    await db.collection('shortrequests').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    )
    return c.json({ success: true, message: 'Request updated!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UNREAD COUNT PER USER (for row red-dots) ============
shortUserRoutes.get('/admin/messages/unread-per-user', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const matchFilter: any = { fromAdmin: false, readByAdmin: false }

    if (admin.role === 'subadmin') {
      const ownUsers = await db.collection('shortusers')
        .find({ createdByAdminId: admin.id }, { projection: { _id: 1 } })
        .toArray()
      matchFilter.userId = { $in: ownUsers.map((u: any) => u._id) }
    }

    const counts = await db.collection('shortmessages').aggregate([
      { $match: matchFilter },
      { $group: { _id: '$userId', unreadCount: { $sum: 1 } } }
    ]).toArray()

    const result = counts
      .filter((c: any) => c._id)
      .map((c: any) => ({ userId: c._id.toString(), unreadCount: c.unreadCount }))
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MESSAGES FOR A USER ============
shortUserRoutes.get('/admin/messages/:userId', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const userId = c.req.param('userId')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const admin = c.get('admin')
    const owner = await db.collection('shortusers').findOne({ _id: new ObjectId(userId) })
    if (!owner) return c.json({ error: 'User not found' }, 404)
    if (!canManageShortUser(owner, admin)) {
      return c.json({ error: 'You can only view messages for users you created.' }, 403)
    }

    const messages = await db.collection('shortmessages')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: 1 })
      .toArray()

    await db.collection('shortmessages').updateMany(
      { userId: new ObjectId(userId), fromAdmin: false, readByAdmin: false },
      { $set: { readByAdmin: true } }
    )

    return c.json(messages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — SEND MESSAGE TO USER ============
shortUserRoutes.post('/admin/messages/:userId', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const userId = c.req.param('userId')
    const { text } = await c.req.json()
    if (!text?.trim()) return c.json({ error: 'Message cannot be empty' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(userId) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const admin = c.get('admin')
    if (!canManageShortUser(user, admin)) {
      return c.json({ error: 'You can only message users you created.' }, 403)
    }

    // ✅ Track WHO sent this — main admin ya kaunsa specific sub-admin
    const senderRole = admin.role === 'subadmin' ? 'subadmin' : 'admin'
    const senderName = admin.role === 'subadmin'
      ? (admin.fullName || admin.username)  // sub-admin ka naam
      : 'Main Admin'

    await db.collection('shortmessages').insertOne({
      userId: new ObjectId(userId),
      username: user.username,
      realName: user.realName,
      text: text.trim(),
      fromAdmin: true,
      senderRole,        // 👈 NEW
      senderName,        // 👈 NEW
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date()
    })

    return c.json({ success: true, message: 'Message sent!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — CREATE LINK FOR USER ============
shortUserRoutes.post('/admin/users/:id/create-link', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const userId = c.req.param('id')
    const { code, url, label } = await c.req.json()

    if (!code || !url) {
      return c.json({ error: 'code and url are required' }, 400)
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return c.json({ error: 'Code can only contain letters, numbers, - and _' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(userId) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    const admin = c.get('admin')
    if (!canManageShortUser(user, admin)) {
      return c.json({ error: 'You can only create links for users you created.' }, 403)
    }

    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) return c.json({ error: `"${code}" already exists` }, 400)

    const newLink = {
      code,
      url,
      label: label || code,
      userId: new ObjectId(userId),
      clicks: 0,
      createdByAdminId: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByAdminUsername: admin.username,
      createdAt: new Date(),
      lastClicked: null
    }

    await db.collection('shortlinks').insertOne(newLink)

    await db.collection('shortrequests').updateMany(
      { userId: new ObjectId(userId), type: 'link', status: 'pending' },
      { $set: { status: 'done', updatedAt: new Date() } }
    )

    await db.collection('shortmessages').insertOne({
      userId: new ObjectId(userId),
      username: user.username,
      realName: user.realName,
      text: `🔗 New link assigned: go.animebing.in/${code} — Label: ${label || code}`,
      fromAdmin: true,
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date()
    })

    return c.json({ success: true, message: `Link created and assigned to ${user.realName}!`, link: newLink })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UNREAD MESSAGE COUNT ============
shortUserRoutes.get('/admin/messages-count', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    let filter: any = { fromAdmin: false, readByAdmin: false }
    if (admin.role === 'subadmin') {
      const ownUsers = await db.collection('shortusers')
        .find({ createdByAdminId: admin.id }, { projection: { _id: 1 } })
        .toArray()
      filter.userId = { $in: ownUsers.map((u: any) => u._id) }
    }

    const unread = await db.collection('shortmessages').countDocuments(filter)
    return c.json({ unread })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — OVERALL STATS ============
shortUserRoutes.get('/admin/stats', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const userFilter: any = admin.role === 'subadmin' ? { createdByAdminId: admin.id } : {}

    const totalUsers = await db.collection('shortusers').countDocuments(userFilter)
    const activeUsers = await db.collection('shortusers').countDocuments({ ...userFilter, isActive: true })

    const ownUserIds = admin.role === 'subadmin'
      ? (await db.collection('shortusers').find(userFilter, { projection: { _id: 1 } }).toArray()).map((u: any) => u._id)
      : null
    const clickFilter: any = ownUserIds ? { userId: { $in: ownUserIds } } : {}

    const totalClicks = await db.collection('shortclicks').countDocuments(clickFilter)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayClicks = await db.collection('shortclicks').countDocuments({
      ...clickFilter,
      clickedAt: { $gte: todayStart }
    })

    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const count = await db.collection('shortclicks').countDocuments({
        ...clickFilter,
        clickedAt: { $gte: dayStart, $lte: dayEnd }
      })
      last7Days.push({
        date: dayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        clicks: count
      })
    }

    const topCountries = await db.collection('shortclicks').aggregate([
      ...(ownUserIds ? [{ $match: { userId: { $in: ownUserIds } } }] : []),
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    const unpaidResult = await db.collection('shortusers').aggregate([
      ...(admin.role === 'subadmin' ? [{ $match: userFilter }] : []),
      { $group: { _id: null, total: { $sum: '$unpaidEarnings' } } }
    ]).toArray()
    const totalUnpaid = unpaidResult[0]?.total || 0

    const requestFilter: any = ownUserIds ? { userId: { $in: ownUserIds } } : {}
    const pendingRequests = await db.collection('shortrequests').countDocuments({ ...requestFilter, status: 'pending' })
    const unreadMessages = await db.collection('shortmessages').countDocuments({
      ...requestFilter, fromAdmin: false, readByAdmin: false
    })

    const users = await db.collection('shortusers')
      .find(userFilter)
      .sort({ totalClicks: -1 })
      .toArray()

    return c.json({
      totalUsers,
      activeUsers,
      totalClicks,
      todayClicks,
      totalUnpaid,
      pendingRequests,
      unreadMessages,
      last7Days,
      topCountries,
      users
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — DELETE LINK BY ID ============
shortUserRoutes.delete('/admin/links/by-id/:id', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const admin = c.get('admin')
    const link = await db.collection('shortlinks').findOne({ _id: new ObjectId(id) })
    if (!link) return c.json({ error: 'Link not found' }, 404)
    if (admin.role === 'subadmin' && (link as any).createdByAdminId !== admin.id) {
      return c.json({ error: 'You can only manage links you created.' }, 403)
    }

    const result = await db.collection('shortlinks').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return c.json({ error: 'Link not found' }, 404)
    }
    return c.json({ success: true, message: 'Link deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — USER LOGIN ACTIVITY ============
shortUserRoutes.get('/admin/users/:id/activity', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const userId = c.req.param('id')
    const days = parseInt(c.req.query('days') || '30')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const admin = c.get('admin')
    const owner = await db.collection('shortusers').findOne({ _id: new ObjectId(userId) })
    if (!owner) return c.json({ error: 'User not found' }, 404)
    if (!canManageShortUser(owner, admin)) {
      return c.json({ error: 'You can only view activity for users you created.' }, 403)
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (days - 1))
    startDate.setHours(0, 0, 0, 0)

    const loginLogs = await db.collection('shortlogins')
      .find({ userId: new ObjectId(userId), loginAt: { $gte: startDate } })
      .sort({ loginAt: 1 })
      .toArray()

    const loginDates = new Set(loginLogs.map((l: any) => l.date))

    const calendar = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      calendar.push({
        date: dateStr,
        loggedIn: loginDates.has(dateStr),
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      })
    }

    const links = await db.collection('shortlinks')
      .find({ userId: new ObjectId(userId) })
      .sort({ clicks: -1 })
      .toArray()

    const linkStats = await Promise.all(links.map(async (link: any) => {
      const clicksInRange = await db.collection('shortclicks').countDocuments({
        code: link.code,
        clickedAt: { $gte: startDate }
      })
      return {
        _id: link._id,
        code: link.code,
        label: link.label,
        url: link.url,
        totalClicks: link.clicks || 0,
        clicksInRange,
        lastClicked: link.lastClicked,
        createdAt: link.createdAt
      }
    }))

    const activeDays = loginDates.size
    const absentDays = days - activeDays

    return c.json({
      calendar,
      activeDays,
      absentDays,
      totalDays: days,
      loginRate: days > 0 ? Math.round((activeDays / days) * 100) : 0,
      linkStats,
      lastLogin: loginLogs.length > 0 ? loginLogs[loginLogs.length - 1].loginAt : null
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER — SCOPED ANIME LIST (for Create Link tab) ============
shortUserRoutes.get('/anime-list', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as any
    if (!user) return c.json({ error: 'User not found' }, 404)

    const creatorAdminId = user.createdByAdminId
    const isScopedToSubAdmin = !!creatorAdminId && creatorAdminId !== 'admin'

    const filter: any = {}
    if (isScopedToSubAdmin) {
      filter.createdBy = creatorAdminId
    }

    const animes = await db.collection('animes')
      .find(filter, { projection: { title: 1, slug: 1 } })
      .sort({ title: 1 })
      .toArray()

    return c.json({
      success: true,
      data: animes.map((a: any) => ({ _id: a._id.toString(), title: a.title, slug: a.slug }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ MONTHLY CLICKS PER SHORT USER (for month-wise view) ============
shortUserRoutes.get('/admin/users/monthly-clicks', adminAuth, requirePermission('shortener'), async (c) => {
  try {
    const month = parseInt(c.req.query('month') || '')
    const year = parseInt(c.req.query('year') || '')
    if (!month || !year || month < 1 || month > 12) {
      return c.json({ error: 'Valid month (1-12) and year are required' }, 400)
    }
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1) // exclusive

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const admin = c.get('admin')

    // Scope to sub-admin's own users, same pattern as /admin/users
    const userFilter: any = {}
    if (admin.role === 'subadmin') userFilter.createdByAdminId = admin.id

    const allowedUsers = await db.collection('shortusers')
      .find(userFilter, { projection: { _id: 1, ratePerThousand: 1 } })
      .toArray()
    const allowedIds = allowedUsers.map((u: any) => u._id)
    const rateMap: Record<string, number> = {}
    allowedUsers.forEach((u: any) => { rateMap[u._id.toString()] = u.ratePerThousand || 0 })

    const results = await db.collection('shortclicks').aggregate([
      { $match: { userId: { $in: allowedIds }, clickedAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$userId', clicks: { $sum: 1 } } }
    ]).toArray()

    const data: Record<string, { clicks: number; earnings: number }> = {}
    results.forEach((r: any) => {
      const id = r._id.toString()
      const rate = rateMap[id] || 0
      data[id] = { clicks: r.clicks, earnings: (r.clicks * rate) / 1000 }
    })

    return c.json({ success: true, month, year, data })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ USER SELF ANALYTICS ============
shortUserRoutes.get('/my-analytics', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const data = await getUserSelfAnalytics(id, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortUserRoutes