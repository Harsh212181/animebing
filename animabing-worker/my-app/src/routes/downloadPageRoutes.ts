 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IDownloadPage } from '../models/types'
import { syncPageDerivedData, syncAnimeEpisodeCountFromAnime } from '../services/episodeSyncService'
import { signDownloadUrl, isProtectedDomain } from '../services/signedUrlService'

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

// ============ HELPER: sub-admin (animeAccess:'own') ke owned anime IDs laao (string[]) ============
// null = "koi restriction nahi" (super admin ya animeAccess:'all' wala sub-admin)
async function getOwnedAnimeIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const db = await getDb(mongoUri, dbName)
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
    const pages = await findMany<IDownloadPage>('downloadpages', { animeId: toObjectId(animeId) }, { sort: { episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(pages)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET ALL (admin) — anime details ke saath populate
// ✅ Sub-admin (animeAccess:'own') ko sirf apne banaye hue anime ke download pages dikhenge
downloadPageRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ Sub-admin ke owned anime IDs (null = no restriction)
    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Agar sub-admin (own access) hai aur uska koi anime hi nahi hai, to seedha empty return karo
    if (ownedAnimeIds !== null && ownedAnimeIds.length === 0) {
      return c.json([])
    }

    const filter: any = {}
    if (ownedAnimeIds !== null) {
      filter.animeId = { $in: ownedAnimeIds.map((id: string) => toObjectId(id)) }
    }

    const pages = await findMany<IDownloadPage>(
      'downloadpages', filter,
      { sort: { createdAt: -1 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    if (!pages || pages.length === 0) return c.json([])

    const animeIds = [...new Set(
      pages
        .map((p: any) => p.animeId?.toString())
        .filter(Boolean)
    )]

    const animes = await db
      .collection('animes')
      .find(
        { _id: { $in: animeIds.map((id: string) => toObjectId(id)) } },
        { projection: { title: 1, contentType: 1, subDubStatus: 1, status: 1, thumbnail: 1, isHidden: 1, createdByUsername: 1, createdBy: 1 } }
      )
      .toArray()

    // ✅ Reliable sub-admin detection: 'subadmins' collection se verify karo
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

// CREATE — ✅ Allows creating a page with no links (links field optional)
downloadPageRoutes.post('/', adminAuth, async (c) => {
  try {
    const { animeId, slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    // Required fields: animeId and slug
    if (!animeId || !slug) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const cleanSlug = slugify(slug)
    if (!cleanSlug) return c.json({ error: 'Invalid slug' }, 400)

    const existing = await findOne('downloadpages', { slug: cleanSlug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Slug already exists' }, 400)

    const anime = await findOne('animes', { _id: toObjectId(animeId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 400)

    // ✅ links optional – if not provided, use empty array
    const sanitizedLinks = Array.isArray(links) ? links : []

    // Validate each link if any
    for (const link of sanitizedLinks) {
      if (!link.episode || !link.url) return c.json({ error: 'Each link needs episode and url' }, 400)
      if (!link.type) link.type = 'download'
    }

    const page = { 
      animeId: toObjectId(animeId), 
      slug: cleanSlug,
      title: title || 'Download', 
      episodeNumber: episodeNumber || 1, 
      links: sanitizedLinks, 
      isHidden: false,
      defaultPlayerMode: defaultPlayerMode === 'custom' ? 'custom' : 'default'   // ✅ NEW — default = normal YouTube button
    }
    const result = await insertOne('downloadpages', page, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (sanitizedLinks.length > 0) {
      await syncPageDerivedData(result.insertedId.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

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
    const { slug, title, episodeNumber, links, defaultPlayerMode } = await c.req.json()

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const updateData: any = {}
    if (slug && slug !== page.slug) {
      const cleanSlug = slugify(slug)
      if (!cleanSlug) return c.json({ error: 'Invalid slug' }, 400)
      const existing = await findOne('downloadpages', { slug: cleanSlug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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
      updateData.defaultPlayerMode = defaultPlayerMode === 'custom' ? 'custom' : 'default'   // ✅ NEW
    }

    const updated = await updateOne('downloadpages', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (links) {
      await syncPageDerivedData(id!, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ TOGGLE HIDE / UNHIDE
downloadPageRoutes.patch('/:id/toggle-hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const newHiddenState = !(page as any).isHidden
    const updated = await updateOne(
      'downloadpages',
      { _id: toObjectId(id) },
      { isHidden: newHiddenState },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ NEW — Page-level YouTube player mode toggle (Custom ↔ Default) — direct from card, no edit form
downloadPageRoutes.patch('/:id/player-mode', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const { defaultPlayerMode } = await c.req.json()
    if (defaultPlayerMode !== 'custom' && defaultPlayerMode !== 'default') {
      return c.json({ error: 'defaultPlayerMode must be "custom" or "default"' }, 400)
    }

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const updated = await updateOne(
      'downloadpages',
      { _id: toObjectId(id) },
      { defaultPlayerMode },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
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

    const animeId = (page as any).animeId

    await deleteOne('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (animeId) {
      await syncAnimeEpisodeCountFromAnime(animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ NEW — Multi-session anime ke liye: is page ko "primary" mark karo taaki
// anime.currentEpisode badge SIRF isi page ke max episode se calculate ho,
// dusre sessions ke bade numbers usse overwrite na karein
downloadPageRoutes.post('/:id/set-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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

// ✅ NEW — primary status hataao (wapas normal "combined max" behavior pe)
downloadPageRoutes.post('/:id/unset-primary-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    await updateOne('downloadpages', { _id: toObjectId(id) }, { isPrimaryForEpisodeCount: false }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const newCount = await syncAnimeEpisodeCountFromAnime((page as any).animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, currentEpisode: newCount })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ GET BY SLUG — anime thumbnail + title bhi return karo (middleware ke liye zaruri)
downloadPageRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')

    const page = await findOne<IDownloadPage>(
      'downloadpages',
      { slug },
      c.env.MONGODB_URI,
      c.env.MONGODB_DB
    )
    if (!page) return c.json({ error: 'Page not found' }, 404)

    if ((page as any).isHidden) {
      return c.json({ error: 'Page not found' }, 404)
    }

    let animeData = null
    const animeIdStr = (page as any).animeId?.toString()

    if (animeIdStr && isValidObjectId(animeIdStr)) {
      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
      animeData = await db
        .collection('animes')
        .findOne(
          { _id: toObjectId(animeIdStr) },
          { projection: { title: 1, thumbnail: 1, description: 1, seoDescription: 1, contentType: 1 } }
        )
    }

    // Updated signed URL logic with fail-safe and extra parameters
    const signedLinks = await Promise.all(
      ((page as any).links || []).map(async (link: any) => {
        const protectedDomain = await isProtectedDomain(link.url, c.env.MONGODB_URI, c.env.MONGODB_DB)
        if (protectedDomain) {
          try {
            const signed = await signDownloadUrl(
              link.url,
              {
                R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
                R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
                R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
                ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
              },
              link.type,
              c.env.MONGODB_URI,
              c.env.MONGODB_DB
            )
            return { ...link, url: signed }
          } catch (e) {
            console.error('Signing failed for link:', link.url, e)
            return link // fail-safe — ek broken provider se poora page na tootey
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