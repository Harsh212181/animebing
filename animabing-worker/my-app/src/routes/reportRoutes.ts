import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany, findOne, insertOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { IReport } from '../models/types'

const reportRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// CREATE REPORT
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

// GET ALL REPORTS
reportRoutes.get('/', async (c) => {
  try {
    const reports = await findMany<IReport>('reports', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(reports)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET BY USER EMAIL
reportRoutes.get('/user/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const reports = await findMany<IReport>('reports', { email }, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(reports)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default reportRoutes