// File: ANIMABING/animabing-worker/my-app/src/routes/shortenerRoutes.ts

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { getDb } from '../services/mongoService'
import { adminAuth } from '../middleware/auth'
import { ObjectId } from 'mongodb'

const shortenerRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

// ✅ NEW: Dashboard redirect — worker se React app par bhejo
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

    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For') ||
               c.req.header('X-Real-IP') || 'unknown'

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentClick = await db.collection('shortclicks').findOne({
      code, ip, clickedAt: { $gte: last24h }
    })

    if (!recentClick) {
      const country = c.req.header('CF-IPCountry') || 'Unknown'
      const city = (c as any).req.raw?.cf?.city || 'Unknown'
      const device = c.req.header('User-Agent') || ''
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
                totalClicks: 1,
                totalEarnings: earningPerClick,
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