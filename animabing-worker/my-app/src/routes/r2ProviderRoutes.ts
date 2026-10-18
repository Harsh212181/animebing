import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId } from '../services/mongoService'
import { IR2Provider } from '../models/types'
import { encryptSecret } from '../services/encryptionService'

const r2ProviderRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const SUBADMIN_COLLECTION = 'subadmins'

// 🔒 Sirf main admin — sub-admin is poore router se bahar
r2ProviderRoutes.use('*', adminAuth, superAdminOnly)

async function subAdminExists(username: string, c: any): Promise<boolean> {
  const s = await findOne<any>(SUBADMIN_COLLECTION, { username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return !!s
}

// SUB-ADMINS list (dropdown ke liye) — password/salt kabhi return nahi hota
r2ProviderRoutes.get('/sub-admins', async (c) => {
  try {
    const list = await findMany<any>(SUBADMIN_COLLECTION, {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const safe = list
      .filter((s: any) => s.username)
      .map((s: any) => ({
        username: s.username,
        name: s.fullName && s.fullName !== s.username ? s.fullName : '',
        isBlocked: !!s.isBlocked,
      }))
      .sort((a, b) => a.username.localeCompare(b.username))
    return c.json(safe)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// LIST — secret kabhi return nahi hoga
r2ProviderRoutes.get('/', async (c) => {
  try {
    const providers = await findMany<IR2Provider>('r2providers', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(providers.map((p: any) => ({
      _id: p._id,
      hostname: p.hostname,
      bucketName: p.bucketName,
      accountId: p.accountId,
      ownerUsername: p.ownerUsername,
      label: p.label,
      isActive: p.isActive,
      publicBaseUrl: p.publicBaseUrl || '',
      createdAt: p.createdAt,
    })))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CREATE
r2ProviderRoutes.post('/', async (c) => {
  try {
    const { hostname: hostnameIn, bucketName, accountId, accessKeyId, secretAccessKey, ownerUsername, label, publicBaseUrl } = await c.req.json()
    if (!bucketName || !accountId || !accessKeyId || !secretAccessKey) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    if (ownerUsername && !(await subAdminExists(ownerUsername, c))) {
      return c.json({ error: `Sub-admin "${ownerUsername}" nahi mila` }, 400)
    }

    // Hostname khali ho to auto-generate
    const safeBucket = String(bucketName).toLowerCase().replace(/[^a-z0-9-]/g, '')
    const hostname = (hostnameIn?.trim() ||
      `${ownerUsername || 'admin'}-${String(accountId).slice(0, 6)}-${safeBucket}-r2.internal`).toLowerCase()

    const existing = await findOne('r2providers', { hostname }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Yeh hostname pehle se registered hai' }, 400)

    let cleanUrl = ''
    if (publicBaseUrl) {
      try {
        const u = new URL(publicBaseUrl)
        if (u.protocol !== 'https:') throw new Error()
        cleanUrl = (u.origin + u.pathname).replace(/\/+$/, '')
      } catch {
        return c.json({ error: 'Valid https Public URL daalo' }, 400)
      }
    }

    const { ciphertext, iv } = await encryptSecret(secretAccessKey, c.env.ENCRYPTION_KEY)

    await insertOne('r2providers', {
      hostname,
      bucketName,
      accountId,
      accessKeyId,
      encryptedSecretAccessKey: ciphertext,
      iv,
      ownerUsername: ownerUsername || null,
      label: label || `${bucketName}${ownerUsername ? ` (${ownerUsername})` : ''}`,
      publicBaseUrl: cleanUrl,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, hostname }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// OWNER badlo — kisi bhi bucket ka access kisi bhi sub-admin ko do
r2ProviderRoutes.patch('/:id/owner', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const { ownerUsername } = await c.req.json()
    const newOwner = ownerUsername ? String(ownerUsername) : null

    if (newOwner && !(await subAdminExists(newOwner, c))) {
      return c.json({ error: `Sub-admin "${newOwner}" nahi mila` }, 400)
    }

    const p = await findOne<IR2Provider>('r2providers', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!p) return c.json({ error: 'Not found' }, 404)

    await updateOne('r2providers', { _id: toObjectId(id) }, { ownerUsername: newOwner, updatedAt: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, ownerUsername: newOwner })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// TOGGLE ACTIVE/INACTIVE
r2ProviderRoutes.patch('/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const p = await findOne<IR2Provider>('r2providers', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!p) return c.json({ error: 'Not found' }, 404)
    const updated = await updateOne('r2providers', { _id: toObjectId(id) }, { isActive: (p as any).isActive === false }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE
r2ProviderRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('r2providers', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default r2ProviderRoutes