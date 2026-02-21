 // routes/animeRoutes.cjs - UPDATED WITH LIKE/DISLIKE SYSTEM, SEO SUPPORT & UNASSIGNED ROUTE
const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime.cjs');
// ✅ FIXED: Import adminAuth directly (not destructured)
const adminAuth = require('../middleware/adminAuth.cjs');

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
    .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt bannerImage rating slug seoTitle likes dislikes monthlyLikes weeklyLikes')
    .sort({ featuredOrder: -1, createdAt: -1 })
    .limit(24)
    .lean();

    res.set({
      'Cache-Control': 'public, max-age=600',
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
      type = 'all-time',
      contentType = 'all',
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

    let countQuery = {};
    if (contentType && contentType !== 'all') {
      countQuery.contentType = contentType;
    }

    const total = await Anime.countDocuments(countQuery);

    res.set({
      'Cache-Control': 'public, max-age=300',
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
 * ✅ NEW: GET ANIME BY SLUG (SEO-friendly URL)
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

    await Anime.findByIdAndUpdate(anime._id, { 
      $inc: { views: 1 } 
    });

    res.set({
      'Cache-Control': 'public, max-age=3600',
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

// ============================================
// ✅ PARTNER MANAGER: GET UNASSIGNED ANIME (ADMIN ONLY)
// ============================================
router.get('/unassigned', adminAuth, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = { partnerId: null };
    
    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const anime = await Anime.find(query)
      .select('title thumbnail episodes status contentType')
      .limit(20)
      .lean();

    res.json(anime);
  } catch (err) {
    console.error('❌ Error fetching unassigned anime:', err);
    res.status(500).json({ error: 'Failed to fetch unassigned anime' });
  }
});

/**
 * ✅ LIKE/DISLIKE VOTE SYSTEM
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!['like', 'dislike'].includes(voteType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid vote type. Use "like" or "dislike"' 
      });
    }

    const anime = await Anime.findById(id);
    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        error: 'Anime not found' 
      });
    }

    const hasVoted = anime.hasVoted(ipAddress);
    const userVote = anime.getUserVote(ipAddress);

    if (hasVoted && userVote === voteType) {
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

    await anime.addVote(ipAddress, voteType);
    await anime.updateTimeBasedCounts();

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
  } catch (err) {
    console.error('Error processing vote:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ✅ GET USER VOTE STATUS
 */
router.get('/:id/vote-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const anime = await Anime.findById(id).select('likes dislikes votes monthlyLikes weeklyLikes totalVotes');
    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        error: 'Anime not found' 
      });
    }

    const hasVoted = anime.hasVoted(ipAddress);
    const userVote = anime.getUserVote(ipAddress);

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
 * ✅ GET ANIME STATISTICS
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

    const totalVotes = anime.likes + anime.dislikes;
    const likePercentage = totalVotes > 0 ? (anime.likes / totalVotes * 100).toFixed(1) : 0;
    const dislikePercentage = totalVotes > 0 ? (anime.dislikes / totalVotes * 100).toFixed(1) : 0;

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
 * ✅ GET anime with PAGINATION
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'updatedAt';

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

    const anime = await Anime.find()
      .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt slug likes dislikes rating monthlyLikes weeklyLikes totalVotes')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Anime.countDocuments();

    res.set({
      'Cache-Control': 'public, max-age=300',
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
 * ✅ SEARCH anime with PAGINATION
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;

    const searchQuery = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { seoKeywords: { $regex: q, $options: 'i' } },
        { seoTitle: { $regex: q, $options: 'i' } },
        { seoDescription: { $regex: q, $options: 'i' } }
      ]
    };

    const found = await Anime.find(searchQuery)
      .select('title thumbnail releaseYear subDubStatus contentType updatedAt createdAt slug seoTitle seoDescription likes dislikes rating monthlyLikes weeklyLikes')
      .sort({ likes: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Anime.countDocuments(searchQuery);

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
 * ✅ GET ANIME LIST WITH SEO FILTERS
 */
router.get('/filter/seo', async (req, res) => {
  try {
    const { language, type, genre, sortBy = 'popular' } = req.query;
    
    const filter = {};
    
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
    
    if (type && type !== 'all') {
      filter.contentType = type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    if (genre) {
      filter.genreList = { $regex: genre, $options: 'i' };
    }
    
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
    
    res.set({
      'Cache-Control': 'public, max-age=1800',
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
 * ✅ GET single anime by ID OR SLUG
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let item;
    
    if (isObjectId) {
      item = await Anime.findById(id)
        .populate('episodes')
        .lean();
    } else {
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
    
    await Anime.findByIdAndUpdate(item._id, { 
      $inc: { views: 1 } 
    });
    
    res.set({
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json; charset=utf-8'
    });
    
    res.json({ 
      success: true, 
      data: item
    });
  } catch (err) {
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
 * ✅ BULK UPDATE SEO DATA
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

// ✅ FEATURED MANAGEMENT ROUTES (require adminAuth)

router.post('/:id/featured', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
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

router.delete('/:id/featured', adminAuth, async (req, res) => {
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

router.put('/featured/order', adminAuth, async (req, res) => {
  try {
    const { order } = req.body;
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'Order must be an array of anime IDs' });
    }
    
    const bulkOps = order.map((animeId, index) => ({
      updateOne: {
        filter: { _id: animeId },
        update: { 
          featuredOrder: index + 1,
          featured: true
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