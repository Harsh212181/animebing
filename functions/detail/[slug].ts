// functions/detail/[slug].ts
export async function onRequest(context: any) {
  const { request, params } = context;
  const userAgent = request.headers.get('user-agent') || '';
  const slug = params.slug;

  // Bot detection
  const isBot = (ua: string) => {
    if (!ua) return false;
    const botPatterns = ['googlebot','bingbot','slurp','duckduckbot','baiduspider',
      'yandexbot','sogou','exabot','facebot','facebookexternalhit','twitterbot',
      'whatsapp','telegrambot','discordbot','linkedinbot','pinterestbot','applebot',
      'semrushbot','ahrefsbot','mj12bot','dotbot','rogerbot','screaming frog',
      'sitebulb','crawler','spider','bot/','bot;','+http','mediapartners',
      'adsbot','feedfetcher','ia_archiver','curl','wget','python-requests',
      'axios','lighthouse','pagespeed','chrome-lighthouse','headlesschrome',
      'phantomjs','selenium'];
    return botPatterns.some(p => ua.includes(p));
  };

  if (!isBot(userAgent)) {
    // Normal user → Pages React app serve karo
    return context.next();
  }

  // Bot hai → Worker API se anime details lao
  try {
    const apiUrl = `https://animabing-backend.animabingwatch.workers.dev/api/anime/${slug}`;
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error('API failed');
    const anime = await apiRes.json();

    let title = anime.title || slug;
    let description = anime.seoDescription || anime.description || '';
    if (!description || description.trim().length < 20) {
      const year = anime.releaseYear ? ` (${anime.releaseYear})` : '';
      const lang = anime.subDubStatus ? ` in ${anime.subDubStatus}` : '';
      description = `Watch ${title}${year}${lang} online free. HD streaming on AnimeBing.`;
    }
    const image = anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg';
    const type = anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | AnimeBing</title>
<meta name="description" content="${description.slice(0, 155)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="https://animebing.in/detail/${slug}">
<meta property="og:title" content="${title} | AnimeBing">
<meta property="og:description" content="${description.slice(0, 155)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="AnimeBing">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} | AnimeBing">
<meta name="twitter:description" content="${description.slice(0, 155)}">
<meta name="twitter:image" content="${image}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://animebing.in/detail/${slug}">
<link rel="icon" href="/favicon.ico">
</head>
<body>
<div id="root"></div>
<script>window.location.href="https://animebing.in/detail/${slug}";</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Bot-Handler': 'pages-function',
      },
    });
  } catch (e) {
    console.error('Bot handler error:', e);
    return context.next();
  }
}