 // ============================================================
// animabing-worker/my-app/src/services/youtubeCheckService.ts
// ============================================================

import { ITrackedChannel, ITrackedTitle, ITrackNotification, ICheckLog } from '../models/types'
import { findOne, updateOne, insertOne, toObjectId } from './mongoService'
import { syncAnimeEpisodeCountFromPage } from './episodeSyncService'

interface YouTubeVideoItem {
  videoId: string
  title: string
  publishedAt: string
  thumbnail: string
  description: string
}

// ============ ✅ NEW — API quota tracking ============
// Caller creates { units: 0 } and passes it in; we bump it on every YouTube
// API call so the total can be stored in cronRunLogs.apiUnitsUsed.
export interface QuotaTracker {
  units: number
}
function addUnits(tracker: QuotaTracker | undefined, n: number) {
  if (tracker) tracker.units += n
}

// ============ ✅ NEW — retry with backoff for transient YouTube API failures ============
// A single 5xx/429/network blip used to fail the whole channel check and push
// it toward auto-pause. Now we retry a couple of times with a short delay.
async function fetchWithRetry(url: string, retries = 2, delayMs = 600): Promise<Response> {
  let lastErr: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

// ============ Channel Info Fetch ============
export async function fetchChannelInfoByHandle(
  handle: string,
  apiKey: string,
  quotaTracker?: QuotaTracker
): Promise<{ channelId: string; channelName: string; channelThumbnail: string; uploadsPlaylistId: string } | null> {
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`
  const res = await fetchWithRetry(url)
  addUnits(quotaTracker, 1)
  const data: any = await res.json()
  const channel = data.items?.[0]
  if (!channel) return null
  return {
    channelId: channel.id,
    channelName: channel.snippet.title,
    channelThumbnail: channel.snippet.thumbnails?.default?.url || '',
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  }
}

// ============ Recent Videos (paginated) ============
export async function fetchRecentVideos(
  uploadsPlaylistId: string,
  apiKey: string,
  maxResults = 50,
  quotaTracker?: QuotaTracker
): Promise<YouTubeVideoItem[]> {
  const results: YouTubeVideoItem[] = []
  let pageToken: string | undefined

  do {
    const pageSize = Math.min(50, maxResults - results.length)
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${pageSize}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetchWithRetry(url)
    addUnits(quotaTracker, 1)
    const data: any = await res.json()
    if (!data.items || data.items.length === 0) break
    for (const item of data.items) {
      results.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        description: item.snippet.description || '',
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken && results.length < maxResults)

  return results
}

// ============ Video Durations (batch) ============
export async function fetchVideoDurations(
  videoIds: string[],
  apiKey: string,
  quotaTracker?: QuotaTracker
): Promise<Record<string, number>> {
  if (videoIds.length === 0) return {}
  const map: Record<string, number> = {}
  // ✅ FIX — YouTube videos.list API max 50 IDs per call leta hai, isliye chunks me batao
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${apiKey}`
    const res = await fetchWithRetry(url)
    addUnits(quotaTracker, 1)
    const data: any = await res.json()
    for (const item of data.items || []) {
      map[item.id] = parseISODuration(item.contentDetails?.duration || 'PT0S')
    }
  }
  return map
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const h = parseInt(m[1] || '0', 10)
  const min = parseInt(m[2] || '0', 10)
  const s = parseInt(m[3] || '0', 10)
  return h * 3600 + min * 60 + s
}

// ============ Part / Range Extraction ============
interface PartInfo {
  part: number | null
  isRange: boolean
  rangeStart?: number
  matchedFormat?: string
}

function extractPartInfo(title: string): PartInfo {
  let m = title.match(/\[\s*(\d+)\s*-\s*(\d+)\s*\]/)
  if (m) return { part: parseInt(m[2], 10), isRange: true, rangeStart: parseInt(m[1], 10), matchedFormat: 'bracket-range [1-5]' }

  m = title.match(/\[\s*0*(\d+)\s*\]/)
  if (m) return { part: parseInt(m[1], 10), isRange: false, matchedFormat: 'bracket-single [12]' }

  m = title.match(/^\s*\(\s*0*(\d+)\s*\)/)
  if (m) return { part: parseInt(m[1], 10), isRange: false, matchedFormat: 'paren-start (12)' }

  // ✅ NEW — leading plus-separated compilation range: "61+62)", "(15+16+17)"
  m = title.match(/^\s*\(?\s*((?:0*\d+\s*\+\s*)+0*\d+)\s*\)?/)
  if (m) {
    const nums = m[1].split('+').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n))
    if (nums.length >= 2) {
      return { part: nums[nums.length - 1], isRange: true, rangeStart: nums[0], matchedFormat: 'leading-plus-range (15+16+17))' }
    }
  }

  // ✅ NEW — leading "116)" style: number directly followed by a closing
  // paren at the very start of the title, no opening "(" required.
  // Anchored to ^ so it only matches when the number leads the title —
  // safe against false positives from random numbers mid-title.
  m = title.match(/^\s*0*(\d+)\s*\)/)
  if (m) return { part: parseInt(m[1], 10), isRange: false, matchedFormat: 'leading-number-paren (12))' }

  m = title.match(/(?:part|episode|ep|chapter)s?\s*0*(\d+)\s*-\s*0*(\d+)/i)
  if (m) return { part: parseInt(m[2], 10), isRange: true, rangeStart: parseInt(m[1], 10), matchedFormat: 'word-range (Episode 1-5)' }

  m = title.match(/(?:part|episode|ep|chapter)s?\s*0*(\d+)/i)
  if (m) return { part: parseInt(m[1], 10), isRange: false, matchedFormat: 'word-single (Episode 12)' }

  m = title.match(/#\s*0*(\d+)/)
  if (m) return { part: parseInt(m[1], 10), isRange: false, matchedFormat: 'hash (#12)' }

  m = title.match(/(?<!\d)(\d{1,4})\s*-\s*(\d{1,4})(?!\d)/)
  if (m) return { part: parseInt(m[2], 10), isRange: true, rangeStart: parseInt(m[1], 10), matchedFormat: 'bare-range (1-5, no bracket)' }

  return { part: null, isRange: false }
}

// ============ Season Extraction ============
function extractSeasonNumber(title: string): number | null {
  const seasonWordMatch = title.match(/season\s*0*(\d+)/i)
  if (seasonWordMatch) return parseInt(seasonWordMatch[1], 10)
  const ordinalMatch = title.match(/(\d+)(?:st|nd|rd|th)\s*season/i)
  if (ordinalMatch) return parseInt(ordinalMatch[1], 10)
  const sShortMatch = title.match(/\bS0*(\d+)\b/)
  if (sShortMatch) return parseInt(sShortMatch[1], 10)
  return null
}

// ============ Fuzzy Keyword Match ============
// ✅ CHANGED — default threshold, but callers can pass their own per-title
const DEFAULT_KEYWORD_MATCH_THRESHOLD = 0.7

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()\[\]#:.,!?"'\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^\d+$/.test(w))
}

function keywordMatchScore(keyword: string, title: string): number {
  const keywordWords = normalizeWords(keyword)
  if (keywordWords.length === 0) return 0
  const titleWords = new Set(normalizeWords(title))
  let matched = 0
  for (const w of keywordWords) {
    if (titleWords.has(w)) matched++
  }
  return matched / keywordWords.length
}

// ============ ✅ Shared Matching Function (browse UI + auto-check + test-match preview) ============
export interface ParsedVideoItem {
  video: YouTubeVideoItem
  part: number | null
  isRange: boolean
  rangeStart?: number
  matchedFormat?: string
  season: number | null
  // ✅ NEW — fuzzy match confidence (0-1), kept instead of discarded
  matchScore: number
  // ✅ NEW — true if the part number came from the description, not the title
  // (less reliable — random numbers in descriptions can false-positive)
  fromDescription: boolean
}

export interface MatchOptions {
  threshold?: number
  excludeKeywords?: string[]
}

export function matchAndParseVideos(
  recentVideos: YouTubeVideoItem[],
  keyword: string,
  ignoredIds: string[] = [],
  options: MatchOptions = {}
): ParsedVideoItem[] {
  const threshold = options.threshold ?? DEFAULT_KEYWORD_MATCH_THRESHOLD
  const excludeList = (options.excludeKeywords || [])
    .map(k => k.trim().toLowerCase())
    .filter(Boolean)

  const scored = recentVideos
    .filter(v => !ignoredIds.includes(v.videoId))
    // ✅ NEW — exclusion keywords filter out unwanted matches (reactions, AMVs, etc.)
    .filter(v => !excludeList.some(ex => v.title.toLowerCase().includes(ex)))
    .map(v => ({ video: v, score: keywordMatchScore(keyword, v.title) }))

  const matched = scored.filter(x => x.score >= threshold)

  return matched.map(({ video: v, score }) => {
    let info = extractPartInfo(v.title)
    let fromDescription = false
    if (info.part === null && v.description) {
      const descInfo = extractPartInfo(v.description)
      if (descInfo.part !== null) {
        info = { ...descInfo, matchedFormat: `${descInfo.matchedFormat || ''} (description se mila)` }
        fromDescription = true
      }
    }
    const season = extractSeasonNumber(v.title)
    return { video: v, ...info, season, matchScore: Math.round(score * 100) / 100, fromDescription }
  }).sort((a, b) => {
    if (a.part === null && b.part === null) return 0
    if (a.part === null) return 1
    if (b.part === null) return -1
    return a.part - b.part
  })
}

// ============ ✅ NEW — scan depth defaults ============
const INITIAL_SCAN_DEPTH = 1500   // pehli baar / preview ke liye (approval se pehle)
const TRACKED_SCAN_DEPTH = 50     // ek baar initialized ho jaye, normal checks isi se chalti hain

// ============ ✅ Ek title ke saare matched videos fetch karo (browse/approval UI ke liye) ============
// ✅ CHANGED — ab poora ITrackedTitle leta hai taaki threshold/excludeKeywords bhi use ho sakein
export async function fetchAllVideosForTitle(
  channel: ITrackedChannel,
  title: ITrackedTitle,
  apiKey: string,
  quotaTracker?: QuotaTracker,
  scanDepth?: number   // ✅ CHANGED — optional, na diya toh auto-decide hoga
): Promise<ParsedVideoItem[]> {
  // ✅ NEW — agar caller ne depth nahi diya, title ke status se decide karo
  const depth = scanDepth ?? (title.initialized ? TRACKED_SCAN_DEPTH : INITIAL_SCAN_DEPTH)
  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, apiKey, depth, quotaTracker)
  return matchAndParseVideos(recentVideos, title.keyword, title.ignoredVideoIds || [], {
    threshold: title.matchThreshold,
    excludeKeywords: title.excludeKeywords,
  })
}

export interface ProcessedUpdate {
  titleId: string
  keyword: string
  newPart: number
  newVideoId: string
  newVideoTitle: string
  newThumbnail: string
  newPublishedAt: string
  oldVideoId?: string
  oldVideoTitle?: string
  oldThumbnail?: string
  oldPart?: number
  notifType: 'new_episode' | 'season_change' | 'limit_reached' | 'manual_review' | 'needs_approval'
  autoAdded: boolean
  replaced: boolean
  linkedDownloadPageId?: string
  linkedDownloadPageSlug?: string
  removedOldLink?: any
  // ✅ NEW — why a manual_review notification was raised
  reviewReason?: 'duration' | 'chronology' | 'description'
  matchScore?: number
}

// ✅ NEW — how much earlier than the previous known video a "newer" episode
// is allowed to be published before we treat it as suspicious (fuzzy match
// probably grabbed the wrong video).
const CHRONOLOGY_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000 // 2 days grace

// ============ ✅ MAIN — check + auto-add/replace + notify + log + approval-gate ============
export async function processChannelUpdates(
  channel: ITrackedChannel,
  apiKey: string,
  mongoUri: string,
  dbName: string,
  quotaTracker?: QuotaTracker
): Promise<ProcessedUpdate[]> {
  if (channel.paused) return []

  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, apiKey, 50, quotaTracker)
  const results: ProcessedUpdate[] = []
  const updatedTitles: ITrackedTitle[] = []
  let titlesChanged = false
  const logTitles: ICheckLog['titles'] = []

  for (const trackedTitle of channel.titles) {
    const logEntry: ICheckLog['titles'][number] = {
      keyword: trackedTitle.keyword,
      matchedVideoCount: 0,
      entries: [],
    }

    const parsedAll = matchAndParseVideos(recentVideos, trackedTitle.keyword, trackedTitle.ignoredVideoIds || [], {
      threshold: trackedTitle.matchThreshold,
      excludeKeywords: trackedTitle.excludeKeywords,
    })
    logEntry.matchedVideoCount = parsedAll.length

    // ---------- ✅ FIRST-TIME APPROVAL GATE ----------
    const distinctParts = new Set(parsedAll.filter(p => p.part !== null).map(p => p.part))
    const isInitialized = trackedTitle.initialized === true || distinctParts.size <= 1

    if (!isInitialized) {
      // ✅ PATCH — jab matches hon par approval pending ho, log me dikhao
      if (parsedAll.length > 0) {
        logEntry.entries.push({
          videoTitle: `${parsedAll.length} video(s) matched — approval pending, Track List Manager me jaake approve karo`,
          videoId: '',
          part: null,
          isRange: false,
          action: 'needs-approval',
          matchScore: parsedAll[0]?.matchScore,
        })
      }

      if (!trackedTitle.approvalNotified) {
        await insertOne('trackNotifications', {
          message: `${channel.channelName} — "${trackedTitle.keyword}" me ${distinctParts.size} episodes/parts mile hain! Pehle inhe approve karo — Track List Manager ke "All Titles" section me jaake anime/page select karo.`,
          channelId: channel.channelId,
          channelName: channel.channelName,
          titleKeyword: trackedTitle.keyword,
          newVideoId: parsedAll[0]?.video.videoId || '',
          newVideoTitle: parsedAll[0]?.video.title || '',
          newVideoUrl: parsedAll[0] ? `https://youtube.com/watch?v=${parsedAll[0].video.videoId}` : '',
          newThumbnail: parsedAll[0]?.video.thumbnail,
          newPart: 0,
          isRead: false,
          notifType: 'needs_approval',
        } as ITrackNotification, mongoUri, dbName)

        updatedTitles.push({ ...trackedTitle, approvalNotified: true })
        titlesChanged = true
      } else {
        updatedTitles.push(trackedTitle)
      }
      logTitles.push(logEntry)
      continue
    }

    const parsed = parsedAll

    for (const p of parsed) {
      if (p.part === null) {
        logEntry.entries.push({
          videoTitle: p.video.title, videoId: p.video.videoId, part: null, isRange: false,
          action: 'no-format-detected', matchScore: p.matchScore,
        })
      }
    }

    // ✅ CHANGED — split into reliable (title-based) vs description-based parts.
    // Description-based ones are NOT auto-added anymore (feature #8) —
    // they go into a manual-review queue instead.
    const reliableWithPart = parsed.filter((x): x is typeof x & { part: number } => x.part !== null && !x.fromDescription)
    const descriptionWithPart = parsed.filter((x): x is typeof x & { part: number } => x.part !== null && x.fromDescription)

    const newOnes = reliableWithPart.filter(p => p.part > trackedTitle.lastKnownPart)

    for (const p of reliableWithPart.filter(p => p.part <= trackedTitle.lastKnownPart)) {
      logEntry.entries.push({
        videoTitle: p.video.title, videoId: p.video.videoId, part: p.part, isRange: p.isRange,
        matchedFormat: p.matchedFormat, action: 'already-known', matchScore: p.matchScore,
      })
    }

    const alreadyFlagged = new Set(trackedTitle.flaggedVideoIds || [])
    const newFlaggedIds: string[] = []

    // ---------- ✅ Duration-fallback (manual review suggestion) ----------
    const stillNoNumber = parsed.filter(p => p.part === null)
    const durationSuggestions: { video: YouTubeVideoItem; suggestedStart: number; suggestedEnd: number; durationMin: number }[] = []
    if (stillNoNumber.length > 0 && trackedTitle.baselineEpisodeDurationSec) {
      const durations = await fetchVideoDurations(stillNoNumber.map(p => p.video.videoId), apiKey, quotaTracker)
      for (const p of stillNoNumber) {
        const dur = durations[p.video.videoId]
        if (!dur) continue
        const estCount = Math.max(1, Math.round(dur / trackedTitle.baselineEpisodeDurationSec))
        const suggestedStart = trackedTitle.lastKnownPart + 1
        const suggestedEnd = trackedTitle.lastKnownPart + estCount
        if (p.video.videoId !== trackedTitle.lastKnownVideoId) {
          durationSuggestions.push({ video: p.video, suggestedStart, suggestedEnd, durationMin: Math.round(dur / 60) })
        }
      }
    }

    let prevVideoId = trackedTitle.lastKnownVideoId
    let prevVideoTitle = trackedTitle.lastKnownVideoTitle
    let prevThumbnail = trackedTitle.lastKnownThumbnail
    let prevPublishedAt = trackedTitle.lastKnownPublishedAt
    let prevPart = trackedTitle.lastKnownPart
    let curSeason: number | null = trackedTitle.lastKnownSeason ?? null
    let curIsRange: boolean = trackedTitle.lastKnownIsRange ?? false
    let lastBlockedVideoId = trackedTitle.lastBlockedVideoId
    let mutated = false

    let pageDoc: any = null
    let pageLinksLocal: any[] = []
    let pageChanged = false
    if (trackedTitle.linkedAnimeId && trackedTitle.linkedDownloadPageId) {
      pageDoc = await findOne<any>('downloadpages', { _id: toObjectId(trackedTitle.linkedDownloadPageId) }, mongoUri, dbName)
      if (pageDoc) pageLinksLocal = [...(pageDoc.links || [])]
    }

    for (const item of newOnes) {
      // ---------- SEASON CHANGE GUARD ----------
      if (curSeason !== null && item.season !== null && item.season !== curSeason) {
        if (lastBlockedVideoId !== item.video.videoId) {
          results.push({
            titleId: trackedTitle.id, keyword: trackedTitle.keyword,
            newPart: item.part, newVideoId: item.video.videoId, newVideoTitle: item.video.title,
            newThumbnail: item.video.thumbnail, newPublishedAt: item.video.publishedAt,
            oldVideoId: prevVideoId, oldVideoTitle: prevVideoTitle, oldThumbnail: prevThumbnail, oldPart: prevPart || undefined,
            notifType: 'season_change', autoAdded: false, replaced: false, matchScore: item.matchScore,
          })
          logEntry.entries.push({
            videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
            matchedFormat: item.matchedFormat, action: 'season-blocked', matchScore: item.matchScore,
          })
          lastBlockedVideoId = item.video.videoId
          mutated = true
        }
        break
      }

      // ---------- ✅ NEW — CHRONOLOGY SANITY CHECK ----------
      // Agar "naya" part number wala video, publish date me purane known
      // video se kaafi purana hai — likely fuzzy match galat video pakad
      // raha hai. Auto-add skip karo, sirf ek baar flag/notify karo.
      if (prevPublishedAt) {
        const prevTime = new Date(prevPublishedAt).getTime()
        const curTime = new Date(item.video.publishedAt).getTime()
        if (!Number.isNaN(prevTime) && !Number.isNaN(curTime) && curTime < prevTime - CHRONOLOGY_TOLERANCE_MS) {
          if (!alreadyFlagged.has(item.video.videoId) && !newFlaggedIds.includes(item.video.videoId)) {
            results.push({
              titleId: trackedTitle.id, keyword: trackedTitle.keyword,
              newPart: item.part, newVideoId: item.video.videoId, newVideoTitle: item.video.title,
              newThumbnail: item.video.thumbnail, newPublishedAt: item.video.publishedAt,
              notifType: 'manual_review', autoAdded: false, replaced: false,
              reviewReason: 'chronology', matchScore: item.matchScore,
            })
            logEntry.entries.push({
              videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
              matchedFormat: item.matchedFormat, action: 'chronology-suspicious', matchScore: item.matchScore,
            })
            newFlaggedIds.push(item.video.videoId)
            mutated = true
          }
          continue // skip auto-add, don't update prevXxx — re-evaluated next run unless flagged
        }
      }

      let autoAdded = false
      let replaced = false
      let linkedSlug: string | undefined
      let removedOldLink: any = null

      if (pageDoc) {
        const newUrl = `https://youtube.com/watch?v=${item.video.videoId}`
        const exactUrlExists = pageLinksLocal.some((l: any) => l.url === newUrl)

        if (exactUrlExists) {
          logEntry.entries.push({
            videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
            matchedFormat: item.matchedFormat, action: 'already-known', matchScore: item.matchScore,
          })
        } else {
          // ---------- ✅ NEW — RE-UPLOAD / DUPLICATE-EPISODE DETECTION ----------
          // Same episode number already on the page (non-range), lekin video
          // ID alag hai (channel ne re-upload kiya, audio fix, etc.) — purana
          // link replace karo instead of dono ko rakhna.
          const reuploadMatch = !item.isRange
            ? pageLinksLocal.find((l: any) => l.type === 'watch' && l.episode === item.part && l.episodeStart === undefined)
            : undefined

          if (reuploadMatch) {
            removedOldLink = reuploadMatch
            pageLinksLocal = pageLinksLocal.filter((l: any) => l !== reuploadMatch)
            pageLinksLocal.push({
              episode: item.part,
              episodeStart: undefined,
              url: newUrl,
              type: 'watch',
              quality: '',
              language: '',
            })
            pageChanged = true
            autoAdded = true
            replaced = true
            linkedSlug = pageDoc.slug
            logEntry.entries.push({
              videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
              matchedFormat: item.matchedFormat, action: 'reuploaded', matchScore: item.matchScore,
            })
          } else {
            const watchCount = pageLinksLocal.filter((l: any) => l.type === 'watch').length
            const limit = trackedTitle.episodeLimit || 0
            const mergeMode = trackedTitle.mergeMode !== false

            const willReplace = mergeMode && item.isRange && curIsRange && !!prevVideoId
            const willExceedLimit = !willReplace && limit > 0 && watchCount >= limit

            if (willExceedLimit) {
              if (lastBlockedVideoId !== item.video.videoId) {
                results.push({
                  titleId: trackedTitle.id, keyword: trackedTitle.keyword,
                  newPart: item.part, newVideoId: item.video.videoId, newVideoTitle: item.video.title,
                  newThumbnail: item.video.thumbnail, newPublishedAt: item.video.publishedAt,
                  oldVideoId: prevVideoId, oldVideoTitle: prevVideoTitle, oldThumbnail: prevThumbnail, oldPart: prevPart || undefined,
                  notifType: 'limit_reached', autoAdded: false, replaced: false,
                  linkedDownloadPageId: trackedTitle.linkedDownloadPageId!, linkedDownloadPageSlug: pageDoc.slug,
                  matchScore: item.matchScore,
                })
                logEntry.entries.push({
                  videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
                  matchedFormat: item.matchedFormat, action: 'limit-blocked', matchScore: item.matchScore,
                })
                lastBlockedVideoId = item.video.videoId
                mutated = true
              }
              break
            }

            const newLink = {
              episode: item.part,
              episodeStart: item.isRange ? item.rangeStart : undefined,
              url: newUrl,
              type: 'watch',
              quality: '',
              language: '',
            }

            if (willReplace) {
              const oldUrl = `https://youtube.com/watch?v=${prevVideoId}`
              removedOldLink = pageLinksLocal.find((l: any) => l.type === 'watch' && l.url === oldUrl) || null
              const beforeLen = pageLinksLocal.length
              pageLinksLocal = pageLinksLocal.filter((l: any) => !(l.type === 'watch' && l.url === oldUrl))
              replaced = pageLinksLocal.length < beforeLen
              pageLinksLocal.push(newLink)
            } else {
              pageLinksLocal.push(newLink)
            }
            pageChanged = true
            autoAdded = true
            linkedSlug = pageDoc.slug

            logEntry.entries.push({
              videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
              matchedFormat: item.matchedFormat, action: replaced ? 'replaced' : 'added', matchScore: item.matchScore,
            })
          }
        }
      } else {
        logEntry.entries.push({
          videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
          matchedFormat: item.matchedFormat, action: 'added', matchScore: item.matchScore,
        })
      }

      results.push({
        titleId: trackedTitle.id, keyword: trackedTitle.keyword,
        newPart: item.part, newVideoId: item.video.videoId, newVideoTitle: item.video.title,
        newThumbnail: item.video.thumbnail, newPublishedAt: item.video.publishedAt,
        oldVideoId: prevVideoId, oldVideoTitle: prevVideoTitle, oldThumbnail: prevThumbnail, oldPart: prevPart || undefined,
        notifType: 'new_episode', autoAdded, replaced,
        linkedDownloadPageId: trackedTitle.linkedDownloadPageId || undefined,
        linkedDownloadPageSlug: linkedSlug,
        removedOldLink: replaced ? removedOldLink : undefined,
        matchScore: item.matchScore,
      })

      prevVideoId = item.video.videoId
      prevVideoTitle = item.video.title
      prevThumbnail = item.video.thumbnail
      prevPublishedAt = item.video.publishedAt
      prevPart = item.part
      if (item.season !== null) curSeason = item.season
      curIsRange = item.isRange
      lastBlockedVideoId = undefined
      mutated = true
    }

    // ---------- ✅ NEW — description-based parts: manual review only, never auto-added ----------
    const descriptionNewOnes = descriptionWithPart.filter(
      p => p.part > trackedTitle.lastKnownPart && !alreadyFlagged.has(p.video.videoId) && !newFlaggedIds.includes(p.video.videoId)
    )
    for (const item of descriptionNewOnes) {
      results.push({
        titleId: trackedTitle.id, keyword: trackedTitle.keyword,
        newPart: item.part, newVideoId: item.video.videoId, newVideoTitle: item.video.title,
        newThumbnail: item.video.thumbnail, newPublishedAt: item.video.publishedAt,
        notifType: 'manual_review', autoAdded: false, replaced: false,
        reviewReason: 'description', matchScore: item.matchScore,
      })
      logEntry.entries.push({
        videoTitle: item.video.title, videoId: item.video.videoId, part: item.part, isRange: item.isRange,
        matchedFormat: item.matchedFormat, action: 'description-unconfirmed', matchScore: item.matchScore,
      })
      newFlaggedIds.push(item.video.videoId)
      mutated = true
    }

    // ---------- Duration-suggestions ko log/notification me daalo ----------
    for (const sug of durationSuggestions) {
      results.push({
        titleId: trackedTitle.id, keyword: trackedTitle.keyword,
        newPart: sug.suggestedEnd, newVideoId: sug.video.videoId, newVideoTitle: sug.video.title,
        newThumbnail: sug.video.thumbnail, newPublishedAt: sug.video.publishedAt,
        notifType: 'manual_review', autoAdded: false, replaced: false, reviewReason: 'duration',
      })
      logEntry.entries.push({
        videoTitle: sug.video.title, videoId: sug.video.videoId, part: null, isRange: true,
        matchedFormat: `duration-estimate: ${sug.durationMin}min ÷ baseline ≈ Episode ${sug.suggestedStart}-${sug.suggestedEnd} (CONFIRM MANUALLY)`,
        action: 'no-format-detected',
      })
    }

    if (pageChanged && pageDoc) {
      await updateOne('downloadpages', { _id: pageDoc._id }, { links: pageLinksLocal }, mongoUri, dbName)

      if (trackedTitle.linkedAnimeId) {
        try {
          await updateOne('animes', { _id: toObjectId(trackedTitle.linkedAnimeId) }, { lastContentAdded: new Date() }, mongoUri, dbName)
        } catch {
          // silent — non-critical
        }
      }
    }

    // ✅ NEW — sync anime episode counts after page changed (pageId chahiye, animeId nahi)
    if (trackedTitle.linkedDownloadPageId) {
      try {
        await syncAnimeEpisodeCountFromPage(trackedTitle.linkedDownloadPageId, mongoUri, dbName)
      } catch {
        // silent
      }
    }

    // ✅ NEW — merge in newly flagged video IDs regardless of whether the
    // page itself changed, so we don't spam the same manual_review notif
    // on every future run.
    const mergedFlaggedIds = newFlaggedIds.length > 0
      ? Array.from(new Set([...(trackedTitle.flaggedVideoIds || []), ...newFlaggedIds]))
      : trackedTitle.flaggedVideoIds

    updatedTitles.push(
      mutated
        ? {
            ...trackedTitle,
            initialized: true,
            lastKnownPart: prevPart,
            lastKnownVideoId: prevVideoId,
            lastKnownVideoTitle: prevVideoTitle,
            lastKnownThumbnail: prevThumbnail,
            lastKnownPublishedAt: prevPublishedAt,
            lastKnownSeason: curSeason,
            lastKnownIsRange: curIsRange,
            lastBlockedVideoId,
            flaggedVideoIds: mergedFlaggedIds,
          }
        : { ...trackedTitle, initialized: true }
    )
    if (mutated) titlesChanged = true

    logTitles.push(logEntry)
  }

  if (titlesChanged) {
    await updateOne('trackedChannels', { _id: channel._id! }, { titles: updatedTitles }, mongoUri, dbName)
  }

  // ---------- Notifications ----------
  for (const r of results) {
    let message = ''
    if (r.notifType === 'manual_review') {
      if (r.reviewReason === 'chronology') {
        message = `${channel.channelName} — "${r.keyword}" ke liye ek video mila (Part ${r.newPart}) jiski publish date purani lagti hai. Ho sakta hai ye video galat match hua ho — kripya khud check karo.`
      } else if (r.reviewReason === 'description') {
        message = `${channel.channelName} — "${r.keyword}" ka Part ${r.newPart} sirf VIDEO DESCRIPTION se detect hua hai (title me number nahi tha). Confirm karke manually add karo — auto-add nahi kiya gaya.`
      } else {
        message = `${channel.channelName} — "${r.keyword}" ka naya video mila jiske title/description me episode number nahi hai. Video kholke check karo aur MANUALLY add karo.`
      }
    } else if (r.notifType === 'season_change') {
      message = `${channel.channelName} — "${r.keyword}" ka naya Season mil gaya hai! Naya page banao ya naya anime add karo.`
    } else if (r.notifType === 'limit_reached') {
      message = `${channel.channelName} — "${r.keyword}" ke linked page ki episode limit reach ho gayi hai! Limit badhao ya naya page banao.`
    } else if (r.replaced) {
      message = `${channel.channelName} — "${r.keyword}" ka updated link (part ${r.newPart}) mil gaya, purana link replace ho gaya ✅`
    } else {
      message = `${channel.channelName} — "${r.keyword}" ka naya part (${r.newPart}) aa gaya hai!${r.autoAdded ? ' (Watch section me automatically add ho gaya ✅)' : ''}`
    }

    await insertOne('trackNotifications', {
      message,
      channelId: channel.channelId,
      channelName: channel.channelName,
      titleKeyword: r.keyword,
      newVideoId: r.newVideoId,
      newVideoTitle: r.newVideoTitle,
      newVideoUrl: `https://youtube.com/watch?v=${r.newVideoId}`,
      newThumbnail: r.newThumbnail,
      newPart: r.newPart,
      oldVideoId: r.oldVideoId,
      oldVideoTitle: r.oldVideoTitle,
      oldThumbnail: r.oldThumbnail,
      oldPart: r.oldPart,
      isRead: false,
      notifType: r.notifType,
      autoAdded: r.autoAdded,
      linkedDownloadPageId: r.linkedDownloadPageId,
      linkedDownloadPageSlug: r.linkedDownloadPageSlug,
      removedOldLink: r.removedOldLink || null,
      undone: false,
      reviewReason: r.reviewReason,
      matchScore: r.matchScore,
    } as ITrackNotification, mongoUri, dbName)
  }

  await insertOne('checkLogs', {
    runAt: new Date(),
    channelId: channel.channelId,
    channelName: channel.channelName,
    totalRecentVideos: recentVideos.length,
    titles: logTitles,
  } as ICheckLog, mongoUri, dbName)

  return results
}