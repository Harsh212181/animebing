 // routes/reportRoutes.cjs - EMERGENCY DEBUG VERSION MERGED
const express = require('express');
const router = express.Router();
const Report = require('../models/Report.cjs');

// POST /api/reports - Create new report - EMERGENCY DEBUG VERSION
router.post('/', async (req, res) => {
  try {
    console.log('🚨 REPORT SUBMISSION RECEIVED - DEBUG MODE');
    console.log('📦 Full Request Body:', JSON.stringify(req.body, null, 2));
    console.log('👤 Headers:', req.headers);
    console.log('🌐 IP:', req.ip);
    
    const { animeId, episodeId, episodeNumber, issueType, description, email, username } = req.body;

    // ✅ TEMPORARY: Remove all validations for testing
    console.log('✅ Bypassing all validations for testing...');

    // ✅ TEMPORARY: Create report without validation
    const newReport = new Report({
      animeId: animeId || '657a1b2e3f4c5d6e7f8a9b0c', // Fallback ID
      episodeId: episodeId || null,
      episodeNumber: episodeNumber || 1,
      issueType: issueType || 'Link Not Working',
      description: description || 'Test description',
      email: email || 'test@example.com',
      username: username || 'TestUser',
      userIP: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Debug'
    });

    console.log('📝 Report object created:', newReport);

    // Save to database
    await newReport.save();
    
    console.log('💾 Report saved successfully with ID:', newReport._id);

    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      message: '✅ DEBUG: Report submitted successfully!',
      reportId: newReport._id,
      debug: {
        animeIdReceived: animeId,
        episodeNumberReceived: episodeNumber,
        descriptionLength: description ? description.length : 0
      }
    });

  } catch (error) {
    console.error('❌ REPORT ERROR DETAILS:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    // ✅ MORE DETAILED ERROR RESPONSE
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
      debug: {
        errorName: error.name,
        errorMessage: error.message
      }
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

// ✅ NEW: Get reports by user email
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