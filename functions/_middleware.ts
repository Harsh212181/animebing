export async function onRequest(context) {
  console.log('🚀 SEO function triggered for:', context.request.url);
  const { request, next } = context;
  const url = new URL(request.url);

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
      return new Response(html, { headers: { 'Content-Type': 'text/html' } }); // fallback
    }

    const animeData = await apiResponse.json();
    console.log('✅ API response received:', animeData.success ? 'success' : 'failure');
    console.log('Full API data:', JSON.stringify(animeData, null, 2)); // Log full data

    if (animeData.success && animeData.data) {
      const anime = animeData.data;
      console.log('📦 Anime title:', anime.title);
      console.log('SEO Title from API:', anime.seoTitle);
      console.log('SEO Description:', anime.seoDescription);
      console.log('SEO Keywords:', anime.seoKeywords);

      // Build SEO tags
      const seoTitle = anime.seoTitle || `${anime.title} | AnimeBing`;
      const seoDescription = anime.seoDescription || anime.description || `Watch ${anime.title} online in HD`;
      const seoKeywords = anime.seoKeywords || '';
      const canonicalUrl = `https://animebing.in/detail/${anime.slug || slug}`;

      // Replace meta tags (with logs to confirm replacement)
      console.log('🔧 Replacing <title>...');
      const originalTitleMatch = html.match(/<title>.*?<\/title>/);
      console.log('Original title:', originalTitleMatch ? originalTitleMatch[0] : 'not found');
      html = html.replace(/<title>.*?<\/title>/, `<title>${seoTitle}</title>`);

      console.log('🔧 Replacing description...');
      html = html.replace(/<meta name="description".*?>/, `<meta name="description" content="${seoDescription.substring(0, 155)}" />`);

      console.log('🔧 Replacing keywords...');
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

      console.log('✅ HTML modified successfully');
    } else {
      console.log('⚠️ API returned success false or no data');
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('❌ Worker error:', error);
    return next(); // fallback
  }
}