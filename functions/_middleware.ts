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

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // ========== TEST ENDPOINTS ==========
  if (url.pathname === '/function-test') {
    return new Response('✅ Function is working!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 🔍 API DEBUG — browser mein kholo: https://animebing.in/api-debug
  if (url.pathname === '/api-debug') {
    const API_BASE = env.API_URL || 'MISSING';
    const testSlug = 'the-beginning-after-the-end-season-2-hindi-sub';
    let apiResult = '';
    let apiStatus = 0;

    if (API_BASE !== 'MISSING') {
      try {
        const r = await fetch(`${API_BASE}/api/anime/${testSlug}`, {
          headers: { 'Accept': 'application/json' }
        });
        apiStatus = r.status;
        const text = await r.text();
        apiResult = text.substring(0, 500);
      } catch (e: unknown) {
        apiResult = 'FETCH ERROR: ' + (e instanceof Error ? e.message : String(e));
      }
    }

    const info = {
      API_URL_ENV: env.API_URL || '❌ NOT SET',
      API_BASE_USED: API_BASE,
      TEST_URL: API_BASE !== 'MISSING' ? `${API_BASE}/api/anime/${testSlug}` : 'N/A',
      API_STATUS: apiStatus,
      API_RESPONSE_PREVIEW: apiResult || 'N/A'
    };

    return new Response(JSON.stringify(info, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // ====================================

  if (!url.pathname.startsWith('/detail/')) {
    return next();
  }

  const slug = url.pathname.split('/detail/')[1]?.split('?')[0]?.split('#')[0];
  if (!slug) return next();

  // ✅ Apna actual Worker URL yahan daalo
  // Cloudflare Dashboard → Workers → animabing-backend → URL copy karo
  const API_BASE = env.API_URL || 'https://animabing-backend.animabingwatch.workers.dev';

  try {
    const [pageResponse, apiResponse] = await Promise.all([
      next(),
      fetch(`${API_BASE}/api/anime/${slug}`, {
        headers: { 'Accept': 'application/json' }
      })
    ]);

    let html = await pageResponse.text();

    if (!apiResponse.ok) {
      console.error(`API failed for "${slug}": status=${apiResponse.status}, url=${API_BASE}/api/anime/${slug}`);
      return new Response(html, {
        status: pageResponse.status,
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'X-Robots-Tag': 'index' }
      });
    }

    const animeData = await apiResponse.json() as {
      success: boolean;
      data?: {
        title?: string;
        slug?: string;
        seoTitle?: string;
        seoDescription?: string;
        description?: string;
        seoKeywords?: string;
        thumbnail?: string;
        contentType?: string;
        currentEpisode?: number;
        totalEpisodes?: number;
      };
    };

    if (animeData.success && animeData.data) {
      const anime = animeData.data;

      const esc = (input: unknown): string =>
        String(input || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, ' ')
          .trim();

      let titleText = anime.title || slug.replace(/-/g, ' ');
      if (anime.contentType === 'Movie') {
        titleText += ' (Movie)';
      } else if (anime.contentType === 'Manga') {
        titleText += ' Manga';
      } else {
        const ep = anime.currentEpisode || anime.totalEpisodes;
        if (ep && ep > 0) titleText += ` EP ${ep}`;
      }

      const seoTitle  = esc(anime.seoTitle || `${titleText} | AnimeBing`);
      const rawDesc   = anime.seoDescription || anime.description || `Watch ${anime.title} online in HD quality. Free streaming.`;
      const seoDesc   = esc(rawDesc.substring(0, 160));
      const keywords  = esc(anime.seoKeywords || '');
      const canonical = `https://animebing.in/detail/${anime.slug || slug}`;
      const imageUrl  = anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg';
      const ogType    = anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show';

      html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
      html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${seoTitle}</title>`);

      if (/<meta\s[^>]*name="description"[^>]*>/i.test(html)) {
        html = html.replace(
          /<meta\s[^>]*name="description"[^>]*>/i,
          `<meta name="description" content="${seoDesc}" />`
        );
      }
      if (/<meta[\s\S]*?name="keywords"[\s\S]*?>/i.test(html)) {
        html = html.replace(
          /<meta[\s\S]*?name="keywords"[\s\S]*?>/i,
          `<meta name="keywords" content="${keywords}" />`
        );
      }
      if (html.includes('rel="canonical"')) {
        html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
      }

      const metaTags = `
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${seoTitle}" />
  <meta property="og:description" content="${seoDesc}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:site_name" content="AnimeBing" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${seoTitle}" />
  <meta name="twitter:description" content="${seoDesc}" />
  <meta name="twitter:image" content="${imageUrl}" />`;

      html = html.replace('</head>', metaTags + '\n</head>');
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'X-Robots-Tag': 'index',
        'Cache-Control': 'public, max-age=300, s-maxage=600'
      }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Middleware error:', msg);
    return next();
  }
}