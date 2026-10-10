import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { withDb, toObjectId, isValidObjectId } from '../services/mongoService'
import { ObjectId, Db } from 'mongodb'
import { IPoll } from '../models/types'
import { getCachedJSON } from '../utils/cache'

const pollRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const ALL_LOCATIONS: Array<'home' | 'detail' | 'downloadLink'> = ['home', 'detail', 'downloadLink']

const getPollLocations = (p: any): Array<'home' | 'detail' | 'downloadLink'> =>
  Array.isArray(p.displayLocations) && p.displayLocations.length > 0 ? p.displayLocations : ALL_LOCATIONS

function normalizeLocations(input: any): Array<'home' | 'detail' | 'downloadLink'> {
  if (!Array.isArray(input)) return ALL_LOCATIONS
  const valid = input.filter((v: any) => ALL_LOCATIONS.includes(v))
  return valid.length > 0 ? valid : ALL_LOCATIONS
}

async function autoDeactivateExpired(db: Db) {
  try {
    await db.collection('polls').updateMany(
      { expiresAt: { $lt: new Date() }, isActive: true },
      { $set: { isActive: false } }
    )
  } catch (err) { }
}

async function invalidatePollsActiveCache(c: any) {
  try {
    // @ts-ignore
    const cache = caches.default
    const cacheUrl = new URL(c.req.url)
    cacheUrl.pathname = '/__cache_data__/api/polls/active'
    cacheUrl.search = ''
    cacheUrl.searchParams.set('_key', 'polls-active')
    await cache.delete(new Request(cacheUrl.toString(), { method: 'GET' }))
  } catch (err) {
    console.error('[invalidatePollsActiveCache] failed:', err)
  }
}

// ============ USER ROUTES ============

// GET ACTIVE POLL(S) — already uses withDb (inside getCachedJSON)
pollRoutes.get('/active', async (c) => {
  try {
    const deviceId = c.req.query('deviceId')
    const location = c.req.query('location') as 'home' | 'detail' | 'downloadLink' | undefined

    const pollsRaw = await getCachedJSON(c, 30, 'polls-active', () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollsActive', async (db) => {
        await autoDeactivateExpired(db)
        return await db.collection('polls').find({
          isActive: true,
          expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).toArray() as IPoll[]
      })
    )

    const filtered = location
      ? pollsRaw.filter((p: any) => getPollLocations(p).includes(location))
      : pollsRaw

    const polls = filtered.map((poll: any) => {
      let hasVoted = false
      let userVoteOption = null
      if (deviceId) {
        const voter = poll.voters?.find((v: any) => v.deviceId === deviceId)
        hasVoted = !!voter
        userVoteOption = voter ? voter.optionId.toString() : null
      }

      const pollObj: any = {
        ...poll,
        _id: poll._id?.toString(),
        userHasVoted: hasVoted,
        userVoteOption,
        displayLocations: getPollLocations(poll),
        hideVoteCounts: !!(poll as any).hideVoteCounts
      }

      if (pollObj.options) {
        pollObj.options = pollObj.options.map((opt: any) => ({
          ...opt,
          _id: opt._id?.toString(),
          percentage: poll.totalVotes! > 0 ? Math.round((opt.votes / poll.totalVotes!) * 100) : 0
        }))
      }

      delete pollObj.voters
      return pollObj
    })

    return c.json({ success: true, poll: polls[0] || null, polls })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error', polls: [] }, 500)
  }
})

// VOTE — already uses withDb
pollRoutes.post('/vote', async (c) => {
  try {
    const { pollId, optionId, deviceId, deviceType } = await c.req.json()

    if (!pollId || !optionId || !deviceId) {
      return c.json({ success: false, message: 'pollId, optionId, and deviceId are required' }, 400)
    }
    if (!isValidObjectId(pollId) || !isValidObjectId(optionId)) {
      return c.json({ success: false, message: 'Invalid pollId or optionId' }, 400)
    }

    const result = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollVote', async (db) => {
      const updated = await db.collection('polls').findOneAndUpdate(
        {
          _id: toObjectId(pollId),
          isActive: true,
          expiresAt: { $gt: new Date() },
          'voters.deviceId': { $ne: deviceId },
        },
        {
          $inc: { 'options.$[opt].votes': 1, totalVotes: 1 },
          $push: {
            voters: {
              deviceId,
              deviceType: deviceType || 'unknown',
              votedAt: new Date(),
              optionId: toObjectId(optionId),
            },
          } as any,
        },
        {
          arrayFilters: [{ 'opt._id': toObjectId(optionId) }],
          returnDocument: 'after',
        }
      )

      if (updated) {
        return { ok: true as const, totalVotes: updated.totalVotes }
      }

      const poll = await db.collection('polls').findOne({ _id: toObjectId(pollId) }) as IPoll | null
      if (!poll || !poll.isActive || new Date(poll.expiresAt) <= new Date()) {
        return { ok: false as const, msg: 'Poll not found or expired' }
      }
      const alreadyVoted = poll.voters?.some((v: any) => v.deviceId === deviceId)
      if (alreadyVoted) {
        return { ok: false as const, msg: 'Already voted', voted: true }
      }
      return { ok: false as const, msg: 'Vote failed' }
    })

    if (result.ok) {
      c.executionCtx.waitUntil(invalidatePollsActiveCache(c))

      return c.json({
        success: true,
        totalVotes: result.totalVotes,
        userHasVoted: true,
        userVoteOption: optionId,
      })
    }

    return c.json(
      { success: false, message: result.msg, ...(result.voted ? { userHasVoted: true } : {}) },
      400
    )
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500)
  }
})

// CHECK VOTE — already uses withDb
pollRoutes.get('/check-vote/:pollId', async (c) => {
  try {
    const pollId = c.req.param('pollId')
    const deviceId = c.req.query('deviceId')

    if (!deviceId) return c.json({ success: true, hasVoted: false, voteOption: null })
    if (!isValidObjectId(pollId)) return c.json({ success: true, hasVoted: false, voteOption: null })

    const poll = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollCheck', (db) =>
      db.collection('polls').findOne({ _id: toObjectId(pollId) })
    ) as IPoll | null

    if (!poll) return c.json({ success: true, hasVoted: false, voteOption: null })

    const voter = poll.voters?.find((v: any) => v.deviceId === deviceId)
    return c.json({ success: true, hasVoted: !!voter, voteOption: voter ? voter.optionId.toString() : null })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

// GET RESULTS
// ✅ FIX: getDb → withDb
pollRoutes.get('/:id/results', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, message: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollResults', async (db) => {
      const poll = await db.collection('polls').findOne({ _id: toObjectId(id) }) as IPoll | null
      if (!poll) return c.json({ success: false, message: 'Poll not found' }, 404)

      const options = poll.options?.map((opt: any) => ({
        ...opt,
        _id: opt._id?.toString(),
        percentage: poll.totalVotes! > 0 ? Math.round((opt.votes / poll.totalVotes!) * 100) : 0
      }))

      return c.json({
        success: true,
        poll: {
          _id: poll._id?.toString(),
          question: poll.question,
          totalVotes: poll.totalVotes || 0,
          options,
          isActive: poll.isActive,
          expiresAt: poll.expiresAt,
          isExpired: new Date(poll.expiresAt) < new Date(),
          votersCount: poll.voters?.length || 0
        }
      })
    })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

// TEST
pollRoutes.get('/test', (c) => {
  return c.json({ success: true, message: 'Poll API working 🚀' })
})

// ============ ADMIN ROUTES ============

// CREATE POLL
// ✅ FIX: getDb → withDb
pollRoutes.post('/admin/create', async (c) => {
  try {
    const { question, options, expiresAt, displayLocations, hideVoteCounts } = await c.req.json()

    if (!question || !Array.isArray(options) || options.length < 4 || options.length > 10) {
      return c.json({ success: false, message: 'Question and 4-10 options required' }, 400)
    }
    if (!expiresAt) return c.json({ success: false, message: 'Expiration date required' }, 400)

    const expiryDate = new Date(expiresAt)
    if (expiryDate <= new Date()) return c.json({ success: false, message: 'Expiration must be in future' }, 400)

    const validatedOptions = options.map((opt: any, index: number) => {
      if (!opt.title || !opt.animeId) throw new Error('Each option needs title and animeId')
      return {
        _id: new ObjectId(),
        animeId: opt.animeId,
        title: opt.title.trim(),
        image: opt.image || '',
        votes: 0,
        order: index,
        isCustom: opt.animeId.startsWith('custom_')
      }
    })

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollCreate', async (db) => {
      const now = new Date()
      await db.collection('polls').insertOne({
        question: question.trim(),
        options: validatedOptions,
        expiresAt: expiryDate,
        isActive: true,
        totalVotes: 0,
        voters: [],
        displayLocations: normalizeLocations(displayLocations),
        hideVoteCounts: Boolean(hideVoteCounts),
        createdAt: now,
        updatedAt: now,
      })

      return c.json({ success: true, message: 'Poll created successfully' })
    })
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500)
  }
})

// GET ALL POLLS
// ✅ FIX: getDb → withDb
pollRoutes.get('/admin/all', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminAll', async (db) => {
      await autoDeactivateExpired(db)

      const polls = await db.collection('polls').find({}).sort({ createdAt: -1 }).toArray()

      const processed = polls.map((poll: any) => ({
        ...poll,
        _id: poll._id.toString(),
        isExpired: new Date(poll.expiresAt) < new Date(),
        votersCount: poll.voters?.length || 0,
        displayLocations: getPollLocations(poll),
        hideVoteCounts: !!poll.hideVoteCounts,
        options: poll.options?.map((opt: any) => ({
          ...opt,
          _id: opt._id?.toString(),
          percentage: poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
        }))
      }))

      return c.json(processed)
    })
  } catch (err: any) {
    return c.json([])
  }
})

// GET SINGLE POLL
// ✅ FIX: getDb → withDb
pollRoutes.get('/admin/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, message: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminGet', async (db) => {
      const poll = await db.collection('polls').findOne({ _id: toObjectId(id) }) as any
      if (!poll) return c.json({ success: false, message: 'Poll not found' }, 404)

      return c.json({
        success: true,
        poll: {
          ...poll,
          _id: poll._id.toString(),
          isExpired: new Date(poll.expiresAt) < new Date(),
          votersCount: poll.voters?.length || 0,
          displayLocations: getPollLocations(poll),
          hideVoteCounts: !!poll.hideVoteCounts,
          options: poll.options?.map((opt: any) => ({
            ...opt,
            _id: opt._id?.toString(),
            percentage: poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
          }))
        }
      })
    })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

// UPDATE POLL
// ✅ FIX: getDb → withDb
pollRoutes.put('/admin/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, message: 'Invalid ID' }, 400)
    const { question, options, expiresAt, isActive, displayLocations, hideVoteCounts } = await c.req.json()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminUpdate', async (db) => {
      const poll = await db.collection('polls').findOne({ _id: toObjectId(id) }) as any
      if (!poll) return c.json({ success: false, message: 'Poll not found' }, 404)

      const updateData: any = { updatedAt: new Date() }
      if (question !== undefined) updateData.question = question.trim()
      if (expiresAt !== undefined) {
        const expiryDate = new Date(expiresAt)
        if (expiryDate <= new Date()) return c.json({ success: false, message: 'Expiration must be in future' }, 400)
        updateData.expiresAt = expiryDate
      }
      if (options !== undefined) {
        if (options.length < 4 || options.length > 10) return c.json({ success: false, message: '4-10 options required' }, 400)
        updateData.options = options.map((opt: any, i: number) => ({
          _id: opt._id ? toObjectId(opt._id) : new ObjectId(),
          animeId: opt.animeId, title: opt.title.trim(),
          image: opt.image || '', votes: opt.votes || 0,
          order: i, isCustom: opt.animeId.startsWith('custom_')
        }))
      }
      if (isActive !== undefined) updateData.isActive = isActive
      if (displayLocations !== undefined) updateData.displayLocations = normalizeLocations(displayLocations)
      if (hideVoteCounts !== undefined) updateData.hideVoteCounts = Boolean(hideVoteCounts)

      await db.collection('polls').updateOne({ _id: toObjectId(id) }, { $set: updateData })
      return c.json({ success: true, message: 'Poll updated successfully' })
    })
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500)
  }
})

// TOGGLE POLL
// ✅ FIX: getDb → withDb
pollRoutes.put('/admin/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, message: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminToggle', async (db) => {
      const poll = await db.collection('polls').findOne({ _id: toObjectId(id) }) as any
      if (!poll) return c.json({ success: false, message: 'Poll not found' }, 404)

      const isExpired = new Date(poll.expiresAt) < new Date()
      if (isExpired && !poll.isActive) return c.json({ success: false, message: 'Cannot activate expired poll' }, 400)

      await db.collection('polls').updateOne({ _id: toObjectId(id) }, { $set: { isActive: !poll.isActive, updatedAt: new Date() } })
      return c.json({ success: true, isActive: !poll.isActive, message: `Poll ${!poll.isActive ? 'activated' : 'deactivated'}` })
    })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

// DELETE POLL
// ✅ FIX: getDb → withDb
pollRoutes.delete('/admin/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, message: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminDelete', async (db) => {
      const poll = await db.collection('polls').findOneAndDelete({ _id: toObjectId(id) })
      if (!poll) return c.json({ success: false, message: 'Poll not found' }, 404)
      return c.json({ success: true, message: 'Poll deleted successfully' })
    })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

// CLEANUP EXPIRED
// ✅ FIX: getDb → withDb
pollRoutes.delete('/admin/cleanup/expired', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'pollAdminCleanup', async (db) => {
      const result = await db.collection('polls').deleteMany({ expiresAt: { $lt: new Date() }, isActive: false })
      return c.json({ success: true, message: `Deleted ${result.deletedCount} expired polls`, deletedCount: result.deletedCount })
    })
  } catch (err: any) {
    return c.json({ success: false, message: 'Server error' }, 500)
  }
})

export default pollRoutes