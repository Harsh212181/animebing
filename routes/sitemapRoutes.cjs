 const express = require("express");
const router = express.Router();

const Anime = require("../models/Anime.cjs");
const Episode = require("../models/Episode.cjs");

/* ================================================================
   📌 STATIC SITEMAP (sitemap-static.xml)
================================================================ */
router.get("/sitemap-static.xml", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const staticPages = [
    "",
    "contact",
    "privacy-policy",
    "terms-and-conditions",
    "dmca",
    "top-100",
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  staticPages.forEach((p) => {
    xml += `
  <url>
    <loc>https://animebing.in/${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  });

  xml += `</urlset>`;

  res.set("Content-Type", "application/xml");
  res.send(xml);
});

/* ================================================================
   📌 ANIME SITEMAP (sitemap-anime.xml)
================================================================ */
router.get("/sitemap-anime.xml", async (req, res) => {
  try {
    const animeList = await Anime.find({})
      .select("slug updatedAt title thumbnail")
      .lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    animeList.forEach((anime) => {
      const slug = anime.slug;
      const lastmod = new Date(anime.updatedAt).toISOString().split("T")[0];

      xml += `
  <url>
    <loc>https://animebing.in/anime/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
`;
      if (anime.thumbnail) {
        xml += `
    <image:image>
      <image:loc>${anime.thumbnail}</image:loc>
      <image:title>${anime.title}</image:title>
    </image:image>
`;
      }

      xml += `  </url>`;
    });

    xml += `</urlset>`;

    res.set("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("❌ Anime sitemap error:", err);
    res.status(500).send("Internal Server Error");
  }
});

/* ================================================================
   📌 EPISODE SITEMAP (sitemap-episodes.xml)
================================================================ */
router.get("/sitemap-episodes.xml", async (req, res) => {
  try {
    const episodes = await Episode.find({})
      .select("animeId episodeNumber updatedAt")
      .populate("animeId", "slug")
      .lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    episodes.forEach((ep) => {
      if (!ep.animeId || !ep.animeId.slug) return;

      const url = `https://animebing.in/anime/${ep.animeId.slug}/episode/${ep.episodeNumber}`;
      const lastmod = new Date(ep.updatedAt).toISOString().split("T")[0];

      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    });

    xml += `</urlset>`;

    res.set("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("❌ Episode sitemap error:", err);
    res.status(500).send("Internal Server Error");
  }
});

/* ================================================================
   📌 MASTER SITEMAP INDEX (sitemap.xml)
================================================================ */
router.get("/sitemap.xml", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <sitemap>
    <loc>https://animebing.in/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>

  <sitemap>
    <loc>https://animebing.in/sitemap-anime.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>

  <sitemap>
    <loc>https://animebing.in/sitemap-episodes.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>

</sitemapindex>
`;

  res.set("Content-Type", "application/xml");
  res.send(xml);
});

module.exports = router;