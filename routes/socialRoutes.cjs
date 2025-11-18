// routes/socialRoutes.cjs - NEW FILE
const express = require('express');
const router = express.Router();
const SocialMedia = require('../models/SocialMedia.cjs');

// GET /api/social - Public route to get active social links
router.get('/', async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find({ isActive: true });
    res.json(socialLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;