import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import { getDb, toObjectId, isValidObjectId } from '../services/mongoService'
import { IAnime } from '../models/types'
// 🆕 CACHING — edge cache + background tasks ke liye
import { withEdgeCache, fireAndForget } from '../utils/cache'

const animeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============================================================================
// ✅ CONNECTION-CONSOLIDATION FIX
// Pehle: findMany/findOne/updateOne/countDocuments helpers har call pe apna
// alag MongoClient connect+close karte the. Isliye jis route me 2-3 alag
// operations the (jaise anime detail = findOne + updateOne(views) + findMany
// episodes), wahan 2-3 alag MongoDB connections ban rahe the — ek single page
// load ke liye.
//
// Fix: har route ab `getDb()` SIRF EK BAAR call karta hai, aur uske baad
// `db.collection(...)` seedha use karke saare operations usi ek connection
// pe chalata hai. Views/likes/dislikes bhi ab read-then-write ki jagah
// atomic `$inc` se update hote hain (concurrent traffic me lost updates
// nahi honge).
// ============================================================================

// ============ SECTION FIELD MAPPING ============
const SECTION_FIELDS: Record<string, { flag: string; order: string }> = {
  content: { flag: 'featured', order: 'featuredOrder' },
  banner: { flag: 'featuredBannerSection', order: 'featuredBannerOrder' },
  anime: { flag: 'featuredAnimeSection', order: 'featuredAnimeOrder' },
  manga: { flag: 'featuredMangaSection', order: 'featuredMangaOrder' },
  movie: { flag: 'featuredMovieSection', order: 'featuredMovieOrder' },
}

// ============ FEATURED (section-aware) — NOW CACHED (60s) ============
animeRoutes.get('/featured', async (c) => {
  try {
    const section = c.req.query('section') || 'content'

    const response = await withEdgeCache(c, 60, async () => {
      const cfg = SECTION_FIELDS[section] || SECTION_FIELDS.content
      const filter: any = { [cfg.flag]: true, isHidden: { $ne: true }, isBlocked: { $ne: true } }
      const sort: any = { [cfg.order]: -1, createdAt: -1 }

      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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

      return { success: true, data: animes }
    })

    return response
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

      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
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
// ============ SLUG — NOW CACHED (20s), views decoupled from cache ============
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

    // View-increment हमेशा background me chalta hai, cache hit ho ya miss
    fireAndForget(
      c,
      (async () => {
        const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
        await db.collection('animes').updateOne({ slug }, { $inc: { views: 1 } })
      })()
    )

    const response = await withEdgeCache(c, 20, async () => {
      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
      const anime = await db.collection('animes').findOne({ slug }) as unknown as IAnime | null

      if (!anime || anime.isBlocked) {
        // 404 ko cache nahi karna — throw karke handler ke bahar nikal jao
        throw { __notFound: true }
      }

      const episodes = await db.collection('episodes')
        .find({ animeId: anime._id })
        .sort({ session: 1, episodeNumber: 1 })
        .toArray()

      return { success: true, data: { ...anime, episodes } }
    })

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

// ============ VOTE STATUS — 1 connection ============
animeRoutes.get('/:id/vote-status', async (c) => {
  try {
    const id = c.req.param('id')
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ _id: toObjectId(id) }) as IAnime | null
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

// ============ HOMEPAGE LIST — NOW CACHED (30s) ============
animeRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '24')

    const response = await withEdgeCache(c, 30, async () => {
      const skip = (page - 1) * limit
      const baseFilter = { isHidden: { $ne: true }, isBlocked: { $ne: true } }

      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
      const col = db.collection('animes')

      const [animes, total] = await Promise.all([
        col.find(baseFilter, {
          projection: { title: 1, thumbnail: 1, releaseYear: 1, subDubStatus: 1, contentType: 1, updatedAt: 1, createdAt: 1, slug: 1, likes: 1, dislikes: 1, rating: 1, monthlyLikes: 1, weeklyLikes: 1, totalVotes: 1, currentEpisode: 1, lastContentAdded: 1 }
        })
          .sort({ lastContentAdded: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        col.countDocuments(baseFilter)
      ])

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

// ============ GET SINGLE ANIME — 3 calls combined into 1 connection ============
animeRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const isObjectId = isValidObjectId(id)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOneAndUpdate(
      isObjectId ? { _id: toObjectId(id) } : { slug: id },
      { $inc: { views: 1 } },
      { returnDocument: 'after' }
    ) as unknown as IAnime | null

    if (!anime || anime.isBlocked) return c.json({ success: false, message: 'Anime not found' }, 404)

    const episodes = await db.collection('episodes')
      .find({ animeId: anime._id })
      .sort({ session: 1, episodeNumber: 1 })
      .toArray()

    return c.json({ success: true, data: { ...anime, episodes } })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE ANIME (admin) — 3 calls combined into 1 connection ============
animeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const anime = await db.collection('animes').findOne({ _id: toObjectId(id) })
    if (!anime) return c.json({ success: false, error: 'Anime not found' }, 404)

    await db.collection('animes').deleteOne({ _id: toObjectId(id) })
    await db.collection('downloadpages').deleteMany({ animeId: toObjectId(id) })

    return c.json({ success: true, message: 'Anime deleted successfully' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeRoutes