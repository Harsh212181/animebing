  // routes/socialRoutes.cjs - CORRECTED VERSION
const express = require('express');
const router = express.Router();
const SocialMedia = require('../models/SocialMedia.cjs');
const adminAuth = require('../middleware/adminAuth.cjs'); // Add admin auth middleware

// ✅ PUBLIC: Get active social links (only for footer)
router.get('/', async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find({ isActive: true });
    res.json(socialLinks);
  } catch (err) {
    console.error('Error fetching social links:', err);
    res.status(500).json({ error: 'Failed to fetch social links' });
  }
});

// ✅ ADMIN: Get ALL social links (admin protected)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find().sort({ platform: 1 });
    res.json(socialLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADMIN: Update social link by platform (admin protected)
router.put('/admin/:platform', adminAuth, async (req, res) => {
  try {
    const { platform } = req.params;
    const { url, isActive } = req.body;
    
    // Validate platform
    const allowedPlatforms = ['facebook', 'instagram', 'telegram'];
    if (!allowedPlatforms.includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform. Only facebook, instagram, telegram are allowed.' 
      });
    }
    
    // Validate URL format
    if (url && !/^https?:\/\//.test(url)) {
      return res.status(400).json({ 
        error: 'URL must start with http:// or https://' 
      });
    }
    
    // Update or create the social media link
    const updatedLink = await SocialMedia.findOneAndUpdate(
      { platform },
      { 
        url: url.trim(),
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: Date.now()
      },
      { 
        new: true, 
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
    
    res.json({ 
      success: true, 
      message: 'Social link updated successfully',
      data: updatedLink 
    });
  } catch (err) {
    console.error('Error updating social link:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADMIN: Reset to default links (admin protected)
router.post('/admin/reset-defaults', adminAuth, async (req, res) => {
  try {
    await SocialMedia.deleteMany({});
    await SocialMedia.initDefaultLinks();
    
    const links = await SocialMedia.find();
    res.json({
      success: true,
      message: 'Reset to default social links',
      data: links
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
