import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, updateOne, deleteOne,
  deleteMany, countDocuments, toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IAnime } from '../models/types'

const animeRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ FEATURED ============
animeRoutes.get('/featured', async (c) => {
  try {
    const animes = await findMany<IAnime>(
      'animes',
      { featured: true, isHidden: { $ne: true } },
      {
        sort: { featuredOrder: -1, createdAt: -1 },
        limit: 24,
        projection: { title: 1, thumbnail: 1, releaseYear: 1, subDubStatus: 1, contentType: 1, updatedAt: 1, createdAt: 1, bannerImage: 1, rating: 1, slug: 1, seoTitle: 1, likes: 1, dislikes: 1, monthlyLikes: 1, weeklyLikes: 1, currentEpisode: 1 }
      },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true, data: animes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ TOP 100 ============
animeRoutes.get('/top100', async (c) => {
  try {
    const type = c.req.query('type') || 'all-time'
    const contentType = c.req.query('contentType') || 'all'
    const limit = parseInt(c.req.query('limit') || '100')
    const page = parseInt(c.req.query('page') || '1')
    const skip = (page - 1) * limit

    let filter: any = { isHidden: { $ne: true } }
    if (contentType && contentType !== 'all') filter.contentType = contentType

    let sortField = 'likes'
    if (type === 'monthly') sortField = 'monthlyLikes'
    else if (type === 'weekly') sortField = 'weeklyLikes'

    const animes = await findMany<IAnime>(
      'animes', filter,
      {
        sort: { [sortField]: -1, title: 1 },
        skip, limit,
        projection: { title: 1, thumbnail: 1, likes: 1, dislikes: 1, monthlyLikes: 1, weeklyLikes: 1, contentType: 1, slug: 1, rating: 1 }
      },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const total = await countDocuments('animes', filter, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({
      success: true,
      data: animes,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      },
      ranking: {
        type,
        contentType,
        period: type === 'all-time' ? 'All Time' : type === 'monthly' ? 'Last 30 Days' : 'Last 7 Days'
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SLUG ============
animeRoutes.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    if (!slug) return c.json({ success: false, error: 'Slug required' }, 400)

    const anime = await findOne<IAnime>('animes', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, message: 'Anime not found' }, 404)

    // increment views
    await updateOne('animes', { slug }, { views: (anime.views || 0) + 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // get episodes
    const episodes = await findMany('episodes', { animeId: anime._id }, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, data: { ...anime, episodes } })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SEARCH ============
animeRoutes.get('/search', async (c) => {
  try {
    const q = c.req.query('query') || ''
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '24')
    const skip = (page - 1) * limit

    const filter: any = {
      isHidden: { $ne: true },
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { seoKeywords: { $regex: q, $options: 'i' } },
        { seoTitle: { $regex: q, $options: 'i' } },
        { seoDescription: { $regex: q, $options: 'i' } }
      ]
    }

    const animes = await findMany<IAnime>('animes', filter, { sort: { likes: -1, updatedAt: -1 }, skip, limit }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const total = await countDocuments('animes', filter, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({
      success: true,
      data: animes,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      },
      searchInfo: { query: q, resultsFound: total }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UNASSIGNED (admin) ============
animeRoutes.get('/unassigned', adminAuth, async (c) => {
  try {
    const search = c.req.query('search') || ''
    const filter: any = { partnerId: null }
    if (search.trim()) filter.title = { $regex: search.trim(), $options: 'i' }

    const animes = await findMany<IAnime>('animes', filter, { limit: 20, projection: { title: 1, thumbnail: 1, status: 1, contentType: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(animes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ VOTE ============
animeRoutes.post('/:id/vote', async (c) => {
  try {
    const id = c.req.param('id')
    const { voteType } = await c.req.json()
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'

    if (!['like', 'dislike'].includes(voteType)) {
      return c.json({ success: false, error: 'Invalid vote type' }, 400)
    }

    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    const existingVote = anime.votes?.find((v: any) => v.ipAddress === ip)

    if (existingVote && existingVote.voteType === voteType) {
      // Remove vote
      await db.collection('animes').updateOne(
        { _id: toObjectId(id) },
        {
          $pull: { votes: { ipAddress: ip } } as any,
          $inc: {
            likes: voteType === 'like' ? -1 : 0,
            dislikes: voteType === 'dislike' ? -1 : 0,
            weeklyLikes: voteType === 'like' ? -1 : 0,
            monthlyLikes: voteType === 'like' ? -1 : 0,
            totalVotes: -1
          }
        }
      )
      return c.json({ success: true, message: 'Vote removed', data: { userVote: null, hasVoted: false } })
    }

    // Add/change vote
    const incData: any = {}
    if (existingVote) {
      // Change vote - remove old
      await db.collection('animes').updateOne(
        { _id: toObjectId(id) },
        { $pull: { votes: { ipAddress: ip } } as any }
      )
      incData[existingVote.voteType === 'like' ? 'likes' : 'dislikes'] = -1
      if (existingVote.voteType === 'like') { incData.weeklyLikes = -1; incData.monthlyLikes = -1 }
    }

    incData[voteType === 'like' ? 'likes' : 'dislikes'] = (incData[voteType === 'like' ? 'likes' : 'dislikes'] || 0) + 1
    if (voteType === 'like') { incData.weeklyLikes = (incData.weeklyLikes || 0) + 1; incData.monthlyLikes = (incData.monthlyLikes || 0) + 1 }
    if (!existingVote) incData.totalVotes = 1

    await db.collection('animes').updateOne(
      { _id: toObjectId(id) },
      {
        $push: { votes: { ipAddress: ip, voteType, date: new Date() } } as any,
        $inc: incData
      }
    )

    const updated = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime
    return c.json({
      success: true,
      message: `Vote ${voteType}d successfully`,
      data: {
        likes: updated.likes, dislikes: updated.dislikes,
        totalVotes: updated.totalVotes, userVote: voteType, hasVoted: true,
        monthlyLikes: updated.monthlyLikes, weeklyLikes: updated.weeklyLikes
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ VOTE STATUS ============
animeRoutes.get('/:id/vote-status', async (c) => {
  try {
    const id = c.req.param('id')
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'

    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const anime = await findOne<IAnime>('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    const vote = anime.votes?.find((v: any) => v.ipAddress === ip)
    return c.json({
      success: true,
      data: {
        hasVoted: !!vote, userVote: vote?.voteType || null,
        likes: anime.likes, dislikes: anime.dislikes,
        totalVotes: anime.totalVotes, monthlyLikes: anime.monthlyLikes, weeklyLikes: anime.weeklyLikes
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ HOMEPAGE LIST ============
animeRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '24')
    const skip = (page - 1) * limit

    const animes = await findMany<IAnime>(
      'animes', { isHidden: { $ne: true } },
      {
        sort: { lastContentAdded: -1 }, skip, limit,
        projection: { title: 1, thumbnail: 1, releaseYear: 1, subDubStatus: 1, contentType: 1, updatedAt: 1, createdAt: 1, slug: 1, likes: 1, dislikes: 1, rating: 1, monthlyLikes: 1, weeklyLikes: 1, totalVotes: 1, currentEpisode: 1, lastContentAdded: 1 }
      },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const total = await countDocuments('animes', { isHidden: { $ne: true } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({
      success: true, data: animes,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ HIDE/UNHIDE (admin) ============
animeRoutes.patch('/:id/hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const anime = await findOne<IAnime>('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    const newHidden = !anime.isHidden
    await updateOne('animes', { _id: toObjectId(id) }, { isHidden: newHidden }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: newHidden ? 'Anime hidden' : 'Anime visible', data: { isHidden: newHidden } })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED ADD/REMOVE (admin) ============
animeRoutes.post('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const count = await countDocuments('animes', { featured: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await updateOne('animes', { _id: toObjectId(id) }, { featured: true, featuredOrder: count + 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Added to featured', data: anime })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

animeRoutes.delete('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const anime = await updateOne('animes', { _id: toObjectId(id) }, { featured: false, featuredOrder: 0 }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Removed from featured', data: anime })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET SINGLE ANIME ============
animeRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const isObjectId = isValidObjectId(id)

    const anime = await findOne<IAnime>(
      'animes',
      isObjectId ? { _id: toObjectId(id) } : { slug: id },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (!anime) return c.json({ success: false, message: 'Anime not found' }, 404)

    await updateOne('animes', { _id: anime._id }, { views: (anime.views || 0) + 1 }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const episodes = await findMany('episodes', { animeId: anime._id }, { sort: { session: 1, episodeNumber: 1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, data: { ...anime, episodes } })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE ANIME (admin) ============
animeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const anime = await findOne<IAnime>('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    await deleteOne('animes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('downloadpages', { animeId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Anime deleted successfully' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeRoutes