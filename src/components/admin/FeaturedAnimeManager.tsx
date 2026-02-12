 // src/components/admin/FeaturedAnimeManager.tsx – FULLY UPDATED, IMAGE FIXED, THEME MATCHED
import React, { useState, useEffect } from 'react';
import { Anime } from '../../types';

interface FeaturedAnimeManagerProps {}

// Helper to get optimized image URL with proper dimensions
const getOptimizedImageUrl = (url: string, width: number, height: number): string => {
  if (!url) return 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop';
  
  // Fix broken Unsplash URLs (e.g., "w-400" → "w=400")
  let cleanUrl = url.replace(/w-(\d+)/, 'w=$1').replace(/h-(\d+)/, 'h=$1');
  
  // If it's an Unsplash URL, append size parameters
  if (cleanUrl.includes('unsplash.com')) {
    // Remove existing query params and add our own
    const baseUrl = cleanUrl.split('?')[0];
    return `${baseUrl}?w=${width}&h=${height}&fit=crop&auto=format`;
  }
  
  // If it's a Cloudinary URL, use transformations
  if (cleanUrl.includes('cloudinary.com')) {
    try {
      const baseUrl = cleanUrl.split('/upload/')[0];
      const rest = cleanUrl.split('/upload/')[1];
      const imagePath = rest.split('/').slice(1).join('/');
      return `${baseUrl}/upload/f_webp,q_auto:good,w_${width},h_${height},c_fill/${imagePath}`;
    } catch {
      return cleanUrl;
    }
  }
  
  return cleanUrl;
};

const FeaturedAnimeManager: React.FC<FeaturedAnimeManagerProps> = () => {
  // ---------- ALL LOGIC UNCHANGED ----------
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
        thumbnail: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=600&fit=crop', // FIXED: w=400&h=600
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

  // ---------- END OF LOGIC – JSX WITH IMAGE FIXES ----------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-2xl">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-orange-500/30 border-b-orange-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
        </div>
        <p className="mt-6 text-xl font-semibold text-white/90">Loading Anime Collection</p>
        <p className="mt-2 text-white/60">{apiStatus}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
            Featured Anime Manager
          </h1>
          <p className="text-white/50 text-sm mt-1">Manage your homepage carousel</p>
        </div>
      </div>

      {/* Stats Dashboard – purple glass cards with amber/orange accents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 rounded-lg">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 6v.878m13.5 0A2.25 2.25 0 0119.5 6v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 9v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V9a2.25 2.25 0 012.25-2.25V6.878" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">Total Anime</p>
            <p className="text-2xl font-bold text-white">{allAnimes.length}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">Featured Anime</p>
            <p className="text-2xl font-bold text-white">{featuredAnimes.length} <span className="text-sm font-normal text-white/40">/ 24</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${
            apiStatus.includes('✅') ? 'bg-emerald-500/20' : 
            apiStatus.includes('❌') ? 'bg-rose-500/20' : 
            'bg-amber-500/20'
          }`}>
            <svg className={`w-6 h-6 ${
              apiStatus.includes('✅') ? 'text-emerald-400' : 
              apiStatus.includes('❌') ? 'text-rose-400' : 
              'text-amber-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">API Status</p>
            <p className={`text-sm font-medium ${
              apiStatus.includes('✅') ? 'text-emerald-400' : 
              apiStatus.includes('❌') ? 'text-rose-400' : 
              'text-amber-400'
            }`}>
              {apiStatus}
            </p>
          </div>
        </div>
      </div>

      {/* Current Featured Section – compact cards (h-40) with optimized images */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full"></span>
          <h2 className="text-xl font-bold text-white/90">Featured Collection</h2>
          <span className="text-sm text-white/50 bg-white/5 px-3 py-1 rounded-full">
            {featuredAnimes.length} items
          </span>
        </div>

        {featuredAnimes.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-2xl">
            <svg className="w-16 h-16 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white/80">No Featured Anime Yet</h3>
            <p className="mt-1 text-white/50 text-sm max-w-md mx-auto">
              Start building your featured collection by adding anime from the library below.
            </p>
            <button
              onClick={() => document.getElementById('add-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-6 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-amber-600/20 transition-all"
            >
              Add Anime to Featured
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {featuredAnimes.map((anime, index) => {
              // Featured card image dimensions: height 40 (160px), width auto (approx 107px for 2:3)
              const imgWidth = 150;
              const imgHeight = 225;
              const optimizedSrc = getOptimizedImageUrl(anime.thumbnail, imgWidth, imgHeight);
              
              return (
                <div
                  key={getAnimeId(anime)}
                  className="group bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10"
                >
                  {/* Rank Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    <div className="px-2 py-0.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full text-[10px] font-bold shadow-lg">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Image – compact height h-40, with optimized source */}
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={optimizedSrc}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      width={imgWidth}
                      height={imgHeight}
                      onError={(e) => {
                        // Fallback to original URL with fixed dimensions
                        e.currentTarget.src = getOptimizedImageUrl(anime.thumbnail || '', 150, 225);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>

                    {/* Action Buttons – compact */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {index > 0 && (
                        <button
                          onClick={() => reorderFeatured(index, index - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-purple-900/80 hover:bg-amber-600 rounded-lg text-white/80 hover:text-white text-xs transition-all"
                          title="Move up"
                        >
                          ↑
                        </button>
                      )}
                      {index < featuredAnimes.length - 1 && (
                        <button
                          onClick={() => reorderFeatured(index, index + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-purple-900/80 hover:bg-amber-600 rounded-lg text-white/80 hover:text-white text-xs transition-all"
                          title="Move down"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => removeFromFeatured(getAnimeId(anime))}
                        className="w-7 h-7 flex items-center justify-center bg-purple-900/80 hover:bg-rose-600 rounded-lg text-white/80 hover:text-white text-xs transition-all"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Content – compact padding */}
                  <div className="p-3">
                    <h3 className="font-semibold text-white text-sm truncate">{anime.title}</h3>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-white/50">{anime.releaseYear || 'N/A'}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        anime.subDubStatus?.includes('Dub') 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {anime.subDubStatus?.includes('Dub') ? 'DUB' : 'SUB'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Anime Section */}
      <div id="add-section" className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full"></span>
          <h2 className="text-xl font-bold text-white/90">Add Anime to Featured</h2>
        </div>

        {/* Search & Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-white/40 group-focus-within:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search anime by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-purple-800/40 border border-purple-700/50 rounded-xl text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="w-5 h-5 text-white/40 hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleForceRefresh}
              className="px-5 py-3 bg-purple-800/40 hover:bg-amber-500/20 border border-purple-700/50 hover:border-amber-500/50 rounded-xl text-white/80 hover:text-amber-300 text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
              className="px-5 py-3 bg-purple-800/40 hover:bg-emerald-500/20 border border-purple-700/50 hover:border-emerald-500/50 rounded-xl text-white/80 hover:text-emerald-300 text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Sample Data
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
            Total: <span className="text-white font-semibold">{allAnimes.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
            Featured: <span className="text-white font-semibold">{featuredAnimes.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Available: <span className="text-white font-semibold">{filteredAnimes.length}</span>
          </div>
        </div>

        {/* Available Anime Grid – compact cards (h-36) with optimized images */}
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
            {filteredAnimes.map(anime => {
              // Available card image dimensions: height 36 (144px), width auto (96px for 2:3)
              const imgWidth = 120;
              const imgHeight = 180;
              const optimizedSrc = getOptimizedImageUrl(anime.thumbnail, imgWidth, imgHeight);
              
              return (
                <div
                  key={getAnimeId(anime)}
                  className="group bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={optimizedSrc}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      width={imgWidth}
                      height={imgHeight}
                      onError={(e) => {
                        e.currentTarget.src = getOptimizedImageUrl(anime.thumbnail || '', 120, 180);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        anime.subDubStatus?.includes('Dub')
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {anime.subDubStatus?.includes('Dub') ? 'DUB' : 'SUB'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-white text-xs truncate mb-2">{anime.title}</h3>
                    <button
                      onClick={() => addToFeatured(anime)}
                      disabled={featuredAnimes.length >= 24}
                      className={`w-full py-1.5 text-[10px] font-medium rounded-lg transition-all flex items-center justify-center gap-1 ${
                        featuredAnimes.length >= 24
                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg hover:shadow-amber-600/30'
                      }`}
                    >
                      {featuredAnimes.length >= 24 ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Max
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-2xl">
            <svg className="w-16 h-16 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white/80">
              {searchTerm ? 'No Matches Found' : allAnimes.length === 0 ? 'No Anime Available' : 'All Anime Featured!'}
            </h3>
            <p className="mt-1 text-white/50 text-sm max-w-md mx-auto">
              {searchTerm ? `No results for "${searchTerm}"` : allAnimes.length === 0 ? 'Your database is empty.' : 'All available anime are already featured.'}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={handleForceRefresh}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg text-white text-sm transition-all shadow-lg shadow-amber-600/20"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedAnimeManager;