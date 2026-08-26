 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { insertOne, updateOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IWatchActivity } from '../models/types'

const watchActivityRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!ua) return 'unknown'
  const s = ua.toLowerCase()
  if (/ipad|tablet/.test(s)) return 'tablet'
  if (/mobi|android|iphone/.test(s)) return 'mobile'
  return 'desktop'
}

// ✅ PUBLIC — user watch/download shuru kare tabhi ek activity record banao
// ✅ DEDUP FIX — agar same IP+anime+episode+type ka record 8 second ke andar
// already bana hai aur abhi khatam (ended) nahi hua, to naya record mat banao,
// purana hi reuse karo. Yeh double-fire (dev StrictMode, quick reopen) se
// bachne ke liye hai.
watchActivityRoutes.post('/start', async (c) => {
  try {
    const body = await c.req.json()
    const { animeId, animeTitle, contentType, episodeNumber, downloadPageId, activityType, videoUrl, quality, language } = body

    if (!animeId || !isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)
    if (activityType !== 'watch' && activityType !== 'download') return c.json({ error: 'Invalid activityType' }, 400)

    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    const country = c.req.header('cf-ipcountry') || undefined

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ NEW — dedup check
    const dedupWindowMs = 8000
    const existing = await db.collection('watchactivities').findOne({
      ip,
      animeId: toObjectId(animeId),
      activityType,
      episodeNumber: episodeNumber ?? null,
      endedAt: { $exists: false },
      startedAt: { $gte: new Date(Date.now() - dedupWindowMs) },
    })

    if (existing) {
      return c.json({ success: true, activityId: existing._id.toString(), reused: true })
    }

    const activity: IWatchActivity = {
      animeId: toObjectId(animeId),
      animeTitle,
      contentType,
      episodeNumber,
      downloadPageId: downloadPageId && isValidObjectId(downloadPageId) ? toObjectId(downloadPageId) : null,
      activityType,
      videoUrl,
      quality,
      language,
      ip,
      userAgent,
      device: detectDevice(userAgent),
      country,
      watchDurationSec: 0,
      startedAt: new Date(),
    }

    const result = await insertOne('watchactivities', activity, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, activityId: result.insertedId.toString() }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ PUBLIC — watch ke dauraan har ~15s mein call hota hai, duration update karta hai
watchActivityRoutes.patch('/:id/heartbeat', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { watchDurationSec } = await c.req.json()
    if (typeof watchDurationSec !== 'number' || watchDurationSec < 0) {
      return c.json({ error: 'Invalid watchDurationSec' }, 400)
    }

    await updateOne(
      'watchactivities',
      { _id: toObjectId(id) },
      { watchDurationSec, lastHeartbeatAt: new Date() },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ PUBLIC — player close/episode switch hone par final duration save
watchActivityRoutes.patch('/:id/end', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const { watchDurationSec } = await c.req.json().catch(() => ({}))

    const updateData: any = { endedAt: new Date() }
    if (typeof watchDurationSec === 'number' && watchDurationSec >= 0) {
      updateData.watchDurationSec = watchDurationSec
    }

    await updateOne('watchactivities', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ ADMIN — activity list (filters + pagination)
watchActivityRoutes.get('/', adminAuth, async (c) => {
  try {
    const { animeId, activityType, ip, range, page = '1', limit = '50' } = c.req.query()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const filter: any = {}
    if (animeId && isValidObjectId(animeId)) filter.animeId = toObjectId(animeId)
    if (activityType === 'watch' || activityType === 'download') filter.activityType = activityType
    if (ip) filter.ip = ip

    // ✅ NEW: Range filter (today, week, month)
    if (range) {
      const now = new Date()
      let startDate: Date

      switch (range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const day = now.getDay() // 0 = Sunday
          const diff = day === 0 ? 6 : day - 1 // Monday as start of week
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0) // all time
      }

      filter.startedAt = { $gte: startDate }
    }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    const total = await db.collection('watchactivities').countDocuments(filter)
    const activities = await db.collection('watchactivities')
      .find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray()

    return c.json({ success: true, data: activities, total, page: pageNum, limit: limitNum })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ ADMIN — summary stats (with range filter)
watchActivityRoutes.get('/stats', adminAuth, async (c) => {
  try {
    const { range } = c.req.query()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // ✅ NEW: Build date filter for range
    const dateFilter: any = {}
    if (range) {
      const now = new Date()
      let startDate: Date

      switch (range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const day = now.getDay()
          const diff = day === 0 ? 6 : day - 1
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0)
      }
      dateFilter.startedAt = { $gte: startDate }
    }

    // Apply dateFilter to all aggregate queries
    const totalWatch = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'watch' })
    const totalDownload = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'download' })

    const uniqueViewersAgg = await db.collection('watchactivities').aggregate([
      { $match: dateFilter },
      { $group: { _id: '$ip' } },
      { $count: 'count' }
    ]).toArray()
    const uniqueViewers = uniqueViewersAgg[0]?.count || 0

    const totalWatchTimeAgg = await db.collection('watchactivities').aggregate([
      { $match: { ...dateFilter, activityType: 'watch' } },
      { $group: { _id: null, totalSec: { $sum: '$watchDurationSec' } } }
    ]).toArray()
    const totalWatchTimeSec = totalWatchTimeAgg[0]?.totalSec || 0

    const topAnime = await db.collection('watchactivities').aggregate([
      { $match: { ...dateFilter, activityType: 'watch' } },
      { $group: { _id: '$animeId', title: { $first: '$animeTitle' }, count: { $sum: 1 }, totalWatchSec: { $sum: '$watchDurationSec' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    const topDownloads = await db.collection('watchactivities').aggregate([
      { $match: { ...dateFilter, activityType: 'download' } },
      { $group: { _id: '$animeId', title: { $first: '$animeTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    return c.json({ success: true, totalWatch, totalDownload, uniqueViewers, totalWatchTimeSec, topAnime, topDownloads })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default watchActivityRoutes