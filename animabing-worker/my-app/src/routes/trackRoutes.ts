// ============================================================
// animabing-worker/my-app/src/routes/trackRoutes.ts
// ============================================================

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne, deleteOne, countDocuments, toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { ITrackedChannel, ITrackNotification } from '../models/types'
import {
  processChannelUpdates, fetchChannelInfoByHandle, fetchRecentVideos, fetchVideoDurations,
  fetchVideosByIds, fetchPlaylistChunk, matchAndParseVideos, parseEpisodeOverride, notifyOnce,
  processInBatches, type ParsedVideoItem
} from '../services/youtubeCheckService'
import { logActivity } from '../services/activityLogService'
import { syncPageDerivedData } from '../services/episodeSyncService'

const trackRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const AUTO_PAUSE_ERROR_THRESHOLD = 5

const MAX_SCAN_DEPTH = 10000
const clampDepth = (d: any, fallback = 1500) =>
  Math.min(MAX_SCAN_DEPTH, typeof d === 'number' && d > 0 ? Math.floor(d) : fallback)

const PAGES_PER_CHUNK = 20            // free plan safe. Paid plan par 100 tak kar sakte ho
const SINGLE_REQUEST_MAX_DEPTH = 2000 // jo routes ek hi request mein scan karte hain unki limit

trackRoutes.use('*', adminAuth)
trackRoutes.use('*', requirePermission('tracklist'))

// ============ HELPER: owned+assigned anime IDs for sub-admin (animeAccess:'own') ============
async function getAllowedAnimeIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  const createdIds = animes.map((a: any) => a._id.toString())

  const subAdminDoc = await db.collection('subadmins').findOne({ _id: toObjectId(admin.id) })
  const assignedIds: string[] = subAdminDoc?.assignedAnimeIds || []

  return Array.from(new Set([...createdIds, ...assignedIds]))
}

// ============ HELPER: kya ye admin is specific TITLE ko manage kar sakta hai ============
function canManageTitle(admin: any, title: any, allowedAnimeIds: string[] | null): boolean {
  if (admin.role !== 'subadmin') return true
  if (allowedAnimeIds === null) return true // animeAccess:'all'
  if (title.createdBy === admin.id) return true
  if (title.linkedAnimeId && allowedAnimeIds.includes(title.linkedAnimeId)) return true
  return false
}

// ============ HELPER: kya ye admin is CHANNEL ko dekh/manage kar sakta hai ============
function canSeeChannel(admin: any, ch: any, allowedAnimeIds: string[] | null): boolean {
  if (admin.role !== 'subadmin') return true
  if (ch.createdBy === admin.id) return true
  if ((ch.visibleTo || []).includes(admin.id)) return true
  const allowedSet = new Set(allowedAnimeIds || [])
  return (ch.titles || []).some((t: any) =>
    t.createdBy === admin.id || (t.linkedAnimeId && allowedSet.has(t.linkedAnimeId))
  )
}

// ============ HELPER: channelIds visible to sub-admin (YouTube channelId, not _id) ============
async function getVisibleChannelIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin.role !== 'subadmin') return null
  const allowedAnimeIds = await getAllowedAnimeIds(admin, mongoUri, dbName)
  const allChannels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, mongoUri, dbName)
  return allChannels.filter(ch => canSeeChannel(admin, ch, allowedAnimeIds)).map(ch => ch.channelId)
}

// ============ HELPER: is admin ko visible titleKeywords per channel ============
async function getVisibleTitleKeywords(admin: any, mongoUri: string, dbName: string): Promise<{ channelId: string; keyword: string }[] | null> {
  const allowedAnimeIds = await getAllowedAnimeIds(admin, mongoUri, dbName)
  if (allowedAnimeIds === null) return null
  const allowedSet = new Set(allowedAnimeIds)
  const allChannels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, mongoUri, dbName)
  const pairs: { channelId: string; keyword: string }[] = []
  for (const ch of allChannels) {
    for (const t of ch.titles || []) {
      if (t.createdBy === admin.id || (t.linkedAnimeId && allowedSet.has(t.linkedAnimeId))) {
        pairs.push({ channelId: ch.channelId, keyword: t.keyword })
      }
    }
  }
  return pairs
}

// ============ CHANNEL ADD ============
trackRoutes.post('/channel/add', async (c) => {
  const admin = c.get('admin')
  const { handle } = await c.req.json()
  if (!handle) return c.json({ success: false, error: 'Handle is required' }, 400)

  const info = await fetchChannelInfoByHandle(handle, c.env.YOUTUBE_API_KEY)
  if (!info) return c.json({ success: false, error: 'Channel not found, check the handle' }, 404)

  const existing = await findOne<ITrackedChannel>(
    'trackedChannels', { channelId: info.channelId }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  // Agar channel pehle se track ho raha hai, error mat do —
  // existing channel hi return kar do taaki dusra sub-admin usi par
  // apna naya title add kar sake (1 channel, multiple sub-admins ke titles)
  if (existing) {
    if (admin?.role === 'subadmin' && existing.createdBy !== admin.id
        && !(existing.visibleTo || []).includes(admin.id)) {
      await updateOne('trackedChannels', { _id: existing._id! },
        { visibleTo: [...(existing.visibleTo || []), admin.id] },
        c.env.MONGODB_URI, c.env.MONGODB_DB)
    }
    return c.json({
      success: true,
      alreadyTracked: true,
      channelName: existing.channelName,
      id: existing._id,
    })
  }

  const result = await insertOne('trackedChannels', {
    channelId: info.channelId,
    channelName: info.channelName,
    channelHandle: handle,
    channelThumbnail: info.channelThumbnail,
    uploadsPlaylistId: info.uploadsPlaylistId,
    titles: [],
    consecutiveErrors: 0,
    createdBy: admin?.id,
    createdByUsername: admin?.username,
    visibleTo: admin?.role === 'subadmin' ? [admin.id] : [],
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'YouTube channel added for tracking',
    targetType: 'trackedChannel',
    targetId: result.insertedId.toString(),
    targetTitle: info.channelName,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, channelName: info.channelName, id: result.insertedId })
})

// ============ CHANNEL INFO REFRESH ============
trackRoutes.post('/channel/:channelId/refresh-info', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canSeeChannel(admin, channel, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this channel.' }, 403)
  }

  const info = await fetchChannelInfoByHandle(channel.channelHandle, c.env.YOUTUBE_API_KEY)
  if (!info) return c.json({ success: false, error: 'Could not fetch info from YouTube' }, 404)

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) },
    { channelName: info.channelName, channelThumbnail: info.channelThumbnail },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, channelThumbnail: info.channelThumbnail })
})

// ============ CHANNELS LIST ============
trackRoutes.get('/channels', async (c) => {
  const admin = c.get('admin')
  const allChannels = await findMany<ITrackedChannel>(
    'trackedChannels', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (admin.role !== 'subadmin') return c.json(allChannels)

  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const allowedSet = new Set(allowedAnimeIds || [])

  const result = allChannels
    .filter(ch => canSeeChannel(admin, ch, allowedAnimeIds))
    .map(ch => ({
      ...ch,
      titles: (ch.titles || []).filter((t: any) =>
        t.createdBy === admin.id || (t.linkedAnimeId && allowedSet.has(t.linkedAnimeId))
      ),
    }))
  return c.json(result)
})

// ============ CHANNEL PAUSE/RESUME ============
trackRoutes.post('/channel/:channelId/toggle-pause', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const admin = c.get('admin')

  // Pause channel-wide hai (ek sub-admin pause kare to dusre ke titles bhi ruk jaayenge),
  // isliye sirf super admin allow hai.
  if (admin.role === 'subadmin') {
    return c.json({ success: false, error: 'Only super admin can pause a shared channel' }, 403)
  }

  const nowPaused = !channel.paused
  const updateData: any = { paused: nowPaused }
  if (!nowPaused) updateData.consecutiveErrors = 0

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, updateData,
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, paused: nowPaused })
})

// ============ CHANNEL REMOVE ============
trackRoutes.delete('/channel/:channelId', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

  if (!canSeeChannel(admin, channel, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this channel.' }, 403)
  }

  // ---------- SUB-ADMIN: sirf apna hissa hatao ----------
  if (admin.role === 'subadmin') {
    const myTitles = (channel.titles || []).filter((t: any) => t.createdBy === admin.id)
    const remainingTitles = (channel.titles || []).filter((t: any) => t.createdBy !== admin.id)

    // Is sub-admin ki notifications hatao (sirf apne titles ke liye)
    for (const t of myTitles) {
      const notifs = await findMany<ITrackNotification>(
        'trackNotifications',
        { channelId: channel.channelId, titleKeyword: t.keyword },
        {}, c.env.MONGODB_URI, c.env.MONGODB_DB
      )
      for (const n of notifs) {
        await deleteOne('trackNotifications', { _id: n._id! }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      }
    }

    const remainingVisible = (channel.visibleTo || []).filter(id => id !== admin.id)

    if (remainingTitles.length === 0 && remainingVisible.length === 0 &&
        (channel.createdBy === admin.id || !channel.createdBy)) {
      await deleteOne('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    } else {
      await updateOne('trackedChannels', { _id: toObjectId(channelId) }, {
        titles: remainingTitles,
        visibleTo: remainingVisible,
        ...(channel.createdBy === admin.id ? { createdBy: null } : {}),
      }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    await logActivity({
      actorId: admin.id, actorUsername: admin.username, actorRole: 'subadmin',
      action: 'Tracked channel removed from own list',
      targetType: 'trackedChannel', targetId: channelId, targetTitle: channel.channelName,
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true })
  }

  // ---------- SUPER ADMIN: poora delete ----------
  await deleteOne('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const relatedNotifs = await findMany<ITrackNotification>(
    'trackNotifications', { channelId: channel.channelId }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  for (const n of relatedNotifs) {
    await deleteOne('trackNotifications', { _id: n._id! }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }

  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'Tracked channel removed',
    targetType: 'trackedChannel',
    targetId: channelId,
    targetTitle: channel?.channelName,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true })
})

// ============ Channel-level Strict Chronology defaults ============
trackRoutes.put('/channel/:channelId/chronology-defaults', async (c) => {
  const channelId = c.req.param('channelId')
  const { defaultStrictChronology, defaultChronologyGraceGap } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) },
    {
      defaultStrictChronology: !!defaultStrictChronology,
      defaultChronologyGraceGap: Number(defaultChronologyGraceGap) || 0,
    },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ TEST MATCH PREVIEW ============
trackRoutes.post('/channel/:channelId/title/test-match', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  const { keyword, matchThreshold, excludeKeywords, scanDepth } = await c.req.json()
  if (!keyword || !String(keyword).trim()) return c.json({ success: false, error: 'Keyword is required' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const depth = Math.min(SINGLE_REQUEST_MAX_DEPTH, clampDepth(scanDepth))
  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY, depth)
  const matched = matchAndParseVideos(recentVideos, String(keyword).trim(), [], {
    threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
    excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
  })

  const durations = await fetchVideoDurations(matched.map(m => m.video.videoId), c.env.YOUTUBE_API_KEY)

  return c.json({
    success: true,
    matchedCount: matched.length,
    scannedCount: recentVideos.length,
    videos: matched.map(v => ({
      videoId: v.video.videoId,
      videoTitle: v.video.title,
      description: v.video.description,
      thumbnail: v.video.thumbnail,
      publishedAt: v.video.publishedAt,
      part: v.part,
      isRange: v.isRange,
      rangeStart: v.rangeStart,
      matchedFormat: v.matchedFormat,
      matchScore: v.matchScore,
      fromDescription: v.fromDescription,
      durationSec: durations[v.video.videoId] ?? null,
    })),
  })
})

// ============ TEST MATCH — CHUNKED (5k/10k+ ke liye) ============
trackRoutes.post('/channel/:channelId/title/test-match-chunk', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  const { keyword, matchThreshold, excludeKeywords, pageToken, pages } = await c.req.json()
  if (!keyword || !String(keyword).trim()) return c.json({ success: false, error: 'Keyword is required' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canSeeChannel(admin, channel, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this channel.' }, 403)
  }

  const maxPages = Math.min(PAGES_PER_CHUNK, Math.max(1, Math.floor(Number(pages)) || PAGES_PER_CHUNK))
  const { videos, nextPageToken } = await fetchPlaylistChunk(
    channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY,
    { pageToken: pageToken || undefined, maxPages }
  )

  const matched = matchAndParseVideos(videos, String(keyword).trim(), [], {
    threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
    excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
  })
  const durations = await fetchVideoDurations(matched.map(m => m.video.videoId), c.env.YOUTUBE_API_KEY)

  return c.json({
    success: true,
    scannedCount: videos.length,
    matchedCount: matched.length,
    nextPageToken: nextPageToken || null,
    videos: matched.map(v => ({
      videoId: v.video.videoId,
      videoTitle: v.video.title,
      description: v.video.description,
      thumbnail: v.video.thumbnail,
      publishedAt: v.video.publishedAt,
      part: v.part,
      isRange: v.isRange,
      rangeStart: v.rangeStart,
      matchedFormat: v.matchedFormat,
      matchScore: v.matchScore,
      fromDescription: v.fromDescription,
      durationSec: durations[v.video.videoId] ?? null,
    })),
  })
})

// ============ QUICK BULK ADD FROM PREVIEW ============
trackRoutes.post('/channel/:channelId/quick-bulk-add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keyword, matchThreshold, excludeKeywords, downloadPageId, videoIds, episodeOverrides, scanDepth } = await c.req.json() as {
    keyword: string; matchThreshold?: number; excludeKeywords?: string[];
    downloadPageId: string; videoIds: string[]; episodeOverrides?: Record<string, string | number>;
    scanDepth?: number
  }
  if (!isValidObjectId(channelId) || !isValidObjectId(downloadPageId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  if (!keyword || !String(keyword).trim()) return c.json({ success: false, error: 'Keyword is required' }, 400)
  if (!Array.isArray(videoIds) || videoIds.length === 0) return c.json({ success: false, error: 'Select videos' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const page = await findOne<any>('downloadpages', { _id: toObjectId(downloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404)

  const kw = String(keyword).trim()
  const hasOverride = (id: string) => episodeOverrides?.[id] !== undefined
  let selected: ParsedVideoItem[] = []
  let durations: Record<string, number> = {}
  let method: 'direct' | 'scan' = 'direct'

  // ---------- METHOD 1: videoIds seedha fetch (subrequest limit safe) ----------
  try {
    const direct = await fetchVideosByIds(videoIds, c.env.YOUTUBE_API_KEY)
    durations = direct.durations
    // threshold 0: user ne ye videos khud select kiye hain, dobara fuzzy filter nahi lagana
    const parsed = matchAndParseVideos(direct.items, kw, [], { threshold: 0 })
    selected = parsed.filter(v => v.part !== null || hasOverride(v.video.videoId))
  } catch (err) {
    console.error('quick-bulk-add direct fetch failed', err)
  }

  // ---------- METHOD 2 (fallback): preview wali depth tak scan ----------
  if (selected.length === 0) {
    method = 'scan'
    const depth = Math.min(SINGLE_REQUEST_MAX_DEPTH, clampDepth(scanDepth))
    const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY, depth)
    const matched = matchAndParseVideos(recentVideos, kw, [], {
      threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
      excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
    })
    selected = matched.filter(v =>
      videoIds.includes(v.video.videoId) && (v.part !== null || hasOverride(v.video.videoId))
    )
    if (selected.length > 0) {
      durations = await fetchVideoDurations(selected.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)
    }
  }

  if (selected.length === 0) return c.json({ success: false, error: 'No valid videos found' }, 400)

  const existingLinks = page.links || []
  const existingUrls = new Set(existingLinks.map((l: any) => l.url))
  const newLinks = selected
    .filter(v => !existingUrls.has(`https://youtube.com/watch?v=${v.video.videoId}`))
    .map(v => {
      const override = hasOverride(v.video.videoId)
        ? parseEpisodeOverride(episodeOverrides![v.video.videoId])
        : null
      return {
        episode: override ? override.episode : (v.part as number),
        episodeStart: override ? override.episodeStart : (v.isRange ? v.rangeStart : undefined),
        url: `https://youtube.com/watch?v=${v.video.videoId}`,
        type: 'watch',
        quality: '',
        language: '',
        durationSec: durations[v.video.videoId] ?? undefined,
      }
    })

  if (newLinks.length === 0) return c.json({ success: false, error: 'All selected videos already exist on the page' }, 400)

  await updateOne('downloadpages', { _id: page._id }, { links: [...existingLinks, ...newLinks] }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncPageDerivedData(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)

  const admin = c.get('admin')
  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: `Quick bulk-added ${newLinks.length} episodes from preview`,
    targetType: 'downloadpage',
    targetId: downloadPageId,
    targetTitle: page.slug,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, added: newLinks.length, method })
})

// ============ TITLE ADD ============
trackRoutes.post('/channel/:channelId/title/add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keyword, currentKnownPart, matchThreshold, excludeKeywords, autoInit } = await c.req.json()
  if (!keyword) return c.json({ success: false, error: 'Keyword is required' }, 400)
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP stamp ke liye admin fetch
  const admin = c.get('admin')

  const keywordLower = keyword.trim().toLowerCase()
  const alreadyExists = (channel.titles || []).some(t => t.keyword.trim().toLowerCase() === keywordLower)
  if (alreadyExists) {
    return c.json({
      success: false,
      error: `"${keyword}" is already being tracked on this channel (by you or another admin)`,
    }, 400)
  }

  let lastKnownPart = Number(currentKnownPart) || 0
  let initialized = false
  let lastKnownVideoId: string | undefined
  let lastKnownVideoTitle: string | undefined
  let lastKnownThumbnail: string | undefined
  let lastKnownPublishedAt: string | undefined
  let lastKnownIsRange: boolean | undefined

  if (autoInit) {
    const matchOpts = {
      threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
      excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
    }
    // pehle 100 videos, kuch na mile to ek baar 500 tak (max ~20 API calls)
    for (const depth of [100, 500]) {
      const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY, depth)
      const matched = matchAndParseVideos(recentVideos, keyword.trim(), [], matchOpts)
      const withPart = matched.filter(v => v.part !== null).sort((a, b) => a.part! - b.part!)
      if (withPart.length > 0) {
        const latest = withPart[withPart.length - 1]
        lastKnownPart = latest.part!
        lastKnownVideoId = latest.video.videoId
        lastKnownVideoTitle = latest.video.title
        lastKnownThumbnail = latest.video.thumbnail
        lastKnownPublishedAt = latest.video.publishedAt
        lastKnownIsRange = latest.isRange
        initialized = true
        break
      }
    }
  }

  const newTitleObj: any = {
    id: crypto.randomUUID(),
    keyword,
    // OWNERSHIP stamp
    createdBy: admin?.id,
    createdByUsername: admin?.username,
    lastKnownPart,
    lastKnownVideoId,
    lastKnownVideoTitle,
    lastKnownThumbnail,
    lastKnownPublishedAt,
    lastKnownIsRange,
    initialized,
    matchThreshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
    excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords.filter(Boolean) : undefined,
    strictChronology: channel.defaultStrictChronology === true,
    chronologyGraceGap: channel.defaultChronologyGraceGap || 0,
  }

  const newTitles = [newTitleObj, ...(channel.titles || [])]

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ BULK TITLE ADD ============
trackRoutes.post('/channel/:channelId/title/bulk-add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keywords } = await c.req.json()
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return c.json({ success: false, error: 'Keywords list is required' }, 400)
  }
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // ownership stamp ke liye
  const admin = c.get('admin')

  const existingLower = new Set((channel.titles || []).map(t => t.keyword.trim().toLowerCase()))
  const toAdd: any[] = []
  const skipped: string[] = []

  for (const raw of keywords) {
    const keyword = String(raw).trim()
    if (!keyword) continue
    const lower = keyword.toLowerCase()
    if (existingLower.has(lower)) { skipped.push(keyword); continue }
    existingLower.add(lower)
    toAdd.push({
      id: crypto.randomUUID(),
      keyword,
      lastKnownPart: 0,
      // OWNERSHIP stamp
      createdBy: admin?.id,
      createdByUsername: admin?.username,
    })
  }

  const newTitles = [...toAdd, ...(channel.titles || [])]
  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, added: toAdd.length, skipped })
})

// ============ TITLE EDIT ============
trackRoutes.put('/channel/:channelId/title/:titleId/edit', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { keyword, lastKnownPart, matchThreshold, excludeKeywords } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK — sirf apna title edit kar sake
  const targetTitle = (channel.titles || []).find(t => t.id === titleId)
  if (!targetTitle) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, targetTitle, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId
      ? {
          ...t,
          keyword: keyword !== undefined ? keyword : t.keyword,
          lastKnownPart: lastKnownPart !== undefined ? Number(lastKnownPart) : t.lastKnownPart,
          matchThreshold: matchThreshold !== undefined ? Number(matchThreshold) : t.matchThreshold,
          excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords.filter(Boolean) : t.excludeKeywords,
        }
      : t
  )

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ dedicated settings route ============
trackRoutes.put('/channel/:channelId/title/:titleId/settings', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { matchThreshold, excludeKeywords } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const targetTitle = (channel.titles || []).find(t => t.id === titleId)
  if (!targetTitle) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, targetTitle, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId
      ? {
          ...t,
          matchThreshold: matchThreshold !== undefined ? Number(matchThreshold) : t.matchThreshold,
          excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords.filter(Boolean) : t.excludeKeywords,
        }
      : t
  )

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ TITLE REMOVE ============
trackRoutes.delete('/channel/:channelId/title/:titleId', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const titleToRemove = (channel.titles || []).find(t => t.id === titleId)
  if (!titleToRemove) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, titleToRemove, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const newTitles = (channel.titles || []).filter(t => t.id !== titleId)

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  const relatedNotifs = await findMany<ITrackNotification>(
    'trackNotifications',
    { channelId: channel.channelId, titleKeyword: titleToRemove.keyword },
    {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  for (const n of relatedNotifs) {
    await deleteOne('trackNotifications', { _id: n._id! }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }

  return c.json({ success: true })
})

// ============ CAPACITY METER ============
trackRoutes.get('/capacity', async (c) => {
  const admin = c.get('admin')
  const visibleChannelIds = await getVisibleChannelIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const channelsUsed = visibleChannelIds === null
    ? await countDocuments('trackedChannels', {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    : visibleChannelIds.length

  return c.json({
    channelsUsed,
    channelsLimit: 5000,
    unitsUsedPerCheck: channelsUsed * 2,
    unitsLimit: 10000,
  })
})

// ============ NOTIFICATIONS — title-level filtering ============
trackRoutes.get('/notifications', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const filter: any = {}
  if (visiblePairs !== null) {
    filter.$or = visiblePairs.map(p => ({ channelId: p.channelId, titleKeyword: p.keyword }))
    if (filter.$or.length === 0) filter.$or = [{ _id: null }]
  }

  const notifs = await findMany<ITrackNotification>(
    'trackNotifications', filter, { sort: { createdAt: -1 }, limit: 50 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(notifs)
})

trackRoutes.get('/notifications/summary', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const baseFilter: any = {}
  if (visiblePairs !== null) {
    baseFilter.$or = visiblePairs.map(p => ({ channelId: p.channelId, titleKeyword: p.keyword }))
    if (baseFilter.$or.length === 0) baseFilter.$or = [{ _id: null }]
  }

  const total = await countDocuments('trackNotifications', baseFilter, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const completed = await countDocuments('trackNotifications', { ...baseFilter, isRead: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ total, completed })
})

trackRoutes.post('/notifications/:id/read', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  await updateOne(
    'trackNotifications', { _id: toObjectId(id) }, { isRead: true },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ UNDO LAST AUTO-ADD ============
trackRoutes.post('/notifications/:id/undo', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const notif = await findOne<ITrackNotification>('trackNotifications', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!notif) return c.json({ success: false, error: 'Notification not found' }, 404)
  if (!notif.autoAdded || !notif.linkedDownloadPageId) {
    return c.json({ success: false, error: 'This entry was not auto-added, cannot undo' }, 400)
  }
  if ((notif as any).undone) {
    return c.json({ success: false, error: 'This has already been undone' }, 400)
  }

  const page = await findOne<any>('downloadpages', { _id: toObjectId(notif.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404)

  const newUrl = `https://youtube.com/watch?v=${notif.newVideoId}`
  let newLinks = (page.links || []).filter((l: any) => l.url !== newUrl)

  const oldLink = (notif as any).removedOldLink
  if (oldLink) newLinks = [...newLinks, oldLink]

  await updateOne('downloadpages', { _id: page._id }, { links: newLinks }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncPageDerivedData(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)
  await updateOne('trackNotifications', { _id: toObjectId(id) }, { undone: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const admin = c.get('admin')
  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'Auto-added episode link undone',
    targetType: 'downloadpage',
    targetId: notif.linkedDownloadPageId,
    targetTitle: page.slug,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true })
})

trackRoutes.delete('/notifications/:id', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  await deleteOne('trackNotifications', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ============ mark-all-read ============
trackRoutes.post('/notifications/mark-all-read', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const filter: any = { isRead: false }
  if (visiblePairs !== null) {
    filter.$or = visiblePairs.map(p => ({ channelId: p.channelId, titleKeyword: p.keyword }))
    if (filter.$or.length === 0) filter.$or = [{ _id: null }]
  }

  const notifs = await findMany<ITrackNotification>('trackNotifications', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  for (const n of notifs) {
    await updateOne('trackNotifications', { _id: n._id! }, { isRead: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: notifs.length })
})

// ============ clear-all ============
trackRoutes.delete('/notifications/clear-all', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const filter: any = {}
  if (visiblePairs !== null) {
    filter.$or = visiblePairs.map(p => ({ channelId: p.channelId, titleKeyword: p.keyword }))
    if (filter.$or.length === 0) filter.$or = [{ _id: null }]
  }

  const notifs = await findMany<ITrackNotification>('trackNotifications', filter, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  for (const n of notifs) {
    await deleteOne('trackNotifications', { _id: n._id! }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: notifs.length })
})

// ============ CHECK NOW ============
trackRoutes.post('/channel/:channelId/check-now', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

  if (!canSeeChannel(admin, channel, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this channel.' }, 403)
  }

  if (channel.paused) {
    return c.json({ success: true, updatesFound: 0, message: 'Channel is paused, skipped' })
  }

  const quotaTracker = { units: 0 }
  try {
    const updates = await processChannelUpdates(channel, c.env.YOUTUBE_API_KEY, c.env.MONGODB_URI, c.env.MONGODB_DB, quotaTracker)
    if (channel.consecutiveErrors) {
      await updateOne('trackedChannels', { _id: channel._id! }, { consecutiveErrors: 0 }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }
    return c.json({ success: true, updatesFound: updates.length, apiUnitsUsed: quotaTracker.units })
  } catch (err) {
    const newErrCount = (channel.consecutiveErrors || 0) + 1
    const shouldAutoPause = newErrCount >= AUTO_PAUSE_ERROR_THRESHOLD
    const updateData: any = { consecutiveErrors: newErrCount }
    if (shouldAutoPause) updateData.paused = true
    await updateOne('trackedChannels', { _id: channel._id! }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (shouldAutoPause) {
      await notifyOnce({
        message: `⛔ "${channel.channelName}" failed ${newErrCount} times in a row (the handle may have changed or there's a YouTube API error) — the channel has been auto-paused. Check it and resume.`,
        channelId: channel.channelId,
        channelName: channel.channelName,
        titleKeyword: '',
        newVideoId: '',
        newVideoTitle: '',
        newVideoUrl: '',
        newPart: 0,
        isRead: false,
        notifType: 'auto_paused',
      } as any, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }
    return c.json({ success: false, error: 'Check failed' }, 500)
  }
})

// ============ RUN HISTORY ============
trackRoutes.get('/runs', async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') return c.json([])

  const runs = await findMany<any>(
    'cronRunLogs', {}, { sort: { runAt: -1 }, limit: 20 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(runs)
})

// ============ CLEAR RUN HISTORY ============
trackRoutes.delete('/runs/clear-all', async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') return c.json({ success: false, error: 'Only the super admin can perform this action' }, 403)

  const runs = await findMany<any>('cronRunLogs', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  for (const r of runs) {
    await deleteOne('cronRunLogs', { _id: r._id }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: runs.length })
})

// ============ SUB-ADMIN STATS ============
trackRoutes.get('/sub-admin-stats', async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') return c.json({ success: false, error: 'Only the super admin can view this' }, 403)

  const channels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const map: Record<string, { channelsCount: number; titlesCount: number; username?: string }> = {}
  for (const ch of channels) {
    const ownerId = ch.createdBy
    if (!ownerId || ownerId === 'admin') continue // skip super-admin's own channels
    if (!map[ownerId]) {
      map[ownerId] = { channelsCount: 0, titlesCount: 0, username: (ch as any).createdByUsername }
    }
    map[ownerId].channelsCount += 1
    map[ownerId].titlesCount += (ch.titles || []).length
  }

  return c.json(map)
})

// ============ ANALYTICS ============
trackRoutes.get('/analytics', async (c) => {
  const allNotifs = await findMany<ITrackNotification>(
    'trackNotifications', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  const countMap: Record<string, number> = {}
  for (const n of allNotifs) {
    countMap[n.channelName] = (countMap[n.channelName] || 0) + 1
  }
  const mostActiveChannels = Object.entries(countMap)
    .map(([channelName, count]) => ({ channelName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const channels = await findMany<ITrackedChannel>(
    'trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const inactiveChannels: { channelName: string; titleKeyword: string; daysSince: number }[] = []

  for (const ch of channels) {
    for (const t of ch.titles) {
      if (!t.lastKnownPublishedAt) continue
      const daysSince = Math.floor((now - new Date(t.lastKnownPublishedAt).getTime()) / (24 * 60 * 60 * 1000))
      if (now - new Date(t.lastKnownPublishedAt).getTime() > THIRTY_DAYS_MS) {
        inactiveChannels.push({ channelName: ch.channelName, titleKeyword: t.keyword, daysSince })
      }
    }
  }

  return c.json({ mostActiveChannels, inactiveChannels })
})

// ============ CONFLICT PANEL ============
trackRoutes.get('/conflicts', async (c) => {
  const admin = c.get('admin')
  const visibleChannelIds = await getVisibleChannelIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const visibleSet = visibleChannelIds !== null ? new Set(visibleChannelIds) : null

  const channels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const map: Record<string, { channelId: string; channelName: string; titleId: string; keyword: string }[]> = {}

  for (const ch of channels) {
    if (visibleSet && !visibleSet.has(ch.channelId)) continue
    for (const t of ch.titles || []) {
      if (!t.linkedDownloadPageId) continue
      if (!map[t.linkedDownloadPageId]) map[t.linkedDownloadPageId] = []
      map[t.linkedDownloadPageId].push({
        channelId: ch._id!.toString(),
        channelName: ch.channelName,
        titleId: t.id,
        keyword: t.keyword,
      })
    }
  }

  const conflictEntries = Object.entries(map).filter(([, list]) => list.length > 1)
  const results: { pageId: string; slug: string; titles: typeof conflictEntries[0][1] }[] = []

  for (const [pageId, list] of conflictEntries) {
    const page = await findOne<any>('downloadpages', { _id: toObjectId(pageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    results.push({ pageId, slug: page?.slug || 'unknown', titles: list })
  }

  return c.json(results)
})

// ============ TITLE LINK ============
trackRoutes.put('/channel/:channelId/title/:titleId/link', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const {
    linkedAnimeId,
    linkedDownloadPageId,
    episodeLimit,
    resetSeason,
    mergeMode,
    baselineEpisodeMinutes,
    strictChronology,
    chronologyFloorDate,
    chronologyGraceGap
  } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const targetTitle = (channel.titles || []).find(t => t.id === titleId)
  if (!targetTitle) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, targetTitle, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  if (linkedAnimeId) {
    if (allowedAnimeIds !== null && !allowedAnimeIds.includes(linkedAnimeId)) {
      return c.json({ success: false, error: 'You can only link to anime that are assigned to you or created by you.' }, 403)
    }
  }

  let warning: string | null = null
  if (linkedDownloadPageId) {
    const allChannels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    for (const ch of allChannels) {
      for (const t of ch.titles || []) {
        if (t.id !== titleId && t.linkedDownloadPageId === linkedDownloadPageId) {
          warning = `⚠️ This page is already linked to "${t.keyword}" (channel: ${ch.channelName}). Both titles will add episodes to this same page — duplicates may occur.`
        }
      }
    }
  }

  const newTitles = (channel.titles || []).map(t => {
    if (t.id !== titleId) return t
    return {
      ...t,
      linkedAnimeId: linkedAnimeId || null,
      linkedDownloadPageId: linkedDownloadPageId || null,
      episodeLimit: episodeLimit !== undefined ? (Number(episodeLimit) || 0) : (t.episodeLimit ?? 0),
      mergeMode: mergeMode !== undefined ? !!mergeMode : (t.mergeMode ?? true),
      baselineEpisodeDurationSec: baselineEpisodeMinutes ? Number(baselineEpisodeMinutes) * 60 : t.baselineEpisodeDurationSec,
      lastBlockedVideoId: undefined,
      strictChronology: strictChronology !== undefined ? !!strictChronology : t.strictChronology,
      chronologyFloorDate: chronologyFloorDate !== undefined ? chronologyFloorDate : t.chronologyFloorDate,
      chronologyGraceGap: chronologyGraceGap !== undefined ? Number(chronologyGraceGap) : t.chronologyGraceGap,
      ...(resetSeason ? { lastKnownSeason: null } : {}),
    }
  })

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  const updatedKeyword = newTitles.find(t => t.id === titleId)?.keyword
  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'Track title link updated',
    targetType: 'trackedTitle',
    targetId: titleId,
    targetTitle: updatedKeyword,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, warning })
})

// ============ all-videos ============
trackRoutes.get('/channel/:channelId/title/:titleId/all-videos', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const depthParam = c.req.query('depth')
  const rawDepth = depthParam ? Number(depthParam) : (title.initialized ? 50 : 1500)
  const scanDepth = Math.min(
    SINGLE_REQUEST_MAX_DEPTH,
    typeof rawDepth === 'number' && rawDepth > 0 ? Math.floor(rawDepth) : 1500
  )

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const videos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY, undefined, scanDepth)

  const durations = await fetchVideoDurations(videos.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)

  return c.json({
    success: true,
    titleId,
    keyword: title.keyword,
    matchThreshold: title.matchThreshold,
    excludeKeywords: title.excludeKeywords || [],
    initialized: title.initialized === true || videos.filter(v => v.part !== null).length <= 1,
    lastKnownPart: title.lastKnownPart,
    scannedCount: videos.length,
    videos: videos.map(v => ({
      videoId: v.video.videoId,
      videoTitle: v.video.title,
      description: v.video.description,
      thumbnail: v.video.thumbnail,
      publishedAt: v.video.publishedAt,
      url: `https://youtube.com/watch?v=${v.video.videoId}`,
      part: v.part,
      isRange: v.isRange,
      rangeStart: v.rangeStart,
      matchedFormat: v.matchedFormat,
      matchScore: v.matchScore,
      fromDescription: v.fromDescription,
      durationSec: durations[v.video.videoId] ?? null,
    })),
  })
})

// ============ bulk-add ============
trackRoutes.post('/channel/:channelId/title/:titleId/bulk-add', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { downloadPageId, videoIds, episodeOverrides } = await c.req.json() as {
    downloadPageId: string; videoIds: string[]; episodeOverrides?: Record<string, string | number>
  }
  if (!isValidObjectId(channelId) || !isValidObjectId(downloadPageId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  if (!Array.isArray(videoIds) || videoIds.length === 0) return c.json({ success: false, error: 'Select videos' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title not found' }, 404)

  // OWNERSHIP CHECK
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const page = await findOne<any>('downloadpages', { _id: toObjectId(downloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404)

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const allVideos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY)

  const selected = allVideos.filter(v =>
    videoIds.includes(v.video.videoId) && (v.part !== null || episodeOverrides?.[v.video.videoId] !== undefined)
  )
  if (selected.length === 0) return c.json({ success: false, error: 'No valid videos found' }, 400)

  const durations = await fetchVideoDurations(selected.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)

  const existingLinks = page.links || []
  const existingUrls = new Set(existingLinks.map((l: any) => l.url))

  const newLinks = selected
    .filter(v => !existingUrls.has(`https://youtube.com/watch?v=${v.video.videoId}`))
    .map(v => {
      const override = episodeOverrides?.[v.video.videoId] !== undefined
        ? parseEpisodeOverride(episodeOverrides[v.video.videoId])
        : null
      return {
        episode: override ? override.episode : (v.part as number),
        episodeStart: override ? override.episodeStart : (v.isRange ? v.rangeStart : undefined),
        url: `https://youtube.com/watch?v=${v.video.videoId}`,
        type: 'watch',
        quality: '',
        language: '',
        durationSec: durations[v.video.videoId] ?? undefined,
      }
    })

  if (newLinks.length === 0) return c.json({ success: false, error: 'All selected videos already exist on the page' }, 400)

  await updateOne('downloadpages', { _id: page._id }, { links: [...existingLinks, ...newLinks] }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncPageDerivedData(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)

  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: `Bulk-added ${newLinks.length} episodes to page`,
    targetType: 'downloadpage',
    targetId: downloadPageId,
    targetTitle: page.slug,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, added: newLinks.length })
})

// ============ finalize-initial ============
trackRoutes.post('/channel/:channelId/title/:titleId/finalize-initial', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title not found' }, 404)

  // OWNERSHIP CHECK
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const allVideos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY)

  const withPart = allVideos.filter(v => v.part !== null).sort((a, b) => (a.part! - b.part!))
  let latest = withPart[withPart.length - 1]

  if (title.linkedDownloadPageId) {
    const page = await findOne<any>('downloadpages', { _id: toObjectId(title.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const watchLinks = (page?.links || []).filter((l: any) => l.type === 'watch')
    if (watchLinks.length > 0) {
      const maxLink = watchLinks.reduce((a: any, b: any) => (b.episode > a.episode ? b : a))
      const vidMatch = String(maxLink.url || '').match(/[?&]v=([^&]+)/)
      const matchedScanned = vidMatch ? withPart.find(v => v.video.videoId === vidMatch[1]) : undefined
      if (matchedScanned) latest = matchedScanned
      else if (vidMatch) {
        latest = { part: maxLink.episode, video: { videoId: vidMatch[1], title: '', publishedAt: '', thumbnail: '', description: '' }, isRange: !!maxLink.episodeStart, rangeStart: maxLink.episodeStart, season: null, matchScore: 0, fromDescription: false } as any
      }
    }
  }

  const newTitles = (channel.titles || []).map(t => {
    if (t.id !== titleId) return t
    return {
      ...t,
      initialized: true,
      lastKnownPart: latest ? latest.part! : t.lastKnownPart,
      lastKnownVideoId: latest ? latest.video.videoId : t.lastKnownVideoId,
      lastKnownVideoTitle: latest ? latest.video.title : t.lastKnownVideoTitle,
      lastKnownThumbnail: latest ? latest.video.thumbnail : t.lastKnownThumbnail,
      lastKnownPublishedAt: latest ? latest.video.publishedAt : t.lastKnownPublishedAt,
      lastKnownIsRange: latest ? latest.isRange : t.lastKnownIsRange,
      lastKnownSeason: latest?.season ?? t.lastKnownSeason,
    }
  })

  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'Title approved & finalized (auto-tracking started)',
    targetType: 'trackedTitle',
    targetId: titleId,
    targetTitle: title.keyword,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true })
})

// ============ SYNC TITLE STATE WITH ACTUAL PAGE CONTENT ============
trackRoutes.post('/channel/:channelId/title/:titleId/sync-with-page', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title not found' }, 404)

  // OWNERSHIP CHECK
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  if (!title.linkedDownloadPageId) return c.json({ success: false, error: 'Title is not linked to any page' }, 400)

  const page = await findOne<any>('downloadpages', { _id: toObjectId(title.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404)

  const watchLinks = (page.links || []).filter((l: any) => l.type === 'watch')
  if (watchLinks.length === 0) return c.json({ success: false, error: 'No watch links on the page' }, 400)

  const maxLink = watchLinks.reduce((a: any, b: any) => (b.episode > a.episode ? b : a))
  const vidMatch = String(maxLink.url || '').match(/[?&]v=([^&]+)/)
  const videoId = vidMatch ? vidMatch[1] : undefined

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId
      ? {
          ...t,
          lastKnownPart: maxLink.episode,
          lastKnownVideoId: videoId,
          lastKnownIsRange: maxLink.episodeStart !== undefined,
          lastBlockedVideoId: undefined,
        }
      : t
  )

  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true, syncedToPart: maxLink.episode, videoId })
})

// ============ MANUAL EPISODE STATUS SYNC ============
trackRoutes.post('/channel/:channelId/title/:titleId/sync-episode-status', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title not found' }, 404)

  // OWNERSHIP CHECK
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  if (!title.linkedDownloadPageId) return c.json({ success: false, error: 'Title is not linked to any page' }, 400)

  const newCount = await syncPageDerivedData(title.linkedDownloadPageId, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (newCount === null) {
    return c.json({ success: false, error: 'Could not sync — no watch links found on the page' }, 400)
  }

  return c.json({ success: true, currentEpisode: newCount })
})

// ============ Season Change Resolve ============
trackRoutes.post('/channel/:channelId/title/:titleId/resolve-season', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { newSlug } = await c.req.json()
  if (!isValidObjectId(channelId) || !newSlug) return c.json({ success: false, error: 'Invalid input' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title || !title.linkedAnimeId) return c.json({ success: false, error: 'Title is not linked to any anime' }, 400)

  // OWNERSHIP CHECK
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, title, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const existingSlug = await findOne('downloadpages', { slug: newSlug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (existingSlug) return c.json({ success: false, error: 'Slug already exists' }, 400)

  const newPage = { animeId: toObjectId(title.linkedAnimeId), slug: newSlug, title: 'Download', episodeNumber: 1, links: [], isHidden: false }
  const result = await insertOne('downloadpages', newPage, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId
      ? {
          ...t,
          linkedDownloadPageId: result.insertedId.toString(),
          lastKnownSeason: null,
          lastBlockedVideoId: undefined,
          lastKnownPart: 0,
          lastKnownVideoId: undefined,
          lastKnownVideoTitle: undefined,
          lastKnownThumbnail: undefined,
          lastKnownPublishedAt: undefined,
          lastKnownIsRange: false,
        }
      : t
  )
  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  await logActivity({
    actorId: admin?.id || 'unknown',
    actorUsername: admin?.username || 'unknown',
    actorRole: admin?.role === 'subadmin' ? 'subadmin' : 'admin',
    action: 'Season change resolved — new page created',
    targetType: 'downloadpage',
    targetId: result.insertedId.toString(),
    targetTitle: newSlug,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, pageId: result.insertedId, slug: newSlug })
})

// ============ Ignore Video ============
trackRoutes.post('/channel/:channelId/title/:titleId/ignore-video', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { videoId } = await c.req.json()
  if (!isValidObjectId(channelId) || !videoId) return c.json({ success: false, error: 'Invalid input' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const targetTitle = (channel.titles || []).find(t => t.id === titleId)
  if (!targetTitle) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, targetTitle, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId ? { ...t, ignoredVideoIds: [...(t.ignoredVideoIds || []), videoId] } : t
  )
  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ============ BULK Ignore Videos ============
trackRoutes.post('/channel/:channelId/title/:titleId/ignore-videos-bulk', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { videoIds } = await c.req.json() as { videoIds: string[] }
  if (!isValidObjectId(channelId) || !Array.isArray(videoIds) || videoIds.length === 0) {
    return c.json({ success: false, error: 'Invalid input' }, 400)
  }

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel not found' }, 404)

  // OWNERSHIP CHECK
  const targetTitle = (channel.titles || []).find(t => t.id === titleId)
  if (!targetTitle) return c.json({ success: false, error: 'Title not found' }, 404)
  const admin = c.get('admin')
  const allowedAnimeIds = await getAllowedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!canManageTitle(admin, targetTitle, allowedAnimeIds)) {
    return c.json({ success: false, error: 'You do not have permission to manage this title.' }, 403)
  }

  const newTitles = (channel.titles || []).map(t => {
    if (t.id !== titleId) return t
    const merged = new Set([...(t.ignoredVideoIds || []), ...videoIds])
    return { ...t, ignoredVideoIds: Array.from(merged) }
  })

  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true, ignored: videoIds.length })
})

// ============ Activity Logs ============
trackRoutes.get('/activity-logs', async (c) => {
  const { getActivityLogs } = await import('../services/activityLogService')
  const logs = await getActivityLogs(
    { targetType: { $in: ['trackedChannel', 'trackedTitle', 'downloadpage'] } },
    c.env.MONGODB_URI, c.env.MONGODB_DB, 100
  )
  return c.json(logs)
})

// ============ CHECK LOGS ============
trackRoutes.get('/logs', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const filter: any = {}
  if (visiblePairs !== null) {
    // checkLogs me keyword titles[] ke andar hota hai, isliye pehle channelId se narrow karo
    filter.channelId = { $in: Array.from(new Set(visiblePairs.map(p => p.channelId))) }
  }

  const logs = await findMany<any>(
    'checkLogs', filter, { sort: { runAt: -1 }, limit: 40 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (visiblePairs === null) return c.json(logs)

  // phir har log ke titles me se sirf is sub-admin ke titles rakho
  const allowed = new Set(visiblePairs.map(p => `${p.channelId}::${p.keyword}`))
  const scoped = logs
    .map((l: any) => ({
      ...l,
      titles: (l.titles || []).filter((t: any) => allowed.has(`${l.channelId}::${t.keyword}`)),
    }))
    .filter((l: any) => l.titles.length > 0)

  return c.json(scoped)
})

// ============ AUTO-UPDATE HISTORY ============
trackRoutes.get('/auto-history', async (c) => {
  const admin = c.get('admin')
  const visiblePairs = await getVisibleTitleKeywords(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const filter: any = {
    'titles.entries.action': { $in: ['added', 'replaced', 'reuploaded'] },
  }
  if (visiblePairs !== null) {
    filter.channelId = { $in: Array.from(new Set(visiblePairs.map(p => p.channelId))) }
  }

  const logs = await findMany<any>(
    'checkLogs', filter, { sort: { runAt: -1 }, limit: 300 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (visiblePairs === null) return c.json(logs)

  const allowed = new Set(visiblePairs.map(p => `${p.channelId}::${p.keyword}`))
  return c.json(
    logs
      .map((l: any) => ({
        ...l,
        titles: (l.titles || []).filter((t: any) => allowed.has(`${l.channelId}::${t.keyword}`)),
      }))
      .filter((l: any) => l.titles.length > 0)
  )
})

// ============ CLEAR ALL CHECK LOGS ============
trackRoutes.delete('/logs/clear-all', async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') return c.json({ success: false, error: 'Only the super admin can perform this action' }, 403)

  const logs = await findMany<any>('checkLogs', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  for (const l of logs) {
    await deleteOne('checkLogs', { _id: l._id }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: logs.length })
})

// ============ PAGE LINKS MAP ============
trackRoutes.get('/page-links', async (c) => {
  const channels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const map: Record<string, { episodeLimit: number; keyword: string; channelName: string }> = {}
  for (const ch of channels) {
    for (const t of ch.titles || []) {
      if (t.linkedDownloadPageId) {
        map[t.linkedDownloadPageId] = {
          episodeLimit: t.episodeLimit || 0,
          keyword: t.keyword,
          channelName: ch.channelName,
        }
      }
    }
  }
  return c.json(map)
})

// ============ RUN ALL NOW ============
trackRoutes.post('/run-all-now', async (c) => {
  const admin = c.get('admin')
  if (admin.role === 'subadmin') return c.json({ success: false, error: 'Only the super admin can perform this action' }, 403)

  const channels = await findMany<ITrackedChannel>(
    'trackedChannels', { paused: { $ne: true } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  const trackers = channels.map(() => ({ units: 0 }))
  const settled = await processInBatches(channels, 2, 3000, (channel, i) =>
    processChannelUpdates(channel, c.env.YOUTUBE_API_KEY, c.env.MONGODB_URI, c.env.MONGODB_DB, trackers[i])
  )

  let totalUpdatesFound = 0
  let totalUnitsUsed = 0
  const errorChannels: string[] = []

  for (let i = 0; i < settled.length; i++) {
    const channel = channels[i]
    const result = settled[i]
    totalUnitsUsed += trackers[i].units

    if (result.status === 'fulfilled') {
      totalUpdatesFound += result.value.length
      if (channel.consecutiveErrors) {
        await updateOne('trackedChannels', { _id: channel._id! }, { consecutiveErrors: 0 }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      }
    } else {
      console.error(`Channel check failed: ${channel.channelName}`, result.reason)
      errorChannels.push(channel.channelName)

      const newErrCount = (channel.consecutiveErrors || 0) + 1
      const shouldAutoPause = newErrCount >= AUTO_PAUSE_ERROR_THRESHOLD
      const updateData: any = { consecutiveErrors: newErrCount }
      if (shouldAutoPause) updateData.paused = true
      await updateOne('trackedChannels', { _id: channel._id! }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)

      if (shouldAutoPause) {
        await notifyOnce({
          message: `⛔ "${channel.channelName}" failed ${newErrCount} times in a row (the handle may have changed or there's a YouTube API error) — the channel has been auto-paused. Check it and resume.`,
          channelId: channel.channelId,
          channelName: channel.channelName,
          titleKeyword: '',
          newVideoId: '',
          newVideoTitle: '',
          newVideoUrl: '',
          newPart: 0,
          isRead: false,
          notifType: 'auto_paused',
        } as any, c.env.MONGODB_URI, c.env.MONGODB_DB)
      }
    }
  }

  await insertOne('cronRunLogs', {
    runAt: new Date(),
    channelsChecked: channels.length,
    updatesFound: totalUpdatesFound,
    errorCount: errorChannels.length,
    errorChannels,
    apiUnitsUsed: totalUnitsUsed,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({
    success: true,
    channelsChecked: channels.length,
    updatesFound: totalUpdatesFound,
    errorCount: errorChannels.length,
    apiUnitsUsed: totalUnitsUsed,
  })
})

export default trackRoutes