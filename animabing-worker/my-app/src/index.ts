import { Hono } from 'hono'
import { cors } from 'hono/cors'
import adminRoutes from './routes/adminRoutes'
import animeRoutes from './routes/animeRoutes'
import episodeRoutes from './routes/episodeRoutes'
import chapterRoutes from './routes/chapterRoutes'
import appDownloadRoutes from './routes/appDownloadRoutes'
import contactRoutes from './routes/contactRoutes'
import downloadPageRoutes from './routes/downloadPageRoutes'
import linkSettingsRoutes from './routes/linkSettingsRoutes'
import partnerRoutes from './routes/partnerRoutes'
import pollRoutes from './routes/pollRoutes'
import reportRoutes from './routes/reportRoutes'
import sitemapRoutes from './routes/sitemapRoutes'
import socialRoutes from './routes/socialRoutes'
import { findOne } from './services/mongoService'
import { IAnime } from './models/types'

export type Env = {
  MONGODB_URI: string
  MONGODB_DB: string
  ALLOWED_ORIGIN: string
  JWT_SECRET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  ASSETS: Fetcher   // ✅ Cloudflare Pages ka service binding
}

export type Variables = {
  admin: any
  user: any
}

// ============ BOT DETECTION ============
function isBot(userAgent: string): boolean {
  if (!userAgent) return false
  const botPatterns = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
    'yandexbot', 'sogou', 'exabot', 'facebot', 'facebookexternalhit',
    'twitterbot', 'whatsapp', 'telegrambot', 'discordbot', 'slackbot',
    'linkedinbot', 'pinterestbot', 'applebot', 'semrushbot', 'ahrefsbot',
    'mj12bot', 'dotbot', 'rogerbot', 'screaming frog', 'sitebulb',
    'crawler', 'spider', 'bot/', 'bot;', '+http', 'mediapartners',
    'adsbot', 'feedfetcher', 'ia_archiver', 'curl', 'wget', 'python-requests',
    'axios', 'lighthouse', 'pagespeed', 'chrome-lighthouse',
    'headlesschrome', 'phantomjs', 'selenium'
  ]
  const ua = userAgent.toLowerCase()
  return botPatterns.some(p => ua.includes(p))
}

// ============ HTML ESCAPE ============
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 155)
}

// ============ META HTML GENERATOR ============
function generateMetaHTML(meta: {
  title: string
  description: string
  image: string
  url: string
  type: string
}): string {
  const safeTitle = escapeHtml(meta.title)
  const safeDesc = escapeHtml(meta.description)
  const safeImage = meta.image || 'https://animebing.in/AnimeBinglogo.jpg'
  const safeUrl = meta.url

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}">
<meta property="og:type" content="${meta.type}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDesc}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="AnimeBing">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDesc}">
<meta name="twitter:image" content="${safeImage}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${safeUrl}">
<link rel="icon" href="/favicon.ico">
</head>
<body>
<div id="root"></div>
<script>window.location.href="${safeUrl}";</script>
</body>
</html>`
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ OPTIONS PREFLIGHT ============
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// ============ CORS ============
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false,
  })
  return corsMiddleware(c, next)
})

// ============ BOT HANDLER — /detail/:slug ============
app.get('/detail/:slug', async (c) => {
  const userAgent = c.req.header('user-agent') || ''
  const forceBot = c.req.query('bot') === 'true'
  const slug = c.req.param('slug')

  // ✅ Agar bot nahi hai, toh Pages se React app serve karo (nahi redirect)
  if (!isBot(userAgent) && !forceBot) {
    // Cloudflare Pages ka static asset serve karo – ASSETS binding ke through
    return c.env.ASSETS.fetch(c.req.raw)
  }

  // Bot request — database se meta fetch karo
  try {
    const anime = await findOne<IAnime>(
      'animes',
      { slug },
      c.env.MONGODB_URI,
      c.env.MONGODB_DB
    )

    if (anime) {
      // Description priority: seoDescription > description > generated
      let description = anime.seoDescription || anime.description || ''

      if (!description || description.trim().length < 20) {
        const genre = Array.isArray(anime.genreList)
          ? anime.genreList.slice(0, 2).join(', ')
          : ''
        const year = anime.releaseYear ? ` (${anime.releaseYear})` : ''
        const lang = anime.subDubStatus ? ` in ${anime.subDubStatus}` : ' in Hindi & English'
        description = `Watch ${anime.title}${year}${lang} online for free.${genre ? ' ' + genre + ' anime.' : ''} HD quality streaming and download on AnimeBing.`
      }

      // Title build karo
      let titleWithSuffix = anime.title
      if (anime.contentType === 'Movie') {
        titleWithSuffix += ' (Movie)'
      } else if (anime.contentType === 'Manga') {
        titleWithSuffix += ' Manga'
      } else {
        const epCount = anime.currentEpisode || anime.totalEpisodes
        if (epCount && epCount > 0) titleWithSuffix += ` EP ${epCount}`
      }

      const meta = {
        title: `${titleWithSuffix} | AnimeBing`,
        description,
        image: anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg',
        url: `https://animebing.in/detail/${slug}`,
        type: anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show',
      }

      return new Response(generateMetaHTML(meta), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Bot-Handler': 'cloudflare-worker',
        }
      })
    }

    // Anime not found — slug se fallback title banao
    const fallbackTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    const meta = {
      title: `${fallbackTitle} | AnimeBing`,
      description: `Watch ${fallbackTitle} online in Hindi & English for free. HD quality streaming and download on AnimeBing.`,
      image: 'https://animebing.in/AnimeBinglogo.jpg',
      url: `https://animebing.in/detail/${slug}`,
      type: 'video.tv_show',
    }

    return new Response(generateMetaHTML(meta), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Bot-Handler': 'fallback',
      }
    })

  } catch (err) {
    console.error('Bot handler error:', err)
    const meta = {
      title: 'Watch Anime Online | AnimeBing',
      description: 'Watch anime online in Hindi and English for free. HD quality streaming on AnimeBing.',
      image: 'https://animebing.in/AnimeBinglogo.jpg',
      url: `https://animebing.in/detail/${slug}`,
      type: 'video.tv_show',
    }
    return new Response(generateMetaHTML(meta), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Bot-Handler': 'error-fallback' }
    })
  }
})

// ============ API ROUTES ============
app.route('/api/admin', adminRoutes)
app.route('/api/admin/protected', adminRoutes)
app.route('/api/anime', animeRoutes)
app.route('/api/episodes', episodeRoutes)
app.route('/api/chapters', chapterRoutes)
app.route('/api/app-downloads', appDownloadRoutes)
app.route('/api', contactRoutes)
app.route('/api/download-pages', downloadPageRoutes)
app.route('/api/link-settings', linkSettingsRoutes)
app.route('/api/partners', partnerRoutes)
app.route('/api/polls', pollRoutes)
app.route('/api/reports', reportRoutes)
app.route('/', sitemapRoutes)
app.route('/api/social', socialRoutes)

// ============ HEALTH CHECK ============
app.get('/health', (c) => {
  return c.json({
    message: 'Animabing Cloudflare Worker Working! 🚀',
    status: 'ok',
    features: {
      botMetaTags: 'enabled for /detail/:slug',
      seo: 'active',
      timestamp: new Date().toISOString()
    }
  })
})

// ✅ CATCH-ALL — baki sab frontend routes Cloudflare Pages se serve karo
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app