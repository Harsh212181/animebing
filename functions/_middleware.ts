export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // ========== TEST ENDPOINT ==========
  // Visit https://animebing.in/function-test to check if the function is running
  if (url.pathname === '/function-test') {
    return new Response('✅ Function is working!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  // ===================================

  console.log('🚀 SEO function triggered for:', context.request.url);

  // Only handle detail pages
  if (!url.pathname.startsWith('/detail/')) {
    console.log('➡️ Not a detail page, passing through');
    return next();
  }

  const slug = url.pathname.split('/detail/')[1];
  console.log('🔍 Extracted slug:', slug);

  try {
    // 1. Fetch original HTML
    console.log('📥 Fetching original HTML...');
    const response = await next();
    let html = await response.text();
    console.log('✅ Original HTML fetched, length:', html.length);

    // 2. Fetch anime data from API
    const apiUrl = `https://animabing.onrender.com/api/anime/${slug}?fields=title,seoTitle,seoDescription,seoKeywords,thumbnail,description,contentType,subDubStatus`;
    console.log('🌐 Fetching API data from:', apiUrl);
    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      console.error('❌ API request failed with status:', apiResponse.status);
      const errorText = await apiResponse.text();
      console.error('Response body:', errorText.substring(0, 200));
      // Return original HTML with index header
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Robots-Tag': 'index'
        }
      });
    }

    const animeData = await apiResponse.json();
    console.log('✅ API response received:', animeData.success ? 'success' : 'failure');

    if (animeData.success && animeData.data) {
      const anime = animeData.data;
      console.log('📦 Anime title:', anime.title);

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

      // Open Graph tags (this is what WhatsApp needs)
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

      console.log('✅ HTML modified successfully with OG tags');
    }

    // Return modified HTML with index header
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Robots-Tag': 'index'
      }
    });
  } catch (error) {
    console.error('❌ Worker error:', error);
    return next();
  }
}