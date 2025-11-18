// routes/adRoutes.cjs - NEW FILE BANAYEIN
const express = require('express');
const router = express.Router();
const AdSlot = require('../models/AdSlot.cjs');

// GET all ad slots
router.get('/', async (req, res) => {
  try {
    const adSlots = await AdSlot.find();
    res.json(adSlots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE ad slot
router.put('/:id', async (req, res) => {
  try {
    const { adCode, isActive } = req.body;
    const adSlot = await AdSlot.findByIdAndUpdate(
      req.params.id,
      { adCode, isActive },
      { new: true }
    );
    res.json(adSlot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;