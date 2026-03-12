 // routes/downloadPageRoutes.cjs - ADD GET ALL PAGES ROUTE
const express = require('express');
const router = express.Router();
const DownloadPage = require('../models/DownloadPage.cjs');
const adminAuth = require('../middleware/adminAuth.cjs');

// ✅ Public: get a page by slug
router.get('/:slug', async (req, res) => {
  try {
    const page = await DownloadPage.findOne({ slug: req.params.slug }).populate('animeId', 'title');
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Public: get all pages for an anime
router.get('/anime/:animeId', async (req, res) => {
  try {
    const pages = await DownloadPage.find({ animeId: req.params.animeId }).sort('createdAt');
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: get all pages (protected)
router.get('/', adminAuth, async (req, res) => {
  try {
    const pages = await DownloadPage.find().populate('animeId', 'title');
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: create a page
router.post('/', adminAuth, async (req, res) => {
  try {
    const { animeId, slug, title, links } = req.body;
    const page = new DownloadPage({ animeId, slug, title, links });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: update a page
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const page = await DownloadPage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!page) return res.status(404).json({ error: 'Page not found' });
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