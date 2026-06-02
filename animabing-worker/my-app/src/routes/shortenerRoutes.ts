// File: ANIMABING/animabing-worker/my-app/src/routes/shortenerRoutes.ts

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { ObjectId } from 'mongodb'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ BOT DETECTION ============
const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'facebot', 'facebookexternalhit', 'twitterbot', 'linkedinbot', 'pinterest',
  'telegrambot', 'discordbot', 'whatsapp', 'slackbot', 'applebot', 'rogerbot',
  'embedly', 'quora link preview', 'showyoubot', 'outbrain', 'developers.google.com',
  'bot', 'crawl', 'spider',
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

// ============ META HTML BUILDER ============
// Crawlers ke liye — redirect nahi, seedha HTML serve karo with OG tags
// Real URL (animebing.in/detail/slug) bhi include hai taaki Google sahi page index kare
function buildMetaHTML(opts: {
  title: string
  description: string
  image: string
  canonicalUrl: string   // animebing.in/detail/slug — real indexable page
  shortUrl: string       // go.animebing.in/code — current URL
  redirectUrl: string    // jahan user actually jayega
}): string {
  const t   = esc(opts.title)
  const d   = esc(opts.description.substring(0, 900))
  const img = opts.image || 'https://animebing.in/AnimeBinglogo.jpg'

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

  <!-- Bot ko redirect nahi, crawl karne do — real users JS se jayenge -->
  <script>
    // Sirf real users ko redirect karo, bots yahan ruke
    var ua = navigator.userAgent.toLowerCase();
    var bots = ['bot','crawl','spider','facebookexternalhit','twitterbot','whatsapp','telegram','discord','slack','linkedin'];
    var isBot = bots.some(function(b){ return ua.indexOf(b) !== -1; });
    if (!isBot) {
      window.location.replace("${esc(opts.redirectUrl)}");
    }
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${esc(opts.redirectUrl)}" />
  </noscript>
</head>
<body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;max-width:500px;">
    <img src="${esc(img)}" alt="${t}" style="width:100%;max-width:300px;border-radius:12px;margin-bottom:1.5rem;" onerror="this.style.display='none'" />
    <h1 style="font-size:1.4rem;margin-bottom:0.75rem;">${t}</h1>
    <p style="color:#94a3b8;font-size:0.95rem;margin-bottom:1.5rem;">${d}</p>
    <a href="${esc(opts.redirectUrl)}" style="background:#6366f1;color:#fff;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;">
      Watch Now →
    </a>
  </div>
</body>
</html>`
}

// ============ ANIME META FETCHER ============
// animebing.in/detail/slug se slug nikalo aur API se meta lo
async function fetchAnimeMeta(
  targetUrl: string,
  apiBase: string
): Promise<{ title: string; description: string; image: string; slug: string } | null> {
  try {
    // Sirf animebing.in/detail/:slug URLs handle karo
    const match = targetUrl.match(/animebing\.in\/detail\/([^/?#]+)/)
    if (!match) return null

    const slug = match[1]
    const res = await fetch(`${apiBase}/api/anime/${slug}`, {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return null

    const data = await res.json() as { success: boolean; data?: Record<string, unknown> }
    if (!data.success || !data.data) return null

    const anime = data.data
    const title = String(anime.title || slug.replace(/-/g, ' '))

    // Episode count se title suffix
    const epCount = Number((anime as any).currentEpisode || 0)
    let titleFull = title
    if (anime.contentType === 'Movie')       titleFull += ' (Movie)'
    else if (anime.contentType === 'Manga')  titleFull += ' Manga'
    else if (epCount > 1)                    titleFull += ` EP 1-${epCount}`
    else if (epCount === 1)                  titleFull += ' EP 1'

    const description = String(
      (anime as any).description ||
      (anime as any).seoDescription ||
      (anime as any).synopsis ||
      `Watch ${title} online in HD quality on AnimeBing. Free streaming and downloads.`
    ).trim()

    const image = String((anime as any).thumbnail || 'https://animebing.in/AnimeBinglogo.jpg')

    return {
      title: `${titleFull} | AnimeBing`,
      description,
      image,
      slug,
    }
  } catch {
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

// ✅ Dashboard redirect
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
      // API base — wrangler.json ya .dev.vars se aata hai, index.ts mein MONGODB_URI jaisa
      const apiBase = (c.env as any).API_URL || 'https://animabing-backend.animabingwatch.workers.dev'

      const meta = await fetchAnimeMeta(link.url, apiBase)

      // Canonical URL: agar animebing.in/detail/slug hai to wohi, warna target URL
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
        }),
        200
      )
    }

    // ============ REAL USER: Click track karo + redirect ============
    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') ||
               c.req.header('X-Real-IP') || 'unknown'

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentClick = await db.collection('shortclicks').findOne({
      code, ip, clickedAt: { $gte: last24h }
    })

    if (!recentClick) {
      const country    = c.req.header('CF-IPCountry') || 'Unknown'
      const city       = (c as any).req.raw?.cf?.city || 'Unknown'
      const device     = userAgent
      const deviceType = /mobile|android|iphone|ipad/i.test(device)
        ? 'mobile' : /tablet/i.test(device) ? 'tablet' : 'desktop'

      const clickData: any = {
        code, ip, country, city,
        device: deviceType,
        browser: device.substring(0, 100),
        clickedAt: new Date()
      }
      if (link.userId) clickData.userId = link.userId

      await db.collection('shortclicks').insertOne(clickData)
      await db.collection('shortlinks').updateOne(
        { code },
        { $inc: { clicks: 1 }, $set: { lastClicked: new Date() } }
      )

      if (link.userId) {
        const user = await db.collection('shortusers').findOne({ _id: link.userId })
        if (user) {
          const earningPerClick = (user.ratePerThousand || 10) / 1000
          await db.collection('shortusers').updateOne(
            { _id: link.userId },
            {
              $inc: {
                totalClicks:    1,
                totalEarnings:  earningPerClick,
                unpaidEarnings: earningPerClick
              }
            }
          )
        }
      }
    }

    return c.redirect(link.url, 302)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortenerRoutes