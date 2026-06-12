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

// Helper: returns date string in Indian Standard Time (UTC+5:30)
function getISTDateStr(d: Date = new Date()): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000
  const istDate = new Date(d.getTime() + IST_OFFSET)
  return istDate.toISOString().slice(0, 10)
}

// Track single page view
export async function trackPageView(
  data: Omit<PageViewRecord, 'timestamp' | 'date'>,
  mongoUri: string,
  dbName: string
): Promise<void> {
  const db = await getDb(mongoUri, dbName)
  const now = new Date()
  const date = getISTDateStr(now)

  await db.collection('pageviews').insertOne({
    ...data,
    timestamp: now,
    date,
    createdAt: now,
  })

  // FIX: Upsert only on { date, path } — pageType alag hone par duplicate na bane
  await db.collection('pageview_daily').updateOne(
    { date, path: data.path },
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

// Summary stats for admin
export async function getPageViewStats(
  mongoUri: string,
  dbName: string,
  days = 7,
  device?: string
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))   // includes today
  const sinceStr = getISTDateStr(since)

  const baseMatch: Record<string, any> = { date: { $gte: sinceStr } }
  if (device) baseMatch.device = device

  // ─── Today's date string (IST) ────────────────────────────────────────
  const todayStr = getISTDateStr()

  // ─── Today's views ────────────────────────────────────────────────────
  const todayMatch: Record<string, any> = { date: todayStr }
  if (device) todayMatch.device = device
  const todayViews = await db.collection('pageviews').countDocuments(todayMatch)

  // ─── Today's unique visitors ──────────────────────────────────────────
  const todayUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', todayMatch)
    .then((arr: string[]) => arr.length)

  // Total views (filtered by days/device, includes today)
  const totalViews = await db.collection('pageviews').countDocuments(baseMatch)

  // ─── All-time total views (no date filter) ────────────────────────────
  const allTimeMatch: Record<string, any> = {}
  if (device) allTimeMatch.device = device
  const allTimeTotalViews = await db.collection('pageviews').countDocuments(allTimeMatch)

  // ─── All-time unique visitors ─────────────────────────────────────────
  const allTimeUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', allTimeMatch)
    .then((arr: string[]) => arr.length)

  // ─── Last 7 days unique visitors (explicitly 7 days) ─────────────────
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysStr = getISTDateStr(sevenDaysAgo)
  const sevenDayMatch: Record<string, any> = { date: { $gte: sevenDaysStr } }
  if (device) sevenDayMatch.device = device

  const last7DaysUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', sevenDayMatch)
    .then((arr: string[]) => arr.length)

  // Daily chart
  const dailyRaw = await db
    .collection('pageviews')
    .aggregate([
      { $match: baseMatch },
      { $group: { _id: '$date', views: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  const dailyMap = new Map<string, number>(dailyRaw.map((d: any) => [d._id, d.views]))
  const dailyChart: { date: string; views: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = getISTDateStr(d)
    dailyChart.push({ date: dateStr, views: dailyMap.get(dateStr) || 0 })
  }

  // Top pages — normalize path to prevent duplicates from case/slash differences
  let topPages: any[]
  if (device) {
    topPages = await db
      .collection('pageviews')
      .aggregate([
        { $match: baseMatch },
        { $addFields: { normPath: { $toLower: { $trim: { input: '$path', chars: '/' } } } } },
        {
          $group: {
            _id: '$normPath',
            views: { $sum: 1 },
            path: { $first: '$path' },
            pageType: { $first: '$pageType' },
            animeTitle: { $first: '$animeTitle' },
            slug: { $first: '$slug' },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 50 },
      ])
      .toArray()
  } else {
    topPages = await db
      .collection('pageview_daily')
      .aggregate([
        { $match: { date: { $gte: sinceStr } } },
        { $addFields: { normPath: { $toLower: { $trim: { input: '$path', chars: '/' } } } } },
        {
          $group: {
            _id: '$normPath',
            views: { $sum: '$views' },
            path: { $first: '$path' },
            pageType: { $first: '$pageType' },
            animeTitle: { $first: '$animeTitle' },
            slug: { $first: '$slug' },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 50 },
      ])
      .toArray()
  }

  // Views by page type
  const byType = await db
    .collection('pageviews')
    .aggregate([
      { $match: baseMatch },
      { $group: { _id: '$pageType', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
    ])
    .toArray()

  // Device breakdown — always full data (uses updated sinceStr)
  const byDevice = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  // Unique visitors (for the selected period, includes today)
  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', baseMatch)
    .then((arr: string[]) => arr.length)

  return {
    todayViews,                        // ← NEW: aaj ke views (IST midnight se)
    todayUniqueVisitors,               // ← NEW: aaj ke unique visitors (IST)
    totalViews,                        // selected period
    uniqueVisitors,                    // selected period
    allTimeTotalViews,
    allTimeUniqueVisitors,
    last7DaysUniqueVisitors,
    dailyChart,
    topPages: topPages.map((p: any) => ({
      path: p.path ?? '/' + p._id,
      views: p.views,
      pageType: p.pageType,
      animeTitle: p.animeTitle,
      slug: p.slug,
    })),
    byType: byType.map((t: any) => ({ type: t._id, views: t.views })),
    byDevice: byDevice.map((d: any) => ({ device: d._id || 'unknown', count: d.count })),
  }
}

// Per-page detail for drill-down modal
export async function getPageDetail(
  path: string,
  mongoUri: string,
  dbName: string,
  days = 30
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = getISTDateStr(since)

  const rawDaily = await db
    .collection('pageview_daily')
    .aggregate([
      { $match: { path, date: { $gte: sinceStr } } },
      { $group: { _id: '$date', views: { $sum: '$views' } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  // Zero-fill missing dates
  const dailyMap = new Map<string, number>(rawDaily.map((d: any) => [d._id, d.views]))
  const daily: { date: string; views: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = getISTDateStr(d)
    daily.push({ date: dateStr, views: dailyMap.get(dateStr) || 0 })
  }

  const total = daily.reduce((s, d) => s + d.views, 0)

  return { path, total, daily }
}