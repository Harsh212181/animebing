import { getDb } from './mongoService'

function getISTDateStr(d: Date = new Date()): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000
  return new Date(d.getTime() + IST_OFFSET).toISOString().slice(0, 10)
}

// ⚠️ analyticsService.ts wali classifyReferrer() se sync mein rakhein
function classifyReferrer(referrer?: string): string {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (/google\./i.test(host)) return 'Google'
    if (/bing\./i.test(host)) return 'Bing'
    if (/yahoo\./i.test(host)) return 'Yahoo'
    if (/duckduckgo\./i.test(host)) return 'DuckDuckGo'
    if (/facebook\.|fb\.com/i.test(host)) return 'Facebook'
    if (/instagram\./i.test(host)) return 'Instagram'
    if (/twitter\.|x\.com/i.test(host)) return 'Twitter / X'
    if (/t\.me|telegram/i.test(host)) return 'Telegram'
    if (/reddit\./i.test(host)) return 'Reddit'
    if (/youtube\./i.test(host)) return 'YouTube'
    if (/animabingwatch\.workers\.dev|animabing/i.test(host)) return 'Internal'
    return host
  } catch { return 'Direct' }
}

export interface IDailyPageStat {
  date: string
  uniqueIps: string[]
  totalViews: number
  byType: { type: string; views: number }[]
  byDevice: { device: string; count: number }[]
  byCountry: { country: string; views: number }[]
  byBrowser: { browser: string; count: number }[]
  byReferrer: { source: string; views: number }[]
  byHour: number[] // 24 buckets, IST hour
  timeOnPage: { pageType: string; sumSeconds: number; samples: number }[]
  topPaths: { path: string; views: number; pageType: string; animeTitle?: string; slug?: string }[]
  notFoundPaths: { path: string; views: number; referrer: string | null }[]
  createdAt: Date
  updatedAt: Date
}

// ✅ Ek (IST) din ka pageviews data aggregate karke dailyPageStats mein
// upsert karta hai. Fir 7+ din purane (aur already-rolled-up) raw pageviews
// delete kar deta hai — Funnel/Link Journey ke liye last 7 din ka raw zinda rehta hai.
export async function aggregateAndPrunePageviewDay(
  mongoUri: string, dbName: string, dateStr?: string, rawRetentionDays = 7
): Promise<{ date: string; aggregated: boolean }> {
  const db = await getDb(mongoUri, dbName)
  const target = dateStr || getISTDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const match = { date: target }

  const totalViews = await db.collection('pageviews').countDocuments(match)
  if (totalViews === 0) {
    await prunePageviewsOlderThan(db, rawRetentionDays)
    return { date: target, aggregated: false }
  }

  const uniqueIps: string[] = await db.collection('pageviews').distinct('ip', match)

  const byType = await db.collection('pageviews').aggregate([
    { $match: match }, { $group: { _id: '$pageType', views: { $sum: 1 } } },
  ]).toArray()

  const byDevice = await db.collection('pageviews').aggregate([
    { $match: match }, { $group: { _id: { $ifNull: ['$device', 'unknown'] }, count: { $sum: 1 } } },
  ]).toArray()

  const byCountryRaw = await db.collection('pageviews').aggregate([
    { $match: match }, { $group: { _id: '$country', views: { $sum: 1 } } },
  ]).toArray()
  const byCountry = byCountryRaw.filter((c: any) => c._id && c._id !== 'XX')

  const byBrowser = await db.collection('pageviews').aggregate([
    { $match: match }, { $group: { _id: { $ifNull: ['$browser', 'Other'] }, count: { $sum: 1 } } },
  ]).toArray()

  const referrerDocs = await db.collection('pageviews').aggregate([
    { $match: match }, { $project: { referrer: 1 } }, { $limit: 50000 },
  ]).toArray()
  const refCounts = new Map<string, number>()
  for (const r of referrerDocs) {
    const src = classifyReferrer(r.referrer)
    refCounts.set(src, (refCounts.get(src) || 0) + 1)
  }
  const byReferrer = Array.from(refCounts.entries()).map(([source, views]) => ({ source, views }))

  const IST_OFFSET = 5.5 * 60 * 60 * 1000
  const hourAgg = await db.collection('pageviews').aggregate([
    { $match: match },
    { $project: { istHour: { $hour: { $add: ['$timestamp', IST_OFFSET] } } } },
    { $group: { _id: '$istHour', views: { $sum: 1 } } },
  ]).toArray()
  const byHour = new Array(24).fill(0)
  for (const h of hourAgg) byHour[h._id] = h.views

  const timeOnPageAgg = await db.collection('pageviews').aggregate([
    { $match: { ...match, timeOnPage: { $exists: true, $gt: 0, $lt: 3600 } } },
    { $group: { _id: '$pageType', sumSeconds: { $sum: '$timeOnPage' }, samples: { $sum: 1 } } },
  ]).toArray()

  // ✅ pageview_daily pehle se hi per-path daily rollup hai — reuse karo, dobara aggregate mat karo
  const topPaths = await db.collection('pageview_daily').find({ date: target }).sort({ views: -1 }).limit(100).toArray()

  const notFoundAgg = await db.collection('pageviews').aggregate([
    { $match: { ...match, pageType: 'not-found' } },
    { $group: { _id: '$path', views: { $sum: 1 }, referrer: { $first: '$referrer' } } },
    { $sort: { views: -1 } }, { $limit: 30 },
  ]).toArray()

  const now = new Date()
  await db.collection('dailyPageStats').updateOne(
    { date: target },
    {
      $set: {
        date: target, uniqueIps, totalViews,
        byType: byType.map((t: any) => ({ type: t._id, views: t.views })),
        byDevice: byDevice.map((d: any) => ({ device: d._id, count: d.count })),
        byCountry: byCountry.map((c: any) => ({ country: c._id, views: c.views })),
        byBrowser: byBrowser.map((b: any) => ({ browser: b._id, count: b.count })),
        byReferrer, byHour,
        timeOnPage: timeOnPageAgg.map((t: any) => ({ pageType: t._id, sumSeconds: t.sumSeconds, samples: t.samples })),
        topPaths: topPaths.map((p: any) => ({ path: p.path, views: p.views, pageType: p.pageType, animeTitle: p.animeTitle, slug: p.slug })),
        notFoundPaths: notFoundAgg.map((n: any) => ({ path: n._id, views: n.views, referrer: n.referrer || null })),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )

  await prunePageviewsOlderThan(db, rawRetentionDays)
  return { date: target, aggregated: true }
}

async function prunePageviewsOlderThan(db: any, days: number) {
  const cutoff = getISTDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  // ✅ sirf wahi din delete karo jinka rollup ban chuka hai — kabhi bhi
  // un-aggregated data delete nahi hoga, chahe kitna bhi purana ho
  const rolledUpDates: string[] = await db.collection('dailyPageStats').distinct('date', { date: { $lt: cutoff } })
  if (rolledUpDates.length === 0) return
  await db.collection('pageviews').deleteMany({ date: { $in: rolledUpDates } })
}

// ✅ [fromDateStr, toDateExclusiveStr) ke saare dailyPageStats docs combine karta hai
export async function getPageRollupForRange(mongoUri: string, dbName: string, fromDateStr: string, toDateExclusiveStr: string) {
  const db = await getDb(mongoUri, dbName)
  const docs = await db.collection('dailyPageStats').find({
    date: { $gte: fromDateStr, $lt: toDateExclusiveStr }
  }).toArray() as unknown as IDailyPageStat[]

  const ipSet = new Set<string>()
  let totalViews = 0
  const typeMap: Record<string, number> = {}
  const deviceMap: Record<string, number> = {}
  const countryMap: Record<string, number> = {}
  const browserMap: Record<string, number> = {}
  const referrerMap: Record<string, number> = {}
  const hourTotals = new Array(24).fill(0)
  const timeOnPageMap: Record<string, { sumSeconds: number; samples: number }> = {}
  const pathMap: Record<string, { path: string; views: number; pageType: string; animeTitle?: string; slug?: string }> = {}
  const notFoundMap: Record<string, { path: string; views: number; referrer: string | null }> = {}
  const dailyIpSets: { date: string; ips: string[] }[] = []

  for (const d of docs) {
    totalViews += d.totalViews || 0
    for (const ip of d.uniqueIps || []) ipSet.add(ip)
    dailyIpSets.push({ date: d.date, ips: d.uniqueIps || [] })
    for (const t of d.byType || []) typeMap[t.type] = (typeMap[t.type] || 0) + t.views
    for (const dv of d.byDevice || []) deviceMap[dv.device] = (deviceMap[dv.device] || 0) + dv.count
    for (const c of d.byCountry || []) countryMap[c.country] = (countryMap[c.country] || 0) + c.views
    for (const b of d.byBrowser || []) browserMap[b.browser] = (browserMap[b.browser] || 0) + b.count
    for (const r of d.byReferrer || []) referrerMap[r.source] = (referrerMap[r.source] || 0) + r.views
    for (let h = 0; h < 24; h++) hourTotals[h] += (d.byHour || [])[h] || 0
    for (const t of d.timeOnPage || []) {
      if (!timeOnPageMap[t.pageType]) timeOnPageMap[t.pageType] = { sumSeconds: 0, samples: 0 }
      timeOnPageMap[t.pageType].sumSeconds += t.sumSeconds
      timeOnPageMap[t.pageType].samples += t.samples
    }
    for (const p of d.topPaths || []) {
      if (!pathMap[p.path]) pathMap[p.path] = { ...p, views: 0 }
      pathMap[p.path].views += p.views
    }
    for (const n of d.notFoundPaths || []) {
      if (!notFoundMap[n.path]) notFoundMap[n.path] = { ...n, views: 0 }
      notFoundMap[n.path].views += n.views
    }
  }

  return {
    totalViews,
    uniqueIps: Array.from(ipSet),
    dailyIpSets, // ✅ new-vs-returning ke liye day-wise IP lists
    byType: Object.entries(typeMap).map(([type, views]) => ({ type, views })),
    byDevice: Object.entries(deviceMap).map(([device, count]) => ({ device, count })),
    byCountry: Object.entries(countryMap).map(([country, views]) => ({ country, views })),
    byBrowser: Object.entries(browserMap).map(([browser, count]) => ({ browser, count })),
    byReferrer: Object.entries(referrerMap).map(([source, views]) => ({ source, views })),
    byHour: hourTotals,
    timeOnPage: Object.entries(timeOnPageMap).map(([pageType, v]) => ({ pageType, ...v })),
    topPaths: Object.values(pathMap).sort((a, b) => b.views - a.views),
    notFoundPaths: Object.values(notFoundMap).sort((a, b) => b.views - a.views),
    dailyChart: docs.map(d => ({ date: d.date, views: d.totalViews })).sort((a, b) => a.date.localeCompare(b.date)),
  }
}