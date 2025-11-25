  // routes/episodeRoutes.cjs - VALIDATION COMPLETELY REMOVED
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

// POST /api/episodes -> ADD NEW EPISODE (NO VALIDATION)
router.post('/', async (req, res) => {
  try {
    const { animeId, title, episodeNumber, secureFileReference, cutyLink, session } = req.body;

    console.log('📥 ADD EPISODE REQUEST:', {
      animeId,
      title,
      episodeNumber,
      session,
      cutyLink
    });

    if (!animeId || typeof episodeNumber === 'undefined') {
      return res.status(400).json({ error: 'animeId and episodeNumber required' });
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
      cutyLink: cutyLink || '', // ✅ CUTYLINK KO EMPTY ALLOW KARO
      session: session || 1
    });

    console.log('💾 Saving episode to database...');
    await newEpisode.save();
    
    // ✅ YEH IMPORTANT LINE ADD KARO: Anime ko update karo for homepage sorting
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
    res.status(500).json({ error: error.message });
  }
});

// GET /api/episodes/:animeId -> all episodes for anime
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
    
    res.json(episodes || []);
    
  } catch (error) {
    console.error('❌ Error fetching episodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/episodes -> UPDATE EPISODE (NO VALIDATION)
router.patch('/', async (req, res) => {
  try {
    const { animeId, episodeNumber, title, secureFileReference, cutyLink, session } = req.body;
    
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
    if (typeof cutyLink !== 'undefined') update.cutyLink = cutyLink; // ✅ NO VALIDATION
    if (typeof session !== 'undefined') update.session = session;

    const updated = await Episode.findOneAndUpdate(query, { $set: update }, { new: true });
    
    if (!updated) return res.status(404).json({ error: 'Episode not found' });
    
    // ✅ YEH BHI ADD KARO: Anime update karo jab episode modify ho
    await Anime.updateLastContent(animeId);
    
    res.json({ 
      message: '✅ Episode updated successfully! This anime will now appear first on homepage.', 
      episode: updated
    });
  } catch (error) {
    console.error('Error updating episode:', error);
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

module.exports = router;
