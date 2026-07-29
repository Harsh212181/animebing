import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne, deleteOne, countDocuments, toObjectId, isValidObjectId
} from '../services/mongoService'
import { ITrackedChannel, ITrackNotification } from '../models/types'
import { fetchChannelInfoByHandle, checkChannelForUpdates } from '../services/youtubeCheckService'

const trackRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// Sab routes admin-protected hain (super admin + sub-admin dono chala sakte hain)
trackRoutes.use('*', adminAuth)

// ============ CHANNEL ADD ============
trackRoutes.post('/channel/add', async (c) => {
  const { handle } = await c.req.json()
  if (!handle) return c.json({ success: false, error: 'Handle zaroori hai' }, 400)

  const info = await fetchChannelInfoByHandle(handle, c.env.YOUTUBE_API_KEY)
  if (!info) return c.json({ success: false, error: 'Channel nahi mila, handle check karo' }, 404)

  // Duplicate check
  const existing = await findOne<ITrackedChannel>(
    'trackedChannels', { channelId: info.channelId }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (existing) return c.json({ success: false, error: 'Ye channel already track ho raha hai' }, 400)

  const admin = c.get('admin')
  const result = await insertOne('trackedChannels', {
    channelId: info.channelId,
    channelName: info.channelName,
    channelHandle: handle,
    uploadsPlaylistId: info.uploadsPlaylistId,
    titles: [],
    createdBy: admin?.id,
    createdByUsername: admin?.username,
  }, c.env.MONGODB_URI, c.env.MONGODB_DB)

  return c.json({ success: true, channelName: info.channelName, id: result.insertedId })
})

// ============ CHANNELS LIST ============
trackRoutes.get('/channels', async (c) => {
  const channels = await findMany<ITrackedChannel>(
    'trackedChannels', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json(channels)
})

// ============ CHANNEL REMOVE ============
trackRoutes.delete('/channel/:channelId', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  await deleteOne('trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  return c.json({ success: true })
})

// ============ TITLE ADD (channel ke andar naya series/keyword) ============
trackRoutes.post('/channel/:channelId/title/add', async (c) => {
  const channelId = c.req.param('channelId')
  const { keyword, currentKnownPart } = await c.req.json()
  if (!keyword) return c.json({ success: false, error: 'Keyword zaroori hai' }, 400)
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const newTitles = [
    ...(channel.titles || []),
    { id: crypto.randomUUID(), keyword, lastKnownPart: Number(currentKnownPart) || 0 },
  ]

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
    channelsLimit: 5000,          // playlistItems.list method (~2 units/channel) ke hisab se
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

trackRoutes.post('/notifications/:id/read', async (c) => {
  const id = c.req.param('id')
  if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  await updateOne(
    'trackNotifications', { _id: toObjectId(id) }, { isRead: true },
    c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  return c.json({ success: true })
})

// ============ MANUAL "CHECK NOW" (admin ek channel ke liye turant check kare) ============
trackRoutes.post('/channel/:channelId/check-now', async (c) => {
  const channelId = c.req.param('channelId')
  if (!isValidObjectId(channelId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

  const channel = await findOne<ITrackedChannel>(
    'trackedChannels', { _id: toObjectId(channelId) }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!channel) return c.json({ success: false, error: 'Channel nahi mila' }, 404)

  const updates = await checkChannelForUpdates(channel, c.env.YOUTUBE_API_KEY)

  for (const update of updates) {
    await insertOne('trackNotifications', {
      message: `${channel.channelName} — "${update.title.keyword}" Part ${update.newPart} upload ho gaya hai!`,
      channelId: channel.channelId,
      channelName: channel.channelName,
      titleKeyword: update.title.keyword,
      videoId: update.videoId,
      videoUrl: `https://youtube.com/watch?v=${update.videoId}`,
      isRead: false,
    }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const newTitles = channel.titles.map(t =>
      t.id === update.title.id ? { ...t, lastKnownPart: update.newPart } : t
    )
    await updateOne(
      'trackedChannels', { _id: channel._id! }, { titles: newTitles },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
  }

  return c.json({ success: true, updatesFound: updates.length })
})

export default trackRoutes