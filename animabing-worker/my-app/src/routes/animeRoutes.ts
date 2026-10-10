import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import { withDb, toObjectId, isValidObjectId } from '../services/mongoService'
import { IAnime } from '../models/types'
import { withEdgeCache, fireAndForget, invalidateEdgeCache, getCachedJSON } from '../utils/cache'

const animeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============ SECTION FIELD MAPPING ============
const SECTION_FIELDS: Record<string, { flag: string; order: string }> = {
  content: { flag: 'featured', order: 'featuredOrder' },
  banner: { flag: 'featuredBannerSection', order: 'featuredBannerOrder' },
  anime: { flag: 'featuredAnimeSection', order: 'featuredAnimeOrder' },
  manga: { flag: 'featuredMangaSection', order: 'featuredMangaOrder' },
  movie: { flag: 'featuredMovieSection', order: 'featuredMovieOrder' },
}

// ============ AUTO-ROTATE HELPERS ============
const ROTATE_SECTIONS = ['banner', 'anime', 'manga', 'movie']

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const rnd = mulberry32(hashStr(seedStr))
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

async function invalidateAnimeCache(c: any, id: string, slug?: string | null) {
  try {
    await invalidateEdgeCache(c, `/api/anime/${id}`)
    if (slug) await invalidateEdgeCache(c, `/api/anime/slug/${slug}`)
  } catch (err) {
    console.error('[invalidateAnimeCache] failed:', err)
  }
}

async function throttledViewIncrement(c: any, lockName: string, matchFilter: any) {
  // @ts-ignore
  const cache = caches.default
  const lockUrl = new URL(c.req.url)
  lockUrl.pathname = '/__view_lock__/' + lockName
  lockUrl.search = ''
  const lockKey = new Request(lockUrl.toString(), { method: 'GET' })

  const alreadyCounted = await cache.match(lockKey)
  if (alreadyCounted) return

  const lockResponse = new Response('1', { headers: { 'Cache-Control': 'public, max-age=60' } })
  c.executionCtx.waitUntil(cache.put(lockKey, lockResponse))

  fireAndForget(
    c,
    withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'viewInc', (db) =>
      db.collection('animes').updateOne(matchFilter, { $inc: { views: 1 } })
    )
  )
}

// ============ FEATURED ============
animeRoutes.get('/featured', async (c) => {
  try {
    const section = c.req.query('section') || 'content'
    const raw = c.req.query('raw') === '1'
    const bucket = Math.min(Math.max(parseInt(c.req.query('v') || '0') || 0, 0), 9)

    const build = async () => {
      const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content
      const filter: any = { [cfg.flag]: true, isHidden: { $ne: true }, isBlocked: { $ne: true } }
      const sort: any = { [cfg.order]: -1, createdAt: -1 }

      const { animes, rotate } = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'featured', async (db) => {
        const animes = await db.collection('animes')
          .find(filter, {
            projection: {
              title: 1, thumbnail: 1, releaseYear: 1, subDubStatus: 1, contentType: 1,
              updatedAt: 1, createdAt: 1, bannerImage: 1, rating: 1, slug: 1, seoTitle: 1,
              likes: 1, dislikes: 1, monthlyLikes: 1, weeklyLikes: 1, currentEpisode: 1,
              genreList: 1, description: 1, status: 1
            }
          })
          .sort(sort)
          .limit(24)
          .toArray()
        const s = await db.collection('settings').findOne({ type: 'featuredAutoRotate' })
        return { animes, rotate: s?.sections?.[section] || null }
      })

      let data = animes
      if (!raw && rotate && (rotate.hourly || rotate.daily || rotate.perVisitor)) {
        const now = Date.now()
        const parts: string[] = [section]
        if (rotate.daily)      parts.push('d' + Math.floor((now + IST_OFFSET_MS) / 86400000))
        if (rotate.hourly)     parts.push('h' + Math.floor(now / 3600000))
        if (rotate.perVisitor) parts.push('v' + bucket)
        data = seededShuffle(animes, parts.join('|'))
      }
      return { success: true, data }
    }

    if (raw) return c.json(await build())
    return await withEdgeCache(c, 120, build)
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

    const response = await withEdgeCache(c, 60, async () => {
      const skip = (page - 1) * limit
      let filter: any = { isHidden: { $ne: true }, isBlocked: { $ne: true } }
      if (contentType && contentType !== 'all') filter.contentType = contentType

      let sortField = 'likes'
      if (type === 'monthly') sortField = 'monthlyLikes'
      else if (type === 'weekly') sortField = 'weeklyLikes'

      const { animes, total } = await withDb(
        c.env.MONGODB_URI, c.env.MONGODB_DB, 'top100', async (db) => {
          const col = db.collection('animes')

          const [animes, total] = await Promise.all([
            col.find(filter, {
              projection: { title: 1, thumbnail: 1, likes: 1, dislikes: 1, monthlyLikes: 1, weeklyLikes: 1, contentType: 1, slug: 1, rating: 1 }
            })
              .sort({ [sortField]: -1, title: 1 })
              .skip(skip)
              .limit(limit)
              .toArray(),
            col.countDocuments(filter)
          ])

          return { animes, total }
        }
      )

      return {
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
      }
    })

    return response
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SLUG ============
animeRoutes.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    if (!slug) return c.json({ success: false, error: 'Slug required' }, 400)

    await throttledViewIncrement(c, `slug-${slug}`, { slug })

    const response = await withEdgeCache(c, 300, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeSlug', async (db) => {
        const anime = await db.collection('animes').findOne({ slug }) as unknown as IAnime | null
        if (!anime || anime.isBlocked) throw { __notFound: true }

        const episodes = await db.collection('episodes')
          .find({ animeId: anime._id })
          .sort({ session: 1, episodeNumber: 1 })
          .toArray()

        return { success: true, data: { ...anime, episodes } }
      })
    )

    return response
  } catch (err: any) {
    if (err?.__notFound) return c.json({ success: false, message: 'Anime not found' }, 404)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SEARCH ============
// ✅ FIX: getDb hataya, ab withDb use hota hai
animeRoutes.get('/search', async (c) => {
  try {
    const q = c.req.query('query') || ''
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '24')
    const skip = (page - 1) * limit

    const filter: any = {
      isHidden: { $ne: true },
      isBlocked: { $ne: true },
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { seoKeywords: { $regex: q, $options: 'i' } },
        { seoTitle: { $regex: q, $options: 'i' } },
        { seoDescription: { $regex: q, $options: 'i' } }
      ]
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/search', async (db) => {
      const col = db.collection('animes')

      const [animes, total] = await Promise.all([
        col.find(filter).sort({ likes: -1, updatedAt: -1 }).skip(skip).limit(limit).toArray(),
        col.countDocuments(filter)
      ])

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
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UNASSIGNED ============
// ✅ FIX: getDb hataya
animeRoutes.get('/unassigned', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const search = c.req.query('search') || ''
    const filter: any = { partnerId: null }
    if (search.trim()) filter.title = { $regex: search.trim(), $options: 'i' }
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      filter.createdBy = admin.id
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/unassigned', async (db) => {
      const animes = await db.collection('animes')
        .find(filter, { projection: { title: 1, thumbnail: 1, status: 1, contentType: 1 } })
        .limit(20)
        .toArray()

      return c.json(animes)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ VOTE ============
// ✅ FIX: getDb hataya
animeRoutes.post('/:id/vote', async (c) => {
  try {
    const id = c.req.param('id')
    const { voteType } = await c.req.json()
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'

    if (!['like', 'dislike'].includes(voteType)) {
      return c.json({ success: false, error: 'Invalid vote type' }, 400)
    }
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/vote', async (db) => {
      const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
      if (!anime || anime.isBlocked) return c.json({ success: false, error: 'Anime not found' }, 404)

      const existingVote = anime.votes?.find((v: any) => v.ipAddress === ip)

      if (existingVote && existingVote.voteType === voteType) {
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

      const incData: any = {}
      if (existingVote) {
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

      const updated = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(id) },
        {
          $push: { votes: { ipAddress: ip, voteType, date: new Date() } } as any,
          $inc: incData
        },
        { returnDocument: 'after' }
      ) as unknown as IAnime

      return c.json({
        success: true,
        message: `Vote ${voteType}d successfully`,
        data: {
          likes: updated.likes, dislikes: updated.dislikes,
          totalVotes: updated.totalVotes, userVote: voteType, hasVoted: true,
          monthlyLikes: updated.monthlyLikes, weeklyLikes: updated.weeklyLikes
        }
      })
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

    const anime = await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'voteStatus', (db) =>
      db.collection('animes').findOne({ _id: toObjectId(id) })
    ) as IAnime | null

    if (!anime || anime.isBlocked) return c.json({ success: false, error: 'Anime not found' }, 404)

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

    const response = await withEdgeCache(c, 180, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'homepage', async (db) => {
        const skip = (page - 1) * limit
        const baseFilter = { isHidden: { $ne: true }, isBlocked: { $ne: true } }
        const col = db.collection('animes')

        const total = await getCachedJSON(c, 600, 'homepage-total-count', async () => {
          return col.countDocuments(baseFilter)
        })

        const animes = await col.find(baseFilter, {
          projection: { title: 1, thumbnail: 1, releaseYear: 1, subDubStatus: 1, contentType: 1, updatedAt: 1, createdAt: 1, slug: 1, likes: 1, dislikes: 1, rating: 1, monthlyLikes: 1, weeklyLikes: 1, totalVotes: 1, currentEpisode: 1, lastContentAdded: 1 }
        })
          .sort({ lastContentAdded: -1 })
          .skip(skip)
          .limit(limit)
          .toArray()

        return {
          success: true, data: animes,
          pagination: {
            current: page,
            totalPages: Math.ceil(total / limit),
            hasMore: page < Math.ceil(total / limit),
            totalItems: total
          }
        }
      })
    )

    return response
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ HIDE/UNHIDE ============
// ✅ FIX: getDb hataya
animeRoutes.patch('/:id/hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/hide', async (db) => {
      const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
      if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

      const newHidden = !anime.isHidden
      await db.collection('animes').updateOne(
        { _id: toObjectId(id) },
        { $set: { isHidden: newHidden, updatedAt: new Date() } }
      )
      await invalidateAnimeCache(c, id, (anime as any).slug)
      return c.json({ success: true, message: newHidden ? 'Anime hidden' : 'Anime visible', data: { isHidden: newHidden } })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ BLOCK/UNBLOCK ============
// ✅ FIX: getDb hataya
animeRoutes.patch('/:id/block', adminAuth, requirePermission('block-anime'), async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/block', async (db) => {
      const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
      if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

      const admin = c.get('admin')
      if (admin.role === 'subadmin' && admin.animeAccess === 'own' && anime.createdBy !== admin.id) {
        return c.json({ success: false, error: 'You can only manage anime you created.' }, 403)
      }

      const newBlocked = !anime.isBlocked
      await db.collection('animes').updateOne(
        { _id: toObjectId(id) },
        { $set: { isBlocked: newBlocked, updatedAt: new Date() } }
      )
      await invalidateAnimeCache(c, id, (anime as any).slug)
      return c.json({ success: true, message: `Anime ${newBlocked ? 'blocked' : 'unblocked'} successfully`, isBlocked: newBlocked })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED ADD ============
// ✅ FIX: getDb hataya
animeRoutes.post('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const section = c.req.query('section') || 'content'
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/featured/add', async (db) => {
      const currentCount = await db.collection('animes').countDocuments({ [cfg.flag]: true })
      if (currentCount >= 24) {
        return c.json({ success: false, error: `Section already has max 24 items` }, 400)
      }

      const anime = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { [cfg.flag]: true, [cfg.order]: currentCount + 1, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)
      return c.json({ success: true, message: 'Added to featured section', data: anime })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED REMOVE ============
// ✅ FIX: getDb hataya
animeRoutes.delete('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const section = c.req.query('section') || 'content'
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/featured/remove', async (db) => {
      const anime = await db.collection('animes').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { [cfg.flag]: false, [cfg.order]: 0, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)
      return c.json({ success: true, message: 'Removed from featured section', data: anime })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED REORDER ============
// ✅ FIX: getDb hataya (already bulkWrite use hota tha, baaki theek tha)
animeRoutes.put('/featured/order', adminAuth, async (c) => {
  try {
    const { order, section } = await c.req.json()
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    if (!Array.isArray(order) || order.length === 0) {
      return c.json({ success: true, message: 'Nothing to update' })
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/featured/order', async (db) => {
      const ops = order
        .filter((id: string) => isValidObjectId(id))
        .map((id: string, index: number) => ({
          updateOne: {
            filter: { _id: toObjectId(id) },
            update: { $set: { [cfg.order]: order.length - index, updatedAt: new Date() } }
          }
        }))

      if (ops.length > 0) {
        await db.collection('animes').bulkWrite(ops)
      }

      return c.json({ success: true, message: 'Order updated' })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SECTION VISIBILITY ============
// ✅ FIX: getDb hataya
animeRoutes.get('/settings/section-visibility', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/settings/section-visibility/get', async (db) => {
      const settings = await db.collection('settings').findOne({ type: 'sectionVisibility' })
      return c.json({ success: true, data: settings?.sections || {} })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

animeRoutes.put('/settings/section-visibility', adminAuth, async (c) => {
  try {
    const { section, hidden } = await c.req.json()
    if (!['banner', 'anime', 'manga', 'movie'].includes(section)) {
      return c.json({ success: false, error: 'Invalid section' }, 400)
    }
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/settings/section-visibility/put', async (db) => {
      await db.collection('settings').updateOne(
        { type: 'sectionVisibility' },
        { $set: { [`sections.${section}`]: hidden } },
        { upsert: true }
      )
      return c.json({ success: true, message: `Section ${section} ${hidden ? 'hidden' : 'shown'}` })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ AUTO-ROTATE SETTINGS ============
// ✅ FIX: getDb hataya
animeRoutes.get('/settings/auto-rotate', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/settings/auto-rotate/get', async (db) => {
      const s = await db.collection('settings').findOne({ type: 'featuredAutoRotate' })
      return c.json({ success: true, data: s?.sections || {} })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

animeRoutes.put('/settings/auto-rotate', adminAuth, async (c) => {
  try {
    const { section, hourly, daily, perVisitor } = await c.req.json()
    if (!ROTATE_SECTIONS.includes(section)) {
      return c.json({ success: false, error: 'Invalid section' }, 400)
    }
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/settings/auto-rotate/put', async (db) => {
      await db.collection('settings').updateOne(
        { type: 'featuredAutoRotate' },
        {
          $set: { [`sections.${section}`]: { hourly: !!hourly, daily: !!daily, perVisitor: !!perVisitor } },
          $setOnInsert: { key: 'featuredAutoRotate' },
        },
        { upsert: true }
      )
      return c.json({ success: true, message: 'Auto-rotate updated' })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET SINGLE ANIME ============
animeRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const isObjectId = isValidObjectId(id)

    await throttledViewIncrement(
      c,
      `id-${id}`,
      isObjectId ? { _id: toObjectId(id) } : { slug: id }
    )

    const response = await withEdgeCache(c, 300, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeSlug', async (db) => {
        const anime = await db.collection('animes').findOne(
          isObjectId ? { _id: toObjectId(id) } : { slug: id }
        ) as unknown as IAnime | null

        if (!anime || anime.isBlocked) {
          throw { __notFound: true }
        }

        const episodes = await db.collection('episodes')
          .find({ animeId: anime._id })
          .sort({ session: 1, episodeNumber: 1 })
          .toArray()

        return { success: true, data: { ...anime, episodes } }
      })
    )

    return response
  } catch (err: any) {
    if (err?.__notFound) return c.json({ success: false, message: 'Anime not found' }, 404)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE ANIME (admin) ============
// ✅ FIX: getDb hataya
animeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'anime/delete', async (db) => {
      const animeOid = toObjectId(id)

      const anime = await db.collection('animes').findOne({ _id: animeOid })
      if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

      const pages = await db.collection('downloadpages')
        .find({ animeId: animeOid }, { projection: { slug: 1 } })
        .toArray()

      await db.collection('animes').deleteOne({ _id: animeOid })
      await db.collection('downloadpages').deleteMany({ animeId: animeOid })
      await db.collection('episodes').deleteMany({ animeId: animeOid })

      await invalidateAnimeCache(c, id, (anime as any).slug)

      try {
        await invalidateEdgeCache(c, `/api/download-pages/anime/${id}`)
        await Promise.all(
          pages
            .filter((p: any) => p.slug)
            .map((p: any) => invalidateEdgeCache(c, `/api/download-pages/${p.slug}`))
        )
      } catch (err) {
        console.error('[delete anime] download-page cache invalidate failed:', err)
      }

      return c.json({ success: true, message: 'Anime and its download pages deleted successfully' })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeRoutes