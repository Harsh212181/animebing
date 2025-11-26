 // routes/contactRoutes.cjs - FIXED VERSION
const express = require('express');
const router = express.Router();
const Report = require('../models/Report.cjs');

// Contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    console.log('📧 CONTACT FORM SUBMISSION:', { name, email, subject, message });

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    // Create new contact report
    const newReport = new Report({
      name,
      email,
      subject,
      message,
      type: 'contact',
      username: name,
      userIP: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    await newReport.save();

    console.log('✅ Contact report saved with ID:', newReport._id);

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      reportId: newReport._id
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again.'
    });
  }
});

module.exports = router;