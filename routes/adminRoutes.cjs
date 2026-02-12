  // routes/adminRoutes.cjs - AD FREE VERSION
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');
const Episode = require('../models/Episode.cjs');
const Chapter = require('../models/Chapter.cjs');
const Report = require('../models/Report.cjs');
const SocialMedia = require('../models/SocialMedia.cjs');

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

// ✅ EPISODE MANAGEMENT ROUTES (UPDATED FOR MULTIPLE DOWNLOAD LINKS)

// Edit episode (UPDATED FOR MULTIPLE DOWNLOAD LINKS)
router.put('/edit-episode/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, downloadLinks, secureFileReference, session } = req.body;

    console.log('📝 Edit episode request:', {
      id,
      hasDownloadLinks: !!downloadLinks,
      downloadLinksCount: downloadLinks ? downloadLinks.length : 0
    });

    // ✅ Validate downloadLinks if provided
    if (downloadLinks !== undefined) {
      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) {
        return res.status(400).json({ error: 'At least one download link is required' });
      }

      if (downloadLinks.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 download links allowed' });
      }

      // Validate each download link
      for (let i = 0; i < downloadLinks.length; i++) {
        const link = downloadLinks[i];
        if (!link.name || !link.url) {
          return res.status(400).json({ 
            error: `Download link ${i + 1} must have both name and url` 
          });
        }
      }
    }

    const updateData = {};
    if (typeof title !== 'undefined') updateData.title = title;
    if (typeof secureFileReference !== 'undefined') updateData.secureFileReference = secureFileReference;
    if (typeof session !== 'undefined') updateData.session = session;
    
    // ✅ Handle downloadLinks update
    if (downloadLinks !== undefined) {
      updateData.downloadLinks = downloadLinks.map((link, index) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      }));
    }

    const episode = await Episode.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    // ✅ Update anime's lastContentAdded for homepage priority
    await Anime.updateLastContent(episode.animeId);

    res.json({ 
      success: true, 
      message: 'Episode updated successfully!', 
      episode 
    });
  } catch (err) {
    console.error('Edit episode error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW ROUTE: Edit chapter (FOR MULTIPLE DOWNLOAD LINKS)
router.put('/edit-chapter/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, downloadLinks, secureFileReference, session } = req.body;

    console.log('📝 Edit chapter request:', {
      id,
      hasDownloadLinks: !!downloadLinks,
      downloadLinksCount: downloadLinks ? downloadLinks.length : 0
    });

    // ✅ Validate downloadLinks if provided
    if (downloadLinks !== undefined) {
      if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) {
        return res.status(400).json({ error: 'At least one download link is required' });
      }

      if (downloadLinks.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 download links allowed' });
      }

      // Validate each download link
      for (let i = 0; i < downloadLinks.length; i++) {
        const link = downloadLinks[i];
        if (!link.name || !link.url) {
          return res.status(400).json({ 
            error: `Download link ${i + 1} must have both name and url` 
          });
        }
      }
    }

    const updateData = {};
    if (typeof title !== 'undefined') updateData.title = title;
    if (typeof secureFileReference !== 'undefined') updateData.secureFileReference = secureFileReference;
    if (typeof session !== 'undefined') updateData.session = session;
    
    // ✅ Handle downloadLinks update
    if (downloadLinks !== undefined) {
      updateData.downloadLinks = downloadLinks.map((link, index) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      }));
    }

    const chapter = await Chapter.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    // ✅ Update manga's lastContentAdded for homepage priority
    await Anime.updateLastContent(chapter.mangaId);

    res.json({ 
      success: true, 
      message: 'Chapter updated successfully!', 
      chapter 
    });
  } catch (err) {
    console.error('Edit chapter error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
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
      updateData.resolvedBy = req.admin.id;
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

// ✅ DELETE single report
router.delete('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting report with ID:', id);

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

// ✅ ANALYTICS ROUTE (SIMPLIFIED VERSION WITHOUT AD DATA)
router.get('/analytics', async (req, res) => {
  try {
    const totalAnimes = await Anime.countDocuments({ contentType: 'Anime' });
    const totalMovies = await Anime.countDocuments({ contentType: 'Movie' });
    const totalManga = await Anime.countDocuments({ contentType: 'Manga' });
    const totalEpisodes = await Episode.countDocuments();
    const totalChapters = await Chapter.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'Pending' });

    res.json({
      totalAnimes,
      totalMovies,
      totalManga,
      totalEpisodes,
      totalChapters,
      totalReports,
      pendingReports,
      // Basic stats without ad data
      todayUsers: 0,
      totalUsers: 0,
      todayEarnings: 0,
      totalEarnings: 0,
      todayPageViews: 0,
      totalPageViews: 0
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// ✅ GET user info
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

// ✅ NEW ROUTE: Get episode details for editing (including download links)
router.get('/episode/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const episode = await Episode.findById(id);
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    res.json({
      success: true,
      episode: {
        _id: episode._id,
        animeId: episode.animeId,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        session: episode.session,
        secureFileReference: episode.secureFileReference,
        downloadLinks: episode.downloadLinks || []
      }
    });
  } catch (err) {
    console.error('Get episode error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW ROUTE: Get chapter details for editing (including download links)
router.get('/chapter/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const chapter = await Chapter.findById(id);
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    res.json({
      success: true,
      chapter: {
        _id: chapter._id,
        mangaId: chapter.mangaId,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        session: chapter.session,
        secureFileReference: chapter.secureFileReference,
        downloadLinks: chapter.downloadLinks || []
      }
    });
  } catch (err) {
    console.error('Get chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;