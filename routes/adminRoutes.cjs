 // routes/adminRoutes.cjs - MERGED VERSION WITH FIXED REPORTS ROUTE
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');
const Episode = require('../models/Episode.cjs');
const Chapter = require('../models/Chapter.cjs');
const Report = require('../models/Report.cjs');
const SocialMedia = require('../models/SocialMedia.cjs');
const AdSlot = require('../models/AdSlot.cjs');
const Analytics = require('../models/Analytics.cjs');

// ✅ GET filtered anime list with content type
router.get('/anime-list', async (req, res) => {
  try {
    const { status, contentType } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;
    if (contentType && contentType !== 'All') query.contentType = contentType;
    
    const animes = await Anime.find(query).populate('episodes').sort({ createdAt: -1 });
    res.json(animes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADD anime/movie
router.post('/add-anime', async (req, res) => {
  try {
    const { title, description, thumbnail, status, subDubStatus, genreList, releaseYear, contentType } = req.body;
    
    const existing = await Anime.findOne({ title });
    if (existing) return res.status(400).json({ error: 'Anime/Movie already exists' });

    const anime = new Anime({ 
      title, 
      description, 
      thumbnail, 
      status: status || 'Ongoing',
      subDubStatus, 
      genreList, 
      releaseYear,
      contentType: contentType || 'Anime'
    });
    
    await anime.save();
    res.json({ success: true, message: `${contentType || 'Anime'} added!`, anime });
  } catch (err) {
    console.error('Add anime error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ EDIT anime/movie
router.put('/edit-anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const anime = await Anime.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!anime) return res.status(404).json({ error: 'Anime/Movie not found' });
    
    res.json({ success: true, message: 'Updated successfully!', anime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE anime/movie
router.delete('/delete-anime', async (req, res) => {
  try {
    const { id } = req.body;
    await Anime.findByIdAndDelete(id);
    // Also delete associated episodes and reports
    await Episode.deleteMany({ animeId: id });
    await Report.deleteMany({ animeId: id });
    res.json({ success: true, message: 'Deleted successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ EPISODE MANAGEMENT ROUTES

// Edit episode
router.put('/edit-episode/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, cutyLink, secureFileReference, session } = req.body; // ✅ SESSION ADD KARO

    const episode = await Episode.findByIdAndUpdate(
      id,
      { title, cutyLink, secureFileReference, session }, // ✅ SESSION ADD KARO
      { new: true }
    );

    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    res.json({ success: true, message: 'Episode updated!', episode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ REPORT MANAGEMENT ROUTES

// Get all reports
router.get('/reports', async (req, res) => {
  try {
    console.log('📋 Admin fetching reports...');
    
    const reports = await Report.find()
      .populate('animeId', 'title thumbnail')
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${reports.length} reports for admin`);
    
    res.json(reports);
  } catch (err) {
    console.error('❌ Admin reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update report status with response - FIXED VERSION
router.put('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    const updateData = {
      status,
      ...(adminResponse && {
        adminResponse,
        responseDate: new Date()
      })
    };

    // ✅ FIXED: Server automatically sets resolvedBy from admin token
    if (status === 'Fixed') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.admin.id; // This comes from adminAuth middleware
    }

    const report = await Report.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('resolvedBy', 'username');

    res.json({ 
      success: true, 
      message: 'Report updated successfully!', 
      report 
    });
  } catch (err) {
    console.error('Report update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE single report - ADD THIS ROUTE
router.delete('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting report with ID:', id);

    // First check if report exists
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await Report.findByIdAndDelete(id);
    
    console.log('✅ Report deleted successfully');
    res.json({ 
      success: true, 
      message: 'Report deleted successfully!' 
    });
  } catch (err) {
    console.error('❌ Delete report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ BULK DELETE reports
router.post('/reports/bulk-delete', async (req, res) => {
  try {
    const { reportIds } = req.body;
    await Report.deleteMany({ _id: { $in: reportIds } });
    res.json({ 
      success: true, 
      message: `${reportIds.length} reports deleted successfully!` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ SOCIAL MEDIA MANAGEMENT ROUTES

// Get social media links
router.get('/social-media', async (req, res) => {
  try {
    const socialLinks = await SocialMedia.find();
    res.json(socialLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update social media link
router.put('/social-media/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { url, isActive } = req.body;
    
    const socialLink = await SocialMedia.findOneAndUpdate(
      { platform },
      { url, isActive },
      { new: true, upsert: true }
    );
    
    res.json(socialLink);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ EXISTING AD & ANALYTICS ROUTES (keep as is)
router.get('/ad-slots', async (req, res) => {
  try {
    const adSlots = await AdSlot.find();
    res.json(adSlots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/ad-slots/:id', async (req, res) => {
  try {
    const { adCode, isActive } = req.body;
    const adSlot = await AdSlot.findByIdAndUpdate(
      req.params.id,
      { adCode, isActive },
      { new: true }
    );
    res.json(adSlot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const totalAnimes = await Anime.countDocuments({ contentType: 'Anime' });
    const totalMovies = await Anime.countDocuments({ contentType: 'Movie' });
    const totalManga = await Anime.countDocuments({ contentType: 'Manga' });
    const totalEpisodes = await Episode.countDocuments();
    const totalChapters = await Chapter.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'Pending' });

    // ✅ FIX: Get today's date properly
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await Analytics.findOne({ 
      date: { 
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // ✅ FIX: Proper aggregation with error handling
    let allTimeStats;
    try {
      allTimeStats = await Analytics.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: '$uniqueVisitors' },
            totalPageViews: { $sum: '$pageViews' },
            totalEarnings: { $sum: '$earnings' }
          }
        }
      ]);
    } catch (aggError) {
      console.log('Using fallback for analytics aggregation');
      allTimeStats = [];
    }

    const totals = allTimeStats.length > 0 ? allTimeStats[0] : {
      totalUsers: 0,
      totalPageViews: 0,
      totalEarnings: 0
    };

    res.json({
      totalAnimes,
      totalMovies,
      totalManga,
      totalEpisodes,
      totalChapters,
      totalReports,
      pendingReports,
      todayUsers: todayStats ? todayStats.uniqueVisitors : 0,
      totalUsers: totals.totalUsers || 0,
      todayEarnings: todayStats ? todayStats.earnings : 0,
      totalEarnings: totals.totalEarnings || 0,
      todayPageViews: todayStats ? todayStats.pageViews : 0,
      totalPageViews: totals.totalPageViews || 0,
      adPerformance: {
        totalImpressions: 0,
        totalClicks: 0,
        totalRevenue: 0,
        ctr: 0
      },
      weeklyStats: [],
      deviceStats: { desktop: 60, mobile: 35, tablet: 5 },
      browserStats: { Chrome: 70, Firefox: 15, Safari: 10, Edge: 4, Unknown: 1 }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

router.get('/user-info', async (req, res) => {
  try {
    const Admin = require('../models/Admin.cjs');
    const admin = await Admin.findById(req.admin.id);
    res.json({
      username: admin.username,
      email: admin.email
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;