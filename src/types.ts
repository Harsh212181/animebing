 // src/types.ts – COMPLETE UPDATED VERSION WITH VOTERS TRACKING AND MAIN LINK
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
}

export interface FeaturedAnime extends Anime {
  featuredOrder: number;
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

// Voter information for tracking
export interface VoterInfo {
  ip: string;
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
  
  // ✅ NEW: Voters tracking
  votersCount?: number;              // Number of unique voters
  voters?: VoterInfo[];             // Array of voter information (admin only)
  
  // ✅ NEW: User voting status (frontend only)
  userHasVoted?: boolean;           // Whether current user has voted
  userVoteOption?: string;          // Option ID that user voted for
  
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
  createdBy?: string;

  /* backend virtuals */
  hasExpired?: boolean;
  daysRemaining?: number;
  
  /* ✅ ADDED: frontend calculated expiry status */
  isExpired?: boolean;
}

/* =========================
   API RESPONSES
========================= */

export interface VoteResponse {
  success: boolean;
  totalVotes: number;
  optionVotes: number;
  percentage?: number;
  message?: string;
  userHasVoted?: boolean;      // ✅ ADDED: User voting status
  userVoteOption?: string;     // ✅ ADDED: User's vote option
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