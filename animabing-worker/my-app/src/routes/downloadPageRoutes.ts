import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, findOne, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IDownloadPage } from '../models/types'
import { syncPageDerivedData, syncAnimeEpisodeCountFromAnime } from '../services/episodeSyncService'   // ✅ UPDATED: syncPageDerivedData (combined helper) use kiya

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
    .replace(/[\u0300-\u036f]/g, '')   // accents strip
    .replace(/[''"""]/g, '')          // apostrophes/quotes remove
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // baaki sab -> hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
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
    const { animeId, slug, title, episodeNumber, links } = await c.req.json()

    // Required fields: animeId and slug
    if (!animeId || !slug) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    if (!isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)

    const cleanSlug = slugify(slug)   // ✅ NEW
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

    // episodeNumber default to 1 if not provided
    const page = { 
      animeId: toObjectId(animeId), 
      slug: cleanSlug,   // ✅ raw slug ki jagah cleanSlug
      title: title || 'Download', 
      episodeNumber: episodeNumber || 1, 
      links: sanitizedLinks, 
      isHidden: false 
    }
    const result = await insertOne('downloadpages', page, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ agar links ke saath page bana hai toh anime.currentEpisode aur episode titles sync karo
    // ✅ UPDATED: dono ab ek hi combined helper se sync hote hain
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
    const { slug, title, episodeNumber, links } = await c.req.json()

    const page = await findOne<IDownloadPage>('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    const updateData: any = {}
    if (slug && slug !== page.slug) {
      const cleanSlug = slugify(slug)   // ✅ NEW
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

    const updated = await updateOne('downloadpages', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ agar links change hue hain (add YA remove/kam bhi) toh anime.currentEpisode
    // aur episode titles dobara SCRATCH se sync karo — isliye ye ghatna/badhna dono handle karta hai
    // ✅ UPDATED: dono ab ek hi combined helper se sync hote hain
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

// DELETE
downloadPageRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const page = await findOne('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!page) return c.json({ error: 'Page not found' }, 404)

    // ✅ animeId pehle nikaal lo — delete ke baad page hi nahi rahega toh animeId access nahi ho payega
    const animeId = (page as any).animeId

    await deleteOne('downloadpages', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ NEW: page delete hone ke baad currentEpisode dobara calculate karo (poore anime
    // ke baaki bache hue pages ke links se) — taaki agar sabse bada episode wala page hi
    // delete hua ho, toh currentEpisode automatically kam ho jaye aur detail page turant
    // sahi "Ch X" / "EP X" dikhaye
    // (Page delete ho chuka hai isliye syncPageDerivedData/syncEpisodeTitleFromDownloadPage
    // use nahi kar sakte — wo pageId maangte hain. Sirf currentEpisode hi anime-level se sync hota hai.)
    if (animeId) {
      await syncAnimeEpisodeCountFromAnime(animeId, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.json({ success: true })
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

    // ✅ Public page ke liye hidden pages block karo
    if ((page as any).isHidden) {
      return c.json({ error: 'Page not found' }, 404)
    }

    // ✅ animeId se anime fetch karo — thumbnail aur description ke liye
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

    // ✅ Backward compatible format — React component ke liye same structure
    return c.json({
      ...(page as any),
      animeId: animeData || (page as any).animeId
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default downloadPageRoutes