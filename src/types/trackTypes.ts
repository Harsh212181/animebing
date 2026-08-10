// src/types/trackTypes.ts
export interface TrackedTitle {
  id: string;
  keyword: string;
  lastKnownPart: number;
}

export interface TrackedChannel {
  _id: string;
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelThumbnail?: string;
  paused?: boolean;
  titles: TrackedTitle[];
  consecutiveErrors?: number;
}

export interface Capacity {
  channelsUsed: number;
  channelsLimit: number;
  unitsUsedPerCheck: number;
  unitsLimit: number;
}

export interface TrackNotification {
  _id: string;
  message: string;
  channelId: string;
  channelName: string;
  titleKeyword: string;
  newVideoId: string;
  newVideoTitle: string;
  newVideoUrl: string;
  newThumbnail?: string;
  newPart: number;
  oldVideoId?: string;
  oldVideoTitle?: string;
  oldThumbnail?: string;
  oldPart?: number;
  isRead: boolean;
  createdAt: string;
  notifType?: 'new_episode' | 'season_change' | 'limit_reached' | 'manual_review' | 'needs_approval' | 'auto_paused';
  autoAdded?: boolean;
  linkedDownloadPageId?: string;
  linkedDownloadPageSlug?: string;
  undone?: boolean;
}

export interface RunLog {
  _id: string;
  runAt: string;
  channelsChecked: number;
  updatesFound: number;
  errorCount: number;
  errorChannels?: string[];
}

export interface AnimeOption {
  _id: string;
  title: string;
  thumbnail?: string;
}

export interface PageOption {
  _id: string;
  slug: string;
  title?: string;
  links?: any[];
}

export interface ConflictEntry {
  pageId: string;
  slug: string;
  titles: { channelId: string; channelName: string; titleId: string; keyword: string }[];
}

export interface PreviewVideo {
  videoId: string;
  videoTitle: string;
  description?: string;
  thumbnail: string;
  publishedAt: string;
  part: number | null;
  isRange: boolean;
  rangeStart?: number;
  matchedFormat?: string;
  durationSec?: number | null;
}