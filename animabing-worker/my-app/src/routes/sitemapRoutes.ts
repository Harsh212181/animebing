import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany } from '../services/mongoService'
import { IAnime } from '../models/types'
import { withEdgeCache } from '../utils/cache'

const sitemapRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// STATIC SITEMAP
sitemapRoutes.get('/sitemap-static.xml', (c) => {
  const today = new Date().toISOString().split('T')[0]

  const staticPages = ['', 'top-100', 'privacy', 'terms', 'dmca', 'contact']

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`
  staticPages.forEach((page) => {
    const loc = page === '' ? 'https://animebing.in/' : `https://animebing.in/${page}`
    xml += `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page === '' ? 'daily' : 'monthly'}</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`
  })

  xml += `\n</urlset>`

  c.header('Content-Type', 'application/xml')
  return c.body(xml)
})

// ============================================================================
// 🆕 CACHED VERSION — SABSE HIGH-TRAFFIC SITEMAP ROUTE.
//   1) Top pe import add kiya: `withEdgeCache` from '../utils/cache'
//   2) Ye route ab 6 hours (21600 seconds) edge-cached hai.
//
// NOTE: withEdgeCache JSON data cache karta hai (JSON.stringify karke),
// isliye yahan hum XML string ko ek object me wrap karke cache karte hain,
// phir handler ke bahar unwrap karke XML response bhejte hain.
// ============================================================================
sitemapRoutes.get('/sitemap-anime.xml', async (c) => {
  try {
    const cached = await withEdgeCache(c, 21600, async () => { // 6 hours = 21600 seconds
      const today = new Date().toISOString().split('T')[0]

      const animeList = await findMany<IAnime>(
        'animes', {},
        { projection: { slug: 1, updatedAt: 1, title: 1, thumbnail: 1, createdAt: 1 } },
        c.env.MONGODB_URI, c.env.MONGODB_DB
      )

      if (!animeList || animeList.length === 0) {
        return { xml: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>` }
      }

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`
      animeList.forEach((anime) => {
        const lastmod = anime.updatedAt
          ? new Date(anime.updatedAt).toISOString().split('T')[0]
          : (anime as any).createdAt
            ? new Date((anime as any).createdAt).toISOString().split('T')[0]
            : today

        xml += `
  <url>
    <loc>https://animebing.in/detail/${anime.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>`

        if (anime.thumbnail) {
          xml += `
    <image:image>
      <image:loc>${anime.thumbnail}</image:loc>
      <image:title>${anime.title}</image:title>
    </image:image>`
        }

        xml += `\n  </url>`
      })

      xml += `\n</urlset>`

      return { xml }
    })

    // ✅ FIX — `cached.json()` ka return type `unknown` hota hai,
    // isliye explicit cast kar rahe hain taaki `.xml` access ho sake
    const data = await cached.json() as { xml: string }
    return new Response(data.xml, {
      headers: { 'Content-Type': 'application/xml' }
    })
  } catch (err: any) {
    return c.text('Internal Server Error', 500)
  }
})

// MASTER SITEMAP INDEX
sitemapRoutes.get('/sitemap.xml', (c) => {
  const today = new Date().toISOString().split('T')[0]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <sitemap>
    <loc>https://animebing.in/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>

  <sitemap>
    <loc>https://animebing.in/sitemap-anime.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>

</sitemapindex>`

  c.header('Content-Type', 'application/xml')
  return c.body(xml)
})

export default sitemapRoutes