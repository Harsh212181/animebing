 import { ITrackedChannel, ITrackedTitle } from '../models/types'

interface YouTubeVideoItem {
  videoId: string
  title: string
  publishedAt: string
}

// ============ Channel Info Fetch (sirf channel add karte waqt 1 baar chalta hai) ============
export async function fetchChannelInfoByHandle(
  handle: string,
  apiKey: string
): Promise<{ channelId: string; channelName: string; uploadsPlaylistId: string } | null> {
  // handle ke aage @ na ho to add kar do (YouTube API isse expect karta hai)
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`
  const res = await fetch(url)
  const data: any = await res.json()

  const channel = data.items?.[0]
  if (!channel) return null

  return {
    channelId: channel.id,
    channelName: channel.snippet.title,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  }
}

// ============ Uploads Playlist Se Recent Videos Nikalna (sasta method, ~1-2 units) ============
export async function fetchRecentVideos(
  uploadsPlaylistId: string,
  apiKey: string,
  maxResults = 50
): Promise<YouTubeVideoItem[]> {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`
  const res = await fetch(url)
  const data: any = await res.json()

  if (!data.items) return []

  return data.items.map((item: any) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
  }))
}

// ============ Ek Channel Ke Saare Tracked Titles Check Karna ============
// Har title-keyword ke liye recent videos me se match dhoondta hai aur
// agar naya part number mile (lastKnownPart se bada), to update return karta hai.
export interface TitleUpdateResult {
  title: ITrackedTitle
  newPart: number
  videoId: string
  videoTitle: string
}

export async function checkChannelForUpdates(
  channel: ITrackedChannel,
  apiKey: string
): Promise<TitleUpdateResult[]> {
  const recentVideos = await fetchRecentVideos(channel.uploadsPlaylistId, apiKey)
  const updates: TitleUpdateResult[] = []

  for (const trackedTitle of channel.titles) {
    const keywordLower = trackedTitle.keyword.toLowerCase()

    // Sirf wahi videos jinke title me keyword match kare
    const matchingVideos = recentVideos.filter(v =>
      v.title.toLowerCase().includes(keywordLower)
    )

    let bestPart = trackedTitle.lastKnownPart
    let bestVideo: YouTubeVideoItem | null = null

    for (const video of matchingVideos) {
      // Title me se number nikalo — "Part 4", "Episode 4", "Ep 4", "#4" jaise patterns
      const match = video.title.match(/(?:part|episode|ep|chapter)\s*0*(\d+)/i)
                 || video.title.match(/#\s*0*(\d+)/)
      if (!match) continue

      const partNumber = parseInt(match[1], 10)
      if (partNumber > bestPart) {
        bestPart = partNumber
        bestVideo = video
      }
    }

    if (bestVideo && bestPart > trackedTitle.lastKnownPart) {
      updates.push({
        title: trackedTitle,
        newPart: bestPart,
        videoId: bestVideo.videoId,
        videoTitle: bestVideo.title,
      })
    }
  }

  return updates
}