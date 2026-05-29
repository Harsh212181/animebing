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

// HTML special chars escape
function esc(input: unknown): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ')
    .trim();
}

// Image URL as-is return karo — koi transformation nahi
function toOgImage(url: string): string {
  return url || LOGO_URL;
}

// links array se unique sorted episode numbers nikalo
function getEpisodeList(links: unknown): number[] {
  if (!Array.isArray(links)) return [];
  const nums = links
    .map((l: any) => parseInt(String(l?.episode || ''), 10))
    .filter(n => !isNaN(n));
  return [...new Set(nums)].sort((a, b) => a - b);
}

// Episode list se title suffix banao: "EP 1-6" ya "EP 1, 3, 5"
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
  const d   = esc(data.description.substring(0, 160));
  const img = data.image || LOGO_URL;
  const u   = data.url;
  const typ = data.type || 'website';

  return `
  <link rel="canonical" href="${u}" />
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

function injectMeta(html: string, meta: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}): string {
  const t = esc(meta.title);
  const d = esc(meta.description.substring(0, 160));

  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);

  if (/<meta\s[^>]*name="description"[^>]*>/i.test(html)) {
    html = html.replace(
      /<meta\s[^>]*name="description"[^>]*>/i,
      `<meta name="description" content="${d}" />`
    );
  }
  if (/<meta[\s\S]*?name="keywords"[\s\S]*?>/i.test(html)) {
    html = html.replace(
      /<meta[\s\S]*?name="keywords"[\s\S]*?>/i,
      `<meta name="keywords" content="${esc(meta.title)}" />`
    );
  }
  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${meta.url}" />`);
  }

  html = html.replace('</head>', buildMetaTags(meta) + '\n</head>');
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

        // ✅ Episodes array se max nikalo
        const episodesArr = Array.isArray(anime.episodes) ? anime.episodes as any[] : [];
        let maxEp = episodesArr.length > 0
          ? Math.max(...episodesArr.map((e: any) => Number(e.episodeNumber || e.number || 0)))
          : Number(anime.currentEpisode || 0);

        // ✅ Download pages se bhi max episode check karo (agar episodes collection mein kam entries hain)
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
        } catch (_) { /* fallback to episodes array max */ }

        // ✅ Title: hamesha dynamic
        let titleText = String(anime.title || slug.replace(/-/g, ' '));
        if (anime.contentType === 'Movie')      titleText += ' (Movie)';
        else if (anime.contentType === 'Manga') titleText += ' Manga';
        else if (maxEp > 0)                     titleText += ` EP ${maxEp}`;
        const ogTitle = `${titleText} | ${SITE_NAME}`;

        // ✅ Description: story/plot pehle
        const rawDesc = String(
          anime.description || anime.seoDescription || anime.synopsis ||
          `Watch ${anime.title} online in HD quality on ${SITE_NAME}.`
        ).trim();

        html = injectMeta(html, {
          title:       ogTitle,
          description: rawDesc,
          image:       toOgImage(String(anime.thumbnail || LOGO_URL)),
          url:         `${SITE_URL}/detail/${String(anime.slug || slug)}`,
          type:        anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show'
        });
      }

      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'X-Robots-Tag': 'index', 'Cache-Control': 'public, max-age=300, s-maxage=600' }
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

        // ✅ links se unique sorted episode numbers nikalo
        const episodes = getEpisodeList(page.links);
        const suffix   = epSuffix(episodes); // e.g. " - EP 1-6"

        // ✅ Title: "Let This Grieving Soul Retire S2 - EP 1-6 Watch & Download | AnimeBing"
        const ogTitle = `${animeName}${suffix} Watch & Download | ${SITE_NAME}`;

        // ✅ Episode range format: "Episodes 1-12" (1,2,3... ki jagah)
        const epRange = episodes.length === 0
          ? 'Episodes'
          : episodes.length === 1
            ? `Episode ${episodes[0]}`
            : `Episodes ${episodes[0]}-${episodes[episodes.length - 1]}`;

        const animeDesc = anime
          ? String(anime.description || anime.seoDescription || '').trim()
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
          // ✅ no-store — har request fresh fetch karo, cache mix nahi hoga
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