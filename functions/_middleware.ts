// functions/_middleware.ts
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Only handle detail pages
  if (!url.pathname.startsWith('/detail/')) {
    return next();
  }

  const slug = url.pathname.split('/detail/')[1];

  try {
    // Fetch the original HTML from Pages (static)
    const response = await next();
    let html = await response.text();

    // Fetch anime data from your backend API
    const apiUrl = `https://animabing.onrender.com/api/anime/${slug}?fields=title,seoTitle,seoDescription,seoKeywords,thumbnail,description,contentType,subDubStatus`;
    const apiResponse = await fetch(apiUrl);

    if (apiResponse.ok) {
      const animeData = await apiResponse.json();
      if (animeData.success && animeData.data) {
        const anime = animeData.data;

        // Build SEO tags
        const seoTitle = anime.seoTitle || `${anime.title} | AnimeBing`;
        const seoDescription = anime.seoDescription || anime.description || `Watch ${anime.title} online in HD`;
        const seoKeywords = anime.seoKeywords || '';
        const canonicalUrl = `https://animebing.in/detail/${anime.slug || slug}`;

        // Replace meta tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${seoTitle}</title>`);
        html = html.replace(/<meta name="description".*?>/, `<meta name="description" content="${seoDescription.substring(0, 155)}" />`);
        html = html.replace(/<meta name="keywords".*?>/, `<meta name="keywords" content="${seoKeywords}" />`);

        // Canonical URL
        if (html.includes('<link rel="canonical"')) {
          html = html.replace(/<link rel="canonical".*?>/, `<link rel="canonical" href="${canonicalUrl}" />`);
        } else {
          html = html.replace('</head>', `  <link rel="canonical" href="${canonicalUrl}" />\n</head>`);
        }

        // Open Graph tags
        const ogTags = `
  <meta property="og:title" content="${seoTitle}" />
  <meta property="og:description" content="${seoDescription.substring(0, 155)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg'}" />
  <meta property="og:type" content="${anime.contentType === 'Movie' ? 'video.movie' : 'video.tv_show'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${seoTitle}" />
  <meta name="twitter:description" content="${seoDescription.substring(0, 155)}" />
  <meta name="twitter:image" content="${anime.thumbnail || 'https://animebing.in/AnimeBinglogo.jpg'}" />
`;
        html = html.replace('</head>', ogTags + '\n</head>');
      }
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Pages Function error:', error);
    return next(); // fallback to original
  }
}