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

  if (url.pathname === '/function-test') {
    return new Response('✅ Function is working!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (!url.pathname.startsWith('/detail/')) {
    return next();
  }

  const slug = url.pathname.split('/detail/')[1]?.split('?')[0]?.split('#')[0];
  if (!slug) return next();

  const API_BASE = env.API_URL || 'https://animabing-backend.animabing.workers.dev';

  try {
    const [pageResponse, apiResponse] = await Promise.all([
      next(),
      fetch(`${API_BASE}/api/anime/${slug}`, {
        headers: { 'Accept': 'application/json' }
      })
    ]);

    let html = await pageResponse.text();

    if (!apiResponse.ok) {
      console.error(`API failed for slug "${slug}": ${apiResponse.status}`);
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

      // HTML escape function
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

      const seoTitle = esc(anime.seoTitle || `${titleText} | AnimeBing`);
      const rawDesc  = anime.seoDescription || anime.description || `Watch ${anime.title} online in HD quality. Free streaming.`;
      const seoDesc  = esc(rawDesc.substring(0, 160));
      const keywords = esc(anime.seoKeywords || '');
      const canonical = `https://animebing.in/detail/${anime.slug || slug}`;
      const imageUrl  = anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg';
      const ogType    = anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show';

      // Purane OG/Twitter tags hataao
      html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
      html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');

      // Title update
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${seoTitle}</title>`);

      // Description update
      if (/<meta\s[^>]*name="description"[^>]*>/i.test(html)) {
        html = html.replace(
          /<meta\s[^>]*name="description"[^>]*>/i,
          `<meta name="description" content="${seoDesc}" />`
        );
      }

      // Keywords update (multiline bhi handle hoga)
      if (/<meta[\s\S]*?name="keywords"[\s\S]*?>/i.test(html)) {
        html = html.replace(
          /<meta[\s\S]*?name="keywords"[\s\S]*?>/i,
          `<meta name="keywords" content="${keywords}" />`
        );
      }

      // Canonical update
      if (html.includes('rel="canonical"')) {
        html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
      }

      // OG + Twitter tags inject
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
      console.log(`✅ OG tags injected for: ${anime.title}`);
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