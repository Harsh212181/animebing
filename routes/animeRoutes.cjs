 // routes/animeRoutes.cjs - OPTIMIZED VERSION
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');

/**
 * ✅ OPTIMIZED: GET anime with PAGINATION
 * Returns paginated anime from DB sorted by LATEST UPDATE
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;

    // ✅ OPTIMIZED: Only get necessary fields for listing
    const anime = await Anime.find()
      .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Faster response

    const total = await Anime.countDocuments();

    // ✅ OPTIMIZED: Set cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Total-Count': total,
      'X-Page': page,
      'X-Limit': limit
    });

    res.json({ 
      success: true, 
      data: anime,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (err) {
    console.error('Error fetching anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ OPTIMIZED: SEARCH anime with PAGINATION
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;

    const found = await Anime.find({
      title: { $regex: q, $options: 'i' }
    })
    .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const total = await Anime.countDocuments({
      title: { $regex: q, $options: 'i' }
    });

    res.set({
      'Cache-Control': 'public, max-age=300',
      'X-Total-Count': total
    });

    res.json({ 
      success: true, 
      data: found,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (err) {
    console.error('Error searching anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ GET single anime by ID (Unchanged)
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
