 // routes/appDownloadRoutes.cjs
const express = require('express');
const router = express.Router();
const AppDownload = require('../models/AppDownload.cjs');

// GET /api/app-downloads - Public route
router.get('/', async (req, res) => {
  try {
    const appLinks = await AppDownload.find({ isActive: true });
    res.json(appLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;