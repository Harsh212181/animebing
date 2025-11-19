 // services/animeService.ts - CORRECTED VERSION
import type { Anime } from '../src/types';

const API_BASE = import.meta.env.VITE_API_BASE;

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
      
      const formattedAnime = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id
      }));
      
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
      const formattedAnime = result.data.map((anime: any) => ({
        ...anime,
        id: anime._id || anime.id
      }));
      
      console.log(`🎉 Search found ${formattedAnime.length} results`);
      return formattedAnime;
    }
    
    return [];
  } catch (error) {
    console.error('❌ Error in searchAnime:', error);
    return [];
  }
};

export const getAnimeById = async (id: string): Promise<Anime | null> => {
  try {
    const response = await fetch(`${API_BASE}/anime/${id}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      return {
        ...result.data,
        id: result.data._id || result.data.id
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching anime by id:', error);
    return null;
  }
};
