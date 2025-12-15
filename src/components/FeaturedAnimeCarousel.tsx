  // src/components/FeaturedAnimeCarousel.tsx - Very fast slides (1.5s) + 5 cards on large screens
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

const FeaturedAnimeCarousel: React.FC<Props> = ({ featuredAnimes, onAnimeSelect }) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const touchThreshold = 5;

  if (!featuredAnimes || featuredAnimes.length === 0) {
    return null;
  }

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
            slidesPerView: 5,
            spaceBetween: 12,
          },
        }}
        autoplay={{
          delay: 1500,                  // ← Ab 1.5 seconds mein slide change
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        loop={featuredAnimes.length >= 5}
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
        {featuredAnimes.map((anime) => (
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
            >
              <div className="relative overflow-hidden rounded-lg aspect-[3/4] bg-gradient-to-br from-slate-800 to-slate-900">
                <img
                  src={anime.thumbnail}
                  alt={anime.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400/374151/FFFFFF?text=No+Image';
                  }}
                />
                {/* Status Badge */}
                <div className="absolute top-0 left-2 z-10">
                  <span className="bg-purple-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
                    {anime.contentType || 'Anime'}
                  </span>
                </div>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 text-white">
                  <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-2 leading-tight group-hover:text-purple-200 transition-colors">
                    {anime.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 text-xs">
                      {anime.releaseYear || 'N/A'}
                    </span>
                    <span className="px-1 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-purple-500 sm:bg-purple-600">
                      {anime.subDubStatus || 'Unknown'}
                    </span>
                  </div>
                </div>
                {/* Hover Border */}
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
