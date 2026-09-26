import { getDb } from './mongoService'

export interface IDailyActivityStat {
  _id?: any
  date: string          // 'YYYY-MM-DD' (UTC) — unique key
  dateObj: Date          // us din ka UTC midnight, range-queries ke liye
  totalWatch: number
  totalDownload: number
  uniqueIps: string[]    // ✅ pura array rakhte hain (na ki sirf count) taaki
                          // multiple din combine karte waqt TRUE unique count nikal sakein
  totalWatchTimeSec: number
  perAnime: {
    animeId: string
    title: string
    watchCount: number
    downloadCount: number
    watchSec: number
  }[]
  createdAt: Date
  updatedAt: Date
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// ✅ Ek (UTC) din ka raw watchactivities data aggregate karke dailyActivityStats
// mein upsert karta hai, phir wahi raw documents delete kar deta hai (jo abhi
// bhi "active" hain — jinka heartbeat 2 ghante ke andar update hua hai — unhe
// chhod dete hain, taaki kisi live watch-session ka ID achanak invalid na ho jaye).
// dateStr: 'YYYY-MM-DD'. Na diya jaye to 'kal' (yesterday, UTC) use hota hai.
export async function aggregateAndPruneDay(
  mongoUri: string, dbName: string, dateStr?: string
): Promise<{ date: string; aggregated: boolean }> {
  const db = await getDb(mongoUri, dbName)

  const target = dateStr
    ? new Date(`${dateStr}T00:00:00.000Z`)
    : startOfUTCDay(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const dayStart = startOfUTCDay(target)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const key = dateKey(dayStart)
  const dateFilter = { startedAt: { $gte: dayStart, $lt: dayEnd } }

  const totalWatch = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'watch' })
  const totalDownload = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'download' })

  if (totalWatch === 0 && totalDownload === 0) {
    return { date: key, aggregated: false } // is din kuch tha hi nahi
  }

  const uniqueIps: string[] = await db.collection('watchactivities').distinct('ip', dateFilter)

  const watchTimeAgg = await db.collection('watchactivities').aggregate([
    { $match: { ...dateFilter, activityType: 'watch' } },
    { $group: { _id: null, totalSec: { $sum: '$watchDurationSec' } } }
  ]).toArray()
  const totalWatchTimeSec = watchTimeAgg[0]?.totalSec || 0

  const perAnimeAgg = await db.collection('watchactivities').aggregate([
    { $match: dateFilter },
    { $group: {
        _id: { animeId: '$animeId', activityType: '$activityType' },
        title: { $first: '$animeTitle' },
        count: { $sum: 1 },
        watchSec: { $sum: '$watchDurationSec' },
    } }
  ]).toArray()

  const perAnimeMap: Record<string, IDailyActivityStat['perAnime'][number]> = {}
  for (const row of perAnimeAgg) {
    const id = row._id.animeId?.toString()
    if (!id) continue
    if (!perAnimeMap[id]) {
      perAnimeMap[id] = { animeId: id, title: row.title || 'Unknown', watchCount: 0, downloadCount: 0, watchSec: 0 }
    }
    if (row._id.activityType === 'watch') {
      perAnimeMap[id].watchCount = row.count
      perAnimeMap[id].watchSec = row.watchSec || 0
    } else {
      perAnimeMap[id].downloadCount = row.count
    }
    if (row.title) perAnimeMap[id].title = row.title
  }

  const now = new Date()
  await db.collection('dailyActivityStats').updateOne(
    { date: key },
    {
      $set: {
        date: key, dateObj: dayStart, totalWatch, totalDownload, uniqueIps,
        totalWatchTimeSec, perAnime: Object.values(perAnimeMap), updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )

  // ✅ Sirf wahi raw docs delete karo jo "settled" hain — abhi live watch nahi ho raha
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  await db.collection('watchactivities').deleteMany({
    ...dateFilter,
    $or: [{ endedAt: { $exists: true } }, { updatedAt: { $lt: twoHoursAgo } }],
  })

  return { date: key, aggregated: true }
}

// ✅ [fromDate, toDateExclusive) range ke saare dailyActivityStats docs ko
// combine karta hai. animeScope diya ho to sirf un anime IDs ka data count hota hai.
export async function getRollupStatsForRange(
  mongoUri: string, dbName: string, fromDate: Date, toDateExclusive: Date, animeScope: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const docs = await db.collection('dailyActivityStats').find({
    dateObj: { $gte: startOfUTCDay(fromDate), $lt: toDateExclusive }
  }).toArray()

  const scopeSet = animeScope ? new Set(animeScope) : null
  let totalWatch = 0, totalDownload = 0, totalWatchTimeSec = 0
  const ipSet = new Set<string>()
  const animeMap: Record<string, { _id: string; title: string; count: number; totalWatchSec: number }> = {}
  const downloadMap: Record<string, { _id: string; title: string; count: number }> = {}

  for (const d of docs as IDailyActivityStat[]) {
    for (const ip of d.uniqueIps || []) ipSet.add(ip)
    for (const a of d.perAnime || []) {
      if (scopeSet && !scopeSet.has(a.animeId)) continue // 🔒 sub-admin scoping
      totalWatch += a.watchCount || 0
      totalDownload += a.downloadCount || 0
      totalWatchTimeSec += a.watchSec || 0
      if (a.watchCount > 0) {
        if (!animeMap[a.animeId]) animeMap[a.animeId] = { _id: a.animeId, title: a.title, count: 0, totalWatchSec: 0 }
        animeMap[a.animeId].count += a.watchCount
        animeMap[a.animeId].totalWatchSec += a.watchSec || 0
      }
      if (a.downloadCount > 0) {
        if (!downloadMap[a.animeId]) downloadMap[a.animeId] = { _id: a.animeId, title: a.title, count: 0 }
        downloadMap[a.animeId].count += a.downloadCount
      }
    }
  }

  return {
    totalWatch, totalDownload, totalWatchTimeSec,
    uniqueIps: Array.from(ipSet),
    topAnime: Object.values(animeMap),
    topDownloads: Object.values(downloadMap),
  }
}

// ✅ Backfill ke liye — aggregateAndPruneDay jaisa hi, lekin raw docs delete NAHI karta
export async function aggregateAndPruneDayNoDelete(
  mongoUri: string, dbName: string, dateStr: string
): Promise<{ date: string; aggregated: boolean }> {
  const db = await getDb(mongoUri, dbName)

  const dayStart = startOfUTCDay(new Date(`${dateStr}T00:00:00.000Z`))
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const key = dayStart.toISOString().slice(0, 10)
  const dateFilter = { startedAt: { $gte: dayStart, $lt: dayEnd } }

  const totalWatch = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'watch' })
  const totalDownload = await db.collection('watchactivities').countDocuments({ ...dateFilter, activityType: 'download' })

  if (totalWatch === 0 && totalDownload === 0) {
    return { date: key, aggregated: false }
  }

  const uniqueIps: string[] = await db.collection('watchactivities').distinct('ip', dateFilter)

  const watchTimeAgg = await db.collection('watchactivities').aggregate([
    { $match: { ...dateFilter, activityType: 'watch' } },
    { $group: { _id: null, totalSec: { $sum: '$watchDurationSec' } } }
  ]).toArray()
  const totalWatchTimeSec = watchTimeAgg[0]?.totalSec || 0

  const perAnimeAgg = await db.collection('watchactivities').aggregate([
    { $match: dateFilter },
    { $group: {
        _id: { animeId: '$animeId', activityType: '$activityType' },
        title: { $first: '$animeTitle' },
        count: { $sum: 1 },
        watchSec: { $sum: '$watchDurationSec' },
    } }
  ]).toArray()

  const perAnimeMap: Record<string, IDailyActivityStat['perAnime'][number]> = {}
  for (const row of perAnimeAgg) {
    const id = row._id.animeId?.toString()
    if (!id) continue
    if (!perAnimeMap[id]) {
      perAnimeMap[id] = { animeId: id, title: row.title || 'Unknown', watchCount: 0, downloadCount: 0, watchSec: 0 }
    }
    if (row._id.activityType === 'watch') {
      perAnimeMap[id].watchCount = row.count
      perAnimeMap[id].watchSec = row.watchSec || 0
    } else {
      perAnimeMap[id].downloadCount = row.count
    }
    if (row.title) perAnimeMap[id].title = row.title
  }

  const now = new Date()
  await db.collection('dailyActivityStats').updateOne(
    { date: key },
    {
      $set: {
        date: key, dateObj: dayStart, totalWatch, totalDownload, uniqueIps,
        totalWatchTimeSec, perAnime: Object.values(perAnimeMap), updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )

  return { date: key, aggregated: true }
}