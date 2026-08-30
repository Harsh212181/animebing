import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId } from '../services/mongoService'
import { IR2Provider } from '../models/types'
import { encryptSecret } from '../services/encryptionService'

const r2ProviderRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// LIST — secret kabhi return nahi hoga
r2ProviderRoutes.get('/', adminAuth, async (c) => {
  try {
    const providers = await findMany<IR2Provider>('r2providers', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const safe = providers.map((p: any) => ({
      _id: p._id,
      hostname: p.hostname,
      bucketName: p.bucketName,
      accountId: p.accountId,
      ownerUsername: p.ownerUsername,
      label: p.label,
      isActive: p.isActive,
      createdAt: p.createdAt,
    }))
    return c.json(safe)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CREATE
r2ProviderRoutes.post('/', adminAuth, async (c) => {
  try {
    const { hostname, bucketName, accountId, accessKeyId, secretAccessKey, ownerUsername, label } = await c.req.json()
    if (!hostname || !bucketName || !accountId || !accessKeyId || !secretAccessKey) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const existing = await findOne('r2providers', { hostname }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Yeh hostname pehle se registered hai' }, 400)

    const { ciphertext, iv } = await encryptSecret(secretAccessKey, c.env.ENCRYPTION_KEY)

    const doc: any = {
      hostname,
      bucketName,
      accountId,
      accessKeyId,
      encryptedSecretAccessKey: ciphertext,
      iv,
      ownerUsername: ownerUsername || null,
      label: label || hostname,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await insertOne('r2providers', doc, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// TOGGLE ACTIVE/INACTIVE
r2ProviderRoutes.patch('/:id/toggle', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const p = await findOne<IR2Provider>('r2providers', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!p) return c.json({ error: 'Not found' }, 404)
    const updated = await updateOne('r2providers', { _id: toObjectId(id) }, { isActive: !(p as any).isActive }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE
r2ProviderRoutes.delete('/:id', adminAuth, async (c) => {
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