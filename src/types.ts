  // src/types.ts - UPDATED WITH ENGLISH SUB
export interface Episode {
  episodeId?: string;
  _id?: string;
  episodeNumber: number;
  title: string;
  cutyLink: string;
  secureFileReference?: string;
  session?: number;
}

export interface Chapter {
  chapterId?: string;
  _id?: string;
  chapterNumber: number;
  title: string;
  cutyLink: string;
  secureFileReference?: string;
  session?: number;
}

// ✅ UPDATED: Added 'English Sub' to SubDubStatus
export type SubDubStatus = 'Hindi Dub' | 'Hindi Sub' | 'English Sub' | 'Both' | 'Subbed' | 'Dubbed' | 'Sub & Dub' | 'Dual Audio';
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
  subDubStatus: SubDubStatus; // ✅ NOW INCLUDES ENGLISH SUB
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
}

export interface FeaturedAnime extends Anime {
  featuredOrder: number;
}

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
