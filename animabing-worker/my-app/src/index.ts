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
import trackRoutes from './routes/trackRoutes'
import { findMany, insertOne, updateOne } from './services/mongoService'
import { ITrackedChannel } from './models/types'
import { processChannelUpdates, notifyOnce, processInBatches } from './services/youtubeCheckService'
import linkGeneratorRoutes from './routes/linkGeneratorRoutes'

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
  CUTY_API_KEY: string
  SHRINKME_API_KEY: string
  GPLINKS_API_KEY: string
  LINKJUST_API_KEY: string
}

export type Variables = {
  admin: any
  user: any
  shortUser: any
}

// ✅ Consecutive-failure threshold before a channel is auto-paused (kept in sync with trackRoutes.ts)
const AUTO_PAUSE_ERROR_THRESHOLD = 5

// ✅ NEW — cron duplicate-invocation guard window. Cloudflare can retry a scheduled()
// invocation if the previous one threw/crashed — this makes sure we don't process the
// same cron tick twice and write duplicate cronRunLogs / notifications.
const CRON_DEDUPE_WINDOW_MS = 5 * 60 * 1000

// ✅ NEW — chunk load: kitne channels ek saath process honge, aur batches ke beech gap.
// Groups of 2 rakha gaya hai taaki YouTube API pe burst load kam ho aur 429/quota errors
// se bachte hue channels galti se auto-pause na hon.
const CHANNEL_BATCH_SIZE = 2
const CHANNEL_BATCH_DELAY_MS = 3000

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
app.route('/api/track', trackRoutes)
app.route('/api/link-generator', linkGeneratorRoutes)

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
    try {
      // ✅ NEW — idempotency guard: agar Cloudflare ne pichle 5 min me already ek run
      // start/complete kiya hai (retry ki wajah se), toh skip karo. Isse duplicate
      // cronRunLogs entries aur duplicate notifications rukte hain.
      const recentRun = await findMany<any>(
        'cronRunLogs',
        { runAt: { $gte: new Date(Date.now() - CRON_DEDUPE_WINDOW_MS) } },
        { limit: 1 },
        env.MONGODB_URI, env.MONGODB_DB
      )
      if (recentRun.length > 0) {
        console.log('Duplicate scheduled invocation detected within dedupe window — skipping')
        return
      }

      const channels = await findMany<ITrackedChannel>(
        'trackedChannels', { paused: { $ne: true } }, {}, env.MONGODB_URI, env.MONGODB_DB
      )

      // ✅ Per-channel quota tracker, summed at the end
      const trackers = channels.map(() => ({ units: 0 }))
      // ✅ FIX: sab channels ek saath (Promise.allSettled) nahi — ab 2-2 ka group,
      // batches ke beech 3 sec gap. YouTube API pe burst load kam, 429/quota errors kam.
      const settled = await processInBatches(channels, CHANNEL_BATCH_SIZE, CHANNEL_BATCH_DELAY_MS, (channel, i) =>
        processChannelUpdates(channel, env.YOUTUBE_API_KEY, env.MONGODB_URI, env.MONGODB_DB, trackers[i])
      )

      let totalUpdatesFound = 0
      let totalUnitsUsed = 0
      const errorChannels: string[] = []

      for (let i = 0; i < settled.length; i++) {
        const channel = channels[i]
        const result = settled[i]
        totalUnitsUsed += trackers[i].units

        // ✅ Per‑channel bookkeeping isolated — one channel's DB failure won't crash the entire cron run
        try {
          if (result.status === 'fulfilled') {
            totalUpdatesFound += result.value.length
            if (channel.consecutiveErrors) {
              await updateOne('trackedChannels', { _id: channel._id! }, { consecutiveErrors: 0 }, env.MONGODB_URI, env.MONGODB_DB)
            }
          } else {
            console.error(`Channel check failed: ${channel.channelName}`, result.reason)
            errorChannels.push(channel.channelName)

            const newErrCount = (channel.consecutiveErrors || 0) + 1
            const shouldAutoPause = newErrCount >= AUTO_PAUSE_ERROR_THRESHOLD
            const updateData: any = { consecutiveErrors: newErrCount }
            if (shouldAutoPause) updateData.paused = true
            await updateOne('trackedChannels', { _id: channel._id! }, updateData, env.MONGODB_URI, env.MONGODB_DB)

            if (shouldAutoPause) {
              // ✅ FIX: insertOne → notifyOnce (race-proof dedup)
              await notifyOnce({
                message: `⛔ "${channel.channelName}" lagatar ${newErrCount} baar fail hua (handle change ho sakti hai ya YouTube API error) — channel khud-b-khud pause kar diya gaya hai. Check karke resume karo.`,
                channelId: channel.channelId,
                channelName: channel.channelName,
                titleKeyword: '',
                newVideoId: '',
                newVideoTitle: '',
                newVideoUrl: '',
                newPart: 0,
                isRead: false,
                notifType: 'auto_paused',
              } as any, env.MONGODB_URI, env.MONGODB_DB)
            }
          }
        } catch (bookkeepingErr) {
          // ek channel ki DB call fail ho jaye to poora cron run crash na ho —
          // sirf is channel ko error list me daal ke aage badho
          console.error(`Post-process bookkeeping failed for ${channel.channelName}`, bookkeepingErr)
          if (!errorChannels.includes(channel.channelName)) errorChannels.push(channel.channelName)
        }
      }

      // ✅ Guaranteed to run, even if a bookkeeping call failed above
      await insertOne('cronRunLogs', {
        runAt: new Date(),
        channelsChecked: channels.length,
        updatesFound: totalUpdatesFound,
        errorCount: errorChannels.length,
        errorChannels,
        apiUnitsUsed: totalUnitsUsed,
      }, env.MONGODB_URI, env.MONGODB_DB)
    } catch (fatalErr) {
      // ✅ Outer safety net — if even findMany or the entire loop crashes, write a fallback log
      console.error('Scheduled run fatally failed', fatalErr)
      try {
        await insertOne('cronRunLogs', {
          runAt: new Date(),
          channelsChecked: 0,
          updatesFound: 0,
          errorCount: 1,
          errorChannels: ['FATAL: ' + String(fatalErr).slice(0, 200)],
          apiUnitsUsed: 0,
        } as any, env.MONGODB_URI, env.MONGODB_DB)
      } catch {}
    }
  },
}