import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IDownloadPage } from '../models/types'

const downloadPageRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

function countLinksByType(links: any[]) {
  return {
    watch: links.filter(l => l.type === 'watch').length,
    download: links.filter(l => l.type === 'download').length
  }
}

// STATS
downloadPageRoutes.get('/stats', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const totalPages = await db.collection('downloadpages').countDocuments()
    return c.json({ totalPages, totalDownloadEpisodes: 0 })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY ANIME ID
downloadPageRoutes.get('/anime/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)
    const pages = await findMany<IDownloadPage>('downloadpages', { animeId: toObjectId(animeId) }, { sort: { episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(pages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL (admin)
downloadPageRoutes.get('/', adminAuth, async (c) => {
  try {
    const pages = await findMany<IDownloadPage>('downloadpages', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(pages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CREATE
downloadPageRoutes.post('/', adminAuth, async (c) => {
  try {
    const { animeId, slug, title, episodeNumber, links } = await c.req.json()

    if (!animeId || !slug || !episodeNumber || !links || links.length === 0) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const existing = await findOne('downloadpages', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Slug already exists' }, 400)

    const anime = await findOne('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 400)

    if (links.length > 24) return c.json({ error: 'Maximum 24 links allowed' }, 400)
    const counts = countLinksByType(links)
    if (counts.watch > 12) return c.json({ error: `Max 12 watch links allowed` }, 400)
    if (counts.download > 12) return c.json({ error: `Max 12 download links allowed` }, 400)

    for (const link of links) {
      if (!link.episode || !link.url) return c.json({ error: 'Each link needs episode and url' }, 400)
      if (!link.type) link.type = 'download'
    }

    const page = { animeId: toObjectId(animeId), slug, title: title || 'Download', episodeNumber, links }
    await insertOne('downloadpages', page, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(page, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE
downloadPageRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { slug, title, episodeNumber, links } = await c.req.json()

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const updateData: any = {}
    if (slug && slug !== page.slug) {
      const existing = await findOne('downloadpages', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (existing) return c.json({ error: 'Slug already exists' }, 400)
      updateData.slug = slug
    }
    if (title !== undefined) updateData.title = title
    if (episodeNumber !== undefined) {
      if (episodeNumber < 1) return c.json({ error: 'episodeNumber must be at least 1' }, 400)
      updateData.episodeNumber = episodeNumber
    }
    if (links) {
      if (links.length > 24) return c.json({ error: 'Maximum 24 links allowed' }, 400)
      const counts = countLinksByType(links)
      if (counts.watch > 12) return c.json({ error: 'Max 12 watch links' }, 400)
      if (counts.download > 12) return c.json({ error: 'Max 12 download links' }, 400)
      for (const link of links) {
        if (!link.episode || !link.url) return c.json({ error: 'Each link needs episode and url' }, 400)
        if (!link.type) link.type = 'download'
      }
      updateData.links = links
    }

    const updated = await updateOne('downloadpages', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE
downloadPageRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const page = await findOne('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)
    await deleteOne('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY SLUG
downloadPageRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const page = await findOne<IDownloadPage>('downloadpages', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)
    return c.json(page)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default downloadPageRoutes