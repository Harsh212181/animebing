import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne,
  deleteOne, deleteMany, countDocuments,
  toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IAnime, IEpisode, IChapter, IReport, ISocialMedia } from '../models/types'

const adminRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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
    const token = await createJWT({ id: 'admin', username }, c.env.JWT_SECRET)
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
    const status = c.req.query('status')
    const contentType = c.req.query('contentType')
    const filter: any = {}
    if (status && status !== 'All') filter.status = status
    if (contentType && contentType !== 'All') filter.contentType = contentType
    const animes = await findMany<IAnime>('animes', filter, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADD ANIME ============
adminRoutes.post('/add-anime', adminAuth, async (c) => {
  try {
    const { title, description, thumbnail, status, subDubStatus, genreList, releaseYear, contentType } = await c.req.json()

    const existing = await findOne('animes', { title }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) return c.json({ error: 'Anime/Movie already exists' }, 400)

    let slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
    const slugExists = await findOne('animes', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (slugExists) slug = `${slug}-${Date.now()}`

    const seoTitle = `Watch ${title} Online in ${subDubStatus} | AnimeBing`
    const seoDescription = `Watch ${title} online in ${subDubStatus}. HD quality streaming and downloads.`

    const anime = {
      title, description, thumbnail,
      status: status || 'Ongoing',
      subDubStatus, genreList, releaseYear,
      contentType: contentType || 'Anime',
      slug, seoTitle, seoDescription,
      likes: 0, dislikes: 0, views: 0,
      totalVotes: 0, monthlyLikes: 0, weeklyLikes: 0,
      featured: false, featuredOrder: 0,
      isHidden: false, lastContentAdded: new Date()
    }

    await insertOne('animes', anime, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: `${contentType || 'Anime'} added!`, anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ EDIT ANIME ============
adminRoutes.put('/edit-anime/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const updateData = await c.req.json()
    const anime = await updateOne('animes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Updated successfully!', anime })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ DELETE ANIME ============
adminRoutes.delete('/delete-anime', adminAuth, async (c) => {
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

// ============ REPORTS ============
adminRoutes.get('/reports', adminAuth, async (c) => {
  try {
    const reports = await findMany<IReport>('reports', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(reports)
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

export default adminRoutes