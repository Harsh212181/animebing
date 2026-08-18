 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import {
  findMany,
  findOne,
  insertOne,
  updateOne,
  deleteOne,
  toObjectId,
  isValidObjectId
} from '../services/mongoService'
import { adminAuth, requirePermission } from '../middleware/auth'

const notesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
const COLLECTION = 'notes'

// Login + 'notes' permission dono zaroori (super-admin auto allowed)
notesRoutes.use('*', adminAuth)
notesRoutes.use('*', requirePermission('notes'))

// ============ GET ALL NOTES ============
notesRoutes.get('/', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')

    const archived = c.req.query('archived') === 'true'
    const trashed = c.req.query('trashed') === 'true'
    const label = c.req.query('label')
    const search = c.req.query('search')
    const createdByRole = c.req.query('createdByRole') // 👈 naya

    const filter: Record<string, any> = { archived, trashed }

    // 🔑 Role-based visibility
    if (admin.role === 'subadmin') {
      filter.createdBy = admin.id   // sirf apne notes
    } else if (createdByRole === 'admin' || createdByRole === 'subadmin') {
      // 👈 super-admin ke liye creator filter apply karo
      filter.createdByRole = createdByRole
    }
    // super-admin + filter na ho -> sab dikhega

    if (label) filter.labels = label
    if (search) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } }
          ]
        }
      ]
    }

    const notes = await findMany(
      COLLECTION,
      filter,
      { sort: { pinned: -1, updatedAt: -1 } },
      MONGODB_URI,
      MONGODB_DB
    )

    return c.json({ success: true, notes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ LINK PREVIEW (fetch meta image/title/desc for a URL) ============
notesRoutes.get('/link-preview', async (c) => {
  try {
    const url = c.req.query('url')
    if (!url) return c.json({ success: false, error: 'URL required' }, 400)

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return c.json({ success: false, error: 'Invalid URL' }, 400)
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return c.json({ success: false, error: 'Invalid protocol' }, 400)
    }
    // Basic SSRF guard — internal/local addresses block karo
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    if (blockedHosts.includes(parsed.hostname) || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('172.')) {
      return c.json({ success: false, error: 'Blocked host' }, 400)
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnimaBingLinkBot/1.0)' },
      cf: { cacheTtl: 3600, cacheEverything: true } as any,
    })
    const html = await res.text()

    const getMeta = (prop: string): string | null => {
      let re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')
      let m = html.match(re)
      if (m) return m[1]
      re = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
      m = html.match(re)
      return m ? m[1] : null
    }

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)

    const image = getMeta('og:image') || getMeta('twitter:image')
    const title = getMeta('og:title') || (titleMatch ? titleMatch[1] : null) || parsed.hostname
    const description = getMeta('og:description') || getMeta('description')
    const siteName = getMeta('og:site_name') || parsed.hostname

    return c.json({
      success: true,
      preview: {
        url,
        title: (title || parsed.hostname).trim().slice(0, 200),
        description: (description || '').trim().slice(0, 300),
        image: image || null,
        siteName: (siteName || parsed.hostname).trim(),
        domain: parsed.hostname,
      },
    })
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch preview' }, 500)
  }
})

// ============ GET SINGLE NOTE ============
notesRoutes.get('/:id', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const id = c.req.param('id')

    if (!isValidObjectId(id)) {
      return c.json({ success: false, error: 'Invalid note id' }, 400)
    }

    const note: any = await findOne(
      COLLECTION,
      { _id: toObjectId(id) },
      MONGODB_URI,
      MONGODB_DB
    )

    if (!note) return c.json({ success: false, error: 'Note not found' }, 404)

    // Sub-admin sirf apna hi note khol sakta hai
    if (admin.role === 'subadmin' && note.createdBy !== admin.id) {
      return c.json({ success: false, error: 'Access denied' }, 403)
    }

    return c.json({ success: true, note })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ CREATE NOTE ============
notesRoutes.post('/', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const body = await c.req.json()

    const newNote = {
      title: body.title || '',
      content: body.content || '',
      color: body.color || '#ffffff',
      textColor: body.textColor || '#ffffff',   // 👈 ADD karo
      pinned: false,
      archived: false,
      trashed: false,
      labels: body.labels || [],
      checklist: body.checklist || [],
      reminder: body.reminder || null,
      visibility: 'private', // ab visibility concept simple: role hi decide karta hai
      createdBy: admin.id,
      createdByName: admin.username || '',
      createdByRole: admin.role === 'subadmin' ? 'subadmin' : 'admin'
    }

    const result = await insertOne(COLLECTION, newNote, MONGODB_URI, MONGODB_DB)

    return c.json({ success: true, id: result.insertedId })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UPDATE NOTE ============
notesRoutes.put('/:id', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const id = c.req.param('id')
    const body = await c.req.json()

    if (!isValidObjectId(id)) {
      return c.json({ success: false, error: 'Invalid note id' }, 400)
    }

    // Sub-admin sirf apna hi note edit kar sake, isliye pehle ownership check
    if (admin.role === 'subadmin') {
      const existing: any = await findOne(COLLECTION, { _id: toObjectId(id) }, MONGODB_URI, MONGODB_DB)
      if (!existing) return c.json({ success: false, error: 'Note not found' }, 404)
      if (existing.createdBy !== admin.id) {
        return c.json({ success: false, error: 'Access denied' }, 403)
      }
    }

    const allowedFields = [
      'title', 'content', 'color', 'textColor', 'pinned',   // 👈 'textColor' add karo
      'archived', 'labels', 'checklist', 'reminder'
    ]

    const update: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) update[field] = body[field]
    }

    const result = await updateOne(
      COLLECTION,
      { _id: toObjectId(id) },
      update,
      MONGODB_URI,
      MONGODB_DB
    )

    if (!result) return c.json({ success: false, error: 'Note not found' }, 404)

    return c.json({ success: true, note: result })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ MOVE TO TRASH ============
notesRoutes.delete('/:id', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const id = c.req.param('id')

    if (!isValidObjectId(id)) {
      return c.json({ success: false, error: 'Invalid note id' }, 400)
    }

    if (admin.role === 'subadmin') {
      const existing: any = await findOne(COLLECTION, { _id: toObjectId(id) }, MONGODB_URI, MONGODB_DB)
      if (!existing) return c.json({ success: false, error: 'Note not found' }, 404)
      if (existing.createdBy !== admin.id) {
        return c.json({ success: false, error: 'Access denied' }, 403)
      }
    }

    const result = await updateOne(
      COLLECTION,
      { _id: toObjectId(id) },
      { trashed: true, pinned: false },
      MONGODB_URI,
      MONGODB_DB
    )

    if (!result) return c.json({ success: false, error: 'Note not found' }, 404)

    return c.json({ success: true, message: 'Note moved to trash' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ RESTORE FROM TRASH ============
notesRoutes.post('/:id/restore', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const id = c.req.param('id')

    if (!isValidObjectId(id)) {
      return c.json({ success: false, error: 'Invalid note id' }, 400)
    }

    if (admin.role === 'subadmin') {
      const existing: any = await findOne(COLLECTION, { _id: toObjectId(id) }, MONGODB_URI, MONGODB_DB)
      if (!existing) return c.json({ success: false, error: 'Note not found' }, 404)
      if (existing.createdBy !== admin.id) {
        return c.json({ success: false, error: 'Access denied' }, 403)
      }
    }

    const result = await updateOne(
      COLLECTION,
      { _id: toObjectId(id) },
      { trashed: false },
      MONGODB_URI,
      MONGODB_DB
    )

    if (!result) return c.json({ success: false, error: 'Note not found' }, 404)

    return c.json({ success: true, message: 'Note restored', note: result })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ PERMANENT DELETE ============
notesRoutes.delete('/:id/permanent', async (c) => {
  try {
    const { MONGODB_URI, MONGODB_DB } = c.env
    const admin = c.get('admin')
    const id = c.req.param('id')

    if (!isValidObjectId(id)) {
      return c.json({ success: false, error: 'Invalid note id' }, 400)
    }

    if (admin.role === 'subadmin') {
      const existing: any = await findOne(COLLECTION, { _id: toObjectId(id) }, MONGODB_URI, MONGODB_DB)
      if (!existing) return c.json({ success: false, error: 'Note not found' }, 404)
      if (existing.createdBy !== admin.id) {
        return c.json({ success: false, error: 'Access denied' }, 403)
      }
    }

    const result = await deleteOne(COLLECTION, { _id: toObjectId(id) }, MONGODB_URI, MONGODB_DB)

    if (result.deletedCount === 0) {
      return c.json({ success: false, error: 'Note not found' }, 404)
    }

    return c.json({ success: true, message: 'Note permanently deleted' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default notesRoutes