 // ============================================================
// animabing-worker/my-app/src/routes/trackRoutes.ts
// ============================================================

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne, deleteOne, countDocuments, toObjectId, isValidObjectId
} from '../services/mongoService'
import { ITrackedChannel, ITrackNotification } from '../models/types'
import { processChannelUpdates, fetchChannelInfoByHandle, fetchRecentVideos, fetchVideoDurations, matchAndParseVideos } from '../services/youtubeCheckService'
import { logActivity } from '../services/activityLogService'
import { syncAnimeEpisodeCountFromPage } from '../services/episodeSyncService'   // ✅ NEW

const trackRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ✅ Consecutive-failure threshold before a channel is auto-paused
const AUTO_PAUSE_ERROR_THRESHOLD = 5

// Sab routes admin-protected hain (super admin + sub-admin dono chala sakte hain)
trackRoutes.use('*', adminAuth)

// ============ CHANNEL ADD ============
trackRoutes.post('/channel/add', async (c) => {
  const { handle } = await c.req.json()
  if (!handle) return c.json({ success: false, error: 'Handle zaroori hai' }, 400)

  const info = await fetchChannelInfoByHandle(handle, c.env.YOUTUBE_API_KEY)
  if (!info) return c.json({ success: false, error: 'Channel nahi mila, handle check karo' }, 404)

  const existing = await findOne<ITrackedChannel>(
    'trackedChannels', { channelId: info.channelId }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (existing) return c.json({ success: false, error: 'Ye channel already track ho raha hai' }, 400)

  const admin = c.get('admin')
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
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const info = await fetchChannelInfoByHandle(channel.channelHandle, c.env.YOUTUBE_API_KEY)
  if (!info) return c.json({ success: false, error: 'YouTube se info nahi mili' }, 404)

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) },
    { channelName: info.channelName, channelThumbnail: info.channelThumbnail },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, channelThumbnail: info.channelThumbnail })
})

// ============ CHANNELS LIST ============
trackRoutes.get('/channels', async (c) => {
  const channels = await findMany<ITrackedChannel>(
    'trackedChannels', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(channels)
})

// ============ CHANNEL PAUSE/RESUME ============
trackRoutes.post('/channel/:channelId/toggle-pause', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const nowPaused = !channel.paused
  const updateData: any = { paused: nowPaused }
  // ✅ Manually resuming clears the auto-pause error counter
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

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  await deleteOne('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  const admin = c.get('admin')
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

// ============ ✅ TEST MATCH PREVIEW — ab threshold/excludeKeywords accept karta hai, durations bhi include, scanDepth support ============
trackRoutes.post('/channel/:channelId/title/test-match', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  const { keyword, matchThreshold, excludeKeywords, scanDepth } = await c.req.json()
  if (!keyword || !String(keyword).trim()) return c.json({ success: false, error: 'Keyword zaroori hai' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  // ✅ Default scan depth is 1500 for first-time preview (no tracked title)
  const depth = typeof scanDepth === 'number' && scanDepth > 0 ? scanDepth : 1500
  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY, depth)
  const matched = matchAndParseVideos(recentVideos, String(keyword).trim(), [], {
    threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
    excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
  })

  // ✅ Sabhi matched videos ki duration ek hi batch call me fetch karo
  const durations = await fetchVideoDurations(matched.map(m => m.video.videoId), c.env.YOUTUBE_API_KEY)

  return c.json({
    success: true,
    matchedCount: matched.length,
    scannedCount: recentVideos.length,   // ✅ frontend ko batayega kitne total videos scan hue
    videos: matched.map(v => ({          // ✅ slice(0,15) hata diya — ab saare matches dikhenge
      videoId: v.video.videoId,
      videoTitle: v.video.title,
      description: v.video.description,          // ✅ "More" button ke liye
      thumbnail: v.video.thumbnail,
      publishedAt: v.video.publishedAt,
      part: v.part,
      isRange: v.isRange,
      rangeStart: v.rangeStart,
      matchedFormat: v.matchedFormat,
      matchScore: v.matchScore,
      fromDescription: v.fromDescription,
      durationSec: durations[v.video.videoId] ?? null,   // ✅ duration
    })),
  })
})

// ============ ✅ NEW — QUICK BULK ADD FROM PREVIEW (title track kiye bina) ============
trackRoutes.post('/channel/:channelId/quick-bulk-add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keyword, matchThreshold, excludeKeywords, downloadPageId, videoIds, episodeOverrides } = await c.req.json() as {
    keyword: string; matchThreshold?: number; excludeKeywords?: string[];
    downloadPageId: string; videoIds: string[]; episodeOverrides?: Record<string, number>
  }
  if (!isValidObjectId(channelId) || !isValidObjectId(downloadPageId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  if (!keyword || !String(keyword).trim()) return c.json({ success: false, error: 'Keyword zaroori hai' }, 400)
  if (!Array.isArray(videoIds) || videoIds.length === 0) return c.json({ success: false, error: 'Videos select karo' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const page = await findOne<any>('downloadpages', { _id: toObjectId(downloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page nahi mila' }, 404)

  // ✅ keyword ke sath dobara match run karo — client se part number trust nahi karte,
  // sirf ye trust karte hain ki user ne kaunsa videoId select kiya
  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, c.env.YOUTUBE_API_KEY, 50)
  const matched = matchAndParseVideos(recentVideos, String(keyword).trim(), [], {
    threshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
    excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords : undefined,
  })

  const selected = matched.filter(v =>
    videoIds.includes(v.video.videoId) && (v.part !== null || episodeOverrides?.[v.video.videoId] !== undefined)
  )
  if (selected.length === 0) return c.json({ success: false, error: 'Koi valid video nahi mila' }, 400)

  const durations = await fetchVideoDurations(selected.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)

  const existingLinks = page.links || []
  const existingUrls = new Set(existingLinks.map((l: any) => l.url))
  const newLinks = selected
    .filter(v => !existingUrls.has(`https://youtube.com/watch?v=${v.video.videoId}`))
    .map(v => ({
      episode: episodeOverrides?.[v.video.videoId] !== undefined ? Number(episodeOverrides[v.video.videoId]) : (v.part as number),
      episodeStart: v.isRange ? v.rangeStart : undefined,
      url: `https://youtube.com/watch?v=${v.video.videoId}`,
      type: 'watch',
      quality: '',
      language: '',
      durationSec: durations[v.video.videoId] ?? undefined,
    }))

  if (newLinks.length === 0) return c.json({ success: false, error: 'Sabhi selected videos already page me maujood hain' }, 400)

  await updateOne('downloadpages', { _id: page._id }, { links: [...existingLinks, ...newLinks] }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncAnimeEpisodeCountFromPage(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)   // ✅ NEW

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

  return c.json({ success: true, added: newLinks.length })
})

// ============ TITLE ADD — ab matchThreshold/excludeKeywords bhi accept karta hai ============
trackRoutes.post('/channel/:channelId/title/add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keyword, currentKnownPart, matchThreshold, excludeKeywords } = await c.req.json()
  if (!keyword) return c.json({ success: false, error: 'Keyword zaroori hai' }, 400)
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const keywordLower = keyword.trim().toLowerCase()
  const alreadyExists = (channel.titles || []).some(t => t.keyword.trim().toLowerCase() === keywordLower)
  if (alreadyExists) {
    return c.json({ success: false, error: `"${keyword}" pehle se track ho raha hai is channel me` }, 400)
  }

  const newTitles = [
    ...(channel.titles || []),
    {
      id: crypto.randomUUID(),
      keyword,
      lastKnownPart: Number(currentKnownPart) || 0,
      matchThreshold: typeof matchThreshold === 'number' ? matchThreshold : undefined,
      excludeKeywords: Array.isArray(excludeKeywords) ? excludeKeywords.filter(Boolean) : undefined,
    },
  ]

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
    return c.json({ success: false, error: 'Keywords list zaroori hai' }, 400)
  }
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const existingLower = new Set((channel.titles || []).map(t => t.keyword.trim().toLowerCase()))
  const toAdd: any[] = []
  const skipped: string[] = []

  for (const raw of keywords) {
    const keyword = String(raw).trim()
    if (!keyword) continue
    const lower = keyword.toLowerCase()
    if (existingLower.has(lower)) { skipped.push(keyword); continue }
    existingLower.add(lower)
    toAdd.push({ id: crypto.randomUUID(), keyword, lastKnownPart: 0 })
  }

  const newTitles = [...(channel.titles || []), ...toAdd]
  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true, added: toAdd.length, skipped })
})

// ============ TITLE EDIT — ab matchThreshold/excludeKeywords bhi update kar sakta hai ============
trackRoutes.put('/channel/:channelId/title/:titleId/edit', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { keyword, lastKnownPart, matchThreshold, excludeKeywords } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

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

// ============ ✅ NEW — dedicated settings route (threshold + exclude keywords only) ============
trackRoutes.put('/channel/:channelId/title/:titleId/settings', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { matchThreshold, excludeKeywords } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

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
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const newTitles = (channel.titles || []).filter(t => t.id !== titleId)

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ CAPACITY METER ============
trackRoutes.get('/capacity', async (c) => {
  const channelsUsed = await countDocuments('trackedChannels', {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({
    channelsUsed,
    channelsLimit: 5000,
    unitsUsedPerCheck: channelsUsed * 2,
    unitsLimit: 10000,
  })
})

// ============ NOTIFICATIONS ============
trackRoutes.get('/notifications', async (c) => {
  const notifs = await findMany<ITrackNotification>(
    'trackNotifications', {}, { sort: { createdAt: -1 }, limit: 50 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(notifs)
})

trackRoutes.get('/notifications/summary', async (c) => {
  const total = await countDocuments('trackNotifications', {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const completed = await countDocuments('trackNotifications', { isRead: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)
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

// ============ ✅ NEW — UNDO LAST AUTO-ADD ============
trackRoutes.post('/notifications/:id/undo', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const notif = await findOne<ITrackNotification>('trackNotifications', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!notif) return c.json({ success: false, error: 'Notification nahi mila' }, 404)
  if (!notif.autoAdded || !notif.linkedDownloadPageId) {
    return c.json({ success: false, error: 'Ye entry auto-add nahi thi, undo nahi ho sakta' }, 400)
  }
  if ((notif as any).undone) {
    return c.json({ success: false, error: 'Ye pehle se undo ho chuka hai' }, 400)
  }

  const page = await findOne<any>('downloadpages', { _id: toObjectId(notif.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page nahi mila' }, 404)

  const newUrl = `https://youtube.com/watch?v=${notif.newVideoId}`
  let newLinks = (page.links || []).filter((l: any) => l.url !== newUrl)

  const oldLink = (notif as any).removedOldLink
  if (oldLink) newLinks = [...newLinks, oldLink]

  await updateOne('downloadpages', { _id: page._id }, { links: newLinks }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncAnimeEpisodeCountFromPage(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)   // ✅ NEW
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

trackRoutes.post('/notifications/mark-all-read', async (c) => {
  const notifs = await findMany<ITrackNotification>(
    'trackNotifications', { isRead: false }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  for (const n of notifs) {
    await updateOne('trackNotifications', { _id: n._id! }, { isRead: true }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: notifs.length })
})

trackRoutes.delete('/notifications/clear-all', async (c) => {
  const notifs = await findMany<ITrackNotification>(
    'trackNotifications', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  for (const n of notifs) {
    await deleteOne('trackNotifications', { _id: n._id! }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: notifs.length })
})

// ============ ✅ CHECK NOW — ab quota tracker use karta hai ============
trackRoutes.post('/channel/:channelId/check-now', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  if (channel.paused) {
    return c.json({ success: true, updatesFound: 0, message: 'Channel paused hai, skip kiya gaya' })
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
      await insertOne('trackNotifications', {
        message: `⛔ "${channel.channelName}" lagatar ${newErrCount} baar fail hua (handle change ho sakta hai ya YouTube API error) — channel khud-b-khud pause kar diya gaya hai. Check karke resume karo.`,
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
    return c.json({ success: false, error: 'Check fail ho gaya' }, 500)
  }
})

// ============ RUN HISTORY ============
trackRoutes.get('/runs', async (c) => {
  const runs = await findMany<any>(
    'cronRunLogs', {}, { sort: { runAt: -1 }, limit: 20 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(runs)
})

// ============ ✅ NEW — CLEAR RUN HISTORY ============
trackRoutes.delete('/runs/clear-all', async (c) => {
  const runs = await findMany<any>('cronRunLogs', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  for (const r of runs) {
    await deleteOne('cronRunLogs', { _id: r._id }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  }
  return c.json({ success: true, count: runs.length })
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

// ============ ✅ NEW — CONFLICT PANEL ============
trackRoutes.get('/conflicts', async (c) => {
  const channels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
  const map: Record<string, { channelId: string; channelName: string; titleId: string; keyword: string }[]> = {}

  for (const ch of channels) {
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

// ============ TITLE LINK (anime + page + limit set/update karo) ============
trackRoutes.put('/channel/:channelId/title/:titleId/link', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { linkedAnimeId, linkedDownloadPageId, episodeLimit, resetSeason, mergeMode, baselineEpisodeMinutes } = await c.req.json()
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  // ✅ Multi-channel same-page warning
  let warning: string | null = null
  if (linkedDownloadPageId) {
    const allChannels = await findMany<ITrackedChannel>('trackedChannels', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    for (const ch of allChannels) {
      for (const t of ch.titles || []) {
        if (t.id !== titleId && t.linkedDownloadPageId === linkedDownloadPageId) {
          warning = `⚠️ Ye page pehle se "${t.keyword}" (channel: ${ch.channelName}) se bhi linked hai. Dono titles isi page me episodes add karenge — duplicate ho sakta hai.`
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
      ...(resetSeason ? { lastKnownSeason: null } : {}),
    }
  })

  await updateOne(
    'trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  // ✅ Activity log
  const admin = c.get('admin')
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

// ============ ✅ all-videos — ab duration bhi include karta hai, depth query param support ============
trackRoutes.get('/channel/:channelId/title/:titleId/all-videos', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title nahi mila' }, 404)

  const depthParam = c.req.query('depth')
  // ✅ depth na diya ho toh auto: initialized => 50, warna 1500
  const scanDepth = depthParam ? Number(depthParam) : (title.initialized ? 50 : 1500)

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const videos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY, undefined, scanDepth)

  // ✅ durations fetch karo
  const durations = await fetchVideoDurations(videos.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)

  return c.json({
    success: true,
    titleId,
    keyword: title.keyword,
    matchThreshold: title.matchThreshold,
    excludeKeywords: title.excludeKeywords || [],
    initialized: title.initialized === true || videos.filter(v => v.part !== null).length <= 1,
    lastKnownPart: title.lastKnownPart,
    scannedCount: videos.length,   // hint
    videos: videos.map(v => ({
      videoId: v.video.videoId,
      videoTitle: v.video.title,
      description: v.video.description,   // ✅ NEW
      thumbnail: v.video.thumbnail,
      publishedAt: v.video.publishedAt,
      url: `https://youtube.com/watch?v=${v.video.videoId}`,
      part: v.part,
      isRange: v.isRange,
      rangeStart: v.rangeStart,
      matchedFormat: v.matchedFormat,
      matchScore: v.matchScore,
      fromDescription: v.fromDescription,
      durationSec: durations[v.video.videoId] ?? null,   // ✅ NEW
    })),
  })
})

// ============ ✅ bulk-add — ab duration save karta hai ============
trackRoutes.post('/channel/:channelId/title/:titleId/bulk-add', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { downloadPageId, videoIds, episodeOverrides } = await c.req.json() as {
    downloadPageId: string; videoIds: string[]; episodeOverrides?: Record<string, number>
  }
  if (!isValidObjectId(channelId) || !isValidObjectId(downloadPageId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
  if (!Array.isArray(videoIds) || videoIds.length === 0) return c.json({ success: false, error: 'Videos select karo' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title nahi mila' }, 404)

  const page = await findOne<any>('downloadpages', { _id: toObjectId(downloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page nahi mila' }, 404)

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const allVideos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY)

  const selected = allVideos.filter(v =>
    videoIds.includes(v.video.videoId) && (v.part !== null || episodeOverrides?.[v.video.videoId] !== undefined)
  )
  if (selected.length === 0) return c.json({ success: false, error: 'Koi valid video nahi mila' }, 400)

  // ✅ NEW — sirf jo add ho raha hai unhi ki duration fetch/save karo
  const durations = await fetchVideoDurations(selected.map(v => v.video.videoId), c.env.YOUTUBE_API_KEY)

  const existingLinks = page.links || []
  const existingUrls = new Set(existingLinks.map((l: any) => l.url))
  const newLinks = selected
    .filter(v => !existingUrls.has(`https://youtube.com/watch?v=${v.video.videoId}`))
    .map(v => ({
      episode: episodeOverrides?.[v.video.videoId] !== undefined ? Number(episodeOverrides[v.video.videoId]) : (v.part as number),
      episodeStart: v.isRange ? v.rangeStart : undefined,
      url: `https://youtube.com/watch?v=${v.video.videoId}`,
      type: 'watch',
      quality: '',
      language: '',
      durationSec: durations[v.video.videoId] ?? undefined,   // ✅ NEW
    }))

  if (newLinks.length === 0) return c.json({ success: false, error: 'Sabhi selected videos already page me maujood hain' }, 400)

  await updateOne('downloadpages', { _id: page._id }, { links: [...existingLinks, ...newLinks] }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  await syncAnimeEpisodeCountFromPage(page._id.toString(), c.env.MONGODB_URI, c.env.MONGODB_DB)   // ✅ NEW

  const admin = c.get('admin')
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

// ============ ✅ finalize-initial — PERMANENT FIX: page content se sync karo, scan ke max se nahi ============
trackRoutes.post('/channel/:channelId/title/:titleId/finalize-initial', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title nahi mila' }, 404)

  const { fetchAllVideosForTitle } = await import('../services/youtubeCheckService')
  const allVideos = await fetchAllVideosForTitle(channel, title, c.env.YOUTUBE_API_KEY)

  const withPart = allVideos.filter(v => v.part !== null).sort((a, b) => (a.part! - b.part!))
  let latest = withPart[withPart.length - 1]

  // ✅ PERMANENT FIX: Agar page already linked hai, toh scan ke max ke bajaye
  // page pe actually jo add hai wahi "known" maano
  if (title.linkedDownloadPageId) {
    const page = await findOne<any>('downloadpages', { _id: toObjectId(title.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const watchLinks = (page?.links || []).filter((l: any) => l.type === 'watch')
    if (watchLinks.length > 0) {
      const maxLink = watchLinks.reduce((a: any, b: any) => (b.episode > a.episode ? b : a))
      const vidMatch = String(maxLink.url || '').match(/[?&]v=([^&]+)/)
      const matchedScanned = vidMatch ? withPart.find(v => v.video.videoId === vidMatch[1]) : undefined
      if (matchedScanned) latest = matchedScanned
      // agar scan me nahi mila (purana/manual link), phir bhi part number trust karo:
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

  const admin = c.get('admin')
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

// ============ ✅ NEW — SYNC TITLE STATE WITH ACTUAL PAGE CONTENT ============
trackRoutes.post('/channel/:channelId/title/:titleId/sync-with-page', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title nahi mila' }, 404)
  if (!title.linkedDownloadPageId) return c.json({ success: false, error: 'Title kisi page se linked nahi hai' }, 400)

  const page = await findOne<any>('downloadpages', { _id: toObjectId(title.linkedDownloadPageId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!page) return c.json({ success: false, error: 'Page nahi mila' }, 404)

  const watchLinks = (page.links || []).filter((l: any) => l.type === 'watch')
  if (watchLinks.length === 0) return c.json({ success: false, error: 'Page pe koi watch link nahi hai' }, 400)

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

// ============ ✅ NEW — MANUAL EPISODE STATUS SYNC (anime.currentEpisode ko page se force-update karo) ============
trackRoutes.post('/channel/:channelId/title/:titleId/sync-episode-status', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title) return c.json({ success: false, error: 'Title nahi mila' }, 404)
  if (!title.linkedDownloadPageId) return c.json({ success: false, error: 'Title kisi page se linked nahi hai' }, 400)

  const newCount = await syncAnimeEpisodeCountFromPage(title.linkedDownloadPageId, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (newCount === null) {
    return c.json({ success: false, error: 'Sync nahi ho saka — page pe koi watch link nahi mila' }, 400)
  }

  return c.json({ success: true, currentEpisode: newCount })
})

// ============ ✅ Season Change Resolve — naya page banao aur re-link karo (lastKnownPart reset) ============
trackRoutes.post('/channel/:channelId/title/:titleId/resolve-season', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { newSlug } = await c.req.json()
  if (!isValidObjectId(channelId) || !newSlug) return c.json({ success: false, error: 'Invalid input' }, 400)

  const channel = await findOne<ITrackedChannel>('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)
  const title = (channel.titles || []).find(t => t.id === titleId)
  if (!title || !title.linkedAnimeId) return c.json({ success: false, error: 'Title kisi anime se linked nahi hai' }, 400)

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

  const admin = c.get('admin')
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

// ============ ✅ Video Ignore Karo (permanently hide from match) ============
trackRoutes.post('/channel/:channelId/title/:titleId/ignore-video', async (c) => {
  const channelId = c.req.param('channelId')
  const titleId = c.req.param('titleId')
  const { videoId } = await c.req.json()
  if (!isValidObjectId(channelId) || !videoId) return c.json({ success: false, error: 'Invalid input' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const newTitles = (channel.titles || []).map(t =>
    t.id === titleId ? { ...t, ignoredVideoIds: [...(t.ignoredVideoIds || []), videoId] } : t
  )
  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ============ ✅ NEW — BULK Video Ignore (atomic, avoids race condition on parallel calls) ============
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
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const newTitles = (channel.titles || []).map(t => {
    if (t.id !== titleId) return t
    const merged = new Set([...(t.ignoredVideoIds || []), ...videoIds])
    return { ...t, ignoredVideoIds: Array.from(merged) }
  })

  await updateOne('trackedChannels', { _id: toObjectId(channelId) }, { titles: newTitles }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true, ignored: videoIds.length })
})

// ============ ✅ Activity Logs (track-related actions) ============
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
  const logs = await findMany<any>(
    'checkLogs', {}, { sort: { runAt: -1 }, limit: 40 },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(logs)
})

// ============ ✅ NEW — CLEAR ALL CHECK LOGS ============
trackRoutes.delete('/logs/clear-all', async (c) => {
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

// ============ ✅ RUN ALL NOW — ab quota tracker sum bhi karta hai ============
trackRoutes.post('/run-all-now', async (c) => {
  const channels = await findMany<ITrackedChannel>(
    'trackedChannels', { paused: { $ne: true } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  )

  const trackers = channels.map(() => ({ units: 0 }))
  const settled = await Promise.allSettled(
    channels.map((channel, i) =>
      processChannelUpdates(channel, c.env.YOUTUBE_API_KEY, c.env.MONGODB_URI, c.env.MONGODB_DB, trackers[i])
    )
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
        await insertOne('trackNotifications', {
          message: `⛔ "${channel.channelName}" lagatar ${newErrCount} baar fail hua (handle change ho sakta hai ya YouTube API error) — channel khud-b-khud pause kar diya gaya hai. Check karke resume karo.`,
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