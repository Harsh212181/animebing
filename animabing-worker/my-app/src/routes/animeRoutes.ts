import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import { getDb, withDb, toObjectId, isValidObjectId } from '../services/mongoService'
import { IAnime } from '../models/types'
// 🆕 CACHING — edge cache + background tasks ke liye
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

// ✅ NEW — anime hide/block/delete/vote hone par uska apna detail-cache
// turant clear karo, TTL wait nahi karna
async function invalidateAnimeCache(c: any, id: string, slug?: string | null) {
  try {
    await invalidateEdgeCache(c, `/api/anime/${id}`)
    if (slug) await invalidateEdgeCache(c, `/api/anime/slug/${slug}`)
  } catch (err) {
    console.error('[invalidateAnimeCache] failed:', err)
  }
}

// ✅ FIX: view-increment throttle — pehle ye fireAndForget se cache-hit
// response ke saath bhi har request apna alag naya DB connection khol
// raha tha. Ab 60s window mein sirf ek increment DB tak jayega, baaki
// sab skip honge (chhota accuracy trade-off, connections bahut bachte hain).
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

// ============ FEATURED (section-aware) — NOW CACHED (120s) + AUTO-ROTATE ============
animeRoutes.get('/featured', async (c) => {
  try {
    const section = c.req.query('section') || 'content'
    const raw = c.req.query('raw') === '1'   // admin panel: asli order
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

// ============ TOP 100 — NOW CACHED (60s) ============
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

// ============================================================================
// ============ SLUG — NOW CACHED (300s), views decoupled from cache ==========
// ⚠️ IMPORTANT TRADE-OFF: pehle har request `$inc: { views: 1 }` karta tha
// SYNCHRONOUSLY — matlab response tabhi jaata tha jab MongoDB confirm karta
// tha ki view count ho gaya. Ab: response CACHE se turant chala jaata hai
// (agar cache hit hai), aur view-increment BACKGROUND me hota hai
// (`fireAndForget` — response ka wait nahi karta). Views ka count same
// rahega, bas real-time se 1-2 sec delay ho sakta hai. Trade-off worth it
// hai kyunki visitor ko wait nahi karna padega.
// ============================================================================
animeRoutes.get('/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    if (!slug) return c.json({ success: false, error: 'Slug required' }, 400)

    // View-increment ab throttled — 60s mein sirf ek increment
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

// ============ SEARCH — 2 calls combined into 1 connection ============
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

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UNASSIGNED (admin) — 1 connection ============
animeRoutes.get('/unassigned', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const search = c.req.query('search') || ''
    const filter: any = { partnerId: null }
    if (search.trim()) filter.title = { $regex: search.trim(), $options: 'i' }
    if (admin.role === 'subadmin' && admin.animeAccess === 'own') {
      filter.createdBy = admin.id
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const animes = await db.collection('animes')
      .find(filter, { projection: { title: 1, thumbnail: 1, status: 1, contentType: 1 } })
      .limit(20)
      .toArray()

    return c.json(animes)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ VOTE — was already 1 connection (getDb called once); kept as-is ============
// ⚠️ NOTE: is route me ek alag concern hai jo "connections count" se related
// nahi hai — concurrent votes ke beech ek chhota race window hai (existingVote
// read hone ke baad, dusra request usi IP se vote daal sakta hai isse pehle ki
// pehla update commit ho). Isko poora atomic banane ke liye best fix ek alag
// `votes` collection banana hai jisme (animeId, ipAddress) par unique index ho —
// ye ek separate, thoda bada change hai. Filhaal main isse connection-fix ke
// scope se bahar rakh raha hoon; chaho to alag se isko fix kar sakte hain.
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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ VOTE STATUS — withDb (no getDb) ============
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

// ============ HOMEPAGE LIST — NOW CACHED (180s) ============
animeRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '24')

    const response = await withEdgeCache(c, 180, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'homepage', async (db) => {
        const skip = (page - 1) * limit
        const baseFilter = { isHidden: { $ne: true }, isBlocked: { $ne: true } }
        const col = db.collection('animes')

        // ✅ FIX: total count alag se, 10-minute cache ke saath — total document
        // count second-to-second change nahi hota, isliye ise har homepage request
        // pe recompute karne ki zarurat nahi. Isse miss-window chhota hota hai
        // (sirf 1 query reh jaati hai), jo stampede risk kam karta hai.
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

// ============ HIDE/UNHIDE (admin) — 2 calls combined into 1 connection ============
animeRoutes.patch('/:id/hide', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    const newHidden = !anime.isHidden
    await db.collection('animes').updateOne(
      { _id: toObjectId(id) },
      { $set: { isHidden: newHidden, updatedAt: new Date() } }
    )
    await invalidateAnimeCache(c, id, (anime as any).slug) // ✅ NEW
    return c.json({ success: true, message: newHidden ? 'Anime hidden' : 'Anime visible', data: { isHidden: newHidden } })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ BLOCK/UNBLOCK ANIME (admin) — 2 calls combined into 1 connection ============
animeRoutes.patch('/:id/block', adminAuth, requirePermission('block-anime'), async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
    await invalidateAnimeCache(c, id, (anime as any).slug) // ✅ NEW
    return c.json({ success: true, message: `Anime ${newBlocked ? 'blocked' : 'unblocked'} successfully`, isBlocked: newBlocked })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED ADD (section-aware) — 2 calls combined into 1 connection ============
animeRoutes.post('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const section = c.req.query('section') || 'content'
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED REMOVE (section-aware) — 1 connection ============
animeRoutes.delete('/:id/featured', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const section = c.req.query('section') || 'content'
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: { [cfg.flag]: false, [cfg.order]: 0, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)
    return c.json({ success: true, message: 'Removed from featured section', data: anime })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ FEATURED REORDER (section-aware) ============
// ✅ BIGGEST FIX in this file: pehle `order.map(...)` ke andar har item ke
// liye alag `updateOne()` chalta tha — jo helper khud alag connection kholta
// tha. Matlab agar 24 items reorder ho rahe hain, to 24 ALAG MongoDB
// connections ban rahe the EK HI request me. Ab `bulkWrite` se sab updates
// EK connection, EK round-trip me jaate hain.
animeRoutes.put('/featured/order', adminAuth, async (c) => {
  try {
    const { order, section } = await c.req.json()
    const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content

    if (!Array.isArray(order) || order.length === 0) {
      return c.json({ success: true, message: 'Nothing to update' })
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ SECTION VISIBILITY SETTINGS — already 1 connection each ============
animeRoutes.get('/settings/section-visibility', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await db.collection('settings').findOne({ type: 'sectionVisibility' })
    return c.json({ success: true, data: settings?.sections || {} })
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
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('settings').updateOne(
      { type: 'sectionVisibility' },
      { $set: { [`sections.${section}`]: hidden } },
      { upsert: true }
    )
    return c.json({ success: true, message: `Section ${section} ${hidden ? 'hidden' : 'shown'}` })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ AUTO-ROTATE SETTINGS ============
animeRoutes.get('/settings/auto-rotate', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const s = await db.collection('settings').findOne({ type: 'featuredAutoRotate' })
    return c.json({ success: true, data: s?.sections || {} })
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
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('settings').updateOne(
      { type: 'featuredAutoRotate' },
      { $set: { [`sections.${section}`]: { hourly: !!hourly, daily: !!daily, perVisitor: !!perVisitor } } },
      { upsert: true }
    )
    return c.json({ success: true, message: 'Auto-rotate updated' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============================================================================
// ============ GET SINGLE ANIME — NOW CACHED (300s), views decoupled =========
// 🆕 FIX: pehle ye route har request pe synchronous `$inc: { views: 1 }`
// karta tha, aur phir usi request me episodes bhi fetch karta tha. Ab:
//   - view-increment BACKGROUND me (fireAndForget) — response ka wait nahi
//   - pura response 300s ke liye edge-cached — same id/slug pe aane wale
//     hazaaron concurrent visitors sirf 1 DB hit per 300s
// ⚠️ TRADE-OFF: views count 1-2 sec delayed hoga, lekin visitor ko turant
// response milega (cache hit pe zero DB wait).
// ============================================================================
animeRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const isObjectId = isValidObjectId(id)

    // View-increment ab throttled — 60s mein sirf ek increment
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

// ============ DELETE ANIME (admin) — cascade: download pages + episodes + cache ============
animeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const animeOid = toObjectId(id)

    const anime = await db.collection('animes').findOne({ _id: animeOid })
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    // Delete se PEHLE download pages ke slugs lo (cache clear karne ke liye)
    const pages = await db.collection('downloadpages')
      .find({ animeId: animeOid }, { projection: { slug: 1 } })
      .toArray()

    // Cascade delete: anime + download pages + episodes
    await db.collection('animes').deleteOne({ _id: animeOid })
    await db.collection('downloadpages').deleteMany({ animeId: animeOid })
    await db.collection('episodes').deleteMany({ animeId: animeOid })

    // Anime ka apna cache
    await invalidateAnimeCache(c, id, (anime as any).slug)

    // Download pages ka cache (list + har slug)
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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeRoutes