import { getDb } from './mongoService'

export interface PageViewRecord {
  path: string
  pageType: string
  slug?: string
  animeTitle?: string
  ip: string
  country?: string
  device?: string
  browser?: string
  referrer?: string
  sessionId?: string
  timeOnPage?: number
  timestamp: Date
  date: string
}

// ─── Track single page view ───────────────────────────────────────────────
export async function trackPageView(
  data: Omit<PageViewRecord, 'timestamp' | 'date'>,
  mongoUri: string,
  dbName: string
): Promise<void> {
  const db = await getDb(mongoUri, dbName)
  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  await db.collection('pageviews').insertOne({
    ...data,
    timestamp: now,
    date,
    createdAt: now,
  })

  // Daily summary upsert — fast reads ke liye
  await db.collection('pageview_daily').updateOne(
    { date, path: data.path, pageType: data.pageType },
    {
      $inc: { views: 1 },
      $set: {
        slug: data.slug,
        animeTitle: data.animeTitle,
        pageType: data.pageType,
        updatedAt: now,
      },
      $setOnInsert: { date, path: data.path, createdAt: now },
    },
    { upsert: true }
  )
}

// ─── Summary stats for admin ─────────────────────────────────────────────
export async function getPageViewStats(
  mongoUri: string,
  dbName: string,
  days = 7,
  device?: string   // ✅ NEW: optional device filter
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  // ✅ Base match — device filter lagao agar diya ho
  const baseMatch: Record<string, any> = { date: { $gte: sinceStr } }
  if (device) baseMatch.device = device

  // Total views last N days
  const totalViews = await db.collection('pageviews').countDocuments(baseMatch)

  // Today's views
  const today = new Date().toISOString().slice(0, 10)
  const todayMatch: Record<string, any> = { date: today }
  if (device) todayMatch.device = device
  const todayViews = await db.collection('pageviews').countDocuments(todayMatch)

  // ✅ Daily chart — device filter ke saath pageviews collection use karo
  const dailyRaw = await db
    .collection('pageviews')
    .aggregate([
      { $match: baseMatch },
      { $group: { _id: '$date', views: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  // Zero-fill missing dates
  const dailyMap = new Map<string, number>(dailyRaw.map((d: any) => [d._id, d.views]))
  const dailyChart: { date: string; views: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    dailyChart.push({ date: dateStr, views: dailyMap.get(dateStr) || 0 })
  }

  // ✅ Top pages — device filter ho toh pageviews collection use karo, warna pageview_daily (fast)
  let topPages: any[]
  if (device) {
    // pageviews collection se device-filtered top pages
    topPages = await db
      .collection('pageviews')
      .aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$path',
            views: { $sum: 1 },
            pageType: { $first: '$pageType' },
            animeTitle: { $first: '$animeTitle' },
            slug: { $first: '$slug' },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 20 },
      ])
      .toArray()
  } else {
    // No device filter — pageview_daily use karo (fast)
    topPages = await db
      .collection('pageview_daily')
      .aggregate([
        { $match: { date: { $gte: sinceStr } } },
        {
          $group: {
            _id: '$path',
            views: { $sum: '$views' },
            pageType: { $first: '$pageType' },
            animeTitle: { $first: '$animeTitle' },
            slug: { $first: '$slug' },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 20 },
      ])
      .toArray()
  }

  // Views by page type — device filter ke saath
  const byType = await db
    .collection('pageviews')
    .aggregate([
      { $match: baseMatch },
      { $group: { _id: '$pageType', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
    ])
    .toArray()

  // Device breakdown — always from full data (no device filter here)
  const byDevice = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  // Unique visitors
  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', baseMatch)
    .then((arr: string[]) => arr.length)

  return {
    totalViews,
    todayViews,
    uniqueVisitors,
    dailyChart,
    topPages: topPages.map((p: any) => ({
      path: p._id,
      views: p.views,
      pageType: p.pageType,
      animeTitle: p.animeTitle,
      slug: p.slug,
    })),
    byType: byType.map((t: any) => ({ type: t._id, views: t.views })),
    byDevice: byDevice.map((d: any) => ({ device: d._id || 'unknown', count: d.count })),
  }
}

// ─── Per-page detail (for drill-down) ────────────────────────────────────
export async function getPageDetail(
  path: string,
  mongoUri: string,
  dbName: string,
  days = 30
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const daily = await db
    .collection('pageview_daily')
    .find({ path, date: { $gte: sinceStr } })
    .sort({ date: 1 })
    .toArray()

  const total = daily.reduce((s: number, d: any) => s + (d.views || 0), 0)

  return { path, total, daily }
}