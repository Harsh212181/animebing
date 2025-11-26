  // services/animeService.ts - OPTIMIZED VERSION
import type { Anime } from '../src/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';

// ✅ CACHE IMPLEMENTATION
const cache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// ✅ OPTIMIZED: Paginated API calls
export const getAnimePaginated = async (page: number = 1, limit: number = 24): Promise<Anime[]> => {
  const cacheKey = `anime-page-${page}-${limit}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`🎯 Cache hit for page ${page}`);
    return cached.data;
  }

  try {
    console.log(`📡 Fetching page ${page} from API...`);
    const response = await fetch(`${API_BASE}/anime?page=${page}&limit=${limit}`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let animeData = [];
    
    if (result.success && Array.isArray(result.data)) {
      animeData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now()
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

// ✅ KEEP existing functions but optimized
export const getAllAnime = async (): Promise<Anime[]> => {
  return getAnimePaginated(1, 50); // First page with more items
};

export const searchAnime = async (query: string): Promise<Anime[]> => {
  const cacheKey = `search-${query}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (!query.trim()) return await getAllAnime();
    
    const response = await fetch(`${API_BASE}/anime/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    let searchData = [];
    
    if (result.success && Array.isArray(result.data)) {
      searchData = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id,
        lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : Date.now()
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

// ✅ Keep other functions same (they're already optimized)
export const getAnimeById = async (id: string): Promise<Anime | null> => {
  try {
    const response = await fetch(`${API_BASE}/anime/${id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      return {
        ...result.data,
        id: result.data._id || result.data.id
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching anime by id:', error);
    return null;
  }
};

export const getEpisodesByAnimeId = async (animeId: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/episodes/${animeId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const episodes = await response.json();
    return episodes;
  } catch (error) {
    console.error('❌ Error fetching episodes:', error);
    return [];
  }
};

export const getChaptersByMangaId = async (mangaId: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/chapters/${mangaId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const chapters = await response.json();
    return chapters;
  } catch (error) {
    console.error('❌ Error fetching chapters:', error);
    return [];
  }
};

// Clear cache function
export const clearAnimeCache = () => {
  cache.clear();
  console.log('🗑️ Anime cache cleared');
};
