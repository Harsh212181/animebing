 // components/AnimeDetailPage.tsx - UPDATED WITH MANGA SUPPORT
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../src/types'; // ✅ ADD Chapter
import { DownloadIcon } from './icons/DownloadIcon';
import ReportButton from './ReportButton';
import Spinner from './Spinner';
import { AnimeDetailSkeleton } from './SkeletonLoader';

interface AnimeDetailPageProps {
  anime: Anime | null;
  onBack: () => void;
  isLoading?: boolean;
}

const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({ anime, onBack, isLoading = false }) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null); // ✅ NEW
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true); // ✅ NEW
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]); // ✅ NEW

  // Check if content is Manga
  const isManga = anime?.contentType === 'Manga';

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
          const response = await fetch(`http://localhost:3000/api/chapters/${anime.id}`);
          
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
          const response = await fetch(`http://localhost:3000/api/episodes/${anime.id}`);
          
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

      } catch (error) {
        console.error(`Failed to fetch ${isManga ? 'chapters' : 'episodes'}:`, error);
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
      window.open(item.cutyLink, '_blank');
    }, 1500);
    setTimeout(() => setShowDownloadModal(false), 3000);
  };

  // ✅ LOADING STATE
  if (isLoading || !anime) {
    return <AnimeDetailSkeleton />;
  }

  return (
    <div className="animate-fade-in">
      {/* Background Banner */}
      <div className="relative -mx-4 -mt-8 mb-8">
        <div className="absolute inset-0 overflow-hidden h-[450px]">
          <img src={anime.thumbnail} alt="" className="w-full h-full object-cover filter blur-2xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c1c] via-[#0a0c1c]/80 to-[#0a0c1c]/20" />
        </div>

        <div className="relative container mx-auto px-4 pt-24 pb-12">
          <button
            onClick={onBack}
            className="absolute top-8 left-4 bg-slate-800/50 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 backdrop-blur-sm flex items-center gap-2"
          >
            &larr; Back to Browse
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {/* Poster */}
            <div className="md:col-span-1 lg:col-span-1">
              <img
                src={anime.thumbnail}
                alt={anime.title}
                className="rounded-lg shadow-2xl w-full transform transition-transform hover:scale-105 duration-300"
                loading="eager"
              />
            </div>

            {/* Info */}
            <div className="md:col-span-2 lg:col-span-3 flex flex-col justify-end space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2 drop-shadow-lg leading-tight">
                {anime.title}
              </h1>

              <div className="flex items-center space-x-4 flex-wrap gap-2">
                <span className="text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full text-sm">
                  {anime.releaseYear}
                </span>
                {!isManga && ( // ✅ HIDE SUB/DUB FOR MANGA
                  <span className="bg-purple-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                    {anime.subDubStatus}
                  </span>
                )}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  anime.status === 'Complete'
                    ? 'bg-green-600 text-white'
                    : 'bg-yellow-600 text-white'
                }`}>
                  {anime.status || 'Ongoing'}
                </span>
                {/* ✅ CONTENT TYPE BADGE */}
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  anime.contentType === 'Manga' 
                    ? 'bg-red-600 text-white' 
                    : anime.contentType === 'Movie'
                    ? 'bg-blue-600 text-white'
                    : 'bg-purple-600 text-white'
                }`}>
                  {anime.contentType}
                </span>
                {/* ✅ SESSION BADGE */}
                {availableSessions.length > 1 && (
                  <span className="bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                    {availableSessions.length} Sessions
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {anime.genreList.map(genre => (
                  <span key={genre} className="bg-slate-700/80 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-600/50">
                    {genre}
                  </span>
                ))}
              </div>

              <p className="text-slate-300 leading-relaxed text-lg max-w-3xl">
                {anime.description || 'No description available for this content.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes/Chapters Section */}
      <div className="mt-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-100 border-l-4 border-purple-500 pl-4 flex items-center gap-3">
            {isManga ? 'Chapters' : 'Episodes'} {/* ✅ DYNAMIC TITLE */}
            {(isManga ? chaptersLoading : episodesLoading) && <Spinner size="sm" />}
          </h2>

          {/* ✅ SESSION SELECTOR */}
          {availableSessions.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm font-medium">Session:</span>
              <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
                {availableSessions.map(session => (
                  <button
                    key={session}
                    onClick={() => setSelectedSession(session)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      selectedSession === session
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Session {session}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(isManga ? chaptersLoading : episodesLoading) ? (
          <div className="bg-slate-800/50 rounded-lg shadow-lg p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-700/30 rounded-lg animate-pulse">
                  <div className="h-4 bg-slate-600/50 rounded w-1/3"></div>
                  <div className="h-8 bg-slate-600/50 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden">
            {itemsBySession[selectedSession] && itemsBySession[selectedSession].length > 0 ? (
              <ul className="divide-y divide-slate-700 max-h-[50vh] overflow-y-auto">
                {itemsBySession[selectedSession].map((item: Episode | Chapter) => (
                  <li key={item._id} className="p-2 flex items-center justify-between gap-1 hover:bg-slate-700/50 transition-all duration-200 group episode-item">
                    {/* Left Section - Item Info */}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-purple-400 font-semibold text-xs bg-purple-600/20 px-1 py-0.5 rounded shrink-0">
                        {isManga ? 'CH' : 'EP'}{isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber} {/* ✅ DYNAMIC LABEL */}
                      </span>
                      
                      {availableSessions.length > 1 && (
                        <span className="text-[8px] text-blue-400 bg-blue-600/20 px-1 py-0.5 rounded shrink-0">
                          S{item.session}
                        </span>
                      )}
                      
                      <span className="text-slate-300 text-xs truncate flex-1 min-w-0 ml-1">
                        {item.title || `${isManga ? 'Chapter' : 'Episode'} ${isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber}`}
                      </span>
                    </div>

                    {/* Right Section - Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* ✅ DOWNLOAD BUTTON - ICON ONLY */}
                      <button
                        onClick={() => handleDownloadClick(item)}
                        className="bg-purple-600 hover:bg-purple-500 text-white p-1.5 rounded transition-all flex items-center justify-center"
                        title={`Download ${isManga ? 'Chapter' : 'Episode'}`}
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                      
                      {/* ✅ REPORT BUTTON - ICON ONLY */}
                      <ReportButton
                        animeId={anime.id}
                        episodeId={item._id}
                        episodeNumber={isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber}
                        animeTitle={anime.title}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">{isManga ? '📚' : '📺'}</div> {/* ✅ DYNAMIC ICON */}
                <h3 className="text-xl font-semibold text-slate-300 mb-2">
                  No {isManga ? 'Chapters' : 'Episodes'} Available
                </h3>
                <p className="text-slate-400">
                  {isManga ? 'Chapters' : 'Episodes'} will be added soon!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Modal */}
      {showDownloadModal && (selectedEpisode || selectedChapter) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-lg shadow-2xl text-center max-w-sm mx-4 transform animate-scale-in">
            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <DownloadIcon className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">Preparing Your Download</h3>
            <p className="text-slate-300 mb-4">
              {isManga ? 'Chapter' : 'Episode'} {isManga ? selectedChapter?.chapterNumber : selectedEpisode?.episodeNumber} is being prepared...
            </p>
            <Spinner size="md" />
            <div className="mt-4 bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500">
                You will be redirected to the download page shortly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimeDetailPage;