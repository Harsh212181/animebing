import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, findOne, insertOne, deleteOne, updateOne, countDocuments, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IPartner } from '../models/types'

const partnerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// GET ALL PARTNERS
partnerRoutes.get('/', adminAuth, async (c) => {
  try {
    const partners = await findMany<IPartner>('partners', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

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
    const { name } = await c.req.json()
    if (!name || !name.trim()) return c.json({ error: 'Partner name is required' }, 400)

    const trimmedName = name.trim()
    const existing = await findOne('partners', { name: trimmedName }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Partner already exists' }, 400)

    await insertOne('partners', { name: trimmedName }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ name: trimmedName }, 201)
  } catch (err: any) {
    return c.json({ error: 'Failed to create partner' }, 500)
  }
})

// DELETE PARTNER
partnerRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    await deleteOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Unlink all anime
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('animes').updateMany({ partnerId: toObjectId(id) }, { $set: { partnerId: null } })

    return c.json({ message: 'Partner deleted successfully' })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete partner' }, 500)
  }
})

// GET PARTNER ANIME
partnerRoutes.get('/:id/anime', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    const animeList = await findMany('animes', { partnerId: toObjectId(id) }, { sort: { updatedAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animeList)
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch partner anime' }, 500)
  }
})

// ASSIGN ANIME TO PARTNER
partnerRoutes.post('/:id/anime', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { animeId } = await c.req.json()

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!animeId || !isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    const anime = await updateOne('animes', { _id: toObjectId(animeId) }, { partnerId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    return c.json(anime)
  } catch (err: any) {
    return c.json({ error: 'Failed to assign anime' }, 500)
  }
})

// REMOVE ANIME FROM PARTNER
partnerRoutes.delete('/:id/anime/:animeId', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const animeId = c.req.param('animeId')

    if (!isValidObjectId(id)) return c.json({ error: 'Invalid partner ID' }, 400)
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const partner = await findOne('partners', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!partner) return c.json({ error: 'Partner not found' }, 404)

    const anime = await updateOne('animes', { _id: toObjectId(animeId) }, { partnerId: null }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    return c.json(anime)
  } catch (err: any) {
    return c.json({ error: 'Failed to remove anime' }, 500)
  }
})

export default partnerRoutes