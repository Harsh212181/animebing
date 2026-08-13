 import { ObjectId } from 'mongodb'

// ============ ANIME ============
export interface IVote {
  _id?: ObjectId
  ipAddress: string
  voteType: 'like' | 'dislike'
  date: Date
}

export interface IAnime {
  _id?: ObjectId
  title: string
  description?: string
  genreList?: string[]
  releaseYear?: number
  thumbnail?: string
  bannerImage?: string
  contentType: 'Anime' | 'Movie' | 'Manga'
  subDubStatus: 'Hindi Dub' | 'Hindi Sub' | 'English Sub' | 'Both' | 'Subbed' | 'Dubbed' | 'Sub & Dub' | 'Dual Audio'
  status: 'Ongoing' | 'Complete'
  reportCount?: number
  lastReported?: Date
  lastContentAdded?: Date
  featured?: boolean
  featuredOrder?: number
  rating?: number
  totalEpisodes?: number
  currentEpisode?: number
  views?: number
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
  slug?: string
  partnerId?: ObjectId | null
  isHidden?: boolean
  likes?: number
  dislikes?: number
  votes?: IVote[]
  lastLikedDate?: Date
  monthlyLikes?: number
  weeklyLikes?: number
  totalVotes?: number
  isBlocked?: boolean
  createdBy?: string
  createdByUsername?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ EPISODE ============
export interface IDownloadLink {
  _id?: ObjectId
  name: string
  url: string
  quality?: string
  type?: string
}

export interface IEpisode {
  _id?: ObjectId
  animeId: ObjectId
  title: string
  episodeNumber: number
  session?: number
  mainLink?: string
  downloadLinks: IDownloadLink[]
  secureFileReference?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ CHAPTER ============
export interface IChapter {
  _id?: ObjectId
  mangaId: ObjectId
  title: string
  chapterNumber: number
  session?: number
  mainLink?: string
  downloadLinks: IDownloadLink[]
  secureFileReference?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ REPORT ============
export interface IReport {
  _id?: ObjectId
  animeId?: ObjectId
  episodeId?: ObjectId
  episodeNumber?: number
  name?: string
  subject?: string
  message?: string
  issueType?: 'Link Not Working' | 'Wrong Episode' | 'Poor Quality' | 'Audio Issue' | 'Subtitle Issue' | 'Other'
  description?: string
  email?: string
  username?: string
  type?: 'episode' | 'contact'
  userIP?: string
  userAgent?: string
  status?: 'Pending' | 'In Progress' | 'Fixed' | 'Invalid'
  resolvedAt?: Date
  resolvedBy?: ObjectId
  adminResponse?: string
  responseDate?: Date
  createdAt?: Date
  updatedAt?: Date
}

// ============ POLL ============
export interface IPollOption {
  _id?: ObjectId
  title: string
  animeId?: ObjectId | null
  image?: string
  votes?: number
  order?: number
  isCustom?: boolean
}

export interface IVoter {
  deviceId: string
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  votedAt?: Date
  optionId: ObjectId
}

export interface IPoll {
  _id?: ObjectId
  question: string
  options: IPollOption[]
  expiresAt: Date
  isActive?: boolean
  totalVotes?: number
  voters?: IVoter[]
  createdAt?: Date
  updatedAt?: Date
}

// ============ SOCIAL MEDIA ============
export interface ISocialMedia {
  _id?: ObjectId
  platform: 'facebook' | 'instagram' | 'telegram'
  url: string
  isActive?: boolean
  icon?: string
  displayName: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ PARTNER ============
export interface IPartner {
  _id?: ObjectId
  name: string
  createdBy?: string
  createdByUsername?: string
  createdAt?: Date
}

// ============ APP DOWNLOAD ============
export interface IAppDownload {
  _id?: ObjectId
  platform: 'android' | 'ios'
  downloadUrl: string
  isActive?: boolean
  version?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ CONTACT ============
export interface IContact {
  _id?: ObjectId
  name: string
  email: string
  subject: string
  message: string
  status?: 'new' | 'read' | 'replied' | 'email_failed'
  ip?: string
  userAgent?: string
  adminNotes?: string
  repliedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

// ============ DOWNLOAD PAGE ============
export interface IDownloadPageLink {
  episode: number
  episodeStart?: number    
  url: string
  quality?: string
  language?: string
  type?: 'download' | 'watch'
  durationSec?: number    
}

export interface IDownloadPage {
  _id?: ObjectId
  animeId: ObjectId
  slug: string
  title?: string
  episodeNumber?: number
  links: IDownloadPageLink[]
  isHidden?: boolean
  isPrimaryForEpisodeCount?: boolean    
  createdAt?: Date
  updatedAt?: Date
}

// ============ LINK SETTINGS ============
export interface ILinkSettings {
  _id?: ObjectId
  link1: boolean
  link2: boolean
  link3: boolean
  link4: boolean
  link5: boolean
  autoSundayMode?: boolean
  normalState?: {
    link1: boolean
    link2: boolean
    link3: boolean
    link4: boolean
    link5: boolean
  }
  _isSundayApplied?: boolean
  lastUpdated?: Date
  autoModeEnabled?: boolean
  _modeApplied?: boolean
  _activeModeName?: string | null
  specialModeAppliedId?: string
  preModeLink1?: boolean
  preModeLink2?: boolean
  preModeLink3?: boolean
  preModeLink4?: boolean
  preModeLink5?: boolean
}

// ============ ANALYTICS ============
export interface IAnalytics {
  _id?: ObjectId
  date: Date
  pageViews?: number
  uniqueVisitors?: number
  adClicks?: number
  earnings?: number
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  country?: string
  referrer?: string
  browser?: string
  operatingSystem?: string
  visitorIPs?: string[]
  createdAt?: Date
  updatedAt?: Date
}

// ============ SHORT USER PROFILE ============
export interface IShortUserProfile {
  mobile?: string
  gmail?: string
  upiId?: string
  upiPhone?: string
  age?: number
  gender?: 'Male' | 'Female' | 'Other' | ''
}

// ============ SHORT USER ============
export interface IShortUser {
  _id?: ObjectId
  username: string
  password: string
  realName: string
  ratePerThousand: number
  isActive: boolean
  canCreateLinks?: boolean
  totalClicks: number
  totalEarnings: number
  unpaidEarnings: number
  paidEarnings: number
  gmailLinked?: string
  profile?: IShortUserProfile
  avatarId?: number | null
  createdAt?: Date
  updatedAt?: Date
  referralCode?: string
  referredBy?: string
  registrationIp?: string
  createdBy?: 'admin' | 'self'
  createdByAdminId?: string
  createdByAdminUsername?: string
}

// ============ SHORT LINK ============
export interface IShortLink {
  _id?: ObjectId
  code: string
  url: string
  label: string
  userId?: ObjectId
  clicks: number
  todayClicks: number
  lastClicked: Date | null
  createdAt?: Date
  updatedAt?: Date
  createdByAdminId?: string
  createdByAdminUsername?: string
}

// ============ SHORT CLICK ============
export interface IShortClick {
  _id?: ObjectId
  code: string
  userId?: ObjectId
  ip: string
  country?: string
  city?: string
  device?: string
  browser?: string
  referrer?: string
  clickedAt: Date
}

// ============ PAYMENT ============
export interface IPayment {
  _id?: ObjectId
  userId: ObjectId
  username: string
  realName: string
  amount: number
  note?: string
  paidAt: Date
}

// ============ SHORT REQUEST ============
export interface IShortRequest {
  _id?: ObjectId
  userId: ObjectId
  username: string
  realName: string
  type: 'payment' | 'link'
  status: 'pending' | 'done' | 'rejected'
  amount?: number
  profile?: IShortUserProfile
  message?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ SHORT MESSAGE ============
export interface IShortMessage {
  _id?: ObjectId
  userId: ObjectId
  username: string
  realName: string
  text: string
  fromAdmin: boolean
  senderRole?: 'admin' | 'subadmin'
  senderName?: string
  readByAdmin: boolean
  readByUser: boolean
  createdAt?: Date
}

// ============ SHORT USER LOGIN LOG ============
export interface IShortUserLogin {
  _id?: ObjectId
  userId: ObjectId
  username: string
  loginAt: Date
  date: string
}

// ============ REFERRAL TYPES ============
export interface IShortReferral {
  _id?: ObjectId
  referrerId: ObjectId
  referrerUsername: string
  referredId: ObjectId
  referredUsername: string
  referrerReward: number
  referredReward: number
  commissionPercent: number
  status: 'pending' | 'unlocked' | 'flagged'
  referrerRewardCredited: boolean
  referredRewardCredited: boolean
  ip?: string
  createdAt: Date
  unlockedAt?: Date | null
}

// ============ SUB ADMIN ============
export interface ISubAdmin {
  _id?: ObjectId
  username: string
  password: string
  salt: string
  fullName?: string
  permissions: string[]
  animeAccess: 'own' | 'all'
  assignedAnimeIds?: string[]   // 🆕 super admin ne manually assign kiya hua anime
  isBlocked?: boolean
  createdBy?: string
  lastLogin?: Date
  createdAt?: Date
  updatedAt?: Date
}

// ============ ACTIVITY LOG ============
export interface IActivityLog {
  _id?: ObjectId
  actorId: string
  actorUsername: string
  actorRole: 'admin' | 'subadmin'
  action: string
  targetType?: string
  targetId?: string
  targetTitle?: string
  createdAt?: Date
}

// ============ ANIME LINK CONTROL ============
export interface IAnimeLinkControl {
  _id?: ObjectId
  name: string
  animeIds: string[]
  link1: boolean
  link2: boolean
  link3: boolean
  link4: boolean
  createdBy?: string
  createdByUsername?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============ SPECIAL MODE ============
export interface ISpecialMode {
  _id?: ObjectId
  name: string
  type: 'weekday' | 'dateRange'
  weekday?: number        
  weekdays?: number[]     
  startDate?: Date
  endDate?: Date
  bannerText?: string
  isEnabled: boolean
  forceLink5Only?: boolean
  createdAt?: Date
  updatedAt?: Date
}

// ============ NOTE ============
export interface INote {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  labels: string[];
  checklist?: { text: string; checked: boolean }[];
  reminder?: string;
  createdBy: string;
  visibility: "private" | "shared";
  createdAt: string;
  updatedAt: string;
}

// ============ TRACKED TITLE (inside channel) ============
export interface ITrackedTitle {
  id: string
  keyword: string
  lastKnownPart: number
  lastKnownVideoId?: string
  lastKnownVideoTitle?: string
  lastKnownThumbnail?: string
  lastKnownPublishedAt?: string

  lastKnownSeason?: number | null
  lastBlockedVideoId?: string

  linkedAnimeId?: string | null
  linkedDownloadPageId?: string | null
  episodeLimit?: number | null

  lastKnownIsRange?: boolean
  mergeMode?: boolean

  baselineEpisodeDurationSec?: number

  initialized?: boolean
  approvalNotified?: boolean           
  lastApprovalNotifiedAt?: string      
  noFormatSeenIds?: string[]           
  ignoredVideoIds?: string[]
  matchThreshold?: number
  excludeKeywords?: string[]
  flaggedVideoIds?: string[]
  strictChronology?: boolean
  chronologyFloorDate?: string
  chronologyGraceGap?: number
}

// ============ TRACKED CHANNEL (YouTube tracker) ============
export interface ITrackedChannel {
  _id?: ObjectId
  channelId: string
  channelName: string
  channelHandle: string
  channelThumbnail?: string
  uploadsPlaylistId: string
  titles: ITrackedTitle[]
  paused?: boolean
  createdBy?: string
  createdByUsername?: string
  createdAt?: Date
  updatedAt?: Date

  consecutiveErrors?: number

  // ✅ NEW — naya title add hote hi ye defaults auto-apply hon
  defaultStrictChronology?: boolean
  defaultChronologyGraceGap?: number
}

// ============ TRACK NOTIFICATION (Updates Feed) ============
export interface ITrackNotification {
  _id?: ObjectId
  message: string
  channelId: string
  channelName: string
  titleKeyword: string
  newVideoId: string
  newVideoTitle: string
  newVideoUrl: string
  newThumbnail?: string
  newPart: number
  oldVideoId?: string
  oldVideoTitle?: string
  oldThumbnail?: string
  oldPart?: number
  isRead: boolean
  createdAt?: Date

  notifType?: 'new_episode' | 'season_change' | 'limit_reached' | 'manual_review' | 'needs_approval' | 'auto_paused'
  autoAdded?: boolean
  linkedDownloadPageId?: string
  linkedDownloadPageSlug?: string

  suggestedRangeStart?: number
  suggestedRangeEnd?: number
  suggestedDurationMin?: number

  // ✅ NEW — why this became a manual_review notification
  reviewReason?: 'duration' | 'chronology' | 'description' | 'unparseable'

  // ✅ NEW — fuzzy match confidence (0-1) for this video, when relevant
  matchScore?: number

  removedOldLink?: {
    episode: number
    episodeStart?: number
    url: string
    type?: string
    quality?: string
    language?: string
  } | null
  undone?: boolean
}

// ============ CRON RUN LOG ============
export interface ICronRunLog {
  _id?: ObjectId
  runAt: Date
  channelsChecked: number
  updatesFound: number
  errorCount: number
  errorChannels?: string[]
  // ✅ NEW — approximate total YouTube API quota units consumed this run
  apiUnitsUsed?: number
}

// ============ CHECK LOG (diagnostic) ============
export interface ICheckLogTitleEntry {
  keyword: string
  matchedVideoCount: number
  entries: {
    videoTitle: string
    videoId: string
    part: number | null
    isRange: boolean
    matchedFormat?: string
    action: 'added' | 'replaced' | 'already-known' | 'no-format-detected' | 'season-blocked' | 'limit-blocked'
      | 'chronology-suspicious' | 'description-unconfirmed' | 'reuploaded' | 'needs-approval' | 'chronology-floor-blocked'
    matchScore?: number
  }[]
}

export interface ICheckLog {
  _id?: ObjectId
  runAt: Date
  channelId: string
  channelName: string
  totalRecentVideos: number
  titles: ICheckLogTitleEntry[]
}

// ============ SHORTENER CLICK VERIFICATION SETTINGS ============
export interface IShortenerClickSettings {
  _id?: ObjectId
  requireFullCycle: boolean
  sessionExpiryMinutes: number
  minDwellSeconds: number          // 🆕 anti-bot minimum time on anime page
  updatedAt?: Date
}

// ============ CLICK SESSION (funnel/anti-fraud tracker) ============
export interface IClickSession {
  _id?: ObjectId
  code: string
  linkId: ObjectId
  userId?: ObjectId | null
  ip: string
  userAgent?: string
  animeId?: string
  stage: 'started' | 'anime_viewed' | 'completed'
  createdAt: Date
  expiresAt: Date
  animeViewedAt?: Date | null      // 🆕 dwell-time check ke liye
  completedAt?: Date | null
  ipMismatch?: boolean             // 🆕 suspicious flag
}