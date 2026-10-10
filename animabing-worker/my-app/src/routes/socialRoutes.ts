import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, updateOne, withDb } from '../services/mongoService'
import { ISocialMedia } from '../models/types'

const socialRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const defaultLinks = [
  { platform: 'facebook', url: 'https://facebook.com/animebing', isActive: true, icon: 'facebook', displayName: 'Facebook' },
  { platform: 'instagram', url: 'https://instagram.com/animebing', isActive: true, icon: 'instagram', displayName: 'Instagram' },
  { platform: 'telegram', url: 'https://t.me/animebing', isActive: true, icon: 'telegram', displayName: 'Telegram' }
]

// GET ACTIVE LINKS (public) — uses findMany helper → already safe
socialRoutes.get('/', async (c) => {
  try {
    const links = await findMany<ISocialMedia>('socialmedia', { isActive: true }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL (admin) — uses findMany helper → already safe
socialRoutes.get('/admin/all', adminAuth, async (c) => {
  try {
    const links = await findMany<ISocialMedia>('socialmedia', {}, { sort: { platform: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE BY PLATFORM (admin) — uses updateOne helper → already safe
socialRoutes.put('/admin/:platform', adminAuth, async (c) => {
  try {
    const platform = c.req.param('platform') as string
    const { url, isActive } = await c.req.json()

    const allowedPlatforms = ['facebook', 'instagram', 'telegram']
    if (!allowedPlatforms.includes(platform)) {
      return c.json({ error: 'Invalid platform. Only facebook, instagram, telegram allowed.' }, 400)
    }
    if (url && !/^https?:\/\//.test(url)) {
      return c.json({ error: 'URL must start with http:// or https://' }, 400)
    }

    const updated = await updateOne(
      'socialmedia',
      { platform },
      { url: url.trim(), isActive: isActive !== undefined ? isActive : true },
      c.env.MONGODB_URI, c.env.MONGODB_DB,
      true
    )

    return c.json({ success: true, message: 'Social link updated!', data: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// RESET DEFAULTS (admin)
// ✅ FIX: pehle getDb(1) + deleteMany helper(1) + 3× insertOne helper(3) +
// findMany helper(1) = 6 connections. Ab sab 1 withDb me.
socialRoutes.post('/admin/reset-defaults', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'social/reset-defaults', async (db) => {
      await db.collection('socialmedia').deleteMany({})

      const now = new Date()
      // Match insertOne helper behavior — spread + force createdAt/updatedAt
      await db.collection('socialmedia').insertMany(
        defaultLinks.map(link => ({
          ...link,
          createdAt: now,
          updatedAt: now
        }))
      )

      const links = await db.collection('socialmedia')
        .find({})
        .toArray()
      return c.json({ success: true, message: 'Reset to default social links', data: links })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default socialRoutes