 // services/animeService.ts - UPDATED WITH ID + SLUG SUPPORT
import type { Anime, Episode, Chapter } from '../src/types';

// ✅ FIX: Local development के लिए PORT 5173 है, server PORT 3000 पर है
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

// ✅ CACHE IMPLEMENTATION
const cache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// ================== CORE FUNCTIONS ==================

/**
 * ✅ NEW: GET ANIME BY ID OR SLUG (MOST IMPORTANT FUNCTION)
 * This is the main function that handles both ID and Slug
 * Used by AnimeDetailWrapper component
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
    
    // Build URL with optional fields parameter
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
        slug: result.data.slug || idOrSlug // Ensure slug is preserved
      };
      
      // Store in cache
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

/**
 * ✅ ADDED: GET ANIME BY SLUG (SEO-friendly)
 * Uses the same function but for slug-specific calls
 */
export const getAnimeBySlug = async (slug: string, fields?: string): Promise<Anime | null> => {
  return getAnimeByIdOrSlug(slug, fields);
};

/**
 * ✅ UPDATED: Get anime by ID with fields parameter
 * Now uses the unified function
 */
export const getAnimeById = async (id: string, fields?: string): Promise<Anime | null> => {
  return getAnimeByIdOrSlug(id, fields);
};

// ================== FEATURED ANIME ==================

/**
 * ✅ ADDED: FEATURED ANIME FUNCTION (FIXES THE MISSING FUNCTION)
 */
export const getFeaturedAnime = async (): Promise<Anime[]> => {
  const cacheKey = 'featured-anime';
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('🎯 Cache hit for featured anime');
    return cached.data;
  }

  try {
    console.log('📡 Fetching featured anime from API...');
    
    const response = await fetch(`${API_BASE}/anime/featured`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let featuredData = [];
    
    if (result.success && Array.isArray(result.data)) {
      featuredData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now(),
        slug: anime.slug // Ensure slug is included
      }));
    }

    // Store in cache
    cache.set(cacheKey, {
      data: featuredData,
      timestamp: Date.now()
    });

    console.log(`✅ Loaded ${featuredData.length} featured anime`);
    return featuredData;
  } catch (error) {
    console.error('❌ Error in getFeaturedAnime:', error);
    return [];
  }
};

// ================== PAGINATION & SEARCH ==================

/**
 * ✅ UPDATED: Paginated API calls with fields parameter
 */
export const getAnimePaginated = async (page: number = 1, limit: number = 24, fields?: string): Promise<Anime[]> => {
  const cacheKey = `anime-page-${page}-${limit}-${fields || 'default'}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`🎯 Cache hit for page ${page}`);
    return cached.data;
  }

  try {
    console.log(`📡 Fetching page ${page} from API...`);
    
    // Build URL with optional fields parameter
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
        slug: anime.slug // Ensure slug is included
      }));
    }

    // Store in cache
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

/**
 * ✅ UPDATED: Search function with fields parameter
 */
export const searchAnime = async (query: string, fields?: string): Promise<Anime[]> => {
  const cacheKey = `search-${query}-${fields || 'default'}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (!query.trim()) return await getAllAnime(fields);
    
    // Build URL with optional fields parameter
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
        slug: anime.slug // Ensure slug is included
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

/**
 * ✅ UPDATED: Get all anime with fields parameter
 */
export const getAllAnime = async (fields?: string): Promise<Anime[]> => {
  return getAnimePaginated(1, 50, fields); // First page with more items
};

// ================== POLL FUNCTIONS ==================

/**
 * ✅ ADDED: Fetch active poll
 */
export const fetchPoll = async (): Promise<any> => {
  const cacheKey = 'active-poll';
  
  // Check cache first
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
    
    // Store in cache
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

/**
 * ✅ ADDED: Submit poll vote
 */
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
    
    // Clear poll cache after voting
    cache.delete('active-poll');
    
    return result;
  } catch (error) {
    console.error('❌ Error submitting vote:', error);
    throw error;
  }
};

/**
 * ✅ ADDED: Get poll results
 */
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
    
    // Store in cache
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

/**
 * ✅ ADDED: Clear poll cache
 */
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

/**
 * ✅ UPDATED: Get episodes by anime ID (now returns proper Episode type)
 */
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
    
    // ✅ Transform the data to match Episode type with downloadLinks
    const transformedEpisodes: Episode[] = episodes.map((episode: any) => ({
      episodeId: episode._id,
      _id: episode._id,
      episodeNumber: episode.episodeNumber,
      title: episode.title || `Episode ${episode.episodeNumber}`,
      downloadLinks: episode.downloadLinks || [], // ✅ Use downloadLinks instead of cutyLink
      secureFileReference: episode.secureFileReference || '',
      session: episode.session || 1
    }));
    
    // Store in cache
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

/**
 * ✅ UPDATED: Get chapters by manga ID (now returns proper Chapter type)
 */
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
    
    // ✅ Transform the data to match Chapter type with downloadLinks
    const transformedChapters: Chapter[] = chapters.map((chapter: any) => ({
      chapterId: chapter._id,
      _id: chapter._id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || `Chapter ${chapter.chapterNumber}`,
      downloadLinks: chapter.downloadLinks || [], // ✅ Use downloadLinks instead of cutyLink
      secureFileReference: chapter.secureFileReference || '',
      session: chapter.session || 1
    }));
    
    // Store in cache
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

/**
 * ✅ FIXED: Get download links for a specific episode (using query parameter)
 */
export const getEpisodeDownloadLinks = async (animeId: string, episodeNumber: number, session?: number): Promise<Episode | null> => {
  const cacheKey = `episode-links-${animeId}-${episodeNumber}-${session || 1}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // ✅ FIXED: Use query parameter for session instead of path parameter
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
      
      // Store in cache
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

/**
 * ✅ FIXED: Get download links for a specific chapter (using query parameter)
 */
export const getChapterDownloadLinks = async (mangaId: string, chapterNumber: number, session?: number): Promise<Chapter | null> => {
  const cacheKey = `chapter-links-${mangaId}-${chapterNumber}-${session || 1}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // ✅ FIXED: Use query parameter for session instead of path parameter
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
      
      // Store in cache
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

/**
 * ✅ ADDED: Clear slug cache
 */
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

/**
 * ✅ Clear cache function
 */
export const clearAnimeCache = () => {
  cache.clear();
  console.log('🗑️ Anime cache cleared');
};

/**
 * ✅ Clear specific cache entries
 */
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

// ================== EXPORT TYPES ==================

/**
 * ✅ Type for API response
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

/**
 * ✅ Type for paginated response
 */
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