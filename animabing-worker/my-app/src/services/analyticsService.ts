 // src/services/mongoService.ts
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

// ─── 1. Referrer / traffic source breakdown ────────────────────────────────
function classifyReferrer(referrer?: string): string {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (/google\./i.test(host)) return 'Google'
    if (/bing\./i.test(host)) return 'Bing'
    if (/yahoo\./i.test(host)) return 'Yahoo'
    if (/duckduckgo\./i.test(host)) return 'DuckDuckGo'
    if (/facebook\.|fb\.com/i.test(host)) return 'Facebook'
    if (/instagram\./i.test(host)) return 'Instagram'
    if (/twitter\.|x\.com/i.test(host)) return 'Twitter / X'
    if (/t\.me|telegram/i.test(host)) return 'Telegram'
    if (/reddit\./i.test(host)) return 'Reddit'
    if (/youtube\./i.test(host)) return 'YouTube'
    if (/animabingwatch\.workers\.dev|animabing/i.test(host)) return 'Internal'
    return host
  } catch {
    return 'Direct'
  }
}

export async function getReferrerStats(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $project: { referrer: 1 } },
      { $limit: 20000 },
    ])
    .toArray()

  const counts = new Map<string, number>()
  for (const r of raw) {
    const source = classifyReferrer(r.referrer)
    counts.set(source, (counts.get(source) || 0) + 1)
  }

  const byReferrer = Array.from(counts.entries())
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15)

  return { byReferrer }
}

// ─── 2. Browser breakdown ───────────────────────────────────────────────────
export async function getBrowserStats(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: { $ifNull: ['$browser', 'Other'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  return {
    byBrowser: raw.map((b: any) => ({ browser: b._id || 'Other', count: b.count })),
  }
}

// ─── 3. Average time on page (per page type) ──────────────────────────────
export async function getTimeOnPageStats(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      {
        $match: {
          date: { $gte: sinceStr },
          timeOnPage: { $exists: true, $gt: 0, $lt: 3600 },
        },
      },
      {
        $group: {
          _id: '$pageType',
          avgTimeOnPage: { $avg: '$timeOnPage' },
          samples: { $sum: 1 },
        },
      },
      { $sort: { avgTimeOnPage: -1 } },
    ])
    .toArray()

  return {
    byPageType: raw.map((r: any) => ({
      pageType: r._id,
      avgSeconds: Math.round(r.avgTimeOnPage),
      samples: r.samples,
    })),
  }
}

// ─── 4. Real-time / live visitors (active in last 5 minutes) ──────────────
export async function getLiveVisitors(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  const activeSessions = await db
    .collection('pageviews')
    .distinct('sessionId', {
      timestamp: { $gte: fiveMinAgo },
      sessionId: { $exists: true, $ne: null },
    })

  const activeIps = await db
    .collection('pageviews')
    .distinct('ip', { timestamp: { $gte: fiveMinAgo } })

  // Pages currently being viewed (top 5)
  const currentPages = await db
    .collection('pageviews')
    .aggregate([
      { $match: { timestamp: { $gte: fiveMinAgo } } },
      {
        $group: {
          _id: '$path',
          count: { $sum: 1 },
          animeTitle: { $first: '$animeTitle' },
          pageType: { $first: '$pageType' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ])
    .toArray()

  return {
    liveVisitors: Math.max(activeSessions.length, activeIps.length),
    currentPages: currentPages.map((p: any) => ({
      path: p._id,
      count: p.count,
      animeTitle: p.animeTitle,
      pageType: p.pageType,
    })),
  }
}

// ─── 5. Top anime overall (combined across page types) ────────────────────
export async function getTopAnimeOverall(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      {
        $match: {
          date: { $gte: sinceStr },
          animeTitle: { $exists: true, $nin: [null, ''] },
          pageType: { $in: ['anime-detail', 'episode', 'download'] },
        },
      },
      {
        $group: {
          _id: '$animeTitle',
          totalViews: { $sum: 1 },
          detailViews: { $sum: { $cond: [{ $eq: ['$pageType', 'anime-detail'] }, 1, 0] } },
          episodeViews: { $sum: { $cond: [{ $eq: ['$pageType', 'episode'] }, 1, 0] } },
          downloadViews: { $sum: { $cond: [{ $eq: ['$pageType', 'download'] }, 1, 0] } },
          slug: { $first: '$slug' },
        },
      },
      { $sort: { totalViews: -1 } },
      { $limit: 25 },
    ])
    .toArray()

  return {
    topAnime: raw.map((a: any) => ({
      animeTitle: a._id,
      slug: a.slug,
      totalViews: a.totalViews,
      detailViews: a.detailViews,
      episodeViews: a.episodeViews,
      downloadViews: a.downloadViews,
    })),
  }
}

// ─── 7. Hourly heatmap (views by hour of day, IST) ─────────────────────────
export async function getHourlyHeatmap(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const IST_OFFSET = 5.5 * 60 * 60 * 1000

  const raw = await db
    .collection('pageviews')
    .aggregate([
      { $match: { date: { $gte: sinceStr } } },
      {
        $project: {
          istHour: {
            $hour: { $add: ['$timestamp', IST_OFFSET] },
          },
        },
      },
      { $group: { _id: '$istHour', views: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  const hourMap = new Map<number, number>(raw.map((h: any) => [h._id, h.views]))
  const hourly: { hour: number; views: number }[] = []
  for (let h = 0; h < 24; h++) {
    hourly.push({ hour: h, views: hourMap.get(h) || 0 })
  }

  return { hourly }
}

// ─── 8. 404 / not-found page tracking ──────────────────────────────────────
export async function get404Stats(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      {
        $match: {
          date: { $gte: sinceStr },
          pageType: 'not-found',
        },
      },
      {
        $group: {
          _id: '$path',
          views: { $sum: 1 },
          referrer: { $first: '$referrer' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 30 },
    ])
    .toArray()

  return {
    notFoundPages: raw.map((p: any) => ({
      path: p._id,
      views: p.views,
      referrer: p.referrer || null,
    })),
  }
}

// ─── 10. New vs returning visitors ─────────────────────────────────────────
export async function getNewVsReturning(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  // All IPs seen in the period
  const periodIps: string[] = await db
    .collection('pageviews')
    .distinct('ip', { date: { $gte: sinceStr } })

  if (periodIps.length === 0) {
    return { newVisitors: 0, returningVisitors: 0, total: 0 }
  }

  // ✅ FIX: use date string (IST calendar day) to find prior visits
  // IPs with a pageview on a date BEFORE the period start date are returning
  const priorIps: string[] = await db
    .collection('pageviews')
    .distinct('ip', {
      ip: { $in: periodIps },
      date: { $lt: sinceStr },
    })

  const priorSet = new Set(priorIps)
  const returningVisitors = priorIps.length
  const newVisitors = periodIps.length - returningVisitors

  return {
    newVisitors,
    returningVisitors,
    total: periodIps.length,
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

// ─── User Link Analytics ──────────────────────────────────────────────────
export async function getUserLinkAnalytics(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  // All users with their links
  const users = await db.collection('shortusers').find({}).toArray()

  const result = await Promise.all(users.map(async (user: any) => {
    const userId = user._id

    // User ke links
    const links = await db.collection('shortlinks')
      .find({ userId })
      .sort({ clicks: -1 })
      .toArray()

    if (links.length === 0) return null

    const linkCodes = links.map((l: any) => l.code)

    // Total clicks in period
    const clicksInPeriod = await db.collection('shortclicks').countDocuments({
      code: { $in: linkCodes },
      clickedAt: { $gte: since }
    })

    // Country breakdown
    const byCountry = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray()

    // Device breakdown
    const byDevice = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()

    // Daily clicks (last 7 days)
    const dailyClicks = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const count = await db.collection('shortclicks').countDocuments({
        code: { $in: linkCodes },
        clickedAt: { $gte: dayStart, $lte: dayEnd }
      })
      dailyClicks.push({
        date: dayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        clicks: count
      })
    }

    // Unique IPs in period
    const uniqueIps: string[] = await db.collection('shortclicks')
      .distinct('ip', { code: { $in: linkCodes }, clickedAt: { $gte: since } })

    // Returning visitors: IPs jo pehle bhi click kar chuke hain
    const priorIps: string[] = await db.collection('shortclicks')
      .distinct('ip', {
        code: { $in: linkCodes },
        clickedAt: { $lt: since },
        ip: { $in: uniqueIps }
      })

    const returningVisitors = priorIps.length
    const newVisitors = uniqueIps.length - returningVisitors

    // Per-link stats
    const linkStats = await Promise.all(links.map(async (link: any) => {
      const clicksInRange = await db.collection('shortclicks').countDocuments({
        code: link.code,
        clickedAt: { $gte: since }
      })
      return {
        code: link.code,
        label: link.label,
        url: link.url,
        totalClicks: link.clicks || 0,
        clicksInPeriod: clicksInRange,
        lastClicked: link.lastClicked,
      }
    }))

    return {
      userId: userId.toString(),
      username: user.username,
      realName: user.realName,
      ratePerThousand: user.ratePerThousand || 10,
      totalClicks: user.totalClicks || 0,
      clicksInPeriod,
      uniqueVisitors: uniqueIps.length,
      newVisitors,
      returningVisitors,
      byCountry: byCountry.map((c: any) => ({ country: c._id || 'Unknown', count: c.count })),
      byDevice: byDevice.map((d: any) => ({ device: d._id || 'unknown', count: d.count })),
      dailyClicks,
      links: linkStats,
    }
  }))

  return {
    users: result.filter(Boolean).sort((a: any, b: any) => b.clicksInPeriod - a.clicksInPeriod)
  }
}

// ─── FEATURE 1+2: Earnings Timeline + Link Health ─────────────────────────
export async function getEarningsAndLinkHealth(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const users = await db.collection('shortusers').find({}).toArray()

  const result = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks')
      .find({ userId })
      .sort({ clicks: -1 })
      .toArray()

    if (links.length === 0) return null

    const linkCodes = links.map((l: any) => l.code)
    const rate = user.ratePerThousand || 10

    // Daily earnings last 30 days
    const earningsTimeline = []
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const clicks = await db.collection('shortclicks').countDocuments({
        code: { $in: linkCodes },
        clickedAt: { $gte: dayStart, $lte: dayEnd }
      })
      earningsTimeline.push({
        date: getISTDateStr(dayStart),
        clicks,
        earnings: parseFloat(((clicks * rate) / 1000).toFixed(4))
      })
    }

    // Projected monthly earnings (based on last 7 days average)
    const last7 = earningsTimeline.slice(-7)
    const avgDailyEarnings = last7.reduce((s, d) => s + d.earnings, 0) / 7
    const projectedMonthly = parseFloat((avgDailyEarnings * 30).toFixed(2))

    // Link health
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const linkHealth = await Promise.all(links.map(async (link: any) => {
      const recentClicks = await db.collection('shortclicks').countDocuments({
        code: link.code,
        clickedAt: { $gte: sevenDaysAgo }
      })
      const last30 = await db.collection('shortclicks').countDocuments({
        code: link.code,
        clickedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
      const avgPer7Days = last30 / 4.28
      const status: string =
        recentClicks === 0 ? 'dead' :
        recentClicks < avgPer7Days * 0.5 ? 'declining' :
        recentClicks > avgPer7Days * 1.5 ? 'trending' : 'healthy'

      return {
        code: link.code,
        label: link.label,
        url: link.url,
        totalClicks: link.clicks || 0,
        recentClicks,
        status,
        lastClicked: link.lastClicked,
        createdAt: link.createdAt,
      }
    }))

    return {
      userId: userId.toString(),
      username: user.username,
      realName: user.realName,
      totalEarnings: user.totalEarnings || 0,
      unpaidEarnings: user.unpaidEarnings || 0,
      paidEarnings: user.paidEarnings || 0,
      ratePerThousand: rate,
      projectedMonthly,
      earningsTimeline,
      linkHealth,
      deadLinks: linkHealth.filter(l => l.status === 'dead').length,
      trendingLinks: linkHealth.filter(l => l.status === 'trending').length,
    }
  }))

  return { users: result.filter(Boolean) }
}

// ─── FEATURE 3: Fraud/Bot Detection ──────────────────────────────────────
export async function getFraudDetection(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const users = await db.collection('shortusers').find({}).toArray()

  const alerts = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks').find({ userId }).toArray()
    if (links.length === 0) return null
    const linkCodes = links.map((l: any) => l.code)

    // Same IP multiple clicks
    const ipCounts = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, codes: { $addToSet: '$code' } } },
      { $match: { count: { $gt: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    // Clicks per hour spike detection (any hour > 3x average)
    const hourlyClicks = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            hour: { $hour: '$clickedAt' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray()

    const avgHourly = hourlyClicks.length
      ? hourlyClicks.reduce((s: number, h: any) => s + h.count, 0) / hourlyClicks.length
      : 0
    const spikeHours = hourlyClicks.filter((h: any) => h.count > avgHourly * 3 && avgHourly > 0)

    // Unknown country clicks
    const unknownCountry = await db.collection('shortclicks').countDocuments({
      code: { $in: linkCodes },
      clickedAt: { $gte: since },
      $or: [{ country: 'Unknown' }, { country: null }, { country: '' }]
    })

    const totalClicks = await db.collection('shortclicks').countDocuments({
      code: { $in: linkCodes },
      clickedAt: { $gte: since }
    })

    const suspiciousIps = ipCounts.map((ip: any) => ({
      ip: ip._id,
      count: ip.count,
      codes: ip.codes
    }))

    const riskScore =
      (suspiciousIps.length > 0 ? 30 : 0) +
      (spikeHours.length > 0 ? 40 : 0) +
      (unknownCountry > totalClicks * 0.3 ? 30 : 0)

    return {
      userId: userId.toString(),
      username: user.username,
      realName: user.realName,
      totalClicks,
      riskScore,
      riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
      suspiciousIps,
      spikeHours: spikeHours.slice(0, 5).map((h: any) => ({
        date: h._id.date,
        hour: h._id.hour,
        count: h.count,
        avgHourly: Math.round(avgHourly)
      })),
      unknownCountryClicks: unknownCountry,
      unknownPct: totalClicks > 0 ? Math.round((unknownCountry / totalClicks) * 100) : 0,
    }
  }))

  return {
    alerts: alerts
      .filter(Boolean)
      .filter((a: any) => a.riskScore > 0)
      .sort((a: any, b: any) => b.riskScore - a.riskScore)
  }
}

// ─── FEATURE 4: Leaderboard + Streaks ─────────────────────────────────────
export async function getLeaderboard(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const today = getISTDateStr()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const users = await db.collection('shortusers').find({ isActive: true }).toArray()

  const board = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks').find({ userId }).toArray()
    if (links.length === 0) return null
    const codes = links.map((l: any) => l.code)

    const todayClicks = await db.collection('shortclicks').countDocuments({
      code: { $in: codes }, clickedAt: { $gte: todayStart }
    })
    const weekClicks = await db.collection('shortclicks').countDocuments({
      code: { $in: codes }, clickedAt: { $gte: weekStart }
    })

    // Streak: consecutive days with at least 1 click
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const dEnd = new Date(d)
      dEnd.setHours(23, 59, 59, 999)
      const count = await db.collection('shortclicks').countDocuments({
        code: { $in: codes }, clickedAt: { $gte: d, $lte: dEnd }
      })
      if (count > 0) streak++
      else break
    }

    // Login streak
    let loginStreak = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = getISTDateStr(d)
      const logged = await db.collection('shortlogins').findOne({
        userId, date: dateStr
      })
      if (logged) loginStreak++
      else break
    }

    return {
      userId: userId.toString(),
      username: user.username,
      realName: user.realName,
      totalClicks: user.totalClicks || 0,
      todayClicks,
      weekClicks,
      totalEarnings: user.totalEarnings || 0,
      unpaidEarnings: user.unpaidEarnings || 0,
      clickStreak: streak,
      loginStreak,
      ratePerThousand: user.ratePerThousand || 10,
    }
  }))

  const valid = board.filter(Boolean) as any[]

  return {
    byToday: [...valid].sort((a, b) => b.todayClicks - a.todayClicks),
    byWeek: [...valid].sort((a, b) => b.weekClicks - a.weekClicks),
    byAllTime: [...valid].sort((a, b) => b.totalClicks - a.totalClicks),
    byStreak: [...valid].sort((a, b) => b.clickStreak - a.clickStreak),
  }
}

// ─── FEATURE 5: Payment Analytics ─────────────────────────────────────────
export async function getPaymentAnalytics(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const totalPaidResult = await db.collection('shortusers').aggregate([
    { $group: { _id: null, totalPaid: { $sum: '$paidEarnings' }, totalUnpaid: { $sum: '$unpaidEarnings' } } }
  ]).toArray()

  const totals = totalPaidResult[0] || { totalPaid: 0, totalUnpaid: 0 }

  // Users near threshold (1000 clicks)
  const nearThreshold = await db.collection('shortusers').find({
    totalClicks: { $gte: 700, $lt: 1000 },
    isActive: true
  }).toArray()

  // Payment history (last 10)
  const recentPayments = await db.collection('payments')
    .find({})
    .sort({ paidAt: -1 })
    .limit(10)
    .toArray()

  // Monthly payment trend (last 6 months)
  const monthlyTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const result = await db.collection('payments').aggregate([
      { $match: { paidAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]).toArray()
    monthlyTrend.push({
      month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      amount: result[0]?.total || 0,
      count: result[0]?.count || 0
    })
  }

  // Pending requests
  const pendingPayments = await db.collection('shortrequests').find({
    type: 'payment', status: 'pending'
  }).toArray()

  // Per-user payment summary
  const users = await db.collection('shortusers')
    .find({ totalClicks: { $gt: 0 } })
    .sort({ unpaidEarnings: -1 })
    .toArray()

  return {
    totalPaid: totals.totalPaid,
    totalUnpaid: totals.totalUnpaid,
    pendingCount: pendingPayments.length,
    nearThreshold: nearThreshold.map((u: any) => ({
      userId: u._id.toString(),
      username: u.username,
      realName: u.realName,
      totalClicks: u.totalClicks,
      remaining: 1000 - u.totalClicks,
      unpaidEarnings: u.unpaidEarnings || 0
    })),
    recentPayments: recentPayments.map((p: any) => ({
      username: p.username,
      realName: p.realName,
      amount: p.amount,
      note: p.note,
      paidAt: p.paidAt
    })),
    monthlyTrend,
    users: users.map((u: any) => ({
      userId: u._id.toString(),
      username: u.username,
      realName: u.realName,
      totalClicks: u.totalClicks || 0,
      totalEarnings: u.totalEarnings || 0,
      paidEarnings: u.paidEarnings || 0,
      unpaidEarnings: u.unpaidEarnings || 0,
      ratePerThousand: u.ratePerThousand || 10,
    }))
  }
}

// ─── FEATURE 6: User Cohort Analysis ──────────────────────────────────────
export async function getCohortAnalysis(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const users = await db.collection('shortusers').find({}).toArray()

  const cohorts: Record<string, any> = {}

  for (const user of users) {
    if (!user.createdAt) continue
    const joinDate = new Date(user.createdAt)
    const cohortKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`

    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = { month: cohortKey, total: 0, active30: 0, active60: 0, active90: 0, totalClicks: 0, totalEarnings: 0 }
    }

    cohorts[cohortKey].total++
    cohorts[cohortKey].totalClicks += user.totalClicks || 0
    cohorts[cohortKey].totalEarnings += user.totalEarnings || 0

    const now = Date.now()
    const joinTime = joinDate.getTime()
    const daysSinceJoin = Math.floor((now - joinTime) / (1000 * 60 * 60 * 24))

    if (user.totalClicks > 0) {
      if (daysSinceJoin >= 30) cohorts[cohortKey].active30++
      if (daysSinceJoin >= 60) cohorts[cohortKey].active60++
      if (daysSinceJoin >= 90) cohorts[cohortKey].active90++
    }
  }

  const cohortList = Object.values(cohorts)
    .sort((a: any, b: any) => a.month.localeCompare(b.month))
    .map((c: any) => ({
      ...c,
      retention30: c.total > 0 ? Math.round((c.active30 / c.total) * 100) : 0,
      retention60: c.total > 0 ? Math.round((c.active60 / c.total) * 100) : 0,
      retention90: c.total > 0 ? Math.round((c.active90 / c.total) * 100) : 0,
      avgClicks: c.total > 0 ? Math.round(c.totalClicks / c.total) : 0,
    }))

  return { cohorts: cohortList }
}

// ─── FEATURE 7: Link Journey (shortclick → pageview join) ─────────────────
export async function getLinkJourney(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const users = await db.collection('shortusers').find({}).toArray()

  const result = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks').find({ userId }).toArray()
    if (links.length === 0) return null
    const codes = links.map((l: any) => l.code)

    // All clicks with IP + timestamp
    const clicks = await db.collection('shortclicks')
      .find({ code: { $in: codes }, clickedAt: { $gte: since } })
      .toArray()

    // For each click, find pageview within 5 minutes from same IP
    let detailVisits = 0, downloadVisits = 0, bounces = 0

    await Promise.all(clicks.map(async (click: any) => {
      const windowEnd = new Date(click.clickedAt.getTime() + 5 * 60 * 1000)
      const pv = await db.collection('pageviews').findOne({
        ip: click.ip,
        timestamp: { $gte: click.clickedAt, $lte: windowEnd }
      })
      if (!pv) { bounces++; return }
      if (pv.pageType === 'anime-detail') detailVisits++
      if (pv.pageType === 'download') downloadVisits++
    }))

    const total = clicks.length
    return {
      userId: userId.toString(),
      username: user.username,
      realName: user.realName,
      totalClicks: total,
      detailVisits,
      downloadVisits,
      bounces,
      bounceRate: total > 0 ? Math.round((bounces / total) * 100) : 0,
      detailRate: total > 0 ? Math.round((detailVisits / total) * 100) : 0,
      downloadRate: total > 0 ? Math.round((downloadVisits / total) * 100) : 0,
    }
  }))

  return {
    journeys: result
      .filter(Boolean)
      .filter((j: any) => j.totalClicks > 0)
      .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
  }
}