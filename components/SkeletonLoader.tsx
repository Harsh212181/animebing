// components/SkeletonLoader.tsx - YEH NAYI FILE BANAYEIN
import React from 'react';

interface SkeletonLoaderProps {
  type: 'card' | 'list' | 'text' | 'image';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, count = 1 }) => {
  const SkeletonCard = () => (
    <div className="bg-slate-700/50 rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-[2/3] bg-slate-600/50"></div>
      <div className="p-4 space-y-2">
        <div className="h-4 bg-slate-600/50 rounded w-3/4"></div>
        <div className="h-3 bg-slate-600/50 rounded w-1/2"></div>
      </div>
    </div>
  );

  const SkeletonList = () => (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 bg-slate-700/50 rounded-lg animate-pulse">
          <div className="h-12 w-12 bg-slate-600/50 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-600/50 rounded w-3/4"></div>
            <div className="h-3 bg-slate-600/50 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const SkeletonText = () => (
    <div className="space-y-2 animate-pulse">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-slate-600/50 rounded w-full"></div>
          <div className="h-4 bg-slate-600/50 rounded w-5/6"></div>
          <div className="h-4 bg-slate-600/50 rounded w-4/6"></div>
        </div>
      ))}
    </div>
  );

  switch (type) {
    case 'card':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {[...Array(count)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    case 'list':
      return <SkeletonList />;
    case 'text':
      return <SkeletonText />;
    default:
      return <SkeletonCard />;
  }
};

// Skeleton for anime detail page
export const AnimeDetailSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="relative -mx-4 -mt-8 mb-8">
      <div className="absolute inset-0 overflow-hidden h-[450px] bg-slate-700/50"></div>
      <div className="relative container mx-auto px-4 pt-24 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <div className="md:col-span-1 lg:col-span-1">
            <div className="w-full h-96 bg-slate-600/50 rounded-lg"></div>
          </div>
          <div className="md:col-span-2 lg:col-span-3 space-y-4">
            <div className="h-8 bg-slate-600/50 rounded w-3/4"></div>
            <div className="h-4 bg-slate-600/50 rounded w-1/4"></div>
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-slate-600/50 rounded-full w-20"></div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-600/50 rounded w-full"></div>
              <div className="h-4 bg-slate-600/50 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);