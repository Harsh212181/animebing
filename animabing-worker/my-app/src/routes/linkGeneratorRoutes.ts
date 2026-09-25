import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { getDb } from '../services/mongoService'
import { shortenWithAllProviders, signBundle } from '../services/externalShortenerService'
import { ObjectId } from 'mongodb'

const linkGeneratorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

const ALLOWED_HOSTS = ['animebing.in', 'www.animebing.in']

// ✅ FIX: connection count pehle se hi 1 tha (db ek baar khul ke reuse ho raha
// tha) — asli issue ye tha ki `new (await import('mongodb')).ObjectId(...)`
// har request pe ek dynamic import chala raha tha, jo unnecessary overhead
// hai (aur Workers bundling ke saath kabhi kabhi fragile bhi ho sakta hai).
// Ab top-level static `import { ObjectId } from 'mongodb'` use kiya.
//
// Bonus: `page` lookup aur `sub` (subadmin) lookup ek dusre pe depend nahi
// karte, isliye unhe Promise.all se parallel kar diya — same connection,
// thoda kam wait time.
linkGeneratorRoutes.post('/generate', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { url } = await c.req.json()
    if (!url || !url.startsWith('http')) {
      return c.json({ error: 'Valid URL required' }, 400)
    }

    let target: string = url

    // Sub-admin: sirf apne download page ka link
    if (admin.role === 'subadmin') {
      let u: URL
      try { u = new URL(url) } catch { return c.json({ error: 'Invalid URL' }, 400) }
      const m = u.pathname.match(/^\/download\/([^/]+)\/?$/)
      if (!ALLOWED_HOSTS.includes(u.hostname) || !m) {
        return c.json({ error: 'Sirf apne download page ka link generate kar sakte ho.' }, 403)
      }

      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

      const [page, sub] = await Promise.all([
        db.collection('downloadpages').findOne({ slug: m[1] }, { projection: { animeId: 1 } }) as Promise<any>,
        db.collection('subadmins').findOne(
          { _id: new ObjectId(admin.id) }, { projection: { assignedAnimeIds: 1 } }
        ) as Promise<any>,
      ])

      const anime: any = page
        ? await db.collection('animes').findOne({ _id: page.animeId }, { projection: { createdBy: 1 } })
        : null

      const assigned: string[] = sub?.assignedAnimeIds || []
      const owns = anime && (anime.createdBy?.toString() === admin.id || assigned.includes(anime._id.toString()))
      if (!owns) {
        return c.json({ error: 'Ye download page aapka nahi hai.' }, 403)
      }
      target = `${u.origin}${u.pathname}`   // query hata do, sirf clean page URL
    }

    const result = await shortenWithAllProviders(target, c.env)

    // Order wahi jo frontend banata hai: Cuty, Shrinkme, Linkjust, Gplinks, Link 5
    const ordered = [
      result['Cuty.io'], result['Shrinkme'], result['Linkjust.com'], result['Gplinks'], result['Link 5'],
    ].map(v => v || '')
    const genToken = await signBundle(c.env.JWT_SECRET, admin.id, ordered)

    return c.json({ ...result, genToken })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default linkGeneratorRoutes