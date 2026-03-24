 // components/AnimeDetailPage.tsx - FINAL FIXED VERSION + MULTIPLE DOWNLOAD PAGES PER EPISODE (DEV ONLY)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom'; // ✅ ADDED for internal navigation
import type { Anime, Episode, Chapter, DownloadPage } from '../src/types'; // ✅ ADDED DownloadPage
import { DownloadIcon } from './icons/DownloadIcon';
import ReportButton from './ReportButton';
import Spinner from './Spinner';
import { AnimeDetailSkeleton } from './SkeletonLoader';
import AnimeCard from './AnimeCard';
import { 
  getAnimeByIdOrSlug, 
  getEpisodesByAnimeId, 
  getChaptersByMangaId, 
  getAnimePaginated 
} from '../services/animeService';
import SEO from '../src/components/SEO';

// ✅ ADDED: ShareIcon import
import ShareIcon from './icons/ShareIcon';

// ✅ ADDED: Simple SVG Icons for Like/Dislike (Alternative to Heroicons)
const HeartIcon = ({ className = "w-5 h-5", filled = false }: { className?: string, filled?: boolean }) => (
  <svg 
    className={className} 
    fill={filled ? "currentColor" : "none"} 
    stroke="currentColor" 
    viewBox="0 0 24 24" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
    />
  </svg>
);

const HandThumbDownIcon = ({ className = "w-5 h-5", filled = false }: { className?: string, filled?: boolean }) => (
  <svg 
    className={className} 
    fill={filled ? "currentColor" : "none"} 
    stroke="currentColor" 
    viewBox="0 0 24 24" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" 
    />
  </svg>
);

// ✅ ADD DownloadLink interface locally since it might not be in types.ts
interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

// ✅ ADD LinkSettings interface for global link control
interface LinkSettings {
  link1: boolean;
  link2: boolean;
  link3: boolean;
  link4: boolean;
  link5: boolean;
  _id?: string;
  lastUpdated?: string;
}

interface Props {
  anime: Anime | null;
  onBack: () => void;
  onAnimeSelect: (anime: Anime) => void;
  isLoading?: boolean;
}

// ✅ UPDATED: Use dynamic API base for local development and production
const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://animabing.onrender.com/api';

// ✅ SHUFFLE ARRAY FUNCTION - For randomizing content
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Helper functions for image optimization
const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  try {
    if (url.includes(`w_${width},h_${height},c_fill`)) return url;
    
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    return `${baseUrl}/upload/f_webp,q_auto:good,w_${width},h_${height},c_fill/${imagePath}`;
  } catch (error) {
    console.error('Error optimizing image URL:', error);
    return url;
  }
};

const generateSrcSet = (url: string, baseWidth: number, baseHeight: number): string => {
  if (!url || !url.includes('cloudinary.com')) return '';
  
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    return `
      ${baseUrl}/upload/f_webp,q_auto:good,w_${baseWidth},h_${baseHeight},c_fill/${imagePath} ${baseWidth}w,
      ${baseUrl}/upload/f_webp,q_auto:good,w_${baseWidth * 2},h_${baseHeight * 2},c_fill/${imagePath} ${baseWidth * 2}w
    `;
  } catch (error) {
    console.error('Error generating srcset:', error);
    return '';
  }
};

// ✅ Helper function to get ACTIVE download links based on global settings
const getActiveDownloadLinks = (downloadLinks: DownloadLink[], linkSettings: LinkSettings): DownloadLink[] => {
  if (!downloadLinks || downloadLinks.length === 0) return [];
  
  const activeLinks: DownloadLink[] = [];
  
  // Check each link against global settings
  downloadLinks.forEach((link, index) => {
    const linkNumber = index + 1;
    const linkKey = `link${linkNumber}` as keyof LinkSettings;
    
    // Only include if link is globally active AND has a valid URL
    if (linkSettings[linkKey] && link.url && link.url.trim() !== '') {
      activeLinks.push(link);
    }
  });
  
  return activeLinks;
};

// ✅ Helper function to get random download link FROM ACTIVE LINKS ONLY
const getRandomDownloadLink = (downloadLinks: DownloadLink[], linkSettings: LinkSettings): string | null => {
  // First get only active links
  const activeLinks = getActiveDownloadLinks(downloadLinks, linkSettings);
  
  if (activeLinks.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * activeLinks.length);
  return activeLinks[randomIndex].url;
};

// ✅ Helper function to generate SEO keywords based on anime
const generateAnimeKeywords = (anime: Anime): string => {
  if (!anime) return 'anime, watch anime online, hindi anime, english anime';
  
  let keywords = [];
  
  if (anime.subDubStatus) {
    const statuses = anime.subDubStatus.split(',').map(s => s.trim().toLowerCase());
    
    if (statuses.includes('hindi dub')) {
      keywords.push(`${anime.title} hindi dubbed`, `watch ${anime.title} hindi dub`, 'hindi dubbed anime', `${anime.title} anime in hindi`);
    }
    
    if (statuses.includes('hindi sub')) {
      keywords.push(`${anime.title} hindi subbed`, `watch ${anime.title} hindi sub`, 'hindi subbed anime', `${anime.title} anime in hindi sub`);
    }
    
    if (statuses.includes('english sub')) {
      keywords.push(`${anime.title} english sub`, `watch ${anime.title} english subbed`, 'english subbed anime', `${anime.title} anime in english`);
    }
  }
  
  keywords.push(
    `watch ${anime.title} online`,
    `${anime.title} free download`,
    `${anime.title} hd`,
    `${anime.title} streaming`,
    `${anime.title} anime`
  );
  
  if (anime.genreList && anime.genreList.length > 0) {
    anime.genreList.forEach(genre => {
      keywords.push(`${anime.title} ${genre.toLowerCase()} anime`, `${genre.toLowerCase()} anime`);
    });
  }
  
  if (anime.contentType) {
    if (anime.contentType === 'Movie') {
      keywords.push(`${anime.title} movie`, `watch ${anime.title} movie online`, `${anime.title} anime movie`);
    } else if (anime.contentType === 'Manga') {
      keywords.push(`${anime.title} manga`, `read ${anime.title} manga online`);
    } else {
      keywords.push(`${anime.title} episodes`, `watch ${anime.title} episodes`);
    }
  }
  
  if (anime.releaseYear) {
    keywords.push(`${anime.title} ${anime.releaseYear}`);
  }
  
  return [...new Set(keywords)].join(', ');
};

// ✅ Generate structured data for Google
const generateAnimeStructuredData = (anime: Anime) => {
  if (!anime) return null;
  
  const totalVotes = (anime.likes || 0) + (anime.dislikes || 0);
  
  return {
    "@context": "https://schema.org",
    "@type": anime.contentType === 'Movie' ? "Movie" : "TVSeries",
    "name": anime.title,
    "description": anime.description || `Watch ${anime.title} online in high quality`,
    "image": anime.thumbnail,
    "genre": anime.genreList || ["Anime"],
    "dateCreated": anime.releaseYear ? `${anime.releaseYear}` : undefined,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": anime.rating || 0,
      "ratingCount": totalVotes
    },
    "potentialAction": {
      "@type": "WatchAction",
      "target": window.location.href
    }
  };
};

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack, onAnimeSelect, isLoading = false }) => {
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ STATE FOR FULL ANIME DETAILS
  const [fullAnime, setFullAnime] = useState<Anime | null>(null);
  // ✅ CRITICAL FIX: Start with loading true so skeleton shows until data is ready
  const [animeLoading, setAnimeLoading] = useState(true);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);

  // ✅ STATE FOR GLOBAL LINK SETTINGS (CRITICAL FEATURE)
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true,
    link2: true,
    link3: true,
    link4: true,
    link5: true
  });
  const [linkSettingsLoading, setLinkSettingsLoading] = useState(false);

  // ✅ STATE FOR MORE LIKE THIS SECTION
  const [similarContent, setSimilarContent] = useState<Anime[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // ✅ STATE FOR LIKE/DISLIKE SYSTEM
  const [likes, setLikes] = useState<number>(0);
  const [dislikes, setDislikes] = useState<number>(0);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // ✅ STATE FOR SHARE FUNCTIONALITY
  const [isSharing, setIsSharing] = useState(false);

  // ✅ NEW STATE FOR DOWNLOAD PAGES
  const [downloadPages, setDownloadPages] = useState<DownloadPage[]>([]);

  // Check content types
  const isManga = anime?.contentType === 'Manga';
  const isMovie = anime?.contentType === 'Movie';

  // ✅ GET CONTENT LABEL FOR UI
  const getContentLabel = () => {
    if (isManga) return 'Chapters';
    if (isMovie) return 'Movie';
    return 'Episodes';
  };

  const getContentLabelSingular = () => {
    if (isManga) return 'Chapter';
    if (isMovie) return 'Movie';
    return 'Episode';
  };

  const getNoContentMessage = () => {
    if (isManga) return 'Chapters will be added soon!';
    if (isMovie) return 'Movie will be added soon!';
    return 'Episodes will be added soon!';
  };

  // ✅ CRITICAL FIX: displayAnime MUST be defined before any useEffect that uses it
  const displayAnime = fullAnime || anime;

  // ✅ FETCH DOWNLOAD PAGES FOR THIS ANIME
  useEffect(() => {
    const fetchDownloadPages = async () => {
      if (!displayAnime?._id) return;
      try {
        const res = await fetch(`${API_BASE}/download-pages/anime/${displayAnime._id}`);
        if (res.ok) {
          const data = await res.json();
          setDownloadPages(data);
        }
      } catch (err) {
        console.error('Failed to fetch download pages:', err);
      }
    };
    fetchDownloadPages();
  }, [displayAnime?._id]);

  // ✅ MAP EPISODE NUMBER TO DOWNLOAD PAGES (using page.episodeNumber)
  const episodeToPageMap = useMemo(() => {
    const map = new Map<number, DownloadPage[]>();
    downloadPages.forEach(page => {
      const episode = page.episodeNumber;
      if (!episode) return; // skip if missing (should not happen)
      if (!map.has(episode)) {
        map.set(episode, []);
      }
      map.get(episode)!.push(page);
    });
    return map;
  }, [downloadPages]);

  // ✅ FETCH LIKE/DISLIKE DATA - UPDATED TO NOT USE IP PARAMETER
  const fetchVoteData = async () => {
    if (!anime) return;

    try {
      // Get anime ID
      const animeId = anime._id || anime.id;
      if (!animeId) return;

      // ✅ FIXED: Fetch vote status without IP parameter
      const response = await fetch(`${API_BASE}/anime/${animeId}/vote-status`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLikes(data.data.likes || 0);
          setDislikes(data.data.dislikes || 0);
          setUserVote(data.data.userVote);
          console.log('✅ Vote data fetched:', data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching vote data:', error);
    }
  };

  // ✅ HANDLE LIKE/DISLIKE VOTE - UPDATED TO NOT SEND IP
  const handleVote = async (voteType: 'like' | 'dislike') => {
    if (!anime || isVoting) return;

    setIsVoting(true);
    try {
      const animeId = anime._id || anime.id;
      if (!animeId) return;

      // ✅ FIXED: Don't send IP address, server will get it from request
      const response = await fetch(`${API_BASE}/anime/${animeId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voteType // ✅ Only send voteType, no IP
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLikes(data.data.likes);
          setDislikes(data.data.dislikes);
          setUserVote(data.data.userVote);
          
          // Show success message
          const message = voteType === 'like' 
            ? data.data.userVote === null ? 'Like removed' : 'Liked!'
            : data.data.userVote === null ? 'Dislike removed' : 'Disliked!';
          
          // Optional: Show a toast notification
          console.log('✅ ' + message);
          
          // Update anime data if available
          if (fullAnime) {
            setFullAnime({
              ...fullAnime,
              likes: data.data.likes,
              dislikes: data.data.dislikes
            });
          }
        }
      } else {
        const errorData = await response.json();
        console.error('Vote failed:', errorData);
        alert(`Vote failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Error submitting vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  // ✅ ADDED: HANDLE SHARE FUNCTIONALITY
  const handleShare = async () => {
    if (!displayAnime) return;
    
    setIsSharing(true);
    
    try {
      const shareData = {
        title: `Watch ${displayAnime.title} on AnimeBing`,
        text: `Check out "${displayAnime.title}" on AnimeBing - Watch anime online in HD quality with Hindi and English subtitles!`,
        url: window.location.href,
      };
      
      // Try Web Share API first (works on mobile devices)
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard! 📋\nShare it with your friends!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // If user cancels share, don't show error
      if (error.toString().includes('AbortError')) {
        return;
      }
      
      // Fallback to clipboard if share fails
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard! 📋');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        alert('Failed to copy link. Please copy the URL manually.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // ✅ FIXED: FETCH GLOBAL LINK SETTINGS - USING API_BASE TO AVOID RELATIVE URL ISSUE IN PRODUCTION
  const fetchLinkSettings = async () => {
    try {
      setLinkSettingsLoading(true);
      console.log('🔗 Fetching global link settings...');
      
      // ✅ USE ABSOLUTE URL VIA API_BASE
      const url = `${API_BASE}/link-settings`;
      console.log('🌐 API URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // ✅ Verify response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Received non-JSON response:', text.substring(0, 100));
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      
      console.log('✅ Global link settings fetched:', {
        link1: data.link1,
        link2: data.link2,
        link3: data.link3,
        link4: data.link4,
        link5: data.link5,
        totalActive: [data.link1, data.link2, data.link3, data.link4, data.link5]
          .filter(Boolean).length
      });
      
      setLinkSettings(data);
    } catch (err: any) {
      console.error('❌ Error fetching link settings:', err);
      console.error('Error stack:', err.stack);
      // Fallback to all links active
      setLinkSettings({
        link1: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true
      });
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  // ✅ UPDATED: FETCH SIMILAR CONTENT WITH RANDOMIZATION AND UNIQUE FILTERING
  const fetchSimilarContent = useCallback(async () => {
    if (!anime) return;

    try {
      setSimilarLoading(true);
      
      // ✅ Fetch multiple pages to get a larger pool of content
      const pagePromises = [];
      const pagesToFetch = 3; // Fetch 3 pages for more variety
      
      for (let page = 1; page <= pagesToFetch; page++) {
        pagePromises.push(
          getAnimePaginated(page, 24, 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList,slug,likes,dislikes')
        );
      }
      
      const pagesData = await Promise.all(pagePromises);
      const allAnime = pagesData.flat();
      
      if (allAnime && allAnime.length > 0) {
        const currentId = anime.id || anime._id;
        const contentType = anime.contentType;
        
        // ✅ STEP 1: Filter by same content type and remove current anime
        const filteredByType = allAnime.filter(item => {
          const itemId = item.id || item._id;
          return itemId !== currentId && item.contentType === contentType;
        });
        
        // ✅ STEP 2: Remove duplicates by ID
        const uniqueAnimeMap = new Map();
        filteredByType.forEach(item => {
          const itemId = item.id || item._id;
          if (!uniqueAnimeMap.has(itemId)) {
            uniqueAnimeMap.set(itemId, item);
          }
        });
        
        const uniqueAnime = Array.from(uniqueAnimeMap.values());
        
        // ✅ STEP 3: Shuffle the array for randomness
        const shuffledAnime = shuffleArray(uniqueAnime);
        
        // ✅ STEP 4: Take first 12 for PC and 6 for mobile
        const limitedAnime = shuffledAnime.slice(0, 12);
        
        // ✅ STEP 5: If we don't have enough of same type, fetch other types as fallback
        if (limitedAnime.length < 6) {
          const otherContent = allAnime.filter(item => {
            const itemId = item.id || item._id;
            return itemId !== currentId && item.contentType !== contentType;
          });
          
          const shuffledOthers = shuffleArray(otherContent);
          const additionalItems = shuffledOthers.slice(0, 12 - limitedAnime.length);
          limitedAnime.push(...additionalItems);
        }
        
        setSimilarContent(limitedAnime);
      } else {
        setSimilarContent([]);
      }
    } catch (err) {
      console.error('Failed to fetch similar content:', err);
      setSimilarContent([]);
    } finally {
      setSimilarLoading(false);
    }
  }, [anime?.id, anime?.contentType]);

  // ✅ INITIAL FETCH FOR SIMILAR CONTENT AND LINK SETTINGS
  useEffect(() => {
    const initializeData = async () => {
      if (anime) {
        fetchSimilarContent();
        fetchLinkSettings();
      }
    };
    
    initializeData();
  }, [anime?.id, anime?.contentType, fetchSimilarContent]);

  // ✅ FETCH VOTE DATA WHEN ANIME CHANGES
  useEffect(() => {
    if (anime) {
      fetchVoteData();
    }
  }, [anime]);

  // ✅ UPDATED: FETCH FULL ANIME DETAILS IF NEEDED
  useEffect(() => {
    const fetchFullAnimeDetails = async () => {
      if (!anime) return;

      // If the passed anime already has full data, use it immediately
      if (anime.description && anime.genreList && anime.genreList.length > 0) {
        setFullAnime(anime);
        // Initialize likes/dislikes from anime data if available
        if (anime.likes !== undefined) setLikes(anime.likes);
        if (anime.dislikes !== undefined) setDislikes(anime.dislikes);
        setAnimeLoading(false);
        return;
      }

      setAnimeLoading(true);
      try {
        const animeIdentifier = anime.slug || anime._id || anime.id;
        
        if (!animeIdentifier) {
          console.warn('No identifier found for anime:', anime);
          setFullAnime(anime);
          setAnimeLoading(false);
          return;
        }

        const fields = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList,seoTitle,seoDescription,seoKeywords,slug,likes,dislikes';
        const fullAnimeData = await getAnimeByIdOrSlug(animeIdentifier, fields);
        
        if (fullAnimeData) {
          setFullAnime(fullAnimeData);
          // Initialize likes/dislikes from fetched data
          if (fullAnimeData.likes !== undefined) setLikes(fullAnimeData.likes);
          if (fullAnimeData.dislikes !== undefined) setDislikes(fullAnimeData.dislikes);
        } else {
          setFullAnime(anime);
        }
      } catch (err) {
        console.error('Failed to fetch full anime details:', err);
        setFullAnime(anime);
      } finally {
        setAnimeLoading(false);
      }
    };

    fetchFullAnimeDetails();
  }, [anime]);

  // ✅ FIXED: GENERATE SEO DATA WITH PROPER CANONICAL URL
  const getSEOData = () => {
    if (!displayAnime) {
      return {
        title: 'Anime Details | AnimeBing',
        description: 'Watch anime online in Hindi and English. Download anime episodes for free.',
        keywords: 'anime, watch anime online, hindi anime, english anime, anime download, anime streaming',
        ogImage: 'https://animebing.in/AnimeBinglogo.jpg',
        ogUrl: 'https://animebing.in/',
        canonicalUrl: 'https://animebing.in/', // ✅ Fixed canonical for error state
      };
    }

    // Build title with episode count / movie indicator
    let titleWithSuffix = displayAnime.title;
    if (displayAnime.contentType === 'Movie') {
      titleWithSuffix += ' (Movie)';
    } else if (displayAnime.contentType === 'Manga') {
      titleWithSuffix += ' Manga';
    } else {
      const epCount = displayAnime.currentEpisode || displayAnime.totalEpisodes;
      if (epCount) {
        titleWithSuffix += ` EP ${epCount}`;
      }
    }

    const seoTitle = displayAnime.seoTitle || 
      `${titleWithSuffix} | AnimeBing`;
    
    const seoDescription = displayAnime.seoDescription || 
      `Watch ${displayAnime.title} online ${displayAnime.subDubStatus ? `in ${displayAnime.subDubStatus}` : ''}. ${
        displayAnime.contentType === 'Movie' ? 'Full movie available' : 'All episodes available'
      } in HD quality. Free streaming and downloads on AnimeBing.`;
    
    // ✅ FIXED: Generate clean canonical URL without any parameters
    const cleanCanonicalUrl = `https://animebing.in/detail/${displayAnime.slug || displayAnime.id}`;
    
    return {
      title: seoTitle,
      description: seoDescription,
      keywords: displayAnime.seoKeywords || generateAnimeKeywords(displayAnime),
      ogImage: displayAnime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg',
      ogUrl: cleanCanonicalUrl, // ✅ Use clean URL for OG
      canonicalUrl: cleanCanonicalUrl, // ✅ CRITICAL: Pass canonical URL
    };
  };

  // Get SEO data
  const seoData = getSEOData();
  
  // ✅ ADDED: Log SEO data to verify in console
  console.log('🔍 SEO Data for', displayAnime?.title, seoData);
  
  // Optimize thumbnail URLs for different displays
  const mobileThumbnail = displayAnime?.thumbnail 
    ? optimizeImageUrl(displayAnime.thumbnail, 80, 112)
    : 'https://via.placeholder.com/80x112/1e293b/64748b?text=No+Image';
  
  const mobileThumbnailSrcSet = displayAnime?.thumbnail 
    ? generateSrcSet(displayAnime.thumbnail, 80, 112)
    : '';
  
  const desktopThumbnail = displayAnime?.thumbnail 
    ? optimizeImageUrl(displayAnime.thumbnail, 320, 448)
    : 'https://via.placeholder.com/320x448/1e293b/64748b?text=No+Image';
  
  const desktopThumbnailSrcSet = displayAnime?.thumbnail 
    ? generateSrcSet(displayAnime.thumbnail, 320, 448)
    : '';

  // Group episodes/chapters by session
  const itemsBySession = (isManga ? chapters : episodes)?.reduce((acc, item) => {
    const session = item.session || 1;
    if (!acc[session]) {
      acc[session] = [];
    }
    acc[session].push(item);
    return acc;
  }, {} as Record<number, any>) || {};

  // Get available sessions
  const availableSessions = Object.keys(itemsBySession).map(Number).sort((a, b) => a - b);

  // ✅ UPDATED: EPISODES/CHAPTERS FETCH
  useEffect(() => {
    const fetchContent = async () => {
      if (!anime) return;
      try {
        if (isManga) {
          setChaptersLoading(true);
          const chaptersData = await getChaptersByMangaId(anime.id || anime._id);
          setChapters(chaptersData);
        } else {
          setEpisodesLoading(true);
          const episodesData = await getEpisodesByAnimeId(anime.id || anime._id);
          setEpisodes(episodesData);
        }
        setError(null);
      } catch (err) {
        console.error(`Failed to fetch ${isManga ? 'chapters' : 'episodes'}:`, err);
        setError('Failed to load content');
        if (isManga) {
          setChapters([]);
        } else {
          setEpisodes([]);
        }
      } finally {
        if (isManga) {
          setChaptersLoading(false);
        } else {
          setEpisodesLoading(false);
        }
      }
    };

    fetchContent();
  }, [anime, isManga]);

  // ✅ UPDATED: Handle download click WITH GLOBAL LINK SETTINGS
  const handleDownloadClick = async (item: Episode | Chapter) => {
    try {
      const itemData = item as any;
      const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
      
      // First get only active links based on global settings
      const activeLinks = getActiveDownloadLinks(downloadLinks, linkSettings);
      
      console.log(`📊 Download stats: ${activeLinks.length}/${downloadLinks.length} active links`);
      
      if (activeLinks.length === 0) {
        alert(`⚠️ No active download links available. Admin has disabled all links for this content.`);
        return;
      }
      
      setDownloadingItem(itemData._id);
      
      // Randomly select from ACTIVE links only
      const randomIndex = Math.floor(Math.random() * activeLinks.length);
      const randomLink = activeLinks[randomIndex].url;
      
      console.log(`🎲 Selected active link ${randomIndex + 1}/${activeLinks.length}`);
      
      if (randomLink) {
        window.open(randomLink, '_blank');
      } else {
        alert('⚠️ No valid download link found!');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      alert('❌ Failed to start download. Please try again.');
    } finally {
      setDownloadingItem(null);
    }
  };

  // ✅ UPDATED: LIKE/DISLIKE/SHARE BUTTONS COMPONENT - WITH SHARE TEXT FOR MOBILE
  const VoteAndShareButtons = ({ isMobile = false }: { isMobile?: boolean }) => {
    const buttonSize = isMobile ? 'h-4 w-4' : 'h-5 w-5';
    const textSize = isMobile ? 'text-xs' : 'text-sm';
    const padding = isMobile ? 'px-2 py-1' : 'px-3 py-1.5';
    
    return (
      <div className="flex items-center gap-2 mt-4">
        {/* Like Button */}
        <button
          onClick={() => handleVote('like')}
          disabled={isVoting}
          className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 ${
            userVote === 'like'
              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:shadow-md'
          } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={userVote === 'like' ? 'Remove like' : 'Like this anime'}
          aria-label={userVote === 'like' ? 'Remove like' : 'Like this anime'}
        >
          {userVote === 'like' ? (
            <HeartIcon className={buttonSize} filled={true} />
          ) : (
            <HeartIcon className={buttonSize} filled={false} />
          )}
          <span className="font-bold">{likes}</span>
        </button>
        
        {/* Dislike Button */}
        <button
          onClick={() => handleVote('dislike')}
          disabled={isVoting}
          className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1 ${
            userVote === 'dislike'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:shadow-md'
          } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={userVote === 'dislike' ? 'Remove dislike' : 'Dislike this anime'}
          aria-label={userVote === 'dislike' ? 'Remove dislike' : 'Dislike this anime'}
        >
          {userVote === 'dislike' ? (
            <HandThumbDownIcon className={buttonSize} filled={true} />
          ) : (
            <HandThumbDownIcon className={buttonSize} filled={false} />
          )}
          <span className="font-bold">{dislikes}</span>
        </button>
        
        {/* ✅ UPDATED: Share Button - NOW SHOWS TEXT ON MOBILE TOO */}
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1 ${
            isSharing
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:shadow-md'
          } ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Share this anime with friends"
          aria-label="Share this anime"
        >
          {isSharing ? (
            <Spinner size="xs" className="mr-1" />
          ) : (
            <ShareIcon className={buttonSize} />
          )}
          {/* ✅ CHANGED: Now shows "Share" text on mobile too */}
          <span className="font-bold">Share</span>
        </button>
      </div>
    );
  };

  // ✅ UPDATED: Download button component - NEW PROFESSIONAL DESIGN + MOBILE SIZING
  const DownloadButton: React.FC<{ 
    item: Episode | Chapter; 
    className?: string;
    showText?: boolean;
    itemId: string;
    iconClassName?: string; // ✅ NEW: Allow custom icon size
  }> = ({ item, className = '', showText = true, itemId, iconClassName = 'h-4 w-4' }) => {
    const episodeItem = item as any;
    const downloadLinks: DownloadLink[] = episodeItem.downloadLinks || [];
    
    // Check how many links are active
    const activeLinks = getActiveDownloadLinks(downloadLinks, linkSettings);
    
    if (activeLinks.length === 0) {
      return (
        <button
          onClick={() => {
            alert(`⚠️ No active download links available.`);
          }}
          className={`${className} opacity-70 cursor-not-allowed`}
          title="Download links disabled"
          disabled
          aria-label="Download links disabled"
        >
          {showText ? 'Disabled' : <DownloadIcon className={iconClassName} />}
        </button>
      );
    }
    
    return (
      <button
        onClick={() => handleDownloadClick(item)}
        className={`${className} ${downloadingItem === itemId ? 'animate-pulse' : ''} group`}
        title="Download"
        disabled={downloadingItem === itemId || linkSettingsLoading}
        aria-label="Download"
      >
        {downloadingItem === itemId ? (
          showText ? (
            <span className="flex items-center gap-1">
              <Spinner size="xs" /> Downloading...
            </span>
          ) : (
            <Spinner size="sm" />
          )
        ) : linkSettingsLoading ? (
          showText ? 'Checking...' : <Spinner size="sm" />
        ) : (
          <>
            <DownloadIcon className={`${iconClassName} group-hover:scale-110 transition-transform`} />
            {showText && <span>Download</span>}
          </>
        )}
      </button>
    );
  };

  // ✅ LOADING STATE
  if (isLoading || !anime || animeLoading) {
    return <AnimeDetailSkeleton />;
  }

  const currentSessionItems = itemsBySession[selectedSession] || [];

  return (
    <>
      {/* ✅ FIXED: SEO COMPONENT WITH ALL REQUIRED PROPS */}
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        image={seoData.ogImage}
        url={seoData.ogUrl}
        canonicalUrl={seoData.canonicalUrl}  // ✅ CRITICAL: Ab canonicalUrl pass ho raha hai
        type="video.tv_show"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-3 py-4">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="group bg-slate-800/60 hover:bg-slate-700/80 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-2 transition-all duration-300 font-medium backdrop-blur-sm border border-slate-700 hover:border-purple-500/30 text-sm"
            aria-label="Go back to home page"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            Back to Home
          </button>

          {/* MOBILE VIEW */}
          <div className="lg:hidden">
            {/* Mobile Anime Card */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-xl mb-0">
              <div className="flex flex-col">
                <div className="flex gap-2 mb-0">
                  <div className="flex-shrink-0">
                    <div className="relative group">
                      <img
                        src={mobileThumbnail}
                        srcSet={mobileThumbnailSrcSet}
                        alt={displayAnime?.title}
                        className="w-20 h-28 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        width="80"
                        height="112"
                        sizes="80px"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/80x112/1e293b/64748b?text=No+Image';
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* ✅ UPDATED: Dynamic font size based on title length for mobile */}
                    <h1 className={`font-bold text-white mb-2 break-words ${
                      displayAnime?.title && displayAnime.title.length > 40 
                        ? 'text-sm leading-tight' 
                        : 'text-lg'
                    }`}>
                      {displayAnime?.title}
                    </h1>
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                        {displayAnime?.releaseYear}
                      </span>
                      <span
                        className={`px-4 py-1 rounded text-xs font-bold whitespace-nowrap ${
                          displayAnime?.status === 'Ongoing'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                        }`}
                      >
                        {displayAnime?.status}
                      </span>
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap">
                        {displayAnime?.contentType}
                      </span>
                      {!isManga && displayAnime?.subDubStatus && (
                        <div className="flex flex-wrap gap-0">
                          {displayAnime.subDubStatus
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes('hindi dub'.toLowerCase()) && (
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded text-xs font-bold">
                              Hindi Dub
                            </span>
                          )}

                          {displayAnime.subDubStatus
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes('hindi sub'.toLowerCase()) && (
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded text-xs font-bold">
                              Hindi Sub
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mt-2">
                  <div className="flex flex-wrap gap-2">
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold">Year:</span> {displayAnime?.releaseYear || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold">Status:</span> {displayAnime?.status || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold">Type:</span> {displayAnime?.contentType || 'N/A'}
                    </div>
                  </div>
                  
                  {/* ✅ MOVED: LIKE/DISLIKE/SHARE BUTTONS MOVED BELOW GENRES */}
                  {/* First show genres, then buttons */}
                  
                  <div>
                    <div className="flex flex-wrap gap-1">
                      {displayAnime?.genreList?.map((genre, index) => (
                        <span
                          key={index}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300 whitespace-nowrap"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ✅ UPDATED: LIKE/DISLIKE/SHARE BUTTONS FOR MOBILE - NOW BELOW GENRES */}
                  <VoteAndShareButtons isMobile={true} />
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">Description</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {displayAnime?.description || 'No description available for this content.'}
                  </p>
                </div>
              </div>
            </div>

            {availableSessions.length > 1 && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 mt-0 border border-slate-700 shadow-xl">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {availableSessions.map(session => (
                    <button
                      key={session}
                      onClick={() => setSelectedSession(session)}
                      className={`flex-shrink-0 px-3 py-1 rounded-lg font-medium transition-all duration-300 text-xs ${
                        selectedSession === session
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'
                      }`}
                      aria-label={`Select session ${session}`}
                    >
                      Session {session}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 mt-0 border border-slate-700 shadow-xl">
              {/* ✅ UPDATED: Removed episode count from heading */}
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-white">
                  {getContentLabel()}
                </h2>
              </div>
              {(isManga ? chaptersLoading : episodesLoading) ? (
                <div className="flex justify-center py-6">
                  <div className="text-center">
                    <Spinner size="sm" text={`Loading ${getContentLabel().toLowerCase()}...`} />
                  </div>
                </div>
              ) : error && !(isManga ? chaptersLoading : episodesLoading) ? (
                <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-red-400 text-xs">⚠️</div>
                    <p className="text-red-300 text-xs">{error}</p>
                  </div>
                </div>
              ) : currentSessionItems.length === 0 ? (
                <div className="text-center py-6">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">
                      No {getContentLabel()} Available
                    </h3>
                    <p className="text-slate-400 text-xs">
                      {getNoContentMessage()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentSessionItems
                    .sort((a, b) => {
                      if (isManga) {
                        return (a as any).chapterNumber - (b as any).chapterNumber;
                      } else {
                        return (a as any).episodeNumber - (b as any).episodeNumber;
                      }
                    })
                    .map((item, index) => {
                      const itemData = item as any;
                      
                      return (
                        <div
                          key={itemData._id || index}
                          className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-lg p-2 transition-all duration-200 border border-slate-600 hover:border-purple-500/50 backdrop-blur-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium text-xs break-words">
                                {itemData.title ||
                                  `${getContentLabelSingular()}`}
                              </h3>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {/* ✅ UPDATED: Mobile download button - larger size with text */}
                              <DownloadButton
                                item={item as Episode | Chapter}
                                itemId={itemData._id}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 group text-xs sm:text-sm whitespace-nowrap"
                                showText={true}
                                iconClassName="h-4 w-4 sm:h-5 w-5"
                              />
                              {/* ✅ DEV ONLY: Download Page button - only in development */}
                              {import.meta.env.DEV && episodeToPageMap.has(itemData.episodeNumber) && (
                                <>
                                  {episodeToPageMap.get(itemData.episodeNumber)!.map((page, idx) => (
                                    <Link
                                      key={page._id || idx}
                                      to={`/download/${page.slug}`}
                                      className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg text-xs font-medium ml-1 flex items-center justify-center"
                                      title={page.title}
                                    >
                                      <span className="text-xs">☠️</span>
                                      {page.buttonTitle && <span className="ml-1 hidden sm:inline">{page.buttonTitle}</span>}
                                    </Link>
                                  ))}
                                </>
                              )}
                              <ReportButton
                                animeId={anime.id || anime._id}
                                episodeId={itemData._id}
                                episodeNumber={
                                  isManga ? itemData.chapterNumber : itemData.episodeNumber
                                }
                                animeTitle={anime.title}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {/* ✅ ADDED: Tips section for mobile view - only for non-manga content */}
              {!isManga && (
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-lg">
                  <h4 className="text-xs font-bold text-blue-300 mb-2 flex items-center gap-1">
                    <span className="text-blue-400">💡</span> Important Tips for Download and watching:
                  </h4>
                  <ul className="space-y-2 text-xs text-blue-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>1. Download at least 1 and at most 4 files or movies at a time. This helps keep your download speed fast. If you download more than 4 files at once, the speed will slow down. Once these files finish downloading, you can start downloading more.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>2. If Wrong Audio you can Fix: Open MX Player → click Audio → Change track to Hindi / Tamil / Telugu / English / Japanese.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>3. If you see an ad before download: Complete the short ad (if any) to unlock the download link. After the download finishes, you can watch the movie/episode offline in any media player (MX Player, VLC, etc.) without interruptions.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* PC VIEW - UPDATED: BUTTONS MOVED BELOW GENRES */}
          <div className="hidden lg:block">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-700 shadow-xl">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-shrink-0 mx-auto lg:mx-0">
                  <div className="relative group">
                    <img
                      src={desktopThumbnail}
                      srcSet={desktopThumbnailSrcSet}
                      alt={displayAnime?.title}
                      className="w-full max-w-xs lg:w-50 h-auto lg:h-[23rem] object-cover rounded-xl shadow-2xl group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      width="320"
                      height="448"
                      sizes="(max-width: 1024px) 80px, 320px"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/320x448/1e293b/64748b?text=No+Image';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    {/* ✅ UPDATED: Dynamic font size for PC based on title length */}
                    <h1 className={`font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-1 ${
                      displayAnime?.title && displayAnime.title.length > 60 
                        ? 'text-xl lg:text-2xl' 
                        : 'text-2xl lg:text-3xl'
                    }`}>
                      {displayAnime?.title}
                    </h1>
                    
                    <p className="text-slate-300 leading-relaxed text-lg mt-1">
                      {displayAnime?.description || 'No description available for this content.'}
                    </p>
                    
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                        {displayAnime?.releaseYear}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg font-bold ${
                          displayAnime?.status === 'Ongoing'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                        }`}
                      >
                        {displayAnime?.status}
                      </div>
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                        {displayAnime?.contentType}
                      </div>
                      {!isManga && displayAnime?.subDubStatus && (
                        <div className="flex flex-wrap gap-2">
                          {displayAnime.subDubStatus
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes('hindi dub'.toLowerCase()) && (
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                              Hindi Dub
                            </span>
                          )}

                          {displayAnime.subDubStatus
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes('hindi sub'.toLowerCase()) && (
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                              Hindi Sub
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm font-medium mr-3">Genres</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {displayAnime?.genreList?.map((genre, index) => (
                          <span
                            key={index}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 cursor-pointer"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* ✅ UPDATED: LIKE/DISLIKE/SHARE BUTTONS FOR PC - NOW BELOW GENRES */}
                  <VoteAndShareButtons />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-1 border border-slate-700 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                {/* ✅ UPDATED: Removed episode count from heading */}
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  {getContentLabel()}
                </h2>
                {availableSessions.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {availableSessions.map(session => (
                      <button
                        key={session}
                        onClick={() => setSelectedSession(session)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                          selectedSession === session
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'
                        }`}
                        aria-label={`Select session ${session}`}
                      >
                        Session {session}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(isManga ? chaptersLoading : episodesLoading) ? (
                <div className="flex justify-center py-12">
                  <div className="text-center">
                    <Spinner size="lg" text={`Loading ${getContentLabel().toLowerCase()}...`} />
                  </div>
                </div>
              ) : error && !(isManga ? chaptersLoading : episodesLoading) ? (
                <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-4 mb-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="text-red-400 text-lg">⚠️</div>
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              ) : currentSessionItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-slate-800/50 rounded-2xl p-12 max-w-md mx-auto border border-slate-700">
                    <h3 className="text-xl font-semibold text-slate-300 mb-3">
                      No {getContentLabel()} Available
                    </h3>
                    <p className="text-slate-400">
                      {getNoContentMessage()}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {currentSessionItems
                      .sort((a, b) => {
                        if (isManga) {
                          return (a as any).chapterNumber - (b as any).chapterNumber;
                        } else {
                          return (a as any).episodeNumber - (b as any).episodeNumber;
                        }
                      })
                      .map((item, index) => {
                        const itemData = item as any;
                        
                        return (
                          <div
                            key={itemData._id || index}
                            className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-xl p-4 transition-all duration-300 border border-slate-600 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 backdrop-blur-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-lg truncate">
                                  {itemData.title ||
                                    `${getContentLabelSingular()}`}
                                </h3>
                                {itemData.session > 1 && (
                                  <p className="text-slate-400 text-sm mt-1">Session {itemData.session}</p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <DownloadButton
                                  item={item as Episode | Chapter}
                                  itemId={itemData._id}
                                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium flex items-center gap-2 group"
                                  showText={true}
                                  iconClassName="h-4 w-4"
                                />
                                {/* ✅ DEV ONLY: Multiple Download Page buttons - only in development */}
                                {import.meta.env.DEV && episodeToPageMap.has(itemData.episodeNumber) && (
                                  <div className="flex gap-1 flex-wrap">
                                    {episodeToPageMap.get(itemData.episodeNumber)!.map((page, idx) => (
                                      <Link
                                        key={page._id || idx}
                                        to={`/download/${page.slug}`}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 flex items-center gap-1"
                                        title={page.title}
                                      >
                                        <span className="text-sm">☠️</span>
                                        {page.buttonTitle || page.title}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                                <div className="scale-90">
                                  <ReportButton
                                    animeId={anime.id || anime._id}
                                    episodeId={itemData._id}
                                    episodeNumber={
                                      isManga ? itemData.chapterNumber : itemData.episodeNumber
                                    }
                                    animeTitle={anime.title}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {/* ✅ ADDED: Tips section for PC view - only for non-manga content */}
                  {!isManga && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-xl">
                      <h4 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                        <span className="text-blue-400">💡</span> Important Tips for Download and watching:
                      </h4>
                      <ul className="space-y-2 text-sm text-blue-300">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>1. Download at least 1 and at most 4 files or movies at a time. This helps keep your download speed fast. If you download more than 4 files at once, the speed will slow down. Once these files finish downloading, you can start downloading more.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>2. If Wrong Audio you can Fix: Open MX Player → click Audio → Change track to Hindi / Tamil / Telugu / English / Japanese.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>3. If you see an ad before download: Complete the short ad (if any) to unlock the download link. After the download finishes, you can watch the movie/episode offline in any media player (MX Player, VLC, etc.) without interruptions.</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ✅ UPDATED: MORE LIKE THIS SECTION FOR PC VIEW - WITH RANDOM & UNIQUE CONTENT */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-6">
                More {displayAnime?.contentType === 'Movie' ? 'Movies' : displayAnime?.contentType === 'Manga' ? 'Manga' : 'Anime'}
              </h2>
              
              {similarLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" text="Loading similar content..." />
                </div>
              ) : similarContent.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-slate-800/50 rounded-2xl p-8 max-w-md mx-auto border border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">
                      No Similar Content Found
                    </h3>
                    <p className="text-slate-400">
                      We couldn't find similar {displayAnime?.contentType?.toLowerCase()} at the moment.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {similarContent.slice(0, 12).map((item, index) => (
                    <div 
                      key={item.id || item._id || index} 
                      className="relative cursor-pointer"
                      onClick={() => onAnimeSelect(item)}
                    >
                      <AnimeCard
                        anime={item}
                        onClick={() => {}}
                        index={index}
                        showStatus={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ✅ UPDATED: MORE LIKE THIS SECTION FOR MOBILE VIEW - WITH RANDOM & UNIQUE CONTENT */}
          <div className="lg:hidden mt-8">
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
              More {displayAnime?.contentType === 'Movie' ? 'Movies' : displayAnime?.contentType === 'Manga' ? 'Manga' : 'Anime'}
            </h2>
            
            {similarLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" text="Loading similar content..." />
              </div>
            ) : similarContent.length === 0 ? (
              <div className="text-center py-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-base font-semibold text-slate-300 mb-2">
                    No Similar Content Found
                  </h3>
                  <p className="text-slate-400 text-sm">
                    We couldn't find similar {displayAnime?.contentType?.toLowerCase()} at the moment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {similarContent.slice(0, 6).map((item, index) => (
                  <div 
                    key={item.id || item._id || index} 
                    className="relative cursor-pointer"
                    onClick={() => onAnimeSelect(item)}
                  >
                    <AnimeCard
                      anime={item}
                      onClick={() => {}}
                      index={index}
                      showStatus={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AnimeDetailPage;