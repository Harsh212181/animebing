 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne,
  deleteOne, deleteMany, countDocuments,
  toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IAnime, IEpisode, IChapter, IReport, ISocialMedia } from '../models/types'
import { ObjectId } from 'mongodb'

const adminRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ HELPER: sub-admin (animeAccess:'own') ke owned anime IDs laao ============
async function getOwnedAnimeIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  // null = "koi restriction nahi" (super admin ya animeAccess:'all' wala sub-admin)
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  const createdIds = animes.map((a: any) => a._id.toString())

  // 🆕 assigned anime bhi shaamil karo
  const subAdminDoc = await db.collection('subadmins').findOne({ _id: toObjectId(admin.id) })
  const assignedIds: string[] = subAdminDoc?.assignedAnimeIds || []

  return Array.from(new Set([...createdIds, ...assignedIds]))
}

// ============ RANDOM LIKES HELPER ============
function getRandomLikes(): number {
  return Math.floor(Math.random() * 4851) + 150 
}

// ============ JWT CREATE ============
async function createJWT(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
  }))
  const keyData = encoder.encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${header}.${body}`))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${header}.${body}.${sigB64}`
}

// ============ LOGIN ============
adminRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (username !== c.env.ADMIN_USER || password !== c.env.ADMIN_PASS) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401)
    }
    const token = await createJWT({ id: 'admin', username, role: 'admin' }, c.env.JWT_SECRET)
    return c.json({ success: true, token })
  } catch (err: any) {
    return c.json({ success: false, error: 'Login failed' }, 500)
  }
})

// ============ ME ============
adminRoutes.get('/me', adminAuth, (c) => {
  const admin = c.get('admin')
  return c.json({ success: true, admin })
})

// ============ USER INFO ============
adminRoutes.get('/user-info', adminAuth, (c) => {
  return c.json({ username: c.env.ADMIN_USER, email: '' })
})

// ============ ANIME LIST ============
adminRoutes.get('/anime-list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const status = c.req.query('status')
    const contentType = c.req.query('contentType')
    const filter: any = {}
    if (status && status !== 'All') filter.status = status
    if (contentType && contentType !== 'All') filter.contentType = contentType
    // Sub-admin with 'own' access → sirf apna anime dekhe (createdBy + assigned)
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      const ownedIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
      const objectIds = (ownedIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))
      filter._id = { $in: objectIds }
      delete filter.createdBy
    }
    const animes = await findMany<IAnime>('animes', filter, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADD ANIME (FIXED) ============
adminRoutes.post('/add-anime', adminAuth, requirePermission('add-anime'), async (c) => {
  try {
    const admin = c.get('admin')
    const {
      title, description, thumbnail, status, subDubStatus, genreList, releaseYear, contentType,
      seoTitle, seoDescription, seoKeywords, slug: providedSlug
    } = await c.req.json()

    const existing = await findOne('animes', { title }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Anime/Movie already exists' }, 400)

    let slug = (providedSlug && providedSlug.trim())
      ? providedSlug.trim()
      : title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
    const slugExists = await findOne('animes', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (slugExists) slug = `${slug}-${Date.now()}`

    const finalSeoTitle = (seoTitle && seoTitle.trim()) || `Watch ${title} Online in ${subDubStatus} | AnimeBing`
    const finalSeoDescription = (seoDescription && seoDescription.trim()) || `Watch ${title} online in ${subDubStatus}. HD quality streaming and downloads.`
    const finalSeoKeywords = (seoKeywords && seoKeywords.trim()) || ''

    // Random likes between 150 and 5000
    const randomLikes = getRandomLikes()
    // Random dislikes between 0 and 50
    const randomDislikes = Math.floor(Math.random() * 51)

    const anime = {
      title, description, thumbnail,
      status: status || 'Ongoing',
      subDubStatus, genreList, releaseYear,
      contentType: contentType || 'Anime',
      slug,
      seoTitle: finalSeoTitle,
      seoDescription: finalSeoDescription,
      seoKeywords: finalSeoKeywords,
      likes: randomLikes,
      dislikes: randomDislikes,
      views: 0,
      totalVotes: randomLikes + randomDislikes,
      monthlyLikes: Math.floor(randomLikes * 0.3),
      weeklyLikes: Math.floor(randomLikes * 0.1),
      featured: false, featuredOrder: 0,
      isHidden: false, lastContentAdded: new Date(),
      isBlocked: false,
      createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByUsername: admin.username
    }

    await insertOne('animes', anime, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: `${contentType || 'Anime'} added!`, anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ EDIT ANIME (FIXED - WHITELIST APPROACH) ============
adminRoutes.put('/edit-anime/:id', adminAuth, requirePermission('edit-anime'), async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const body = await c.req.json()

    // ✅ sirf allowed fields hi update honge, currentEpisode/totalEpisodes
    // is route se kabhi touch nahi honge — wo sirf episode-status route se update hote hain
    const allowedFields = [
      'title', 'description', 'thumbnail', 'bannerImage', 'status', 'subDubStatus',
      'genreList', 'releaseYear', 'contentType', 'seoTitle', 'seoDescription',
      'seoKeywords', 'slug', 'featured', 'featuredOrder', 'isHidden'
    ]
    const updateData: any = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key]
    }

    const anime = await updateOne('animes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Updated successfully!', anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ DELETE ANIME ============
adminRoutes.delete('/delete-anime', adminAuth, requirePermission('delete-anime'), async (c) => {
  try {
    const { id } = await c.req.json()
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('episodes', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('reports', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Deleted successfully!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ TOGGLE HIDE ============
adminRoutes.patch('/toggle-hide/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const anime = await findOne<IAnime>('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    const newHidden = !anime.isHidden
    await updateOne('animes', { _id: toObjectId(id) }, { isHidden: newHidden }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: `Anime ${newHidden ? 'hidden' : 'visible'} successfully`, isHidden: newHidden })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ EPISODE STATUS ============
adminRoutes.patch('/anime/:id/episode-status', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { totalEpisodes, currentEpisode } = await c.req.json()
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const updateData: any = { lastContentAdded: new Date() }
    if (totalEpisodes !== undefined) updateData.totalEpisodes = totalEpisodes
    if (currentEpisode !== undefined) updateData.currentEpisode = currentEpisode
    const anime = await updateOne('animes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Episode status updated!', anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ SYNC EPISODE COUNT ============
adminRoutes.post('/anime/:id/sync-episode-count', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const episodeCount = await countDocuments('episodes', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await updateOne('animes', { _id: toObjectId(id) }, { currentEpisode: episodeCount, lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: `Synced to ${episodeCount} episodes`, anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ EDIT EPISODE ============
adminRoutes.put('/edit-episode/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { title, downloadLinks, secureFileReference, session } = await c.req.json()

    if (downloadLinks !== undefined) {
      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) return c.json({ error: 'At least one download link required' }, 400)
      if (downloadLinks.length > 5) return c.json({ error: 'Maximum 5 download links allowed' }, 400)
      for (let i = 0; i < downloadLinks.length; i++) {
        if (!downloadLinks[i].name || !downloadLinks[i].url) return c.json({ error: `Link ${i + 1} needs name and url` }, 400)
      }
    }

    const updateData: any = {}
    if (typeof title !== 'undefined') updateData.title = title
    if (typeof secureFileReference !== 'undefined') updateData.secureFileReference = secureFileReference
    if (typeof session !== 'undefined') updateData.session = session
    if (downloadLinks !== undefined) {
      updateData.downloadLinks = downloadLinks.map((link: any, i: number) => ({
        name: link.name || `Download Link ${i + 1}`,
        url: link.url, quality: link.quality || '', type: link.type || 'direct'
      }))
    }

    const episode = await updateOne('episodes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB) as IEpisode | null
    if (!episode) return c.json({ error: 'Episode not found' }, 404)
    await updateOne('animes', { _id: episode.animeId }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Episode updated!', episode })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ EDIT CHAPTER ============
adminRoutes.put('/edit-chapter/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { title, downloadLinks, secureFileReference, session } = await c.req.json()

    if (downloadLinks !== undefined) {
      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) return c.json({ error: 'At least one download link required' }, 400)
      if (downloadLinks.length > 5) return c.json({ error: 'Maximum 5 download links allowed' }, 400)
      for (let i = 0; i < downloadLinks.length; i++) {
        if (!downloadLinks[i].name || !downloadLinks[i].url) return c.json({ error: `Link ${i + 1} needs name and url` }, 400)
      }
    }

    const updateData: any = {}
    if (typeof title !== 'undefined') updateData.title = title
    if (typeof secureFileReference !== 'undefined') updateData.secureFileReference = secureFileReference
    if (typeof session !== 'undefined') updateData.session = session
    if (downloadLinks !== undefined) {
      updateData.downloadLinks = downloadLinks.map((link: any, i: number) => ({
        name: link.name || `Download Link ${i + 1}`,
        url: link.url, quality: link.quality || '', type: link.type || 'direct'
      }))
    }

    const chapter = await updateOne('chapters', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB) as IChapter | null
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404)
    await updateOne('animes', { _id: chapter.mangaId }, { lastContentAdded: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Chapter updated!', chapter })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ GET EPISODE ============
adminRoutes.get('/episode/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const episode = await findOne<IEpisode>('episodes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!episode) return c.json({ error: 'Episode not found' }, 404)
    return c.json({ success: true, episode })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ GET CHAPTER ============
adminRoutes.get('/chapter/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const chapter = await findOne<IChapter>('chapters', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404)
    return c.json({ success: true, chapter })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ REPORTS "UNSEEN" PENDING COUNT (red dot ke liye) ============
// Query param `since` (ISO date string, optional): jab diya jaye to sirf us
// waqt ke BAAD create hue Pending reports count hote hain — isse red dot
// tab tak hi dikhta hai jab tak admin ne Reports tab open (seen) nahi kiya.
// `since` na diya jaye to purana behaviour (sab Pending reports count) chalta hai.
adminRoutes.get('/reports/pending-count', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const sinceParam = c.req.query('since')
    const since = sinceParam ? new Date(sinceParam) : null
    const hasValidSince = !!(since && !isNaN(since.getTime()))

    // ✅ Sub-admin (animeAccess:'own') → sirf apne anime ke pending episode reports count
    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (ownedAnimeIds !== null) {
      if (ownedAnimeIds.length === 0) {
        return c.json({ success: true, count: 0 })
      }
      const objectIds = ownedAnimeIds.map((id: string) => toObjectId(id))
      const filter: any = {
        type: 'episode',
        status: 'Pending',
        animeId: { $in: objectIds }
      }
      if (hasValidSince) filter.createdAt = { $gt: since }
      const count = await db.collection('reports').countDocuments(filter)
      return c.json({ success: true, count })
    }

    // Super admin ya animeAccess:'all' wala sub-admin → sab pending reports
    const filter: any = { status: 'Pending' }
    if (hasValidSince) filter.createdAt = { $gt: since }
    const count = await db.collection('reports').countDocuments(filter)
    return c.json({ success: true, count })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ REPORTS (role-based filter + sub-admin username) ============
adminRoutes.get('/reports', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ Sub-admin (animeAccess:'own') → sirf apne anime ke reports
    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const reports = await db.collection('reports')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    // 🔒 Sub-admin (own access) ke liye filter: SIRF apne anime ke EPISODE reports.
    // Contact form reports ab kisi bhi sub-admin ko nahi dikhenge — sirf super admin ko.
    let filteredReports = reports
    if (ownedAnimeIds !== null) {
      const ownedIdSet = new Set(ownedAnimeIds)
      filteredReports = reports.filter((r: any) => {
        return r.type === 'episode' && r.animeId && ownedIdSet.has(r.animeId.toString())
      })
    }

    const animeIds = filteredReports
      .filter((r: any) => r.type === 'episode' && r.animeId)
      .map((r: any) => {
        try { return new ObjectId(r.animeId.toString()) }
        catch { return null }
      })
      .filter(Boolean)

    const animeMap: Record<string, { _id: any; title: string; thumbnail: string; createdByUsername?: string }> = {}

    if (animeIds.length > 0) {
      const animes = await db.collection('animes')
        .find(
          { _id: { $in: animeIds as any } },
          { projection: { title: 1, thumbnail: 1, createdByUsername: 1 } }
        )
        .toArray()

      animes.forEach((anime: any) => {
        animeMap[anime._id.toString()] = {
          _id: anime._id,
          title: anime.title,
          thumbnail: anime.thumbnail || null,
          createdByUsername: anime.createdByUsername || null
        }
      })
    }

    const enrichedReports = filteredReports.map((report: any) => {
      if (report.type === 'episode' && report.animeId) {
        const animeIdStr = report.animeId.toString()
        const anime = animeMap[animeIdStr]
        return {
          ...report,
          animeId: anime
            ? { _id: anime._id, title: anime.title, thumbnail: anime.thumbnail }
            : { _id: report.animeId, title: 'Unknown Anime', thumbnail: null },
          subAdminUsername: anime?.createdByUsername || null   // 👈 main admin ke liye
        }
      }
      return report
    })

    return c.json(enrichedReports)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.put('/reports/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { status, adminResponse } = await c.req.json()
    const admin = c.get('admin')
    const updateData: any = { status }
    if (adminResponse) { updateData.adminResponse = adminResponse; updateData.responseDate = new Date() }
    if (status === 'Fixed') { updateData.resolvedAt = new Date(); updateData.resolvedBy = admin.id }
    const report = await updateOne('reports', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Report updated!', report })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.delete('/reports/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const report = await findOne('reports', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!report) return c.json({ error: 'Report not found' }, 404)
    await deleteOne('reports', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Report deleted!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.post('/reports/bulk-delete', adminAuth, async (c) => {
  try {
    const { reportIds } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('reports').deleteMany({
      _id: { $in: reportIds.map((rid: string) => toObjectId(rid)) }
    })
    return c.json({ success: true, message: `${reportIds.length} reports deleted!` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ SOCIAL MEDIA ============
adminRoutes.get('/social-media', adminAuth, async (c) => {
  try {
    const links = await findMany<ISocialMedia>('socialmedia', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.put('/social-media/:platform', adminAuth, async (c) => {
  try {
    const platform = c.req.param('platform')
    const { url, isActive } = await c.req.json()
    const link = await updateOne('socialmedia', { platform }, { url, isActive }, c.env.MONGODB_URI, c.env.MONGODB_DB, true)
    return c.json(link)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ANALYTICS ============
adminRoutes.get('/analytics', adminAuth, async (c) => {
  try {
    const [totalAnimes, totalMovies, totalManga, totalEpisodes, totalChapters, totalReports, pendingReports] = await Promise.all([
      countDocuments('animes', { contentType: 'Anime' }, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('animes', { contentType: 'Movie' }, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('animes', { contentType: 'Manga' }, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('episodes', {}, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('chapters', {}, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('reports', {}, c.env.MONGODB_URI, c.env.MONGODB_DB),
      countDocuments('reports', { status: 'Pending' }, c.env.MONGODB_URI, c.env.MONGODB_DB),
    ])
    return c.json({
      totalAnimes, totalMovies, totalManga,
      totalEpisodes, totalChapters,
      totalReports, pendingReports,
      todayUsers: 0, totalUsers: 0,
      todayEarnings: 0, totalEarnings: 0,
      todayPageViews: 0, totalPageViews: 0
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ PROTECTED ALIAS ROUTES ============
adminRoutes.get('/protected/anime-list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const status = c.req.query('status')
    const contentType = c.req.query('contentType')
    const filter: any = {}
    if (status && status !== 'All') filter.status = status
    if (contentType && contentType !== 'All') filter.contentType = contentType
    // Sub-admin with 'own' access → sirf apna anime dekhe (createdBy + assigned)
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      const ownedIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
      const objectIds = (ownedIds || []).filter(isValidObjectId).map((aid: string) => toObjectId(aid))
      filter._id = { $in: objectIds }
      delete filter.createdBy
    }
    const animes = await findMany<IAnime>('animes', filter, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.delete('/protected/delete-anime', adminAuth, requirePermission('delete-anime'), async (c) => {
  try {
    const { id } = await c.req.json()
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('episodes', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('reports', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Deleted successfully!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ PROTECTED EDIT ANIME (FIXED - WHITELIST APPROACH) ============
adminRoutes.put('/protected/edit-anime/:id', adminAuth, requirePermission('edit-anime'), async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const body = await c.req.json()

    // ✅ sirf allowed fields hi update honge, currentEpisode/totalEpisodes
    // is route se kabhi touch nahi honge — wo sirf episode-status route se update hote hain
    const allowedFields = [
      'title', 'description', 'thumbnail', 'bannerImage', 'status', 'subDubStatus',
      'genreList', 'releaseYear', 'contentType', 'seoTitle', 'seoDescription',
      'seoKeywords', 'slug', 'featured', 'featuredOrder', 'isHidden'
    ]
    const updateData: any = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key]
    }

    const anime = await updateOne('animes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Updated successfully!', anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.patch('/protected/toggle-hide/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const anime = await findOne<IAnime>('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    const newHidden = !anime.isHidden
    await updateOne('animes', { _id: toObjectId(id) }, { isHidden: newHidden }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: `Anime ${newHidden ? 'hidden' : 'visible'} successfully`, isHidden: newHidden })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

adminRoutes.patch('/protected/anime/:id/episode-status', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const { totalEpisodes, currentEpisode } = await c.req.json()
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const updateData: any = { lastContentAdded: new Date() }
    if (totalEpisodes !== undefined) updateData.totalEpisodes = totalEpisodes
    if (currentEpisode !== undefined) updateData.currentEpisode = currentEpisode
    const anime = await updateOne('animes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Episode status updated!', anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default adminRoutes