 // routes/reportRoutes.cjs - FINAL VERSION
const express = require('express');
const router = express.Router();
const Report = require('../models/Report.cjs');

// POST /api/reports - Create new episode report
router.post('/', async (req, res) => {
  try {
    console.log('📝 EPISODE REPORT SUBMISSION RECEIVED');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    
    const { animeId, episodeId, episodeNumber, issueType, description, email, username } = req.body;

    // Validation
    if (!issueType) {
      return res.status(400).json({
        success: false,
        error: 'Issue type is required'
      });
    }

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Description must be at least 10 characters'
      });
    }

    // Create report data with BOTH fields for compatibility
    const reportData = {
      // Episode specific fields
      animeId: animeId || null,
      episodeId: episodeId || null, 
      episodeNumber: episodeNumber || null,
      issueType,
      description: description.trim(),
      message: description.trim(), // ✅ ADD THIS LINE - Same as description
      
      // Common fields
      email: email || 'Not provided',
      username: username || 'Anonymous',
      type: 'episode',
      userIP: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    console.log('📋 Final Report Data:', reportData);

    const newReport = new Report(reportData);
    await newReport.save();
    
    console.log('✅ Episode report saved successfully! ID:', newReport._id);

    res.json({
      success: true,
      message: 'Report submitted successfully! We will fix the issue soon.',
      reportId: newReport._id
    });

  } catch (error) {
    console.error('❌ EPISODE REPORT ERROR:', error);
    console.error('📛 Error Name:', error.name);
    console.error('📛 Error Message:', error.message);
    
    // Better error handling
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed: ' + errors.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

// GET /api/reports - Get all reports (for admin)
router.get('/', async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('animeId', 'title thumbnail')
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 });
    
    console.log('📋 Total reports in DB:', reports.length);
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reports by user email
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const reports = await Report.find({ email })
      .populate('animeId', 'title thumbnail')
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    console.error('Get user reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
