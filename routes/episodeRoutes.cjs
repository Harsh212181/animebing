 // routes/episodeRoutes.cjs - COMPLETELY FIXED VERSION
const express = require('express');
const router = express.Router();
const Episode = require('../models/Episode.cjs');
const Anime = require('../models/Anime.cjs');

// DELETE ALL EPISODES
router.delete('/all', async (req, res) => {
  try {
    console.log('🗑️ Deleting ALL episodes...');
    const result = await Episode.deleteMany({});
    console.log('✅ All episodes deleted:', result.deletedCount);
    res.json({
      message: `All episodes deleted (${result.deletedCount} episodes)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Error deleting all episodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/episodes -> List all episodes (public)
router.get('/', async (req, res) => {
  try {
    const episodes = await Episode.find().sort({ session: 1, episodeNumber: 1 });
    res.json(episodes);
  } catch (error) {
    console.error('Error fetching all episodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/episodes -> ADD NEW EPISODE (WITH MULTIPLE DOWNLOAD LINKS AND MAIN LINK)
router.post('/', async (req, res) => {
  try {
    const { animeId, title, episodeNumber, secureFileReference, mainLink, downloadLinks, session } = req.body;

    console.log('📥 ADD EPISODE REQUEST:', {
      animeId,
      title,
      episodeNumber,
      session,
      mainLink, // ✅ Debug log
      downloadLinksCount: downloadLinks ? downloadLinks.length : 0
    });

    if (!animeId || typeof episodeNumber === 'undefined') {
      return res.status(400).json({ error: 'animeId and episodeNumber required' });
    }

    // ✅ Validate downloadLinks array
    if (!downloadLinks || !Array.isArray(downloadLinks) || downloadLinks.length === 0) {
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

    // Check if anime exists
    const anime = await Anime.findById(animeId);
    if (!anime) {
      console.log('❌ Anime not found with ID:', animeId);
      return res.status(404).json({ error: 'Anime not found' });
    }
    console.log('✅ Anime found:', anime.title);

    // Check if episode number exists in the same session only
    const existing = await Episode.findOne({
      animeId,
      episodeNumber: Number(episodeNumber),
      session: session || 1
    });
    
    if (existing) {
      return res.status(409).json({
        error: `Episode ${episodeNumber} already exists in Session ${session || 1}`
      });
    }

    const newEpisode = new Episode({
      animeId,
      title: title || `Episode ${episodeNumber}`,
      episodeNumber: Number(episodeNumber),
      secureFileReference: secureFileReference || null,
      // ✅ FIXED: mainLink को हमेशा include करें
      mainLink: mainLink || '',
      downloadLinks: downloadLinks.map((link, index) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      })),
      session: session || 1
    });

    console.log('💾 Saving episode to database with mainLink:', newEpisode.mainLink); // ✅ Debug
    
    await newEpisode.save();
    
    // ✅ Anime ko update karo for homepage sorting
    await Anime.updateLastContent(animeId);
    
    console.log('✅ Episode saved with ID:', newEpisode._id);
    console.log('🔄 Anime lastContentAdded updated for homepage priority');

    res.json({
      message: 'Episode added successfully! This anime will now appear first on homepage.',
      episode: newEpisode,
      animeTitle: anime.title
    });
  } catch (error) {
    console.error('❌ Error adding episode:', error);
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/episodes/:animeId -> all episodes for anime - FIXED VERSION
router.get('/:animeId', async (req, res) => {
  try {
    console.log('📥 Fetching episodes for anime:', req.params.animeId);
    
    if (!req.params.animeId || req.params.animeId === 'undefined') {
      return res.status(400).json({ error: 'Invalid anime ID' });
    }

    const episodes = await Episode.find({ animeId: req.params.animeId })
      .sort({ session: 1, episodeNumber: 1 })
      .lean();
    
    console.log('✅ Found episodes:', episodes.length);
    
    // ✅ CRITICAL FIX: Force add mainLink field to every episode
    const fixedEpisodes = episodes.map(episode => {
      // Create new object with guaranteed mainLink field
      const fixedEpisode = {
        _id: episode._id,
        animeId: episode.animeId,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        session: episode.session || 1,
        downloadLinks: episode.downloadLinks || [],
        secureFileReference: episode.secureFileReference,
        createdAt: episode.createdAt,
        updatedAt: episode.updatedAt,
        __v: episode.__v || 0,
        // ✅ Always include mainLink field (even if it doesn't exist in database)
        mainLink: episode.mainLink !== undefined && episode.mainLink !== null 
          ? episode.mainLink 
          : ''
      };
      
      return fixedEpisode;
    });
    
    // ✅ Debug: Check mainLink in first episode
    if (fixedEpisodes.length > 0) {
      console.log('🔍 First episode after fix:', {
        title: fixedEpisodes[0].title,
        mainLink: fixedEpisodes[0].mainLink,
        type: typeof fixedEpisodes[0].mainLink,
        hasMainLink: fixedEpisodes[0].hasOwnProperty('mainLink'),
        allFields: Object.keys(fixedEpisodes[0])
      });
      
      // Show all episodes data for debugging
      console.log('📊 All episodes data:', JSON.stringify(fixedEpisodes, null, 2));
    }
    
    res.json(fixedEpisodes || []);
    
  } catch (error) {
    console.error('❌ Error fetching episodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/episodes -> UPDATE EPISODE (WITH MULTIPLE DOWNLOAD LINKS AND MAIN LINK) - FIXED
router.patch('/', async (req, res) => {
  try {
    const { animeId, episodeNumber, title, secureFileReference, mainLink, downloadLinks, session } = req.body;
    
    console.log('📥 PATCH EPISODE REQUEST - mainLink value:', mainLink); // ✅ Debug
    
    if (!animeId || typeof episodeNumber === 'undefined') {
      return res.status(400).json({ error: 'animeId and episodeNumber are required' });
    }
    
    const query = {
      animeId,
      episodeNumber: Number(episodeNumber),
      session: session || 1
    };
    
    // Find anime
    const anime = await Anime.findById(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    const update = {};
    if (typeof title !== 'undefined') update.title = title;
    if (typeof secureFileReference !== 'undefined') update.secureFileReference = secureFileReference;
    if (typeof session !== 'undefined') update.session = session;
    
    // ✅ CRITICAL FIX: mainLink को हमेशा update करें
    // Frontend से mainLink हमेशा आता है (empty string भी)
    update.mainLink = mainLink || '';
    
    // ✅ Handle downloadLinks update if provided
    if (downloadLinks) {
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
      
      update.downloadLinks = downloadLinks.map((link, index) => ({
        name: link.name || `Download Link ${index + 1}`,
        url: link.url,
        quality: link.quality || '',
        type: link.type || 'direct'
      }));
    }

    console.log('📤 UPDATE DATA:', update); // ✅ Debug
    
    const updated = await Episode.findOneAndUpdate(
      query, 
      { $set: update }, 
      { 
        new: true, 
        runValidators: true, // ✅ Validators run करें
        upsert: false 
      }
    );
    
    if (!updated) return res.status(404).json({ error: 'Episode not found' });
    
    console.log('✅ Episode updated with mainLink:', updated.mainLink); // ✅ Debug
    
    // ✅ Anime update karo jab episode modify ho
    await Anime.updateLastContent(animeId);
    
    res.json({ 
      message: '✅ Episode updated successfully! This anime will now appear first on homepage.', 
      episode: updated
    });
  } catch (error) {
    console.error('❌ Error updating episode:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/episodes -> delete episode by animeId + episodeNumber + session
router.delete('/', async (req, res) => {
  try {
    const { animeId, episodeNumber, session } = req.body;
    
    console.log('🗑️ DELETE REQUEST:', { animeId, episodeNumber, session });
    
    if (!animeId || typeof episodeNumber === 'undefined' || typeof session === 'undefined') {
      return res.status(400).json({ error: 'animeId, episodeNumber, and session required' });
    }
    
    const removed = await Episode.findOneAndDelete({
      animeId,
      episodeNumber: Number(episodeNumber),
      session: Number(session)
    });
    
    if (!removed) {
      console.log('❌ Episode not found for deletion');
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // ✅ DELETE KE BAAD BHI ANIME UPDATE KARO
    await Anime.updateLastContent(animeId);
    
    console.log('✅ Episode deleted successfully');
    res.json({ message: 'Episode deleted' });
  } catch (error) {
    console.error('❌ Error deleting episode:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ FIXED ROUTE: Get download links for a specific episode (WITHOUT optional param in middle)
router.get('/download/:animeId/:episodeNumber', async (req, res) => {
  try {
    const { animeId, episodeNumber } = req.params;
    const { session = 1 } = req.query;
    
    console.log('📥 DOWNLOAD REQUEST:', { animeId, episodeNumber, session });
    
    const episode = await Episode.findOne({
      animeId,
      episodeNumber: Number(episodeNumber),
      session: Number(session) || 1
    });
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    res.json({
      animeId: episode.animeId,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
      session: episode.session,
      downloadLinks: episode.downloadLinks
    });
  } catch (error) {
    console.error('❌ Error fetching download links:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;