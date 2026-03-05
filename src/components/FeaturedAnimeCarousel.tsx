 // src/components/FeaturedAnimeCarousel.tsx - BANNER ARROWS REMOVED
"use client"

import React, { useRef, useState, useEffect, useMemo } from 'react';
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

// FIXED IMAGE OPTIMIZATION FUNCTION - SAME AS HOMEPAGE
const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  try {
    // Remove existing transformations and add optimized ones
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    // ✅ SAME OPTIMIZATION AS HOMEPAGE: f_webp, q_auto:good
    return `${baseUrl}/upload/f_webp,q_auto:good,w_${width},h_${height},c_fill/${imagePath}`;
  } catch (error) {
    console.error('Error optimizing image URL:', error);
    return url;
  }
};

// Generate srcset for responsive images - ADDED FOR BETTER QUALITY
const generateSrcSet = (url: string, baseWidth: number, baseHeight: number): string => {
  if (!url || !url.includes('cloudinary.com')) return '';
  
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    
    return `
      ${baseUrl}/upload/f_webp,q_auto:good,w_${baseWidth},h_${baseHeight},c_fill/${imagePath} ${baseWidth}w,
      ${baseUrl}/upload/f_webp,q_auto:good,w_${baseWidth * 2},h_${baseHeight * 2},c_fill/${imagePath} ${baseWidth * 2}w
    `;
  } catch (error) {
    console.error('Error generating srcset:', error);
    return '';
  }
};

const FeaturedAnimeCarousel: React.FC<Props> = ({ featuredAnimes, onAnimeSelect }) => {
  const bannerSwiperRef = useRef<SwiperType | null>(null);
  const carouselSwiperRef = useRef<SwiperType | null>(null);

  // Create bannerAnimes (reverse order of featuredAnimes) and carouselAnimes (original order)
  const { bannerAnimes, carouselAnimes } = useMemo(() => {
    if (!featuredAnimes || featuredAnimes.length === 0) {
      return { bannerAnimes: [], carouselAnimes: [] };
    }

    // For banner: take all animes in reverse order (latest first in reverse)
    const bannerAnimes = [...featuredAnimes].reverse();
    
    // For carousel: use all animes in original order
    const carouselAnimes = [...featuredAnimes];
    
    return { bannerAnimes, carouselAnimes };
  }, [featuredAnimes]);

  if (!featuredAnimes || featuredAnimes.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 lg:mb-6 space-y-4">
      {/* BANNER SECTION - Now using Swiper with slide effect (arrows removed) */}
      {bannerAnimes.length > 0 && (
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={0}
          slidesPerView={1}
          loop={bannerAnimes.length > 1}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
            renderBullet: (index, className) => {
              return `<span class="${className}" style="background: linear-gradient(to right, #a855f7, #9333ea); width: 8px; height: 8px; border-radius: 50%;"></span>`;
            },
          }}
          onSwiper={(swiper) => {
            bannerSwiperRef.current = swiper;
          }}
          className="featured-banner-swiper rounded-xl md:rounded-2xl overflow-hidden"
        >
          {bannerAnimes.map((anime, index) => (
            <SwiperSlide key={anime.id || anime._id || index}>
              {/* MOBILE VIEW - Banner Slide */}
              <div className="block md:hidden">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl h-[200px]">
                  {/* Background with gradient overlay */}
                  <div className="absolute inset-0">
                    <img
                      src={optimizeImageUrl(anime.thumbnail, 800, 400)}
                      srcSet={`
                        ${optimizeImageUrl(anime.thumbnail, 400, 200)} 400w,
                        ${optimizeImageUrl(anime.thumbnail, 800, 400)} 800w,
                        ${optimizeImageUrl(anime.thumbnail, 1200, 600)} 1200w
                      `}
                      sizes="100vw"
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Enhanced Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 to-slate-950/70"></div>
                  </div>

                  {/* Content - Mobile Layout */}
                  <div className="relative z-10 h-full flex items-center px-4">
                    <div className="flex items-center gap-3 w-full">
                      {/* Thumbnail */}
                      <div className="relative w-28 flex-shrink-0">
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-2xl shadow-purple-900/50 ring-2 ring-purple-500/30">
                          <img
                            src={optimizeImageUrl(anime.thumbnail, 180, 270)}
                            srcSet={generateSrcSet(anime.thumbnail, 180, 270)}
                            sizes="112px"
                            alt={anime.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="space-y-2">
                          <h2 className="text-base font-bold text-white line-clamp-2 leading-tight drop-shadow-lg">
                            {anime.title}
                          </h2>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {anime.status && (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  anime.status === "Ongoing"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                }`}
                              >
                                {anime.status}
                              </span>
                            )}
                            {anime.subDubStatus && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600/80 text-white border border-purple-500">
                                {anime.subDubStatus}
                              </span>
                            )}
                            {anime.releaseYear && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800/60 text-slate-300 border border-slate-700">
                                {anime.releaseYear}
                              </span>
                            )}
                            {anime.currentEpisode && anime.currentEpisode > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gradient-to-r from-red-600 to-orange-600 text-white border border-red-500/30">
                                EP {anime.currentEpisode}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => onAnimeSelect(anime)}
                          className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-purple-600 transition-all duration-300 active:scale-95"
                        >
                          Watch Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PC VIEW - Banner Slide */}
              <div className="hidden md:block">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl h-[330px]">
                  {/* Background */}
                  <div className="absolute inset-0">
                    <img
                      src={optimizeImageUrl(anime.thumbnail, 1400, 400)}
                      srcSet={`
                        ${optimizeImageUrl(anime.thumbnail, 700, 200)} 700w,
                        ${optimizeImageUrl(anime.thumbnail, 1400, 400)} 1400w,
                        ${optimizeImageUrl(anime.thumbnail, 2100, 600)} 2100w
                      `}
                      sizes="100vw"
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                    {/* Clean Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                  </div>

                  {/* Content - PC Layout */}
                  <div className="relative z-10 h-full flex items-center px-10">
                    <div className="flex items-center gap-8 w-full h-full">
                      {/* Thumbnail - SMALLER CARD */}
                      <div className="relative flex-shrink-0">
                        <div className="absolute -inset-1.5">
                          <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent blur-xl opacity-50"></div>
                        </div>
                        <div className="relative w-48">
                          <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-purple-900/30 ring-2 ring-purple-500/30 aspect-[2/3]">
                            <img
                              src={optimizeImageUrl(anime.thumbnail, 192, 288)}
                              srcSet={generateSrcSet(anime.thumbnail, 192, 288)}
                              sizes="192px"
                              alt={anime.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-4 h-full flex flex-col justify-center">
                        <div className="space-y-3">
                          <div>
                            <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
                              {anime.title}
                            </h2>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {anime.status && (
                              <span
                                className={`px-2.5 py-1 rounded text-xs font-bold ${
                                  anime.status === "Ongoing"
                                    ? "bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-500/30"
                                }`}
                              >
                                {anime.status}
                              </span>
                            )}
                            {anime.releaseYear && (
                              <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-slate-800/40 to-slate-900/40 text-slate-300 border border-slate-700">
                                {anime.releaseYear}
                              </span>
                            )}
                            {anime.subDubStatus && (
                              <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-700 text-white border border-purple-500">
                                {anime.subDubStatus}
                              </span>
                            )}
                            {anime.currentEpisode && anime.currentEpisode > 0 && (
                              <span className="px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-red-600 to-orange-600 text-white border border-red-500/30">
                                EP {anime.currentEpisode}
                              </span>
                            )}
                          </div>

                          {anime.description && (
                            <p className="text-slate-300 text-xs leading-relaxed max-w-2xl line-clamp-2">
                              {anime.description}
                            </p>
                          )}

                          {anime.genreList && anime.genreList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {anime.genreList.slice(0, 4).map((genre, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded text-xs bg-slate-800/40 text-slate-300 border border-slate-700 hover:bg-slate-700/50 transition-colors"
                                >
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-5">
                          <button
                            onClick={() => onAnimeSelect(anime)}
                            className="group relative px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 text-sm active:scale-95"
                          >
                            <span className="relative z-10">Watch Now</span>
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {/* LATEST ANIME TITLE SECTION (unchanged) */}
      <div className="px-3 sm:px-4 md:px-5">
        <div className="flex items-center mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Latest Anime
            </h2>
          </div>
        </div>

        {carouselAnimes.length > 0 ? (
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={8}
            slidesPerView={2}
            breakpoints={{
              640: { slidesPerView: 2, spaceBetween: 8 },
              768: { slidesPerView: 3, spaceBetween: 10 },
              1024: { slidesPerView: 5, spaceBetween: 12 },
              1280: { slidesPerView: 6, spaceBetween: 12 },
            }}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
            pagination={{ clickable: true, dynamicBullets: true }}
            loop={carouselAnimes.length >= 5}
            speed={800}
            onSwiper={(swiper) => { carouselSwiperRef.current = swiper; }}
            className="featured-swiper rounded-lg"
          >
            {carouselAnimes.map((anime, index) => {
              const optimizedThumbnail = optimizeImageUrl(anime.thumbnail, 193, 289);
              const thumbnailSrcSet = generateSrcSet(anime.thumbnail, 193, 289);

              return (
                <SwiperSlide key={anime.id || anime._id || index}>
                  <div
                    className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                    onClick={() => onAnimeSelect(anime)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onAnimeSelect(anime);
                      }
                    }}
                  >
                    <div className="relative overflow-hidden rounded-lg aspect-[2/3] bg-gradient-to-br from-slate-800 to-slate-900">
                      <img
                        src={optimizedThumbnail}
                        srcSet={thumbnailSrcSet}
                        sizes="(max-width: 640px) 48vw, (max-width: 768px) 32vw, (max-width: 1024px) 24vw, (max-width: 1280px) 20vw, 193px"
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                        loading="lazy"
                      />
                      
                      {/* Status Badge (Top Left) */}
                      <div className="absolute top-0.5 left-2 z-10">
                        <span className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-[10px] font-medium px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap">
                          {anime.contentType || 'Anime'}
                        </span>
                      </div>

                      {/* Episode Badge (Top Right) */}
                      {anime.currentEpisode && anime.currentEpisode > 0 && (
                        <div className="absolute top-0.5 right-2 z-20">
                          <span className="bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg border border-white/20">
                            EP {anime.currentEpisode}
                          </span>
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-colors duration-300 group-hover:from-black/97 flex flex-col justify-end p-2 sm:p-3 md:p-4">
                        <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
                          <h3 className="text-white font-bold line-clamp-2 mb-1.5 text-xs sm:text-sm md:text-base leading-tight drop-shadow-lg">
                            {anime.title}
                          </h3>
                          <div className="flex justify-between items-center">
                            <p className="text-slate-300 text-xs sm:text-sm">
                              {anime.releaseYear || 'N/A'}
                            </p>
                            <span className="bg-gradient-to-r from-purple-600/90 to-purple-700/90 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
                              {anime.subDubStatus || 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover Effect */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/50 rounded-lg transition-all duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        ) : (
          <div className="text-center py-8 text-slate-400">
            No anime available to display
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedAnimeCarousel;