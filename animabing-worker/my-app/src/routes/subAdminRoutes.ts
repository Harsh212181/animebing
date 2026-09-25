import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { ISubAdmin } from '../models/types'
import { hashPassword, verifyPassword } from '../services/passwordService'
import { logActivity, getActivityLogs } from '../services/activityLogService'

const subAdminRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ⚠️ NOTE: `logActivity()` (activityLogService.ts) abhi bhi apna alag
// connection kholta hai — humare paas us file ka code nahi hai isliye use
// consolidate nahi kar sakte. Baaki har route ke DB operations ab ek hi
// `db` se ho rahe hain.

// ============ JWT CREATE (shared logic) ============
async function createJWT(payload: object, secret: string, expiryHours = 24): Promise<string> {
  const encoder = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (expiryHours * 60 * 60)
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

// ============ SUB-ADMIN LOGIN (public route) — 2 connections combined into 1 ============
subAdminRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password required' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ username }) as ISubAdmin | null
    if (!subAdmin) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401)
    }

    if (subAdmin.isBlocked) {
      return c.json({ success: false, error: 'Your account has been blocked. Contact admin.' }, 403)
    }

    const valid = await verifyPassword(password, subAdmin.password, subAdmin.salt)
    if (!valid) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401)
    }

    const token = await createJWT({
      id: subAdmin._id!.toString(),
      username: subAdmin.username,
      role: 'subadmin',
      permissions: subAdmin.permissions || [],
      animeAccess: subAdmin.animeAccess || 'own'
    }, c.env.JWT_SECRET, 12)

    await db.collection('subadmins').updateOne({ _id: subAdmin._id }, { $set: { lastLogin: new Date() } })
    await logActivity({
      actorId: subAdmin._id!.toString(), actorUsername: subAdmin.username, actorRole: 'subadmin',
      action: 'login'
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({
      success: true, token,
      subAdmin: {
        id: subAdmin._id, username: subAdmin.username, fullName: subAdmin.fullName,
        permissions: subAdmin.permissions, animeAccess: subAdmin.animeAccess
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: 'Login failed' }, 500)
  }
})

// ============ ME (current logged-in admin/subadmin info) ============
subAdminRoutes.get('/me', adminAuth, async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(admin.id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Not found' }, 404)
    return c.json({
      success: true,
      data: {
        id: subAdmin._id, username: subAdmin.username, fullName: subAdmin.fullName,
        role: 'subadmin', permissions: subAdmin.permissions, animeAccess: subAdmin.animeAccess
      }
    })
  }
  return c.json({ success: true, data: { username: admin.username, role: 'admin', permissions: ['all'], animeAccess: 'all' } })
})

// ============ CREATE SUB-ADMIN (super admin only) — 2 connections combined into 1 ============
subAdminRoutes.post('/', adminAuth, superAdminOnly, async (c) => {
  try {
    const {
      username, password, fullName, permissions, animeAccess,
      phone, upi, gmail, youtubeChannel,
      ratePerThousandViews
    } = await c.req.json()

    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password are required' }, 400)
    }
    if (password.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)
    }
    if (ratePerThousandViews !== undefined && ratePerThousandViews !== null &&
        (typeof ratePerThousandViews !== 'number' || ratePerThousandViews < 0)) {
      return c.json({ success: false, error: 'ratePerThousandViews must be a non-negative number or null' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('subadmins').findOne({ username })
    if (existing) {
      return c.json({ success: false, error: 'Username already exists' }, 409)
    }

    const { hash, salt } = await hashPassword(password)
    const admin = c.get('admin')

    const newSubAdmin = {
      username,
      password: hash,
      salt,
      fullName: fullName || username,
      permissions: Array.isArray(permissions) ? permissions : [],
      animeAccess: animeAccess === 'all' ? 'all' : 'own',
      isBlocked: false,
      createdBy: admin.username,
      ...(phone !== undefined && { phone }),
      ...(upi !== undefined && { upi }),
      ...(gmail !== undefined && { gmail }),
      ...(youtubeChannel !== undefined && { youtubeChannel }),
      ...(ratePerThousandViews !== undefined && { ratePerThousandViews }),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection('subadmins').insertOne(newSubAdmin)

    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'admin',
      action: 'create-subadmin', targetType: 'subadmin', targetId: result.insertedId.toString(), targetTitle: username
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Sub-admin created successfully!', id: result.insertedId })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ LIST SUB-ADMINS (super admin only) ============
subAdminRoutes.get('/', adminAuth, superAdminOnly, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmins = await db.collection('subadmins')
      .find({}, { projection: { password: 0, salt: 0 } })
      .sort({ createdAt: -1 })
      .toArray()
    return c.json({ success: true, data: subAdmins })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UPDATE SUB-ADMIN — updateOne now on shared db ============
subAdminRoutes.put('/:id', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const {
      fullName, permissions, animeAccess, password,
      phone, upi, gmail, youtubeChannel,
      ratePerThousandViews
    } = await c.req.json()

    const updateData: any = { updatedAt: new Date() }
    if (fullName !== undefined) updateData.fullName = fullName
    if (Array.isArray(permissions)) updateData.permissions = permissions
    if (animeAccess === 'all' || animeAccess === 'own') updateData.animeAccess = animeAccess

    if (phone !== undefined) updateData.phone = phone
    if (upi !== undefined) updateData.upi = upi
    if (gmail !== undefined) updateData.gmail = gmail
    if (youtubeChannel !== undefined) updateData.youtubeChannel = youtubeChannel

    if (ratePerThousandViews !== undefined) {
      if (ratePerThousandViews !== null && (typeof ratePerThousandViews !== 'number' || ratePerThousandViews < 0)) {
        return c.json({ success: false, error: 'ratePerThousandViews must be a non-negative number or null' }, 400)
      }
      updateData.ratePerThousandViews = ratePerThousandViews
    }

    if (password && password.trim()) {
      if (password.length < 6) return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)
      const { hash, salt } = await hashPassword(password)
      updateData.password = hash
      updateData.salt = salt
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const updated = await db.collection('subadmins').findOneAndUpdate(
      { _id: toObjectId(id) }, { $set: updateData }, { returnDocument: 'after' }
    )
    if (!updated) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const admin = c.get('admin')
    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'admin',
      action: 'update-subadmin', targetType: 'subadmin', targetId: id
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Sub-admin updated successfully!' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ BLOCK / UNBLOCK SUB-ADMIN — 2 connections combined into 1 ============
subAdminRoutes.patch('/:id/block', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const newBlocked = !subAdmin.isBlocked
    await db.collection('subadmins').updateOne({ _id: toObjectId(id) }, { $set: { isBlocked: newBlocked, updatedAt: new Date() } })

    const admin = c.get('admin')
    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'admin',
      action: newBlocked ? 'block-subadmin' : 'unblock-subadmin',
      targetType: 'subadmin', targetId: id, targetTitle: subAdmin.username
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: `Sub-admin ${newBlocked ? 'blocked' : 'unblocked'} successfully`, isBlocked: newBlocked })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE SUB-ADMIN — 2 connections combined into 1 ============
subAdminRoutes.delete('/:id', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    await db.collection('subadmins').deleteOne({ _id: toObjectId(id) })

    const admin = c.get('admin')
    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'admin',
      action: 'delete-subadmin', targetType: 'subadmin', targetId: id, targetTitle: subAdmin.username
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Sub-admin deleted successfully!' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ASSIGN ANIME TO SUB-ADMIN (single/bulk) — 2 connections combined into 1 ============
subAdminRoutes.post('/:id/assign-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid sub-admin ID' }, 400)

    const { animeIds } = await c.req.json()
    if (!Array.isArray(animeIds) || animeIds.length === 0) {
      return c.json({ success: false, error: 'animeIds array required' }, 400)
    }
    const validIds = animeIds.filter((aid: string) => isValidObjectId(aid))
    if (validIds.length === 0) return c.json({ success: false, error: 'No valid anime IDs' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const current = new Set(subAdmin.assignedAnimeIds || [])
    validIds.forEach((aid: string) => current.add(aid))

    await db.collection('subadmins').updateOne(
      { _id: toObjectId(id) },
      { $set: { assignedAnimeIds: Array.from(current), updatedAt: new Date() } }
    )

    const admin = c.get('admin')
    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'admin',
      action: 'assign-anime-to-subadmin', targetType: 'subadmin', targetId: id,
      targetTitle: `${validIds.length} anime assigned`
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: `${validIds.length} anime assign ho gaye`, assignedAnimeIds: Array.from(current) })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UNASSIGN ANIME FROM SUB-ADMIN (single/bulk) — 2 connections combined into 1 ============
subAdminRoutes.post('/:id/unassign-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid sub-admin ID' }, 400)

    const { animeIds } = await c.req.json()
    if (!Array.isArray(animeIds) || animeIds.length === 0) {
      return c.json({ success: false, error: 'animeIds array required' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const removeSet = new Set(animeIds)
    const updated = (subAdmin.assignedAnimeIds || []).filter((aid: string) => !removeSet.has(aid))

    await db.collection('subadmins').updateOne(
      { _id: toObjectId(id) },
      { $set: { assignedAnimeIds: updated, updatedAt: new Date() } }
    )

    return c.json({ success: true, message: 'Anime unassign ho gaye', assignedAnimeIds: updated })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET ASSIGNED ANIME LIST (with full details) — 2 connections combined into 1 ============
subAdminRoutes.get('/:id/assigned-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const ids = (subAdmin.assignedAnimeIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))
    const animes = ids.length
      ? await db.collection('animes')
          .find({ _id: { $in: ids } }, {
            projection: { title: 1, thumbnail: 1, contentType: 1, status: 1, createdBy: 1, createdByUsername: 1 }
          })
          .toArray()
      : []

    return c.json({ success: true, data: animes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET FULL ANIME LIST FOR A SUB-ADMIN — 2 connections combined into 1 ============
subAdminRoutes.get('/:id/anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmin = await db.collection('subadmins').findOne({ _id: toObjectId(id) }) as ISubAdmin | null
    const assignedIds = (subAdmin?.assignedAnimeIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))

    const animes = await db.collection('animes')
      .find(
        { $or: [{ createdBy: id }, { _id: { $in: assignedIds } }] },
        {
          projection: {
            title: 1, thumbnail: 1, contentType: 1, subDubStatus: 1, status: 1,
            releaseYear: 1, views: 1, likes: 1, slug: 1, isHidden: 1, isBlocked: 1, createdAt: 1,
            createdBy: 1
          }
        }
      )
      .sort({ createdAt: -1 })
      .toArray()

    return c.json({ success: true, data: animes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET SHORTENER USERS FOR A SUB-ADMIN ============
subAdminRoutes.get('/:id/shortusers', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const users = await db.collection('shortusers')
      .find({ createdByAdminId: id }, { projection: { password: 0, salt: 0 } })
      .sort({ totalClicks: -1 })
      .toArray()
    return c.json({ success: true, data: users })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default subAdminRoutes