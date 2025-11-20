 // components/AnimeDetailPage.tsx - IMPROVED DESIGN
import React, { useState, useEffect } from 'react';
import type { Anime, Episode } from '../src/types';
import ReportButton from './ReportButton';
import Spinner from './Spinner';

interface Props {
  anime: Anime;
  onBack: () => void;
}

const API_BASE = 'https://animabing.onrender.com/api';

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack }) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`${API_BASE}/episodes/${anime.id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const episodesData = await response.json();
        
        const cleanedEpisodes = episodesData.map((episode: any) => ({
          ...episode,
          cutyLink: episode.cutyLink && 
                   !episode.cutyLink.includes('localhost') && 
                   episode.cutyLink.startsWith('http') 
                   ? episode.cutyLink.trim() 
                   : ''
        }));
        
        setEpisodes(cleanedEpisodes);
      } catch (err) {
        console.error('Error fetching episodes:', err);
        setError('Failed to load episodes');
        if (anime.episodes && anime.episodes.length > 0) {
          setEpisodes(anime.episodes);
          setError(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEpisodes();
  }, [anime]);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg mb-6 flex items-center gap-2 transition-colors duration-300 font-medium"
        >
          <span>←</span>
          Back to Home
        </button>

        {/* Anime Info Card */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8 border border-slate-700">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Anime Poster */}
            <div className="flex-shrink-0">
              <div className="relative">
                <img
                  src={anime.thumbnail}
                  alt={anime.title}
                  className="w-80 h-[28rem] object-cover rounded-lg shadow-lg"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
                  }}
                />
              </div>
            </div>

            {/* Anime Details */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-4">
                {anime.title}
              </h1>
              
              <p className="text-slate-300 mb-6 leading-relaxed">
                {anime.description}
              </p>

              {/* Simplified Info Section - No Boxes */}
              <div className="space-y-4 mb-6">
                {/* Main Info Row */}
                <div className="flex flex-wrap items-center gap-6 text-slate-300">
                  <div>
                    <span className="text-slate-400 text-sm font-medium mr-2">Status</span>
                    <span className="text-white font-semibold">{anime.status}</span>
                  </div>
                  
                  <div>
                    <span className="text-slate-400 text-sm font-medium mr-2">Release Year</span>
                    <span className="text-white font-semibold">{anime.releaseYear}</span>
                  </div>
                  
                  <div>
                    <span className="text-slate-400 text-sm font-medium mr-2">Type</span>
                    <span className="text-white font-semibold">{anime.contentType}</span>
                  </div>
                </div>

                {/* Genres - Simplified */}
                <div>
                  <span className="text-slate-400 text-sm font-medium mr-3">Genres</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {anime.genreList?.map((genre, index) => (
                      <span
                        key={index}
                        className="bg-purple-600/80 hover:bg-purple-500 text-white px-3 py-1 rounded-md text-sm transition-colors"
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

        {/* Episodes Section */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6">
            Episodes {episodes.length > 0 && `(${episodes.length})`}
          </h2>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Spinner size="lg" text="Loading episodes..." />
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!isLoading && episodes.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Episodes Available</h3>
              <p className="text-slate-400">Episodes will be added soon!</p>
            </div>
          ) : (
            !isLoading && (
              <div className="space-y-3">
                {episodes
                  .sort((a, b) => {
                    if (a.session !== b.session) return a.session - b.session;
                    return a.episodeNumber - b.episodeNumber;
                  })
                  .map((episode, index) => (
                    <div
                      key={episode._id || index}
                      className="bg-slate-700/50 hover:bg-slate-600/50 rounded-lg p-4 transition-all duration-300 border border-slate-600 hover:border-purple-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-bold">
                              EP {episode.episodeNumber}
                            </span>
                            {episode.session > 1 && (
                              <span className="bg-slate-600 text-slate-300 px-3 py-1 rounded text-sm">
                                Session {episode.session}
                              </span>
                            )}
                          </div>
                          <h3 className="text-white font-semibold">
                            {episode.title || `Episode ${episode.episodeNumber}`}
                          </h3>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (episode.cutyLink) {
                                window.open(episode.cutyLink, '_blank');
                              } else {
                                alert(`Episode ${episode.episodeNumber} - Download link will be added soon!`);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors duration-300 font-medium flex items-center gap-2"
                          >
                            {/* Download Icon */}
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-4 w-4" 
                              viewBox="0 0 20 20" 
                              fill="currentColor"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                            Download
                          </button>
                          
                          {/* Report Button for episode only */}
                          <ReportButton 
                            animeId={anime.id}
                            episodeId={episode._id}
                            episodeNumber={episode.episodeNumber}
                            animeTitle={anime.title}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimeDetailPage;
