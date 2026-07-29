import { Hono } from 'hono'
import { cors } from 'hono/cors'
import adminRoutes from './routes/adminRoutes'
import animeRoutes from './routes/animeRoutes'
import episodeRoutes from './routes/episodeRoutes'
import chapterRoutes from './routes/chapterRoutes'
import appDownloadRoutes from './routes/appDownloadRoutes'
import contactRoutes from './routes/contactRoutes'
import downloadPageRoutes from './routes/downloadPageRoutes'
import linkSettingsRoutes from './routes/linkSettingsRoutes'
import partnerRoutes from './routes/partnerRoutes'
import pollRoutes from './routes/pollRoutes'
import reportRoutes from './routes/reportRoutes'
import sitemapRoutes from './routes/sitemapRoutes'
import socialRoutes from './routes/socialRoutes'
import shortenerRoutes from './routes/shortenerRoutes'
import shortUserRoutes from './routes/shortUserRoutes'
import referralRoutes from './routes/referralRoutes'
import analyticsRoutes from './routes/analyticsRoutes'
import authRoutes from './routes/authRoutes'
import subAdminRoutes from './routes/subAdminRoutes'
import animeLinkControlRoutes from './routes/animeLinkControlRoutes'
import specialModeRoutes from './routes/specialModeRoutes'
import notesRoutes from './routes/notesRoutes'
import trackRoutes from './routes/trackRoutes'                     // ← NEW
import { findMany, insertOne, updateOne } from './services/mongoService' // ← NEW
import { ITrackedChannel, ITrackNotification } from './models/types'      // ← NEW
import { checkChannelForUpdates } from './services/youtubeCheckService'   // ← NEW

export type Env = {
  MONGODB_URI: string
  MONGODB_DB: string
  ALLOWED_ORIGIN: string
  JWT_SECRET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  API_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  FRONTEND_URL: string
  YOUTUBE_API_KEY: string
}

export type Variables = {
  admin: any
  user: any
  shortUser: any
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// OPTIONS preflight
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// CORS
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false,
  })
  return corsMiddleware(c, next)
})

// ============ API ROUTES ============
app.route('/api/admin', adminRoutes)
app.route('/api/anime', animeRoutes)
app.route('/api/episodes', episodeRoutes)
app.route('/api/chapters', chapterRoutes)
app.route('/api/app-downloads', appDownloadRoutes)
app.route('/api', contactRoutes)
app.route('/api/download-pages', downloadPageRoutes)
app.route('/api/link-settings', linkSettingsRoutes)
app.route('/api/partners', partnerRoutes)
app.route('/api/polls', pollRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/social', socialRoutes)
app.route('/api/short-users', shortUserRoutes)
app.route('/api/short-users/referral', referralRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/sub-admin', subAdminRoutes)
app.route('/api/anime-link-control', animeLinkControlRoutes)
app.route('/api/special-modes', specialModeRoutes)
app.route('/api/notes', notesRoutes)
app.route('/api/track', trackRoutes)                              // ← NEW

// ============ SITEMAP ============
app.route('/', sitemapRoutes)

// ============ URL SHORTENER ============
app.route('/', shortenerRoutes)

// ============ HEALTH CHECK ============
app.get('/health', (c) => {
  return c.json({ message: 'Animabing Backend Working! 🚀', status: 'ok' })
})

// ============ EXPORT (with scheduled) ============
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const channels = await findMany<ITrackedChannel>(
      'trackedChannels', {}, {}, env.MONGODB_URI, env.MONGODB_DB
    )

    for (const channel of channels) {
      try {
        const updates = await checkChannelForUpdates(channel, env.YOUTUBE_API_KEY)

        for (const update of updates) {
          await insertOne('trackNotifications', {
            message: `${channel.channelName} — "${update.title.keyword}" Part ${update.newPart} upload ho gaya hai!`,
            channelId: channel.channelId,
            channelName: channel.channelName,
            titleKeyword: update.title.keyword,
            videoId: update.videoId,
            videoUrl: `https://youtube.com/watch?v=${update.videoId}`,
            isRead: false,
          }, env.MONGODB_URI, env.MONGODB_DB)

          const newTitles = channel.titles.map(t =>
            t.id === update.title.id ? { ...t, lastKnownPart: update.newPart } : t
          )
          await updateOne(
            'trackedChannels', { _id: channel._id! }, { titles: newTitles },
            env.MONGODB_URI, env.MONGODB_DB
          )
        }
      } catch (err) {
        console.error(`Channel check failed: ${channel.channelName}`, err)
        // Ek channel fail ho to baaki continue rahenge, loop nahi rukega
      }
    }
  },
}