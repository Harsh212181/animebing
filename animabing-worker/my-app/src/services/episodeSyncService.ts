 import { getContentGroup } from '../utils/contentGroup'
import { getDb, toObjectId } from './mongoService'

// ============ Download Page ke links se anime.currentEpisode sync (page ID se) ============
export async function syncAnimeEpisodeCountFromPage(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const page = await db.collection('downloadpages').findOne({ _id: toObjectId(downloadPageId) })
  if (!page || !page.animeId) return null

  return syncAnimeEpisodeCountFromAnime(page.animeId, mongoUri, dbName)
}
export async function syncAnimeEpisodeCountFromAnime(
  animeId: any,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const animeObjectId = typeof animeId === 'string' ? toObjectId(animeId) : animeId

  // ✅ NEW — pehle current value nikaal lo taaki compare kar sakein
  const currentAnime = await db.collection('animes').findOne(
    { _id: animeObjectId },
    { projection: { currentEpisode: 1 } }
  )
  const previousEpisode = currentAnime?.currentEpisode ?? 0

  const allPages = await db.collection('downloadpages')
    .find({ animeId: animeObjectId })
    .toArray()
  const primaryPages = allPages.filter((p: any) => p.isPrimaryForEpisodeCount === true)
  const pagesToUse = primaryPages.length > 0 ? primaryPages : allPages

  let maxEpisode = 0
  pagesToUse.forEach((p: any) => {
    ;(p.links || []).forEach((link: any) => {
      if (typeof link.episode === 'number' && link.episode > maxEpisode) {
        maxEpisode = link.episode
      }
    })
  })

  // ✅ FIX — sirf tab update karo jab value actually badli ho, taaki
  // lastContentAdded galat trigger na ho aur NEW badge sahi rahe
  if (maxEpisode !== previousEpisode) {
    await db.collection('animes').updateOne(
      { _id: animeObjectId },
      { $set: { currentEpisode: maxEpisode, lastContentAdded: new Date() } }
    )
  }

  return maxEpisode
}

// ✅ FIXED — ab yeh function sirf actual links ke numbers (episode / episodeStart) se
// range nikalta hai. "Starting Episode Number (reference only)" field ab title
// calculation ko override NAHI karega — jaisa UI pe likha hai waisa hi behavior hoga.
function computeEpisodeRangeTitle(page: any, label: 'Episode' | 'Chapter'): string {
  const links = page?.links || []
  const nums: number[] = []
  links.forEach((l: any) => {
    if (typeof l.episodeStart === 'number') nums.push(l.episodeStart)
    if (typeof l.episode === 'number') nums.push(l.episode)
  })
  if (nums.length === 0) return ''

  const min = Math.min(...nums)
  const max = Math.max(...nums)

  return min === max ? `${label} ${min}` : `${label} ${min}-${max}`
}

export async function syncEpisodeTitleFromDownloadPage(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const page = await db.collection('downloadpages').findOne({ _id: toObjectId(downloadPageId) })
  if (!page || !page.animeId) return
  const anime = await db.collection('animes').findOne(
    { _id: page.animeId },
    { projection: { contentType: 1 } }
  )
  const isManga = getContentGroup(anime?.contentType) === 'chapter'
  const collectionName = isManga ? 'chapters' : 'episodes'
  const numberField = isManga ? 'chapterNumber' : 'episodeNumber'
  const label: 'Episode' | 'Chapter' = isManga ? 'Chapter' : 'Episode'

  // Is anime ke saare download pages — creation order (_id) se sorted
  const allPages = await db.collection('downloadpages')
    .find({ animeId: page.animeId })
    .sort({ _id: 1 })
    .toArray()

  const position = allPages.findIndex((p: any) => p._id.toString() === downloadPageId)
  if (position === -1) return
  const targetIdField = isManga ? 'mangaId' : 'animeId'
  const allTargetItems = await db.collection(collectionName)
    .find({ [targetIdField]: page.animeId })
    .sort({ session: 1, [numberField]: 1 })
    .toArray()

  const targetItem = allTargetItems[position]
  if (!targetItem) return // Utna episode/chapter record abhi Manager mein bana hi nahi
  const rangeTitle = computeEpisodeRangeTitle(page, label)
  if (!rangeTitle) return

  // ✅ sahi collection mein update karo
  await db.collection(collectionName).updateOne(
    { _id: targetItem._id },
    { $set: { title: rangeTitle, updatedAt: new Date() } }
  )
}
export async function syncPageDerivedData(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const newCount = await syncAnimeEpisodeCountFromPage(downloadPageId, mongoUri, dbName)
  await syncEpisodeTitleFromDownloadPage(downloadPageId, mongoUri, dbName)
  return newCount
}