import { withDb } from './mongoService'
import { trackPageViewDb } from './analyticsService'
import { isForceLink5ModeActive } from '../routes/specialModeRoutes'

export async function handlePageviewBatch(batch: MessageBatch<any>, env: any, ctx?: ExecutionContext) {
  const started = Date.now()
  try {
    await withDb(env.MONGODB_URI, env.MONGODB_DB, 'pvBatch', async (db) => {
      const ls: any = (await db.collection('linksettings').findOne({})) || {}
      const countEveryView = ls.countEveryView === true
      const dedupeWindowSec = typeof ls.dedupeWindowSec === 'number' ? ls.dedupeWindowSec : 86400
      const link5Active = ls.link5 !== false
      let forcing: boolean | null = null

      const handleView = async (msg: Message<any>) => {
        const d = msg.body.data
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
        await trackPageViewDb(db, d, earningContext, new Date(msg.body.at))
      }

      const handleTime = async (msg: Message<any>) => {
        const m = msg.body
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
      }

      const run = async (msg: Message<any>, fn: (m: Message<any>) => Promise<void>) => {
        try { await fn(msg); msg.ack() }
        catch (e) { console.error('[pvBatch] message failed:', e); msg.retry() }
      }

      const views = batch.messages.filter(m => m.body?.kind === 'view')
      const times = batch.messages.filter(m => m.body?.kind === 'time')
      batch.messages.filter(m => m.body?.kind !== 'view' && m.body?.kind !== 'time').forEach(m => m.ack())

      // 1) views: sequential (dedupe safe), time guard ke saath
      for (const msg of views) {
        if (Date.now() - started > 18000) { msg.retry(); continue }
        await run(msg, handleView)
      }

      // 2) time updates: parallel (views ke baad, taaki pageview doc pehle bane)
      await Promise.all(times.map(msg => {
        if (Date.now() - started > 22000) { msg.retry(); return }
        return run(msg, handleTime)
      }))
    }, 25000, 5)   // 👈 pool size 5
  } catch (e) {
    console.error('[pvBatch] batch failed:', e)
    batch.retryAll()
  }
}