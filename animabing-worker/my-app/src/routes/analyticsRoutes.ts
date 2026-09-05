 // src/routes/analyticsRoutes.ts
import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { getDb } from '../services/mongoService'
import {
  trackPageView,
  getPageViewStats,
  getPageDetail,
  getGeoDetail,
  getFunnelStats,
  getByCountryStats,
  getReferrerStats,
  getBrowserStats,
  getTimeOnPageStats,
  getLiveVisitors,
  getTopAnimeOverall,
  getHourlyHeatmap,
  get404Stats,
  getNewVsReturning,
  getUserLinkAnalytics,
  getEarningsAndLinkHealth,
  getFraudDetection,
  getLeaderboard,
  getPaymentAnalytics,
  getCohortAnalysis,
  getLinkJourney,
  getLinkJourneyByLink,
  getSubAdminsList,
  getMonthlyOverview,
  getMonthlyDetail,
} from '../services/analyticsService'
// 🆕 EARNINGS: reuse the existing "is a special mode forcing link5" check
import { isForceLink5ModeActive } from './specialModeRoutes'

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Sub-admin scoping helpers ─────────────────────────────────────────────

// Returns the slugs of the anime **and** their download pages that belong
// to a sub-admin (or a specific admin when using the main admin's filter).
// This ensures pageviews for download pages are included in scoped queries.
async function getOwnedAnimeSlugs(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (!admin || admin.role !== 'subadmin') return null
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1, slug: 1 } })
    .toArray()

  const animeSlugs = animes.map((a: any) => a.slug).filter(Boolean)
  const animeIds = animes.map((a: any) => a._id)

  // Download pages have their own distinct slugs, we need them so pageviews
  // from those download pages are not silently dropped by slugFilter.
  const downloadPages = animeIds.length
    ? await db.collection('downloadpages')
        .find({ animeId: { $in: animeIds } }, { projection: { slug: 1 } })
        .toArray()
    : []
  const downloadSlugs = downloadPages.map((d: any) => d.slug).filter(Boolean)

  return [...animeSlugs, ...downloadSlugs]
}

// Returns null for the main admin (no restriction), or the sub-admin's own
// admin id — used to scope shortusers/shortlinks-based analytics.
function getSubAdminCreatorId(admin: any): string | null {
  if (!admin || admin.role !== 'subadmin') return null
  return admin.id
}

// ─── NEW HELPERS for main admin subAdminId filter ──────────────────────────
// For main admin: if ?subAdminId=... is given, scope to that sub-admin's
// anime. Sub-admin always scoped to themselves (query param ignored).

async function getAnimeSlugsForAdminId(adminId: string, mongoUri: string, dbName: string): Promise<string[]> {
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: adminId }, { projection: { _id: 1, slug: 1 } })
    .toArray()

  const animeSlugs = animes.map((a: any) => a.slug).filter(Boolean)
  const animeIds = animes.map((a: any) => a._id)

  // Also include the download-page slugs of those anime, same reasoning
  // as getOwnedAnimeSlugs.
  const downloadPages = animeIds.length
    ? await db.collection('downloadpages')
        .find({ animeId: { $in: animeIds } }, { projection: { slug: 1 } })
        .toArray()
    : []
  const downloadSlugs = downloadPages.map((d: any) => d.slug).filter(Boolean)

  return [...animeSlugs, ...downloadSlugs]
}

async function resolveOwnedSlugs(admin: any, c: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin?.role === 'subadmin') return getOwnedAnimeSlugs(admin, mongoUri, dbName)
  const subAdminId = c.req.query('subAdminId')
  if (subAdminId) return getAnimeSlugsForAdminId(subAdminId, mongoUri, dbName)
  return null
}

function resolveCreatorId(admin: any, c: any): string | null {
  if (admin?.role === 'subadmin') return getSubAdminCreatorId(admin)
  const subAdminId = c.req.query('subAdminId')
  return subAdminId || null
}

// ─── Helper: detect device from User-Agent ────────────────────────────────
function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua)) return 'Opera'
  if (/chrome/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua)) return 'Safari'
  if (/firefox/i.test(ua)) return 'Firefox'
  return 'Other'
}

// ─── Detect page type from path ──────────────────────────────────────────
function detectPageType(path: string): string {
  if (path === '/' || path === '') return 'home'
  if (/^\/detail\/[^/]+\/episode/.test(path)) return 'episode'
  if (/^\/detail\/[^/]+/.test(path)) return 'anime-detail'
  if (/^\/download\//.test(path)) return 'download'
  if (path === '/anime' || path.startsWith('/anime?')) return 'anime-list'
  if (path.startsWith('/anime-list')) return 'anime-list'
  if (/^\/top-100/.test(path)) return 'top-100'
  if (/^\/contact/.test(path)) return 'contact'
  if (/^\/privacy/.test(path)) return 'privacy'
  if (/^\/terms/.test(path)) return 'terms'
  if (/^\/dmca/.test(path)) return 'dmca'
  if (/^\/earn/.test(path)) return 'earn-money'
  return 'other'
}

// ─── POST /api/analytics/pageview ────────────────────────────────────────
analyticsRoutes.post('/pageview', async (c) => {
  try {
    const body = await c.req.json()
    const { path, slug, animeTitle, sessionId, timeOnPage, pageType: overridePageType } = body

    if (!path) return c.json({ error: 'path required' }, 400)

    const ua = c.req.header('user-agent') || ''
    const botPattern = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu/i
    if (botPattern.test(ua)) return c.json({ ok: true, skipped: 'bot' })

    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      '0.0.0.0'

    // Capture available geo headers from Cloudflare (if any)
    const country = c.req.header('cf-ipcountry') || undefined
    const region = c.req.header('cf-region') || c.req.header('cf-region-code') || undefined
    const city = undefined  // not available on free plan, enrichment will handle later

    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const referrer = c.req.header('referer') || undefined
    // Allow the frontend to explicitly mark a path as 'not-found' (404 page)
    const pageType = overridePageType === 'not-found' ? 'not-found' : detectPageType(path)

    // 🆕 EARNINGS: for download-page views, resolve the link-5 / special-mode
    // state RIGHT NOW so trackPageView can tag the view's earning category
    // at write-time (this state changes over time, so it must not be
    // recomputed later from history).
    let earningContext: { link5Active: boolean; specialModeForcing: boolean } | undefined
    if (pageType === 'download') {
      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
      const linkSettings = await db.collection('linksettings').findOne({})
      const link5Active = linkSettings?.link5 !== false
      const specialModeForcing = await isForceLink5ModeActive(c.env.MONGODB_URI, c.env.MONGODB_DB)
      earningContext = { link5Active, specialModeForcing }
    }

    await trackPageView(
      {
        path,
        pageType,
        slug,
        animeTitle,
        ip,
        country,
        region,        // ← may be undefined, will be enriched in service if missing
        city,          // ← undefined, enriched in service
        device,
        browser,
        referrer,
        sessionId,
        timeOnPage,
      },
      c.env.MONGODB_URI,
      c.env.MONGODB_DB,
      earningContext // 🆕 EARNINGS
    )

    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Analytics track error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/stats?days=7&device=mobile ───────────────────────
// Sub-admin: scoped to only the anime + download pages they created.
analyticsRoutes.get('/stats', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const device = c.req.query('device') || undefined
    const ownedSlugs = await resolveOwnedSlugs(admin, c, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const stats = await getPageViewStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days, device, ownedSlugs)
    return c.json(stats)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/page-detail?path=...&days=30 ─────────────────────
analyticsRoutes.get('/page-detail', adminAuth, async (c) => {
  try {
    const path = c.req.query('path')
    const days = parseInt(c.req.query('days') || '30', 10)
    if (!path) return c.json({ error: 'path required' }, 400)
    const detail = await getPageDetail(path, c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(detail)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/geo-detail?country=IN&days=30 ───────────────────
// Sub-admin: scoped to only the anime + download pages they created.
analyticsRoutes.get('/geo-detail', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const country = c.req.query('country')
    const days = parseInt(c.req.query('days') || '30', 10)
    if (!country) return c.json({ error: 'country required' }, 400)
    const ownedSlugs = await resolveOwnedSlugs(admin, c, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const detail = await getGeoDetail(country, c.env.MONGODB_URI, c.env.MONGODB_DB, days, ownedSlugs)
    return c.json(detail)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/by-country?days=1 ─────────────────────────────────
// Sub-admin: scoped to only the anime + download pages they created.
analyticsRoutes.get('/by-country', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '1', 10)
    const ownedSlugs = await resolveOwnedSlugs(admin, c, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const data = await getByCountryStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days, ownedSlugs)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/funnel?days=7 ─────────────────────────────────────
analyticsRoutes.get('/funnel', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const funnel = await getFunnelStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(funnel)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/monthly-overview ──────────────────────────────────
// Har month ka summary — start se ab tak.
analyticsRoutes.get('/monthly-overview', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const ownedSlugs = await resolveOwnedSlugs(admin, c, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const data = await getMonthlyOverview(c.env.MONGODB_URI, c.env.MONGODB_DB, ownedSlugs)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/monthly-detail?month=2026-07 ──────────────────────
// Ek month ke andar har din ka anime vs download breakdown.
analyticsRoutes.get('/monthly-detail', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const month = c.req.query('month')
    if (!month) return c.json({ error: 'month required (YYYY-MM)' }, 400)
    const ownedSlugs = await resolveOwnedSlugs(admin, c, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const data = await getMonthlyDetail(c.env.MONGODB_URI, c.env.MONGODB_DB, month, ownedSlugs)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/referrers?days=7 ──────────────────────────────────
analyticsRoutes.get('/referrers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getReferrerStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/browsers?days=7 ───────────────────────────────────
analyticsRoutes.get('/browsers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getBrowserStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/time-on-page?days=7 ───────────────────────────────
analyticsRoutes.get('/time-on-page', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getTimeOnPageStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/live ───────────────────────────────────────────────
analyticsRoutes.get('/live', adminAuth, async (c) => {
  try {
    const data = await getLiveVisitors(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/top-anime?days=7 ──────────────────────────────────
analyticsRoutes.get('/top-anime', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getTopAnimeOverall(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/hourly?days=7 ─────────────────────────────────────
analyticsRoutes.get('/hourly', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getHourlyHeatmap(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/not-found?days=7 ──────────────────────────────────
analyticsRoutes.get('/not-found', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await get404Stats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/visitor-type?days=7 ───────────────────────────────
analyticsRoutes.get('/visitor-type', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getNewVsReturning(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/user-links?days=7 ─────────────────────────────────
// Sub-admin: scoped to shortusers/links they created (createdByAdminId).
analyticsRoutes.get('/user-links', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const creatorId = resolveCreatorId(admin, c)
    const data = await getUserLinkAnalytics(c.env.MONGODB_URI, c.env.MONGODB_DB, days, creatorId)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/earnings-health ───────────────────────────────────
// Sub-admin: scoped to shortusers/links they created (createdByAdminId).
analyticsRoutes.get('/earnings-health', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)
    const data = await getEarningsAndLinkHealth(c.env.MONGODB_URI, c.env.MONGODB_DB, creatorId)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/fraud?days=7 ──────────────────────────────────────
// Sub-admin: scoped to shortusers/links they created (createdByAdminId).
analyticsRoutes.get('/fraud', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const creatorId = resolveCreatorId(admin, c)
    const data = await getFraudDetection(c.env.MONGODB_URI, c.env.MONGODB_DB, days, creatorId)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/leaderboard ───────────────────────────────────────
// Sub-admin: scoped to shortusers they created (createdByAdminId).
analyticsRoutes.get('/leaderboard', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)
    const data = await getLeaderboard(c.env.MONGODB_URI, c.env.MONGODB_DB, creatorId)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/payment-analytics ─────────────────────────────────
analyticsRoutes.get('/payment-analytics', adminAuth, async (c) => {
  try {
    const data = await getPaymentAnalytics(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/cohort ────────────────────────────────────────────
// Sub-admin: scoped to shortusers they created (createdByAdminId).
analyticsRoutes.get('/cohort', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)
    const data = await getCohortAnalysis(c.env.MONGODB_URI, c.env.MONGODB_DB, creatorId)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/link-journey?days=7 ───────────────────────────────
analyticsRoutes.get('/link-journey', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getLinkJourney(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/link-journey-by-link?days=7 ───────────────────────
analyticsRoutes.get('/link-journey-by-link', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getLinkJourneyByLink(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/sub-admins-list ───────────────────────────────────
analyticsRoutes.get('/sub-admins-list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role === 'subadmin') return c.json({ subAdmins: [] })
    const subAdmins = await getSubAdminsList(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ subAdmins })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/sub-admin-stats ───────────────────────────────────
// Per-sub-admin summary: anime count, download pages, total views,
// shortener users, links, clicks, and Instagram accounts.
// Main admin only — powers the SubAdminManager overview cards.
analyticsRoutes.get('/sub-admin-stats', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role === 'subadmin') return c.json({ stats: [] })

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const subAdmins = await db.collection('subadmins')
      .find({}, { projection: { username: 1, realName: 1 } })
      .toArray()

    const stats = await Promise.all(subAdmins.map(async (sa: any) => {
      const subAdminId = sa._id.toString()

      // ── Anime + download pages ──────────────────────────────────────
      const animes = await db.collection('animes')
        .find({ createdBy: subAdminId }, { projection: { _id: 1, slug: 1 } })
        .toArray()
      const animeIds = animes.map((a: any) => a._id)
      const animeSlugs = animes.map((a: any) => a.slug).filter(Boolean)

      const downloadPages = animeIds.length
        ? await db.collection('downloadpages')
            .find({ animeId: { $in: animeIds } }, { projection: { slug: 1 } })
            .toArray()
        : []
      const downloadSlugs = downloadPages.map((d: any) => d.slug).filter(Boolean)

      const allSlugs = [...animeSlugs, ...downloadSlugs]

      // ── Total page views across their anime + download pages ────────
      const totalViews = allSlugs.length
        ? await db.collection('pageviews').countDocuments({ slug: { $in: allSlugs } })
        : 0

      // ── Shortener users + links + clicks ─────────────────────────────
      const shortUsers = await db.collection('shortusers')
        .find({ createdByAdminId: subAdminId }, { projection: { _id: 1, totalClicks: 1 } })
        .toArray()
      const shortUserIds = shortUsers.map((u: any) => u._id)

      const linksByUser = shortUserIds.length
        ? await db.collection('shortlinks').countDocuments({ userId: { $in: shortUserIds } })
        : 0
      // Links the sub-admin assigned directly (not tied to a self-registered user)
      const linksAssignedDirectly = await db.collection('shortlinks')
        .countDocuments({ createdByAdminId: subAdminId })

      const totalClicks = shortUsers.reduce((sum: number, u: any) => sum + (u.totalClicks || 0), 0)

      // ── Instagram automation accounts ────────────────────────────────
      const instagramAccountsCount = await db.collection('instagramAccounts')
        .countDocuments({ createdBy: subAdminId })

      return {
        subAdminId,
        username: sa.username,
        realName: sa.realName || sa.username,
        animeCount: animes.length,
        downloadPagesCount: downloadPages.length,
        totalViews,
        shortUsersCount: shortUsers.length,
        linksCount: linksByUser + linksAssignedDirectly,
        totalClicks,
        instagramAccountsCount,
      }
    }))

    return c.json({ stats })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default analyticsRoutes