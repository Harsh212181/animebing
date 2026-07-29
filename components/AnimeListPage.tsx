 // components/AnimeListPage.tsx – Mobile filters stacked consistently, PC all in one line
import React, { useState, useEffect, useMemo } from 'react';
import type { Anime, FilterType } from '../src/types';
import { getAllAnime } from '../services/animeService';
import Spinner from './Spinner';
import SEO from '../src/components/SEO';

interface AnimeListPageProps {
  onAnimeSelect: (anime: Anime) => void;
}

const AnimeListPage: React.FC<AnimeListPageProps> = ({ onAnimeSelect }) => {
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subDubFilter, setSubDubFilter] = useState<FilterType>('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('All');

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAllAnime();
        setAllAnime(data);
      } catch (err) {
        setError('Failed to fetch anime data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnime();
  }, []);

  const sortedAndFilteredAnime = useMemo(() => {
    let result = allAnime;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(anime =>
        anime.title.toLowerCase().includes(query)
      );
    }

    if (subDubFilter !== 'All') {
      result = result.filter(anime => anime.subDubStatus === subDubFilter);
    }

    if (contentTypeFilter !== 'All') {
      if (contentTypeFilter === 'Manhwa') {
        result = result.filter(anime =>
          anime.contentType === 'Manga'   // matches your existing logic
        );
      } else {
        result = result.filter(anime => anime.contentType === contentTypeFilter);
      }
    }

    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [allAnime, subDubFilter, searchQuery, contentTypeFilter]);

  useEffect(() => {
    if (isFiltering) {
      const timer = setTimeout(() => setIsFiltering(false), 300);
      return () => clearTimeout(timer);
    }
  }, [sortedAndFilteredAnime, isFiltering]);

  const handleSubDubChange = (newFilter: FilterType) => {
    if (newFilter !== subDubFilter) {
      setIsFiltering(true);
      setSubDubFilter(newFilter);
    }
  };

  const handleContentTypeChange = (newType: string) => {
    if (newType !== contentTypeFilter) {
      setIsFiltering(true);
      setContentTypeFilter(newType);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsFiltering(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsFiltering(true);
  };

  const subDubOptions: FilterType[] = ['All', 'Hindi Dub', 'Hindi Sub', 'English Sub'];
  const contentTypeOptions = ['All', 'Anime', 'Movie', 'Manhwa'];

  const getSEOData = () => {
    let title = 'Anime List | AnimeBing';
    let description = 'Browse complete list of anime available in Hindi Dub, Hindi Sub, and English Sub. Watch anime online for free.';
    let keywords = 'anime list, all anime, hindi anime list, english anime, anime in hindi, anime in english, anime collection';

    if (subDubFilter !== 'All') {
      title = `${subDubFilter} ${title}`;
      description = `Browse complete list of ${subDubFilter} anime. Watch ${subDubFilter.toLowerCase()} anime online for free in HD quality.`;
      keywords = `${subDubFilter.toLowerCase()} anime list, ${subDubFilter.toLowerCase()} anime, anime in ${subDubFilter.toLowerCase()}`;
    }

    if (contentTypeFilter !== 'All') {
      const typeLabel = contentTypeFilter === 'Manhwa' ? 'Manhwa & Manga' : contentTypeFilter;
      title = `${typeLabel} List | AnimeBing`;
      description = `Browse complete list of ${typeLabel}. Watch and read ${typeLabel} online for free.`;
      keywords = `${typeLabel.toLowerCase()} list, ${typeLabel.toLowerCase()}, watch ${typeLabel.toLowerCase()} online`;
    }

    if (searchQuery.trim()) {
      title = `Search Results for "${searchQuery}" | AnimeBing`;
      description = `Search results for "${searchQuery}". Find and watch anime matching your search.`;
      keywords = `${searchQuery} anime, search anime, find anime ${searchQuery}`;
    }

    let canonicalUrl = 'https://animebing.in/anime';
    const params = new URLSearchParams();

    if (subDubFilter !== 'All') params.set('filter', subDubFilter);
    if (contentTypeFilter !== 'All') params.set('type', contentTypeFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    if (params.toString()) canonicalUrl += `?${params.toString()}`;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": sortedAndFilteredAnime.slice(0, 20).map((anime, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "TVSeries",
          "name": anime.title,
          "url": `https://animebing.in/detail/${anime.slug || anime.id}`,
          "description": anime.description || `Watch ${anime.title} online`,
          "genre": anime.genreList || ["Anime"]
        }
      }))
    };

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      structuredData,
      ogUrl: window.location.href
    };
  };

  const seoData = getSEOData();

  const breadcrumbData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://animebing.in"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Anime List",
        "item": window.location.href
      }
    ]
  });

  return (
    <>
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        structuredData={seoData.structuredData}
        ogUrl={seoData.ogUrl}
      />

      <div className="container mx-auto px-4 py-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          {/* Title */}
          <h1 className="text-3xl font-bold text-purple-100 border-l-4 border-purple-500 pl-4">
            {contentTypeFilter !== 'All' ? (
              contentTypeFilter === 'Manhwa' ? 'Manhwa & Manga List' : `${contentTypeFilter} List`
            ) : (
              'Anime List'
            )}
            {subDubFilter !== 'All' && <span className="text-purple-400 ml-2">({subDubFilter})</span>}
            {searchQuery && <span className="text-purple-400 ml-2">- Search: "{searchQuery}"</span>}
          </h1>

          {/* Search + Filters row (PC: one line, Mobile/Tablet: stacked) */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full lg:w-auto">
            {/* Search Bar */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 bg-purple-800 border border-purple-600 rounded-lg text-purple-200 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter groups: stacked on mobile/tablet (flex-col), side-by-side on desktop (md:flex-row) */}
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              {/* Sub/Dub Filter */}
              <div className="flex overflow-x-auto gap-1 bg-purple-800/50 p-1 rounded-lg w-full md:w-auto
                [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden">
                {subDubOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => handleSubDubChange(option)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                      subDubFilter === option
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:bg-purple-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Content Type Filter */}
              <div className="flex overflow-x-auto gap-1 bg-purple-800/50 p-1 rounded-lg w-full md:w-auto
                [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden">
                {contentTypeOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => handleContentTypeChange(option)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                      contentTypeFilter === option
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:bg-purple-700'
                    }`}
                  >
                    {option === 'Manhwa' ? 'Manga' : option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SEO Hidden Metadata */}
        <div className="hidden" itemScope itemType="https://schema.org/ItemList">
          <meta itemProp="name" content={seoData.title} />
          <meta itemProp="description" content={seoData.description} />
          <meta itemProp="numberOfItems" content={sortedAndFilteredAnime.length.toString()} />
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Spinner />
          </div>
        )}
        {error && <p className="text-center text-red-400">{error}</p>}

        {!isLoading && !error && (
          <div className="bg-purple-800/50 rounded-lg shadow-lg relative min-h-[300px]">
            {isFiltering && (
              <div className="absolute inset-0 bg-purple-800/60 flex justify-center items-center z-10 rounded-lg animate-fade-in">
                <Spinner />
              </div>
            )}
            <ul className={`divide-y divide-purple-700 transition-opacity duration-300 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
              {sortedAndFilteredAnime.length > 0 ? (
                sortedAndFilteredAnime.map(anime => (
                  <li key={anime.id} itemScope itemType="https://schema.org/TVSeries">
                    <button
                      onClick={() => onAnimeSelect(anime)}
                      className="w-full text-left p-4 flex items-center hover:bg-purple-700/50 transition-colors duration-200 group"
                    >
                      <span className="text-purple-200 group-hover:text-purple-300 transition-colors pr-2 text-sm md:text-base break-words flex-1 min-w-0">
                        {anime.title}
                      </span>
                      <span className="text-xs text-purple-400 bg-purple-700 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        {anime.subDubStatus}
                      </span>
                      <meta itemProp="name" content={anime.title} />
                      <link itemProp="url" href={`https://animebing.in/detail/${anime.slug || anime.id}`} />
                    </button>
                  </li>
                ))
              ) : (
                <li className="p-8 text-center text-purple-400">
                  {searchQuery
                    ? `No results found for "${searchQuery}"`
                    : 'No content matches the current filters.'
                  }
                </li>
              )}
            </ul>
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: breadcrumbData }}
        />
      </div>
    </>
  );
};

export default AnimeListPage;