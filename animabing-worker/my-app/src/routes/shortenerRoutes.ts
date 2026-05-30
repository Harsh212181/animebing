import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ ADMIN — SAARE LINKS DEKHO ============
// ⚠️ Admin routes PEHLE register karo — /:code se pehle
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

// ============ ADMIN — NAYA LINK BANAO ============
shortenerRoutes.post('/admin/links', adminAuth, async (c) => {
  try {
    const { code, url, label } = await c.req.json()

    if (!code || !url) {
      return c.json({ error: 'code aur url dono required hain' }, 400)
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return c.json({ error: 'Code mein sirf letters, numbers, - aur _ allowed hain' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const existing = await db.collection('shortlinks').findOne({ code })
    if (existing) {
      return c.json({ error: `"${code}" already exist karta hai` }, 400)
    }

    const newLink = {
      code,
      url,
      label: label || code,
      clicks: 0,
      createdAt: new Date(),
      lastClicked: null
    }

    await db.collection('shortlinks').insertOne(newLink)
    return c.json({ success: true, message: 'Link ban gaya!', link: newLink })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — LINK UPDATE KARO ============
shortenerRoutes.put('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const { url, label } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('shortlinks').updateOne(
      { code },
      { $set: { url, label, updatedAt: new Date() } }
    )
    return c.json({ success: true, message: 'Link update ho gaya!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ ADMIN — LINK DELETE KARO ============
shortenerRoutes.delete('/admin/links/:code', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('shortlinks').deleteOne({ code })
    return c.json({ success: true, message: 'Link delete ho gaya!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ STATS — EK LINK KI DETAIL ============
shortenerRoutes.get('/admin/links/:code/stats', adminAuth, async (c) => {
  try {
    const code = c.req.param('code')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })
    if (!link) return c.json({ error: 'Link nahi mila' }, 404)
    return c.json(link)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ REDIRECT — go.animebing.in/abc ============
// ⚠️ Yeh SABSE LAST mein hona chahiye
shortenerRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const link = await db.collection('shortlinks').findOne({ code })

    if (!link) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Link Not Found</title>
            <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: white; }
              .box { text-align: center; padding: 2rem; }
              h2 { color: #f87171; }
              a { color: #818cf8; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>404 — Link nahi mila</h2>
              <p>Yeh short link exist nahi karta.</p>
              <a href="https://animebing.in">← Animebing.in pe jao</a>
            </div>
          </body>
        </html>
      `, 404)
    }

    // Click count update karo
    await db.collection('shortlinks').updateOne(
      { code },
      { $inc: { clicks: 1 }, $set: { lastClicked: new Date() } }
    )

    return c.redirect(link.url, 302)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default shortenerRoutes