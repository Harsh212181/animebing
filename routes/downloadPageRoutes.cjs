 // routes/downloadPageRoutes.cjs
const express = require('express');
const router = express.Router();
const DownloadPage = require('../models/DownloadPage.cjs');
const Anime = require('../models/Anime.cjs');
const adminAuth = require('../middleware/adminAuth.cjs');
const DownloadSession = require('../models/DownloadSession.cjs'); // ✅ added for session check

// ============================================
// ✅ DOWNLOAD AUTH MIDDLEWARE (specific to this router)
// ============================================
async function downloadAuthBySlug(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { slug } = req.params; // the download page slug

    // Find the download page by slug to get the animeId
    const downloadPage = await DownloadPage.findOne({ slug }).select('animeId');
    if (!downloadPage) {
      return res.status(404).json({ error: 'Download page not found' });
    }
    const animeId = downloadPage.animeId;

    // Check for a valid session
    const session = await DownloadSession.findOne({
      ip,
      userAgent,
      animeId,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(403).json({ error: 'Access expired or invalid' });
    }

    // Attach the download page to the request so we don't fetch it again
    req.downloadPage = downloadPage;
    next();
  } catch (error) {
    console.error('Download auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================
// ✅ PROTECTED DOWNLOAD PAGE ROUTE
// ============================================
router.get('/:slug', downloadAuthBySlug, async (req, res) => {
  try {
    // We already have the download page in req.downloadPage, but it only has animeId.
    // Fetch full page with populated anime details.
    const fullPage = await DownloadPage.findOne({ slug: req.params.slug })
      .populate('animeId', 'title contentType');

    res.json(fullPage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ OTHER EXISTING ROUTES (unchanged)
// ============================================

// ✅ Public: get all pages for an anime (still public? might need protection too, but keeping as is)
router.get('/anime/:animeId', async (req, res) => {
  try {
    const pages = await DownloadPage.find({ animeId: req.params.animeId })
      .sort('episodeNumber createdAt');
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: get all pages (protected)
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
    if (existing) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const anime = await Anime.findById(animeId);
    if (!anime) {
      return res.status(400).json({ error: 'Anime not found' });
    }

    if (links.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 links allowed' });
    }

    for (const link of links) {
      if (!link.episode || !link.url) {
        return res.status(400).json({ error: 'Each link must have episode and url' });
      }
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