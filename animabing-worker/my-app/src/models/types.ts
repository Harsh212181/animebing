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
  url: string
  quality?: string
  language?: string
  type?: 'download' | 'watch'
}

export interface IDownloadPage {
  _id?: ObjectId
  animeId: ObjectId
  slug: string
  title?: string
  episodeNumber?: number
  links: IDownloadPageLink[]
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
  totalClicks: number
  totalEarnings: number
  unpaidEarnings: number
  paidEarnings: number
  // Gmail OAuth login support
  gmailLinked?: string        // linked gmail address
  profile?: IShortUserProfile
  createdAt?: Date
  updatedAt?: Date
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
  // Payment request fields
  amount?: number
  profile?: IShortUserProfile
  // Link request fields
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
  readByAdmin: boolean
  readByUser: boolean
  createdAt?: Date
}