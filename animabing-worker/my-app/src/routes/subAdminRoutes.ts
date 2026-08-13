 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne, deleteOne,
  toObjectId, isValidObjectId
} from '../services/mongoService'
import { ISubAdmin } from '../models/types'
import { hashPassword, verifyPassword } from '../services/passwordService'
import { logActivity, getActivityLogs } from '../services/activityLogService'

const subAdminRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

// ============ SUB-ADMIN LOGIN (public route) ============
subAdminRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password required' }, 400)
    }

    const subAdmin = await findOne<ISubAdmin>('subadmins', { username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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
    }, c.env.JWT_SECRET, 12) // sub-admin token 12hrs valid rakhte hain

    await updateOne('subadmins', { _id: subAdmin._id }, { lastLogin: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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
    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(admin.id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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

// ============ CREATE SUB-ADMIN (super admin only) ============
subAdminRoutes.post('/', adminAuth, superAdminOnly, async (c) => {
  try {
    const { username, password, fullName, permissions, animeAccess } = await c.req.json()

    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password are required' }, 400)
    }
    if (password.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)
    }

    const existing = await findOne('subadmins', { username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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
      createdBy: admin.username
    }

    const result = await insertOne('subadmins', newSubAdmin, c.env.MONGODB_URI, c.env.MONGODB_DB)

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
    const subAdmins = await findMany<ISubAdmin>(
      'subadmins', {}, { sort: { createdAt: -1 }, projection: { password: 0, salt: 0 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true, data: subAdmins })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UPDATE SUB-ADMIN (permissions, animeAccess, fullName) ============
subAdminRoutes.put('/:id', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const { fullName, permissions, animeAccess, password } = await c.req.json()
    const updateData: any = {}
    if (fullName !== undefined) updateData.fullName = fullName
    if (Array.isArray(permissions)) updateData.permissions = permissions
    if (animeAccess === 'all' || animeAccess === 'own') updateData.animeAccess = animeAccess

    // Optional password reset by super admin
    if (password && password.trim()) {
      if (password.length < 6) return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)
      const { hash, salt } = await hashPassword(password)
      updateData.password = hash
      updateData.salt = salt
    }

    const updated = await updateOne('subadmins', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
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

// ============ BLOCK / UNBLOCK SUB-ADMIN ============
subAdminRoutes.patch('/:id/block', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const newBlocked = !subAdmin.isBlocked
    await updateOne('subadmins', { _id: toObjectId(id) }, { isBlocked: newBlocked }, c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// ============ DELETE SUB-ADMIN ============
subAdminRoutes.delete('/:id', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    await deleteOne('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// ============ ASSIGN ANIME TO SUB-ADMIN (single/bulk) ============
subAdminRoutes.post('/:id/assign-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid sub-admin ID' }, 400)

    const { animeIds } = await c.req.json() // string[] — ek ya multiple dono chalega
    if (!Array.isArray(animeIds) || animeIds.length === 0) {
      return c.json({ success: false, error: 'animeIds array required' }, 400)
    }
    const validIds = animeIds.filter((aid: string) => isValidObjectId(aid))
    if (validIds.length === 0) return c.json({ success: false, error: 'No valid anime IDs' }, 400)

    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const current = new Set(subAdmin.assignedAnimeIds || [])
    validIds.forEach((aid: string) => current.add(aid))

    await updateOne('subadmins', { _id: toObjectId(id) }, { assignedAnimeIds: Array.from(current) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// ============ UNASSIGN ANIME FROM SUB-ADMIN (single/bulk) ============
subAdminRoutes.post('/:id/unassign-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid sub-admin ID' }, 400)

    const { animeIds } = await c.req.json()
    if (!Array.isArray(animeIds) || animeIds.length === 0) {
      return c.json({ success: false, error: 'animeIds array required' }, 400)
    }

    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const removeSet = new Set(animeIds)
    const updated = (subAdmin.assignedAnimeIds || []).filter((aid: string) => !removeSet.has(aid))

    await updateOne('subadmins', { _id: toObjectId(id) }, { assignedAnimeIds: updated }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Anime unassign ho gaye', assignedAnimeIds: updated })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET ASSIGNED ANIME LIST (with full details, for showing in UI) ============
subAdminRoutes.get('/:id/assigned-anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!subAdmin) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    const ids = (subAdmin.assignedAnimeIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))
    const animes = ids.length
      ? await findMany('animes', { _id: { $in: ids } }, {
          projection: { title: 1, thumbnail: 1, contentType: 1, status: 1, createdBy: 1, createdByUsername: 1 }
        }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      : []

    return c.json({ success: true, data: animes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET FULL ANIME LIST FOR A SUB-ADMIN (super admin only) ============
// ✅ Updated: ab "createdBy" + "assignedAnimeIds" dono milaake anime list return hogi
subAdminRoutes.get('/:id/anime', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    const subAdmin = await findOne<ISubAdmin>('subadmins', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const assignedIds = (subAdmin?.assignedAnimeIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))

    const animes = await findMany(
      'animes',
      { $or: [{ createdBy: id }, { _id: { $in: assignedIds } }] },
      {
        sort: { createdAt: -1 },
        projection: {
          title: 1, thumbnail: 1, contentType: 1, subDubStatus: 1, status: 1,
          releaseYear: 1, views: 1, likes: 1, slug: 1, isHidden: 1, isBlocked: 1, createdAt: 1,
          createdBy: 1
        }
      },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true, data: animes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET SHORTENER USERS FOR A SUB-ADMIN (super admin only) ============
subAdminRoutes.get('/:id/shortusers', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')
    const users = await findMany(
      'shortusers',
      { createdByAdminId: id },
      { sort: { totalClicks: -1 }, projection: { password: 0, salt: 0 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true, data: users })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default subAdminRoutes