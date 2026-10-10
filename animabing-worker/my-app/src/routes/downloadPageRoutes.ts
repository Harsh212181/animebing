import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { IDownloadPage } from '../models/types'
import { syncPageDerivedData, syncAnimeEpisodeCountFromAnime } from '../services/episodeSyncService'
import { prefetchR2Providers, isProtectedDomainSync, signDownloadUrlBatch } from '../services/signedUrlService'
import { withEdgeCache, invalidateEdgeCache } from '../utils/cache'

const downloadPageRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

function countLinksByType(links: any[]) {
  return {
    watch: links.filter(l => l.type === 'watch').length,
    download: links.filter(l => l.type === 'download').length
  }
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''"""]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ============ HELPER: sub-admin owned anime IDs ============
async function getOwnedAnimeIds(admin: any, db: any): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  return animes.map((a: any) => a._id.toString())
}

// ============ HELPER: cache invalidation ============
async function invalidateDownloadPageCache(c: any, animeId?: string | null, slug?: string | null) {
  try {
    if (animeId) await invalidateEdgeCache(c, `/api/download-pages/anime/${animeId}`)
    if (slug) await invalidateEdgeCache(c, `/api/download-pages/${slug}`)
  } catch (err) {
    console.error('[invalidateDownloadPageCache] failed:', err)
  }
}

// STATS
downloadPageRoutes.get('/stats', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/stats', async (db) => {
      const totalPages = await db.collection('downloadpages').countDocuments()
      return c.json({ totalPages, totalDownloadEpisodes: 0 })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY ANIME ID
downloadPageRoutes.get('/anime/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const response = await withEdgeCache(c, 300, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPagesByAnime', (db) =>
        db.collection('downloadpages')
          .find({ animeId: toObjectId(animeId) })
          .sort({ episodeNumber: 1 })
          .toArray()
      )
    )
    return response
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL (admin)
downloadPageRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/list', async (db) => {
      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)

      if (ownedAnimeIds !== null && ownedAnimeIds.length === 0) {
        return c.json([])
      }

      const filter: any = {}
      if (ownedAnimeIds !== null) {
        filter.animeId = { $in: ownedAnimeIds.map((id: string) => toObjectId(id)) }
      }

      const pages = await db.collection('downloadpages')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray()

      if (!pages || pages.length === 0) return c.json([])

      const animeIds = [...new Set(
        pages.map((p: any) => p.animeId?.toString()).filter(Boolean)
      )]

      const animes = await db.collection('animes')
        .find(
          { _id: { $in: animeIds.map((id: string) => toObjectId(id)) } },
          { projection: { title: 1, contentType: 1, subDubStatus: 1, status: 1, thumbnail: 1, isHidden: 1, createdByUsername: 1, createdBy: 1 } }
        )
        .toArray()

      const creatorIds = [...new Set(
        animes.map((a: any) => a.createdBy?.toString()).filter(Boolean)
      )]
      let subAdminIdSet = new Set<string>()
      if (creatorIds.length > 0) {
        const validCreatorIds = creatorIds.filter((id: string) => isValidObjectId(id))
        if (validCreatorIds.length > 0) {
          const subAdmins = await db.collection('subadmins')
            .find(
              { _id: { $in: validCreatorIds.map((id: string) => toObjectId(id)) } },
              { projection: { _id: 1 } }
            )
            .toArray()
          subAdminIdSet = new Set(subAdmins.map((s: any) => s._id.toString()))
        }
      }

      const animeMap = new Map(
        animes.map((a: any) => [
          a._id.toString(),
          { ...a, isSubAdminCreated: subAdminIdSet.has(a.createdBy?.toString()) }
        ])
      )

      const populatedPages = pages.map((page: any) => ({
        ...page,
        animeId: animeMap.get(page.animeId?.toString()) || page.animeId
      }))

      return c.json(populatedPages)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CREATE
downloadPageRoutes.post('/', adminAuth, async (c) => {
  try {
    const { animeId, slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    if (!animeId || !slug) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const cleanSlug = slugify(slug)
    if (!cleanSlug) return c.json({ error: 'Invalid slug' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/create', async (db) => {
      const [existing, anime] = await Promise.all([
        db.collection('downloadpages').findOne({ slug: cleanSlug }),
        db.collection('animes').findOne({ _id: toObjectId(animeId) }),
      ])
      if (existing) return c.json({ error: 'Slug already exists' }, 400)
      if (!anime) return c.json({ error: 'Anime not found' }, 400)

      const sanitizedLinks = Array.isArray(links) ? links : []
      for (const link of sanitizedLinks) {
        if (!link.episode || !link.url) return c.json({ error: 'Each link needs episode and url' }, 400)
        if (!link.type) link.type = 'download'
      }

      // 🔒 Page number server decide karega, client ka value ignore
      const existingPages = await db.collection('downloadpages')
        .find({ animeId: toObjectId(animeId) }, { projection: { episodeNumber: 1 } })
        .toArray()
      const maxPageNo = existingPages.reduce(
        (m: number, p: any) => Math.max(m, Number(p.episodeNumber) || 0), 0
      )
      const nextPageNo = Math.max(existingPages.length, maxPageNo) + 1

      const admin = c.get('admin')
      const isMainAdmin = admin.role !== 'subadmin'

      const requestedNo = Number(episodeNumber)
      const finalPageNo =
        isMainAdmin && Number.isInteger(requestedNo) && requestedNo >= 1
          ? requestedNo
          : nextPageNo

      const now = new Date()
      const page = {
        animeId: toObjectId(animeId),
        slug: cleanSlug,
        title: title || 'Download',
        episodeNumber: finalPageNo,
        links: sanitizedLinks,
        isHidden: false,
        defaultPlayerMode: defaultPlayerMode === 'custom' ? 'custom' : 'default',
        createdAt: now,
        updatedAt: now,
      }
      const result = await db.collection('downloadpages').insertOne(page)

      if (sanitizedLinks.length > 0) {
        await syncPageDerivedData(db, result.insertedId.toString())
      }

      await invalidateDownloadPageCache(c, animeId, cleanSlug)

      return c.json(page, 201)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE
downloadPageRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/update', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) }) as IDownloadPage | null
      if (!page) return c.json({ error: 'Page not found' }, 404)

      const updateData: any = { updatedAt: new Date() }
      if (slug && slug !== page.slug) {
        const cleanSlug = slugify(slug)
        if (!cleanSlug) return c.json({ error: 'Invalid slug' }, 400)
        const existing = await db.collection('downloadpages').findOne({ slug: cleanSlug })
        if (existing) return c.json({ error: 'Slug already exists' }, 400)
        updateData.slug = cleanSlug
      }
      if (title !== undefined) updateData.title = title

      const admin = c.get('admin')
      if (episodeNumber !== undefined && admin.role !== 'subadmin') {
        const n = Number(episodeNumber)
        if (!Number.isInteger(n) || n < 1) {
          return c.json({ error: 'episodeNumber must be at least 1' }, 400)
        }
        updateData.episodeNumber = n
      }

      if (links) {
        for (const link of links) {
          if (!link.episode || !link.url) return c.json({ error: 'Each link needs episode and url' }, 400)
          if (!link.type) link.type = 'download'
        }
        updateData.links = links
      }
      if (defaultPlayerMode !== undefined) {
        updateData.defaultPlayerMode = defaultPlayerMode === 'custom' ? 'custom' : 'default'
      }

      const updated = await db.collection('downloadpages').findOneAndUpdate(
        { _id: toObjectId(id) }, { $set: updateData }, { returnDocument: 'after' }
      )

      if (links) {
        await syncPageDerivedData(db, id!)
      }

      await invalidateDownloadPageCache(c, (page as any).animeId?.toString(), updateData.slug || page.slug)

      return c.json(updated)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// TOGGLE HIDE / UNHIDE
downloadPageRoutes.patch('/:id/toggle-hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/toggle-hide', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) }) as IDownloadPage | null
      if (!page) return c.json({ error: 'Page not found' }, 404)

      const newHiddenState = !(page as any).isHidden
      const updated = await db.collection('downloadpages').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { isHidden: newHiddenState, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )

      await invalidateDownloadPageCache(c, (page as any).animeId?.toString(), (page as any).slug)

      return c.json(updated)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PLAYER MODE TOGGLE
downloadPageRoutes.patch('/:id/player-mode', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const { defaultPlayerMode } = await c.req.json()
    if (defaultPlayerMode !== 'custom' && defaultPlayerMode !== 'default') {
      return c.json({ error: 'defaultPlayerMode must be "custom" or "default"' }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/player-mode', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
      if (!page) return c.json({ error: 'Page not found' }, 404)

      const updated = await db.collection('downloadpages').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { defaultPlayerMode, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return c.json(updated)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE
downloadPageRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/delete', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
      if (!page) return c.json({ error: 'Page not found' }, 404)

      const animeId = (page as any).animeId
      await db.collection('downloadpages').deleteOne({ _id: toObjectId(id) })

      if (animeId) {
        await syncAnimeEpisodeCountFromAnime(db, animeId)
      }

      await invalidateDownloadPageCache(c, animeId?.toString(), (page as any).slug)

      return c.json({ success: true })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// SET PRIMARY EPISODE COUNT
downloadPageRoutes.post('/:id/set-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/set-primary', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
      if (!page) return c.json({ error: 'Page not found' }, 404)

      await db.collection('downloadpages').updateMany(
        { animeId: (page as any).animeId },
        { $set: { isPrimaryForEpisodeCount: false } }
      )
      await db.collection('downloadpages').updateOne(
        { _id: toObjectId(id) },
        { $set: { isPrimaryForEpisodeCount: true } }
      )

      const newCount = await syncAnimeEpisodeCountFromAnime(db, (page as any).animeId)

      return c.json({ success: true, currentEpisode: newCount })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UNSET PRIMARY EPISODE COUNT
downloadPageRoutes.post('/:id/unset-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'dlPages/unset-primary', async (db) => {
      const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
      if (!page) return c.json({ error: 'Page not found' }, 404)

      await db.collection('downloadpages').updateOne(
        { _id: toObjectId(id) },
        { $set: { isPrimaryForEpisodeCount: false, updatedAt: new Date() } }
      )

      const newCount = await syncAnimeEpisodeCountFromAnime(db, (page as any).animeId)

      return c.json({ success: true, currentEpisode: newCount })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================================
// CACHED VERSION — SABSE HIGH-TRAFFIC ROUTE
// prefetchR2Providers ab withDb ke andar hai (db pehla arg leta hai)
// ============================================================================
downloadPageRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')

    const response = await withEdgeCache(c, 300, async () => {
      const { page, animeData, providerMap } = await withDb(
        c.env.MONGODB_URI, c.env.MONGODB_DB, 'downloadPage', async (db) => {
          const page = await db.collection('downloadpages').findOne({ slug }) as IDownloadPage | null
          if (!page || (page as any).isHidden) throw { __notFound: true }

          const animeIdStr = (page as any).animeId?.toString()
          const animeData = animeIdStr && isValidObjectId(animeIdStr)
            ? await db.collection('animes').findOne(
                { _id: toObjectId(animeIdStr) },
                { projection: { title: 1, thumbnail: 1, description: 1, seoDescription: 1, contentType: 1 } }
              )
            : null

          const providerMap = await prefetchR2Providers(
            db,
            ((page as any).links || []).map((l: any) => l.url)
          )

          return { page, animeData, providerMap }
        }
      )

      const allLinks = (page as any).links || []

      const signedLinks = await Promise.all(
        allLinks.map(async (link: any) => {
          if (isProtectedDomainSync(link.url, providerMap)) {
            try {
              const signed = await signDownloadUrlBatch(
                link.url,
                {
                  R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
                  R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
                  R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
                  ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
                },
                link.type,
                providerMap
              )
              return { ...link, url: signed }
            } catch (e) {
              console.error('Signing failed for link:', link.url, e)
              return link
            }
          }
          return link
        })
      )

      return {
        ...(page as any),
        links: signedLinks,
        animeId: animeData || (page as any).animeId
      }
    })

    return response
  } catch (err: any) {
    if (err?.__notFound) return c.json({ error: 'Page not found' }, 404)
    return c.json({ error: err.message }, 500)
  }
})

export default downloadPageRoutes