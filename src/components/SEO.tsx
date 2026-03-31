 // src/components/SEO.tsx - FINAL FIXED VERSION (with all updates)
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  // Core props
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;      // ✅ Always pass this for every page!
  
  // Open Graph specific (optional)
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  
  // Twitter specific
  twitterCard?: string;
  
  // Structured data
  structuredData?: any;
  
  // Control
  noIndex?: boolean;
  
  // Content type
  contentType?: 'website' | 'article' | 'video.tv_show' | 'video.movie';
  
  // Article timestamps
  publishedTime?: string;
  modifiedTime?: string;
  
  // Aliases for convenience
  image?: string;      // will be used as ogImage if ogImage not provided
  url?: string;        // will be used as ogUrl if ogUrl not provided
  type?: 'website' | 'article' | 'video.tv_show' | 'video.movie'; // will be used as contentType
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords = 'anime, hindi anime, english anime, anime dub, anime sub, watch anime online, anime streaming, anime in hindi, anime in english, download anime, free anime',
  canonicalUrl,                     // ✅ Sabse IMPORTANT prop
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  twitterCard = 'summary_large_image',
  structuredData,
  noIndex = false,
  contentType,
  publishedTime,
  modifiedTime,
  // Aliases
  image,
  url,
  type,
}) => {
  const siteTitle = 'AnimeBing - Watch Anime in Hindi & English Online Free';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const siteUrl = 'https://animebing.in';
  
  // Default image if not provided
  const defaultImage = `${siteUrl}/AnimeBinglogo.jpg`;
  
  // Resolve final values using aliases if needed
  const finalOgImage = ogImage || image || defaultImage;
  
  // ✅ UPDATE 2: OG URL fix - now uses canonicalUrl as fallback
  const finalOgUrl = ogUrl || url || canonicalUrl || siteUrl;
  
  // ✅ UPDATE 1: Canonical URL fix - uses finalOgUrl as fallback
  const finalCanonicalUrl = canonicalUrl || finalOgUrl || siteUrl;
  
  const finalContentType = contentType || type || 'website';
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      {/* ✅ UPDATE 3: Description - crash safe with optional chaining and slice */}
      <meta name="description" content={description?.slice(0, 155)} />
      <meta name="keywords" content={keywords} />
      
      {/* ✅ FIXED: Canonical URL - Always fixed, never current URL */}
      <link rel="canonical" href={finalCanonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={finalContentType} />
      <meta property="og:title" content={ogTitle || fullTitle} />
      <meta property="og:description" content={ogDescription || description?.slice(0, 155)} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogTitle || fullTitle} />
      <meta property="og:url" content={finalOgUrl} />
      <meta property="og:site_name" content="AnimeBing" />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific OG tags */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={ogTitle || fullTitle} />
      <meta name="twitter:description" content={ogDescription || description?.slice(0, 155)} />
      <meta name="twitter:image" content={finalOgImage} />
      <meta name="twitter:site" content="@animebing" />
      <meta name="twitter:creator" content="@animebing" />
      
      {/* Structured Data for Google (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      
      {/* Additional SEO Tags */}
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      <meta name="googlebot" content={noIndex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"} />
      <meta name="bingbot" content={noIndex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"} />
      
      {/* ✅ UPDATE 4: Optional pro fix - better indexing control */}
      <meta name="google" content="notranslate" />
      
      {/* Mobile Specific */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content="#3b82f6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      
      {/* RSS Feed */}
      <link rel="alternate" type="application/rss+xml" title="AnimeBing RSS Feed" href="/rss.xml" />
      
      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      
      {/* Preconnect for CDN */}
      <link rel="preconnect" href="https://res.cloudinary.com" />
      <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      
      {/* App Links */}
      <meta property="al:android:url" content={siteUrl} />
      <meta property="al:android:app_name" content="AnimeBing" />
      <meta property="al:ios:url" content={siteUrl} />
      <meta property="al:ios:app_store_id" content="123456789" />
      <meta property="al:ios:app_name" content="AnimeBing" />
      <meta property="al:web:url" content={siteUrl} />
      <meta property="al:web:should_fallback" content="false" />
      
      {/* Additional Meta Tags */}
      <meta name="language" content="English" />
      <meta name="author" content="AnimeBing" />
      <meta name="copyright" content="AnimeBing" />
      <meta name="rating" content="General" />
      <meta name="distribution" content="Global" />
      <meta name="revisit-after" content="1 days" />
    </Helmet>
  );
};

export default SEO;

// ✅ Enhanced Structured Data Functions (same as before)
export const generateAnimeStructuredData = (anime: any) => {
  const animeUrl = `https://animebing.in/detail/${anime.slug || anime.id}`;
  
  return {
    "@context": "https://schema.org",
    "@type": anime.contentType === 'Movie' ? "Movie" : "TVSeries",
    "name": anime.title,
    "description": anime.description || `Watch ${anime.title} online in high quality`,
    "image": anime.thumbnail || anime.poster,
    "genre": anime.genreList || anime.genres || ["Anime"],
    "dateCreated": anime.releaseYear ? `${anime.releaseYear}` : undefined,
    "contentRating": anime.contentRating || "TV-14",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": anime.rating || 4.5,
      "bestRating": "10",
      "worstRating": "1",
      "ratingCount": anime.views || 1000
    },
    "actor": [
      {
        "@type": "Person",
        "name": "Anime Studio"
      }
    ],
    "director": [
      {
        "@type": "Person",
        "name": "Anime Director"
      }
    ],
    "url": animeUrl,
    "sameAs": anime.officialUrl ? [anime.officialUrl] : [],
    "potentialAction": {
      "@type": "WatchAction",
      "target": animeUrl
    },
    ...(anime.contentType !== 'Movie' && {
      "numberOfEpisodes": anime.episodeCount || 12,
      "numberOfSeasons": anime.seasonCount || 1
    }),
    ...(anime.contentType === 'Movie' && {
      "duration": "PT2H30M",
      "countryOfOrigin": "JP"
    })
  };
};

export const generateWebsiteStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AnimeBing",
    "url": "https://animebing.in",
    "description": "Watch anime online in Hindi and English. Download anime episodes for free. High quality streaming on AnimeBing.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://animebing.in/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AnimeBing",
      "logo": {
        "@type": "ImageObject",
        "url": "https://animebing.in/AnimeBinglogo.jpg"
      }
    }
  };
};

export const generateBreadcrumbStructuredData = (breadcrumbs: Array<{name: string, url: string}>) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://animebing.in${item.url}`
    }))
  };
};

export const generateFAQStructuredData = (faqs: Array<{question: string, answer: string}>) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};