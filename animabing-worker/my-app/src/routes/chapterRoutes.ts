import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IChapter } from '../models/types'

const chapterRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// DELETE ALL
chapterRoutes.delete('/all', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const result = await db.collection('chapters').deleteMany({})
    return c.json({ message: `All chapters deleted (${result.deletedCount})`, deletedCount: result.deletedCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL
chapterRoutes.get('/', async (c) => {
  try {
    const chapters = await findMany<IChapter>('chapters', {}, { sort: { session: 1, chapterNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(chapters)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ADD CHAPTER
chapterRoutes.post('/', async (c) => {
  try {
    const { mangaId, title, chapterNumber, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!mangaId || typeof chapterNumber === 'undefined') {
      return c.json({ error: 'mangaId and chapterNumber required' }, 400)
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

    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const manga = await findOne('animes', { _id: toObjectId(mangaId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!manga) return c.json({ error: 'Manga not found' }, 404)

    const existing = await findOne('chapters', {
      mangaId: toObjectId(mangaId),
      chapterNumber: Number(chapterNumber),
      session: session || 1
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (existing) {
      return c.json({ error: `Chapter ${chapterNumber} already exists in Session ${session || 1}` }, 409)
    }

    const newChapter = {
      mangaId: toObjectId(mangaId),
      title: title || `Chapter ${chapterNumber}`,
      chapterNumber: Number(chapterNumber),
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

    await insertOne('chapters', newChapter, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await updateOne('animes', { _id: toObjectId(mangaId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: 'Chapter added successfully!', chapter: newChapter })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET DOWNLOAD LINKS
chapterRoutes.get('/download/:mangaId/:chapterNumber', async (c) => {
  try {
    const mangaId = c.req.param('mangaId')
    const chapterNumber = c.req.param('chapterNumber')
    const session = parseInt(c.req.query('session') || '1')

    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const chapter = await findOne<IChapter>('chapters', {
      mangaId: toObjectId(mangaId),
      chapterNumber: Number(chapterNumber),
      session
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (!chapter) return c.json({ error: 'Chapter not found' }, 404)

    return c.json({
      mangaId: chapter.mangaId,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      session: chapter.session,
      downloadLinks: chapter.downloadLinks
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY MANGA ID
chapterRoutes.get('/:mangaId', async (c) => {
  try {
    const mangaId = c.req.param('mangaId')
    if (!mangaId || mangaId === 'undefined') return c.json({ error: 'Invalid manga ID' }, 400)
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const chapters = await findMany<IChapter>('chapters', { mangaId: toObjectId(mangaId) }, { sort: { session: 1, chapterNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const fixedChapters = chapters.map(ch => ({
      ...ch,
      mainLink: ch.mainLink !== undefined && ch.mainLink !== null ? ch.mainLink : ''
    }))

    return c.json(fixedChapters || [])
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE CHAPTER
chapterRoutes.patch('/', async (c) => {
  try {
    const { mangaId, chapterNumber, title, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!mangaId || typeof chapterNumber === 'undefined') {
      return c.json({ error: 'mangaId and chapterNumber are required' }, 400)
    }
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const manga = await findOne('animes', { _id: toObjectId(mangaId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!manga) return c.json({ error: 'Manga not found' }, 404)

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

    const updated = await updateOne('chapters', {
      mangaId: toObjectId(mangaId),
      chapterNumber: Number(chapterNumber),
      session: session || 1
    }, update, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (!updated) return c.json({ error: 'Chapter not found' }, 404)

    await updateOne('animes', { _id: toObjectId(mangaId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: '✅ Chapter updated successfully!', chapter: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE CHAPTER
chapterRoutes.delete('/', async (c) => {
  try {
    const { mangaId, chapterNumber, session } = await c.req.json()

    if (!mangaId || typeof chapterNumber === 'undefined' || typeof session === 'undefined') {
      return c.json({ error: 'mangaId, chapterNumber, and session required' }, 400)
    }
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const removed = await db.collection('chapters').findOneAndDelete({
      mangaId: toObjectId(mangaId),
      chapterNumber: Number(chapterNumber),
      session: Number(session)
    })

    if (!removed) return c.json({ error: 'Chapter not found' }, 404)

    await updateOne('animes', { _id: toObjectId(mangaId) }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ message: 'Chapter deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default chapterRoutes