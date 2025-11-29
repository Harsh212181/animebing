  // src/components/FeaturedAnimeCarousel.tsx - FIXED RED LINE ERROR
import React, { useRef } from 'react';
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

const FeaturedAnimeCarousel: React.FC<Props> = ({ featuredAnimes, onAnimeSelect }) => {
  const swiperRef = useRef<SwiperType | null>(null); // ✅ FIXED: Added null type
  const isDragging = useRef(false);

  if (!featuredAnimes || featuredAnimes.length === 0) {
    return null;
  }

  // Simple click handler
  const handleCardClick = (anime: Anime) => {
    if (!isDragging.current) {
      onAnimeSelect(anime);
    }
  };

  return (
    <div className="mb-6 lg:mb-8">
      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={8}
        slidesPerView={2}
        breakpoints={{
          640: {
            slidesPerView: 2,
            spaceBetween: 8,
          },
          1024: {
            slidesPerView: 4,
            spaceBetween: 10,
          },
        }}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        loop={featuredAnimes.length >= 4}
        onSwiper={(swiper) => {
          swiperRef.current = swiper; // ✅ Now properly typed
        }}
        onSlideChange={() => {
          isDragging.current = false;
        }}
        onTouchStart={() => {
          isDragging.current = true;
        }}
        onTouchEnd={() => {
          setTimeout(() => {
            isDragging.current = false;
          }, 100);
        }}
        className="featured-swiper rounded-lg"
      >
        {featuredAnimes.map((anime) => (
          <SwiperSlide key={anime.id}>
            <div 
              className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              onClick={() => handleCardClick(anime)}
            >
              {/* Anime Card */}
              <div className="relative overflow-hidden rounded-lg aspect-[3/4] bg-gradient-to-br from-slate-800 to-slate-900">
                
                {/* Anime Image */}
                <img
                  src={anime.thumbnail}
                  alt={anime.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400/374151/FFFFFF?text=No+Image';
                  }}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 text-white">
                  
                  {/* Anime Title */}
                  <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-2 leading-tight group-hover:text-purple-200 transition-colors">
                    {anime.title}
                  </h3>
                  
                  {/* Anime Details - Smaller and lighter status on mobile */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 text-xs">
                      {anime.releaseYear || 'N/A'}
                    </span>
                    <span className="px-1 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-purple-500 sm:bg-purple-600">
                      {anime.subDubStatus || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500 rounded-lg transition-all duration-300" />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default FeaturedAnimeCarousel;
