 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
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
} from '../services/analyticsService'

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

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
      c.env.MONGODB_DB
    )

    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Analytics track error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/stats?days=7&device=mobile ───────────────────────
analyticsRoutes.get('/stats', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const device = c.req.query('device') || undefined
    const stats = await getPageViewStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days, device)
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
analyticsRoutes.get('/geo-detail', adminAuth, async (c) => {
  try {
    const country = c.req.query('country')
    const days = parseInt(c.req.query('days') || '30', 10)
    if (!country) return c.json({ error: 'country required' }, 400)
    const detail = await getGeoDetail(country, c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(detail)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/by-country?days=1 ─────────────────────────────────
// Independent country breakdown for the World Map / Top Countries section,
// filterable by period (daily=1, weekly=7, monthly=30, yearly=365)
analyticsRoutes.get('/by-country', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '1', 10)
    const data = await getByCountryStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/funnel?days=7 ─────────────────────────────────────
// User journey funnel: Home → Detail → Download (per session)
analyticsRoutes.get('/funnel', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const funnel = await getFunnelStats(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(funnel)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/referrers?days=7 ──────────────────────────────────
// 1. Traffic source breakdown (Google, Direct, social, etc.)
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
// 2. Browser breakdown
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
// 3. Average time on page per page type
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
// 4. Real-time / live visitors (active in last 5 minutes)
analyticsRoutes.get('/live', adminAuth, async (c) => {
  try {
    const data = await getLiveVisitors(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/top-anime?days=7 ──────────────────────────────────
// 5. Top anime overall (combined across detail/episode/download)
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
// 7. Hourly heatmap (views by hour of day, IST)
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
// 8. 404 / not-found page tracking
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
// 10. New vs returning visitors
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
// User link analytics (clicks, countries, devices, etc.)
analyticsRoutes.get('/user-links', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getUserLinkAnalytics(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/earnings-health ───────────────────────────────────
// Earnings timeline + link health status
analyticsRoutes.get('/earnings-health', adminAuth, async (c) => {
  try {
    const data = await getEarningsAndLinkHealth(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/fraud?days=7 ──────────────────────────────────────
// Fraud/bot detection (suspicious IPs, spike hours, unknown country)
analyticsRoutes.get('/fraud', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getFraudDetection(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/leaderboard ───────────────────────────────────────
// Leaderboard by today, week, all-time, and streaks
analyticsRoutes.get('/leaderboard', adminAuth, async (c) => {
  try {
    const data = await getLeaderboard(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/payment-analytics ─────────────────────────────────
// Payment analytics: totals, thresholds, recent payments, monthly trend
analyticsRoutes.get('/payment-analytics', adminAuth, async (c) => {
  try {
    const data = await getPaymentAnalytics(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/cohort ────────────────────────────────────────────
// Cohort analysis: retention and average clicks per join month
analyticsRoutes.get('/cohort', adminAuth, async (c) => {
  try {
    const data = await getCohortAnalysis(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ─── GET /api/analytics/link-journey?days=7 ───────────────────────────────
// Link journey: shortclick → pageview conversion tracking
analyticsRoutes.get('/link-journey', adminAuth, async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)
    const data = await getLinkJourney(c.env.MONGODB_URI, c.env.MONGODB_DB, days)
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default analyticsRoutes