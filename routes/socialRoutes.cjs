 // routes/socialRoutes.cjs - UPDATED WITH ADMIN ROUTES
const express = require('express');
const router = express.Router();
const SocialMedia = require('../models/SocialMedia.cjs');

// ✅ PUBLIC: Get active social links
router.get('/', async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find({ isActive: true });
    res.json(socialLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADMIN: Get ALL social links (active + inactive)
router.get('/admin/all', async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find().sort({ platform: 1 });
    res.json(socialLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADMIN: Update social link by platform
router.put('/admin/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { url, isActive } = req.body;
    
    // Validate URL format
    if (url && !url.startsWith('http')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }
    
    const updatedLink = await SocialMedia.findOneAndUpdate(
      { platform },
      { 
        url,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: Date.now()
      },
      { new: true, upsert: true } // Create if doesn't exist
    );
    
    res.json({ 
      success: true, 
      message: 'Social link updated successfully',
      data: updatedLink 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
