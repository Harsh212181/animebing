  import React, { useState, useEffect } from 'react';
import { Anime } from '../../types';

interface FeaturedAnimeManagerProps {}

const FeaturedAnimeManager: React.FC<FeaturedAnimeManagerProps> = () => {
  const [allAnimes, setAllAnimes] = useState<Anime[]>([]);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiStatus, setApiStatus] = useState<string>('Checking API...');
  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    fetchAnimes();
    fetchFeaturedAnimes();
  }, [forceRefresh]);

  const fetchAnimes = async (): Promise<void> => {
    setApiStatus('Fetching animes...');
    setLoading(true);
    
    try {
      console.log('🔄 Fetching all animes...');
      
      const endpoints = [
        '/api/anime?limit=100',
        '/api/animes?limit=100',
        'https://animabing.onrender.com/api/anime?limit=100',
        'https://animabing.onrender.com/api/animes?limit=100'
      ];

      let success = false;
      let fetchedAnimes: Anime[] = [];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          const response = await fetch(endpoint);
          
          if (!response.ok) {
            console.log(`❌ Endpoint ${endpoint} returned status: ${response.status}`);
            continue;
          }
          
          const result = await response.json();
          console.log(`✅ Response from ${endpoint}:`, result);

          if (Array.isArray(result)) {
            fetchedAnimes = result;
          } else if (result.data && Array.isArray(result.data)) {
            fetchedAnimes = result.data;
          } else if (result.success && Array.isArray(result.data)) {
            fetchedAnimes = result.data;
          } else if (result.animes && Array.isArray(result.animes)) {
            fetchedAnimes = result.animes;
          } else if (result.content && Array.isArray(result.content)) {
            fetchedAnimes = result.content;
          }

          if (fetchedAnimes.length > 0) {
            console.log(`✅ Successfully loaded ${fetchedAnimes.length} animes from ${endpoint}`);
            setAllAnimes(fetchedAnimes);
            localStorage.setItem('animeList', JSON.stringify(fetchedAnimes));
            setApiStatus(`✅ Loaded ${fetchedAnimes.length} animes`);
            success = true;
            break;
          } else {
            console.log(`⚠️ Endpoint ${endpoint} returned empty data`);
          }
        } catch (error) {
          console.log(`❌ Failed with ${endpoint}:`, error);
          continue;
        }
      }
      
      if (!success) {
        setApiStatus('❌ All API endpoints failed. Trying localStorage...');
        try {
          const stored = localStorage.getItem('animeList');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAllAnimes(parsed);
              setApiStatus(`✅ Loaded ${parsed.length} animes from localStorage`);
              success = true;
            }
          }
        } catch (storageError) {
          console.error('Error loading from localStorage:', storageError);
        }
      }
      
      if (!success && allAnimes.length === 0) {
        setApiStatus('⚠️ No data found. Using sample data for testing.');
        const sampleData = getSampleAnimes();
        setAllAnimes(sampleData);
        localStorage.setItem('animeList', JSON.stringify(sampleData));
      }
      
    } catch (error) {
      console.error('Error fetching animes:', error);
      setApiStatus('❌ Error loading animes');
    } finally {
      setLoading(false);
    }
  };

  const getSampleAnimes = (): Anime[] => {
    return [
      {
        id: '1',
        _id: '1',
        title: 'Death Note',
        thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
        releaseYear: 2006,
        subDubStatus: 'Hindi Dub',
        contentType: 'Anime',
        description: 'A high school student discovers a supernatural notebook that allows him to kill anyone by writing the victim\'s name.',
        genreList: ['Psychological', 'Thriller', 'Supernatural']
      },
      {
        id: '2',
        _id: '2', 
        title: 'Naruto',
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop',
        releaseYear: 2002,
        subDubStatus: 'Hindi Sub',
        contentType: 'Anime',
        description: 'A young ninja seeks recognition from his peers and dreams of becoming the Hokage.',
        genreList: ['Action', 'Adventure', 'Fantasy']
      },
      {
        id: '3',
        _id: '3',
        title: 'Attack on Titan',
        thumbnail: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w-400&h=600&fit=crop',
        releaseYear: 2013,
        subDubStatus: 'English Sub',
        contentType: 'Anime',
        description: 'Humanity fights for survival against giant humanoid creatures known as Titans.',
        genreList: ['Action', 'Dark Fantasy', 'Drama']
      },
      {
        id: '4',
        _id: '4',
        title: 'One Piece',
        thumbnail: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=400&h=600&fit=crop',
        releaseYear: 1999,
        subDubStatus: 'Hindi Dub',
        contentType: 'Anime',
        description: 'Monkey D. Luffy and his pirate crew explore the Grand Line in search of the world\'s ultimate treasure.',
        genreList: ['Action', 'Adventure', 'Comedy']
      },
      {
        id: '5',
        _id: '5',
        title: 'Demon Slayer',
        thumbnail: 'https://images.unsplash.com/photo-1511984804822-e16ba72fcf0a?w=400&h=600&fit=crop',
        releaseYear: 2019,
        subDubStatus: 'Hindi Sub',
        contentType: 'Anime',
        description: 'A young boy becomes a demon slayer to avenge his family and cure his sister.',
        genreList: ['Action', 'Dark Fantasy', 'Supernatural']
      },
      {
        id: '6',
        _id: '6',
        title: 'My Hero Academia',
        thumbnail: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=600&fit=crop',
        releaseYear: 2016,
        subDubStatus: 'English Sub',
        contentType: 'Anime',
        description: 'A boy without powers in a super-powered world dreams of becoming a hero.',
        genreList: ['Action', 'Superhero', 'Comedy']
      }
    ];
  };

  const fetchFeaturedAnimes = async (): Promise<void> => {
    try {
      console.log('Fetching featured animes...');
      
      const endpoints = [
        '/api/anime/featured',
        '/api/featured',
        'https://animabing.onrender.com/api/anime/featured'
      ];

      let success = false;
      let fetchedFeatured: Anime[] = [];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;
          
          const result = await response.json();
          console.log(`✅ Featured response from ${endpoint}:`, result);

          if (Array.isArray(result)) {
            fetchedFeatured = result;
          } else if (result.data && Array.isArray(result.data)) {
            fetchedFeatured = result.data;
          } else if (result.featured && Array.isArray(result.featured)) {
            fetchedFeatured = result.featured;
          }

          if (fetchedFeatured.length > 0) {
            setFeaturedAnimes(fetchedFeatured);
            localStorage.setItem('featuredAnimes', JSON.stringify(fetchedFeatured));
            success = true;
            break;
          }
        } catch (error) {
          console.log(`❌ Featured failed with ${endpoint}:`, error);
          continue;
        }
      }
      
      if (!success) {
        const stored = localStorage.getItem('featuredAnimes');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFeaturedAnimes(parsed);
          } else {
            setFeaturedAnimes([]);
          }
        } else {
          setFeaturedAnimes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching featured animes:', error);
      setFeaturedAnimes([]);
    }
  };

  const getAnimeId = (anime: Anime): string => {
    return anime._id || anime.id || '';
  };

  const addToFeatured = async (anime: Anime): Promise<void> => {
    try {
      const animeId = getAnimeId(anime);
      
      const alreadyFeatured = featuredAnimes.some(feat => 
        getAnimeId(feat) === animeId
      );
      
      if (alreadyFeatured) {
        console.log('⚠️ Anime already in featured list');
        return;
      }

      const newFeaturedAnime = { 
        ...anime, 
        isFeatured: true,
        featuredOrder: featuredAnimes.length + 1
      };
      
      const updatedFeatured = [...featuredAnimes, newFeaturedAnime];
      setFeaturedAnimes(updatedFeatured);
      
      localStorage.setItem('featuredAnimes', JSON.stringify(updatedFeatured));
      
      console.log(`✅ Added "${anime.title}" to featured. Total: ${updatedFeatured.length}`);
      
      try {
        const response = await fetch(`https://animabing.onrender.com/api/anime/${animeId}/featured`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          console.log('✅ Added to featured via API');
        } else {
          console.log('⚠️ API call failed, but stored locally');
        }
      } catch (apiError) {
        console.log('⚠️ API call failed, but stored locally');
      }
      
    } catch (error) {
      console.error('Error adding to featured:', error);
    }
  };

  const removeFromFeatured = async (animeId: string): Promise<void> => {
    try {
      const updated = featuredAnimes.filter(anime => 
        getAnimeId(anime) !== animeId
      );
      setFeaturedAnimes(updated);
      
      localStorage.setItem('featuredAnimes', JSON.stringify(updated));
      
      console.log(`✅ Removed anime from featured. Remaining: ${updated.length}`);
      
      try {
        const response = await fetch(`https://animabing.onrender.com/api/anime/${animeId}/featured`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log('✅ Removed from featured via API');
        } else {
          console.log('⚠️ API call failed, but removed locally');
        }
      } catch (apiError) {
        console.log('⚠️ API call failed, but removed locally');
      }
      
    } catch (error) {
      console.error('Error removing from featured:', error);
    }
  };

  const reorderFeatured = (fromIndex: number, toIndex: number): void => {
    const updated = [...featuredAnimes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    
    const withUpdatedOrder = updated.map((anime, index) => ({
      ...anime,
      featuredOrder: index + 1
    }));
    
    setFeaturedAnimes(withUpdatedOrder);
    localStorage.setItem('featuredAnimes', JSON.stringify(withUpdatedOrder));
    
    try {
      fetch('https://animabing.onrender.com/api/anime/featured/order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          order: withUpdatedOrder.map(anime => getAnimeId(anime)) 
        }),
      }).then(response => {
        if (response.ok) {
          console.log('✅ Featured order updated via API');
        } else {
          console.log('⚠️ Order update API failed, but stored locally');
        }
      });
    } catch (error) {
      console.log('⚠️ Order update API failed, but stored locally');
    }
  };

  const filteredAnimes = allAnimes.filter(anime => {
    if (!anime.title) return false;
    
    const animeId = getAnimeId(anime);
    
    const isFeatured = featuredAnimes.some(featured => 
      getAnimeId(featured) === animeId
    );
    
    if (isFeatured) return false;
    
    if (searchTerm.trim()) {
      return anime.title.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    return true;
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('featuredAnimes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFeaturedAnimes(parsed);
        }
      }
    } catch (error) {
      console.log('No stored featured animes found');
    }
  }, []);

  const handleForceRefresh = () => {
    setForceRefresh(prev => prev + 1);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
              <div className="absolute inset-0 animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500 opacity-75" style={{ animationDirection: 'reverse' }}></div>
            </div>
            <p className="mt-6 text-xl font-semibold">Loading Anime Collection</p>
            <p className="mt-2 text-gray-400">{apiStatus}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-white p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 bg-clip-text text-transparent">
          Featured Anime Manager
        </h1>
        <p className="text-gray-400 mt-2">Manage your featured anime collection for the homepage carousel</p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mr-4">
              <span className="text-2xl">🎬</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Anime</p>
              <p className="text-2xl font-bold">{allAnimes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mr-4">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Featured Anime</p>
              <p className="text-2xl font-bold">{featuredAnimes.length}<span className="text-sm text-gray-400 ml-2">/ 24 max</span></p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 mr-4">
              <span className="text-2xl">🔍</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">API Status</p>
              <p className={`text-sm font-semibold ${apiStatus.includes('✅') ? 'text-green-400' : apiStatus.includes('❌') ? 'text-red-400' : 'text-yellow-400'}`}>
                {apiStatus}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Featured Section */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Featured Collection</h2>
            <p className="text-gray-400 text-sm mt-1">Drag and drop to reorder featured anime</p>
          </div>
          <span className="px-4 py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/30 rounded-full text-sm">
            {featuredAnimes.length} Featured
          </span>
        </div>
        
        {featuredAnimes.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-700/50">
            <div className="text-6xl mb-4 opacity-30">🎬</div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Featured Anime Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Start building your featured collection by adding anime from the library below
            </p>
            <button
              onClick={() => document.getElementById('add-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg"
            >
              Add Anime to Featured
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {featuredAnimes.map((anime, index) => (
              <div 
                key={getAnimeId(anime)} 
                className="group relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 border border-gray-700/50 hover:border-purple-500/50"
              >
                {/* Featured Badge */}
                <div className="absolute top-3 left-3 z-20">
                  <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold shadow-lg">
                    #{index + 1}
                  </div>
                </div>

                {/* Card Image */}
                <div className="relative h-64 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10"></div>
                  <img 
                    src={anime.thumbnail || anime.posterImage || anime.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop'} 
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop';
                    }}
                  />
                  
                  {/* Action Buttons */}
                  <div className="absolute top-3 right-3 z-20 flex gap-2">
                    {index > 0 && (
                      <button
                        onClick={() => reorderFeatured(index, index - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-900/90 hover:bg-blue-600 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
                        title="Move up"
                      >
                        <span className="text-xs">↑</span>
                      </button>
                    )}
                    {index < featuredAnimes.length - 1 && (
                      <button
                        onClick={() => reorderFeatured(index, index + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-900/90 hover:bg-blue-600 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
                        title="Move down"
                      >
                        <span className="text-xs">↓</span>
                      </button>
                    )}
                    <button
                      onClick={() => removeFromFeatured(getAnimeId(anime))}
                      className="w-8 h-8 flex items-center justify-center bg-gray-900/90 hover:bg-red-600 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-red-500/30"
                      title="Remove from featured"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-lg truncate mb-1">{anime.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{anime.releaseYear || 'N/A'}</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span className="px-2 py-0.5 bg-gray-800 rounded text-xs">{anime.subDubStatus || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Genres */}
                  {anime.genreList && anime.genreList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {anime.genreList.slice(0, 3).map((genre, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-gray-800/60 text-gray-300 text-xs rounded-lg backdrop-blur-sm"
                        >
                          {genre}
                        </span>
                      ))}
                      {anime.genreList.length > 3 && (
                        <span className="px-2 py-1 bg-gray-900 text-gray-500 text-xs rounded-lg">
                          +{anime.genreList.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description (hover reveal) */}
                  {anime.description && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <p className="text-gray-400 text-sm line-clamp-2 group-hover:line-clamp-4 transition-all">
                        {anime.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Anime Section */}
      <div id="add-section">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Add Anime to Featured</h2>
          <p className="text-gray-400">Select anime from your collection to feature on the homepage</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <div className="relative group">
              <input
                type="text"
                placeholder="Search anime by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 pl-12 pr-10 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
              />
              {/* Fixed Search Icon */}
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <svg 
                  className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 bg-gray-700/50 hover:bg-gray-600/50 rounded-full transition-all group"
                  title="Clear search"
                >
                  <svg 
                    className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleForceRefresh}
              className="px-6 py-4 flex items-center gap-2 bg-gradient-to-r from-blue-600/90 to-blue-700/90 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl font-medium transition-all transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => {
                const sampleData = getSampleAnimes();
                setAllAnimes(sampleData);
                localStorage.setItem('animeList', JSON.stringify(sampleData));
                setApiStatus('✅ Loaded sample data for testing');
              }}
              className="px-6 py-4 flex items-center gap-2 bg-gradient-to-r from-green-600/90 to-emerald-700/90 hover:from-green-500 hover:to-emerald-600 text-white rounded-2xl font-medium transition-all transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Sample Data
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-xl">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm">Total: <strong>{allAnimes.length}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-xl">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm">Featured: <strong>{featuredAnimes.length}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-xl">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Available: <strong>{filteredAnimes.length}</strong></span>
          </div>
        </div>

        {/* Anime Grid */}
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filteredAnimes.map(anime => (
              <div 
                key={getAnimeId(anime)} 
                className="group relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 border border-gray-700/50 hover:border-green-500/50 hover:-translate-y-1"
              >
                {/* Anime Image */}
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={anime.thumbnail || anime.posterImage || anime.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop'} 
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                  
                  {/* Audio Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                      anime.subDubStatus?.includes('Dub') 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600' 
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600'
                    }`}>
                      {anime.subDubStatus?.includes('Dub') ? 'DUB' : 'SUB'}
                    </span>
                  </div>
                </div>

                {/* Anime Info */}
                <div className="p-4">
                  <h3 className="font-bold text-white text-sm mb-2 truncate group-hover:text-green-400 transition-colors">
                    {anime.title}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">
                      {anime.releaseYear || 'N/A'}
                    </span>
                    {/* Removed episodeCount display */}
                  </div>

                  {/* Quick Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Anime</span>
                    </div>
                    {/* Genre Preview */}
                    {anime.genreList && anime.genreList.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px] text-gray-400">
                          {anime.genreList[0]}
                        </span>
                        {anime.genreList.length > 1 && (
                          <span className="text-gray-600">+{anime.genreList.length - 1}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => addToFeatured(anime)}
                    disabled={featuredAnimes.length >= 24}
                    className={`w-full py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                      featuredAnimes.length >= 24
                        ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white shadow-lg hover:shadow-green-500/30'
                    }`}
                  >
                    {featuredAnimes.length >= 24 ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Max Featured Reached
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add to Featured
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-sm rounded-2xl border border-gray-700/50">
            <div className="max-w-md mx-auto">
              <div className="text-7xl mb-6 opacity-20">🎭</div>
              {searchTerm ? (
                <>
                  <h3 className="text-2xl font-bold text-gray-300 mb-3">No Matches Found</h3>
                  <p className="text-gray-500 mb-8">
                    No anime found for "<span className="text-purple-400">{searchTerm}</span>". Try a different search term.
                  </p>
                </>
              ) : allAnimes.length === 0 ? (
                <>
                  <h3 className="text-2xl font-bold text-gray-300 mb-3">No Anime Available</h3>
                  <p className="text-gray-500 mb-8">
                    Your anime database is empty. Try refreshing or loading sample data.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-gray-300 mb-3">All Anime Featured!</h3>
                  <p className="text-gray-500 mb-8">
                    Congratulations! All available anime are already in your featured collection.
                  </p>
                </>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600/90 to-pink-600/90 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all"
                >
                  Clear Search
                </button>
                <button
                  onClick={handleForceRefresh}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600/90 to-blue-700/90 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-medium transition-all"
                >
                  Refresh Database
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedAnimeManager;
