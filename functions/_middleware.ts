interface Env {
  API_URL?: string;
}

interface CFContext {
  request: Request;
  next: () => Promise<Response>;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

const SITE_URL  = 'https://animebing.in';
const LOGO_URL  = 'https://animebing.in/AnimeBinglogo.jpg';
const SITE_NAME = 'AnimeBing';

function getApiBase(env: Env): string {
  return env.API_URL || 'https://animabing-backend.animabingwatch.workers.dev';
}

function esc(input: unknown): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ')
    .trim();
}

function toOgImage(url: string): string {
  return url || LOGO_URL;
}

function getEpisodeList(links: unknown): number[] {
  if (!Array.isArray(links)) return [];
  const nums = links
    .map((l: any) => parseInt(String(l?.episode || ''), 10))
    .filter(n => !isNaN(n));
  return [...new Set(nums)].sort((a, b) => a - b);
}

function epSuffix(episodes: number[]): string {
  if (episodes.length === 0) return '';
  if (episodes.length === 1) return ` - EP ${episodes[0]}`;
  const isRange = episodes[episodes.length - 1] - episodes[0] === episodes.length - 1;
  if (isRange) return ` - EP ${episodes[0]}-${episodes[episodes.length - 1]}`;
  return ` - EP ${episodes.join(', ')}`;
}

function buildMetaTags(data: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}): string {
  const t   = esc(data.title);
  const d   = esc(data.description.substring(0, 900));
  const img = data.image || LOGO_URL;
  const u   = data.url;
  const typ = data.type || 'website';

  return `
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="${typ}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />`;
}

function buildStructuredData(anime: Record<string, unknown>, url: string, maxEp: number): string {
  const title = String(anime.title || '');
  const description = String(anime.description || (anime as any).seoDescription || '').substring(0, 900);
  const image = String(anime.thumbnail || LOGO_URL);
  const isMovie = anime.contentType === 'Movie';
  const isManga = anime.contentType === 'Manga';

  const data: any = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : isManga ? "Book" : "TVSeries",
    "name": title,
    "description": description,
    "url": url,
    "image": {
      "@type": "ImageObject",
      "url": image,
      "contentUrl": image,
      "name": `${title} Poster`,
      "description": `${title} anime poster image`
    },
    "thumbnailUrl": image,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": LOGO_URL
      }
    },
    "potentialAction": {
      "@type": "WatchAction",
      "target": url
    }
  };

  // Episode info
  if (!isMovie && !isManga && maxEp > 0) {
    data.numberOfEpisodes = maxEp;
    data.numberOfSeasons = 1;
  }

  // Genre
  if (Array.isArray(anime.genreList) && (anime.genreList as any[]).length > 0) {
    data.genre = anime.genreList;
  }

  // Release year
  if (anime.releaseYear) {
    data.dateCreated = String(anime.releaseYear);
  }

  // ✅ FIX: Rating — sirf tab add karo jab ratingValue valid ho (1-10 range)
  const likes = Number(anime.likes || 0);
  const dislikes = Number(anime.dislikes || 0);
  const totalVotes = likes + dislikes;
  if (totalVotes > 10 && likes > 0) {
    // Rating 1-10 range mein rakho
    const rawRating = (likes / totalVotes) * 9 + 1;
    const ratingValue = Math.min(10, Math.max(1, parseFloat(rawRating.toFixed(1))));
    data.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": ratingValue,
      "bestRating": 10,
      "worstRating": 1,
      "ratingCount": totalVotes
    };
  }

  // ✅ FIX: JSON mein special chars properly escape karo
  return `<script type="application/ld+json">${JSON.stringify(data, null, 0)}</script>`;
}

function injectMeta(html: string, meta: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
  structuredData?: string;
}): string {
  const t = esc(meta.title);
  const d = esc(meta.description.substring(0, 900));

  // ✅ Step 1: Saare existing OG / Twitter / ld+json tags remove karo
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  // ✅ Step 2: <title> replace karo
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);

  // ✅ Step 3: <meta name="description"> replace karo
  // index.html mein ab yeh tag hai, toh replace hoga
  if (/<meta\s[^>]*name="description"[^>]*>/i.test(html)) {
    html = html.replace(
      /<meta\s[^>]*name="description"[^>]*>/i,
      `<meta name="description" content="${d}" />`
    );
  } else {
    // Fallback: agar tag nahi mila toh inject karo
    html = html.replace('<head>', `<head>\n  <meta name="description" content="${d}" />`);
  }

  // ✅ Step 4: <link rel="canonical"> replace karo
  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${meta.url}" />`);
  }

  // ✅ Step 5: Fresh OG + Twitter tags + Structured Data </head> se PEHLE inject karo
  const sdTag = meta.structuredData || '';
  html = html.replace('</head>', buildMetaTags(meta) + '\n' + sdTag + '\n</head>');

  return html;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, next, env } = context;
  const url  = new URL(request.url);
  const path = url.pathname;

  // ========== TEST ==========
  if (path === '/function-test') {
    return new Response('✅ Function is working!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ========== DEBUG ==========
  if (path === '/api-debug') {
    const API_BASE   = getApiBase(env);
    const testSlug   = 'the-beginning-after-the-end-season-2-hindi-sub';
    const testDlSlug = 'My%20Gift%20Lvl.9999%20Unlimited%20Gacha%20wekjbjwefcfwa3';
    let animeResult = '', animeStatus = 0;
    let dlResult = '', dlStatus = 0;

    try {
      const r1 = await fetch(`${API_BASE}/api/anime/${testSlug}`);
      animeStatus = r1.status;
      animeResult = (await r1.text()).substring(0, 300);
    } catch (e: unknown) {
      animeResult = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
    }
    try {
      const r2 = await fetch(`${API_BASE}/api/download-pages/${testDlSlug}`);
      dlStatus = r2.status;
      dlResult = (await r2.text()).substring(0, 300);
    } catch (e: unknown) {
      dlResult = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
    }

    return new Response(JSON.stringify({
      API_URL_ENV:   env.API_URL || '❌ NOT SET',
      API_BASE_USED: API_BASE,
      anime_test:    { status: animeStatus, preview: animeResult },
      download_test: { status: dlStatus,    preview: dlResult }
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  // ========== META DEBUG — live check karo ==========
  if (path === '/meta-debug') {
    const testSlug = url.searchParams.get('slug') || 'naruto';
    const API_BASE = getApiBase(env);
    try {
      const r = await fetch(`${API_BASE}/api/anime/${testSlug}`, { headers: { Accept: 'application/json' } });
      const data = await r.json() as any;
      return new Response(JSON.stringify({
        status: r.status,
        success: data.success,
        title: data.data?.title,
        description: data.data?.description,
        seoDescription: data.data?.seoDescription,
        thumbnail: data.data?.thumbnail,
        slug: data.data?.slug,
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // ========== SITEMAP PROXY ==========
  const SITEMAP_PATHS = ['/sitemap.xml', '/sitemap-static.xml', '/sitemap-anime.xml', '/sitemap-episodes.xml'];
  if (SITEMAP_PATHS.includes(path)) {
    const API_BASE = getApiBase(env);
    try {
      const workerRes = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/xml' } });
      const xml = await workerRes.text();
      return new Response(xml, {
        status: workerRes.status,
        headers: {
          'Content-Type':  'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=7200',
        }
      });
    } catch (e) {
      const today = new Date().toISOString().split('T')[0];
      const fallback = path === '/sitemap.xml'
        ? `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${SITE_URL}/sitemap-static.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${SITE_URL}/sitemap-anime.xml</loc><lastmod>${today}</lastmod></sitemap>\n</sitemapindex>`
        : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
      return new Response(fallback, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    }
  }

  // ========== ROBOTS.TXT ==========
  if (path === '/robots.txt') {
    const API_BASE = getApiBase(env);
    try {
      const r = await fetch(`${API_BASE}/robots.txt`);
      const txt = await r.text();
      return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
    } catch (e) {
      return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/admin/\nSitemap: ${SITE_URL}/sitemap.xml`, { headers: { 'Content-Type': 'text/plain' } });
    }
  }

  // ========== DETAIL PAGE /detail/:slug ==========
  if (path.startsWith('/detail/')) {
    const slug = path.split('/detail/')[1]?.split('?')[0]?.split('#')[0];
    if (!slug) return next();

    const API_BASE = getApiBase(env);
    try {
      const [pageRes, apiRes] = await Promise.all([
        next(),
        fetch(`${API_BASE}/api/anime/${slug}`, { headers: { Accept: 'application/json' } })
      ]);

      let html = await pageRes.text();
      if (!apiRes.ok) return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

      const data = await apiRes.json() as { success: boolean; data?: Record<string, unknown> };
      if (data.success && data.data) {
        const anime = data.data;

        // Episodes array se max nikalo
        const episodesArr = Array.isArray(anime.episodes) ? anime.episodes as any[] : [];
        let maxEp = episodesArr.length > 0
          ? Math.max(...episodesArr.map((e: any) => Number(e.episodeNumber || e.number || 0)))
          : Number(anime.currentEpisode || 0);

        // Download pages se bhi max episode check karo
        try {
          const animeId = String((anime as any)._id || '');
          if (animeId) {
            const dlRes = await fetch(`${API_BASE}/api/download-pages/anime/${animeId}`, {
              headers: { Accept: 'application/json' }
            });
            if (dlRes.ok) {
              const dlPages = await dlRes.json() as any[];
              if (Array.isArray(dlPages) && dlPages.length > 0) {
                const allEpNums = dlPages.flatMap((p: any) =>
                  Array.isArray(p.links)
                    ? p.links.map((l: any) => parseInt(String(l?.episode || '0'), 10)).filter((n: number) => !isNaN(n) && n > 0)
                    : []
                );
                if (allEpNums.length > 0) {
                  maxEp = Math.max(maxEp, ...allEpNums);
                }
              }
            }
          }
        } catch (_) { /* fallback */ }

        // Title: hamesha dynamic
        let titleText = String(anime.title || slug.replace(/-/g, ' '));
        if (anime.contentType === 'Movie')      titleText += ' (Movie)';
        else if (anime.contentType === 'Manga') titleText += ' Manga';
        else if (maxEp === 1)                   titleText += ` EP 1`;
        else if (maxEp > 1)                     titleText += ` EP 1-${maxEp}`;
        const ogTitle = `${titleText} | ${SITE_NAME}`;

        // ✅ Description: description > seoDescription > synopsis > fallback
        const rawDesc = String(
          anime.description ||
          (anime as any).seoDescription ||
          (anime as any).synopsis ||
          `Watch ${anime.title} online in HD quality on ${SITE_NAME}.`
        ).trim();

        html = injectMeta(html, {
          title:          ogTitle,
          description:    rawDesc,
          image:          toOgImage(String(anime.thumbnail || LOGO_URL)),
          url:            `${SITE_URL}/detail/${String(anime.slug || slug)}`,
          type:           anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show',
          structuredData: buildStructuredData(anime, `${SITE_URL}/detail/${String(anime.slug || slug)}`, maxEp)
        });
      }

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'X-Robots-Tag': 'index',
          // ✅ Cache kam karo taaki description update jaldi reflect ho
          'Cache-Control': 'public, max-age=60, s-maxage=120',
        }
      });
    } catch (e) {
      console.error('Detail middleware error:', e);
      return next();
    }
  }

  // ========== DOWNLOAD PAGE /download/:slug ==========
  if (path.startsWith('/download/')) {
    const rawSlug = path.split('/download/')[1]?.split('?')[0]?.split('#')[0] || '';
    const slug    = decodeURIComponent(rawSlug);
    if (!slug) return next();

    const API_BASE = getApiBase(env);
    try {
      const [pageRes, apiRes] = await Promise.all([
        next(),
        fetch(`${API_BASE}/api/download-pages/${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/json' }
        })
      ]);

      let html = await pageRes.text();
      if (!apiRes.ok) return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

      const page = await apiRes.json() as Record<string, unknown>;
      const anime = (page.animeId && typeof page.animeId === 'object')
        ? page.animeId as Record<string, unknown>
        : null;

      if (anime || page.title) {
        const animeName = anime ? String(anime.title || '').trim() : String(page.title || slug);

        const episodes = getEpisodeList(page.links);
        const suffix   = epSuffix(episodes);

        const ogTitle = `${animeName}${suffix} Watch & Download | ${SITE_NAME}`;

        const epRange = episodes.length === 0
          ? 'Episodes'
          : episodes.length === 1
            ? `Episode ${episodes[0]}`
            : `Episodes ${episodes[0]}-${episodes[episodes.length - 1]}`;

        const animeDesc = anime
          ? String((anime as any).description || (anime as any).seoDescription || (anime as any).synopsis || '').trim()
          : '';

        const description = animeDesc
          ? `${epRange} available for Watch & Download. ${animeDesc}`.substring(0, 160)
          : `${epRange} available for Watch & Download on ${SITE_NAME}. ${animeName} HD quality free streaming.`;

        html = injectMeta(html, {
          title:       ogTitle,
          description: description,
          image:       toOgImage(anime ? String(anime.thumbnail || LOGO_URL) : LOGO_URL),
          url:         `${SITE_URL}/download/${rawSlug}`,
          type:        'website'
        });
      }

      return new Response(html, {
        headers: {
          'Content-Type':  'text/html;charset=UTF-8',
          'X-Robots-Tag':  'index',
          'Cache-Control': 'no-store',
          'Vary':          'Accept-Encoding'
        }
      });
    } catch (e) {
      console.error('Download middleware error:', e);
      return next();
    }
  }

  return next();
}