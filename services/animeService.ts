  // services/animeService.ts - CORRECTED VERSION
import type { Anime } from '../src/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';

console.log('🔧 API Base URL:', API_BASE);

export const getAllAnime = async (): Promise<Anime[]> => {
  try {
    console.log('🚀 Fetching ALL anime from backend...');
    
    const response = await fetch(`${API_BASE}/anime`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📦 Raw response from getAllAnime:', result);
    
    if (result.success && Array.isArray(result.data)) {
      console.log(`🎉 getAllAnime: Found ${result.data.length} anime`);
      
      // ✅ YEH LINE UPDATE KARO: Newest content first sorting
      const formattedAnime = result.data
        .map((anime: any) => ({
          ...anime,
          id: anime._id || anime.id,
          // Convert to timestamp for sorting
          lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : 
                       anime.createdAt ? new Date(anime.createdAt).getTime() : Date.now()
        }))
        // ✅ SORT BY LATEST UPDATED FIRST
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      console.log(`🔄 Sorted ${formattedAnime.length} anime by latest update`);
      return formattedAnime;
    } else {
      console.warn('⚠️ getAllAnime: Unexpected response format');
      return [];
    }
  } catch (error) {
    console.error('❌ Error in getAllAnime:', error);
    return [];
  }
};

export const searchAnime = async (query: string): Promise<Anime[]> => {
  try {
    console.log('🔍 Searching anime with query:', query);
    
    if (!query.trim()) {
      // ✅ YEH LINE IMPORTANT HAI: Empty query = return all anime
      console.log('🔍 Empty query, returning all anime');
      return await getAllAnime();
    }
    
    const response = await fetch(`${API_BASE}/anime/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📦 Search response:', result);
    
    if (result.success && Array.isArray(result.data)) {
      // ✅ SEARCH RESULTS KO BHI SORT KARO
      const formattedAnime = result.data
        .map((anime: any) => ({
          ...anime,
          id: anime._id || anime.id,
          lastUpdated: anime.updatedAt ? new Date(anime.updatedAt).getTime() : 
                       anime.createdAt ? new Date(anime.createdAt).getTime() : Date.now()
        }))
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      console.log(`🎉 Search found ${formattedAnime.length} results`);
      return formattedAnime;
    }
    
    return [];
  } catch (error) {
    console.error('❌ Error in searchAnime:', error);
    return [];
  }
};

// Rest of the code remains same...
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
    console.log('📺 Fetching episodes for anime:', animeId);
    
    const response = await fetch(`${API_BASE}/episodes/${animeId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const episodes = await response.json();
    console.log(`✅ Found ${episodes.length} episodes for anime ${animeId}`);
    return episodes;
  } catch (error) {
    console.error('❌ Error fetching episodes:', error);
    return [];
  }
};

export const getChaptersByMangaId = async (mangaId: string): Promise<any[]> => {
  try {
    console.log('📖 Fetching chapters for manga:', mangaId);
    
    const response = await fetch(`${API_BASE}/chapters/${mangaId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const chapters = await response.json();
    console.log(`✅ Found ${chapters.length} chapters for manga ${mangaId}`);
    return chapters;
  } catch (error) {
    console.error('❌ Error fetching chapters:', error);
    return [];
  }
};
