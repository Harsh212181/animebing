  // components/AnimeDetailPage.tsx - UPDATED SESSION EPISODE COUNT
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../src/types';
import { DownloadIcon } from './icons/DownloadIcon';
import ReportButton from './ReportButton';
import Spinner from './Spinner';
import { AnimeDetailSkeleton } from './SkeletonLoader';
import { getAnimeById } from '../services/animeService';

interface Props {
  anime: Anime | null;
  onBack: () => void;
  isLoading?: boolean;
}

const API_BASE = 'https://animabing.onrender.com/api';

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack, isLoading = false }) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ STATE FOR FULL ANIME DETAILS
  const [fullAnime, setFullAnime] = useState<Anime | null>(null);
  const [animeLoading, setAnimeLoading] = useState(false);

  // Check if content is Manga
  const isManga = anime?.contentType === 'Manga';

  // ✅ FETCH FULL ANIME DETAILS IF NEEDED
  useEffect(() => {
    const fetchFullAnimeDetails = async () => {
      if (!anime) return;

      // If we already have description and genreList, use the existing data
      if (anime.description && anime.genreList && anime.genreList.length > 0) {
        setFullAnime(anime);
        return;
      }

      // Otherwise, fetch full details
      setAnimeLoading(true);
      try {
        const fields = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';
        const fullAnimeData = await getAnimeById(anime.id, fields);
        if (fullAnimeData) {
          setFullAnime(fullAnimeData);
        } else {
          setFullAnime(anime); // Fallback to original data
        }
      } catch (err) {
        console.error('Failed to fetch full anime details:', err);
        setFullAnime(anime); // Fallback to original data
      } finally {
        setAnimeLoading(false);
      }
    };

    fetchFullAnimeDetails();
  }, [anime]);

  // Use fullAnime if available, else fallback to anime
  const displayAnime = fullAnime || anime;

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
            const cleanedEpisodes = episodesData.map((episode: any) => ({
              ...episode,
              cutyLink: episode.cutyLink && !episode.cutyLink.includes('localhost') && episode.cutyLink.startsWith('http')
                ? episode.cutyLink.trim()
                : ''
            }));
            setEpisodes(cleanedEpisodes);
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

  const handleDownloadClick = (item: Episode | Chapter) => {
    if (isManga) {
      setSelectedChapter(item as Chapter);
    } else {
      setSelectedEpisode(item as Episode);
    }
    setShowDownloadModal(true);
    setTimeout(() => {
      if (item.cutyLink) {
        window.open(item.cutyLink, '_blank');
      } else {
        alert(
          `${isManga ? 'Chapter' : 'Episode'} ${
            isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber
          } - Download link will be added soon!`
        );
      }
    }, 1500);
    setTimeout(() => setShowDownloadModal(false), 3000);
  };

  // ✅ LOADING STATE - Check for both initial loading and anime loading
  if (isLoading || !anime || animeLoading) {
    return <AnimeDetailSkeleton />;
  }

  const currentSessionItems = itemsBySession[selectedSession] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-3 py-4">
        {/* Enhanced Back Button - Smaller for mobile */}
        <button
          onClick={onBack}
          className="group bg-slate-800/60 hover:bg-slate-700/80 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-2 transition-all duration-300 font-medium backdrop-blur-sm border border-slate-700 hover:border-purple-500/30 text-sm"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to Home
        </button>

        {/* MOBILE VIEW - Only show on small screens */}
        <div className="lg:hidden">
          {/* Mobile Anime Card - No bottom margin to remove gap */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-xl mb-0">
            <div className="flex flex-col">
              {/* Anime Poster and Basic Info Row */}
              <div className="flex gap-3 mb-3">
                {/* Anime Poster */}
                <div className="flex-shrink-0">
                  <div className="relative group">
                    <img
                      src={displayAnime?.thumbnail}
                      alt={displayAnime?.title}
                      className="w-20 h-28 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
                      }}
                    />
                  </div>
                </div>
                {/* Anime Basic Info */}
                <div className="flex-1 min-w-0">
                  {/* Full Anime Title - No truncation */}
                  <h1 className="text-lg font-bold text-white mb-2 break-words">{displayAnime?.title}</h1>
                  {/* Highlighted Info Badges */}
                  <div className="flex flex-wrap gap-1">
                    {/* Year Badge - Same as genres */}
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                      {displayAnime?.releaseYear}
                    </span>
                    {/* Status Badge - Special colors */}
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                        displayAnime?.status === 'Ongoing'
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                      }`}
                    >
                      {displayAnime?.status}
                    </span>
                    {/* Type Badge - Same as genres */}
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                      {displayAnime?.contentType}
                    </span>
                    {/* Hindi Sub / Dub Badges - SAFE & CLEAN CHECK */}
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
              
              {/* Anime Details Below the Card Row - Year, Status, Type, Genres */}
              <div className="space-y-2 mt-2">
                {/* Year, Status, Type in a row */}
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
                
                {/* Genres */}
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

              {/* Description */}
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Description</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {displayAnime?.description || 'No description available for this content.'}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Session Selector - No top margin to remove gap */}
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
                  >
                    Session {session}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile Episodes/Chapters Section - No top margin to remove gap */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 mt-0 border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">
                {isManga ? 'Chapters' : 'Episodes'}{' '}
                {currentSessionItems.length > 0 && `(${currentSessionItems.length})`}
              </h2>
            </div>
            {(isManga ? chaptersLoading : episodesLoading) ? (
              <div className="flex justify-center py-6">
                <div className="text-center">
                  <Spinner size="sm" text={`Loading ${isManga ? 'chapters' : 'episodes'}...`} />
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
                    No {isManga ? 'Chapters' : 'Episodes'} Available
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {isManga ? 'Chapters' : 'Episodes'} will be added soon!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {currentSessionItems
                  .sort((a, b) => {
                    if (isManga) {
                      return (a as Chapter).chapterNumber - (b as Chapter).chapterNumber;
                    } else {
                      return (a as Episode).episodeNumber - (b as Episode).episodeNumber;
                    }
                  })
                  .map((item, index) => (
                    <div
                      key={item._id || index}
                      className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-lg p-2 transition-all duration-200 border border-slate-600 hover:border-purple-500/50 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Episode Info */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Episode Number */}
                          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded text-xs font-bold min-w-10 text-center flex-shrink-0">
                            {isManga ? 'CH' : 'EP'}{' '}
                            {isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber}
                          </div>
                          {/* Title - Truncate only very long titles */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium text-xs break-words">
                              {item.title ||
                                `${isManga ? 'Chapter' : 'Episode'} ${
                                  isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber
                                }`}
                            </h3>
                          </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex gap-1 flex-shrink-0">
                          {/* Download Button - Icon Only */}
                          <button
                            onClick={() => handleDownloadClick(item)}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white p-1.5 rounded transition-all duration-300 font-medium flex items-center justify-center hover:scale-105 active:scale-95"
                            title="Download"
                          >
                            <DownloadIcon className="h-3 w-3" />
                          </button>
                          {/* Report Button - Icon Only */}
                          <div className="scale-90">
                            <ReportButton
                              animeId={anime.id}
                              episodeId={item._id}
                              episodeNumber={
                                isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber
                              }
                              animeTitle={anime.title}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* PC VIEW - Original layout, hidden on mobile */}
        <div className="hidden lg:block">
          {/* Enhanced Anime Info Card - ORIGINAL PC LAYOUT */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-700 shadow-xl">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Anime Poster - Fixed for Mobile */}
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <div className="relative group">
                  <img
                    src={displayAnime?.thumbnail}
                    alt={displayAnime?.title}
                    className="w-full max-w-xs lg:w-80 h-auto lg:h-[28rem] object-cover rounded-xl shadow-2xl group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              {/* Anime Details */}
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
                    {displayAnime?.title}
                  </h1>
                  <p className="text-slate-300 leading-relaxed text-lg">
                    {displayAnime?.description || 'No description available for this content.'}
                  </p>
                </div>
                {/* Enhanced Info Section */}
                <div className="space-y-4">
                  {/* Main Info Row - Updated with consistent colors */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Year Badge - Same as genres */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                      {displayAnime?.releaseYear}
                    </div>
                    {/* Status Badge - Special colors */}
                    <div
                      className={`px-4 py-2 rounded-lg font-bold ${
                        displayAnime?.status === 'Ongoing'
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                      }`}
                    >
                      {displayAnime?.status}
                    </div>
                    {/* Type Badge - Same as genres */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold">
                      {displayAnime?.contentType}
                    </div>
                    {/* Hindi Sub / Dub Badges - SAFE & CLEAN CHECK */}
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
                  {/* Enhanced Genres */}
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

          {/* Enhanced Episodes/Chapters Section - ORIGINAL PC LAYOUT */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                {isManga ? 'Chapters' : 'Episodes'}{' '}
                {currentSessionItems.length > 0 && `(${currentSessionItems.length})`}
              </h2>
              {/* Session Selector */}
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
                  <Spinner size="lg" text={`Loading ${isManga ? 'chapters' : 'episodes'}...`} />
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
                    No {isManga ? 'Chapters' : 'Episodes'} Available
                  </h3>
                  <p className="text-slate-400">
                    {isManga ? 'Chapters' : 'Episodes'} will be added soon!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSessionItems
                  .sort((a, b) => {
                    if (isManga) {
                      return (a as Chapter).chapterNumber - (b as Chapter).chapterNumber;
                    } else {
                      return (a as Episode).episodeNumber - (b as Episode).episodeNumber;
                    }
                  })
                  .map((item, index) => (
                    <div
                      key={item._id || index}
                      className="group bg-slate-700/30 hover:bg-slate-600/40 rounded-xl p-4 transition-all duration-300 border border-slate-600 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 backdrop-blur-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Item Info */}
                        <div className="flex items-start sm:items-center gap-4 flex-1">
                          {/* Number Badge */}
                          <div className="flex items-center gap-3">
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold min-w-16 text-center">
                              {isManga ? 'CH' : 'EP'}{' '}
                              {isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber}
                            </span>
                          </div>
                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-lg truncate">
                              {item.title ||
                                `${isManga ? 'Chapter' : 'Episode'} ${
                                  isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber
                                }`}
                            </h3>
                            {item.session > 1 && (
                              <p className="text-slate-400 text-sm mt-1">Session {item.session}</p>
                            )}
                          </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                          {/* Download Button - Small with Icon */}
                          <button
                            onClick={() => handleDownloadClick(item)}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-2 rounded-lg transition-all duration-300 font-medium flex items-center gap-2 hover:scale-105 active:scale-95"
                          >
                            <DownloadIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                          {/* Report Button */}
                          <div className="scale-90">
                            <ReportButton
                              animeId={anime.id}
                              episodeId={item._id}
                              episodeNumber={
                                isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber
                              }
                              animeTitle={anime.title}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Download Modal */}
        {showDownloadModal && (selectedEpisode || selectedChapter) && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl text-center max-w-xs mx-4 transform animate-scale-in">
              <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <DownloadIcon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-base font-bold text-purple-400 mb-2">Preparing Your Download</h3>
              <p className="text-slate-300 text-sm mb-3">
                {isManga ? 'Chapter' : 'Episode'}{' '}
                {isManga ? selectedChapter?.chapterNumber : selectedEpisode?.episodeNumber} is being prepared...
              </p>
              <Spinner size="sm" />
              <div className="mt-3 bg-slate-800/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">You will be redirected to the download page shortly.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimeDetailPage;
