 // src/services/analyticsService.ts
import { getDb } from './mongoService'
import { ObjectId } from 'mongodb'
import { EarningType, ISubAdminAnimeEarning, ISubAdminEarningsSummary } from '../models/types'

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
  // 🆕 EARNINGS fields — only populated for pageType === 'download'
  earningType?: EarningType
  animeId?: string
  subAdminId?: string
}

// 🆕 EARNINGS: signals passed in from the route handler describing the
// link-5 / special-mode state AT THE MOMENT the pageview happened. Must be
// resolved write-time — we can't reconstruct "what was link5's state" later.
export interface EarningContext {
  link5Active: boolean       // linksettings.link5 === true at time of view
  specialModeForcing: boolean // isForceLink5ModeActive() === true at time of view
}

// Helper: returns date string in Indian Standard Time (UTC+5:30)
function getISTDateStr(d: Date = new Date()): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000
  const istDate = new Date(d.getTime() + IST_OFFSET)
  return istDate.toISOString().slice(0, 10)
}

// ─── Sub-admin scoping helper ──────────────────────────────────────────────
function slugFilter(ownedSlugs?: string[] | null): Record<string, any> {
  if (!ownedSlugs) return {}
  return { slug: { $in: ownedSlugs } }
}

function creatorFilter(creatorId?: string | null): Record<string, any> {
  if (!creatorId) return {}
  return { createdByAdminId: creatorId }
}

// ─── Sub-admin name attribution (for main admin's view) ───────────────────
// List of all sub-admins — powers the "Filter by Sub-Admin" dropdown.
export async function getSubAdminsList(mongoUri: string, dbName: string) {
  const db = await getDb(mongoUri, dbName)
  const subs = await db.collection('subadmins')
    .find({}, { projection: { username: 1, realName: 1 } })
    .toArray()
  return subs.map((s: any) => ({
    id: s._id.toString(),
    username: s.username,
    realName: s.realName || s.username,
  }))
}

// admin _id (string) -> display name
async function getSubAdminNameMap(mongoUri: string, dbName: string): Promise<Map<string, string>> {
  const db = await getDb(mongoUri, dbName)
  const subs = await db.collection('subadmins')
    .find({}, { projection: { username: 1, realName: 1 } })
    .toArray()
  return new Map(subs.map((s: any) => [s._id.toString(), s.realName || s.username]))
}

// slug -> { animeId, animeTitle, creatorUsername } — covers BOTH anime
// slugs (detail/episode) AND download-page slugs (via their animeId link).
// creatorUsername sirf tab compute hota hai jab includeCreator=true (main
// admin ka unrestricted view) — sub-admin ko iski zarurat nahi.
async function getSlugMetaMap(
  mongoUri: string,
  dbName: string,
  includeCreator: boolean
): Promise<Map<string, { animeId?: string; animeTitle?: string; creatorUsername?: string | null }>> {
  const db = await getDb(mongoUri, dbName)
  const nameMap = includeCreator ? await getSubAdminNameMap(mongoUri, dbName) : null

  const animes = await db.collection('animes')
    .find({}, { projection: { slug: 1, title: 1, createdBy: 1 } })
    .toArray()

  const map = new Map<string, { animeId?: string; animeTitle?: string; creatorUsername?: string | null }>()
  const animeInfoById = new Map<string, { animeTitle: string; creatorUsername: string | null }>()

  for (const a of animes) {
    const animeId = a._id.toString()
    const creatorId = a.createdBy?.toString()
    const creatorUsername = nameMap ? (creatorId ? (nameMap.get(creatorId) || null) : null) : null
    const info = { animeTitle: a.title || 'Unknown', creatorUsername }
    animeInfoById.set(animeId, info)
    if (a.slug) map.set(a.slug, { animeId, ...info })
  }

  // ─── Download pages inherit animeId/title/creator from their parent anime ──
  const downloadPages = await db.collection('downloadpages')
    .find({}, { projection: { slug: 1, animeId: 1 } })
    .toArray()

  for (const dp of downloadPages) {
    if (!dp.slug) continue
    const animeIdStr = dp.animeId?.toString()
    const info = animeIdStr ? animeInfoById.get(animeIdStr) : undefined
    map.set(dp.slug, { animeId: animeIdStr, ...(info || {}) })
  }

  return map
}

// 🆕 EARNINGS: resolve { animeId, subAdminId (createdBy) } for a download-page
// (or anime-detail) slug. Cached per-call via getDb; cheap enough for the
// pageview write path since it's just two small indexed-ish lookups.
async function resolveAnimeOwnerForSlug(
  slug: string | undefined,
  mongoUri: string,
  dbName: string
): Promise<{ animeId?: string; subAdminId?: string }> {
  if (!slug) return {}
  const db = await getDb(mongoUri, dbName)

  // Try as a direct anime slug first
  const anime = await db.collection('animes').findOne(
    { slug },
    { projection: { createdBy: 1 } }
  )
  if (anime) {
    return {
      animeId: anime._id.toString(),
      subAdminId: anime.createdBy ? anime.createdBy.toString() : undefined,
    }
  }

  // Fall back to download-page slug -> parent anime
  const dp = await db.collection('downloadpages').findOne(
    { slug },
    { projection: { animeId: 1 } }
  )
  if (dp?.animeId) {
    const parentAnime = await db.collection('animes').findOne(
      { _id: dp.animeId },
      { projection: { createdBy: 1 } }
    )
    if (parentAnime) {
      return {
        animeId: dp.animeId.toString(),
        subAdminId: parentAnime.createdBy ? parentAnime.createdBy.toString() : undefined,
      }
    }
  }

  return {}
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
  data: Omit<PageViewRecord, 'timestamp' | 'date' | 'earningType' | 'animeId' | 'subAdminId'>,
  mongoUri: string,
  dbName: string,
  earningContext?: EarningContext // 🆕 EARNINGS — only relevant when data.pageType === 'download'
): Promise<void> {
  const db = await getDb(mongoUri, dbName)
  const now = new Date()
  const date = getISTDateStr(now)

  let country = data.country
  let region = data.region
  let city = data.city

  if (!country || !region) {
    const geo = await enrichGeo(data.ip)
    country = country || geo.country
    region = region || geo.region
    city = city || geo.city
  }

  // 🆕 EARNINGS: only download-page views are earnings-relevant. Category is
  // decided from the link-5 / special-mode state AT THE TIME of this view —
  // never recomputed later, since that state changes over time.
  let earningType: EarningType | undefined
  let animeId: string | undefined
  let subAdminId: string | undefined

  if (data.pageType === 'download') {
    const owner = await resolveAnimeOwnerForSlug(data.slug, mongoUri, dbName)
    animeId = owner.animeId
    subAdminId = owner.subAdminId

    if (earningContext) {
      if (earningContext.specialModeForcing) {
        earningType = 'special-mode'
      } else if (earningContext.link5Active) {
        earningType = 'link5-direct'
      } else {
        earningType = 'normal'
      }
    }
  }

  await db.collection('pageviews').insertOne({
    ...data,
    country,
    region,
    city,
    timestamp: now,
    date,
    createdAt: now,
    ...(earningType ? { earningType } : {}),
    ...(animeId ? { animeId } : {}),
    ...(subAdminId ? { subAdminId } : {}),
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
  device?: string,
  ownedSlugs?: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const scope = slugFilter(ownedSlugs)

  const baseMatch: Record<string, any> = { date: { $gte: sinceStr }, ...scope }
  if (device) baseMatch.device = device

  const todayStr = getISTDateStr()

  const todayMatch: Record<string, any> = { date: todayStr, ...scope }
  if (device) todayMatch.device = device
  const todayViews = await db.collection('pageviews').countDocuments(todayMatch)

  const todayUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', todayMatch)
    .then((arr: string[]) => arr.length)

  const totalViews = await db.collection('pageviews').countDocuments(baseMatch)

  const allTimeMatch: Record<string, any> = { ...scope }
  if (device) allTimeMatch.device = device
  const allTimeTotalViews = await db.collection('pageviews').countDocuments(allTimeMatch)

  const allTimeUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', allTimeMatch)
    .then((arr: string[]) => arr.length)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysStr = getISTDateStr(sevenDaysAgo)
  const sevenDayMatch: Record<string, any> = { date: { $gte: sevenDaysStr }, ...scope }
  if (device) sevenDayMatch.device = device

  const last7DaysUniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', sevenDayMatch)
    .then((arr: string[]) => arr.length)

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
        { $match: { date: { $gte: sinceStr }, ...scope } },
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
      { $match: { date: { $gte: sinceStr }, ...scope } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  // Unique visitors (selected period)
  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', baseMatch)
    .then((arr: string[]) => arr.length)

  // Geo stats — views by country
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

  // ─── Slug metadata: animeId + animeTitle (always) + creator name (main
  // admin view only) — powers both the missing-animeTitle fix and the
  // anime-detail/download combining below.
  const slugMeta = await getSlugMetaMap(
    mongoUri, dbName,
    ownedSlugs === null || ownedSlugs === undefined
  )

  const rawTopPages = topPages.map((p: any) => {
    const slug = p.slug as string | undefined
    const meta = slug ? slugMeta.get(slug) : undefined
    return {
      path: p.path ?? '/' + p._id,
      views: p.views,
      pageType: p.pageType,
      animeTitle: p.animeTitle || meta?.animeTitle,
      slug,
      animeId: meta?.animeId,
      createdByUsername: meta?.creatorUsername ?? null,
    }
  })

  // ─── Combine anime-detail + episode + download rows for the SAME anime
  // into a single row. This lets admins see, at a glance, how many of an
  // anime's detail-page visitors continued on to its download page —
  // instead of two separate, hard-to-compare rows.
  const COMBINABLE_TYPES = new Set(['anime-detail', 'episode', 'download'])
  const combinedByAnimeId = new Map<string, any>()
  const finalTopPages: any[] = []

  for (const row of rawTopPages) {
    if (row.animeId && COMBINABLE_TYPES.has(row.pageType)) {
      let entry = combinedByAnimeId.get(row.animeId)
      if (!entry) {
        entry = {
          path: row.path,
          views: 0,
          pageType: 'anime-combined',
          animeTitle: row.animeTitle,
          slug: row.slug,
          animeId: row.animeId,
          createdByUsername: row.createdByUsername,
          detailViews: 0,   // anime-detail + episode combined
          downloadViews: 0, // download page only
        }
        combinedByAnimeId.set(row.animeId, entry)
        finalTopPages.push(entry)
      }
      entry.views += row.views
      if (row.pageType === 'download') entry.downloadViews += row.views
      else entry.detailViews += row.views
      if (!entry.animeTitle && row.animeTitle) entry.animeTitle = row.animeTitle
    } else {
      finalTopPages.push(row)
    }
  }

  finalTopPages.sort((a, b) => b.views - a.views)

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
    topPages: finalTopPages,
    byType: byType.map((t: any) => ({ type: t._id, views: t.views })),
    byDevice: byDevice.map((d: any) => ({ device: d._id || 'unknown', count: d.count })),
  }
}

// ─── Geo detail — groups by region (state) and city ───────────────────────
export async function getGeoDetail(
  country: string,
  mongoUri: string,
  dbName: string,
  days = 30,
  ownedSlugs?: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)
  const scope = slugFilter(ownedSlugs)

  const match = { country, date: { $gte: sinceStr }, ...scope }

  const result = await db
    .collection('pageviews')
    .aggregate([
      { $match: match },
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

  const totalViews = await db.collection('pageviews').countDocuments(match)

  const uniqueVisitors = await db
    .collection('pageviews')
    .distinct('ip', match)
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

// ─── Country breakdown by period ──────────────────────────────────────────
export async function getByCountryStats(
  mongoUri: string,
  dbName: string,
  days = 1,
  ownedSlugs?: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)
  const scope = slugFilter(ownedSlugs)

  const match: Record<string, any> = { date: { $gte: sinceStr }, ...scope }

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

// ─── Referrer / traffic source breakdown ───────────────────────────────────
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

// ─── Browser breakdown ─────────────────────────────────────────────────────
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

// ─── Average time on page ──────────────────────────────────────────────────
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

// ─── Real-time / live visitors (active in last 5 minutes) ──────────────────
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

// ─── Top anime overall ─────────────────────────────────────────────────────
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

// ─── Hourly heatmap (IST) ──────────────────────────────────────────────────
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

// ─── 404 / not-found page tracking ─────────────────────────────────────────
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

// ─── New vs returning visitors ─────────────────────────────────────────────
export async function getNewVsReturning(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = getISTDateStr(since)

  const periodIps: string[] = await db
    .collection('pageviews')
    .distinct('ip', { date: { $gte: sinceStr } })

  if (periodIps.length === 0) {
    return { newVisitors: 0, returningVisitors: 0, total: 0 }
  }

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
  days = 7,
  creatorId?: string | null
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const users = await db.collection('shortusers').find(creatorFilter(creatorId)).toArray()
  const nameMap = !creatorId ? await getSubAdminNameMap(mongoUri, dbName) : null

  const result = await Promise.all(users.map(async (user: any) => {
    const userId = user._id

    const links = await db.collection('shortlinks')
      .find({ userId })
      .sort({ clicks: -1 })
      .toArray()

    if (links.length === 0) return null

    const linkCodes = links.map((l: any) => l.code)

    const clicksInPeriod = await db.collection('shortclicks').countDocuments({
      code: { $in: linkCodes },
      clickedAt: { $gte: since }
    })

    const byCountry = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray()

    const byDevice = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()

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

    const uniqueIps: string[] = await db.collection('shortclicks')
      .distinct('ip', { code: { $in: linkCodes }, clickedAt: { $gte: since } })

    const priorIps: string[] = await db.collection('shortclicks')
      .distinct('ip', {
        code: { $in: linkCodes },
        clickedAt: { $lt: since },
        ip: { $in: uniqueIps }
      })

    const returningVisitors = priorIps.length
    const newVisitors = uniqueIps.length - returningVisitors

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
      creatorUsername: nameMap ? (nameMap.get(user.createdByAdminId) || 'Main Admin') : undefined,
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

// ─── Earnings Timeline + Link Health ───────────────────────────────────────
export async function getEarningsAndLinkHealth(
  mongoUri: string,
  dbName: string,
  creatorId?: string | null
) {
  const db = await getDb(mongoUri, dbName)

  const users = await db.collection('shortusers').find(creatorFilter(creatorId)).toArray()
  const nameMap = !creatorId ? await getSubAdminNameMap(mongoUri, dbName) : null

  const result = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks')
      .find({ userId })
      .sort({ clicks: -1 })
      .toArray()

    if (links.length === 0) return null

    const linkCodes = links.map((l: any) => l.code)
    const rate = user.ratePerThousand || 10

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

    const last7 = earningsTimeline.slice(-7)
    const avgDailyEarnings = last7.reduce((s, d) => s + d.earnings, 0) / 7
    const projectedMonthly = parseFloat((avgDailyEarnings * 30).toFixed(2))

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
      creatorUsername: nameMap ? (nameMap.get(user.createdByAdminId) || 'Main Admin') : undefined,
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

// ─── Fraud/Bot Detection ───────────────────────────────────────────────────
export async function getFraudDetection(
  mongoUri: string,
  dbName: string,
  days = 7,
  creatorId?: string | null
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const users = await db.collection('shortusers').find(creatorFilter(creatorId)).toArray()
  const nameMap = !creatorId ? await getSubAdminNameMap(mongoUri, dbName) : null

  const alerts = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks').find({ userId }).toArray()
    if (links.length === 0) return null
    const linkCodes = links.map((l: any) => l.code)

    const ipCounts = await db.collection('shortclicks').aggregate([
      { $match: { code: { $in: linkCodes }, clickedAt: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, codes: { $addToSet: '$code' } } },
      { $match: { count: { $gt: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

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
      creatorUsername: nameMap ? (nameMap.get(user.createdByAdminId) || 'Main Admin') : undefined,
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

// ─── Leaderboard + Streaks ─────────────────────────────────────────────────
export async function getLeaderboard(
  mongoUri: string,
  dbName: string,
  creatorId?: string | null
) {
  const db = await getDb(mongoUri, dbName)
  const today = getISTDateStr()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const userFilter: any = { isActive: true, ...creatorFilter(creatorId) }
  const users = await db.collection('shortusers').find(userFilter).toArray()
  const nameMap = !creatorId ? await getSubAdminNameMap(mongoUri, dbName) : null

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
      creatorUsername: nameMap ? (nameMap.get(user.createdByAdminId) || 'Main Admin') : undefined,
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

// ─── Payment Analytics ─────────────────────────────────────────────────────
export async function getPaymentAnalytics(
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const totalPaidResult = await db.collection('shortusers').aggregate([
    { $group: { _id: null, totalPaid: { $sum: '$paidEarnings' }, totalUnpaid: { $sum: '$unpaidEarnings' } } }
  ]).toArray()

  const totals = totalPaidResult[0] || { totalPaid: 0, totalUnpaid: 0 }

  const nearThreshold = await db.collection('shortusers').find({
    totalClicks: { $gte: 700, $lt: 1000 },
    isActive: true
  }).toArray()

  const recentPayments = await db.collection('payments')
    .find({})
    .sort({ paidAt: -1 })
    .limit(10)
    .toArray()

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

  const pendingPayments = await db.collection('shortrequests').find({
    type: 'payment', status: 'pending'
  }).toArray()

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

// ─── User Cohort Analysis ──────────────────────────────────────────────────
export async function getCohortAnalysis(
  mongoUri: string,
  dbName: string,
  creatorId?: string | null
) {
  const db = await getDb(mongoUri, dbName)

  const users = await db.collection('shortusers').find(creatorFilter(creatorId)).toArray()

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

// ─── Link Journey – Per User + Per Link ────────────────────────────────────
export async function getLinkJourney(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const users = await db.collection('shortusers').find({}).toArray()

  const userResults = await Promise.all(users.map(async (user: any) => {
    const userId = user._id
    const links = await db.collection('shortlinks').find({ userId }).toArray()
    if (links.length === 0) return null
    const codes = links.map((l: any) => l.code)

    const clicks = await db.collection('shortclicks')
      .find({ code: { $in: codes }, clickedAt: { $gte: since } })
      .toArray()

    let detailVisits = 0, downloadVisits = 0, bounces = 0
    const linkJourneyMap: Record<string, { detail: number; download: number; bounce: number }> = {}
    for (const l of links) linkJourneyMap[l.code] = { detail: 0, download: 0, bounce: 0 }

    await Promise.all(clicks.map(async (click: any) => {
      const windowEnd = new Date(click.clickedAt.getTime() + 5 * 60 * 1000)
      const pv = await db.collection('pageviews').findOne({
        ip: click.ip,
        timestamp: { $gte: click.clickedAt, $lte: windowEnd }
      })
      if (!pv) {
        bounces++
        linkJourneyMap[click.code].bounce++
      } else {
        if (pv.pageType === 'anime-detail') {
          detailVisits++
          linkJourneyMap[click.code].detail++
        }
        if (pv.pageType === 'download') {
          downloadVisits++
          linkJourneyMap[click.code].download++
        }
      }
    }))

    const total = clicks.length
    const linkJourney = links.map((l: any) => ({
      code: l.code,
      label: l.label,
      url: l.url,
      totalClicks: clicks.filter(c => c.code === l.code).length,
      detailVisits: linkJourneyMap[l.code].detail,
      downloadVisits: linkJourneyMap[l.code].download,
      bounces: linkJourneyMap[l.code].bounce,
      bounceRate: clicks.filter(c => c.code === l.code).length > 0
        ? Math.round((linkJourneyMap[l.code].bounce / clicks.filter(c => c.code === l.code).length) * 100) : 0,
    }))

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
      linkJourney,
    }
  }))

  return {
    journeys: userResults
      .filter(Boolean)
      .filter((j: any) => j.totalClicks > 0)
      .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
  }
}

export async function getLinkJourneyByLink(
  mongoUri: string,
  dbName: string,
  days = 7
) {
  const db = await getDb(mongoUri, dbName)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const allLinks = await db.collection('shortlinks').find({}).toArray()
  const result = []

  for (const link of allLinks) {
    const clicks = await db.collection('shortclicks')
      .find({ code: link.code, clickedAt: { $gte: since } })
      .toArray()
    if (clicks.length === 0) continue

    let detail = 0, download = 0, bounce = 0
    for (const click of clicks) {
      const windowEnd = new Date(click.clickedAt.getTime() + 5 * 60 * 1000)
      const pv = await db.collection('pageviews').findOne({
        ip: click.ip,
        timestamp: { $gte: click.clickedAt, $lte: windowEnd }
      })
      if (!pv) bounce++
      else {
        if (pv.pageType === 'anime-detail') detail++
        if (pv.pageType === 'download') download++
      }
    }

    result.push({
      code: link.code,
      label: link.label,
      url: link.url,
      totalClicks: clicks.length,
      detailVisits: detail,
      downloadVisits: download,
      bounces: bounce,
      bounceRate: Math.round((bounce / clicks.length) * 100),
      detailRate: Math.round((detail / clicks.length) * 100),
      downloadRate: Math.round((download / clicks.length) * 100),
      username: link.username || '',
    })
  }

  return { links: result.sort((a, b) => b.totalClicks - a.totalClicks) }
}

// ─── User Self Analytics ───────────────────────────────────────────────────
export async function getUserSelfAnalytics(
  userId: string,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const uid = new ObjectId(userId)

  const links = await db.collection('shortlinks')
    .find({ userId: uid })
    .sort({ clicks: -1 })
    .toArray()

  const linkCodes = links.map((l: any) => l.code)

  const dailyClicks30: { date: string; clicks: number; earnings: number }[] = []
  const user = await db.collection('shortusers').findOne({ _id: uid })
  const rate = user?.ratePerThousand || 10

  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setDate(dayStart.getDate() - i)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const count = linkCodes.length
      ? await db.collection('shortclicks').countDocuments({
          code: { $in: linkCodes },
          clickedAt: { $gte: dayStart, $lte: dayEnd }
        })
      : 0
    dailyClicks30.push({
      date: getISTDateStr(dayStart),
      clicks: count,
      earnings: parseFloat(((count * rate) / 1000).toFixed(4))
    })
  }

  const last7Avg = dailyClicks30.slice(-7).reduce((s, d) => s + d.earnings, 0) / 7
  const projectedMonthly = parseFloat((last7Avg * 30).toFixed(2))

  const byCountry = linkCodes.length
    ? await db.collection('shortclicks').aggregate([
        { $match: { code: { $in: linkCodes } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]).toArray()
    : []

  const byDevice = linkCodes.length
    ? await db.collection('shortclicks').aggregate([
        { $match: { code: { $in: linkCodes } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray()
    : []

  const since7 = new Date()
  since7.setDate(since7.getDate() - 7)
  since7.setHours(0, 0, 0, 0)

  const linkStats = await Promise.all(links.map(async (link: any) => {
    const recent = await db.collection('shortclicks').countDocuments({
      code: link.code,
      clickedAt: { $gte: since7 }
    })
    const last30count = await db.collection('shortclicks').countDocuments({
      code: link.code,
      clickedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
    const avg7 = last30count / 4.28
    const status =
      recent === 0 ? 'dead' :
      recent < avg7 * 0.5 ? 'declining' :
      recent > avg7 * 1.5 ? 'trending' : 'healthy'

    return {
      code: link.code,
      label: link.label,
      totalClicks: link.clicks || 0,
      recentClicks: recent,
      earnings: parseFloat(((link.clicks || 0) * rate / 1000).toFixed(2)),
      status,
      lastClicked: link.lastClicked,
    }
  }))

  const allIps: string[] = linkCodes.length
    ? await db.collection('shortclicks').distinct('ip', { code: { $in: linkCodes } })
    : []

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)

  const recentIps: string[] = linkCodes.length
    ? await db.collection('shortclicks').distinct('ip', {
        code: { $in: linkCodes },
        clickedAt: { $gte: since30 }
      })
    : []

  const priorIps: string[] = recentIps.length
    ? await db.collection('shortclicks').distinct('ip', {
        code: { $in: linkCodes },
        clickedAt: { $lt: since30 },
        ip: { $in: recentIps }
      })
    : []

  let clickStreak = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dEnd = new Date(d)
    dEnd.setHours(23, 59, 59, 999)
    const count = linkCodes.length
      ? await db.collection('shortclicks').countDocuments({
          code: { $in: linkCodes },
          clickedAt: { $gte: d, $lte: dEnd }
        })
      : 0
    if (count > 0) clickStreak++
    else break
  }

  const bestDayRaw = linkCodes.length
    ? await db.collection('shortclicks').aggregate([
        { $match: { code: { $in: linkCodes } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).toArray()
    : []

  const bestDay = bestDayRaw[0]
    ? { date: bestDayRaw[0]._id, clicks: bestDayRaw[0].count }
    : null

  return {
    rate,
    projectedMonthly,
    clickStreak,
    bestDay,
    dailyClicks30,
    byCountry: byCountry.map((c: any) => ({
      country: c._id || 'Unknown',
      count: c.count
    })),
    byDevice: byDevice.map((d: any) => ({
      device: d._id || 'unknown',
      count: d.count
    })),
    linkStats,
    newVisitors: recentIps.length - priorIps.length,
    returningVisitors: priorIps.length,
    totalUniqueVisitors: allIps.length,
  }
}

// ─── Monthly Overview: har month ka total (start se ab tak) ───────────────
export async function getMonthlyOverview(
  mongoUri: string,
  dbName: string,
  ownedSlugs?: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const scope = slugFilter(ownedSlugs)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      { $match: scope },
      {
        $group: {
          _id: { $substrCP: ['$date', 0, 7] }, // "YYYY-MM"
          views: { $sum: 1 },
          animeViews: {
            $sum: { $cond: [{ $in: ['$pageType', ['anime-detail', 'episode']] }, 1, 0] }
          },
          downloadViews: {
            $sum: { $cond: [{ $eq: ['$pageType', 'download'] }, 1, 0] }
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  return {
    months: raw.map((m: any) => ({
      month: m._id,
      views: m.views,
      animeViews: m.animeViews,
      downloadViews: m.downloadViews,
    })),
  }
}

// ─── Monthly Detail: ek month ke andar har din ka breakdown ───────────────
export async function getMonthlyDetail(
  mongoUri: string,
  dbName: string,
  month: string, // "YYYY-MM"
  ownedSlugs?: string[] | null
) {
  const db = await getDb(mongoUri, dbName)
  const scope = slugFilter(ownedSlugs)

  const [yearStr, monStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const mon = parseInt(monStr, 10)
  if (!year || !mon || mon < 1 || mon > 12) {
    throw new Error('Invalid month format, expected YYYY-MM')
  }

  const daysInMonth = new Date(year, mon, 0).getDate()
  const todayStr = getISTDateStr()
  const isCurrentMonth = todayStr.slice(0, 7) === month
  const lastDay = isCurrentMonth ? parseInt(todayStr.slice(8, 10), 10) : daysInMonth

  const match: Record<string, any> = {
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
    ...scope,
  }

  const raw = await db
    .collection('pageviews')
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          totalViews: { $sum: 1 },
          animeViews: {
            $sum: { $cond: [{ $in: ['$pageType', ['anime-detail', 'episode']] }, 1, 0] }
          },
          downloadViews: {
            $sum: { $cond: [{ $eq: ['$pageType', 'download'] }, 1, 0] }
          },
        },
      },
    ])
    .toArray()

  const dayMap = new Map<string, { totalViews: number; animeViews: number; downloadViews: number }>(
    raw.map((d: any) => [d._id, { totalViews: d.totalViews, animeViews: d.animeViews, downloadViews: d.downloadViews }])
  )

  const days: { date: string; totalViews: number; animeViews: number; downloadViews: number; otherViews: number }[] = []
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    const d = dayMap.get(dateStr) || { totalViews: 0, animeViews: 0, downloadViews: 0 }
    days.push({
      date: dateStr,
      totalViews: d.totalViews,
      animeViews: d.animeViews,
      downloadViews: d.downloadViews,
      otherViews: Math.max(d.totalViews - d.animeViews - d.downloadViews, 0),
    })
  }

  const totals = days.reduce(
    (acc, d) => ({
      totalViews: acc.totalViews + d.totalViews,
      animeViews: acc.animeViews + d.animeViews,
      downloadViews: acc.downloadViews + d.downloadViews,
      otherViews: acc.otherViews + d.otherViews,
    }),
    { totalViews: 0, animeViews: 0, downloadViews: 0, otherViews: 0 }
  )

  return { month, days, totals }
}

// ══════════════════════════════════════════════════════════════════════════
// 🆕 SUB-ADMIN EARNINGS (view → $ tracking, per anime, split by earningType)
// ══════════════════════════════════════════════════════════════════════════

// Minimal shape we actually read off a `subadmins` document for earnings
// calculations. Explicitly casting findOne()'s result to this interface
// (instead of leaving it as the driver's loosely-typed Document) is what
// fixes the "not assignable" red-line at resolveEffectiveRate(subAdmin, ...)
// and at the subAdmin.username / subAdmin.fullName reads below.
interface SubAdminRateDoc {
  _id: ObjectId
  username: string
  fullName?: string
  ratePerThousandViews?: number | null
}

// Resolve the effective $/1000-views rate for a sub-admin: their own custom
// rate if set, else the global default from linksettings.
async function resolveEffectiveRate(
  subAdmin: { ratePerThousandViews?: number | null } | null | undefined,
  mongoUri: string,
  dbName: string
): Promise<{ rate: number; rateSource: 'custom' | 'global' }> {
  const db = await getDb(mongoUri, dbName)
  const settings = await db.collection('linksettings').findOne({})
  const globalRate = typeof settings?.globalRatePerThousandViews === 'number'
    ? settings.globalRatePerThousandViews
    : 0

  if (subAdmin && typeof subAdmin.ratePerThousandViews === 'number') {
    return { rate: subAdmin.ratePerThousandViews, rateSource: 'custom' }
  }
  return { rate: globalRate, rateSource: 'global' }
}

// Earnings summary for ONE sub-admin: per-anime breakdown of the three
// earningType buckets, plus total $ (only 'normal' views count toward $).
export async function getSubAdminEarnings(
  subAdminId: string,
  mongoUri: string,
  dbName: string
): Promise<ISubAdminEarningsSummary | null> {
  const db = await getDb(mongoUri, dbName)

  // ✅ FIX: explicit cast to SubAdminRateDoc — the raw driver return type
  // doesn't guarantee ratePerThousandViews/username/fullName shapes, which
  // is what caused the red-line type mismatch below.
  const subAdmin = await db.collection('subadmins').findOne(
    { _id: toObjectIdSafe(subAdminId) }
  ) as SubAdminRateDoc | null
  if (!subAdmin) return null

  const { rate, rateSource } = await resolveEffectiveRate(subAdmin, mongoUri, dbName)

  const raw = await db
    .collection('pageviews')
    .aggregate([
      {
        $match: {
          subAdminId: subAdminId,
          pageType: 'download',
          earningType: { $exists: true },
        },
      },
      {
        $group: {
          _id: { animeId: '$animeId', earningType: '$earningType' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  // Group by animeId
  const byAnimeMap = new Map<string, { normal: number; link5Direct: number; specialMode: number }>()
  for (const row of raw) {
    const animeId = row._id.animeId as string
    if (!animeId) continue
    if (!byAnimeMap.has(animeId)) {
      byAnimeMap.set(animeId, { normal: 0, link5Direct: 0, specialMode: 0 })
    }
    const bucket = byAnimeMap.get(animeId)!
    if (row._id.earningType === 'normal') bucket.normal += row.count
    else if (row._id.earningType === 'link5-direct') bucket.link5Direct += row.count
    else if (row._id.earningType === 'special-mode') bucket.specialMode += row.count
  }

  const animeIds = Array.from(byAnimeMap.keys()).filter(isValidObjectIdSafe).map(toObjectIdSafe)
  const animeTitles = animeIds.length
    ? await db.collection('animes')
        .find({ _id: { $in: animeIds } }, { projection: { title: 1 } })
        .toArray()
    : []
  const titleMap = new Map(animeTitles.map((a: any) => [a._id.toString(), a.title || 'Unknown']))

  const byAnime: ISubAdminAnimeEarning[] = Array.from(byAnimeMap.entries()).map(([animeId, b]) => ({
    animeId,
    animeTitle: titleMap.get(animeId) || 'Unknown',
    normalViews: b.normal,
    link5DirectViews: b.link5Direct,
    specialModeViews: b.specialMode,
    earnings: parseFloat(((b.normal * rate) / 1000).toFixed(4)),
  })).sort((a, b) => b.normalViews - a.normalViews)

  const totalNormalViews = byAnime.reduce((s, a) => s + a.normalViews, 0)
  const totalLink5DirectViews = byAnime.reduce((s, a) => s + a.link5DirectViews, 0)
  const totalSpecialModeViews = byAnime.reduce((s, a) => s + a.specialModeViews, 0)
  const totalEarnings = parseFloat(((totalNormalViews * rate) / 1000).toFixed(4))

  return {
    subAdminId,
    username: subAdmin.username,
    realName: subAdmin.fullName || subAdmin.username,
    rate,
    rateSource,
    totalNormalViews,
    totalLink5DirectViews,
    totalSpecialModeViews,
    totalEarnings,
    byAnime,
  }
}

// Lightweight summary across ALL sub-admins — powers the main-admin overview
// table (no per-anime breakdown here, just totals per sub-admin).
export async function getAllSubAdminEarningsSummary(
  mongoUri: string,
  dbName: string
): Promise<Omit<ISubAdminEarningsSummary, 'byAnime'>[]> {
  const db = await getDb(mongoUri, dbName)
  const settings = await db.collection('linksettings').findOne({})
  const globalRate = typeof settings?.globalRatePerThousandViews === 'number'
    ? settings.globalRatePerThousandViews
    : 0

  const subAdmins = await db.collection('subadmins')
    .find({}, { projection: { username: 1, fullName: 1, ratePerThousandViews: 1 } })
    .toArray()

  const results = await Promise.all(subAdmins.map(async (sa: any) => {
    const subAdminId = sa._id.toString()
    const rate = typeof sa.ratePerThousandViews === 'number' ? sa.ratePerThousandViews : globalRate
    const rateSource: 'custom' | 'global' = typeof sa.ratePerThousandViews === 'number' ? 'custom' : 'global'

    const raw = await db
      .collection('pageviews')
      .aggregate([
        {
          $match: {
            subAdminId,
            pageType: 'download',
            earningType: { $exists: true },
          },
        },
        {
          $group: {
            _id: '$earningType',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    let totalNormalViews = 0, totalLink5DirectViews = 0, totalSpecialModeViews = 0
    for (const row of raw) {
      if (row._id === 'normal') totalNormalViews = row.count
      else if (row._id === 'link5-direct') totalLink5DirectViews = row.count
      else if (row._id === 'special-mode') totalSpecialModeViews = row.count
    }

    return {
      subAdminId,
      username: sa.username,
      realName: sa.fullName || sa.username,
      rate,
      rateSource,
      totalNormalViews,
      totalLink5DirectViews,
      totalSpecialModeViews,
      totalEarnings: parseFloat(((totalNormalViews * rate) / 1000).toFixed(4)),
    }
  }))

  return results.sort((a, b) => b.totalEarnings - a.totalEarnings)
}

// Small local helpers so this file doesn't need a top-level import that could
// clash with existing ObjectId usage patterns in mongoService.ts
function toObjectIdSafe(id: string): ObjectId {
  return new ObjectId(id)
}
function isValidObjectIdSafe(id: string): boolean {
  return ObjectId.isValid(id)
}