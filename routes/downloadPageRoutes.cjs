 const express = require('express');
const router = express.Router();
const DownloadPage = require('../models/DownloadPage.cjs');
const Anime = require('../models/Anime.cjs');
const adminAuth = require('../middleware/adminAuth.cjs');

// Helper to count link types
function countLinksByType(links) {
  return {
    watch: links.filter(l => l.type === 'watch').length,
    download: links.filter(l => l.type === 'download').length
  };
}

// ========== STATIC ROUTES (must come before dynamic /:slug) ==========

// ✅ Admin: get download statistics (total pages and total unique episodes)
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalPages = await DownloadPage.countDocuments();

    // Aggregate to count distinct episodes across all pages
    const result = await DownloadPage.aggregate([
      { $unwind: "$links" },
      { $group: { _id: "$_id", uniqueEpisodes: { $addToSet: "$links.episode" } } },
      { $project: { episodeCount: { $size: "$uniqueEpisodes" } } },
      { $group: { _id: null, totalEpisodes: { $sum: "$episodeCount" } } }
    ]);

    const totalEpisodes = result[0]?.totalEpisodes || 0;
    res.json({ totalPages, totalDownloadEpisodes: totalEpisodes });
  } catch (error) {
    console.error('Error fetching download stats:', error);
    res.status(500).json({ error: 'Failed to fetch download stats' });
  }
});

// ✅ Public: get all pages for an anime (used by sync feature)
router.get('/anime/:animeId', async (req, res) => {
  try {
    const pages = await DownloadPage.find({ animeId: req.params.animeId })
      .populate('animeId', 'title contentType')
      .sort('episodeNumber createdAt');
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: get all pages (protected) – populates all needed fields
router.get('/', adminAuth, async (req, res) => {
  try {
    const pages = await DownloadPage.find()
      .populate('animeId', 'title contentType subDubStatus status releaseYear')
      .sort('-createdAt');
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: create a page
router.post('/', adminAuth, async (req, res) => {
  try {
    const { animeId, slug, title, episodeNumber, links } = req.body;

    if (!animeId || !slug || !episodeNumber || !links || links.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: animeId, slug, episodeNumber, and at least one link' });
    }

    const existing = await DownloadPage.findOne({ slug });
    if (existing) return res.status(400).json({ error: 'Slug already exists' });

    const anime = await Anime.findById(animeId);
    if (!anime) return res.status(400).json({ error: 'Anime not found' });

    if (links.length > 24) return res.status(400).json({ error: 'Maximum total links allowed is 24' });
    const counts = countLinksByType(links);
    if (counts.watch > 12) return res.status(400).json({ error: `Maximum watch links allowed is 12 (you have ${counts.watch})` });
    if (counts.download > 12) return res.status(400).json({ error: `Maximum download links allowed is 12 (you have ${counts.download})` });

    for (const link of links) {
      if (!link.episode || !link.url) return res.status(400).json({ error: 'Each link must have episode and url' });
      if (!link.type) link.type = 'download';
    }

    const page = new DownloadPage({ animeId, slug, title: title || 'Download', episodeNumber, links });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: update a page
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { slug, title, episodeNumber, links } = req.body;
    const page = await DownloadPage.findById(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    if (slug && slug !== page.slug) {
      const existing = await DownloadPage.findOne({ slug });
      if (existing) return res.status(400).json({ error: 'Slug already exists' });
      page.slug = slug;
    }

    if (title !== undefined) page.title = title;
    if (episodeNumber !== undefined) {
      if (episodeNumber < 1) return res.status(400).json({ error: 'episodeNumber must be at least 1' });
      page.episodeNumber = episodeNumber;
    }

    if (links) {
      if (links.length > 24) return res.status(400).json({ error: 'Maximum total links allowed is 24' });
      const counts = countLinksByType(links);
      if (counts.watch > 12) return res.status(400).json({ error: `Maximum watch links allowed is 12 (you have ${counts.watch})` });
      if (counts.download > 12) return res.status(400).json({ error: `Maximum download links allowed is 12 (you have ${counts.download})` });

      for (const link of links) {
        if (!link.episode || !link.url) return res.status(400).json({ error: 'Each link must have episode and url' });
        if (!link.type) link.type = 'download';
      }
      page.links = links;
    }

    page.updatedAt = Date.now();
    await page.save();
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: delete a page
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const page = await DownloadPage.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DYNAMIC ROUTES (must be last) ==========

// ✅ Public: get a page by slug – includes contentType and episodeNumber
router.get('/:slug', async (req, res) => {
  try {
    const page = await DownloadPage.findOne({ slug: req.params.slug })
      .populate('animeId', 'title contentType');
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;