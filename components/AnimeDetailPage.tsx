  // components/AnimeDetailPage.tsx - UPDATED VERSION WITHOUT EPISODE/MOVIE NUMBERS
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../src/types';
import { DownloadIcon } from './icons/DownloadIcon';
import ReportButton from './ReportButton';
import Spinner from './Spinner';
import { AnimeDetailSkeleton } from './SkeletonLoader';
import { getAnimeById } from '../services/animeService';

// ✅ ADD DownloadLink interface locally since it might not be in types.ts
interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

interface Props {
  anime: Anime | null;
  onBack: () => void;
  isLoading?: boolean;
}

const API_BASE = 'https://animabing.onrender.com/api';

// Helper functions for image optimization
const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  try {
    // Check if already optimized with our dimensions
    if (url.includes(`w_${width},h_${height},c_fill`)) return url;
    
    // Remove existing transformations and add optimized ones
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

// ✅ Helper function to get random download link
const getRandomDownloadLink = (downloadLinks: DownloadLink[]): string | null => {
  if (!downloadLinks || downloadLinks.length === 0) return null;
  
  // Generate random index
  const randomIndex = Math.floor(Math.random() * downloadLinks.length);
  return downloadLinks[randomIndex].url;
};

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack, isLoading = false }) => {
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ STATE FOR FULL ANIME DETAILS
  const [fullAnime, setFullAnime] = useState<Anime | null>(null);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);

  // Check content types
  const isManga = anime?.contentType === 'Manga';
  const isMovie = anime?.contentType === 'Movie';

  // ✅ GET CONTENT LABEL FOR UI
  const getContentLabel = () => {
    if (isManga) return 'Episodes';
    if (isMovie) return 'Movie';
    return 'Episodes';
  };

  const getContentLabelSingular = () => {
    if (isManga) return 'Episode';
    if (isMovie) return 'Movie';
    return 'Episode';
  };

  const getNoContentMessage = () => {
    if (isManga) return 'Episodes will be added soon!';
    if (isMovie) return 'Movie will be added soon!';
    return 'Episodes will be added soon!';
  };

  // ✅ FETCH FULL ANIME DETAILS IF NEEDED
  useEffect(() => {
    const fetchFullAnimeDetails = async () => {
      if (!anime) return;

      if (anime.description && anime.genreList && anime.genreList.length > 0) {
        setFullAnime(anime);
        return;
      }

      setAnimeLoading(true);
      try {
        const fields = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';
        const fullAnimeData = await getAnimeById(anime.id, fields);
        if (fullAnimeData) {
          setFullAnime(fullAnimeData);
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

  // Use fullAnime if available, else fallback to anime
  const displayAnime = fullAnime || anime;
  
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

  // ✅ EPISODES/CHAPTERS FETCH
  useEffect(() => {
    const fetchContent = async () => {
      if (!anime) return;
      try {
        if (isManga) {
          setChaptersLoading(true);
          const response = await fetch(`${API_BASE}/chapters/${anime.id}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const chaptersData = await response.json();
          if (Array.isArray(chaptersData)) {
            setChapters(chaptersData);
          } else {
            setChapters([]);
          }
        } else {
          setEpisodesLoading(true);
          const response = await fetch(`${API_BASE}/episodes/${anime.id}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const episodesData = await response.json();
          if (Array.isArray(episodesData)) {
            setEpisodes(episodesData);
          } else {
            setEpisodes([]);
          }
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

  // ✅ UPDATED: Handle download click - RANDOM LINK OPEN IN NEW TAB (NO ALERT)
  const handleDownloadClick = async (item: Episode | Chapter) => {
    try {
      const itemData = item as any;
      const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
      
      if (downloadLinks.length === 0) {
        alert(
          `${getContentLabelSingular()} - Download links will be added soon!`
        );
        return;
      }
      
      // Set loading state for this specific item
      setDownloadingItem(itemData._id);
      
      // ✅ Get random download link
      const randomLink = getRandomDownloadLink(downloadLinks);
      
      if (randomLink) {
        // ✅ Open random link in new tab (NO ALERT)
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

  // ✅ Download button component
  const DownloadButton: React.FC<{ 
    item: Episode | Chapter; 
    className?: string;
    showText?: boolean;
    itemId: string;
  }> = ({ item, className = '', showText = true, itemId }) => {
    const episodeItem = item as any;
    const downloadLinks: DownloadLink[] = episodeItem.downloadLinks || [];
    
    if (downloadLinks.length === 0) {
      return (
        <button
          onClick={() => {
            alert(
              `${getContentLabelSingular()} - Download links will be added soon!`
            );
          }}
          className={`${className} opacity-70 cursor-not-allowed`}
          title="Download links not available yet"
          disabled
        >
          {showText ? 'Download' : <DownloadIcon className="h-3 w-3" />}
        </button>
      );
    }
    
    return (
      <button
        onClick={() => handleDownloadClick(item)}
        className={`${className} ${downloadingItem === itemId ? 'animate-pulse' : ''}`}
        title={`Download ${item.title || getContentLabelSingular()}`}
        disabled={downloadingItem === itemId}
      >
        {downloadingItem === itemId ? (
          showText ? 'Downloading...' : <Spinner size="sm" />
        ) : (
          showText ? 'Download' : <DownloadIcon className="h-3 w-3" />
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
              <div className="flex gap-3 mb-3">
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
                  <h1 className="text-lg font-bold text-white mb-2 break-words">{displayAnime?.title}</h1>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                      {displayAnime?.releaseYear}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                        displayAnime?.status === 'Ongoing'
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                      }`}
                    >
                      {displayAnime?.status}
                    </span>
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                      {displayAnime?.contentType}
                    </span>
                    {!isManga && displayAnime?.subDubStatus && (
                      <div className="flex flex-wrap gap-1">
                        {displayAnime.subDubStatus
                          .split(',')
                          .map(s => s.trim().toLowerCase())
                          .includes('hindi dub'.toLowerCase()) && (
                          <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold">
                            Hindi Dub
                          </span>
                        )}

                        {displayAnime.subDubStatus
                          .split(',')
                          .map(s => s.trim().toLowerCase())
                          .includes('hindi sub'.toLowerCase()) && (
                          <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold">
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
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">
                {getContentLabel()}{' '}
                {currentSessionItems.length > 0 && `(${currentSessionItems.length})`}
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
                    const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
                    
                    return (
                      <div
                        key={itemData._id || index}
                        className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-lg p-2 transition-all duration-200 border border-slate-600 hover:border-purple-500/50 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* ✅ UPDATED: Only show EP/MOVIE/CHAPTER without numbers */}
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold min-w-10 text-center flex-shrink-0">
                              {isMovie ? 'MOVIE' : (isManga ? 'CHAPTER' : 'EP')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium text-xs break-words">
                                {itemData.title ||
                                  `${getContentLabelSingular()}`}
                              </h3>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <DownloadButton
                              item={item as Episode | Chapter}
                              itemId={itemData._id}
                              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white p-2 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all duration-200 flex items-center justify-center"
                              showText={false}
                            />
                            <ReportButton
                              animeId={anime.id}
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
                    <span>If the audio of any episode or movie is incorrect, you can fix it by changing the audio language to Hindi,Tamil,Telugu,English,Japanese in MX Player.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>After the ad is completed, a white page will open. From there, you can download the episode or movie. This is a Google warning page that appears because the video file size is large.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* PC VIEW */}
        <div className="hidden lg:block">
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-700 shadow-xl">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <div className="relative group">
                  <img
                    src={desktopThumbnail}
                    srcSet={desktopThumbnailSrcSet}
                    alt={displayAnime?.title}
                    className="w-full max-w-xs lg:w-80 h-auto lg:h-[28rem] object-cover rounded-xl shadow-2xl group-hover:scale-105 transition-transform duration-500"
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
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
                    {displayAnime?.title}
                  </h1>
                  <p className="text-slate-300 leading-relaxed text-lg">
                    {displayAnime?.description || 'No description available for this content.'}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
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
                    <div className="flex flex-wrap gap-2 mt-3">
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
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                {getContentLabel()}{' '}
                {currentSessionItems.length > 0 && `(${currentSessionItems.length})`}
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
                      const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
                      
                      return (
                        <div
                          key={itemData._id || index}
                          className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-xl p-4 transition-all duration-300 border border-slate-600 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 backdrop-blur-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start sm:items-center gap-4 flex-1">
                              <div className="flex items-center gap-3">
                                {/* ✅ UPDATED: Only show EP/MOVIE/CHAPTER without numbers */}
                                <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold min-w-16 text-center">
                                  {isMovie ? 'MOVIE' : (isManga ? 'CHAPTER' : 'EP')}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-lg truncate">
                                  {itemData.title ||
                                    `${getContentLabelSingular()}`}
                                </h3>
                                {itemData.session > 1 && (
                                  <p className="text-slate-400 text-sm mt-1">Session {itemData.session}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <DownloadButton
                                item={item as Episode | Chapter}
                                itemId={itemData._id}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-2 rounded-lg transition-all duration-300 font-medium flex items-center gap-2 hover:scale-105 active:scale-95"
                                showText={true}
                              />
                              <div className="scale-90">
                                <ReportButton
                                  animeId={anime.id}
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
                        <span>If the audio of any episode or movie is incorrect, you can fix it by changing the audio language to Hindi,Tamil,Telugu,English,Japanese in MX Player.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>After the ad is completed, a white page will open. From there, you can download the episode or movie. This is a Google warning page that appears because the video file size is large.</span>
                      </li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetailPage;
