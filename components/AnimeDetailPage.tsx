 // components/AnimeDetailPage.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import type { Anime, Episode } from '../src/types';
import ReportButton from './ReportButton';
import Spinner from './Spinner';

interface Props {
  anime: Anime;
  onBack: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';

const AnimeDetailPage: React.FC<Props> = ({ anime, onBack }) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        console.log('📺 Fetching episodes for anime:', anime.id);
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`${API_BASE}/episodes/${anime.id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const episodesData = await response.json();
        console.log('✅ Episodes loaded:', episodesData.length);
        setEpisodes(episodesData);
      } catch (err) {
        console.error('❌ Error fetching episodes:', err);
        setError('Failed to load episodes');
        // Fallback to episodes from anime object if available
        if (anime.episodes && anime.episodes.length > 0) {
          setEpisodes(anime.episodes);
          setError(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // If anime already has episodes, use them directly
    if (anime.episodes && anime.episodes.length > 0) {
      console.log('✅ Using episodes from anime object:', anime.episodes.length);
      setEpisodes(anime.episodes);
      setIsLoading(false);
    } else {
      // Otherwise fetch episodes
      fetchEpisodes();
    }
  }, [anime]);

  console.log('🎬 AnimeDetailPage - Anime:', anime.title);
  console.log('📺 Episodes available:', episodes.length);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg mb-6 flex items-center gap-2 transition"
      >
        ← Back
      </button>

      {/* Anime Info */}
      <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          <img
            src={anime.thumbnail}
            alt={anime.title}
            className="w-full md:w-64 h-80 object-cover rounded-lg"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
            }}
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{anime.title}</h1>
            <p className="text-slate-300 mb-4">{anime.description}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-400">Status: </span>
                <span className="text-white">{anime.status}</span>
              </div>
              <div>
                <span className="text-slate-400">Year: </span>
                <span className="text-white">{anime.releaseYear}</span>
              </div>
              <div>
                <span className="text-slate-400">Type: </span>
                <span className="text-white">{anime.contentType}</span>
              </div>
              <div>
                <span className="text-slate-400">Audio: </span>
                <span className="text-white">{anime.subDubStatus}</span>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-slate-400">Genres: </span>
              <span className="text-white">{anime.genreList?.join(', ') || 'No genres'}</span>
            </div>

            {/* Report Button */}
            <ReportButton 
              animeId={anime.id}
              animeTitle={anime.title}
            />
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="bg-slate-800/50 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          Episodes {episodes.length > 0 && `(${episodes.length})`}
        </h2>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" text="Loading episodes..." />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-900/20 p-4 rounded-lg mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-red-300 text-xs mt-1">
              Using data from anime object: {anime.episodes?.length || 0} episodes
            </p>
          </div>
        )}

        {!isLoading && episodes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📺</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Episodes Available</h3>
            <p className="text-slate-400">Episodes will be added soon!</p>
          </div>
        ) : (
          !isLoading && (
            <div className="grid gap-3">
              {episodes
                .sort((a, b) => {
                  // Sort by session first, then episode number
                  if (a.session !== b.session) return a.session - b.session;
                  return a.episodeNumber - b.episodeNumber;
                })
                .map((episode, index) => (
                  <div
                    key={episode._id || index}
                    className="bg-slate-700/50 hover:bg-slate-600/50 rounded-lg p-4 transition border border-slate-600/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">
                          {episode.title || `Episode ${episode.episodeNumber}`}
                        </h3>
                        <div className="flex gap-4 text-slate-400 text-sm mt-1">
                          <span>Episode {episode.episodeNumber}</span>
                          {episode.session > 1 && (
                            <span>Session {episode.session}</span>
                          )}
                          {episode.cutyLink && (
                            <span className="text-green-400">• Available</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {episode.cutyLink ? (
                          <a
                            href={episode.cutyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                          >
                            <span>▶</span>
                            Watch
                          </a>
                        ) : (
                          <button
                            disabled
                            className="bg-slate-600 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed"
                          >
                            No Link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AnimeDetailPage;
