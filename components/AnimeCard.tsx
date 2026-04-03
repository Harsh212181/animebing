 // src/components/AnimeCard.tsx
import React from 'react';
import type { Anime } from '../src/types';
import { PlayIcon } from './icons/PlayIcon';

interface AnimeCardProps {
  anime: Anime;
  onClick: (anime: Anime) => void;
  index: number;
  showStatus?: boolean;
  compact?: boolean;
}

const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    return `${baseUrl}/upload/f_webp,q_auto:good,w_${width},h_${height},c_fill/${imagePath}`;
  } catch {
    return url;
  }
};

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
  } catch {
    return '';
  }
};

const AnimeCard: React.FC<AnimeCardProps> = ({ 
  anime, 
  onClick, 
  index, 
  showStatus = false, 
  compact = false
}) => {
  const displayWidth = compact ? 150 : 193;
  const displayHeight = compact ? 225 : 289;
  const optimizedThumbnail = optimizeImageUrl(anime.thumbnail, displayWidth, displayHeight);
  const thumbnailSrcSet = generateSrcSet(anime.thumbnail, displayWidth, displayHeight);

  // Helper to get first 3 genres
  const genreList = anime.genreList?.filter(g => g && g.trim()).slice(0, 3).join(', ') || '';

  return (
    <div
      className={`anime-card group relative overflow-hidden rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
        compact 
          ? 'opacity-100 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-700/30 aspect-[2/3] w-full' 
          : 'card-load-animate opacity-0 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-800/40 aspect-[2/3] w-full'
      }`}
      style={compact ? {} : { animationDelay: `${index * 50}ms` }}
      onClick={() => onClick(anime)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(anime);
        }
      }}
      aria-label={`View details for ${anime.title}`}
    >
      <div className="w-full h-full relative">
        <img
          src={optimizedThumbnail}
          srcSet={thumbnailSrcSet}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          loading="lazy"
          width={displayWidth}
          height={displayHeight}
          sizes={compact 
            ? "(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, (max-width: 1280px) 18vw, 150px" 
            : "(max-width: 640px) 48vw, (max-width: 768px) 32vw, (max-width: 1024px) 24vw, (max-width: 1280px) 20vw, 193px"
          }
          onError={(e) => { e.currentTarget.src = anime.thumbnail; }}
        />

        {/* Episode badge (top right) */}
        {anime.currentEpisode > 0 && (
          <div className="absolute top-0.5 right-1 z-10">
            <span className="bg-gradient-to-r from-red-600 to-orange-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md">
              EP {anime.currentEpisode}
            </span>
          </div>
        )}

        {/* Content Type badge (top left) */}
        {showStatus && !compact && (
          <div className="absolute top-0.5 left-1 z-10">
            <span className="bg-purple-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
              {anime.contentType || 'Anime'}
            </span>
          </div>
        )}

        {/* Status badge (Complete/Ongoing) – top right but below episode? We'll put top center? Actually better to put top right next to episode? To avoid overlap, put below episode on right side */}
        {anime.status && !compact && (
          <div className="absolute top-7 right-1 z-10">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-md ${
              anime.status === 'Ongoing' 
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
            }`}>
              {anime.status}
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-colors duration-300 group-hover:from-black/95 flex flex-col justify-end ${
          compact ? 'p-2 sm:p-2' : 'p-2 sm:p-3 md:p-4'
        }`}>
          <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
            <h3 className={`text-white font-bold line-clamp-2 mb-1 ${
              compact 
                ? 'text-xs sm:text-xs md:text-sm leading-tight' 
                : 'text-xs sm:text-sm md:text-base leading-tight'
            } drop-shadow-md`}>
              {anime.title}
            </h3>

            {!compact && (
              <>
                {/* Year + SubDub row */}
                <div className="flex justify-between items-center mb-1">
                  <p className="text-slate-300 text-xs">{anime.releaseYear}</p>
                  <span className="bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-md">
                    {anime.subDubStatus}
                  </span>
                </div>

                {/* Genres row - NEW */}
                {genreList && (
                  <p className="text-slate-300 text-[10px] truncate mt-0.5" title={anime.genreList?.join(', ')}>
                    {genreList}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Play Icon Overlay */}
        {!compact && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50">
            <div className="transform scale-75 sm:scale-90 group-hover:scale-100 transition-transform duration-300">
              <PlayIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimeCard;