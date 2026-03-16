// routes/downloadPageRoutes.cjs
const express = require('express');
const router = express.Router();
const DownloadPage = require('../models/DownloadPage.cjs');
const Anime = require('../models/Anime.cjs');
const adminAuth = require('../middleware/adminAuth.cjs');

// ✅ Public: get a page by slug – now includes contentType and episodeNumber
router.get('/:slug', async (req, res) => {
  try {
    const page = await DownloadPage.findOne({ slug: req.params.slug })
      .populate('animeId', 'title contentType'); // ✅ added contentType
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Public: get all pages for an anime
router.get('/anime/:animeId', async (req, res) => {
  try {
    const pages = await DownloadPage.find({ animeId: req.params.animeId })
      .sort('episodeNumber createdAt'); // sort by episode first
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: get all pages (protected) – now populates all needed fields
router.get('/', adminAuth, async (req, res) => {
  try {
    const pages = await DownloadPage.find()
      .populate('animeId', 'title contentType subDubStatus status releaseYear') // ✅ added all fields
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

    // Validate required fields
    if (!animeId || !slug || !episodeNumber || !links || links.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: animeId, slug, episodeNumber, and at least one link' });
    }

    // Check if slug already exists
    const existing = await DownloadPage.findOne({ slug });
    if (existing) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    // Validate anime exists
    const anime = await Anime.findById(animeId);
    if (!anime) {
      return res.status(400).json({ error: 'Anime not found' });
    }

    // Validate links array (max 10 links)
    if (links.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 links allowed' });
    }

    // Ensure each link has required fields
    for (const link of links) {
      if (!link.episode || !link.url) {
        return res.status(400).json({ error: 'Each link must have episode and url' });
      }
      // Optionally set default type if missing
      if (!link.type) link.type = 'download';
    }

    const page = new DownloadPage({
      animeId,
      slug,
      title: title || 'Download',
      episodeNumber,
      links
    });

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

    // If slug is being changed, check uniqueness
    if (slug && slug !== page.slug) {
      const existing = await DownloadPage.findOne({ slug });
      if (existing) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
      page.slug = slug;
    }

    if (title !== undefined) page.title = title;
    if (episodeNumber !== undefined) {
      if (episodeNumber < 1) return res.status(400).json({ error: 'episodeNumber must be at least 1' });
      page.episodeNumber = episodeNumber;
    }

    if (links) {
      if (links.length > 10) return res.status(400).json({ error: 'Maximum 10 links allowed' });
      // Validate each link
      for (const link of links) {
        if (!link.episode || !link.url) {
          return res.status(400).json({ error: 'Each link must have episode and url' });
        }
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

module.exports = router;