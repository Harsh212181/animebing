import { getDb } from './mongoService'

export interface PageViewRecord {
  path: string           // e.g. "/anime/naruto"
  pageType: string       // "anime-detail" | "download" | "anime-list" | "home" | "contact" | "other"
  slug?: string          // anime slug (if detail/download page)
  animeTitle?: string    // anime title for display
  ip: string
  country?: string
  device?: string        // "mobile" | "desktop" | "tablet"
  browser?: string
  referrer?: string
  sessionId?: string
  timeOnPage?: number    // seconds
  timestamp: Date
  date: string           // "YYYY-MM-DD" — grouping ke liye
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
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  // Total views last N days
  const totalViews = await db.collection('pageviews').countDocuments({
    date: { $gte: sinceStr },
  })

  // Today's views
  const today = new Date().toISOString().slice(0, 10)
  const todayViews = await db.collection('pageviews').countDocuments({ date: today })

  // Views per day (for chart)
  const dailyRaw = await db
    .collection('pageview_daily')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$date', views: { $sum: '$views' } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  // Top pages
  const topPages = await db
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

  // Views by page type
  const byType = await db
    .collection('pageview_daily')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$pageType', views: { $sum: '$views' } } },
      { $sort: { views: -1 } },
    ])
    .toArray()

  // Device breakdown (last N days)
  const byDevice = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  // Unique IPs (approximate unique visitors)
  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', { date: { $gte: sinceStr } })
    .then((arr: string[]) => arr.length)

  return {
    totalViews,
    todayViews,
    uniqueVisitors,
    dailyChart: dailyRaw.map((d: any) => ({ date: d._id, views: d.views })),
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