 // services/animeService.ts - FIXED URLSearchParams + ALL OTHER FUNCTIONS INTACT
import type { Anime, Episode, Chapter } from '../src/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const cache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// ================== TOP 100 ANIME FUNCTIONS ==================

export const getTopAnime = async (options: {
  type?: 'all-time' | 'monthly' | 'weekly';
  contentType?: 'all' | 'Anime' | 'Movie' | 'Manga' | null;
  limit?: number;
  page?: number;
}): Promise<{
  success: boolean;
  data: Anime[];
  pagination?: {
    current: number;
    totalPages: number;
    hasMore: boolean;
    totalItems: number;
  };
  ranking?: {
    type: string;
    contentType: string;
    period: string;
  };
  error?: string;
}> => {
  const { 
    type = 'all-time', 
    contentType = 'all', 
    limit = 100, 
    page = 1 
  } = options;

  const cacheKey = `top-anime-${type}-${contentType}-${limit}-${page}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('🎯 Cache hit for top anime:', cacheKey);
    return cached.data;
  }

  try {
    console.log('📡 Fetching top anime from API...', { type, contentType, limit, page });

    // ✅ FIX: Use params.set() to avoid TypeScript error
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('contentType', contentType ?? 'all');
    params.set('limit', limit.toString());
    params.set('page', page.toString());

    const url = `${API_BASE}/anime/top100?${params.toString()}`;
    console.log('🌐 Fetching from:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      const transformedData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        slug: anime.slug,
        likes: anime.likes || 0,
        dislikes: anime.dislikes || 0,
        monthlyLikes: anime.monthlyLikes || 0,
        weeklyLikes: anime.weeklyLikes || 0
      }));

      const responseData = {
        ...result,
        data: transformedData
      };

      cache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });

      console.log(`✅ Loaded ${transformedData.length} top anime`);
      return responseData;
    }

    return {
      success: false,
      data: [],
      error: 'No data returned from API'
    };

  } catch (error: any) {
    console.error('❌ Error in getTopAnime:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Failed to fetch top anime'
    };
  }
};

/**
 * ✅ NEW: SUBMIT LIKE/DISLIKE VOTE
 */
export const submitVote = async (
  animeId: string, 
  voteType: 'like' | 'dislike', 
  ipAddress: string
): Promise<{
  success: boolean;
  message?: string;
  data?: {
    likes: number;
    dislikes: number;
    totalVotes: number;
    userVote: string | null;
    hasVoted: boolean;
    monthlyLikes?: number;
    weeklyLikes?: number;
  };
  error?: string;
}> => {
  try {
    console.log('📡 Submitting vote:', { animeId, voteType, ipAddress });

    const response = await fetch(`${API_BASE}/anime/${animeId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voteType, ipAddress })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    const keysToDelete: string[] = [];
    cache.forEach((value, key) => {
      if (key.includes(`anime-${animeId}`) || key.includes('top-anime')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));

    console.log('✅ Vote submitted successfully');
    return result;

  } catch (error: any) {
    console.error('❌ Error submitting vote:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit vote'
    };
  }
};

/**
 * ✅ NEW: GET USER VOTE STATUS
 */
export const getUserVoteStatus = async (
  animeId: string, 
  ipAddress: string
): Promise<{
  success: boolean;
  data?: {
    hasVoted: boolean;
    userVote: 'like' | 'dislike' | null;
    likes: number;
    dislikes: number;
    totalVotes: number;
  };
  error?: string;
}> => {
  try {
    const cacheKey = `vote-status-${animeId}-${ipAddress}`;
    
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const response = await fetch(`${API_BASE}/anime/${animeId}/vote-status/${ipAddress}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error: any) {
    console.error('❌ Error getting vote status:', error);
    return {
      success: false,
      error: error.message || 'Failed to get vote status'
    };
  }
};

/**
 * ✅ NEW: GET ANIME STATISTICS
 */
export const getAnimeStatistics = async (
  animeId: string
): Promise<{
  success: boolean;
  data?: {
    likes: number;
    dislikes: number;
    monthlyLikes: number;
    weeklyLikes: number;
    totalVotes: number;
    likePercentage: string;
    dislikePercentage: string;
    recentVotes: {
      last30Days: number;
      likes: number;
      dislikes: number;
    };
    ranking: {
      allTime: number;
      monthly: number;
      weekly: number;
    };
  };
  error?: string;
}> => {
  try {
    const cacheKey = `anime-stats-${animeId}`;
    
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const response = await fetch(`${API_BASE}/anime/${animeId}/statistics`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error: any) {
    console.error('❌ Error getting anime statistics:', error);
    return {
      success: false,
      error: error.message || 'Failed to get anime statistics'
    };
  }
};

// ================== CORE FUNCTIONS ==================

/**
 * ✅ NEW: GET ANIME BY ID OR SLUG (MOST IMPORTANT FUNCTION)
 */
export const getAnimeByIdOrSlug = async (idOrSlug: string, fields?: string): Promise<Anime | null> => {
  const cacheKey = `anime-${idOrSlug}-${fields || 'default'}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('🎯 Cache hit for anime by id/slug:', idOrSlug);
    return cached.data;
  }

  try {
    console.log('📡 Fetching anime by id/slug:', idOrSlug);
    
    let url = `${API_BASE}/anime/${encodeURIComponent(idOrSlug)}`;
    if (fields) {
      url += `?fields=${encodeURIComponent(fields)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('🔍 Anime not found by id/slug:', idOrSlug);
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const animeData = {
        ...result.data,
        id: result.data._id || result.data.id,
        slug: result.data.slug || idOrSlug,
        likes: result.data.likes || 0,
        dislikes: result.data.dislikes || 0
      };
      
      cache.set(cacheKey, {
        data: animeData,
        timestamp: Date.now()
      });
      
      console.log('✅ Found anime by id/slug:', animeData.title);
      return animeData;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching anime by id/slug:', error);
    return null;
  }
};

export const getAnimeBySlug = async (slug: string, fields?: string): Promise<Anime | null> => {
  return getAnimeByIdOrSlug(slug, fields);
};

export const getAnimeById = async (id: string, fields?: string): Promise<Anime | null> => {
  return getAnimeByIdOrSlug(id, fields);
};

// ================== FEATURED ANIME ==================

export const getFeaturedAnime = async (): Promise<Anime[]> => {
  try {
    console.log('📡 Fetching featured anime from API (no cache)...');
    
    const timestamp = Date.now();
    const url = `${API_BASE}/anime/featured?_=${timestamp}`;
    
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let featuredData = [];
    
    if (result.success && Array.isArray(result.data)) {
      featuredData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now(),
        slug: anime.slug,
        likes: anime.likes || 0,
        dislikes: anime.dislikes || 0
      }));
    }

    console.log(`✅ Loaded ${featuredData.length} featured anime`);
    return featuredData;
  } catch (error) {
    console.error('❌ Error in getFeaturedAnime:', error);
    return [];
  }
};

export const clearFeaturedCache = () => {
  console.log('🗑️ Featured cache cleared (no-op)');
};

// ================== PAGINATION & SEARCH ==================

export const getAnimePaginated = async (page: number = 1, limit: number = 24, fields?: string): Promise<Anime[]> => {
  const cacheKey = `anime-page-${page}-${limit}-${fields || 'default'}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`🎯 Cache hit for page ${page}`);
    return cached.data;
  }

  try {
    console.log(`📡 Fetching page ${page} from API...`);
    
    let url = `${API_BASE}/anime?page=${page}&limit=${limit}`;
    if (fields) {
      url += `&fields=${encodeURIComponent(fields)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let animeData = [];
    
    if (result.success && Array.isArray(result.data)) {
      animeData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now(),
        slug: anime.slug,
        likes: anime.likes || 0,
        dislikes: anime.dislikes || 0
      }));
    }

    cache.set(cacheKey, {
      data: animeData,
      timestamp: Date.now()
    });

    console.log(`✅ Loaded ${animeData.length} anime for page ${page}`);
    return animeData;
  } catch (error) {
    console.error('❌ Error in getAnimePaginated:', error);
    return [];
  }
};

export const searchAnime = async (query: string, fields?: string): Promise<Anime[]> => {
  const cacheKey = `search-${query}-${fields || 'default'}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (!query.trim()) return await getAllAnime(fields);
    
    let url = `${API_BASE}/anime/search?query=${encodeURIComponent(query)}`;
    if (fields) {
      url += `&fields=${encodeURIComponent(fields)}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let searchData = [];
    
    if (result.success && Array.isArray(result.data)) {
      searchData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now(),
        slug: anime.slug,
        likes: anime.likes || 0,
        dislikes: anime.dislikes || 0
      }));
    }

    cache.set(cacheKey, {
      data: searchData,
      timestamp: Date.now()
    });

    return searchData;
  } catch (error) {
    console.error('❌ Error in searchAnime:', error);
    return [];
  }
};

export const getAllAnime = async (fields?: string): Promise<Anime[]> => {
  const pageLimit = 50;
  let currentPage = 1;
  let allAnime: Anime[] = [];
  let keepFetching = true;

  while (keepFetching) {
    console.log(`📡 Fetching page ${currentPage} for getAllAnime...`);
    
    const pageData = await getAnimePaginated(currentPage, pageLimit, fields);
    
    if (pageData.length > 0) {
      allAnime = [...allAnime, ...pageData];
      
      if (pageData.length < pageLimit) {
        keepFetching = false;
        console.log(`✅ Reached last page (${currentPage}) with ${pageData.length} items. Total: ${allAnime.length}`);
      } else {
        currentPage++;
      }
    } else {
      keepFetching = false;
      console.log(`⚠️ Page ${currentPage} returned no data. Stopping.`);
    }
  }

  console.log(`✅ getAllAnime completed. Total anime fetched: ${allAnime.length}`);
  return allAnime;
};

// ================== POLL FUNCTIONS ==================

export const fetchPoll = async (): Promise<any> => {
  const cacheKey = 'active-poll';
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('🎯 Cache hit for poll');
    return cached.data;
  }

  try {
    console.log('📡 Fetching poll from API...');
    
    const response = await fetch(`${API_BASE}/polls/active`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('🔍 No active poll found');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    console.log('✅ Poll loaded successfully');
    return result;
  } catch (error) {
    console.error('❌ Error fetching poll:', error);
    return null;
  }
};

export const submitPollVote = async (pollId: string, optionId: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/polls/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pollId, optionId }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    cache.delete('active-poll');
    
    return result;
  } catch (error) {
    console.error('❌ Error submitting vote:', error);
    throw error;
  }
};

export const getPollResults = async (pollId: string): Promise<any> => {
  const cacheKey = `poll-results-${pollId}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_BASE}/polls/results/${pollId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error fetching poll results:', error);
    return null;
  }
};

export const clearPollCache = () => {
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (key.includes('poll') || key.includes('active-poll')) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log('🗑️ Poll cache cleared');
};

// ================== EPISODES & CHAPTERS ==================

export const getEpisodesByAnimeId = async (animeId: string): Promise<Episode[]> => {
  const cacheKey = `episodes-${animeId}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_BASE}/episodes/${animeId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const episodes = await response.json();
    
    const transformedEpisodes: Episode[] = episodes.map((episode: any) => ({
      episodeId: episode._id,
      _id: episode._id,
      episodeNumber: episode.episodeNumber,
      title: episode.title || `Episode ${episode.episodeNumber}`,
      downloadLinks: episode.downloadLinks || [],
      secureFileReference: episode.secureFileReference || '',
      session: episode.session || 1
    }));
    
    cache.set(cacheKey, {
      data: transformedEpisodes,
      timestamp: Date.now()
    });
    
    return transformedEpisodes;
  } catch (error) {
    console.error('❌ Error fetching episodes:', error);
    return [];
  }
};

export const getChaptersByMangaId = async (mangaId: string): Promise<Chapter[]> => {
  const cacheKey = `chapters-${mangaId}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_BASE}/chapters/${mangaId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const chapters = await response.json();
    
    const transformedChapters: Chapter[] = chapters.map((chapter: any) => ({
      chapterId: chapter._id,
      _id: chapter._id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || `Chapter ${chapter.chapterNumber}`,
      downloadLinks: chapter.downloadLinks || [],
      secureFileReference: chapter.secureFileReference || '',
      session: chapter.session || 1
    }));
    
    cache.set(cacheKey, {
      data: transformedChapters,
      timestamp: Date.now()
    });
    
    return transformedChapters;
  } catch (error) {
    console.error('❌ Error fetching chapters:', error);
    return [];
  }
};

export const getEpisodeDownloadLinks = async (animeId: string, episodeNumber: number, session?: number): Promise<Episode | null> => {
  const cacheKey = `episode-links-${animeId}-${episodeNumber}-${session || 1}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    let url = `${API_BASE}/episodes/download/${animeId}/${episodeNumber}`;
    if (session && session !== 1) {
      url += `?session=${session}`;
    }
    
    console.log('📥 Fetching episode download links from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result) {
      const episodeData: Episode = {
        episodeId: result._id,
        _id: result._id,
        episodeNumber: result.episodeNumber,
        title: result.title || `Episode ${result.episodeNumber}`,
        downloadLinks: result.downloadLinks || [],
        secureFileReference: result.secureFileReference || '',
        session: result.session || 1
      };
      
      cache.set(cacheKey, {
        data: episodeData,
        timestamp: Date.now()
      });
      
      return episodeData;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching episode download links:', error);
    return null;
  }
};

export const getChapterDownloadLinks = async (mangaId: string, chapterNumber: number, session?: number): Promise<Chapter | null> => {
  const cacheKey = `chapter-links-${mangaId}-${chapterNumber}-${session || 1}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    let url = `${API_BASE}/chapters/download/${mangaId}/${chapterNumber}`;
    if (session && session !== 1) {
      url += `?session=${session}`;
    }
    
    console.log('📥 Fetching chapter download links from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result) {
      const chapterData: Chapter = {
        chapterId: result._id,
        _id: result._id,
        chapterNumber: result.chapterNumber,
        title: result.title || `Chapter ${result.chapterNumber}`,
        downloadLinks: result.downloadLinks || [],
        secureFileReference: result.secureFileReference || '',
        session: result.session || 1
      };
      
      cache.set(cacheKey, {
        data: chapterData,
        timestamp: Date.now()
      });
      
      return chapterData;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching chapter download links:', error);
    return null;
  }
};

// ================== CACHE UTILITIES ==================

export const clearSlugCache = (slug: string) => {
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (key.includes(`anime-${slug}`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`🗑️ Cleared slug cache for: ${slug}`);
};

export const clearAnimeCache = () => {
  cache.clear();
  console.log('🗑️ Anime cache cleared');
};

export const clearEpisodeCache = (animeId: string) => {
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (key.includes(`episodes-${animeId}`) || key.includes(`episode-links-${animeId}`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`🗑️ Cleared ${keysToDelete.length} episode cache entries for anime ${animeId}`);
};

export const clearChapterCache = (mangaId: string) => {
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (key.includes(`chapters-${mangaId}`) || key.includes(`chapter-links-${mangaId}`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`🗑️ Cleared ${keysToDelete.length} chapter cache entries for manga ${mangaId}`);
};

export const clearTopAnimeCache = () => {
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (key.includes('top-anime')) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`🗑️ Cleared ${keysToDelete.length} top anime cache entries`);
};

// ================== EXPORT TYPES ==================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    current: number;
    totalPages: number;
    hasMore: boolean;
    totalItems: number;
  };
}

export interface TopAnimeResponse {
  success: boolean;
  data: Anime[];
  pagination?: {
    current: number;
    totalPages: number;
    hasMore: boolean;
    totalItems: number;
  };
  ranking?: {
    type: string;
    contentType: string;
    period: string;
  };
  error?: string;
}