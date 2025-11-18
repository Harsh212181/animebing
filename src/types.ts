 // src/types.ts - MERGED VERSION

export interface Episode {
  episodeId?: string;
  _id?: string;
  episodeNumber: number;
  title: string;
  cutyLink: string;
  secureFileReference?: string;
  session?: number; // ✅ NAYA FIELD ADD KARO
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

export type SubDubStatus = 'Hindi Dub' | 'Hindi Sub' | 'Both' | 'Subbed' | 'Dubbed' | 'Sub & Dub' | 'Dual Audio';
export type FilterType = 'All' | SubDubStatus;

// ✅ CORRECTION: Separate types for content and filtering
export type ContentType = 'Anime' | 'Movie' | 'Manga'; // ✅ ADDED MANGA
export type ContentTypeFilter = 'All' | ContentType; // Filter type

export interface Anime {
  id: string;
  _id?: string;
  title: string;
  thumbnail: string;
  releaseYear: number;
  subDubStatus: SubDubStatus;
  contentType: ContentType; // ✅ NOW INCLUDES MANGA
  genreList: string[];
  description: string;
  status: string;
  episodes: Episode[];
  chapters?: Chapter[]; // ✅ NEW FIELD FOR MANGA
  reportCount?: number;
  lastReported?: string;
  totalSessions?: number; // ✅ NAYA FIELD ADD KARO
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