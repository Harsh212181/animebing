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
      
      // Try multiple endpoints
      const endpoints = [
        '/api/anime',
        '/api/animes', 
        'https://animabing.onrender.com/api/anime',
        'https://animabing.onrender.com/api/animes'
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

          // Handle different response structures
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
            // Save to localStorage for future use
            localStorage.setItem('animeList', JSON.stringify(fetchedAnimes));
            setApiStatus(`✅ Loaded ${fetchedAnimes.length} animes from ${endpoint}`);
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
        // Try to get from localStorage
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
      
      // If still no data, create sample data
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

  // Sample data for testing
  const getSampleAnimes = (): Anime[] => {
    return [
      {
        id: '1',
        _id: '1',
        title: 'Death Note',
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Death+Note',
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
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Naruto',
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
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Attack+on+Titan',
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
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=One+Piece',
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
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Demon+Slayer',
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
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=My+Hero+Academia',
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
      
      // Try multiple endpoints for featured
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
        // Fallback to localStorage
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

  // ✅ FIXED: Better anime ID comparison
  const getAnimeId = (anime: Anime): string => {
    return anime._id || anime.id || '';
  };

  // ✅ FIXED: Improved add to featured function
  const addToFeatured = async (anime: Anime): Promise<void> => {
    try {
      const animeId = getAnimeId(anime);
      
      // Check if already in featured
      const alreadyFeatured = featuredAnimes.some(feat => 
        getAnimeId(feat) === animeId
      );
      
      if (alreadyFeatured) {
        console.log('⚠️ Anime already in featured list');
        return;
      }

      // Update local state immediately
      const newFeaturedAnime = { 
        ...anime, 
        isFeatured: true,
        featuredOrder: featuredAnimes.length + 1
      };
      
      const updatedFeatured = [...featuredAnimes, newFeaturedAnime];
      setFeaturedAnimes(updatedFeatured);
      
      // Save to localStorage
      localStorage.setItem('featuredAnimes', JSON.stringify(updatedFeatured));
      
      console.log(`✅ Added "${anime.title}" to featured. Total: ${updatedFeatured.length}`);
      
      // Try API call
      try {
        const response = await fetch('/api/anime/featured', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ animeId }),
        });

        if (response.ok) {
          console.log('✅ Added to featured via API');
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
      // Update local state
      const updated = featuredAnimes.filter(anime => 
        getAnimeId(anime) !== animeId
      );
      setFeaturedAnimes(updated);
      
      // Save to localStorage
      localStorage.setItem('featuredAnimes', JSON.stringify(updated));
      
      console.log(`✅ Removed anime from featured. Remaining: ${updated.length}`);
      
      // Try API call
      try {
        const response = await fetch(`/api/anime/featured/${animeId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log('✅ Removed from featured via API');
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
    
    // Update order numbers
    const withUpdatedOrder = updated.map((anime, index) => ({
      ...anime,
      featuredOrder: index + 1
    }));
    
    setFeaturedAnimes(withUpdatedOrder);
    localStorage.setItem('featuredAnimes', JSON.stringify(withUpdatedOrder));
    
    // Try API call
    try {
      fetch('/api/anime/featured/order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          order: withUpdatedOrder.map(anime => getAnimeId(anime)) 
        }),
      });
    } catch (error) {
      console.log('⚠️ Order update API failed, but stored locally');
    }
  };

  // ✅ FIXED: Improved search filtering
  const filteredAnimes = allAnimes.filter(anime => {
    if (!anime.title) return false;
    
    const animeId = getAnimeId(anime);
    
    // Check if anime is already featured
    const isFeatured = featuredAnimes.some(featured => 
      getAnimeId(featured) === animeId
    );
    
    // If already featured, exclude from available list
    if (isFeatured) return false;
    
    // If search term exists, filter by title
    if (searchTerm.trim()) {
      return anime.title.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    // If no search term, show all non-featured animes
    return true;
  });

  // Load from localStorage on component mount
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

  // Force refresh function
  const handleForceRefresh = () => {
    setForceRefresh(prev => prev + 1);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4">Loading featured animes...</p>
        <p className="text-sm text-gray-400 mt-2">{apiStatus}</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-6">Featured Anime Manager</h2>
      
      {/* API Status */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <p className="text-sm">
          <strong>Status:</strong> {apiStatus}
        </p>
        <p className="text-sm mt-1">
          <strong>Tip:</strong> Add 6-12 animes for best carousel experience
        </p>
        <p className="text-xs text-gray-400 mt-1">
          <strong>Debug:</strong> All: {allAnimes.length} | Featured: {featuredAnimes.length} | Available: {filteredAnimes.length}
        </p>
      </div>
      
      {/* Current Featured Animes */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Current Featured Animes</h3>
          <span className="text-sm bg-purple-600 px-3 py-1 rounded-full">
            {featuredAnimes.length} / 24 max
          </span>
        </div>
        
        {featuredAnimes.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 rounded-lg">
            <p className="text-gray-400">No featured animes yet.</p>
            <p className="text-sm text-gray-500 mt-2">
              Add animes below to feature them in the home page carousel
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {featuredAnimes.map((anime, index) => (
              <div key={getAnimeId(anime)} className="border border-gray-600 rounded-lg p-4 bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-start gap-3">
                  <img 
                    src={anime.thumbnail || anime.posterImage || anime.coverImage || '/images/fallback-thumbnail.jpg'} 
                    alt={anime.title}
                    className="w-16 h-20 object-cover rounded flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x80?text=No+Image';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate text-white mb-1">{anime.title}</h4>
                    <div className="text-xs text-gray-400 mb-2">
                      {anime.releaseYear || 'N/A'} • {anime.subDubStatus || 'Unknown'}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">#{index + 1}</span>
                      <div className="flex gap-1">
                        {index > 0 && (
                          <button
                            onClick={() => reorderFeatured(index, index - 1)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {index < featuredAnimes.length - 1 && (
                          <button
                            onClick={() => reorderFeatured(index, index + 1)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => removeFromFeatured(getAnimeId(anime))}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Anime to Featured */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Add Anime to Featured</h3>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
          >
            Show All Animes
          </button>
          <button
            onClick={handleForceRefresh}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            🔄 Force Refresh Data
          </button>
          <button
            onClick={() => {
              const sampleData = getSampleAnimes();
              setAllAnimes(sampleData);
              localStorage.setItem('animeList', JSON.stringify(sampleData));
              setApiStatus('✅ Loaded sample data for testing');
            }}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
          >
            Load Sample Data
          </button>
        </div>
        
        {/* Search Input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search anime by title... (Leave empty to see all available animes)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Stats */}
        <div className="text-sm text-gray-400 mb-4 flex flex-wrap gap-4">
          <span>Total animes: {allAnimes.length}</span>
          <span>Featured: {featuredAnimes.length}</span>
          <span>Available: {filteredAnimes.length}</span>
        </div>
        
        {/* Debug Info */}
        <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-900 rounded">
          <strong>Debug Info:</strong> Search Term: "{searchTerm}" | Showing {filteredAnimes.length} animes
        </div>
        
        {/* Anime Grid */}
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAnimes.map(anime => (
              <div key={getAnimeId(anime)} className="border border-gray-600 rounded-lg p-4 bg-gray-800 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <img 
                  src={anime.thumbnail || anime.posterImage || anime.coverImage || '/images/fallback-thumbnail.jpg'} 
                  alt={anime.title}
                  className="w-full h-40 object-cover rounded mb-3"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=No+Image';
                  }}
                />
                <h4 className="font-semibold mb-2 truncate text-white">{anime.title}</h4>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-300">{anime.releaseYear || 'N/A'}</span>
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                    {anime.subDubStatus || 'Unknown'}
                  </span>
                </div>
                <button
                  onClick={() => addToFeatured(anime)}
                  disabled={featuredAnimes.length >= 24}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors font-medium"
                >
                  {featuredAnimes.length >= 24 ? 'Max Reached (24)' : 'Add to Featured'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-800 rounded-lg">
            {searchTerm ? (
              <>
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-400">No animes found for "{searchTerm}"</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try a different search term or check if the anime is already featured
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setSearchTerm('')}
                    className="block w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    Show All Animes
                  </button>
                  <button
                    onClick={handleForceRefresh}
                    className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Force Refresh Data
                  </button>
                </div>
              </>
            ) : allAnimes.length === 0 ? (
              <>
                <div className="text-4xl mb-3">😞</div>
                <p className="text-gray-400">No animes available in database</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try refreshing the data or loading sample data for testing
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={handleForceRefresh}
                    className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Force Refresh Data
                  </button>
                  <button
                    onClick={() => {
                      const sampleData = getSampleAnimes();
                      setAllAnimes(sampleData);
                      localStorage.setItem('animeList', JSON.stringify(sampleData));
                    }}
                    className="block w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Load Sample Data
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-400">All animes are already featured!</p>
                <p className="text-sm text-gray-500 mt-2">
                  Remove some animes from featured to add new ones
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedAnimeManager;
