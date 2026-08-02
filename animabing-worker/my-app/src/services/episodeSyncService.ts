import { getDb, toObjectId } from './mongoService'

// ============ Download Page ke links se anime.currentEpisode sync ============
export async function syncAnimeEpisodeCountFromPage(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const page = await db.collection('downloadpages').findOne({ _id: toObjectId(downloadPageId) })
  if (!page || !page.animeId) return

  // Is anime ke saare download pages nikaalo
  const allPages = await db.collection('downloadpages')
    .find({ animeId: page.animeId })
    .toArray()

  // Sabhi pages ke sabhi links mein se sabse bada episode number nikaalo
  let maxEpisode = 0
  allPages.forEach((p: any) => {
    ;(p.links || []).forEach((link: any) => {
      if (typeof link.episode === 'number' && link.episode > maxEpisode) {
        maxEpisode = link.episode
      }
    })
  })

  if (maxEpisode > 0) {
    await db.collection('animes').updateOne(
      { _id: page.animeId },
      { $set: { currentEpisode: maxEpisode, lastContentAdded: new Date() } }
    )
  }
}

// ============ Download Page ke links se Episode record ka Title auto-sync ============
function computeEpisodeRangeTitle(links: any[]): string {
  const nums: number[] = []
  ;(links || []).forEach((l: any) => {
    if (typeof l.episodeStart === 'number') nums.push(l.episodeStart)
    if (typeof l.episode === 'number') nums.push(l.episode)
  })
  if (nums.length === 0) return ''
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return min === max ? `Episode ${min}` : `Episode ${min}-${max}`
}

export async function syncEpisodeTitleFromDownloadPage(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)

  const page = await db.collection('downloadpages').findOne({ _id: toObjectId(downloadPageId) })
  if (!page || !page.animeId) return

  // Is anime ke saare download pages — creation order (_id) se sorted
  const allPages = await db.collection('downloadpages')
    .find({ animeId: page.animeId })
    .sort({ _id: 1 })
    .toArray()

  const position = allPages.findIndex((p: any) => p._id.toString() === downloadPageId)
  if (position === -1) return

  // Is anime ke saare episode records — episodeNumber se sorted
  const allEpisodes = await db.collection('episodes')
    .find({ animeId: page.animeId })
    .sort({ session: 1, episodeNumber: 1 })
    .toArray()

  const targetEpisode = allEpisodes[position]
  if (!targetEpisode) return // Utna episode record abhi Episode Manager mein bana hi nahi

  const rangeTitle = computeEpisodeRangeTitle(page.links || [])
  if (!rangeTitle) return

  await db.collection('episodes').updateOne(
    { _id: targetEpisode._id },
    { $set: { title: rangeTitle, updatedAt: new Date() } }
  )
}