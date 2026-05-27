import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany, findOne, insertOne, updateOne, deleteOne, deleteMany, countDocuments, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IEpisode } from '../models/types'

const episodeRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// DELETE ALL
episodeRoutes.delete('/all', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const result = await db.collection('episodes').deleteMany({})
    return c.json({ message: `All episodes deleted (${result.deletedCount})`, deletedCount: result.deletedCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL
episodeRoutes.get('/', async (c) => {
  try {
    const episodes = await findMany<IEpisode>('episodes', {}, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(episodes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ADD EPISODE
episodeRoutes.post('/', async (c) => {
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

    const anime = await findOne('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    const existing = await findOne('episodes', {
      animeId: toObjectId(animeId),
      episodeNumber: Number(episodeNumber),
      session: session || 1
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (existing) {
      return c.json({ error: `Episode ${episodeNumber} already exists in Session ${session || 1}` }, 409)
    }

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
      session: session || 1
    }

    await insertOne('episodes', newEpisode, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Update anime lastContentAdded
    await updateOne('animes', { _id: toObjectId(animeId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: 'Episode added successfully! This anime will now appear first on homepage.', episode: newEpisode })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET EPISODES BY ANIME ID
episodeRoutes.get('/download/:animeId/:episodeNumber', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    const episodeNumber = c.req.param('episodeNumber')
    const session = parseInt(c.req.query('session') || '1')

    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const episode = await findOne<IEpisode>('episodes', {
      animeId: toObjectId(animeId),
      episodeNumber: Number(episodeNumber),
      session
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// GET BY ANIME ID
episodeRoutes.get('/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    if (!animeId || animeId === 'undefined') return c.json({ error: 'Invalid anime ID' }, 400)
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const episodes = await findMany<IEpisode>('episodes', { animeId: toObjectId(animeId) }, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const fixedEpisodes = episodes.map(ep => ({
      ...ep,
      mainLink: ep.mainLink !== undefined && ep.mainLink !== null ? ep.mainLink : ''
    }))

    return c.json(fixedEpisodes || [])
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE EPISODE
episodeRoutes.patch('/', async (c) => {
  try {
    const { animeId, episodeNumber, title, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!animeId || typeof episodeNumber === 'undefined') {
      return c.json({ error: 'animeId and episodeNumber are required' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const anime = await findOne('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)

    const update: any = { mainLink: mainLink || '' }
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

    const updated = await updateOne('episodes', {
      animeId: toObjectId(animeId),
      episodeNumber: Number(episodeNumber),
      session: session || 1
    }, update, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (!updated) return c.json({ error: 'Episode not found' }, 404)

    await updateOne('animes', { _id: toObjectId(animeId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: '✅ Episode updated successfully!', episode: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE EPISODE
episodeRoutes.delete('/', async (c) => {
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

    await updateOne('animes', { _id: toObjectId(animeId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: 'Episode deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default episodeRoutes