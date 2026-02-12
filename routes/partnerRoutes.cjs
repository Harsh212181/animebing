// routes/partnerRoutes.cjs - CORRECTED IMPORT (no destructuring)
const express = require('express');
const Partner = require('../models/Partner.cjs');
const Anime = require('../models/Anime.cjs');
// ✅ FIXED: Import directly (not destructured) because adminAuth.cjs exports the function itself
const adminAuth = require('../middleware/adminAuth.cjs');

const router = express.Router();

/**
 * GET /api/partners
 * Fetch all partners with their current anime count
 */
router.get('/', adminAuth, async (req, res) => {
  try {
    const partners = await Partner.find().sort({ createdAt: -1 }).lean();
    
    // Attach anime count for each partner
    const partnersWithCount = await Promise.all(
      partners.map(async (partner) => {
        const count = await Anime.countDocuments({ partnerId: partner._id });
        return { ...partner, animeCount: count };
      })
    );

    res.json(partnersWithCount);
  } catch (err) {
    console.error('GET /partners error:', err);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

/**
 * POST /api/partners
 * Create a new partner
 * Body: { name: string }
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Partner name is required' });
    }

    const trimmedName = name.trim();

    // Check for duplicate
    const existing = await Partner.findOne({ name: trimmedName });
    if (existing) {
      return res.status(400).json({ error: 'Partner with this name already exists' });
    }

    const partner = new Partner({ name: trimmedName });
    await partner.save();

    res.status(201).json(partner);
  } catch (err) {
    console.error('POST /partners error:', err);
    res.status(500).json({ error: 'Failed to create partner' });
  }
});

/**
 * DELETE /api/partners/:id
 * Delete a partner and unlink all its anime (set partnerId to null)
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await Partner.findByIdAndDelete(id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Unlink all anime that were assigned to this partner
    await Anime.updateMany({ partnerId: id }, { partnerId: null });

    res.json({ message: 'Partner deleted successfully', partner });
  } catch (err) {
    console.error('DELETE /partners/:id error:', err);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

/**
 * GET /api/partners/:id/anime
 * Fetch all anime assigned to a specific partner
 */
router.get('/:id/anime', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await Partner.findById(id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const animeList = await Anime.find({ partnerId: id })
      .sort({ updatedAt: -1 })
      .lean();

    res.json(animeList);
  } catch (err) {
    console.error('GET /partners/:id/anime error:', err);
    res.status(500).json({ error: 'Failed to fetch partner anime' });
  }
});

/**
 * POST /api/partners/:id/anime
 * Assign an anime to this partner
 * Body: { animeId: string }
 */
router.post('/:id/anime', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { animeId } = req.body;

    if (!animeId) {
      return res.status(400).json({ error: 'animeId is required' });
    }

    // Verify partner exists
    const partner = await Partner.findById(id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Verify anime exists and update it
    const anime = await Anime.findByIdAndUpdate(
      animeId,
      { partnerId: id },
      { new: true, runValidators: true }
    );

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json(anime);
  } catch (err) {
    console.error('POST /partners/:id/anime error:', err);
    res.status(500).json({ error: 'Failed to assign anime to partner' });
  }
});

/**
 * DELETE /api/partners/:id/anime/:animeId
 * Remove an anime from this partner (set partnerId to null)
 */
router.delete('/:id/anime/:animeId', adminAuth, async (req, res) => {
  try {
    const { id, animeId } = req.params;

    // Verify partner exists (optional, but good)
    const partner = await Partner.findById(id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const anime = await Anime.findByIdAndUpdate(
      animeId,
      { partnerId: null },
      { new: true, runValidators: true }
    );

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json(anime);
  } catch (err) {
    console.error('DELETE /partners/:id/anime/:animeId error:', err);
    res.status(500).json({ error: 'Failed to remove anime from partner' });
  }
});

module.exports = router;