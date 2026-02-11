 // components/AnimeDetailWrapper.tsx - UPDATED VERSION WITH LIKE/DISLIKE SUPPORT
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AnimeDetailPage from './AnimeDetailPage';
import { getAnimeByIdOrSlug } from '../services/animeService';
import { AnimeDetailSkeleton } from './SkeletonLoader';
import type { Anime } from '../src/types';

const AnimeDetailWrapper: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnime = async () => {
      if (!idOrSlug) {
        setError('Invalid anime identifier');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching anime with identifier:', idOrSlug);
        
        // ✅ Check if anime was passed in location state (for faster navigation)
        const stateAnime = location.state?.anime;
        if (stateAnime && (stateAnime.slug === idOrSlug || stateAnime._id === idOrSlug)) {
          console.log('✅ Using anime from navigation state:', stateAnime.title);
          setAnime(stateAnime);
          setLoading(false);
          
          // Still fetch latest data in background
          fetchLatestAnimeData(idOrSlug);
          return;
        }
        
        // ✅ Fetch anime by ID or Slug
        const animeData = await getAnimeByIdOrSlug(idOrSlug);
        
        if (!animeData) {
          console.log('❌ Anime not found:', idOrSlug);
          setError('Anime not found');
          setAnime(null);
        } else {
          console.log('✅ Anime found:', animeData.title);
          
          // Check for like/dislike data
          if (animeData.likes !== undefined || animeData.dislikes !== undefined) {
            console.log(`👍👎 Anime has votes - Likes: ${animeData.likes || 0}, Dislikes: ${animeData.dislikes || 0}`);
          }
          
          setAnime(animeData);
        }
      } catch (err) {
        console.error('❌ Error fetching anime:', err);
        setError('Failed to load anime details. Please try again.');
        setAnime(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
    
    // ✅ Scroll to top when anime changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [idOrSlug, location.state]);

  // ✅ Fetch latest anime data in background (for updates like likes/dislikes)
  const fetchLatestAnimeData = async (identifier: string) => {
    try {
      const animeData = await getAnimeByIdOrSlug(identifier);
      if (animeData) {
        console.log('🔄 Background update for anime:', animeData.title);
        setAnime(animeData);
      }
    } catch (err) {
      console.error('Background update failed:', err);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // ✅ ADDED: Function to handle anime selection from "More Like This" section
  const handleAnimeSelect = (selectedAnime: Anime) => {
    // Get the slug or generate one
    const slug = selectedAnime.slug || 
      selectedAnime.title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    // Navigate to the selected anime's detail page with state
    navigate(`/detail/${slug}`, { 
      state: { anime: selectedAnime },
      replace: false 
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ ADDED: Function to handle like/dislike updates
  const handleVoteUpdate = (updatedLikes: number, updatedDislikes: number) => {
    if (anime) {
      setAnime({
        ...anime,
        likes: updatedLikes,
        dislikes: updatedDislikes
      });
      
      console.log(`🔄 Updated votes - Likes: ${updatedLikes}, Dislikes: ${updatedDislikes}`);
    }
  };

  // Show loading skeleton
  if (loading) {
    return <AnimeDetailSkeleton />;
  }

  // Show error message
  if (error || !anime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <button
            onClick={handleBack}
            className="mb-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>←</span>
            Go Back
          </button>
          
          <div className="text-center py-12">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 max-w-md mx-auto">
              <h1 className="text-2xl font-bold text-white mb-4">Anime Not Found</h1>
              <p className="text-slate-300 mb-6">{error || 'The anime you are looking for does not exist.'}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  Go to Homepage
                </button>
                <button
                  onClick={() => navigate('/anime')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  Browse All Anime
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ UPDATED: Pass handleAnimeSelect to AnimeDetailPage
  return (
    <AnimeDetailPage
      anime={anime}
      onBack={handleBack}
      onAnimeSelect={handleAnimeSelect} // ✅ ADDED THIS PROP
      isLoading={loading}
    />
  );
};

export default AnimeDetailWrapper;