import { withDb } from './mongoService'
import { trackPageViewDb } from './analyticsService'
import { isForceLink5ModeActive } from '../routes/specialModeRoutes'

export async function handlePageviewBatch(batch: MessageBatch<any>, env: any, ctx?: ExecutionContext) {
  try {
    await withDb(env.MONGODB_URI, env.MONGODB_DB, 'pvBatch', async (db) => {
      // Settings poore batch ke liye SIRF EK BAAR
      const ls: any = (await db.collection('linksettings').findOne({})) || {}
      const countEveryView = ls.countEveryView === true
      const dedupeWindowSec = typeof ls.dedupeWindowSec === 'number' ? ls.dedupeWindowSec : 86400
      const link5Active = ls.link5 !== false
      let forcing: boolean | null = null // lazily, sirf download events ke liye

      for (const msg of batch.messages) {
        try {
          const m: any = msg.body

          if (m.kind === 'time') {
            const filter: any = {
              path: m.path,
              timestamp: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
            }
            if (m.sessionId) filter.sessionId = m.sessionId
            else if (m.visitorId) filter.visitorId = m.visitorId
            else { filter.ip = m.ip; filter.userAgent = m.userAgent }

            await db.collection('pageviews').findOneAndUpdate(
              filter,
              { $set: { timeOnPage: m.seconds, timeOnPageUpdatedAt: new Date() } },
              { sort: { timestamp: -1 } }
            )
          } else if (m.kind === 'view') {
            const d = m.data
            let earningContext: any
            if (['download', 'anime-detail', 'episode'].includes(d.pageType)) {
              let specialModeForcing = false
              if (d.pageType === 'download') {
                if (forcing === null) {
                  forcing = await isForceLink5ModeActive(env.MONGODB_URI, env.MONGODB_DB, db)
                }
                specialModeForcing = forcing
              }
              earningContext = {
                link5Active: d.pageType === 'download' ? link5Active : false,
                specialModeForcing,
                countEveryView,
                dedupeWindowSec,
              }
            }
            await trackPageViewDb(db, d, earningContext, new Date(m.at), env.MONGODB_URI, env.MONGODB_DB)
          }
          msg.ack()
        } catch (e) {
          console.error('[pvBatch] message failed:', e)
          msg.retry()
        }
      }
    }, 25000)
  } catch (e) {
    console.error('[pvBatch] batch failed:', e)
    batch.retryAll()
  }
}