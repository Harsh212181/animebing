 import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaDownload, FaPlay, FaFilm, FaTv } from 'react-icons/fa';
import Spinner from './Spinner';
import VideoPlayer from './VideoPlayer';
import YouTubeEmbed from './YouTubeEmbed'; // ✅ new inline embed
import { isYouTubeUrl } from './utils/videoHelpers';
import { DownloadPage, Anime } from '../src/types';

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
  const downloadLinks = page.links.filter(link => link.type !== 'watch');
  const watchLinks = page.links.filter(link => link.type === 'watch');

  // ✅ FIX: sort watch links by episode number so "Next/Previous Episode"
  // always moves in the correct order, regardless of the order they were
  // saved in on the backend. Movies just keep their (single) position.
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

  const mobileThumbnail = thumbnail ? optimizeImageUrl(thumbnail, 80, 112) : 'https://via.placeholder.com/80x112/1e293b/64748b?text=No+Image';
  const mobileThumbnailSrcSet = thumbnail ? generateSrcSet(thumbnail, 80, 112) : '';
  const desktopThumbnail = thumbnail ? optimizeImageUrl(thumbnail, 320, 448) : 'https://via.placeholder.com/320x448/1e293b/64748b?text=No+Image';
  const desktopThumbnailSrcSet = thumbnail ? generateSrcSet(thumbnail, 320, 448) : '';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black py-8 px-4">
      <div className="w-full max-w-7xl mx-auto">

        {/* Mobile detail card */}
        <div className="lg:hidden mb-6">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-2xl">
            <div className="flex flex-col">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <img src={mobileThumbnail} srcSet={mobileThumbnailSrcSet} alt={title} className="w-20 h-28 object-cover rounded-xl shadow-lg" loading="lazy" width="80" height="112" sizes="80px" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/80x112/1e293b/64748b?text=No+Image'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className={`font-bold text-white mb-2 break-words ${title.length > 40 ? 'text-sm leading-tight' : 'text-lg'}`}>{title}</h1>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg">{releaseYear}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg ${status === 'Ongoing' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'}`}>{status}</span>
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg">{contentType}</span>
                    {!isMovie && subDubStatus && (
                      <div className="flex flex-wrap gap-1">
                        {subDubStatus.split(',').map(s => s.trim().toLowerCase()).includes('hindi dub') && <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg">Hindi Dub</span>}
                        {subDubStatus.split(',').map(s => s.trim().toLowerCase()).includes('hindi sub') && <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg">Hindi Sub</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3 mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {genreList.map((genre, index) => (
                    <span key={index} className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">{genre}</span>
                  ))}
                </div>
                <VoteButtons isMobile={true} />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop detail card */}
        <div className="hidden lg:block mb-8">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <img src={desktopThumbnail} srcSet={desktopThumbnailSrcSet} alt={title} className="w-full max-w-xs lg:w-72 h-auto lg:h-[26rem] object-cover rounded-2xl shadow-2xl" loading="lazy" width="320" height="448" sizes="(max-width: 1024px) 80px, 320px" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/320x448/1e293b/64748b?text=No+Image'; }} />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className={`font-bold bg-gradient-to-r from-white via-purple-100 to-pink-100 bg-clip-text text-transparent mb-3 ${title.length > 60 ? 'text-2xl lg:text-3xl' : 'text-3xl lg:text-4xl'}`}>{title}</h1>
                  <p className="text-slate-300 leading-relaxed text-lg">{description}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg">{releaseYear}</span>
                    <span className={`px-5 py-2.5 rounded-xl font-bold shadow-lg ${status === 'Ongoing' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'}`}>{status}</span>
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg">{contentType}</span>
                    {!isMovie && subDubStatus && (
                      <div className="flex flex-wrap gap-2">
                        {subDubStatus.split(',').map(s => s.trim().toLowerCase()).includes('hindi dub') && <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg">Hindi Dub</span>}
                        {subDubStatus.split(',').map(s => s.trim().toLowerCase()).includes('hindi sub') && <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg">Hindi Sub</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm font-medium mr-3">Genres</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {genreList.map((genre, index) => (
                        <span key={index} className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white px-5 py-2 rounded-xl text-sm font-medium cursor-pointer">{genre}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <VoteButtons />
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
          <button onClick={() => setActiveTab('download')} className={`flex items-center px-6 py-3 font-medium text-sm sm:text-base transition-all relative ${activeTab === 'download' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
            <FaDownload className={`mr-2 ${activeTab === 'download' ? 'text-purple-400' : ''}`} />
            Download
            <span className="ml-2 bg-gray-800 text-xs px-2 py-0.5 rounded-full">{downloadLinks.length}</span>
            {activeTab === 'download' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-full"></span>}
          </button>
        </div>

        {activeTab === 'watch' && (
          <div className="space-y-3">
            {sortedWatchLinks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No watch links available.</p>
            ) : (
              <>
                {sortedWatchLinks.map((link, idx) => (
                  <LinkCard
                    key={idx}
                    link={link}
                    isMovie={isMovie}
                    onAction={() => togglePlayer(idx)}
                    actionIcon={selectedIndex === idx ? undefined : <FaPlay />}
                    actionLabel={selectedIndex === idx ? 'Close Player' : 'Watch Now'}
                    isActive={selectedIndex === idx}
                  />
                ))}

                {/* ✅ FIX: single, stable player instance rendered OUTSIDE the
                    per-card loop, with a fixed `key`. Previously the player was
                    interleaved inside whichever card was active, so switching
                    episodes moved it to a different spot in the list — React
                    unmounted the old one and mounted a brand new one elsewhere.
                    Removing an element that's currently fullscreen makes the
                    browser force-exit fullscreen automatically, which is why
                    Next/Previous Episode was kicking you out of fullscreen.
                    Now the same DOM node just gets new props (src/episode),
                    so fullscreen stays active across Next/Previous. */}
                {selectedIndex !== null && sortedWatchLinks[selectedIndex] && (
                  <div className="mt-2 shadow-2xl animate-fadeIn -mx-4 sm:mx-0">
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

        {activeTab === 'download' && (
          <div className="space-y-3">
            {downloadLinks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No download links available.</p>
            ) : (
              downloadLinks.map((link, idx) => (
                <LinkCard key={idx} link={link} isMovie={isMovie} onAction={() => window.open(link.url, '_blank')} actionIcon={<FaDownload />} actionLabel="Download" />
              ))
            )}
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
            <span className="text-lg font-semibold text-white">{isMovie ? 'Movie' : `Episode ${link.episode}`}</span>
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