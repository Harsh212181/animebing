import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { IAnime } from '../models/types'
import { toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { IPartner } from '../models/types'

const partnerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// GET ALL PARTNERS
// ✅ FIX: pehle N+1 tha — findMany (1) + countDocuments × N (N) = N+1 connections.
// Ab aggregation se ek hi query me counts aa jaate hain. Total: 1 connection.
partnerRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const filter: any = {}
    if (admin.role === 'subadmin') {
      filter.createdBy = admin.id
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/list', async (db) => {
      const partners = await db.collection('partners')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray()

      if (partners.length === 0) return c.json([])

      const partnerIds = partners.map((p: any) => p._id)

      // ✅ Ek hi aggregation me saare partner-wise anime counts
      const counts = await db.collection('animes').aggregate([
        { $match: { partnerId: { $in: partnerIds } } },
        { $group: { _id: '$partnerId', count: { $sum: 1 } } }
      ]).toArray()

      const countMap = new Map(
        counts.map((c: any) => [c._id.toString(), c.count])
      )

      const partnersWithCount = partners.map((p: any) => ({
        ...p,
        animeCount: countMap.get(p._id.toString()) || 0
      }))

      return c.json(partnersWithCount)
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch partners' }, 500)
  }
})

// CREATE PARTNER
// ✅ FIX: findOne + insertOne (2 connections) → 1 withDb
partnerRoutes.post('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { name } = await c.req.json()
    if (!name || !name.trim()) return c.json({ error: 'Partner name is required' }, 400)

    const trimmedName = name.trim()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/create', async (db) => {
      const existing = await db.collection('partners').findOne({ name: trimmedName })
      if (existing) return c.json({ error: 'Partner already exists' }, 400)

      const newPartner = {
        name: trimmedName,
        createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
        createdByUsername: admin.username,
        createdAt: new Date()
      }

      // Match `insertOne` helper behavior — force createdAt/updatedAt
      await db.collection('partners').insertOne({
        ...newPartner,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return c.json(newPartner, 201)
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to create partner' }, 500)
  }
})

// DELETE PARTNER
// ✅ FIX: findOne + deleteOne + getDb (3 connections) → 1 withDb
partnerRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/delete', async (db) => {
      const partner = await db.collection('partners').findOne({ _id: toObjectId(id) }) as IPartner | null
      if (!partner) return c.json({ error: 'Partner not found' }, 404)

      if (admin.role === 'subadmin' && partner.createdBy !== admin.id) {
        return c.json({ error: 'You can only delete partners you created.' }, 403)
      }

      await db.collection('partners').deleteOne({ _id: toObjectId(id) })

      // Unlink all anime
      await db.collection('animes').updateMany(
        { partnerId: toObjectId(id) },
        { $set: { partnerId: null } }
      )

      return c.json({ message: 'Partner deleted successfully' })
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete partner' }, 500)
  }
})

// GET PARTNER ANIME (with sub-admin own-access filter)
// ✅ FIX: findOne + findMany (2 connections) → 1 withDb
partnerRoutes.get('/:id/anime', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/anime/list', async (db) => {
      const partner = await db.collection('partners').findOne({ _id: toObjectId(id) })
      if (!partner) return c.json({ error: 'Partner not found' }, 404)

      const filter: any = { partnerId: toObjectId(id) }
      if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
        filter.createdBy = admin.id
      }

      const animeList = await db.collection('animes')
        .find(filter)
        .sort({ updatedAt: -1 })
        .toArray()
      return c.json(animeList)
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch partner anime' }, 500)
  }
})

// ASSIGN ANIME TO PARTNER
// ✅ FIX: findOne + findOne + updateOne (3 connections) → 1 withDb
partnerRoutes.post('/:id/anime', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    const { animeId } = await c.req.json()

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!animeId || !isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/anime/assign', async (db) => {
      const partner = await db.collection('partners').findOne({ _id: toObjectId(id) })
      if (!partner) return c.json({ error: 'Partner not found' }, 404)

      // Sub-admin (own) can only assign own anime
      if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
        const existingAnime = await db.collection('animes').findOne({ _id: toObjectId(animeId) }) as IAnime | null
        if (!existingAnime) return c.json({ error: 'Anime not found' }, 404)
        if (existingAnime.createdBy !== admin.id) {
          return c.json({ error: 'You can only assign anime you created.' }, 403)
        }
      }

      // Match `updateOne` helper behavior: $set + force updatedAt, returnDocument: 'after'
      const anime = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(animeId) },
        { $set: { partnerId: toObjectId(id), updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!anime) return c.json({ error: 'Anime not found' }, 404)

      return c.json(anime)
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to assign anime' }, 500)
  }
})

// REMOVE ANIME FROM PARTNER
// ✅ FIX: findOne + findOne + updateOne (3 connections) → 1 withDb
partnerRoutes.delete('/:id/anime/:animeId', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    const animeId = c.req.param('animeId')

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'partners/anime/remove', async (db) => {
      const partner = await db.collection('partners').findOne({ _id: toObjectId(id) })
      if (!partner) return c.json({ error: 'Partner not found' }, 404)

      if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
        const existingAnime = await db.collection('animes').findOne({ _id: toObjectId(animeId) }) as IAnime | null
        if (!existingAnime) return c.json({ error: 'Anime not found' }, 404)
        if (existingAnime.createdBy !== admin.id) {
          return c.json({ error: 'You can only manage anime you created.' }, 403)
        }
      }

      const anime = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(animeId) },
        { $set: { partnerId: null, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!anime) return c.json({ error: 'Anime not found' }, 404)

      return c.json(anime)
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to remove anime' }, 500)
  }
})

export default partnerRoutes