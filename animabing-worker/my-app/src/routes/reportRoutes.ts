import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne, deleteOne,
  deleteMany, toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IReport } from '../models/types'
import { ObjectId } from 'mongodb'

const reportRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ CREATE REPORT (public) ============
reportRoutes.post('/', async (c) => {
  try {
    const { animeId, episodeId, episodeNumber, issueType, description, email, username } = await c.req.json()

    if (!issueType) {
      return c.json({ success: false, error: 'Issue type is required' }, 400)
    }
    if (!description || description.trim().length < 10) {
      return c.json({ success: false, error: 'Description must be at least 10 characters' }, 400)
    }

    const report = {
      animeId: animeId ? toObjectId(animeId) : null,
      episodeId: episodeId ? toObjectId(episodeId) : null,
      episodeNumber: episodeNumber || null,
      issueType,
      description: description.trim(),
      message: description.trim(),
      email: email || 'Not provided',
      username: username || 'Anonymous',
      type: 'episode',
      userIP: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'Unknown',
      status: 'Pending'
    }

    await insertOne('reports', report, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Report submitted! We will fix the issue soon.' })
  } catch (err: any) {
    return c.json({ success: false, error: 'Server error: ' + err.message }, 500)
  }
})

// ============ GET ALL REPORTS - anime thumbnail ke saath (admin) ============
reportRoutes.get('/', async (c) => {
  try {
    // Step 1: Ek hi db connection lo
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Step 2: Saare reports fetch karo
    const reports = await db.collection('reports')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    // Step 3: Episode reports ke animeIds collect karo
    const animeIds = reports
      .filter((r: any) => r.type === 'episode' && r.animeId)
      .map((r: any) => {
        try {
          return new ObjectId(r.animeId.toString())
        } catch {
          return null
        }
      })
      .filter(Boolean)

    // Step 4: Ek query mein saare animes fetch karo (N+1 problem avoid)
    const animeMap: Record<string, { _id: any; title: string; thumbnail: string }> = {}

    if (animeIds.length > 0) {
      const animes = await db.collection('animes')
        .find(
          { _id: { $in: animeIds as any } },
          { projection: { title: 1, thumbnail: 1 } }
        )
        .toArray()

      // Map banao: animeId string => anime object
      animes.forEach((anime: any) => {
        animeMap[anime._id.toString()] = {
          _id: anime._id,
          title: anime.title,
          thumbnail: anime.thumbnail || null
        }
      })
    }

    // Step 5: Reports mein anime data inject karo
    const enrichedReports = reports.map((report: any) => {
      if (report.type === 'episode' && report.animeId) {
        const animeIdStr = report.animeId.toString()
        const anime = animeMap[animeIdStr]
        return {
          ...report,
          animeId: anime
            ? { _id: anime._id, title: anime.title, thumbnail: anime.thumbnail }
            : { _id: report.animeId, title: 'Unknown Anime', thumbnail: null }
        }
      }
      return report
    })

    return c.json(enrichedReports)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ GET BY USER EMAIL (public) ============
reportRoutes.get('/user/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const reports = await findMany<IReport>(
      'reports',
      { email },
      { sort: { createdAt: -1 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json(reports)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ UPDATE REPORT STATUS (admin) ============
reportRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const body = await c.req.json()

    const updateData: any = { ...body }

    if (body.status === 'Fixed' && !body.resolvedAt) {
      updateData.resolvedAt = new Date()
    }

    const updated = await updateOne(
      'reports',
      { _id: toObjectId(id) },
      updateData,
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    if (!updated) return c.json({ error: 'Report not found' }, 404)

    return c.json({ success: true, message: 'Report updated', data: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ BULK DELETE - /:id se PEHLE hona chahiye (admin) ============
reportRoutes.post('/bulk-delete', adminAuth, async (c) => {
  try {
    const { reportIds } = await c.req.json()

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return c.json({ error: 'reportIds array is required' }, 400)
    }

    const objectIds = reportIds
      .filter((id: string) => isValidObjectId(id))
      .map((id: string) => toObjectId(id))

    if (objectIds.length === 0) {
      return c.json({ error: 'No valid IDs provided' }, 400)
    }

    await deleteMany(
      'reports',
      { _id: { $in: objectIds } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    return c.json({ success: true, message: `${objectIds.length} reports deleted successfully` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ DELETE SINGLE REPORT (admin) ============
reportRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const report = await findOne('reports', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!report) return c.json({ error: 'Report not found' }, 404)

    await deleteOne('reports', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Report deleted successfully' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default reportRoutes