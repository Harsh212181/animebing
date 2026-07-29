import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { IAnime } from '../models/types'
import { findMany, findOne, insertOne, deleteOne, updateOne, countDocuments, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IPartner } from '../models/types'

const partnerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// GET ALL PARTNERS
partnerRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const filter: any = {}

    // ✅ Sub-admin → sirf apna khud ka banaya partner dikhe
    if (admin.role === 'subadmin') {
      filter.createdBy = admin.id
    }

    const partners = await findMany<IPartner>('partners', filter, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const partnersWithCount = await Promise.all(
      partners.map(async (partner) => {
        const count = await countDocuments('animes', { partnerId: partner._id }, c.env.MONGODB_URI, c.env.MONGODB_DB)
        return { ...partner, animeCount: count }
      })
    )

    return c.json(partnersWithCount)
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch partners' }, 500)
  }
})

// CREATE PARTNER
partnerRoutes.post('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { name } = await c.req.json()
    if (!name || !name.trim()) return c.json({ error: 'Partner name is required' }, 400)

    const trimmedName = name.trim()
    const existing = await findOne('partners', { name: trimmedName }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Partner already exists' }, 400)

    const newPartner = {
      name: trimmedName,
      // ✅ creator tracking — same pattern as anime/shortusers
      createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByUsername: admin.username,
      createdAt: new Date()
    }

    await insertOne('partners', newPartner, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(newPartner, 201)
  } catch (err: any) {
    return c.json({ error: 'Failed to create partner' }, 500)
  }
})

// DELETE PARTNER
partnerRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const partner = await findOne<IPartner>('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    // ✅ Sub-admin sirf apna khud ka partner delete kar sake
    if (admin.role === 'subadmin' && partner.createdBy !== admin.id) {
      return c.json({ error: 'You can only delete partners you created.' }, 403)
    }

    await deleteOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Unlink all anime
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('animes').updateMany({ partnerId: toObjectId(id) }, { $set: { partnerId: null } })

    return c.json({ message: 'Partner deleted successfully' })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete partner' }, 500)
  }
})

// GET PARTNER ANIME (with sub-admin own-access filter)
partnerRoutes.get('/:id/anime', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    const filter: any = { partnerId: toObjectId(id) }
    // Sub-admin with own access sees only his anime within the partner
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      filter.createdBy = admin.id
    }

    const animeList = await findMany('animes', filter, { sort: { updatedAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animeList)
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch partner anime' }, 500)
  }
})

// ASSIGN ANIME TO PARTNER (with ownership check for sub-admin own access)
partnerRoutes.post('/:id/anime', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    const { animeId } = await c.req.json()

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!animeId || !isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    // Sub-admin (own) can only assign own anime
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      const existingAnime = await findOne<IAnime>('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!existingAnime) return c.json({ error: 'Anime not found' }, 404)
      if (existingAnime.createdBy !== admin.id) {
        return c.json({ error: 'You can only assign anime you created.' }, 403)
      }
    }

    const anime = await updateOne('animes', { _id: toObjectId(animeId) }, { partnerId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    return c.json(anime)
  } catch (err: any) {
    return c.json({ error: 'Failed to assign anime' }, 500)
  }
})

// REMOVE ANIME FROM PARTNER (with ownership check)
partnerRoutes.delete('/:id/anime/:animeId', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    const animeId = c.req.param('animeId')

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    // Sub-admin (own) can only remove own anime
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      const existingAnime = await findOne<IAnime>('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!existingAnime) return c.json({ error: 'Anime not found' }, 404)
      if (existingAnime.createdBy !== admin.id) {
        return c.json({ error: 'You can only manage anime you created.' }, 403)
      }
    }

    const anime = await updateOne('animes', { _id: toObjectId(animeId) }, { partnerId: null }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    return c.json(anime)
  } catch (err: any) {
    return c.json({ error: 'Failed to remove anime' }, 500)
  }
})

export default partnerRoutes