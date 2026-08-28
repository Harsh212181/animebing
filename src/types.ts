 // src/types.ts – COMPLETE UPDATED VERSION WITH DEVICE-BASED POLL VOTING & isHidden
import { getContentGroup, contentBadgeLabel } from './utils/contentGroup';

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
export type ContentType =
  | 'Anime'
  | 'Ai Anime'
  | 'Manga'
  | 'Ai Manhwa'
  | 'Movie'
  | 'Hollywood Movie'
  | 'Bollywood Movie'
  | 'Web Series';
export type ContentTypeFilter = 'All' | ContentType;

export interface Anime {
  _id: string;
  id?: string;
  title: string;
  thumbnail?: string;
  posterImage?: string;
  coverImage?: string;
  bannerImage?: string;
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

  likes?: number;
  dislikes?: number;
  votes?: Vote[];
  lastLikedDate?: Date | string;
  monthlyLikes?: number;
  weeklyLikes?: number;
  totalVotes?: number;

  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  slug?: string;

  language?: string;
  rating?: number;
  views?: number;
  episodeCount?: number;
  totalEpisodes?: number;
  currentEpisode?: number;
  lastContentAdded?: Date | string;

  partnerId?: string | null;
  isHidden?: boolean;

  // 👇 Creator tracking (for sub-admin visibility in EpisodesManager etc.)
  createdBy?: string;
  createdByUsername?: string;
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
  mainLink?: string;
}

export interface EditChapterData {
  title?: string;
  downloadLinks?: DownloadLink[];
  secureFileReference?: string;
  session?: number;
  mainLink?: string;
}

export interface SEODetails {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  slug: string;
}

/* =====================================================
   POLL SYSTEM
===================================================== */

export interface PollOption {
  _id: string;
  animeId?: string;
  title: string;
  image?: string;
  thumbnailUrl?: string;
  votes: number;
  percentage?: number;
  order?: number;
  isCustom?: boolean;
  createdAt?: string;
  anime?: Anime;
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface VoterInfo {
  deviceId: string;
  deviceType: DeviceType;
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

  // ✅ FIX: voters any[] allowata hai flexible access ke liye
  votersCount?: number;
  voters?: VoterInfo[] | any[];

  userHasVoted?: boolean;
  userVoteOption?: string;

  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
  createdBy?: string;

  hasExpired?: boolean;
  daysRemaining?: number;

  // ✅ FIX: isExpired boolean force karne ke liye
  isExpired?: boolean;

  // ✅ NEW — displayLocations: poll kis page par dikhega (home, detail, downloadLink)
  displayLocations?: ('home' | 'detail' | 'downloadLink')[];
  
  // ✅ NEW — true hone par users ko votes/percentage nahi dikhega
  hideVoteCounts?: boolean;
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
  userHasVoted?: boolean;
  userVoteOption?: string;
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
  _id?: string;   // ✅ NEW — edit karte waqt existing option ki id preserve karne ke liye
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
  displayLocations?: ('home' | 'detail' | 'downloadLink')[]; // ✅ NEW
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
   PARTNER MANAGER
===================================================== */

export interface Partner {
  _id: string;
  name: string;
  createdAt: string;
  createdBy?: string;
  createdByUsername?: string;
  animeCount?: number;
}

export interface CreatePartnerData {
  name: string;
}

export interface AssignAnimeToPartnerData {
  animeId: string;
}

export interface PartnerWithAnime extends Partner {
  animeList?: Anime[];
}

export interface PartnersApiResponse {
  success?: boolean;
  data?: Partner[];
  message?: string;
}

export interface PartnerAnimeApiResponse {
  success?: boolean;
  data?: Anime[];
  message?: string;
}

export interface CreatePartnerApiResponse {
  success?: boolean;
  partner?: Partner;
  message?: string;
}

export interface AnimeAssignmentResponse {
  success?: boolean;
  anime?: Anime;
  message?: string;
}

/* =====================================================
   DOWNLOAD PAGES TYPES
===================================================== */

export interface DownloadPageLink {
  episode: number;
  episodeStart?: number;   // ✅ NEW — range ka start (jaise 1-5 me 1)
  url: string;
  quality?: string;
  language?: string;
  type: 'download' | 'watch';
  durationSec?: number;                      // ✅ NEW
  playerMode?: 'custom' | 'default';         // ✅ NEW
}

export interface DownloadPage {
  _id: string;
  animeId:
    | {
        _id: string;
        title: string;
        contentType?: ContentType;
        subDubStatus?: SubDubStatus;
        status?: string;
        releaseYear?: number;
      }
    | string;
  slug: string;
  title: string;
  buttonTitle?: string;
  episodeNumber: number;
  links: DownloadPageLink[];
  defaultPlayerMode?: 'custom' | 'default';   // ✅ NEW — page-wide YouTube player mode
  createdAt: string;
  updatedAt?: string;
}