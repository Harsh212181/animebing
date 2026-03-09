 function generateMetaHTML(meta) {

const defaultImage = 'https://animebing.in/AnimeBinglogo.jpg'
const imageUrl = meta.image || defaultImage

return `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${meta.title}</title>

<meta name="description" content="${meta.description}">

<meta property="og:type" content="${meta.type}">
<meta property="og:url" content="${meta.url}">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:image" content="${imageUrl}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${meta.title}">
<meta name="twitter:description" content="${meta.description}">
<meta name="twitter:image" content="${imageUrl}">

<link rel="icon" href="/AnimeBinglogo.jpg" />

<link rel="stylesheet" href="/assets/index-mRNVgL1b.css">

</head>

<body>

<div id="root"></div>

<script type="module" src="/assets/index-CpmUjkNn.js"></script>

</body>

</html>
`
}

module.exports = generateMetaHTML