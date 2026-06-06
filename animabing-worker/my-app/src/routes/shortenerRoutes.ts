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

// ============ META HTML BUILDER ============
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
  const safeCode     = esc(opts.code)

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

  <script>
  (function() {
    // Layer 2: UA check (client-side bhi)
    var ua = navigator.userAgent.toLowerCase();
    var botUA = ['bot','crawl','spider','facebookexternalhit','twitterbot',
      'whatsapp','telegram','discord','slack','linkedin','preview','wget',
      'curl','python','java','go-http','node-fetch','okhttp','axios','php','scraper'];
    if (botUA.some(function(b){ return ua.indexOf(b) !== -1; })) return;

    // Layer 2b: Headless browser detect
    var clues = [
      navigator.webdriver === true,
      !window.chrome && ua.indexOf('chrome') !== -1,
      !navigator.languages || navigator.languages.length === 0,
      !navigator.plugins || navigator.plugins.length === 0,
      window.outerWidth === 0 && window.outerHeight === 0,
      !window.screen || window.screen.width === 0,
      typeof window.Notification === 'undefined'
    ];
    if (clues.filter(Boolean).length >= 3) return;

    // Layer 2c: Canvas fingerprint — headless blank canvas return karta hai
    try {
      var cv = document.createElement('canvas');
      cv.getContext('2d').fillText('animabing', 2, 15);
      if (cv.toDataURL().length < 200) return;
    } catch(e) { return; }

    // Layer 3: Minimum dwell + interaction required
    var interacted = false, redirected = false;
    var t0 = Date.now();

    function go() {
      if (redirected) return;
      if (Date.now() - t0 < 1800) { setTimeout(go, 400); return; }
      if (!interacted) return;
      redirected = true;

      // Layer 4: Server-side token validate karo
      fetch('/api/shortener/validate-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '${safeCode}',
          dwell: Date.now() - t0,
          int: true,
          hw: clues.filter(Boolean).length
        }),
        keepalive: true
      }).catch(function(){});

      window.location.replace('${safeRedirect}');
    }

    // Interaction sunna — mouse, touch, scroll, keyboard
    ['mousemove','mousedown','touchstart','scroll','keydown'].forEach(function(ev) {
      document.addEventListener(ev, function h() {
        document.removeEventListener(ev, h);
        interacted = true;
        go();
      }, { once: true, passive: true });
    });

    // Dwell timer start
    setTimeout(go, 1800);

    // Button text update
    setTimeout(function() {
      var btn = document.getElementById('watch-btn');
      if (btn) { btn.textContent = 'Redirecting\u2026'; btn.style.opacity = '0.7'; }
    }, 2000);
  })();
  </script>

  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeRedirect}" />
  </noscript>
</head>
<body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;max-width:500px;">
    <img src="${esc(img)}" alt="${t}" style="width:100%;max-width:300px;border-radius:12px;margin-bottom:1.5rem;" onerror="this.style.display='none'" />
    <h1 style="font-size:1.4rem;margin-bottom:0.75rem;">${t}</h1>
    <p style="color:#94a3b8;font-size:0.95rem;margin-bottom:1.5rem;">${d}</p>
    <a id="watch-btn" href="${safeRedirect}" style="background:#6366f1;color:#fff;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;">
      Watch Now \u2192
    </a>
  </div>
</body>
</html>`
}

// ============ ANIME META FETCHER — DIRECT DB (NO HTTP) ============
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

// ============ VALIDATE CLICK — Bot filter server-side ============
shortenerRoutes.post('/validate-click', async (c) => {
  try {
    const { code, dwell, int: interacted, hw: headlessScore } = await c.req.json()

    if (!code)              return c.json({ ok: false, reason: 'no_code' })
    if (headlessScore >= 3) return c.json({ ok: false, reason: 'headless' })
    if (!interacted)        return c.json({ ok: false, reason: 'no_interaction' })
    if (dwell < 1500)       return c.json({ ok: false, reason: 'too_fast' })

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })
    if (!link) return c.json({ ok: false, reason: 'not_found' })

    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') || 'unknown'
    const ua = (c.req.header('User-Agent') || '').toLowerCase()

    // Server-side UA double-check
    const BOT_UA = ['bot','crawl','spider','curl','wget','python','java',
      'go-http','node-fetch','okhttp','axios','facebookexternalhit',
      'twitterbot','whatsapp','telegram','discord','slack','php','scraper']
    if (BOT_UA.some(p => ua.includes(p)))
      return c.json({ ok: false, reason: 'bot_ua' })

    // 24h dedup
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const dup = await db.collection('shortclicks').findOne({
      code, ip, clickedAt: { $gte: last24h }
    })
    if (dup) return c.json({ ok: true, counted: false, reason: 'dedup' })

    const country    = c.req.header('CF-IPCountry') || 'Unknown'
    const rawUA      = c.req.header('User-Agent') || ''
    const deviceType = /mobile|android|iphone|ipad/i.test(rawUA) ? 'mobile'
                     : /tablet/i.test(rawUA) ? 'tablet' : 'desktop'

    const clickData: any = {
      code, ip, country,
      city:      (c as any).req.raw?.cf?.city || 'Unknown',
      device:    deviceType,
      browser:   rawUA.substring(0, 100),
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
        const earn = (user.ratePerThousand || 10) / 1000
        await db.collection('shortusers').updateOne(
          { _id: link.userId },
          { $inc: { totalClicks: 1, totalEarnings: earn, unpaidEarnings: earn } }
        )
      }
    }

    return c.json({ ok: true, counted: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
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

    // ============ REAL USER: Meta HTML serve karo (JS redirect karega) ============
    // Click counting ab validate-click endpoint mein hoti hai
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

  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortenerRoutes