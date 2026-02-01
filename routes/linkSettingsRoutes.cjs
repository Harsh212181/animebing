 const express = require('express');
const router = express.Router();
const LinkSettings = require('../models/LinkSettings.cjs');

// ✅ GET all link settings (Public)
router.get('/', async (req, res) => {
  try {
    console.log('📡 GET /api/link-settings called');
    const settings = await LinkSettings.getSettings();
    console.log('✅ Settings found:', settings);
    res.json(settings);
  } catch (error) {
    console.error('❌ Error fetching link settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch link settings',
      details: error.message 
    });
  }
});

// ✅ UPDATE all link settings (Admin)
router.put('/', async (req, res) => {
  try {
    console.log('📡 PUT /api/link-settings called with:', req.body);
    const { link1, link2, link3, link4, link5 } = req.body;
    
    // Validate input
    const updates = {};
    if (link1 !== undefined) updates.link1 = Boolean(link1);
    if (link2 !== undefined) updates.link2 = Boolean(link2);
    if (link3 !== undefined) updates.link3 = Boolean(link3);
    if (link4 !== undefined) updates.link4 = Boolean(link4);
    if (link5 !== undefined) updates.link5 = Boolean(link5);
    
    const settings = await LinkSettings.updateSettings(updates);
    
    console.log('✅ Settings updated:', settings);
    res.json({
      success: true,
      message: 'Link settings updated successfully',
      settings: settings
    });
  } catch (error) {
    console.error('❌ Error updating link settings:', error);
    res.status(500).json({ 
      error: 'Failed to update link settings',
      details: error.message 
    });
  }
});

// ✅ TOGGLE specific link (Admin) - CRITICAL for your AdminDashboard
router.put('/toggle/:linkNumber', async (req, res) => {
  try {
    const linkNumber = parseInt(req.params.linkNumber);
    console.log(`📡 PUT /api/link-settings/toggle/${linkNumber} called`);
    
    if (linkNumber < 1 || linkNumber > 5) {
      return res.status(400).json({ error: 'Link number must be between 1 and 5' });
    }
    
    const settings = await LinkSettings.getSettings();
    
    // Toggle the specific link
    const linkKey = `link${linkNumber}`;
    settings[linkKey] = !settings[linkKey];
    settings.lastUpdated = Date.now();
    
    await settings.save();
    
    console.log(`✅ Link ${linkNumber} toggled to:`, settings[linkKey]);
    res.json({
      success: true,
      message: `Link ${linkNumber} ${settings[linkKey] ? 'activated' : 'deactivated'}`,
      settings: settings,
      toggledLink: {
        number: linkNumber,
        status: settings[linkKey],
        key: linkKey
      }
    });
  } catch (error) {
    console.error('❌ Error toggling link:', error);
    res.status(500).json({ 
      error: 'Failed to toggle link',
      details: error.message 
    });
  }
});

// ✅ GET active links status (Public)
router.get('/status', async (req, res) => {
  try {
    console.log('📡 GET /api/link-settings/status called');
    const settings = await LinkSettings.getSettings();
    const activeLinks = settings.getActiveLinks();
    
    res.json({
      totalLinks: 5,
      activeLinks: activeLinks,
      activeCount: activeLinks.length,
      settings: {
        link1: settings.link1,
        link2: settings.link2,
        link3: settings.link3,
        link4: settings.link4,
        link5: settings.link5
      },
      lastUpdated: settings.lastUpdated
    });
  } catch (error) {
    console.error('❌ Error fetching link status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch link status',
      details: error.message 
    });
  }
});

// ✅ GET active links only (Public - for DownloadRedirectPage)
router.get('/active', async (req, res) => {
  try {
    console.log('📡 GET /api/link-settings/active called');
    const settings = await LinkSettings.getSettings();
    const activeLinks = settings.getActiveLinks();
    
    res.json({ 
      activeLinks: activeLinks,
      activeCount: activeLinks.length
    });
  } catch (error) {
    console.error('❌ Error fetching active links:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active links',
      details: error.message 
    });
  }
});

// ✅ Health check (Public)
router.get('/health', async (req, res) => {
  try {
    const settings = await LinkSettings.findOne();
    const exists = !!settings;
    
    res.json({
      status: 'healthy',
      database: exists ? 'connected' : 'missing',
      message: exists ? 'Link settings system is operational' : 'No link settings found, using defaults'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ✅ Initialize default settings (Admin - one-time use)
router.post('/init', async (req, res) => {
  try {
    console.log('📡 POST /api/link-settings/init called');
    const existing = await LinkSettings.findOne();
    
    if (!existing) {
      const settings = await LinkSettings.create({
        link1: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true
      });
      
      console.log('✅ Default settings created');
      res.json({
        success: true,
        message: 'Default link settings created',
        settings: settings
      });
    } else {
      res.json({
        success: false,
        message: 'Link settings already exist',
        settings: existing
      });
    }
  } catch (error) {
    console.error('❌ Error initializing link settings:', error);
    res.status(500).json({ 
      error: 'Failed to initialize link settings',
      details: error.message 
    });
  }
});

// ✅ Emergency reset to defaults (Admin)
router.post('/reset', async (req, res) => {
  try {
    console.log('📡 POST /api/link-settings/reset called');
    
    await LinkSettings.deleteMany({});
    
    const settings = await LinkSettings.create({
      link1: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true
    });
    
    console.log('✅ Settings reset to defaults');
    res.json({
      success: true,
      message: 'Link settings reset to defaults',
      settings: settings
    });
  } catch (error) {
    console.error('❌ Error resetting link settings:', error);
    res.status(500).json({ 
      error: 'Failed to reset link settings',
      details: error.message 
    });
  }
});

console.log('✅ LinkSettings routes loaded');
module.exports = router;