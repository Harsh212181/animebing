 import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaDownload, FaPlay, FaFilm, FaTv } from 'react-icons/fa';
import Spinner from './Spinner';
import VideoPlayer from './VideoPlayer';
import YouTubeEmbed from './YouTubeEmbed';
import { isYouTubeUrl } from './utils/videoHelpers';
import { DownloadPage, Anime } from '../src/types';
import { captureTokenFromUrl, completeFunnel } from '../utils/clickFunnel';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

type TabType = 'download' | 'watch';

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

const getLanguageFlag = (lang: string): string => {
  const flags: Record<string, string> = {
    English: '🇬🇧',
    Japanese: '🇯🇵',
    Hindi: '🇮🇳',
    Spanish: '🇪🇸',
    French: '🇫🇷',
    German: '🇩🇪',
    Korean: '🇰🇷',
    Chinese: '🇨🇳',
  };
  return flags[lang] || '🏳️';
};

const qualityColor = (quality: string): string => {
  const q = quality.toLowerCase();
  if (q.includes('1080') || q.includes('full')) return 'from-green-600 to-emerald-600';
  if (q.includes('720')) return 'from-blue-600 to-indigo-600';
  if (q.includes('480')) return 'from-yellow-600 to-amber-600';
  return 'from-purple-600 to-pink-600';
};

// ✅ q_auto:eco — quality same, file ~30% kam
const optimizeImageUrl = (url: string | undefined, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url || 'https://via.placeholder.com/80x112/1e293b/64748b?text=No+Image';
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

// ✅ 1.5x srcSet — 2x hata diya
const generateSrcSet = (url: string | undefined, baseWidth: number, baseHeight: number): string => {
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

// ✅ Show More/Less threshold
const DESCRIPTION_TRUNCATE_LIMIT = 300;

const DownloadLinkPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<DownloadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('watch');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [animeDetails, setAnimeDetails] = useState<Anime | null>(null);
  const [animeLoading, setAnimeLoading] = useState(false);

  const [likes, setLikes] = useState<number>(0);
  const [dislikes, setDislikes] = useState<number>(0);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // ✅ State for description Show More / Less
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    captureTokenFromUrl();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/download-pages/${slug}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPage(data);

        const animeIdField = data.animeId;
        if (animeIdField && typeof animeIdField === 'object') {
          if (animeIdField.thumbnail && animeIdField.genreList) {
            setAnimeDetails(animeIdField);
          } else {
            const id = animeIdField._id;
            if (id) {
              setAnimeLoading(true);
              try {
                const animeRes = await fetch(`${API_BASE}/anime/${id}`);
                const animeData = await animeRes.json();
                if (animeData.success) setAnimeDetails(animeData.data);
              } catch (err) {
                console.error('Failed to fetch full anime details', err);
              } finally {
                setAnimeLoading(false);
              }
            }
          }
        } else if (typeof animeIdField === 'string') {
          setAnimeLoading(true);
          try {
            const animeRes = await fetch(`${API_BASE}/anime/${animeIdField}`);
            const animeData = await animeRes.json();
            if (animeData.success) setAnimeDetails(animeData.data);
          } catch (err) {
            console.error('Failed to fetch anime details', err);
          } finally {
            setAnimeLoading(false);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  useEffect(() => {
    const fetchVoteData = async () => {
      const animeId = animeDetails?._id;
      if (!animeId) return;
      try {
        const res = await fetch(`${API_BASE}/anime/${animeId}/vote-status`);
        const data = await res.json();
        if (data.success) {
          setLikes(data.data.likes || 0);
          setDislikes(data.data.dislikes || 0);
          setUserVote(data.data.userVote);
        }
      } catch (error) {
        console.error('Error fetching vote data:', error);
      }
    };
    fetchVoteData();
  }, [animeDetails]);

  const handleVote = async (voteType: 'like' | 'dislike') => {
    const animeId = animeDetails?._id;
    if (!animeId || isVoting) return;
    setIsVoting(true);
    try {
      const res = await fetch(`${API_BASE}/anime/${animeId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType })
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.data.likes);
        setDislikes(data.data.dislikes);
        setUserVote(data.data.userVote);
      } else {
        alert(`Vote failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Vote error:', error);
      alert('Error submitting vote');
    } finally {
      setIsVoting(false);
    }
  };

  const togglePlayer = (idx: number) => {
    if (selectedIndex !== idx) completeFunnel();
    setSelectedIndex(selectedIndex === idx ? null : idx);
  };

  const isLoading = loading || animeLoading;
  const title = animeDetails?.title ? animeDetails.title : 'Unknown Title';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black py-8 px-4">
        <div className="w-full max-w-7xl mx-auto animate-pulse">
          <div className="h-8 w-64 bg-gray-700/50 rounded-lg mb-4"></div>
          <div className="h-4 w-48 bg-gray-700/50 rounded mb-8"></div>
          <div className="flex space-x-4 mb-6">
            <div className="h-10 w-24 bg-gray-700/50 rounded-lg"></div>
            <div className="h-10 w-24 bg-gray-700/50 rounded-lg"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 h-24 border border-gray-700"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black flex items-center justify-center">
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-8 text-center max-w-md shadow-2xl">
          <p className="text-red-400 text-lg font-medium">{error || 'Page not found'}</p>
          <button onClick={() => navigate(-1)} className="mt-6 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-medium transition-all transform hover:scale-105">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isMovie = animeDetails?.contentType === 'Movie';
  const isManga = animeDetails?.contentType === 'Manga';
  const downloadLinks = page.links.filter(link => link.type !== 'watch');
  const watchLinks = page.links.filter(link => link.type === 'watch');

  // ✅ sorted watch links
  const sortedWatchLinks = [...watchLinks].sort((a, b) => {
    const epA = isMovie ? 0 : Number(a.episode) || 0;
    const epB = isMovie ? 0 : Number(b.episode) || 0;
    return epA - epB;
  });

  const thumbnail = animeDetails?.thumbnail;
  const releaseYear = animeDetails?.releaseYear || 'N/A';
  const status = animeDetails?.status || 'Unknown';
  const contentType = animeDetails?.contentType || 'Anime';
  const subDubStatus = animeDetails?.subDubStatus || '';
  const genreList = animeDetails?.genreList || [];
  const description = animeDetails?.description || 'No description available.';
  const currentEpisode = (animeDetails as any)?.currentEpisode || 0;

  // Poster-style (carousel-card) thumbnail sizes
  const posterThumbnail = thumbnail ? optimizeImageUrl(thumbnail, 193, 289) : 'https://via.placeholder.com/193x289/1e293b/64748b?text=No+Image';
  const posterThumbnailSrcSet = thumbnail ? generateSrcSet(thumbnail, 193, 289) : '';

  const VoteButtons = ({ isMobile = false }: { isMobile?: boolean }) => {
    const buttonSize = isMobile ? 'h-4 w-4' : 'h-5 w-5';
    const textSize = isMobile ? 'text-xs' : 'text-sm';
    const padding = isMobile ? 'px-3 py-1.5' : 'px-4 py-2';
    return (
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => handleVote('like')} disabled={isVoting} className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg ${userVote === 'like' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-pink-600/30 hover:shadow-pink-600/50' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600 hover:border-pink-500/50'} ${isVoting ? 'opacity-50 cursor-not-allowed' : ''} transform hover:scale-105`} title={userVote === 'like' ? 'Remove like' : 'Like this anime'}>
          <HeartIcon className={buttonSize} filled={userVote === 'like'} />
          <span className="font-bold">{formatCount(likes)}</span>
        </button>
        <button onClick={() => handleVote('dislike')} disabled={isVoting} className={`${padding} ${textSize} rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg ${userVote === 'dislike' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/30 hover:shadow-blue-600/50' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600 hover:border-blue-500/50'} ${isVoting ? 'opacity-50 cursor-not-allowed' : ''} transform hover:scale-105`} title={userVote === 'dislike' ? 'Remove dislike' : 'Dislike this anime'}>
          <HandThumbDownIcon className={buttonSize} filled={userVote === 'dislike'} />
          <span className="font-bold">{formatCount(dislikes)}</span>
        </button>
      </div>
    );
  };

  // ✅ Banner-slide style hero (same look as FeaturedAnimeCarousel banner), used for both mobile & desktop
  const AnimeBannerHero = () => {
    const bgWide = thumbnail ? optimizeImageUrl(thumbnail, 1400, 400) : '';
    const bgWideSrcSet = thumbnail ? `
      ${optimizeImageUrl(thumbnail, 700, 200)} 700w,
      ${optimizeImageUrl(thumbnail, 1400, 400)} 1400w,
      ${optimizeImageUrl(thumbnail, 2100, 600)} 2100w
    ` : '';

    return (
      <>
        {/* MOBILE BANNER */}
        <div className="block lg:hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl rounded-2xl h-[200px]">
            <div className="absolute inset-0">
              <img
                src={bgWide}
                srcSet={bgWideSrcSet}
                sizes="100vw"
                alt={title}
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
                      alt={title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/193x289/1e293b/64748b?text=No+Image'; }}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="space-y-2">
                    <h1 className="text-base font-bold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {title}
                    </h1>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${status === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                        {status}
                      </span>
                      {subDubStatus && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600/80 text-white border border-purple-500">
                          {subDubStatus}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800/60 text-slate-300 border border-slate-700">
                        {releaseYear}
                      </span>
                      {/* FIX: Show Ch for manga, else EP */}
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
        <div className="hidden lg:block">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl rounded-2xl h-[330px]">
            <div className="absolute inset-0">
              <img
                src={bgWide}
                srcSet={bgWideSrcSet}
                sizes="100vw"
                alt={title}
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
                        alt={title}
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
                      {title}
                    </h1>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${status === 'Ongoing' ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-500/30'}`}>
                        {status}
                      </span>
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-slate-800/40 to-slate-900/40 text-slate-300 border border-slate-700">
                        {releaseYear}
                      </span>
                      {subDubStatus && (
                        <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-700 text-white border border-purple-500">
                          {subDubStatus}
                        </span>
                      )}
                      {/* FIX: Show Ch for manga, else EP */}
                      {!isMovie && currentEpisode > 0 && (
                        <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-red-600 to-orange-600 text-white border border-red-500/30">
                          {isManga ? 'Ch' : 'EP'} {currentEpisode}
                        </span>
                      )}
                    </div>
                    {description && (
                      <p className="text-slate-300 text-xs leading-relaxed max-w-2xl line-clamp-2">
                        {description}
                      </p>
                    )}
                    {genreList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {genreList.slice(0, 4).map((genre, i) => (
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
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black py-8 px-4">
      <div className="w-full max-w-7xl mx-auto">

        {/* Banner-style hero — same look as FeaturedAnimeCarousel banner slide */}
        <div className="mb-4 lg:mb-6">
          <AnimeBannerHero />
        </div>

        {/* Description / Genres / Votes panel below the hero */}
        <div className="mb-6 lg:mb-8">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl lg:rounded-3xl p-5 lg:p-8 border border-slate-700/50 shadow-2xl">
            <div className="space-y-4 lg:space-y-6">

              {/* Genres — first on mobile (order-1), default on desktop (lg:order-none) */}
              {genreList.length > 0 && (
                <div className="order-1 lg:order-none">
                  <span className="text-slate-400 text-xs lg:text-sm font-medium mr-3">Genres</span>
                  <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2">
                    {genreList.map((genre, index) => (
                      <span key={index} className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white px-3 py-1 lg:px-5 lg:py-2 rounded-full lg:rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap">{genre}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider line for mobile only */}
              {genreList.length > 0 && (
                <hr className="order-2 lg:hidden border-slate-700" />
              )}

              {/* Description — third on mobile (order-3), default on desktop */}
              <div className="order-3 lg:order-none">
                <h3 className="text-sm lg:text-base font-semibold text-slate-300 mb-2">Description</h3>
                <div className="text-slate-400 text-xs lg:text-lg leading-relaxed">
                  {description.length > DESCRIPTION_TRUNCATE_LIMIT && !isDescriptionExpanded ? (
                    <>
                      {description.slice(0, DESCRIPTION_TRUNCATE_LIMIT)}...{' '}
                      <button
                        onClick={() => setIsDescriptionExpanded(true)}
                        className="text-purple-400 hover:text-purple-300 font-medium inline"
                      >
                        Show More
                      </button>
                    </>
                  ) : (
                    <>
                      {description}
                      {description.length > DESCRIPTION_TRUNCATE_LIMIT && (
                        <button
                          onClick={() => setIsDescriptionExpanded(false)}
                          className="text-purple-400 hover:text-purple-300 font-medium inline ml-1"
                        >
                          Show Less
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Vote buttons shown here only on mobile — desktop already has them inside the banner */}
              <div className="lg:hidden order-4">
                <VoteButtons isMobile={true} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-lg font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{page.title}</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6">
          <button onClick={() => setActiveTab('watch')} className={`flex items-center px-6 py-3 font-medium text-sm sm:text-base transition-all relative ${activeTab === 'watch' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
            <FaPlay className={`mr-2 ${activeTab === 'watch' ? 'text-purple-400' : ''}`} />
            Watch
            <span className="ml-2 bg-gray-800 text-xs px-2 py-0.5 rounded-full">{watchLinks.length}</span>
            {activeTab === 'watch' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-full"></span>}
          </button>
          {/* ✅ NEW: Download tab sirf tab dikhega jab download links hon */}
          {downloadLinks.length > 0 && (
            <button onClick={() => setActiveTab('download')} className={`flex items-center px-6 py-3 font-medium text-sm sm:text-base transition-all relative ${activeTab === 'download' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
              <FaDownload className={`mr-2 ${activeTab === 'download' ? 'text-purple-400' : ''}`} />
              Download
              <span className="ml-2 bg-gray-800 text-xs px-2 py-0.5 rounded-full">{downloadLinks.length}</span>
              {activeTab === 'download' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-full"></span>}
            </button>
          )}
        </div>

        {activeTab === 'watch' && (
          <div className="flex flex-col gap-3">
            {sortedWatchLinks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No watch links available.</p>
            ) : (
              <>
                {sortedWatchLinks.map((link, idx) => (
                  <div key={idx} style={{ order: idx * 2 }}>
                    <LinkCard
                      link={link}
                      isMovie={isMovie}
                      onAction={() => togglePlayer(idx)}
                      actionIcon={selectedIndex === idx ? undefined : <FaPlay />}
                      actionLabel={selectedIndex === idx ? 'Close Player' : 'Watch Now'}
                      isActive={selectedIndex === idx}
                    />
                  </div>
                ))}

                {selectedIndex !== null && sortedWatchLinks[selectedIndex] && (
                  <div
                    className="shadow-2xl animate-fadeIn -mx-4 sm:mx-0"
                    style={{ order: selectedIndex * 2 + 1 }}
                  >
                    {isYouTubeUrl(sortedWatchLinks[selectedIndex].url) ? (
                      <YouTubeEmbed
                        key="active-youtube-player"
                        videoUrl={sortedWatchLinks[selectedIndex].url}
                        title={title}
                        onNextEpisode={() => setSelectedIndex(selectedIndex + 1)}
                        onPreviousEpisode={() => setSelectedIndex(selectedIndex - 1)}
                        hasNextEpisode={!isMovie && selectedIndex < sortedWatchLinks.length - 1}
                        hasPreviousEpisode={!isMovie && selectedIndex > 0}
                      />
                    ) : (
                      <div className="overflow-hidden rounded-none border-0 sm:rounded-xl sm:border sm:border-purple-500/30">
                        <VideoPlayer
                          key="active-video-player"
                          src={sortedWatchLinks[selectedIndex].url}
                          title={title}
                          episode={!isMovie ? sortedWatchLinks[selectedIndex].episode : undefined}
                          onNextEpisode={() => setSelectedIndex(selectedIndex + 1)}
                          onPreviousEpisode={() => setSelectedIndex(selectedIndex - 1)}
                          hasNextEpisode={!isMovie && selectedIndex < sortedWatchLinks.length - 1}
                          hasPreviousEpisode={!isMovie && selectedIndex > 0}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ✅ NEW: Download tab content bhi sirf tab dikhega jab download links hon (activeTab safety) */}
        {activeTab === 'download' && downloadLinks.length > 0 && (
          <div className="space-y-3">
            {downloadLinks.map((link, idx) => (
              <LinkCard key={idx} link={link} isMovie={isMovie} onAction={() => { completeFunnel(); window.open(link.url, '_blank'); }} actionIcon={<FaDownload />} actionLabel="Download" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LinkCard: React.FC<{
  link: DownloadPage['links'][0];
  isMovie: boolean;
  onAction: () => void;
  actionIcon?: React.ReactNode;
  actionLabel: string;
  isActive?: boolean;
}> = ({ link, isMovie, onAction, actionIcon, actionLabel, isActive }) => {
  const quality = link.quality || 'HD';
  const qualityGradient = qualityColor(quality);

  return (
    <div className={`group relative bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 ${isActive ? 'border-purple-500 shadow-2xl shadow-purple-500/30' : 'border-slate-700/50 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-semibold text-white">
              {isMovie
                ? 'Movie'
                : (link.episodeStart && link.episodeStart !== link.episode
                    ? `Episode ${link.episodeStart}-${link.episode}`
                    : `Episode ${link.episode}`)}
            </span>
            {link.quality && (
              <span className={`bg-gradient-to-r ${qualityGradient} text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg`}>{link.quality}</span>
            )}
          </div>
          {link.language && (
            <p className="text-sm text-gray-400 flex items-center">
              <span className="mr-1 text-lg">{getLanguageFlag(link.language)}</span>
              {link.language}
            </p>
          )}
        </div>
        <button onClick={onAction} className={`flex items-center px-5 py-2 rounded-lg font-medium transition-all transform ${isActive ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-600/30' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-105'}`}>
          {actionIcon && <span className="mr-2">{actionIcon}</span>}
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default DownloadLinkPage;