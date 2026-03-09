 // utils/generateMetaHTML.cjs

function generateMetaHTML(meta) {

  const defaultImage = 'https://animebing.in/AnimeBinglogo.jpg'
  const imageUrl = meta.image || defaultImage

  return `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${meta.title} – AnimeBing</title>

<meta name="description" content="${meta.description}">

<!-- Open Graph -->
<meta property="og:type" content="${meta.type}">
<meta property="og:url" content="${meta.url}">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:image" content="${imageUrl}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${meta.title}">
<meta name="twitter:description" content="${meta.description}">
<meta name="twitter:image" content="${imageUrl}">
<meta name="twitter:url" content="${meta.url}">

<link rel="icon" href="https://animebing.in/AnimeBinglogo.jpg">

</head>

<body>

<div id="root"></div>

<!-- React build -->
<script type="module" src="/assets/index.js"></script>

</body>
</html>
`
}

module.exports = generateMetaHTML