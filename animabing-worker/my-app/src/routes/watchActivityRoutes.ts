import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import { updateOne, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { getOwnedAnimeIds, getAnimeIdsForSubAdmin, toObjectIds } from '../services/subAdminScope'
import { IWatchActivity } from '../models/types'
import { aggregateAndPruneDay, aggregateAndPruneDayNoDelete, getRollupStatsForRange, startOfUTCDay } from '../services/dailyStatsService'

const watchActivityRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!ua) return 'unknown'
  const s = ua.toLowerCase()
  if (/ipad|tablet/.test(s)) return 'tablet'
  if (/mobi|android|iphone/.test(s)) return 'mobile'
  return 'desktop'
}

// ✅ PUBLIC — watch/download start
watchActivityRoutes.post('/start', async (c) => {
  try {
    const body = await c.req.json()
    const { animeId, animeTitle, contentType, episodeNumber, downloadPageId, activityType, videoUrl, quality, language } = body

    if (!animeId || !isValidObjectId(animeId)) return c.json({ error: 'Invalid animeId' }, 400)
    if (activityType !== 'watch' && activityType !== 'download') return c.json({ error: 'Invalid activityType' }, 400)

    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    const country = c.req.header('cf-ipcountry') || undefined

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'watchActivity/start', async (db) => {
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

      const now = new Date()
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
        startedAt: now,
      }

      const result = await db.collection('watchactivities').insertOne({
        ...activity,
        createdAt: now,
        updatedAt: now,
      })
      return c.json({ success: true, activityId: result.insertedId.toString() }, 201)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ PUBLIC — heartbeat
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

// ✅ PUBLIC — end
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

// ✅ ADMIN — activity list
watchActivityRoutes.get('/', adminAuth, requirePermission('useractivity'), async (c) => {
  try {
    const { animeId, activityType, ip, range, subAdminId, page = '1', limit = '50' } = c.req.query()
    const admin = c.get('admin')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'watchActivity/list', async (db) => {
      const filter: any = {}
      if (activityType === 'watch' || activityType === 'download') filter.activityType = activityType
      if (ip) filter.ip = ip

      if (range) {
        const now = new Date()
        let startDate: Date
        switch (range) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week': {
            const day = now.getDay()
            const diff = day === 0 ? 6 : day - 1
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
            startDate.setHours(0, 0, 0, 0)
            break
          }
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }
        filter.startedAt = { $gte: startDate }
      }

      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)

      if (ownedAnimeIds !== null) {
        if (ownedAnimeIds.length === 0) {
          return c.json({ success: true, data: [], total: 0, page: 1, limit: Number(limit) })
        }
        filter.animeId = { $in: toObjectIds(ownedAnimeIds) }
      } else if (subAdminId && isValidObjectId(subAdminId)) {
        const scopedIds = await getAnimeIdsForSubAdmin(subAdminId, db)
        filter.animeId = { $in: toObjectIds(scopedIds) }
      }

      if (animeId && isValidObjectId(animeId)) {
        filter.animeId = { $in: [toObjectId(animeId)] }
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

      let enriched: any[] = activities
      if (ownedAnimeIds === null) {
        const animeIds = Array.from(new Set(activities.map((a: any) => a.animeId?.toString()).filter(Boolean)))
          .filter(isValidObjectId)
          .map((id: string) => toObjectId(id))

        const animeMap: Record<string, string | null> = {}
        if (animeIds.length > 0) {
          const animes = await db.collection('animes')
            .find({ _id: { $in: animeIds } }, { projection: { createdByUsername: 1 } })
            .toArray()
          animes.forEach((an: any) => { animeMap[an._id.toString()] = an.createdByUsername || null })
        }

        enriched = activities.map((a: any) => ({
          ...a,
          subAdminUsername: animeMap[a.animeId?.toString()] || null
        }))
      }

      return c.json({ success: true, data: enriched, total, page: pageNum, limit: limitNum })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ ADMIN — summary stats
// ✅ FIX: getRollupStatsForRange ab `db` accept karta hai (pehla arg)
watchActivityRoutes.get('/stats', adminAuth, requirePermission('useractivity'), async (c) => {
  try {
    const { range, subAdminId } = c.req.query()
    const admin = c.get('admin')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'watchActivity/stats', async (db) => {
      const now = new Date()
      const today0 = startOfUTCDay(now)

      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)
      let animeScope: string[] | null = null
      if (ownedAnimeIds !== null) {
        animeScope = ownedAnimeIds
      } else if (subAdminId && isValidObjectId(subAdminId)) {
        animeScope = await getAnimeIdsForSubAdmin(subAdminId, db)
      }
      if (animeScope !== null && animeScope.length === 0) {
        return c.json({ success: true, totalWatch: 0, totalDownload: 0, uniqueViewers: 0, totalWatchTimeSec: 0, topAnime: [], topDownloads: [] })
      }

      let rangeStart: Date
      switch (range) {
        case 'today': rangeStart = today0; break
        case 'week': {
          const day = now.getUTCDay()
          const diff = day === 0 ? 6 : day - 1
          rangeStart = new Date(today0.getTime() - diff * 24 * 60 * 60 * 1000)
          break
        }
        case 'month': rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); break
        default: rangeStart = new Date(0)
      }

      // ── Part A: aaj ka LIVE data ──
      const liveFilter: any = { startedAt: { $gte: today0 > rangeStart ? today0 : rangeStart } }
      if (animeScope) liveFilter.animeId = { $in: toObjectIds(animeScope) }

      const liveTotalWatch = await db.collection('watchactivities').countDocuments({ ...liveFilter, activityType: 'watch' })
      const liveTotalDownload = await db.collection('watchactivities').countDocuments({ ...liveFilter, activityType: 'download' })
      const liveIps: string[] = await db.collection('watchactivities').distinct('ip', liveFilter)
      const liveWatchTimeAgg = await db.collection('watchactivities').aggregate([
        { $match: { ...liveFilter, activityType: 'watch' } },
        { $group: { _id: null, totalSec: { $sum: '$watchDurationSec' } } }
      ]).toArray()
      const liveWatchTimeSec = liveWatchTimeAgg[0]?.totalSec || 0

      const liveTopAnime = await db.collection('watchactivities').aggregate([
        { $match: { ...liveFilter, activityType: 'watch' } },
        { $group: { _id: '$animeId', title: { $first: '$animeTitle' }, count: { $sum: 1 }, totalWatchSec: { $sum: '$watchDurationSec' } } }
      ]).toArray()
      const liveTopDownloads = await db.collection('watchactivities').aggregate([
        { $match: { ...liveFilter, activityType: 'download' } },
        { $group: { _id: '$animeId', title: { $first: '$animeTitle' }, count: { $sum: 1 } } }
      ]).toArray()

      // ── Part B: purane dinon ka ROLLUP ──
      let rollup = { totalWatch: 0, totalDownload: 0, totalWatchTimeSec: 0, uniqueIps: [] as string[], topAnime: [] as any[], topDownloads: [] as any[] }
      if (rangeStart < today0) {
        // ✅ FIX: getRollupStatsForRange(db, fromDate, toDateExclusive, animeScope)
        rollup = await getRollupStatsForRange(db, rangeStart, today0, animeScope)
      }

      // ── Combine ──
      const ipSet = new Set<string>([...liveIps, ...rollup.uniqueIps])
      const animeMap: Record<string, { _id: string; title: string; count: number; totalWatchSec: number }> = {}
      for (const a of rollup.topAnime) animeMap[a._id] = { ...a }
      for (const a of liveTopAnime) {
        const id = a._id?.toString()
        if (!id) continue
        if (!animeMap[id]) animeMap[id] = { _id: id, title: a.title, count: 0, totalWatchSec: 0 }
        animeMap[id].count += a.count
        animeMap[id].totalWatchSec += a.totalWatchSec || 0
      }
      const downloadMap: Record<string, { _id: string; title: string; count: number }> = {}
      for (const a of rollup.topDownloads) downloadMap[a._id] = { ...a }
      for (const a of liveTopDownloads) {
        const id = a._id?.toString()
        if (!id) continue
        if (!downloadMap[id]) downloadMap[id] = { _id: id, title: a.title, count: 0 }
        downloadMap[id].count += a.count
      }

      return c.json({
        success: true,
        totalWatch: liveTotalWatch + rollup.totalWatch,
        totalDownload: liveTotalDownload + rollup.totalDownload,
        uniqueViewers: ipSet.size,
        totalWatchTimeSec: liveWatchTimeSec + rollup.totalWatchTimeSec,
        topAnime: Object.values(animeMap).sort((a, b) => b.count - a.count).slice(0, 10),
        topDownloads: Object.values(downloadMap).sort((a, b) => b.count - a.count).slice(0, 10),
      })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ ADMIN — one-time backfill
// ✅ FIX: aggregateAndPruneDayNoDelete ab `db` accept karta hai
watchActivityRoutes.post('/backfill-rollup', adminAuth, requirePermission('useractivity'), async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'watchActivity/backfill-rollup', async (db) => {
      const oldest = await db.collection('watchactivities').find({}).sort({ startedAt: 1 }).limit(1).toArray()
      const newest = await db.collection('watchactivities').find({}).sort({ startedAt: -1 }).limit(1).toArray()

      if (oldest.length === 0) {
        return c.json({ success: true, message: 'Koi data nahi mila', daysProcessed: 0 })
      }

      const firstDay = startOfUTCDay(new Date(oldest[0].startedAt))
      const lastDay = startOfUTCDay(new Date(newest[0].startedAt))

      const results: { date: string; aggregated: boolean }[] = []
      let cursor = new Date(firstDay)

      while (cursor <= lastDay) {
        const dateStr = cursor.toISOString().slice(0, 10)
        // ✅ FIX: aggregateAndPruneDayNoDelete(db, dateStr)
        const result = await aggregateAndPruneDayNoDelete(db, dateStr)
        results.push(result)
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
      }

      return c.json({
        success: true,
        daysProcessed: results.length,
        daysWithData: results.filter(r => r.aggregated).length,
        range: { from: firstDay.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) },
      })
    }, 120000)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default watchActivityRoutes