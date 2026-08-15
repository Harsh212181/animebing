 // components/AnimeDetailPage.tsx - BANNER HERO + LIKE COUNT FORMATTING + DESCRIPTION SHOW MORE
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Anime, Episode, Chapter, DownloadPage } from '../src/types';
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
import ShareIcon from './icons/ShareIcon';
import { captureTokenFromUrl, advanceFunnel, completeFunnel, appendTokenToPath } from '../utils/clickFunnel';

// Simple SVG Icons for Like/Dislike
const HeartIcon = ({ className = "w-5 h-5", filled = false }: { className?: string, filled?: boolean }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const HandThumbDownIcon = ({ className = "w-5 h-5", filled = false }: { className?: string, filled?: boolean }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
  </svg>
);

// ✅ YouTube-style count formatter
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    const millions = (count / 1000000).toFixed(1);
    return millions.endsWith('.0') ? millions.slice(0, -2) + 'M' : millions + 'M';
  }
  if (count >= 1000) {
    const thousands = (count / 1000).toFixed(1);
    return thousands.endsWith('.0') ? thousands.slice(0, -2) + 'K' : thousands + 'K';
  }
  return count.toString();
};

// Interfaces
interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

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

// API base
const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

// Shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ✅ q_auto:eco — quality same, file ~30% kam
const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url || '';
  try {
    if (url.includes(`w_${width},h_${height},c_fill`)) return url;
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    return `${baseUrl}/upload/f_webp,q_auto:eco,w_${width},h_${height},c_fill/${imagePath}`;
  } catch (error) {
    return url;
  }
};

// ✅ 1.5x srcSet
const generateSrcSet = (url: string, baseWidth: number, baseHeight: number): string => {
  if (!url || !url.includes('cloudinary.com')) return '';
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    return `
      ${baseUrl}/upload/f_webp,q_auto:eco,w_${baseWidth},h_${baseHeight},c_fill/${imagePath} ${baseWidth}w,
      ${baseUrl}/upload/f_webp,q_auto:eco,w_${Math.round(baseWidth * 1.5)},h_${Math.round(baseHeight * 1.5)},c_fill/${imagePath} ${Math.round(baseWidth * 1.5)}w
    `;
  } catch (error) {
    return '';
  }
};

// Active links helper
const getActiveDownloadLinks = (downloadLinks: DownloadLink[], linkSettings: LinkSettings): DownloadLink[] => {
  if (!downloadLinks || downloadLinks.length === 0) return [];
  const activeLinks: DownloadLink[] = [];
  downloadLinks.forEach((link, index) => {
    const linkKey = `link${index + 1}` as keyof LinkSettings;
    if (linkSettings[linkKey] && link.url && link.url.trim() !== '') {
      activeLinks.push(link);
    }
  });
  return activeLinks;
};

// SEO keywords helper
const generateAnimeKeywords = (anime: Anime): string => {
  if (!anime) return 'anime, watch anime online, hindi anime, english anime';
  let keywords: string[] = [];
  if (anime.subDubStatus) {
    const statuses = anime.subDubStatus.split(',').map(s => s.trim().toLowerCase());
    if (statuses.includes('hindi dub')) keywords.push(`${anime.title} hindi dubbed`, `watch ${anime.title} hindi dub`);
    if (statuses.includes('hindi sub')) keywords.push(`${anime.title} hindi subbed`, `watch ${anime.title} hindi sub`);
    if (statuses.includes('english sub')) keywords.push(`${anime.title} english sub`, `watch ${anime.title} english subbed`);
  }
  keywords.push(`watch ${anime.title} online`, `${anime.title} free download`, `${anime.title} hd`, `${anime.title} streaming`, `${anime.title} anime`);
  if (anime.genreList) anime.genreList.forEach(genre => keywords.push(`${anime.title} ${genre.toLowerCase()} anime`, `${genre.toLowerCase()} anime`));
  if (anime.contentType) {
    if (anime.contentType === 'Movie') keywords.push(`${anime.title} movie`, `watch ${anime.title} movie online`);
    else if (anime.contentType === 'Manga') keywords.push(`${anime.title} manga`, `read ${anime.title} manga online`);
    else keywords.push(`${anime.title} episodes`, `watch ${anime.title} episodes`);
  }
  if (anime.releaseYear) keywords.push(`${anime.title} ${anime.releaseYear}`);
  return [...new Set(keywords)].join(', ');
};

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack, onAnimeSelect, isLoading = false }) => {
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  // ✅ NEW — ref to prevent auto-select from overriding user's manual session click
  const hasAutoSelectedSession = React.useRef(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fullAnime, setFullAnime] = useState<Anime | null>(null);
  const [animeLoading, setAnimeLoading] = useState(true);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    link1: true, link2: true, link3: true, link4: true, link5: true
  });
  const [linkSettingsLoading, setLinkSettingsLoading] = useState(false);
  const [similarContent, setSimilarContent] = useState<Anime[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [likes, setLikes] = useState<number>(0);
  const [dislikes, setDislikes] = useState<number>(0);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [downloadPages, setDownloadPages] = useState<DownloadPage[]>([]);

  // ✅ Show More/Less for description
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const isManga = anime?.contentType === 'Manga';
  const isMovie = anime?.contentType === 'Movie';

  // ✅ Funnel: Capture token from URL on mount
  useEffect(() => {
    captureTokenFromUrl();
  }, []);

  // ✅ Funnel: Advance stage when anime is viewed
  // Option B: Sirf anime._id use karo (simplest fallback)
  useEffect(() => {
    const id = anime?._id || anime?.id;
    if (id) {
      advanceFunnel(id as string);
    }
  }, [anime?._id, anime?.id]);

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

  const displayAnime = fullAnime || anime;

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

  const episodeToPageMap = useMemo(() => {
    const map = new Map<number, DownloadPage[]>();
    downloadPages.forEach(page => {
      if (!page.episodeNumber) return;
      if (!map.has(page.episodeNumber)) map.set(page.episodeNumber, []);
      map.get(page.episodeNumber)!.push(page);
    });
    return map;
  }, [downloadPages]);

  const fetchVoteData = async () => {
    if (!anime) return;
    try {
      const animeId = anime._id || anime.id;
      if (!animeId) return;
      const response = await fetch(`${API_BASE}/anime/${animeId}/vote-status`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLikes(data.data.likes || 0);
          setDislikes(data.data.dislikes || 0);
          setUserVote(data.data.userVote);
        }
      }
    } catch (error) {
      console.error('Error fetching vote data:', error);
    }
  };

  const handleVote = async (voteType: 'like' | 'dislike') => {
    if (!anime || isVoting) return;
    setIsVoting(true);
    try {
      const animeId = anime._id || anime.id;
      if (!animeId) return;
      const response = await fetch(`${API_BASE}/anime/${animeId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLikes(data.data.likes);
          setDislikes(data.data.dislikes);
          setUserVote(data.data.userVote);
          if (fullAnime) setFullAnime({ ...fullAnime, likes: data.data.likes, dislikes: data.data.dislikes });
        }
      } else {
        const errorData = await response.json();
        console.error('Vote failed:', errorData);
        alert(`Vote failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleShare = async () => {
    if (!displayAnime) return;
    setIsSharing(true);
    try {
      const shareData = {
        title: `Watch ${displayAnime.title} on AnimeBing`,
        text: `Check out "${displayAnime.title}" on AnimeBing - Watch anime online in HD quality with Hindi and English subtitles!`,
        url: window.location.href,
      };
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard! 📋');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard! 📋');
      } catch (clipboardError) {
        alert('Failed to copy link.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const fetchLinkSettings = async (animeId?: string) => {
    try {
      setLinkSettingsLoading(true);
      const url = animeId
        ? `${API_BASE}/anime-link-control/effective/${animeId}`
        : `${API_BASE}/link-settings/effective`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setLinkSettings(json.data || json);
    } catch (err) {
      console.error('Error fetching link settings:', err);
      setLinkSettings({ link1: true, link2: true, link3: true, link4: true, link5: true });
    } finally {
      setLinkSettingsLoading(false);
    }
  };

  const fetchSimilarContent = useCallback(async () => {
    if (!anime) return;
    try {
      setSimilarLoading(true);
      const pagesToFetch = 3;
      const pagePromises = Array.from({ length: pagesToFetch }, (_, i) =>
        getAnimePaginated(i + 1, 24, 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList,slug,likes,dislikes')
      );
      const pagesData = await Promise.all(pagePromises);
      const allAnime = pagesData.flat();
      const currentId = anime.id || anime._id;
      const contentType = anime.contentType;
      let filteredByType = allAnime.filter(item => {
        const itemId = item.id || item._id;
        return itemId !== currentId && item.contentType === contentType;
      });
      const uniqueMap = new Map();
      filteredByType.forEach(item => {
        const id = item.id || item._id;
        if (!uniqueMap.has(id)) uniqueMap.set(id, item);
      });
      let unique = Array.from(uniqueMap.values());
      unique = shuffleArray(unique);
      const selected = unique.slice(0, 12);
      setSimilarContent(selected);
    } catch (err) {
      console.error('Failed to fetch similar content:', err);
      setSimilarContent([]);
    } finally {
      setSimilarLoading(false);
    }
  }, [anime?.id, anime?.contentType]);

  useEffect(() => {
    if (anime) {
      fetchSimilarContent();
      fetchLinkSettings(anime._id || anime.id);
    }
  }, [anime?.id, anime?.contentType, fetchSimilarContent]);

  useEffect(() => {
    if (anime) fetchVoteData();
  }, [anime]);

  // ✅ FIX: currentEpisode jaisi baar-baar badalne wali field ke liye
  // shortcut hata diya — hamesha fresh fetch karo taaki naye sync
  // ke baad ka currentEpisode turant detail page par reflect ho
  useEffect(() => {
    const fetchFullAnimeDetails = async () => {
      if (!anime) return;

      setAnimeLoading(true);
      try {
        const identifier = anime.slug || anime._id || anime.id;
        if (!identifier) {
          setFullAnime(anime);
          setAnimeLoading(false);
          return;
        }
        // ✅ FIX: currentEpisode field ko projection list mein add kiya —
        // pehle ye missing thi isliye backend se aaya fresh data bhi
        // currentEpisode kabhi nahi le kar aata tha
        const fullAnimeData = await getAnimeByIdOrSlug(
          identifier,
          'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList,seoTitle,seoDescription,seoKeywords,slug,likes,dislikes,createdAt,updatedAt,currentEpisode'
        );
        if (fullAnimeData) {
          setFullAnime(fullAnimeData);
        } else {
          setFullAnime(anime);
        }
      } catch (err) {
        setFullAnime(anime);
      } finally {
        setAnimeLoading(false);
      }
    };
    fetchFullAnimeDetails();
  }, [anime]);

  const seoData = {
    title: displayAnime?.seoTitle || `${displayAnime?.title || 'Anime'} | AnimeBing`,
    description: displayAnime?.description || displayAnime?.seoDescription || 'Watch anime online in high quality',
    keywords: displayAnime?.seoKeywords || generateAnimeKeywords(displayAnime!),
    ogImage: displayAnime?.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg',
    ogUrl: `https://animebing.in/detail/${displayAnime?.slug || displayAnime?.id}`,
    canonicalUrl: `https://animebing.in/detail/${displayAnime?.slug || displayAnime?.id}`,
    publishedTime: displayAnime?.createdAt,
    modifiedTime: displayAnime?.updatedAt,
  };

  // Banner hero images
  const posterThumbnail = displayAnime?.thumbnail ? optimizeImageUrl(displayAnime.thumbnail, 193, 289) : 'https://via.placeholder.com/193x289/1e293b/64748b?text=No+Image';
  const posterThumbnailSrcSet = displayAnime?.thumbnail ? generateSrcSet(displayAnime.thumbnail, 193, 289) : '';
  const bgWide = displayAnime?.thumbnail ? optimizeImageUrl(displayAnime.thumbnail, 1400, 400) : '';
  const bgWideSrcSet = displayAnime?.thumbnail ? `
    ${optimizeImageUrl(displayAnime.thumbnail, 700, 200)} 700w,
    ${optimizeImageUrl(displayAnime.thumbnail, 1400, 400)} 1400w,
    ${optimizeImageUrl(displayAnime.thumbnail, 2100, 600)} 2100w
  ` : '';

  const currentEpisode = (displayAnime as any)?.currentEpisode || 0;

  const itemsBySession = (isManga ? chapters : episodes)?.reduce((acc, item) => {
    const session = item.session || 1;
    if (!acc[session]) acc[session] = [];
    acc[session].push(item);
    return acc;
  }, {} as Record<number, any>) || {};
  const availableSessions = Object.keys(itemsBySession).map(Number).sort((a, b) => a - b);

  // ✅ NEW — jab sessions load ho jayein, default me sabse latest session select karo
  useEffect(() => {
    if (availableSessions.length > 0 && !hasAutoSelectedSession.current) {
      const latestSession = Math.max(...availableSessions);
      setSelectedSession(latestSession);
      hasAutoSelectedSession.current = true;
    }
  }, [availableSessions]);

  // ✅ NEW — jab anime change ho (naya anime page khule), auto-select flag reset karo
  useEffect(() => {
    hasAutoSelectedSession.current = false;
  }, [anime?.id, anime?._id]);

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
        setError('Failed to load content');
      } finally {
        if (isManga) setChaptersLoading(false);
        else setEpisodesLoading(false);
      }
    };
    fetchContent();
  }, [anime, isManga]);

  const handleDownloadClick = async (item: Episode | Chapter) => {
    const itemData = item as any;
    const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
    const activeLinks = getActiveDownloadLinks(downloadLinks, linkSettings);
    if (activeLinks.length === 0) {
      alert('⚠️ No active download links available.');
      return;
    }
    setDownloadingItem(itemData._id);
    const randomLink = activeLinks[Math.floor(Math.random() * activeLinks.length)].url;

    if (randomLink) {
      // ✅ Yahan funnel COMPLETE nahi karte — chahe link cuty.io/shrinkme/
      // gplinks/linkjust ho ya seedha Link 5 — sab eventually usi
      // animebing.in/download/:slug page par le jaate hain (short-link
      // services bhi apne ad-gate ke baad wahin redirect karte hain).
      // Naye tab ka sessionStorage automatically clone hota hai (window.open
      // ke through), isliye token us tab me apne aap available rahega —
      // URL me alag se jodne ki zaroorat nahi.
      // Funnel sirf tab complete hoga jab user us page par (DownloadLinkPage)
      // asal Watch/Download button dabayega — sab links ke liye same tareeka.
      window.open(randomLink, '_blank');
    } else {
      alert('⚠️ No valid download link found!');
    }
    setDownloadingItem(null);
  };

  const VoteButtons = ({ isMobile = false }: { isMobile?: boolean }) => {
    const buttonSize = isMobile ? 'h-4 w-4' : 'h-5 w-5';
    const textSize = isMobile ? 'text-xs' : 'text-sm';
    const padding = isMobile ? 'px-3 py-1.5' : 'px-4 py-2';
    return (
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => handleVote('like')} disabled={isVoting} className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg ${userVote === 'like' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-pink-600/30 hover:shadow-pink-600/50' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600 hover:border-pink-500/50'} ${isVoting ? 'opacity-50 cursor-not-allowed' : ''} transform hover:scale-105`}>
          <HeartIcon className={buttonSize} filled={userVote === 'like'} />
          <span className="font-bold">{formatCount(likes)}</span>
        </button>
        <button onClick={() => handleVote('dislike')} disabled={isVoting} className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg ${userVote === 'dislike' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/30 hover:shadow-blue-600/50' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600 hover:border-blue-500/50'} ${isVoting ? 'opacity-50 cursor-not-allowed' : ''} transform hover:scale-105`}>
          <HandThumbDownIcon className={buttonSize} filled={userVote === 'dislike'} />
          <span className="font-bold">{formatCount(dislikes)}</span>
        </button>
        <button onClick={handleShare} disabled={isSharing} className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg ${isSharing ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600 hover:border-emerald-500/50'} ${isSharing ? 'opacity-50 cursor-not-allowed' : ''} transform hover:scale-105`}>
          {isSharing ? <Spinner size="xs" className="mr-1" /> : <ShareIcon className={buttonSize} />}
          <span className="font-bold">Share</span>
        </button>
      </div>
    );
  };

  const DownloadButton: React.FC<{ item: Episode | Chapter; className?: string; showText?: boolean; itemId: string; iconClassName?: string }> = ({ item, className = '', showText = true, itemId, iconClassName = 'h-4 w-4' }) => {
    const episodeItem = item as any;
    const downloadLinks: DownloadLink[] = episodeItem.downloadLinks || [];
    const activeLinks = getActiveDownloadLinks(downloadLinks, linkSettings);
    if (activeLinks.length === 0) {
      return (
        <button onClick={() => alert('⚠️ No active download links available.')} className={`${className} opacity-70 cursor-not-allowed`} disabled>
          {showText ? 'Disabled' : <DownloadIcon className={iconClassName} />}
        </button>
      );
    }
    return (
      <button onClick={() => handleDownloadClick(item)} className={`${className} ${downloadingItem === itemId ? 'animate-pulse' : ''} group`} disabled={downloadingItem === itemId || linkSettingsLoading}>
        {downloadingItem === itemId ? (showText ? <span className="flex items-center gap-1"><Spinner size="xs" /> Downloading...</span> : <Spinner size="sm" />) : (linkSettingsLoading ? (showText ? 'Checking...' : <Spinner size="sm" />) : (<><DownloadIcon className={`${iconClassName} group-hover:scale-110 transition-transform`} />{showText && <span>Watch</span>}</>))}
      </button>
    );
  };

  if (isLoading || !anime || animeLoading) {
    return <AnimeDetailSkeleton />;
  }

  const currentSessionItems = itemsBySession[selectedSession] || [];
  const descriptionText = displayAnime?.description || '';
  const truncateThreshold = 300;

  return (
    <>
      <SEO {...seoData} />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="w-full px-3 py-4">
          <button
            onClick={onBack}
            className="group bg-slate-800/60 hover:bg-slate-700/80 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-2 transition-all duration-300 font-medium backdrop-blur-sm border border-slate-700 hover:border-purple-500/30 text-sm"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            Back to Home
          </button>

          {/* ========== BANNER HERO (from DownloadLinkPage) ========== */}
          {/* MOBILE BANNER */}
          <div className="block lg:hidden mb-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl rounded-2xl h-[200px]">
              <div className="absolute inset-0">
                <img
                  src={bgWide}
                  srcSet={bgWideSrcSet}
                  sizes="100vw"
                  alt={displayAnime?.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/800x400/1e293b/64748b?text=No+Image'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 to-slate-950/70"></div>
              </div>

              <div className="relative z-10 h-full flex items-center px-4">
                <div className="flex items-center gap-3 w-full">
                  <div className="relative w-28 flex-shrink-0">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-2xl shadow-purple-900/50 ring-2 ring-purple-500/30">
                      <img
                        src={posterThumbnail}
                        srcSet={posterThumbnailSrcSet}
                        sizes="112px"
                        alt={displayAnime?.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/193x289/1e293b/64748b?text=No+Image'; }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="space-y-2">
                      <h1 className="text-base font-bold text-white line-clamp-2 leading-tight drop-shadow-lg">
                        {displayAnime?.title}
                      </h1>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${displayAnime?.status === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                          {displayAnime?.status}
                        </span>
                        {displayAnime?.subDubStatus && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600/80 text-white border border-purple-500">
                            {displayAnime.subDubStatus}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800/60 text-slate-300 border border-slate-700">
                          {displayAnime?.releaseYear}
                        </span>
                        {!isMovie && currentEpisode > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gradient-to-r from-red-600 to-orange-600 text-white border border-red-500/30">
                            {isManga ? 'Ch' : 'EP'} {currentEpisode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DESKTOP BANNER */}
          <div className="hidden lg:block mb-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl rounded-2xl h-[330px]">
              <div className="absolute inset-0">
                <img
                  src={bgWide}
                  srcSet={bgWideSrcSet}
                  sizes="100vw"
                  alt={displayAnime?.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/1400x400/1e293b/64748b?text=No+Image'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
              </div>
              <div className="relative z-10 h-full flex items-center px-10">
                <div className="flex items-center gap-8 w-full h-full">
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-1.5">
                      <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent blur-xl opacity-50"></div>
                    </div>
                    <div className="relative w-48">
                      <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-purple-900/30 ring-2 ring-purple-500/30 aspect-[2/3]">
                        <img
                          src={posterThumbnail}
                          srcSet={posterThumbnailSrcSet}
                          sizes="192px"
                          alt={displayAnime?.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/193x289/1e293b/64748b?text=No+Image'; }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 py-4 h-full flex flex-col justify-center">
                    <div className="space-y-3">
                      <h1 className="text-3xl font-bold text-white leading-tight drop-shadow-lg">
                        {displayAnime?.title}
                      </h1>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${displayAnime?.status === 'Ongoing' ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-500/30'}`}>
                          {displayAnime?.status}
                        </span>
                        <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-slate-800/40 to-slate-900/40 text-slate-300 border border-slate-700">
                          {displayAnime?.releaseYear}
                        </span>
                        {displayAnime?.subDubStatus && (
                          <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-700 text-white border border-purple-500">
                            {displayAnime.subDubStatus}
                          </span>
                        )}
                        {!isMovie && currentEpisode > 0 && (
                          <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-red-600 to-orange-600 text-white border border-red-500/30">
                            {isManga ? 'Ch' : 'EP'} {currentEpisode}
                          </span>
                        )}
                      </div>
                      {descriptionText && (
                        <p className="text-slate-300 text-xs leading-relaxed max-w-2xl line-clamp-2">
                          {descriptionText}
                        </p>
                      )}
                      {displayAnime?.genreList && displayAnime.genreList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {displayAnime.genreList.slice(0, 4).map((genre, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-xs bg-slate-800/40 text-slate-300 border border-slate-700 hover:bg-slate-700/50 transition-colors">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-5">
                      <VoteButtons />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========== DESCRIPTION / GENRES / VOTE PANEL (below banner) ========== */}
          <div className="mb-6 lg:mb-8">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl lg:rounded-3xl p-5 lg:p-8 border border-slate-700/50 shadow-2xl">
              <div className="space-y-4 lg:space-y-6">
                {/* Genres (mobile first with line separator) */}
                {displayAnime?.genreList && displayAnime.genreList.length > 0 && (
                  <div className="order-1 lg:order-none">
                    <span className="text-slate-400 text-xs lg:text-sm font-medium mr-3">Genres</span>
                    <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2">
                      {displayAnime.genreList.map((genre, index) => (
                        <span key={index} className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white px-3 py-1 lg:px-5 lg:py-2 rounded-full lg:rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap">{genre}</span>
                      ))}
                    </div>
                  </div>
                )}

                {displayAnime?.genreList && displayAnime.genreList.length > 0 && (
                  <hr className="order-2 lg:hidden border-slate-700" />
                )}

                <div className="order-3 lg:order-none">
                  <h3 className="text-sm lg:text-base font-semibold text-slate-300 mb-2">Description</h3>
                  <div className="text-slate-400 text-xs lg:text-lg leading-relaxed">
                    {descriptionText.length > truncateThreshold && !isDescriptionExpanded ? (
                      <>
                        {descriptionText.slice(0, truncateThreshold)}...{' '}
                        <button onClick={() => setIsDescriptionExpanded(true)} className="text-purple-400 hover:text-purple-300 font-medium inline">
                          Show More
                        </button>
                      </>
                    ) : (
                      <>
                        {descriptionText || 'No description available for this content.'}
                        {descriptionText.length > truncateThreshold && (
                          <button onClick={() => setIsDescriptionExpanded(false)} className="text-purple-400 hover:text-purple-300 font-medium inline ml-1">
                            Show Less
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="lg:hidden order-4">
                  <VoteButtons isMobile={true} />
                </div>
              </div>
            </div>
          </div>

          {/* ========== SESSIONS / EPISODES / CHAPTERS ========== */}
          {availableSessions.length > 1 && (
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 mb-3 border border-slate-700 shadow-xl">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {availableSessions.map(session => (
                  <button key={session} onClick={() => setSelectedSession(session)} className={`flex-shrink-0 px-3 py-1 rounded-lg font-medium transition-all duration-300 text-xs ${selectedSession === session ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'}`}>{`Session ${session}`}</button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 lg:p-6 border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-3 lg:mb-6">
              <h2 className="text-base lg:text-2xl font-bold text-white">{getContentLabel()}</h2>
            </div>
            {(isManga ? chaptersLoading : episodesLoading) ? (
              <div className="flex justify-center py-6 lg:py-12"><Spinner size="sm" lg:text-lg text={`Loading ${getContentLabel().toLowerCase()}...`} /></div>
            ) : error ? (
              <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-2 lg:p-4 mb-3">
                <div className="flex items-center gap-2"><div className="text-red-400 text-xs">⚠️</div><p className="text-red-300 text-xs lg:text-sm">{error}</p></div>
              </div>
            ) : currentSessionItems.length === 0 ? (
              <div className="text-center py-6 lg:py-16">
                <div className="bg-slate-800/50 rounded-lg p-4 lg:rounded-2xl lg:p-12 border border-slate-700">
                  <h3 className="text-sm lg:text-xl font-semibold text-slate-300 mb-1">No {getContentLabel()} Available</h3>
                  <p className="text-slate-400 text-xs lg:text-base">{getNoContentMessage()}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 lg:space-y-3">
                  {currentSessionItems
                    .sort((a: any, b: any) => isManga ? (a as any).chapterNumber - (b as any).chapterNumber : (a as any).episodeNumber - (b as any).episodeNumber)
                    .map((item: any, index: number) => {
                      const itemData = item as any;
                      // ✅ FIX: manga chapters ka number field 'chapterNumber' hai, anime/movie ka 'episodeNumber'
                      const contentNumber = isManga ? itemData.chapterNumber : itemData.episodeNumber;
                      return (
                        <div key={itemData._id || index} className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-lg lg:rounded-xl p-2 lg:p-4 transition-all duration-200 border border-slate-600 hover:border-purple-500/50 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2 lg:gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium text-xs lg:text-lg truncate">{itemData.title || `${getContentLabelSingular()} ${contentNumber}`}</h3>
                            </div>
                            <div className="flex gap-1 lg:gap-2 flex-shrink-0">
                              <DownloadButton item={item as Episode | Chapter} itemId={itemData._id} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 lg:px-4 lg:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 group text-xs lg:text-sm whitespace-nowrap" showText={true} iconClassName="h-4 w-4 lg:h-5 w-5" />
                              {import.meta.env.DEV && episodeToPageMap.has(contentNumber) && (
                                <>
                                  {episodeToPageMap.get(contentNumber)!.map((page, idx) => (
                                    <Link key={page._id || idx} to={appendTokenToPath(`/download/${page.slug}`, anime.id || anime._id)} className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg text-xs font-medium ml-1 flex items-center justify-center" title={page.title}>
                                      <span className="text-xs">☠️</span>
                                      {page.buttonTitle && <span className="ml-1 hidden sm:inline">{page.buttonTitle}</span>}
                                    </Link>
                                  ))}
                                </>
                              )}
                              <div className="scale-90">
                                <ReportButton animeId={anime.id || anime._id} episodeId={itemData._id} episodeNumber={contentNumber} animeTitle={anime.title} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {!isManga && (
                  <div className="mt-4 lg:mt-6 p-3 lg:p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-lg lg:rounded-xl">
                    <h4 className="text-xs lg:text-sm font-bold text-blue-300 mb-2 flex items-center gap-1"><span className="text-blue-400">💡</span> Important Tips for Download and watching:</h4>
                    <ul className="space-y-2 text-xs lg:text-sm text-blue-300">
                      <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span>1. Download at least 1 and at most 4 files or movies at a time. This helps keep your download speed fast. If you download more than 4 files at once, the speed will slow down. Once these files finish downloading, you can start downloading more.</span></li>
                      <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span>2. If Wrong Audio you can Fix: Open MX Player → click Audio → Change track to Hindi / Tamil / Telugu / English / Japanese.</span></li>
                      <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span>3. If you see an ad before download: Complete the short ad (if any) to unlock the download link. After the download finishes, you can watch the movie/episode offline in any media player (MX Player, VLC, etc.) without interruptions.</span></li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ========== MORE LIKE THIS ========== */}
          <div className="mt-8 lg:mt-12">
            <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4 lg:mb-6">
              More {displayAnime?.contentType === 'Movie' ? 'Movies' : displayAnime?.contentType === 'Manga' ? 'Manga' : 'Anime'}
            </h2>
            {similarLoading ? (
              <div className="flex justify-center py-8 lg:py-12"><Spinner size="sm" lg:text-lg text="Loading similar content..." /></div>
            ) : similarContent.length === 0 ? (
              <div className="text-center py-6 lg:py-8"><div className="bg-slate-800/50 rounded-xl lg:rounded-2xl p-6 lg:p-8 border border-slate-700"><h3 className="text-base lg:text-lg font-semibold text-slate-300 mb-2">No Similar Content Found</h3><p className="text-slate-400 text-sm">We couldn't find similar {displayAnime?.contentType?.toLowerCase()} at the moment.</p></div></div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4">
                {similarContent.slice(0, 12).map((item, index) => (
                  <div key={item.id || item._id || index} className="relative cursor-pointer" onClick={() => onAnimeSelect(item)}>
                    <AnimeCard anime={item} onClick={() => {}} index={index} showStatus={true} />
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