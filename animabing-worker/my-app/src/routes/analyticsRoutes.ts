 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { trackPageView, getPageViewStats, getPageDetail } from '../services/analyticsService'

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
    const { path, slug, animeTitle, sessionId, timeOnPage } = body

    if (!path) return c.json({ error: 'path required' }, 400)

    const ua = c.req.header('user-agent') || ''
    const botPattern = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu/i
    if (botPattern.test(ua)) return c.json({ ok: true, skipped: 'bot' })

    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      '0.0.0.0'

    const country = c.req.header('cf-ipcountry') || undefined
    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const referrer = c.req.header('referer') || undefined
    const pageType = detectPageType(path)

    await trackPageView(
      { path, pageType, slug, animeTitle, ip, country, device, browser, referrer, sessionId, timeOnPage },
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
    // ✅ NEW: device param read karo
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

export default analyticsRoutes