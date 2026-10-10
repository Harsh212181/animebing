import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { IChapter } from '../models/types'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { withEdgeCache, invalidateEdgeCache } from '../utils/cache'

const chapterRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ✅ chapter add/edit/delete hone par related cache turant clear karo
async function invalidateChapterRelatedCache(c: any, mangaId: string, slug?: string | null) {
  try {
    await invalidateEdgeCache(c, `/api/chapters/${mangaId}`)
    await invalidateEdgeCache(c, `/api/anime/${mangaId}`)
    if (slug) await invalidateEdgeCache(c, `/api/anime/slug/${slug}`)
  } catch (err) {
    console.error('[invalidateChapterRelatedCache] failed:', err)
  }
}

// DELETE ALL — sirf main admin
// ✅ FIX: getDb → withDb
chapterRoutes.delete('/all', adminAuth, superAdminOnly, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'chapters/delete-all', async (db) => {
      const result = await db.collection('chapters').deleteMany({})
      return c.json({ message: `All chapters deleted (${result.deletedCount})`, deletedCount: result.deletedCount })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL — public (uses findMany helper → already withDb internally)
chapterRoutes.get('/', async (c) => {
  try {
    const chapters = await findMany<IChapter>('chapters', {}, { sort: { session: 1, chapterNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(chapters)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ADD CHAPTER — auth required
// ✅ FIX: getDb → withDb
chapterRoutes.post('/', adminAuth, async (c) => {
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

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'chapters/add', async (db) => {
      const [manga, existing] = await Promise.all([
        db.collection('animes').findOne({ _id: toObjectId(mangaId) }),
        db.collection('chapters').findOne({
          mangaId: toObjectId(mangaId),
          chapterNumber: Number(chapterNumber),
          session: session || 1
        }),
      ])
      if (!manga) return c.json({ error: 'Manga not found' }, 404)
      if (existing) return c.json({ error: `Chapter ${chapterNumber} already exists in Session ${session || 1}` }, 409)

      const now = new Date()
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
        session: session || 1,
        createdAt: now,
        updatedAt: now,
      }

      await db.collection('chapters').insertOne(newChapter)
      await db.collection('animes').updateOne({ _id: toObjectId(mangaId) }, { $set: { lastContentAdded: new Date() } })

      await invalidateChapterRelatedCache(c, mangaId, (manga as any).slug)

      return c.json({ message: 'Chapter added successfully!', chapter: newChapter })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET DOWNLOAD LINKS — public
// ✅ FIX: getDb → withDb
chapterRoutes.get('/download/:mangaId/:chapterNumber', async (c) => {
  try {
    const mangaId = c.req.param('mangaId')
    const chapterNumber = c.req.param('chapterNumber')
    const session = parseInt(c.req.query('session') || '1')

    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'chapters/download', async (db) => {
      const chapter = await db.collection('chapters').findOne({
        mangaId: toObjectId(mangaId),
        chapterNumber: Number(chapterNumber),
        session
      }) as IChapter | null

      if (!chapter) return c.json({ error: 'Chapter not found' }, 404)

      return c.json({
        mangaId: chapter.mangaId,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        session: chapter.session,
        downloadLinks: chapter.downloadLinks
      })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY MANGA ID — public — 300s edge-cached (uses findMany helper → safe)
chapterRoutes.get('/:mangaId', async (c) => {
  try {
    const mangaId = c.req.param('mangaId')
    if (!mangaId || mangaId === 'undefined') return c.json({ error: 'Invalid manga ID' }, 400)
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    const response = await withEdgeCache(c, 300, async () => {
      const chapters = await findMany<IChapter>('chapters', { mangaId: toObjectId(mangaId) }, { sort: { session: 1, chapterNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      return chapters.map(ch => ({
        ...ch,
        mainLink: ch.mainLink !== undefined && ch.mainLink !== null ? ch.mainLink : ''
      }))
    })
    return response
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE CHAPTER — auth required
// ✅ FIX: getDb → withDb
chapterRoutes.patch('/', adminAuth, async (c) => {
  try {
    const { mangaId, chapterNumber, title, secureFileReference, mainLink, downloadLinks, session } = await c.req.json()

    if (!mangaId || typeof chapterNumber === 'undefined') {
      return c.json({ error: 'mangaId and chapterNumber are required' }, 400)
    }
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'chapters/update', async (db) => {
      const manga = await db.collection('animes').findOne({ _id: toObjectId(mangaId) })
      if (!manga) return c.json({ error: 'Manga not found' }, 404)

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

      const updated = await db.collection('chapters').findOneAndUpdate(
        { mangaId: toObjectId(mangaId), chapterNumber: Number(chapterNumber), session: session || 1 },
        { $set: update },
        { returnDocument: 'after' }
      )
      if (!updated) return c.json({ error: 'Chapter not found' }, 404)

      await db.collection('animes').updateOne({ _id: toObjectId(mangaId) }, { $set: { lastContentAdded: new Date() } })

      await invalidateChapterRelatedCache(c, mangaId, (manga as any).slug)

      return c.json({ message: '✅ Chapter updated successfully!', chapter: updated })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE CHAPTER — auth required
// ✅ FIX: getDb → withDb
chapterRoutes.delete('/', adminAuth, async (c) => {
  try {
    const { mangaId, chapterNumber, session } = await c.req.json()

    if (!mangaId || typeof chapterNumber === 'undefined' || typeof session === 'undefined') {
      return c.json({ error: 'mangaId, chapterNumber, and session required' }, 400)
    }
    if (!isValidObjectId(mangaId)) return c.json({ error: 'Invalid mangaId' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'chapters/delete', async (db) => {
      const removed = await db.collection('chapters').findOneAndDelete({
        mangaId: toObjectId(mangaId),
        chapterNumber: Number(chapterNumber),
        session: Number(session)
      })

      if (!removed) return c.json({ error: 'Chapter not found' }, 404)

      const manga = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(mangaId) },
        { $set: { lastContentAdded: new Date() } },
        { returnDocument: 'after' }
      )

      await invalidateChapterRelatedCache(c, mangaId, (manga as any)?.slug)

      return c.json({ message: 'Chapter deleted' })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default chapterRoutes