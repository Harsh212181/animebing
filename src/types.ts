 // src/types.ts – COMPLETE UPDATED VERSION WITH DEVICE-BASED POLL VOTING
/* =========================
   DOWNLOAD / EPISODE / CHAPTER
========================= */

export interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

export interface Episode {
  episodeId?: string;
  _id?: string;
  episodeNumber: number;
  title: string;
  downloadLinks: DownloadLink[];
  secureFileReference?: string;
  session?: number;
  // ✅ ADDED: Main link for admin internal use only
  mainLink?: string;
}

export interface Chapter {
  chapterId?: string;
  _id?: string;
  chapterNumber: number;
  title: string;
  downloadLinks: DownloadLink[];
  secureFileReference?: string;
  session?: number;
  // ✅ ADDED: Main link for admin internal use only
  mainLink?: string;
}

/* =========================
   LIKE/DISLIKE VOTE TYPES
========================= */

export interface Vote {
  ipAddress: string;
  voteType: 'like' | 'dislike';
  date: Date | string;
}

/* =========================
   ANIME TYPES
========================= */

export type SubDubStatus =
  | 'Hindi Dub'
  | 'Hindi Sub'
  | 'English Sub'
  | 'Both'
  | 'Subbed'
  | 'Dubbed'
  | 'Sub & Dub'
  | 'Dual Audio';

export type FilterType = 'All' | SubDubStatus;
export type ContentType = 'Anime' | 'Movie' | 'Manga';
export type ContentTypeFilter = 'All' | ContentType;

export interface Anime {
  _id: string;
  id?: string;
  title: string;
  thumbnail?: string;
  posterImage?: string;
  coverImage?: string;
  bannerImage?: string; // ✅ For carousel/featured display
  releaseYear?: number;
  subDubStatus: SubDubStatus;
  contentType: ContentType;
  genreList?: string[];
  genres?: string[];
  description?: string;
  status?: string;
  episodes?: Episode[];
  chapters?: Chapter[];
  reportCount?: number;
  lastReported?: string;
  totalSessions?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  createdAt?: string;
  updatedAt?: string;

  /* ✅ LIKE/DISLIKE SYSTEM FIELDS */
  likes?: number;
  dislikes?: number;
  votes?: Vote[];
  lastLikedDate?: Date | string;
  monthlyLikes?: number;
  weeklyLikes?: number;
  totalVotes?: number;

  /* SEO */
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  slug?: string;

  /* Optional */
  language?: string;
  rating?: number;
  views?: number;
  episodeCount?: number;
  totalEpisodes?: number;
  lastContentAdded?: Date | string;

  /* ✅ NEW: Partner association (Partner Manager) */
  partnerId?: string | null;
}

export interface FeaturedAnime extends Anime {
  featuredOrder: number;
}

/* =========================
   TOP 100 ANIME TYPES
========================= */

export interface TopAnimeParams {
  type?: 'all-time' | 'monthly' | 'weekly';
  contentType?: ContentTypeFilter;
  page?: number;
  limit?: number;
}

export interface TopAnimeItem {
  _id: string;
  title: string;
  thumbnail?: string;
  bannerImage?: string;
  likes: number;
  dislikes: number;
  monthlyLikes?: number;
  weeklyLikes?: number;
  contentType?: ContentType;
  slug?: string;
  rating?: number;
  totalVotes?: number;
}

export interface AnimeStats {
  totalAnime: number;
  totalLikes: number;
  totalVotes: number;
}

/* =========================
   ANIME API RESPONSE TYPES
========================= */

export interface AnimeResponse {
  success: boolean;
  data?: Anime;
  message?: string;
  likes?: number;
  dislikes?: number;
  userVote?: 'like' | 'dislike' | null;
}

export interface VoteResponse {
  success: boolean;
  message?: string;
  likes?: number;
  dislikes?: number;
  userVote?: 'like' | 'dislike' | null;
}

/* =========================
   SOCIAL / REPORT
========================= */

export interface SocialMedia {
  platform: string;
  url: string;
  isActive: boolean;
  icon: string;
  displayName: string;
}

export interface Report {
  _id?: string;
  animeId: string;
  episodeId?: string;
  episodeNumber?: number;
  issueType: string;
  description?: string;
  status: 'Pending' | 'Fixed' | 'Invalid';
  createdAt?: string;
  anime?: Anime;
}

/* =========================
   ADMIN EDIT TYPES
========================= */

export interface EditEpisodeData {
  title?: string;
  downloadLinks?: DownloadLink[];
  secureFileReference?: string;
  session?: number;
  // ✅ ADDED: Main link for admin edit
  mainLink?: string;
}

export interface EditChapterData {
  title?: string;
  downloadLinks?: DownloadLink[];
  secureFileReference?: string;
  session?: number;
  // ✅ ADDED: Main link for admin edit
  mainLink?: string;
}

export interface SEODetails {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  slug: string;
}

/* =====================================================
   ✅ POLL SYSTEM (FRONTEND + BACKEND SYNCED)
===================================================== */

export interface PollOption {
  _id: string;
  animeId?: string;
  title: string;

  /* ✅ BOTH SUPPORTED */
  image?: string;          // backend generic
  thumbnailUrl?: string;   // frontend usage

  votes: number;
  percentage?: number;
  order?: number;
  isCustom?: boolean;
  createdAt?: string;
  anime?: Anime;
}

// Device type for poll voting
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

// Voter information for tracking – now uses deviceId and deviceType
export interface VoterInfo {
  deviceId: string;        // ✅ Changed from ip to deviceId
  deviceType: DeviceType;  // ✅ NEW: device type (phone, tablet, PC)
  votedAt: string;
  optionId: string;
}

export interface Poll {
  _id: string;
  question: string;
  description?: string;
  options: PollOption[];
  isActive: boolean;
  totalVotes: number;
  
  // ✅ Voters tracking
  votersCount?: number;              // Number of unique voters
  voters?: VoterInfo[];             // Array of voter information (admin only)
  
  // ✅ User voting status (frontend only)
  userHasVoted?: boolean;           // Whether current user has voted
  userVoteOption?: string;          // Option ID that user voted for
  
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
  createdBy?: string;

  /* backend virtuals */
  hasExpired?: boolean;
  daysRemaining?: number;
  
  /* ✅ frontend calculated expiry status */
  isExpired?: boolean;
}

/* =========================
   API RESPONSES
========================= */

export interface PollVoteResponse {
  success: boolean;
  totalVotes: number;
  optionVotes: number;
  percentage?: number;
  message?: string;
  userHasVoted?: boolean;      // User voting status
  userVoteOption?: string;     // User's vote option
}

export interface PollApiResponse {
  success: boolean;
  poll: Poll | null;
  message?: string;
}

export interface CheckVoteResponse {
  success: boolean;
  hasVoted: boolean;
  voteOption?: string | null;
}

/* =========================
   ADMIN – CREATE / MANAGE
========================= */

export interface PollFormOption {
  animeId: string;
  title: string;
  image: string;
  votes?: number;
  order?: number;
  isCustom?: boolean;
}

export interface CreatePollData {
  question: string;
  description?: string;
  options: PollFormOption[];
  expiresAt?: string;
  isActive?: boolean;
}

/* =========================
   FRONTEND STATE
========================= */

export interface PollState {
  currentPoll: Poll | null;
  loading: boolean;
  error: string | null;
  hasVoted: boolean;
  userVoteOption?: string;
}

/* =========================
   ADMIN STATISTICS
========================= */

export interface PollStats {
  totalPolls: number;
  activePolls: number;
  expiredPolls: number;
  totalVotes: number;
  totalVoters: number;
  averageVotesPerPoll: number;
}

/* =========================
   EXPORT DATA
========================= */

export interface ExportPollData {
  poll: Poll;
  format: 'csv' | 'json' | 'pdf';
  includeVoters?: boolean;
  includeTimestamps?: boolean;
}

/* =====================================================
   ✅ PARTNER MANAGER – NEW TYPES (ADDED)
===================================================== */

/**
 * Partner – represents a content partner / contributor
 * Partners can have anime assigned to them.
 */
export interface Partner {
  _id: string;
  name: string;
  createdAt: string;          // ISO date string

  // Frontend computed / API enriched fields
  animeCount?: number;        // Number of anime assigned to this partner
}

/**
 * Partner API request payloads
 */
export interface CreatePartnerData {
  name: string;
}

/**
 * Assign anime to partner – request body
 */
export interface AssignAnimeToPartnerData {
  animeId: string;
}

/**
 * Partner with populated anime list (for modal view)
 */
export interface PartnerWithAnime extends Partner {
  animeList?: Anime[];        // Full anime objects assigned to partner
}

/**
 * API response for GET /api/partners
 */
export interface PartnersApiResponse {
  success?: boolean;          // Not always present, but we can include
  data?: Partner[];           // Some APIs wrap in data
  message?: string;
  // Direct array response is also possible
}

/**
 * API response for GET /api/partners/:id/anime
 */
export interface PartnerAnimeApiResponse {
  success?: boolean;
  data?: Anime[];
  message?: string;
}

/**
 * API response for partner creation
 */
export interface CreatePartnerApiResponse {
  success?: boolean;
  partner?: Partner;
  message?: string;
}

/**
 * API response for assign/remove operations
 */
export interface AnimeAssignmentResponse {
  success?: boolean;
  anime?: Anime;             // Updated anime document
  message?: string;
}