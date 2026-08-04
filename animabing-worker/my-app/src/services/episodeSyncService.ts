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

// ============ ✅ NEW — seedha animeId se currentEpisode recalculate karo.
// Page DELETE hone ke baad ye use hota hai (kyunki delete hone ke baad us page ki
// ID se dobara query nahi ho sakti). Har baar SCRATCH se maxEpisode calculate karta
// hai (poore anime ke saare bache hue pages ke links se) — isliye:
//   - naya link add ho → currentEpisode badhta hai
//   - koi page/link delete ho → currentEpisode automatically ghat jaata hai
// ============
export async function syncAnimeEpisodeCountFromAnime(
  animeId: any,
  mongoUri: string,
  dbName: string
) {
  const db = await getDb(mongoUri, dbName)
  const animeObjectId = typeof animeId === 'string' ? toObjectId(animeId) : animeId

  const allPages = await db.collection('downloadpages')
    .find({ animeId: animeObjectId })
    .toArray()

  let maxEpisode = 0
  allPages.forEach((p: any) => {
    ;(p.links || []).forEach((link: any) => {
      if (typeof link.episode === 'number' && link.episode > maxEpisode) {
        maxEpisode = link.episode
      }
    })
  })

  // ✅ Chahe maxEpisode 0 ho (sab kuch delete ho chuka ho), phir bhi update karo —
  // isse anime.currentEpisode kabhi purani badi value mein atka nahi rahega
  await db.collection('animes').updateOne(
    { _id: animeObjectId },
    { $set: { currentEpisode: maxEpisode, lastContentAdded: new Date() } }
  )

  return maxEpisode
}

// ============ Download Page ke links se Episode/Chapter record ka Title auto-sync ============
// ✅ FIXED: Ab sirf current links ke min-max se range nahi banta.
// Purane links prune/remove hone ke baad bhi (jab "Starting Episode Number"
// field ko reference ke taur pe kisi bhi number pe rakha ho), range title
// hamesha `${Starting Ep}-${max link}` banega — isse "1-19" jaisa purana
// title kabhi "stuck" nahi rahega, agle links add hone pe khud "1-20",
// "1-21" waghera me sahi update hota rahega.
function computeEpisodeRangeTitle(page: any, label: 'Episode' | 'Chapter'): string {
  const links = page?.links || []
  const nums: number[] = []
  links.forEach((l: any) => {
    if (typeof l.episodeStart === 'number') nums.push(l.episodeStart)
    if (typeof l.episode === 'number') nums.push(l.episode)
  })
  if (nums.length === 0) return ''

  const maxFromLinks = Math.max(...nums)
  const minFromLinks = Math.min(...nums)

  // ✅ "Starting Episode Number" field ko range ka START maano (agar set hai aur valid hai)
  const startRef = typeof page?.episodeNumber === 'number' && page.episodeNumber > 0
    ? page.episodeNumber
    : minFromLinks

  // Safety: agar startRef kisi wajah se max se bada ho jaaye, to swap kar do
  const min = Math.min(startRef, maxFromLinks)
  const max = Math.max(startRef, maxFromLinks)

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

  // ✅ anime ka contentType check karo — manga ke liye 'chapters',
  // baaki (Anime/Movie) ke liye 'episodes' collection use karni hai
  const anime = await db.collection('animes').findOne(
    { _id: page.animeId },
    { projection: { contentType: 1 } }
  )
  const isManga = anime?.contentType === 'Manga'
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

  // ✅ sahi collection + sahi number field se sort karo
  const allTargetItems = await db.collection(collectionName)
    .find({ animeId: page.animeId })
    .sort({ session: 1, [numberField]: 1 })
    .toArray()

  const targetItem = allTargetItems[position]
  if (!targetItem) return // Utna episode/chapter record abhi Manager mein bana hi nahi

  // ✅ FIX: pehle sirf `page.links` (ek array) pass ho raha tha, jiski wajah se
  // computeEpisodeRangeTitle ke andar `page?.links` hamesha undefined aata tha
  // (kyunki array ke upar .links property nahi hoti) — isliye rangeTitle hamesha
  // '' return karta tha aur title kabhi update nahi hota tha.
  // Ab poora `page` object pass ho raha hai taaki links + episodeNumber dono sahi milein.
  const rangeTitle = computeEpisodeRangeTitle(page, label)
  if (!rangeTitle) return

  // ✅ sahi collection mein update karo
  await db.collection(collectionName).updateOne(
    { _id: targetItem._id },
    { $set: { title: rangeTitle, updatedAt: new Date() } }
  )
}

// ============ ✅ NEW — COMBINED SYNC HELPER ============
// Jahan bhi 'downloadpages' collection ke kisi document ka `links` array
// add/update/remove/undo hota hai, sirf isi ek function ko call karo.
//
// Ye ek saath do cheezein sync karta hai:
//   1. syncAnimeEpisodeCountFromPage → anime.currentEpisode (banner ka "Ch X"/"EP X" badge)
//   2. syncEpisodeTitleFromDownloadPage → Episode/Chapter record ka range-title ("Episode 1-20")
//
// Isse guarantee milta hai ki chahe link Download Page Manager se manually add ho,
// ya Track List Manager se bulk-add/quick-bulk-add se ho, ya YouTube auto-tracker se
// ho, ya undo kiya jaaye — dono jagah (badge + title) hamesha ek saath, sahi sync
// honge. Alag-alag jagah do function calls yaad rakhne ki zaroorat khatam.
// ============
export async function syncPageDerivedData(
  downloadPageId: string,
  mongoUri: string,
  dbName: string
) {
  const newCount = await syncAnimeEpisodeCountFromPage(downloadPageId, mongoUri, dbName)
  await syncEpisodeTitleFromDownloadPage(downloadPageId, mongoUri, dbName)
  return newCount
}