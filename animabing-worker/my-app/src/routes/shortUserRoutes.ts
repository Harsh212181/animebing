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

// ============ USER DASHBOARD ============
shortUserRoutes.get('/dashboard', userAuth, async (c) => {
  try {
    const { id } = c.get('shortUser')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// ============ USER SELF-CREATE LINK ============
shortUserRoutes.post('/create-link', userAuth, async (c) => {
  try {
    const { id, username } = c.get('shortUser')
    const { animeId, animeTitle, animeSlug, customCode, label } = await c.req.json()

    if (!animeId || !animeSlug) {
      return c.json({ error: 'Anime select karna zaroori hai.' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    if (!(user as any).canCreateLinks) {
      return c.json({ error: 'Aapko link create karne ki permission nahi hai. Admin se contact karo.' }, 403)
    }

    let finalCode: string

    if (customCode?.trim()) {
      finalCode = customCode.trim()
      if (!/^[a-zA-Z0-9-_]+$/.test(finalCode)) {
        return c.json({ error: 'Code mein sirf letters, numbers, - aur _ use kar sakte hain.' }, 400)
      }
      if (finalCode.length < 3 || finalCode.length > 30) {
        return c.json({ error: 'Code 3 se 30 characters ka hona chahiye.' }, 400)
      }
      const existingCode = await db.collection('shortlinks').findOne({ code: finalCode })
      if (existingCode) {
        return c.json({ error: `"${finalCode}" code already use ho chuka hai. Koi aur code try karo.` }, 400)
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
        error: `Aapne "${animeTitle}" ke liye pehle se ek link bana rakha hai: go.animebing.in/${existingAnimeLink.code}`
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
      clicks: 0,
      createdAt: new Date(),
      lastClicked: null
    }

    await db.collection('shortlinks').insertOne(newLink)

    return c.json({
      success: true,
      message: `Link successfully create ho gaya!`,
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
shortUserRoutes.get('/admin/users', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const users = await db.collection('shortusers')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(users)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — CREATE USER ============
shortUserRoutes.post('/admin/users', adminAuth, async (c) => {
  try {
    const { username, password, realName, ratePerThousand, canCreateLinks } = await c.req.json()
    if (!username || !password || !realName) {
      return c.json({ error: 'username, password and realName are required' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortusers').findOne({ username })
    if (existing) return c.json({ error: 'This username already exists' }, 400)

    const newUser = {
      username, password, realName,
      ratePerThousand: ratePerThousand || 10,
      isActive: true,
      canCreateLinks: canCreateLinks || false,
      totalClicks: 0,
      totalEarnings: 0,
      unpaidEarnings: 0,
      paidEarnings: 0,
      gmailLinked: '',
      profile: {},
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
shortUserRoutes.put('/admin/users/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { password, realName, ratePerThousand, isActive, canCreateLinks } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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
shortUserRoutes.delete('/admin/users/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    // Delete the user
    await db.collection('shortusers').deleteOne({ _id: new ObjectId(id) })

    // Optionally: unassign their links (set userId to null instead of deleting)
    await db.collection('shortlinks').updateMany(
      { userId: new ObjectId(id) },
      { $set: { userId: null } }
    )

    // Optionally: delete their messages and requests
    await db.collection('shortmessages').deleteMany({ userId: new ObjectId(id) })
    await db.collection('shortrequests').deleteMany({ userId: new ObjectId(id) })

    return c.json({ success: true, message: `User "${user.realName}" deleted successfully.` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MARK PAYMENT DONE ============
shortUserRoutes.post('/admin/users/:id/pay', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { amount, note } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(id) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

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
shortUserRoutes.get('/admin/requests', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const requests = await db.collection('shortrequests')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(requests)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE REQUEST STATUS ============
shortUserRoutes.put('/admin/requests/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { status } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    await db.collection('shortrequests').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    )
    return c.json({ success: true, message: 'Request updated!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — MESSAGES FOR A USER ============
shortUserRoutes.get('/admin/messages/:userId', adminAuth, async (c) => {
  try {
    const userId = c.req.param('userId')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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
shortUserRoutes.post('/admin/messages/:userId', adminAuth, async (c) => {
  try {
    const userId = c.req.param('userId')
    const { text } = await c.req.json()
    if (!text?.trim()) return c.json({ error: 'Message cannot be empty' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne(
      { _id: new ObjectId(userId) }
    ) as IShortUser | null
    if (!user) return c.json({ error: 'User not found' }, 404)

    await db.collection('shortmessages').insertOne({
      userId: new ObjectId(userId),
      username: user.username,
      realName: user.realName,
      text: text.trim(),
      fromAdmin: true,
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
shortUserRoutes.post('/admin/users/:id/create-link', adminAuth, async (c) => {
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

    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) return c.json({ error: `"${code}" already exists` }, 400)

    const newLink = {
      code,
      url,
      label: label || code,
      userId: new ObjectId(userId),
      clicks: 0,
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
shortUserRoutes.get('/admin/messages-count', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const unread = await db.collection('shortmessages').countDocuments({
      fromAdmin: false,
      readByAdmin: false
    })
    return c.json({ unread })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — OVERALL STATS ============
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

    const topCountries = await db.collection('shortclicks').aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    const unpaidResult = await db.collection('shortusers').aggregate([
      { $group: { _id: null, total: { $sum: '$unpaidEarnings' } } }
    ]).toArray()
    const totalUnpaid = unpaidResult[0]?.total || 0

    const pendingRequests = await db.collection('shortrequests').countDocuments({ status: 'pending' })
    const unreadMessages = await db.collection('shortmessages').countDocuments({
      fromAdmin: false, readByAdmin: false
    })

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

// ============ ADMIN — DELETE LINK BY ID (for broken links without a code) ============
shortUserRoutes.delete('/admin/links/by-id/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const result = await db.collection('shortlinks').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return c.json({ error: 'Link not found' }, 404)
    }
    return c.json({ success: true, message: 'Link deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortUserRoutes