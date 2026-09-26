import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IEpisode } from '../models/types'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { withEdgeCache } from '../utils/cache'

const episodeRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// DELETE ALL — sirf main admin
episodeRoutes.delete('/all', adminAuth, superAdminOnly, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const result = await db.collection('episodes').deleteMany({})
    return c.json({ message: `All episodes deleted (${result.deletedCount})`, deletedCount: result.deletedCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL — public
episodeRoutes.get('/', async (c) => {
  try {
    const episodes = await findMany<IEpisode>('episodes', {}, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(episodes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ADD EPISODE — auth required. ✅ FIX: pehle anime-findOne + existing-findOne
// + insertOne + anime-updateOne = 4 alag connections. Ab sab 1 `db` se.
episodeRoutes.post('/', adminAuth, async (c) => {
  try {
    const { animeId, title, episodeNumber, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!animeId || typeof episodeNumber === 'undefined') {
      return c.json({ error: 'animeId and episodeNumber required' }, 400)
    }
    if (!downloadLinks || !Array.isArray(downloadLinks) || downloadLinks.length === 0) {
      return c.json({ error: 'At least one download link is required' }, 400)
    }
    if (downloadLinks.length > 5) {
      return c.json({ error: 'Maximum 5 download links allowed' }, 400)
    }
    for (let i = 0; i < downloadLinks.length; i++) {
      if (!downloadLinks[i].name || !downloadLinks[i].url) {
        return c.json({ error: `Download link ${i + 1} must have both name and url` }, 400)
      }
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const [anime, existing] = await Promise.all([
      db.collection('animes').findOne({ _id: toObjectId(animeId) }),
      db.collection('episodes').findOne({
        animeId: toObjectId(animeId),
        episodeNumber: Number(episodeNumber),
        session: session || 1
      }),
    ])
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    if (existing) return c.json({ error: `Episode ${episodeNumber} already exists in Session ${session || 1}` }, 409)

    const now = new Date()
    const newEpisode = {
      animeId: toObjectId(animeId),
      title: title || `Episode ${episodeNumber}`,
      episodeNumber: Number(episodeNumber),
      secureFileReference: secureFileReference || null,
      mainLink: mainLink || '',
      downloadLinks: downloadLinks.map((link: any, index: number) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      })),
      session: session || 1,
      createdAt: now,
      updatedAt: now,
    }

    await db.collection('episodes').insertOne(newEpisode)
    await db.collection('animes').updateOne({ _id: toObjectId(animeId) }, { $set: { lastContentAdded: new Date() } })

    return c.json({ message: 'Episode added successfully! This anime will now appear first on homepage.', episode: newEpisode })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET EPISODES BY ANIME ID (download) — public
episodeRoutes.get('/download/:animeId/:episodeNumber', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    const episodeNumber = c.req.param('episodeNumber')
    const session = parseInt(c.req.query('session') || '1')

    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const episode = await db.collection('episodes').findOne({
      animeId: toObjectId(animeId),
      episodeNumber: Number(episodeNumber),
      session
    }) as IEpisode | null

    if (!episode) return c.json({ error: 'Episode not found' }, 404)

    return c.json({
      animeId: episode.animeId,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
      session: episode.session,
      downloadLinks: episode.downloadLinks
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY ANIME ID — public (🆕 CACHED: 180s edge cache)
episodeRoutes.get('/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    if (!animeId || animeId === 'undefined') return c.json({ error: 'Invalid anime ID' }, 400)
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const response = await withEdgeCache(c, 180, async () => {
      const episodes = await findMany<IEpisode>('episodes', { animeId: toObjectId(animeId) }, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      return episodes.map(ep => ({
        ...ep,
        mainLink: ep.mainLink !== undefined && ep.mainLink !== null ? ep.mainLink : ''
      }))
    })
    return response
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE EPISODE — auth required. ✅ FIX: 3 connections combined into 1.
episodeRoutes.patch('/', adminAuth, async (c) => {
  try {
    const { animeId, episodeNumber, title, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!animeId || typeof episodeNumber === 'undefined') {
      return c.json({ error: 'animeId and episodeNumber are required' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ _id: toObjectId(animeId) })
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    const update: any = { mainLink: mainLink || '', updatedAt: new Date() }
    if (typeof title !== 'undefined') update.title = title
    if (typeof secureFileReference !== 'undefined') update.secureFileReference = secureFileReference
    if (typeof session !== 'undefined') update.session = session

    if (downloadLinks) {
      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) {
        return c.json({ error: 'At least one download link is required' }, 400)
      }
      if (downloadLinks.length > 5) return c.json({ error: 'Maximum 5 download links allowed' }, 400)
      for (let i = 0; i < downloadLinks.length; i++) {
        if (!downloadLinks[i].name || !downloadLinks[i].url) {
          return c.json({ error: `Download link ${i + 1} must have both name and url` }, 400)
        }
      }
      update.downloadLinks = downloadLinks.map((link: any, index: number) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      }))
    }

    const updated = await db.collection('episodes').findOneAndUpdate(
      { animeId: toObjectId(animeId), episodeNumber: Number(episodeNumber), session: session || 1 },
      { $set: update },
      { returnDocument: 'after' }
    )
    if (!updated) return c.json({ error: 'Episode not found' }, 404)

    await db.collection('animes').updateOne({ _id: toObjectId(animeId) }, { $set: { lastContentAdded: new Date() } })

    return c.json({ message: '✅ Episode updated successfully!', episode: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE EPISODE — auth required. ✅ FIX: 2 connections combined into 1.
episodeRoutes.delete('/', adminAuth, async (c) => {
  try {
    const { animeId, episodeNumber, session } = await c.req.json()

    if (!animeId || typeof episodeNumber === 'undefined' || typeof session === 'undefined') {
      return c.json({ error: 'animeId, episodeNumber, and session required' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const removed = await db.collection('episodes').findOneAndDelete({
      animeId: toObjectId(animeId),
      episodeNumber: Number(episodeNumber),
      session: Number(session)
    })

    if (!removed) return c.json({ error: 'Episode not found' }, 404)

    await db.collection('animes').updateOne({ _id: toObjectId(animeId) }, { $set: { lastContentAdded: new Date() } })

    return c.json({ message: 'Episode deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default episodeRoutes