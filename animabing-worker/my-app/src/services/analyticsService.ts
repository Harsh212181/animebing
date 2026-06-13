 import { getDb } from './mongoService'

export interface PageViewRecord {
  path: string
  pageType: string
  slug?: string
  animeTitle?: string
  ip: string
  country?: string
  region?: string
  city?: string
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

// ─── GeoIP response type ─────────────────────────────────────────────────
interface GeoIPResponse {
  countryCode?: string
  regionName?: string
  city?: string
}

// ─── Free GeoIP enrichment (ip-api.com) ──────────────────────────────────
async function enrichGeo(ip: string): Promise<{ country?: string; region?: string; city?: string }> {
  try {
    // Skip private/local IPs
    if (ip === '0.0.0.0' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
      return {}
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,regionName,city`)
    if (!res.ok) return {}
    const data: GeoIPResponse = await res.json()
    return {
      country: data.countryCode || undefined,
      region: data.regionName || undefined,
      city: data.city || undefined,
    }
  } catch {
    return {}
  }
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

  // Enrich geo only if country or region is missing
  let country = data.country
  let region = data.region
  let city = data.city

  if (!country || !region) {
    const geo = await enrichGeo(data.ip)
    country = country || geo.country
    region = region || geo.region
    city = city || geo.city
  }

  await db.collection('pageviews').insertOne({
    ...data,
    country,
    region,
    city,
    timestamp: now,
    date,
    createdAt: now,
  })

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
  since.setDate(since.getDate() - (days - 1))
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

  // Total views (filtered by days/device)
  const totalViews = await db.collection('pageviews').countDocuments(baseMatch)

  // ─── All-time total views ─────────────────────────────────────────────
  const allTimeMatch: Record<string, any> = {}
  if (device) allTimeMatch.device = device
  const allTimeTotalViews = await db.collection('pageviews').countDocuments(allTimeMatch)

  // ─── All-time unique visitors ─────────────────────────────────────────
  const allTimeUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', allTimeMatch)
    .then((arr: string[]) => arr.length)

  // ─── Last 7 days unique visitors ─────────────────────────────────────
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

  // Top pages
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

  // Device breakdown
  const byDevice = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  // Unique visitors (selected period)
  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', baseMatch)
    .then((arr: string[]) => arr.length)

  // ─── Geo stats — views by country ─────────────────────────────────────
  const byCountryRaw = await db
    .collection('pageviews')
    .aggregate([
      { $match: baseMatch },
      { $group: { _id: '$country', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 100 },
    ])
    .toArray()

  const byCountry = byCountryRaw
    .filter((c: any) => c._id && c._id !== 'XX')
    .map((c: any) => ({ country: c._id as string, views: c.views as number }))

  return {
    todayViews,
    todayUniqueVisitors,
    totalViews,
    uniqueVisitors,
    allTimeTotalViews,
    allTimeUniqueVisitors,
    last7DaysUniqueVisitors,
    dailyChart,
    byCountry,
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

// ─── Geo detail — groups by region (state) and city ───────────────────────
export async function getGeoDetail(
  country: string,
  mongoUri: string,
  dbName: string,
  days = 30
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const result = await db
    .collection('pageviews')
    .aggregate([
      { $match: { country, date: { $gte: sinceStr } } },
      {
        $group: {
          _id: {
            region: { $ifNull: ['$region', 'Unknown'] },
            city: { $ifNull: ['$city', 'Unknown'] },
          },
          views: { $sum: 1 },
          uniqueIps: { $addToSet: '$ip' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ])
    .toArray()

  const totalViews = await db
    .collection('pageviews')
    .countDocuments({ country, date: { $gte: sinceStr } })

  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', { country, date: { $gte: sinceStr } })
    .then((arr: string[]) => arr.length)

  return {
    country,
    totalViews,
    uniqueVisitors,
    cities: result.map((r: any) => ({
      city: r._id.city,
      region: r._id.region,
      views: r.views,
      uniqueVisitors: r.uniqueIps.length,
    })),
  }
}

// ─── Country breakdown by period — independent of main stats `days` ──────
// Used by the "Top Countries" / World Map section with its own
// daily / weekly / monthly / yearly filter.
export async function getByCountryStats(
  mongoUri: string,
  dbName: string,
  days = 1
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const match: Record<string, any> = { date: { $gte: sinceStr } }

  const byCountryRaw = await db
    .collection('pageviews')
    .aggregate([
      { $match: match },
      { $group: { _id: '$country', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 100 },
    ])
    .toArray()

  const byCountry = byCountryRaw
    .filter((c: any) => c._id && c._id !== 'XX')
    .map((c: any) => ({ country: c._id as string, views: c.views as number }))

  return { byCountry }
}

// ─── Funnel: Home → Detail → Download per session ─────────────────────────
export async function getFunnelStats(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const match: Record<string, any> = {
    date: { $gte: sinceStr },
    sessionId: { $exists: true, $ne: null },
  }

  // Get all pageviews grouped by session, sorted by timestamp
  const sessions = await db
    .collection('pageviews')
    .aggregate([
      { $match: match },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: '$sessionId',
          pages: {
            $push: {
              pageType: '$pageType',
              timestamp: '$timestamp',
            },
          },
        },
      },
    ])
    .toArray()

  let homeOnly = 0
  let homeToDetail = 0
  let homeToDetailToDownload = 0
  const totalSessions = sessions.length

  for (const s of sessions) {
    const pageTypes: string[] = s.pages.map((p: any) => p.pageType)
    const hasHome = pageTypes.includes('home')
    const hasDetail = pageTypes.includes('anime-detail')
    const hasDownload = pageTypes.includes('download')

    if (hasHome) {
      homeOnly++
      if (hasDetail) {
        homeToDetail++
        if (hasDownload) {
          homeToDetailToDownload++
        }
      }
    }
  }

  return {
    totalSessions,
    homeOnly,
    homeToDetail,
    homeToDetailToDownload,
    conversionRates: {
      homeToDetailRate: homeOnly ? ((homeToDetail / homeOnly) * 100).toFixed(1) : '0',
      detailToDownloadRate: homeToDetail ? ((homeToDetailToDownload / homeToDetail) * 100).toFixed(1) : '0',
      overallConversionRate: homeOnly ? ((homeToDetailToDownload / homeOnly) * 100).toFixed(1) : '0',
    },
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