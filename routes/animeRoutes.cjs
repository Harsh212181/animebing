  // routes/animeRoutes.cjs
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');

/**
 * ✅ GET all anime
 * Returns all anime from DB sorted by LATEST UPDATE
 */
router.get('/', async (req, res) => {
  try {
    // ✅ YEH LINE UPDATE KARO: Sort by updatedAt descending (newest first)
    const all = await Anime.find().populate('episodes').sort({ updatedAt: -1 });
    res.json({ success: true, data: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ SEARCH anime by title
 * Example: /api/anime/search?query=Naruto
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.query || '';
    const found = await Anime.find({
      title: { $regex: q, $options: 'i' }
    }).populate('episodes').sort({ updatedAt: -1 }); // ✅ YEH BHI UPDATE KARO
    res.json({ success: true, data: found });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ GET single anime by ID
 * Example: /api/anime/654dbe9287a4e1f2c1234abc
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await Anime.findById(req.params.id).populate('episodes');
    if (!item) return res.status(404).json({ success: false, message: 'Anime not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
