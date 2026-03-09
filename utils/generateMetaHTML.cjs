 // utils/generateMetaHTML.cjs
function generateMetaHTML(meta) {
  // ✅ Valid default image – आपका logo या कोई CDN placeholder
  const defaultImage = 'https://animebing.in/AnimeBinglogo.jpg'; // यह असली image है
  const imageUrl = meta.image || defaultImage;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title} – AnimeBing</title>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${meta.type}">
  <meta property="og:url" content="${meta.url}">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:image" content="${imageUrl}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${meta.url}">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <meta name="twitter:image" content="${imageUrl}">

  <link rel="icon" href="/AnimeBinglogo.jpg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
  `;
}

module.exports = generateMetaHTML;