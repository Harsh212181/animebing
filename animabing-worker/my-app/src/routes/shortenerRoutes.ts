 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { ObjectId } from 'mongodb'
import { checkAndUnlockReferral, creditCommissionToReferrer } from './referralRoutes'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ BOT DETECTION ============
const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'facebot', 'facebookexternalhit', 'facebookcatalog', 'twitterbot', 'linkedinbot',
  'pinterest', 'telegrambot', 'discordbot', 'whatsapp', 'slackbot', 'applebot',
  'rogerbot', 'embedly', 'quora link preview', 'showyoubot', 'outbrain',
  'developers.google.com', 'bot', 'crawl', 'spider', 'preview',
  'iframely', 'vkshare', 'w3c_validator', 'curl', 'wget',
  'python', 'java', 'go-http', 'node-fetch', 'okhttp', 'axios', 'php',
  'perl', 'ruby', 'scraper', 'http',
]

function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(p => ua.includes(p))
}

// ============ HTML ESCAPE ============
function esc(input: unknown): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ')
    .trim()
}

// ============ META HTML BUILDER (bots only) ============
function buildMetaHTML(opts: {
  title: string
  description: string
  image: string
  canonicalUrl: string
  shortUrl: string
  redirectUrl: string
  code: string
}): string {
  const t   = esc(opts.title)
  const d   = esc(opts.description.substring(0, 900))
  const img = opts.image || 'https://animebing.in/AnimeBinglogo.jpg'
  const safeRedirect = esc(opts.redirectUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${esc(opts.canonicalUrl)}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${esc(opts.shortUrl)}" />
  <meta property="og:image" content="${esc(img)}" />
  <meta property="og:image:secure_url" content="${esc(img)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="video.tv_show" />
  <meta property="og:site_name" content="AnimeBing" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${esc(img)}" />

  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeRedirect}" />
  </noscript>
</head>
<body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;max-width:500px;">
    <img src="${esc(img)}" alt="${t}" style="width:100%;max-width:300px;border-radius:12px;margin-bottom:1.5rem;" onerror="this.style.display='none'" />
    <h1 style="font-size:1.4rem;margin-bottom:0.75rem;">${t}</h1>
    <p style="color:#94a3b8;font-size:0.95rem;margin-bottom:1.5rem;">${d}</p>
  </div>
</body>
</html>`
}

// ============ ANIME META FETCHER — DIRECT DB ============
async function fetchAnimeMeta(
  targetUrl: string,
  env: Env
): Promise<{ title: string; description: string; image: string; slug: string } | null> {
  try {
    const match = targetUrl.match(/animebing\.in\/detail\/([^/?#]+)/)
    if (!match) return null

    const slug = match[1]

    const db = await getDb(env.MONGODB_URI, env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ slug })

    if (!anime) return null

    const title = String(anime.title || slug.replace(/-/g, ' '))
    const epCount = Number(anime.currentEpisode || 0)
    let titleFull = title
    if (anime.contentType === 'Movie')      titleFull += ' (Movie)'
    else if (anime.contentType === 'Manga') titleFull += ' Manga'
    else if (epCount > 1)                   titleFull += ` EP 1-${epCount}`
    else if (epCount === 1)                 titleFull += ' EP 1'

    const description = String(
      anime.description ||
      anime.seoDescription ||
      anime.synopsis ||
      `Watch ${title} online in HD quality on AnimeBing. Free streaming and downloads.`
    ).trim()

    const image = String(anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg')

    return {
      title: `${titleFull} | AnimeBing`,
      description,
      image,
      slug,
    }
  } catch (err) {
    console.error('fetchAnimeMeta error:', err)
    return null
  }
}

// ============ ADMIN — ALL LINKS ============
shortenerRoutes.get('/admin/links', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const links = await db.collection('shortlinks')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — CREATE LINK ============
shortenerRoutes.post('/admin/links', adminAuth, async (c) => {
  try {
    const { code, url, label, userId } = await c.req.json()
    if (!code || !url) {
      return c.json({ error: 'code and url are required' }, 400)
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return c.json({ error: 'Code can only contain letters, numbers, - and _' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) {
      return c.json({ error: `"${code}" already exists` }, 400)
    }
    const newLink = {
      code,
      url,
      label: label || code,
      userId: userId ? new ObjectId(userId) : null,
      clicks: 0,
      createdAt: new Date(),
      lastClicked: null
    }
    await db.collection('shortlinks').insertOne(newLink)
    return c.json({ success: true, message: 'Link created!', link: newLink })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — UPDATE LINK ============
shortenerRoutes.put('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const { url, label, userId } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const updateData: any = { url, label, updatedAt: new Date() }
    if (userId) updateData.userId = new ObjectId(userId)
    await db.collection('shortlinks').updateOne({ code }, { $set: updateData })
    return c.json({ success: true, message: 'Link updated!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — DELETE LINK ============
shortenerRoutes.delete('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('shortlinks').deleteOne({ code })
    return c.json({ success: true, message: 'Link deleted!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ LINK STATS ============
shortenerRoutes.get('/admin/links/:code/stats', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })
    if (!link) return c.json({ error: 'Link not found' }, 404)
    return c.json(link)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ DEBUG — META TEST ============
shortenerRoutes.get('/debug-meta/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })

    if (!link) return c.json({ error: 'Link not found' })

    const apiBase = c.env.API_URL || 'https://animabing-backend.animabingwatch.workers.dev'

    const match = link.url.match(/animebing\.in\/detail\/([^/?#]+)/)
    const slug = match ? match[1] : null

    let apiResult = null
    let apiError = null
    try {
      const res = await fetch(`${apiBase}/api/anime/${slug}`, {
        headers: { Accept: 'application/json' }
      })
      apiResult = await res.json()
    } catch(e: any) {
      apiError = e.message
    }

    return c.json({
      link_url: link.url,
      api_base: apiBase,
      slug_extracted: slug,
      api_url_called: `${apiBase}/api/anime/${slug}`,
      api_result: apiResult,
      api_error: apiError,
      env_API_URL: c.env.API_URL,
    })
  } catch (err: any) {
    return c.json({ error: err.message })
  }
})

// ============ DASHBOARD REDIRECT ============
shortenerRoutes.get('/dashboard', (c) => {
  return c.redirect('https://animebing.in/dashboard', 302)
})

// ============ REDIRECT — LAST ============
shortenerRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })

    if (!link) {
      return c.html(`
        <!DOCTYPE html><html><head><title>404</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:white;}
        .box{text-align:center;padding:2rem;}h2{color:#f87171;}a{color:#818cf8;}</style></head>
        <body><div class="box"><h2>404 — Link not found</h2><p>This short link does not exist.</p>
        <a href="https://animebing.in">← Go to Animebing.in</a></div></body></html>
      `, 404)
    }

    const userAgent = c.req.header('User-Agent') || ''

    // ============ BOT: Meta HTML serve karo ============
    if (isBot(userAgent)) {
      const meta = await fetchAnimeMeta(link.url, c.env)

      const canonicalUrl = meta
        ? `https://animebing.in/detail/${meta.slug}`
        : link.url

      const title       = meta?.title       || link.label || code
      const description = meta?.description || `Visit ${link.url}`
      const image       = meta?.image       || 'https://animebing.in/AnimeBinglogo.jpg'

      return c.html(
        buildMetaHTML({
          title,
          description,
          image,
          canonicalUrl,
          shortUrl:    `https://go.animebing.in/${code}`,
          redirectUrl: link.url,
          code,
        }),
        200
      )
    }

    // ============ REAL USER: Click count + redirect ============
    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') || 'unknown'

    // 24h dedup — same IP se ek baar hi count hoga
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const dup = await db.collection('shortclicks').findOne({
      code, ip, clickedAt: { $gte: last24h }
    })

    if (!dup) {
      const country    = c.req.header('CF-IPCountry') || 'Unknown'
      const rawUA      = userAgent
      const deviceType = /mobile|android|iphone|ipad/i.test(rawUA) ? 'mobile'
                       : /tablet/i.test(rawUA) ? 'tablet' : 'desktop'

      const clickData: any = {
        code,
        ip,
        country,
        city:      (c as any).req.raw?.cf?.city || 'Unknown',
        device:    deviceType,
        browser:   rawUA.substring(0, 100),
        clickedAt: new Date()
      }
      if (link.userId) clickData.userId = link.userId

      // Click insert + link update parallel mein
      await Promise.all([
        db.collection('shortclicks').insertOne(clickData),
        db.collection('shortlinks').updateOne(
          { code },
          { $inc: { clicks: 1 }, $set: { lastClicked: new Date() } }
        )
      ])

      // ============ EARNINGS + REFERRAL UNLOCK + COMMISSION ============
      if (link.userId) {
        db.collection('shortusers').findOne({ _id: link.userId })
          .then(async (user) => {
            if (!user) return

            const earn = (user.ratePerThousand || 10) / 1000

            // User ki earnings update karo
            await db.collection('shortusers').updateOne(
              { _id: link.userId },
              { $inc: { totalClicks: 1, totalEarnings: earn, unpaidEarnings: earn } }
            )

            // ✅ REFERRAL UNLOCK CHECK — har click ke baad check karo
            // Agar 1000 clicks ho gaye toh auto unlock hoga
            await checkAndUnlockReferral(link.userId, db)

            // ✅ COMMISSION CREDIT — referrer ka 5% commission
            // Sirf tab kaam karega jab is user ka koi unlocked referral ho
            if (earn > 0) {
              await creditCommissionToReferrer(link.userId, earn, db)
            }
          })
          .catch(() => {})
      }
    }

    // Instant 302 redirect
    return c.redirect(link.url, 302)

  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortenerRoutes