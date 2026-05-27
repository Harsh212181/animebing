import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany } from '../services/mongoService'
import { IAnime } from '../models/types'

const sitemapRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

// ANIME SITEMAP
sitemapRoutes.get('/sitemap-anime.xml', async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const animeList = await findMany<IAnime>(
      'animes', {},
      { projection: { slug: 1, updatedAt: 1, title: 1, thumbnail: 1 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    if (!animeList || animeList.length === 0) {
      c.header('Content-Type', 'application/xml')
      return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`)
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`
    animeList.forEach((anime) => {
      const lastmod = anime.updatedAt
        ? new Date(anime.updatedAt).toISOString().split('T')[0]
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

    c.header('Content-Type', 'application/xml')
    return c.body(xml)
  } catch (err: any) {
    return c.text('Internal Server Error', 500)
  }
})

// EPISODES SITEMAP - DISABLED
sitemapRoutes.get('/sitemap-episodes.xml', (c) => {
  return c.text('Sitemap not available', 404)
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