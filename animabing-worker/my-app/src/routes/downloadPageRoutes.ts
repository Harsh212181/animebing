import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IDownloadPage } from '../models/types'
import { syncPageDerivedData, syncAnimeEpisodeCountFromAnime } from '../services/episodeSyncService'
import { prefetchR2Providers, isProtectedDomainSync, signDownloadUrlBatch } from '../services/signedUrlService'

const downloadPageRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

// ============ HELPER: sub-admin (animeAccess:'own') ke owned anime IDs laao ============
// ✅ FIX: ab `db` accept karta hai, apna alag connection nahi kholta
async function getOwnedAnimeIds(admin: any, db: any): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  return animes.map((a: any) => a._id.toString())
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
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const pages = await db.collection('downloadpages')
      .find({ animeId: toObjectId(animeId) })
      .sort({ episodeNumber: 1 })
      .toArray()
    return c.json(pages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL (admin) — anime details ke saath populate. 4 alag connections
// (getOwnedAnimeIds + pages + animes + subadmins) ab 1 me combine.
downloadPageRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CREATE — 2 findOne calls (slug + anime exists) combined into 1 connection
downloadPageRoutes.post('/', adminAuth, async (c) => {
  try {
    const { animeId, slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    if (!animeId || !slug) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const cleanSlug = slugify(slug)
    if (!cleanSlug) return c.json({ error: 'Invalid slug' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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

    const now = new Date()
    const page = {
      animeId: toObjectId(animeId),
      slug: cleanSlug,
      title: title || 'Download',
      episodeNumber: episodeNumber || 1,
      links: sanitizedLinks,
      isHidden: false,
      defaultPlayerMode: defaultPlayerMode === 'custom' ? 'custom' : 'default',
      createdAt: now,
      updatedAt: now,
    }
    const result = await db.collection('downloadpages').insertOne(page)

    if (sanitizedLinks.length > 0) {
      // ⚠️ episodeSyncService.ts abhi bhi apna alag connection kholta hai —
      // isko fix karna agla step ho sakta hai
      await syncPageDerivedData(result.insertedId.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json(page, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE — page findOne + slug-exists check + update combined into 1 connection
downloadPageRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
    if (episodeNumber !== undefined) {
      if (episodeNumber < 1) return c.json({ error: 'episodeNumber must be at least 1' }, 400)
      updateData.episodeNumber = episodeNumber
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
      await syncPageDerivedData(id!, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ TOGGLE HIDE / UNHIDE — 2 calls combined into 1 connection
downloadPageRoutes.patch('/:id/toggle-hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) }) as IDownloadPage | null
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const newHiddenState = !(page as any).isHidden
    const updated = await db.collection('downloadpages').findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: { isHidden: newHiddenState, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ Page-level YouTube player mode toggle — 2 calls combined into 1 connection
downloadPageRoutes.patch('/:id/player-mode', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const { defaultPlayerMode } = await c.req.json()
    if (defaultPlayerMode !== 'custom' && defaultPlayerMode !== 'default') {
      return c.json({ error: 'defaultPlayerMode must be "custom" or "default"' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const updated = await db.collection('downloadpages').findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: { defaultPlayerMode, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE — 2 calls combined into 1 connection (sync service still separate)
downloadPageRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const animeId = (page as any).animeId
    await db.collection('downloadpages').deleteOne({ _id: toObjectId(id) })

    if (animeId) {
      await syncAnimeEpisodeCountFromAnime(animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ Multi-session "primary" mark — 3 calls combined into 1 connection
downloadPageRoutes.post('/:id/set-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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

    const newCount = await syncAnimeEpisodeCountFromAnime((page as any).animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, currentEpisode: newCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ primary status hataao — 2 calls combined into 1 connection
downloadPageRoutes.post('/:id/unset-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const page = await db.collection('downloadpages').findOne({ _id: toObjectId(id) })
    if (!page) return c.json({ error: 'Page not found' }, 404)

    await db.collection('downloadpages').updateOne(
      { _id: toObjectId(id) },
      { $set: { isPrimaryForEpisodeCount: false, updatedAt: new Date() } }
    )

    const newCount = await syncAnimeEpisodeCountFromAnime((page as any).animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, currentEpisode: newCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================================
// ✅ GET BY SLUG — SABSE HIGH-TRAFFIC ROUTE (har visitor jo download page
// kholta hai isko hit karta hai). Pehle: page findOne + anime findOne + HAR
// LINK ke liye 2 alag DB calls (isProtectedDomain + signDownloadUrl) — matlab
// 5 links wale page ke liye ~12 MongoDB connections EK REQUEST me.
//
// Ab: page + anime = 1 connection (parallel). Links ke liye saare providers
// EK BAAR me prefetch (`prefetchR2Providers`) — chahe kitne bhi links hon,
// sirf 1 extra query. Baaki sab (isProtectedDomainSync, signDownloadUrlBatch)
// DB-free hain (sirf crypto/decryption).
// ============================================================================
downloadPageRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const page = await db.collection('downloadpages').findOne({ slug }) as IDownloadPage | null
    if (!page) return c.json({ error: 'Page not found' }, 404)
    if ((page as any).isHidden) return c.json({ error: 'Page not found' }, 404)

    const animeIdStr = (page as any).animeId?.toString()
    const animeData = animeIdStr && isValidObjectId(animeIdStr)
      ? await db.collection('animes').findOne(
          { _id: toObjectId(animeIdStr) },
          { projection: { title: 1, thumbnail: 1, description: 1, seoDescription: 1, contentType: 1 } }
        )
      : null

    const allLinks = (page as any).links || []
    const providerMap = await prefetchR2Providers(
      allLinks.map((l: any) => l.url),
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

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

    return c.json({
      ...(page as any),
      links: signedLinks,
      animeId: animeData || (page as any).animeId
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default downloadPageRoutes