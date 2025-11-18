 // services/animeService.ts - UPDATED WITH MANGA SUPPORT
import type { Anime } from '../src/types';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export const getAllAnime = async (): Promise<Anime[]> => {
  try {
    console.log('🔍 Fetching content from API...');
    const response = await axios.get(`${API_BASE}/anime`, {
      timeout: 5000
    });
  
    console.log('✅ API Response received');
  
    let animeData = [];
  
    if (response.data && response.data.success && response.data.data) {
      animeData = response.data.data;
    } else if (Array.isArray(response.data)) {
      animeData = response.data;
    } else {
      console.warn('⚠️ Unexpected API response format:', response.data);
      animeData = [];
    }

    return animeData.map((anime: any) => ({
      id: anime._id || anime.id,
      _id: anime._id || anime.id,
      title: anime.title || 'Untitled',
      description: anime.description || 'No description available.',
      thumbnail: anime.thumbnail || '/default-thumbnail.jpg',
      releaseYear: anime.releaseYear || new Date().getFullYear(),
      subDubStatus: anime.subDubStatus || 'Hindi Sub',
      genreList: anime.genreList || ['Anime'],
      status: anime.status || 'Ongoing',
      contentType: anime.contentType || 'Anime', // ✅ Now includes Manga
      episodes: anime.episodes || [],
      chapters: anime.chapters || [] // ✅ NEW: Include chapters
    }));
  
  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
  
    return [];
  }
};

export const searchAnime = async (query: string): Promise<Anime[]> => {
  try {
    if (!query.trim()) return getAllAnime();
  
    const response = await axios.get(`${API_BASE}/anime/search`, {
      params: { query: query.trim() },
      timeout: 5000
    });
  
    let animeData = [];
  
    if (response.data && response.data.success && response.data.data) {
      animeData = response.data.data;
    } else if (Array.isArray(response.data)) {
      animeData = response.data;
    } else {
      animeData = [];
    }

    return animeData.map((anime: any) => ({
      id: anime._id || anime.id,
      _id: anime._id || anime.id,
      title: anime.title || 'Untitled',
      description: anime.description || 'No description available.',
      thumbnail: anime.thumbnail || '/default-thumbnail.jpg',
      releaseYear: anime.releaseYear || new Date().getFullYear(),
      subDubStatus: anime.subDubStatus || 'Hindi Sub',
      genreList: anime.genreList || ['Anime'],
      status: anime.status || 'Ongoing',
      contentType: anime.contentType || 'Anime',
      episodes: anime.episodes || [],
      chapters: anime.chapters || [] // ✅ NEW: Include chapters
    }));
  
  } catch (error) {
    console.error('Search Error:', error);
    return [];
  }
};