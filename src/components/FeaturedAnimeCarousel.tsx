  // src/components/FeaturedAnimeCarousel.tsx - UPDATED WITH SAME SPEED FOR ALL DEVICES
import React, { useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import type { Anime } from '../types';
import type { Swiper as SwiperType } from 'swiper';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

interface Props {
  featuredAnimes: Anime[];
  onAnimeSelect: (anime: Anime) => void;
}

// Helper function to optimize Cloudinary image URLs (AnimeCard.tsx se same)
const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    return `${baseUrl}/upload/f_webp,q_auto:best,w_${width},h_${height},c_fill,g_auto/${imagePath}`;
  } catch (error) {
    console.error('Error optimizing image URL:', error);
    return url;
  }
};

// Generate srcset for responsive images
const generateSrcSet = (url: string, baseWidth: number, baseHeight: number): string => {
  if (!url || !url.includes('cloudinary.com')) return '';
  
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    return `
      ${baseUrl}/upload/f_webp,q_auto:best,w_${baseWidth},h_${baseHeight},c_fill,g_auto/${imagePath} ${baseWidth}w,
      ${baseUrl}/upload/f_webp,q_auto:best,w_${baseWidth * 2},h_${baseHeight * 2},c_fill,g_auto/${imagePath} ${baseWidth * 2}w,
      ${baseUrl}/upload/f_webp,q_auto:best,w_${baseWidth * 3},h_${baseHeight * 3},c_fill,g_auto/${imagePath} ${baseWidth * 3}w
    `;
  } catch (error) {
    console.error('Error generating srcset:', error);
    return '';
  }
};

const FeaturedAnimeCarousel: React.FC<Props> = ({ featuredAnimes, onAnimeSelect }) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const touchThreshold = 5;

  if (!featuredAnimes || featuredAnimes.length === 0) {
    return null;
  }

  // Define image dimensions for carousel (same as AnimeCard.tsx)
  const getImageDimensions = () => {
    return {
      width: 193,  // Same as AnimeCard.tsx
      height: 289, // Same as AnimeCard.tsx (aspect ratio 2:3)
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEndX(e.changedTouches[0].clientX);
  };

  const handleCardClick = (anime: Anime, e: React.MouseEvent | React.TouchEvent) => {
    const isSwipe = Math.abs(touchEndX - touchStartX) > touchThreshold;
   
    if (!isSwipe) {
      e.preventDefault();
      e.stopPropagation();
      onAnimeSelect(anime);
    }
  };

  const dimensions = getImageDimensions();

  return (
    <div className="mb-6 lg:mb-8">
      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={8}  // Same as original AnimeCard spacing
        slidesPerView={2}
        breakpoints={{
          640: {
            slidesPerView: 2,
            spaceBetween: 8,
          },
          1024: {
            slidesPerView: 5,
            spaceBetween: 12,
          },
        }}
        autoplay={{
          delay: 2000,  // ← YAHAN CHANGE KIYA: 4000 se 2000 (2 seconds for ALL devices)
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        loop={featuredAnimes.length >= 5}
        speed={800}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        className="featured-swiper rounded-lg"
        allowTouchMove={true}
        touchRatio={0.6}
        touchAngle={45}
        shortSwipes={true}
        longSwipes={true}
        followFinger={true}
      >
        {featuredAnimes.map((anime, index) => {
          const optimizedThumbnail = optimizeImageUrl(anime.thumbnail, dimensions.width, dimensions.height);
          const thumbnailSrcSet = generateSrcSet(anime.thumbnail, dimensions.width, dimensions.height);

          return (
            <SwiperSlide key={anime.id}>
              <div
                className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                onClick={(e) => handleCardClick(anime, e)}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => {
                  handleTouchEnd(e);
                  handleCardClick(anime, e);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAnimeSelect(anime);
                  }
                }}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative overflow-hidden rounded-lg aspect-[2/3] bg-gradient-to-br from-slate-800 to-slate-900">
                  {/* Optimized Image - SAME AS AnimeCard.tsx */}
                  <img
                    src={optimizedThumbnail}
                    srcSet={thumbnailSrcSet}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                    loading="lazy"
                    width={dimensions.width}
                    height={dimensions.height}
                    sizes="(max-width: 640px) 48vw, (max-width: 768px) 32vw, (max-width: 1024px) 24vw, (max-width: 1280px) 20vw, 193px"
                    onError={(e) => {
                      e.currentTarget.src = anime.thumbnail;
                      console.warn('Failed to load optimized image, using original');
                    }}
                  />
                  
                  {/* Status Badge - EXACTLY SAME AS AnimeCard.tsx */}
                  <div className="absolute top-0 left-2 z-10">
                    <span className="bg-purple-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
                      {anime.contentType || 'Anime'}
                    </span>
                  </div>
                  
                  {/* Gradient Overlay - EXACTLY SAME AS AnimeCard.tsx */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-colors duration-300 group-hover:from-black/95 flex flex-col justify-end p-2 sm:p-3 md:p-4">
                    
                    {/* Card Text - EXACTLY SAME AS AnimeCard.tsx */}
                    <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
                      
                      {/* Title - SAME AS AnimeCard.tsx */}
                      <h3 className="text-white font-bold line-clamp-2 mb-1 text-xs sm:text-sm md:text-base leading-tight drop-shadow-md">
                        {anime.title}
                      </h3>

                      {/* Year + SubDub - EXACT FORMAT AS AnimeCard.tsx */}
                      <div className="flex justify-between items-center">
                        <p className="text-slate-300 text-xs sm:text-sm">{anime.releaseYear || 'N/A'}</p>
                        <span className="bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
                          {anime.subDubStatus || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover Border - SAME EFFECT AS AnimeCard.tsx */}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500 rounded-lg transition-all duration-300" />
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default FeaturedAnimeCarousel;
