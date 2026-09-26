// src/routes/analyticsRoutes.ts
import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth' // ✅ requirePermission add kiya
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
// 🆕 Verify signed ?l= / ?ls= tags so linkUsed can't be spoofed
import { signTag } from '../services/externalShortenerService'
// 🆕 FIX: fire-and-forget helper — /pageview ab turant response dega,
// saara DB kaam background me chalega
import { fireAndForget } from '../utils/cache'
// ✅ NEW — pageview daily rollup (backfill route ke liye)
import { aggregateAndPrunePageviewDay } from '../services/dailyPageStatsService'

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============================================================================
// ⚠️ PARTIAL FIX — in this file only the "sub-admin scoping helpers" section
// has been consolidated (see below). All the other routes
// (`/stats`, `/funnel`, `/referrers`, etc.) internally call functions from
// `analyticsService.ts` (getPageViewStats, getFunnelStats, ...), and
// those functions open their own `getDb()` connection (we don't have their
// code yet). That means at least 2 connections still open for each such
// route: one here for scoping, one inside the service function. To fully
// fix this, send `analyticsService.ts` — we'll make every function there
// accept a `db: Db` (like we did in subAdminScope.ts), and the routes will
// pass a single `db` to all of them.
// ============================================================================

// ─── Sub-admin scoping helpers ─────────────────────────────────────────────
// ✅ FIX: previously getOwnedAnimeSlugs and getAnimeSlugsForAdminId each made
// their own separate getDb() call. resolveOwnedSlugs wrapped both of them,
// so sometimes 2 connections were being created in a single request just
// for scoping. Now all helpers below accept a `db` object that the route
// handler has already opened.

// Returns the slugs of the anime **and** their download pages that belong
// to a sub-admin (or a specific admin when using the main admin's filter).
async function getOwnedAnimeSlugsFromDb(creatorId: string, db: any): Promise<string[]> {
  const animes = await db.collection('animes')
    .find({ createdBy: creatorId }, { projection: { _id: 1, slug: 1 } })
    .toArray()

  const animeSlugs = animes.map((a: any) => a.slug).filter(Boolean)
  const animeIds = animes.map((a: any) => a._id)

  const downloadPages = animeIds.length
    ? await db.collection('downloadpages')
        .find({ animeId: { $in: animeIds } }, { projection: { slug: 1 } })
        .toArray()
    : []
  const downloadSlugs = downloadPages.map((d: any) => d.slug).filter(Boolean)

  return [...animeSlugs, ...downloadSlugs]
}

// For main admin: if ?subAdminId=... is given, scope to that sub-admin's
// anime. Sub-admin always scoped to themselves (query param ignored).
// Both branches now share ONE db connection instead of two separate ones.
async function resolveOwnedSlugs(admin: any, c: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  const subAdminId = admin?.role !== 'subadmin' ? c.req.query('subAdminId') : null
  if (admin?.role !== 'subadmin' && !subAdminId) return null

  const db = await getDb(mongoUri, dbName)
  const creatorId = admin?.role === 'subadmin' ? admin.id : subAdminId
  return getOwnedAnimeSlugsFromDb(creatorId, db)
}

// Returns null for the main admin (no restriction), or the sub-admin's own
// admin id — used to scope shortusers/shortlinks-based analytics.
function resolveCreatorId(admin: any, c: any): string | null {
  if (admin?.role === 'subadmin') return admin.id
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
// 🆕 FIX: /pageview route ab TURANT response deta hai, saara DB kaam
// (dedupe check, earning context, trackPageView ke 8-10 sequential ops)
// background me chalta hai (`c.executionCtx.waitUntil` / fireAndForget).
//
// Frontend ko pageview ka result kabhi dikhna hi nahi chahiye tha — ye
// sirf analytics hai. Ab visitor turant response paata hai, backend apna
// analytics kaam apni speed se karta hai — user experience is se disconnect
// ho gaya hai.
analyticsRoutes.post('/pageview', async (c) => {
  try {
    const body = await c.req.json()
    const {
      path: rawPath,
      slug,
      animeTitle,
      sessionId,
      visitorId,
      timeOnPage,
      pageType: overridePageType,
    } = body

    if (!rawPath) return c.json({ error: 'path required' }, 400)

    const cleanSlug = typeof slug === 'string' ? slug.split('?')[0] : undefined

    let path: string = rawPath
    let linkUsed: number | undefined
    try {
      const u = new URL(rawPath, 'http://x')
      const l = parseInt(u.searchParams.get('l') || '', 10)
      const ls = u.searchParams.get('ls') || ''
      if (l >= 1 && l <= 4 && cleanSlug && ls === await signTag(c.env.JWT_SECRET, cleanSlug, l)) {
        linkUsed = l
      }
      if (u.searchParams.has('l') || u.searchParams.has('ls')) {
        u.searchParams.delete('l')
        u.searchParams.delete('ls')
        path = u.pathname + (u.search || '')
      }
    } catch { /* ignore */ }

    const ua = c.req.header('user-agent') || ''
    const botPattern = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu/i
    if (botPattern.test(ua)) return c.json({ ok: true, skipped: 'bot' })

    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      '0.0.0.0'

    const country = c.req.header('cf-ipcountry') || undefined
    const region = c.req.header('cf-region') || c.req.header('cf-region-code') || undefined
    const city = undefined

    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const referrer = c.req.header('referer') || undefined
    const pageType = overridePageType === 'not-found' ? 'not-found' : detectPageType(path)

    // 🆕 FIX: yahan se neeche — saara DB kaam ab BACKGROUND me chalta hai.
    // Response ussi turant chala jaata hai, MongoDB ka wait nahi karna padta.
    fireAndForget(c, (async () => {
      let earningContext:
        | { link5Active: boolean; specialModeForcing: boolean; countEveryView: boolean; dedupeWindowSec: number }
        | undefined

      if (pageType === 'download' || pageType === 'anime-detail' || pageType === 'episode') {
        // ✅ DEFENSE-IN-DEPTH: earningContext build ko try/catch me wrap kiya.
        // Agar isForceLink5ModeActive (ya linksettings fetch) kabhi bhi throw
        // kare, toh bhi trackPageView chalta rahega — warna silently downloadViews
        // 0 ho jaata kyunki poora background task crash ho jaata.
        try {
          const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
          const linkSettings: any = await db.collection('linksettings').findOne({})
          const countEveryView = linkSettings?.countEveryView === true
          const dedupeWindowSec = typeof linkSettings?.dedupeWindowSec === 'number' ? linkSettings.dedupeWindowSec : 86400

          let link5Active = false
          let specialModeForcing = false
          if (pageType === 'download') {
            link5Active = linkSettings?.link5 !== false
            specialModeForcing = await isForceLink5ModeActive(c.env.MONGODB_URI, c.env.MONGODB_DB)
          }
          earningContext = { link5Active, specialModeForcing, countEveryView, dedupeWindowSec }
        } catch (e) {
          console.error('earningContext build failed, tracking view anyway:', e)
        }
      }

      await trackPageView(
        {
          path,
          pageType,
          slug: cleanSlug,
          animeTitle,
          ip,
          country,
          region,
          city,
          device,
          browser,
          referrer,
          sessionId,
          timeOnPage,
          visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 64) : undefined,
          userAgent: ua.slice(0, 200),
          linkUsed,
        },
        c.env.MONGODB_URI,
        c.env.MONGODB_DB,
        earningContext
      )
    })())

    // ✅ Response turant — background task ka wait nahi kiya
    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Analytics track error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/stats?days=7&device=mobile ───────────────────────
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

analyticsRoutes.get('/funnel', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const funnel = await getFunnelStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(funnel)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

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

analyticsRoutes.get('/referrers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getReferrerStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/browsers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getBrowserStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/time-on-page', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getTimeOnPageStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/live', adminAuth, async (c) => {
  try {
    const data = await getLiveVisitors(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/top-anime', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getTopAnimeOverall(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/hourly', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getHourlyHeatmap(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/not-found', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await get404Stats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/visitor-type', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getNewVsReturning(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

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

analyticsRoutes.get('/payment-analytics', adminAuth, async (c) => {
  try {
    const data = await getPaymentAnalytics(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

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

analyticsRoutes.get('/link-journey', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getLinkJourney(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

analyticsRoutes.get('/link-journey-by-link', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getLinkJourneyByLink(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

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
// ✅ This route was already correct — getDb() is called only ONCE at the
// top, and the same `db` object is reused everywhere inside `Promise.all`.
// No connection-count fix was needed here.
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

      const totalViews = allSlugs.length
        ? await db.collection('pageviews').countDocuments({ slug: { $in: allSlugs } })
        : 0

      const shortUsers = await db.collection('shortusers')
        .find({ createdByAdminId: subAdminId }, { projection: { _id: 1, totalClicks: 1 } })
        .toArray()
      const shortUserIds = shortUsers.map((u: any) => u._id)

      const linksByUser = shortUserIds.length
        ? await db.collection('shortlinks').countDocuments({ userId: { $in: shortUserIds } })
        : 0
      const linksAssignedDirectly = await db.collection('shortlinks')
        .countDocuments({ createdByAdminId: subAdminId })

      const totalClicks = shortUsers.reduce((sum: number, u: any) => sum + (u.totalClicks || 0), 0)

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

// ─── POST /api/analytics/backfill-pageviews-rollup ────────────────────────
// ✅ ONE-TIME BACKFILL — purane pageviews documents ko dailyPageStats mein
// rollup karta hai, AUR raw docs bhi delete karta hai (jaisi aggregateAndPrunePageviewDay
// normally cron mein karta hai). Isse purani 59k+ collection turant halki ho jayegi.
//
// ⚠️ IMPORTANT: Ye ek heavy route hai — ek baar chalane ke liye. Agar 60 din ka
// data hai, toh 60 iterations honge, har iteration ka aggregation chalega.
// Cloudflare Workers ki CPU/subrequest limit hit ho sakti hai agar bahut purana
// data ho. Agar timeout aaye toh `from`/`to` query params se chunk-wise chalao.
analyticsRoutes.post('/backfill-pageviews-rollup', adminAuth, requirePermission('useractivity'), async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // date field yahan STRING hai ('YYYY-MM-DD', IST) — Date object nahi
    const oldest = await db.collection('pageviews').find({}).sort({ date: 1 }).limit(1).toArray()
    const newest = await db.collection('pageviews').find({}).sort({ date: -1 }).limit(1).toArray()

    if (oldest.length === 0) {
      return c.json({ success: true, message: 'Koi data nahi mila', daysProcessed: 0 })
    }

    const firstDateStr: string = oldest[0].date
    const lastDateStr: string = newest[0].date

    const results: { date: string; aggregated: boolean }[] = []
    let cursor = new Date(`${firstDateStr}T00:00:00.000Z`)
    const last = new Date(`${lastDateStr}T00:00:00.000Z`)

    while (cursor <= last) {
      const dateStr = cursor.toISOString().slice(0, 10)
      // ✅ rawRetentionDays=7 rakha hai (default) — isliye jaise-jaise loop aage
      // badhega, har din process hone ke turant baad uska raw data (agar 7 din
      // se purana ho chuka hai) automatically delete bhi ho jayega
      const result = await aggregateAndPrunePageviewDay(c.env.MONGODB_URI, c.env.MONGODB_DB, dateStr, 7)
      results.push(result)
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }

    return c.json({
      success: true,
      daysProcessed: results.length,
      daysWithData: results.filter(r => r.aggregated).length,
      range: { from: firstDateStr, to: lastDateStr },
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default analyticsRoutes