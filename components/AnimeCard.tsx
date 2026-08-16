 import React from 'react';
import type { Anime } from '../src/types';
import { PlayIcon } from './icons/PlayIcon';
import { getContentGroup } from '../src/utils/contentGroup'; // ✅ new import

interface AnimeCardProps {
  anime: Anime;
  onClick: (anime: Anime) => void;
  index: number;
  showStatus?: boolean;
  compact?: boolean;
}

// ✅ NEW — "NEW" ribbon window (hours). Change this to tweak how long the badge stays up.
const NEW_BADGE_WINDOW_HOURS = 48;

const optimizeImageUrl = (url: string, width: number, height: number): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  try {
    const baseUrl = url.split('/upload/')[0];
    const rest = url.split('/upload/')[1];
    const imagePath = rest.split('/').slice(1).join('/');
    // q_auto:eco — quality same dikhegi, file size ~30% kam hogi
    return `${baseUrl}/upload/f_webp,q_auto:eco,w_${width},h_${height},c_fill/${imagePath}`;
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
      ${baseUrl}/upload/f_webp,q_auto:eco,w_${baseWidth},h_${baseHeight},c_fill/${imagePath} ${baseWidth}w,
      ${baseUrl}/upload/f_webp,q_auto:eco,w_${Math.round(baseWidth * 1.5)},h_${Math.round(baseHeight * 1.5)},c_fill/${imagePath} ${Math.round(baseWidth * 1.5)}w
    `;
  } catch {
    return '';
  }
};

// ✅ NEW — true agar anime ka koi episode/link pichle NEW_BADGE_WINDOW_HOURS ke andar add hua ho
// (backend `lastContentAdded` ko tracker ke auto-add hone par touch karta hai — services/youtubeCheckService.ts)
const isRecentlyAdded = (anime: Anime): boolean => {
  if (!anime.lastContentAdded) return false;
  const addedTime = new Date(anime.lastContentAdded as any).getTime();
  if (Number.isNaN(addedTime)) return false;
  const hoursSince = (Date.now() - addedTime) / (1000 * 60 * 60);
  return hoursSince >= 0 && hoursSince <= NEW_BADGE_WINDOW_HOURS;
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

  const thumbnail = anime.thumbnail || '';

  const optimizedThumbnail = optimizeImageUrl(thumbnail, displayWidth, displayHeight);
  const thumbnailSrcSet = generateSrcSet(thumbnail, displayWidth, displayHeight);

  const genreList = (anime.genreList ?? []).filter((g: string) => g && g.trim()).slice(0, 3).join(', ') || '';

  const showNewBadge = isRecentlyAdded(anime);

  // ✅ determine content group for episode/chapter label
  const group = getContentGroup(anime.contentType);

  const handleClick = () => {
    onClick(anime);
  };

  return (
    <div
      className={`anime-card group relative overflow-hidden rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
        compact
          ? 'opacity-100 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-700/30 aspect-[2/3] w-full'
          : 'card-load-animate opacity-0 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-800/40 aspect-[2/3] w-full'
      }`}
      style={compact ? {} : { animationDelay: `${index * 50}ms` }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
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
            ? "(max-width: 640px) 150px, 150px"
            : "(max-width: 640px) calc(50vw - 16px), (max-width: 768px) calc(33vw - 16px), (max-width: 1024px) calc(25vw - 16px), 193px"
          }
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.src = anime.thumbnail || '';
          }}
        />

        {/* Content Type badge (top left) */}
        {showStatus && !compact && (
          <div className="absolute top-0.5 left-1 z-10">
            <span className="bg-purple-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
              {anime.contentType || 'Anime'}
            </span>
          </div>
        )}

        {/* Episode badge — hides for "single" (Movie), shows "Ch" for Manga (chapter), "Ep" for Anime */}
        {group !== 'single' && (anime.currentEpisode ?? 0) > 0 && (
          <div className="absolute top-0.5 right-1 z-10">
            <span className="bg-gradient-to-r from-red-600 to-orange-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md">
              {group === 'chapter' ? 'Ch' : 'Ep'} {anime.currentEpisode}
            </span>
          </div>
        )}

        {/* Status badge */}
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

            {/* ✅ NEW — badge shown directly above the anime title */}
            {showNewBadge && (
              <span className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-md mb- tracking-wider">
                NEW
              </span>
            )}

            <h3 className={`text-white font-bold line-clamp-2 mb-1 ${
              compact
                ? 'text-xs sm:text-xs md:text-sm leading-tight'
                : 'text-xs sm:text-sm md:text-base leading-tight'
            } drop-shadow-md`}>
              {anime.title}
            </h3>

            {!compact && (
              <>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-slate-300 text-xs">{anime.releaseYear}</p>
                  <span className="bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-md">
                    {anime.subDubStatus}
                  </span>
                </div>

                {genreList && (
                  <p className="text-slate-300 text-[10px] truncate mt-0.5" title={anime.genreList?.join(', ')}>
                    {genreList}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

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