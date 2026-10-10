// src/routes/analyticsRoutes.ts
import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import { withDb } from '../services/mongoService'
import {
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
import { signTag } from '../services/externalShortenerService'
import { aggregateAndPrunePageviewDay } from '../services/dailyPageStatsService'

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============================================================================
// ✅ MIGRATED: Saare service functions ab `db: Db` accept karte hain (pehla arg).
// ============================================================================

// ─── Sub-admin scoping helpers ─────────────────────────────────────────────
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

async function resolveOwnedSlugs(admin: any, c: any, db: any): Promise<string[] | null> {
  const subAdminId = admin?.role !== 'subadmin' ? c.req.query('subAdminId') : null
  if (admin?.role !== 'subadmin' && !subAdminId) return null

  const creatorId = admin?.role === 'subadmin' ? admin.id : subAdminId
  return getOwnedAnimeSlugsFromDb(creatorId, db)
}

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
    const {
      path: rawPath,
      slug,
      animeTitle,
      sessionId,
      visitorId,
      timeOnPage,
      pageType: overridePageType,
      isAdminPreview,
    } = body

    if (!rawPath) return c.json({ error: 'path required' }, 400)

    // TIME-ON-PAGE-ONLY PING
    if (typeof timeOnPage === 'number' && timeOnPage > 0) {
      const seconds = Math.max(1, Math.min(3600, Math.round(timeOnPage)))

      const ua = c.req.header('user-agent') || ''
      const botPattern = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu/i
      if (botPattern.test(ua)) return c.json({ ok: true, skipped: 'bot' })

      const cleanPathForTime = rawPath.split('?')[0]

      c.executionCtx.waitUntil(
        c.env.PAGEVIEW_QUEUE.send({
          kind: 'time',
          path: cleanPathForTime,
          seconds,
          sessionId: typeof sessionId === 'string' ? sessionId : '',
          visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 64) : '',
          ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0',
          userAgent: ua.slice(0, 200),
        })
      )

      return c.json({ ok: true })
    }

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

    c.executionCtx.waitUntil(
      c.env.PAGEVIEW_QUEUE.send({
        kind: 'view',
        at: Date.now(),
        data: {
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
          isAdminPreview: isAdminPreview === true,
        },
      })
    )

    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Analytics track error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/stats ────────────────────────────────────────────
analyticsRoutes.get('/stats', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const device = c.req.query('device') || undefined

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/stats', async (db) => {
      const ownedSlugs = await resolveOwnedSlugs(admin, c, db)
      const stats = await getPageViewStats(db, days, device, ownedSlugs)
      return c.json(stats)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/page-detail ──────────────────────────────────────
analyticsRoutes.get('/page-detail', adminAuth, async (c) => {
  try {
    const path = c.req.query('path')
    const days = parseInt(c.req.query('days') || '30', 10)
    if (!path) return c.json({ error: 'path required' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/page-detail', async (db) => {
      const detail = await getPageDetail(db, path, days)
      return c.json(detail)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/geo-detail ───────────────────────────────────────
analyticsRoutes.get('/geo-detail', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const country = c.req.query('country')
    const days = parseInt(c.req.query('days') || '30', 10)
    if (!country) return c.json({ error: 'country required' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/geo-detail', async (db) => {
      const ownedSlugs = await resolveOwnedSlugs(admin, c, db)
      const detail = await getGeoDetail(db, country, days, ownedSlugs)
      return c.json(detail)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/by-country ───────────────────────────────────────
analyticsRoutes.get('/by-country', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '1', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/by-country', async (db) => {
      const ownedSlugs = await resolveOwnedSlugs(admin, c, db)
      const data = await getByCountryStats(db, days, ownedSlugs)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/funnel ───────────────────────────────────────────
analyticsRoutes.get('/funnel', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/funnel', async (db) => {
      const funnel = await getFunnelStats(db, days)
      return c.json(funnel)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/monthly-overview ─────────────────────────────────
analyticsRoutes.get('/monthly-overview', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/monthly-overview', async (db) => {
      const ownedSlugs = await resolveOwnedSlugs(admin, c, db)
      const data = await getMonthlyOverview(db, ownedSlugs)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/monthly-detail ───────────────────────────────────
analyticsRoutes.get('/monthly-detail', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const month = c.req.query('month')
    if (!month) return c.json({ error: 'month required (YYYY-MM)' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/monthly-detail', async (db) => {
      const ownedSlugs = await resolveOwnedSlugs(admin, c, db)
      const data = await getMonthlyDetail(db, month, ownedSlugs)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/referrers ────────────────────────────────────────
analyticsRoutes.get('/referrers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/referrers', async (db) => {
      const data = await getReferrerStats(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/browsers ─────────────────────────────────────────
analyticsRoutes.get('/browsers', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/browsers', async (db) => {
      const data = await getBrowserStats(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/time-on-page ─────────────────────────────────────
analyticsRoutes.get('/time-on-page', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/time-on-page', async (db) => {
      const data = await getTimeOnPageStats(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/live ─────────────────────────────────────────────
analyticsRoutes.get('/live', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/live', async (db) => {
      const data = await getLiveVisitors(db)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/top-anime ────────────────────────────────────────
analyticsRoutes.get('/top-anime', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/top-anime', async (db) => {
      const data = await getTopAnimeOverall(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/hourly ───────────────────────────────────────────
analyticsRoutes.get('/hourly', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/hourly', async (db) => {
      const data = await getHourlyHeatmap(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/not-found ────────────────────────────────────────
analyticsRoutes.get('/not-found', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/not-found', async (db) => {
      const data = await get404Stats(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/visitor-type ─────────────────────────────────────
analyticsRoutes.get('/visitor-type', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/visitor-type', async (db) => {
      const data = await getNewVsReturning(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/user-links ───────────────────────────────────────
analyticsRoutes.get('/user-links', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const creatorId = resolveCreatorId(admin, c)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/user-links', async (db) => {
      const data = await getUserLinkAnalytics(db, days, creatorId)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/earnings-health ──────────────────────────────────
analyticsRoutes.get('/earnings-health', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/earnings-health', async (db) => {
      const data = await getEarningsAndLinkHealth(db, creatorId)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/fraud ────────────────────────────────────────────
analyticsRoutes.get('/fraud', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const days = parseInt(c.req.query('days') || '7', 10)
    const creatorId = resolveCreatorId(admin, c)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/fraud', async (db) => {
      const data = await getFraudDetection(db, days, creatorId)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/leaderboard ──────────────────────────────────────
analyticsRoutes.get('/leaderboard', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/leaderboard', async (db) => {
      const data = await getLeaderboard(db, creatorId)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/payment-analytics ────────────────────────────────
analyticsRoutes.get('/payment-analytics', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/payment-analytics', async (db) => {
      const data = await getPaymentAnalytics(db)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/cohort ───────────────────────────────────────────
analyticsRoutes.get('/cohort', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const creatorId = resolveCreatorId(admin, c)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/cohort', async (db) => {
      const data = await getCohortAnalysis(db, creatorId)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/link-journey ─────────────────────────────────────
analyticsRoutes.get('/link-journey', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/link-journey', async (db) => {
      const data = await getLinkJourney(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/link-journey-by-link ─────────────────────────────
analyticsRoutes.get('/link-journey-by-link', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/link-journey-by-link', async (db) => {
      const data = await getLinkJourneyByLink(db, days)
      return c.json(data)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/sub-admins-list ──────────────────────────────────
analyticsRoutes.get('/sub-admins-list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role === 'subadmin') return c.json({ subAdmins: [] })

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/sub-admins-list', async (db) => {
      const subAdmins = await getSubAdminsList(db)
      return c.json({ subAdmins })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/sub-admin-stats ──────────────────────────────────
analyticsRoutes.get('/sub-admin-stats', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role === 'subadmin') return c.json({ stats: [] })

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/sub-admin-stats', async (db) => {
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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── POST /api/analytics/backfill-pageviews-rollup ────────────────────────
analyticsRoutes.post('/backfill-pageviews-rollup', adminAuth, requirePermission('useractivity'), async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'analytics/backfill-pageviews-rollup', async (db) => {
      // date field STRING hai ('YYYY-MM-DD', IST)
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
        const result = await aggregateAndPrunePageviewDay(db, dateStr, 7)
        results.push(result)
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
      }

      return c.json({
        success: true,
        daysProcessed: results.length,
        daysWithData: results.filter(r => r.aggregated).length,
        range: { from: firstDateStr, to: lastDateStr },
      })
    }, 120000)  // 2 min timeout — backfill heavy hai
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default analyticsRoutes