 const express = require("express");
const router = express.Router();

const Anime = require("../models/Anime.cjs");
const Episode = require("../models/Episode.cjs");

/* ================================================================
   📌 STATIC SITEMAP (sitemap-static.xml)
   ================================================================ */
router.get("/sitemap-static.xml", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  // ✅ STATIC PAGES - SIRF WOHI JO ACTUALLY EXIST KARTE HAIN
  const staticPages = [
    "",              // home page
    "top-100",       // ✅ EXISTS - verified
    "privacy",       // privacy policy
    "terms",         // terms & conditions
    "dmca",          // dmca page
    "contact",       // contact page
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  staticPages.forEach((page) => {
    const loc = page === "" 
      ? "https://animebing.in/" 
      : `https://animebing.in/${page}`;
    
    xml += `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page === "" ? "daily" : "monthly"}</changefreq>
    <priority>${page === "" ? "1.0" : "0.8"}</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  res.set("Content-Type", "application/xml");
  res.send(xml);
});

/* ================================================================
   📌 ANIME SITEMAP (sitemap-anime.xml)
   ================================================================ */
router.get("/sitemap-anime.xml", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    
    const animeList = await Anime.find({})
      .select("slug updatedAt title thumbnail")
      .lean();

    if (!animeList || animeList.length === 0) {
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    animeList.forEach((anime) => {
      const slug = anime.slug;
      const lastmod = anime.updatedAt 
        ? new Date(anime.updatedAt).toISOString().split("T")[0] 
        : today;

      xml += `
  <url>
    <loc>https://animebing.in/detail/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>`;

      if (anime.thumbnail) {
        xml += `
    <image:image>
      <image:loc>${anime.thumbnail}</image:loc>
      <image:title>${anime.title}</image:title>
    </image:image>`;
      }

      xml += `
  </url>`;
    });

    xml += `
</urlset>`;

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
    const today = new Date().toISOString().split("T")[0];
    
    const episodes = await Episode.find({})
      .select("animeId episodeNumber updatedAt")
      .populate({
        path: "animeId",
        select: "slug",
        model: "Anime"
      })
      .lean();

    if (!episodes || episodes.length === 0) {
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    episodes.forEach((ep) => {
      if (!ep.animeId || !ep.animeId.slug) {
        return;
      }

      const url = `https://animebing.in/detail/${ep.animeId.slug}/episode/${ep.episodeNumber}`;
      const lastmod = ep.updatedAt 
        ? new Date(ep.updatedAt).toISOString().split("T")[0] 
        : today;

      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `
</urlset>`;

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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

</sitemapindex>`;

  res.set("Content-Type", "application/xml");
  res.send(xml);
});

module.exports = router;