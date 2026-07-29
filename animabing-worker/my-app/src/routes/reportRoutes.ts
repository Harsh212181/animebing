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

// ============ PENDING REPORTS COUNT (red dot ke liye) - MUST be before /:id routes (admin) ============
reportRoutes.get('/pending-count', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (admin.role === 'subadmin') {
      const ownAnimes = await db.collection('animes')
        .find({ createdBy: admin.id }, { projection: { _id: 1 } })
        .toArray()
      const ownAnimeIds = ownAnimes.map((a: any) => a._id)

      if (ownAnimeIds.length === 0) {
        return c.json({ success: true, count: 0 })
      }

      const count = await db.collection('reports').countDocuments({
        type: 'episode',
        status: 'Pending',
        animeId: { $in: ownAnimeIds }
      })
      return c.json({ success: true, count })
    }

    const count = await db.collection('reports').countDocuments({ status: 'Pending' })
    return c.json({ success: true, count })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET ALL REPORTS - anime thumbnail + role-based filter (admin) ============
reportRoutes.get('/', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const reports = await db.collection('reports')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

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

    const animeMap: Record<string, { _id: any; title: string; thumbnail: string; createdBy?: string; createdByUsername?: string }> = {}

    if (animeIds.length > 0) {
      const animes = await db.collection('animes')
        .find(
          { _id: { $in: animeIds as any } },
          { projection: { title: 1, thumbnail: 1, createdBy: 1, createdByUsername: 1 } }
        )
        .toArray()

      animes.forEach((anime: any) => {
        animeMap[anime._id.toString()] = {
          _id: anime._id,
          title: anime.title,
          thumbnail: anime.thumbnail || null,
          createdBy: anime.createdBy || null,
          createdByUsername: anime.createdByUsername || null
        }
      })
    }

    // Enrich reports with anime data + sub-admin username
    let enrichedReports = reports.map((report: any) => {
      if (report.type === 'episode' && report.animeId) {
        const animeIdStr = report.animeId.toString()
        const anime = animeMap[animeIdStr]
        return {
          ...report,
          animeId: anime
            ? { _id: anime._id, title: anime.title, thumbnail: anime.thumbnail }
            : { _id: report.animeId, title: 'Unknown Anime', thumbnail: null },
          subAdminUsername: anime?.createdByUsername || null,
          _createdBy: anime?.createdBy || null   // temp field for filtering
        }
      }
      return { ...report, _createdBy: null }
    })

    // 🔒 Sub-admin: sirf apna add kiya hua anime ke reports dikhao
    if (admin.role === 'subadmin') {
      enrichedReports = enrichedReports.filter(
        (r: any) => r.type === 'episode' && r._createdBy === admin.id
      )
    }

    // temp field hatao response se pehle
    enrichedReports = enrichedReports.map((r: any) => {
      const { _createdBy, ...rest } = r
      return rest
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