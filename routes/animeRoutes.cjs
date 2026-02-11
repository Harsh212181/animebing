// routes/animeRoutes.cjs - UPDATED WITH LIKE/DISLIKE SYSTEM & SEO SUPPORT
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');

// ✅ CRITICAL FIX: STATIC ROUTES MUST COME BEFORE DYNAMIC ROUTES

/**
 * ✅ ADDED: FEATURED ANIME ROUTE 
 * This must be added BEFORE the /:id route
 */
router.get('/featured', async (req, res) => {
  try {
    // ✅ Get featured anime - using featured field from schema
    const featuredAnime = await Anime.find({ 
      featured: true 
    })
    .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt bannerImage rating slug seoTitle likes dislikes monthlyLikes weeklyLikes') // ✅ Added like fields
    .sort({ featuredOrder: -1, createdAt: -1 }) // ✅ Added featuredOrder for manual ordering
    .limit(10)
    .lean();

    // ✅ Set cache headers for featured content
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes cache for featured
    });

    res.json({ 
      success: true, 
      data: featuredAnime
    });
  } catch (err) {
    console.error('Error fetching featured anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: GET TOP 100 ANIME (LIKE/DISLIKE SYSTEM)
 */
router.get('/top100', async (req, res) => {
  try {
    const { 
      type = 'all-time', // 'all-time', 'monthly', 'weekly'
      contentType = 'all', // 'Anime', 'Movie', 'Manga', 'all'
      limit = 100,
      page = 1
    } = req.query;

    const options = {
      type,
      contentType: contentType === 'all' ? null : contentType,
      limit: parseInt(limit),
      page: parseInt(page)
    };

    const topAnime = await Anime.getTopAnime(options);

    // ✅ Get total count for pagination
    let countQuery = {};
    if (contentType && contentType !== 'all') {
      countQuery.contentType = contentType;
    }

    const total = await Anime.countDocuments(countQuery);

    // ✅ Set cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Total-Count': total,
      'X-Ranking-Type': type,
      'X-Content-Type': contentType
    });

    res.json({ 
      success: true, 
      data: topAnime,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      },
      ranking: {
        type,
        contentType: contentType,
        period: type === 'all-time' ? 'All Time' : 
                type === 'monthly' ? 'Last 30 Days' : 
                type === 'weekly' ? 'Last 7 Days' : 'Custom'
      }
    });
  } catch (err) {
    console.error('Error fetching top 100 anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: GET ANIME BY SLUG (SEO-friendly URL) - MUST COME BEFORE DYNAMIC ROUTES
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({ 
        success: false, 
        error: 'Slug parameter is required' 
      });
    }

    const anime = await Anime.findOne({ slug })
      .populate('episodes')
      .lean();

    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        message: 'Anime not found with this slug' 
      });
    }

    // ✅ Increment views when accessed by slug
    await Anime.findByIdAndUpdate(anime._id, { 
      $inc: { views: 1 } 
    });

    // ✅ SEO cache headers
    res.set({
      'Cache-Control': 'public, max-age=3600', // 1 hour cache for SEO pages
      'Content-Type': 'application/json; charset=utf-8'
    });

    res.json({ 
      success: true, 
      data: anime
    });
  } catch (err) {
    console.error('Error fetching anime by slug:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: LIKE/DISLIKE VOTE SYSTEM - UPDATED TO USE req.ip
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;

    // ✅ FIX: Get IP address from request object, not from body
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log(`🗳️ Vote request from IP: ${ipAddress}, Vote Type: ${voteType}, Anime ID: ${id}`);

    // Validate vote type
    if (!['like', 'dislike'].includes(voteType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid vote type. Use "like" or "dislike"' 
      });
    }

    // Find anime
    const anime = await Anime.findById(id);
    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        error: 'Anime not found' 
      });
    }

    // Check if user already voted
    const hasVoted = anime.hasVoted(ipAddress);
    const userVote = anime.getUserVote(ipAddress);

    console.log(`🔍 Vote check - HasVoted: ${hasVoted}, UserVote: ${userVote}`);

    // If user is trying to vote same type again, remove vote
    if (hasVoted && userVote === voteType) {
      console.log(`🗑️ Removing vote for IP: ${ipAddress}`);
      await anime.removeVote(ipAddress);
      
      return res.json({
        success: true,
        message: 'Vote removed successfully',
        data: {
          likes: anime.likes,
          dislikes: anime.dislikes,
          totalVotes: anime.totalVotes,
          userVote: null,
          hasVoted: false
        }
      });
    }

    // Add/update vote
    console.log(`➕ Adding vote for IP: ${ipAddress}, Type: ${voteType}`);
    await anime.addVote(ipAddress, voteType);

    // Update time-based counts
    await anime.updateTimeBasedCounts();

    // Get updated anime
    const updatedAnime = await Anime.findById(id);

    res.json({
      success: true,
      message: `Vote ${voteType === 'like' ? 'liked' : 'disliked'} successfully`,
      data: {
        likes: updatedAnime.likes,
        dislikes: updatedAnime.dislikes,
        totalVotes: updatedAnime.totalVotes,
        userVote: voteType,
        hasVoted: true,
        monthlyLikes: updatedAnime.monthlyLikes,
        weeklyLikes: updatedAnime.weeklyLikes
      }
    });

    console.log(`✅ Vote processed successfully - Likes: ${updatedAnime.likes}, Dislikes: ${updatedAnime.dislikes}`);

  } catch (err) {
    console.error('Error processing vote:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: GET USER VOTE STATUS - UPDATED TO USE req.ip
 */
router.get('/:id/vote-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ FIX: Get IP address from request object
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log(`🔍 Checking vote status for IP: ${ipAddress}, Anime ID: ${id}`);

    const anime = await Anime.findById(id).select('likes dislikes votes monthlyLikes weeklyLikes totalVotes');
    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        error: 'Anime not found' 
      });
    }

    const hasVoted = anime.hasVoted(ipAddress);
    const userVote = anime.getUserVote(ipAddress);

    console.log(`✅ Vote status - HasVoted: ${hasVoted}, UserVote: ${userVote}`);

    res.json({
      success: true,
      data: {
        hasVoted,
        userVote,
        likes: anime.likes,
        dislikes: anime.dislikes,
        totalVotes: anime.totalVotes || (anime.likes + anime.dislikes),
        monthlyLikes: anime.monthlyLikes,
        weeklyLikes: anime.weeklyLikes
      }
    });
  } catch (err) {
    console.error('Error getting vote status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: GET ANIME STATISTICS (for admin/analytics)
 */
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;

    const anime = await Anime.findById(id)
      .select('likes dislikes monthlyLikes weeklyLikes totalVotes views rating votes')
      .lean();

    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        error: 'Anime not found' 
      });
    }

    // Calculate vote percentages
    const totalVotes = anime.likes + anime.dislikes;
    const likePercentage = totalVotes > 0 ? (anime.likes / totalVotes * 100).toFixed(1) : 0;
    const dislikePercentage = totalVotes > 0 ? (anime.dislikes / totalVotes * 100).toFixed(1) : 0;

    // Get vote trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentVotes = anime.votes ? anime.votes.filter(vote => 
      new Date(vote.date) >= thirtyDaysAgo
    ) : [];

    const recentLikes = recentVotes.filter(vote => vote.voteType === 'like').length;
    const recentDislikes = recentVotes.filter(vote => vote.voteType === 'dislike').length;

    res.json({
      success: true,
      data: {
        ...anime,
        likePercentage,
        dislikePercentage,
        recentVotes: {
          last30Days: recentVotes.length,
          likes: recentLikes,
          dislikes: recentDislikes
        },
        ranking: {
          allTime: anime.likes,
          monthly: anime.monthlyLikes,
          weekly: anime.weeklyLikes
        }
      }
    });
  } catch (err) {
    console.error('Error getting anime statistics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ OPTIMIZED: GET anime with PAGINATION
 * Returns paginated anime from DB sorted by LATEST UPDATE
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'updatedAt';

    // Determine sort field
    let sortField = 'updatedAt';
    let sortOrder = -1;

    if (sortBy === 'likes') {
      sortField = 'likes';
    } else if (sortBy === 'popular') {
      sortField = 'views';
    } else if (sortBy === 'rating') {
      sortField = 'rating';
    } else if (sortBy === 'newest') {
      sortField = 'createdAt';
    } else if (sortBy === 'featured') {
      sortField = 'featuredOrder';
    }

    // ✅ OPTIMIZED: Only get necessary fields for listing
    const anime = await Anime.find()
      .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt slug likes dislikes rating monthlyLikes weeklyLikes totalVotes') // ✅ Added like fields
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(); // Faster response

    const total = await Anime.countDocuments();

    // ✅ OPTIMIZED: Set cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Total-Count': total,
      'X-Page': page,
      'X-Limit': limit,
      'X-Sort-By': sortBy
    });

    res.json({ 
      success: true, 
      data: anime,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (err) {
    console.error('Error fetching anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ OPTIMIZED: SEARCH anime with PAGINATION WITH SEO SUPPORT
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;

    // ✅ IMPROVED: Search in multiple fields for better SEO
    const searchQuery = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { seoKeywords: { $regex: q, $options: 'i' } },
        { seoTitle: { $regex: q, $options: 'i' } },
        { seoDescription: { $regex: q, $options: 'i' } }
      ]
    };

    const found = await Anime.find(searchQuery)
      .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt slug seoTitle seoDescription likes dislikes rating monthlyLikes weeklyLikes') // ✅ Added like fields
      .sort({ likes: -1, updatedAt: -1 }) // Sort by popularity first
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Anime.countDocuments(searchQuery);

    // ✅ SEO headers for search results
    res.set({
      'Cache-Control': 'public, max-age=300',
      'X-Total-Count': total,
      'X-Search-Query': encodeURIComponent(q)
    });

    res.json({ 
      success: true, 
      data: found,
      pagination: {
        current: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
        totalItems: total
      },
      searchInfo: {
        query: q,
        resultsFound: total
      }
    });
  } catch (err) {
    console.error('Error searching anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: GET ANIME LIST WITH SEO FILTERS
 */
router.get('/filter/seo', async (req, res) => {
  try {
    const { language, type, genre, sortBy = 'popular' } = req.query;
    
    const filter = {};
    
    // Apply language filter
    if (language) {
      if (language === 'hindi') {
        filter.$or = [
          { subDubStatus: { $regex: 'Hindi', $options: 'i' } },
          { seoKeywords: { $regex: 'hindi', $options: 'i' } }
        ];
      } else if (language === 'english') {
        filter.$or = [
          { subDubStatus: { $regex: 'English', $options: 'i' } },
          { seoKeywords: { $regex: 'english', $options: 'i' } }
        ];
      }
    }
    
    // Apply type filter
    if (type && type !== 'all') {
      filter.contentType = type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    // Apply genre filter
    if (genre) {
      filter.genreList = { $regex: genre, $options: 'i' };
    }
    
    // Determine sort field
    let sortField = 'likes';
    if (sortBy === 'newest') {
      sortField = 'createdAt';
    } else if (sortBy === 'updated') {
      sortField = 'updatedAt';
    } else if (sortBy === 'rating') {
      sortField = 'rating';
    } else if (sortBy === 'views') {
      sortField = 'views';
    }
    
    const anime = await Anime.find(filter)
      .select('title thumbnail releaseYear subDubStatus contentType slug seoTitle seoDescription likes dislikes rating views monthlyLikes weeklyLikes')
      .sort({ [sortField]: -1 })
      .limit(50)
      .lean();
    
    // ✅ SEO cache for filtered results
    res.set({
      'Cache-Control': 'public, max-age=1800', // 30 minutes
    });
    
    res.json({
      success: true,
      data: anime,
      filter: { language, type, genre, sortBy }
    });
  } catch (err) {
    console.error('Error filtering anime by SEO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ UPDATED: GET single anime by ID OR SLUG
 * THIS MUST BE THE LAST ROUTE IN THE FILE
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the ID is a valid MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let item;
    
    if (isObjectId) {
      // Search by ID
      item = await Anime.findById(id)
        .populate('episodes')
        .lean();
    } else {
      // Try searching by slug
      item = await Anime.findOne({ slug: id })
        .populate('episodes')
        .lean();
    }
    
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Anime not found' 
      });
    }
    
    // ✅ Increment views
    await Anime.findByIdAndUpdate(item._id, { 
      $inc: { views: 1 } 
    });
    
    // ✅ SEO headers
    res.set({
      'Cache-Control': 'public, max-age=3600', // 1 hour for anime details
      'Content-Type': 'application/json; charset=utf-8'
    });
    
    res.json({ 
      success: true, 
      data: item
    });
  } catch (err) {
    // ✅ Better error handling for invalid ObjectId
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid anime ID format' 
      });
    }
    console.error('Error fetching anime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ NEW: BULK UPDATE SEO DATA
 */
router.put('/bulk/seo', async (req, res) => {
  try {
    const { animeList } = req.body;
    
    if (!Array.isArray(animeList) || animeList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'animeList must be a non-empty array'
      });
    }
    
    const bulkOps = animeList.map(anime => ({
      updateOne: {
        filter: { _id: anime._id },
        update: {
          $set: {
            seoTitle: anime.seoTitle || '',
            seoDescription: anime.seoDescription || '',
            seoKeywords: anime.seoKeywords || '',
            slug: anime.slug || '',
            updatedAt: new Date()
          }
        }
      }
    }));
    
    const result = await Anime.bulkWrite(bulkOps);
    
    res.json({
      success: true,
      message: `Updated SEO data for ${result.modifiedCount} anime`,
      data: result
    });
  } catch (err) {
    console.error('Error bulk updating SEO data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ADDED: FEATURED MANAGEMENT ROUTES

// Add anime to featured
router.post('/:id/featured', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Count current featured animes for ordering
    const featuredCount = await Anime.countDocuments({ featured: true });
    
    const updatedAnime = await Anime.findByIdAndUpdate(
      id,
      { 
        featured: true,
        featuredOrder: featuredCount + 1
      },
      { new: true }
    );
    
    if (!updatedAnime) {
      return res.status(404).json({ success: false, error: 'Anime not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Anime added to featured',
      data: updatedAnime 
    });
  } catch (err) {
    console.error('Error adding to featured:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove anime from featured
router.delete('/:id/featured', async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedAnime = await Anime.findByIdAndUpdate(
      id,
      { 
        featured: false,
        featuredOrder: 0
      },
      { new: true }
    );
    
    if (!updatedAnime) {
      return res.status(404).json({ success: false, error: 'Anime not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Anime removed from featured',
      data: updatedAnime 
    });
  } catch (err) {
    console.error('Error removing from featured:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update featured order (bulk update)
router.put('/featured/order', async (req, res) => {
  try {
    const { order } = req.body; // array of anime IDs in desired order
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'Order must be an array of anime IDs' });
    }
    
    const bulkOps = order.map((animeId, index) => ({
      updateOne: {
        filter: { _id: animeId },
        update: { 
          featuredOrder: index + 1,
          featured: true // Ensure they remain featured
        }
      }
    }));
    
    await Anime.bulkWrite(bulkOps);
    
    res.json({ 
      success: true, 
      message: `Featured order updated for ${order.length} animes` 
    });
  } catch (err) {
    console.error('Error updating featured order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;