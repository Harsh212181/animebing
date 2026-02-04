 // routes/pollRoutes.cjs - COMPLETE UPDATED VERSION WITH IP TRACKING
const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll.cjs');

/* =========================
   Middleware
========================= */
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Get client IP address
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.ip ||
         '127.0.0.1';
};

/* =========================
   AUTO-DEACTIVATE EXPIRED POLLS MIDDLEWARE
========================= */
router.use(async (req, res, next) => {
  try {
    await Poll.autoDeactivateExpired();
    next();
  } catch (error) {
    console.error('Auto-deactivate error:', error);
    next();
  }
});

/* =========================
   USER ROUTES
========================= */

/**
 * ✅ GET Active Poll (User) - UPDATED WITH IP CHECK
 */
router.get('/active', async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const poll = await Poll.findOne({ 
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!poll) {
      return res.json({
        success: true,
        poll: null,
        message: 'No active poll found',
      });
    }

    // Convert to plain object
    const pollObj = poll.toObject();
    pollObj._id = pollObj._id.toString();
    
    // Check if user has already voted
    const hasVoted = poll.voters.some(voter => voter.ip === clientIp);
    pollObj.userHasVoted = hasVoted;
    
    // Get user's vote if they have voted
    if (hasVoted) {
      const voter = poll.voters.find(v => v.ip === clientIp);
      pollObj.userVoteOption = voter ? voter.optionId.toString() : null;
    }
    
    if (pollObj.options) {
      pollObj.options = pollObj.options.map(option => ({
        ...option,
        _id: option._id ? option._id.toString() : option._id,
        animeId: option.animeId ? option.animeId.toString() : option.animeId,
        // Calculate percentage
        percentage: poll.totalVotes > 0 ? 
          Math.round((option.votes / poll.totalVotes) * 100) : 0
      }));
    }

    // Remove voters array from response for security
    delete pollObj.voters;

    res.json({
      success: true,
      poll: pollObj,
    });
  } catch (error) {
    console.error('❌ Active poll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ POST Vote - UPDATED WITH IP TRACKING
 */
router.post('/vote', async (req, res) => {
  try {
    const { pollId, optionId } = req.body;
    const clientIp = getClientIp(req); // Get user IP

    if (!pollId || !optionId) {
      return res.status(400).json({
        success: false,
        message: 'pollId and optionId required',
      });
    }

    const poll = await Poll.findOne({ 
      _id: pollId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!poll) {
      return res.status(400).json({
        success: false,
        message: 'Poll not found or expired',
      });
    }

    // Check if user has already voted
    const hasVoted = poll.voters.some(voter => voter.ip === clientIp);
    if (hasVoted) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted in this poll',
        userHasVoted: true
      });
    }

    // Pass IP to addVote method
    const result = await poll.addVote(optionId, clientIp);

    res.json({
      success: true,
      ...result,
      userHasVoted: true,
      userVoteOption: optionId
    });
  } catch (error) {
    console.error('❌ Vote error:', error);
    
    // Handle specific errors
    if (error.message.includes('already voted')) {
      return res.status(400).json({ 
        success: false, 
        message: error.message,
        userHasVoted: true
      });
    }
    
    if (error.message.includes('not active') || error.message.includes('expired')) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  }
});

/**
 * ✅ GET Check if user has voted
 */
router.get('/check-vote/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;
    const clientIp = getClientIp(req);
    
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.json({
        success: true,
        hasVoted: false,
        voteOption: null
      });
    }
    
    const hasVoted = poll.voters.some(voter => voter.ip === clientIp);
    const voter = hasVoted ? poll.voters.find(v => v.ip === clientIp) : null;
    const voteOption = voter ? voter.optionId.toString() : null;
    
    res.json({
      success: true,
      hasVoted,
      voteOption
    });
  } catch (error) {
    console.error('❌ Check vote error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* =========================
   ADMIN ROUTES
========================= */

/**
 * ✅ ADMIN – Create Poll - UPDATED WITH VOTERS INIT
 */
router.post('/admin/create', async (req, res) => {
  try {
    const { question, options, expiresAt } = req.body;

    console.log('📝 Creating poll with data:', { 
      question, 
      optionsCount: options?.length,
      expiresAt 
    });

    // Minimum 4 options required
    if (!question || !Array.isArray(options) || options.length < 4 || options.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Question and 4 to 10 options required',
      });
    }

    // Validate expiration date
    if (!expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date is required',
      });
    }

    const expiryDate = new Date(expiresAt);
    if (expiryDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date must be in the future',
      });
    }

    // Validate each option
    const validatedOptions = options.map((option, index) => {
      if (!option.title || !option.animeId) {
        throw new Error('Each option must have title and animeId');
      }
      return {
        animeId: option.animeId,
        title: option.title.trim(),
        image: option.image || '',
        votes: 0,
        order: index,
        isCustom: option.animeId.startsWith('custom_')
      };
    });

    // If activating new poll, deactivate all others
    await Poll.updateMany({}, { $set: { isActive: false } });

    // Create poll
    const poll = new Poll({
      question: question.trim(),
      options: validatedOptions,
      expiresAt: expiryDate,
      isActive: true,
      totalVotes: 0,
      voters: [], // Initialize empty voters array
      createdAt: new Date()
    });

    await poll.save();

    console.log('✅ Poll created successfully:', poll._id);

    res.json({
      success: true,
      message: 'Poll created successfully',
      poll: poll.toObject(),
    });
  } catch (error) {
    console.error('❌ Create poll error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create poll' 
    });
  }
});

/**
 * ✅ ADMIN – Get All Polls - UPDATED WITH VOTERS COUNT
 */
router.get('/admin/all', async (req, res) => {
  try {
    console.log('📊 Fetching all polls...');
    
    // Auto-deactivate expired polls first
    await Poll.autoDeactivateExpired();
    
    const polls = await Poll.find()
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${polls.length} polls`);

    // Process polls
    const processedPolls = polls.map(poll => {
      const pollObj = { ...poll };
      pollObj._id = pollObj._id.toString();
      
      // Check if poll is expired
      pollObj.isExpired = new Date(pollObj.expiresAt) < new Date();
      
      // Add voters count
      pollObj.votersCount = pollObj.voters?.length || 0;
      
      if (pollObj.options) {
        pollObj.options = pollObj.options.map(option => ({
          ...option,
          _id: option._id ? option._id.toString() : option._id,
          animeId: option.animeId ? option.animeId.toString() : option.animeId,
          // Calculate percentage for admin view
          percentage: pollObj.totalVotes > 0 ? 
            Math.round((option.votes / pollObj.totalVotes) * 100) : 0
        }));
      }
      
      return pollObj;
    });

    res.json(processedPolls);
    
  } catch (error) {
    console.error('❌ Get polls error:', error);
    res.json([]);
  }
});

/**
 * ✅ ADMIN – Get Single Poll by ID
 */
router.get('/admin/:id', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id).lean();
    
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found',
      });
    }

    // Check if poll is expired
    const pollObj = { ...poll };
    pollObj.isExpired = new Date(pollObj.expiresAt) < new Date();
    pollObj._id = pollObj._id.toString();
    
    // Add voters count
    pollObj.votersCount = pollObj.voters?.length || 0;
    
    if (pollObj.options) {
      pollObj.options = pollObj.options.map(option => ({
        ...option,
        _id: option._id ? option._id.toString() : option._id,
        animeId: option.animeId ? option.animeId.toString() : option.animeId,
        percentage: pollObj.totalVotes > 0 ? 
          Math.round((option.votes / pollObj.totalVotes) * 100) : 0
      }));
    }

    res.json({
      success: true,
      poll: pollObj,
    });
  } catch (error) {
    console.error('❌ Get single poll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ ADMIN – Update/Edit Poll
 */
router.put('/admin/:id', async (req, res) => {
  try {
    const { question, options, expiresAt, isActive } = req.body;
    const pollId = req.params.id;

    console.log('📝 Updating poll:', pollId);

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found',
      });
    }

    // Update fields if provided
    if (question !== undefined) {
      poll.question = question.trim();
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 4 || options.length > 10) {
        return res.status(400).json({
          success: false,
          message: '4 to 10 options required',
        });
      }
      
      poll.options = options.map((option, index) => ({
        animeId: option.animeId,
        title: option.title.trim(),
        image: option.image || '',
        votes: option.votes || 0,
        order: index,
        isCustom: option.animeId.startsWith('custom_')
      }));
    }

    if (expiresAt !== undefined) {
      const expiryDate = new Date(expiresAt);
      if (expiryDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be in the future',
        });
      }
      poll.expiresAt = expiryDate;
    }

    if (isActive !== undefined) {
      poll.isActive = isActive;
      // If activating this poll, deactivate all others
      if (isActive) {
        await Poll.updateMany(
          { _id: { $ne: poll._id } },
          { $set: { isActive: false } }
        );
      }
    }

    await poll.save();

    console.log('✅ Poll updated successfully:', poll._id);

    res.json({
      success: true,
      message: 'Poll updated successfully',
      poll: poll.toObject(),
    });
  } catch (error) {
    console.error('❌ Update poll error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update poll',
    });
  }
});

/**
 * ✅ ADMIN – Toggle Poll ON / OFF
 */
router.put('/admin/:id/toggle', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found',
      });
    }

    // Check if poll is expired
    const isExpired = new Date(poll.expiresAt) < new Date();
    if (isExpired && !poll.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot activate expired poll',
      });
    }

    // If activating this poll, deactivate all others
    if (!poll.isActive) {
      await Poll.updateMany(
        { _id: { $ne: poll._id } },
        { $set: { isActive: false } }
      );
    }

    poll.isActive = !poll.isActive;
    await poll.save();

    res.json({
      success: true,
      isActive: poll.isActive,
      message: `Poll ${poll.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('❌ Toggle error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ ADMIN – Delete Poll
 */
router.delete('/admin/:id', async (req, res) => {
  try {
    const poll = await Poll.findByIdAndDelete(req.params.id);
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found',
      });
    }

    res.json({
      success: true,
      message: 'Poll deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ ADMIN – Get Expired Polls
 */
router.get('/admin/expired', async (req, res) => {
  try {
    const expiredPolls = await Poll.getExpiredPolls();
    
    const processedPolls = expiredPolls.map(poll => {
      const pollObj = poll.toObject();
      pollObj._id = pollObj._id.toString();
      pollObj.isExpired = true;
      pollObj.votersCount = pollObj.voters?.length || 0;
      return pollObj;
    });

    res.json({
      success: true,
      polls: processedPolls,
      count: processedPolls.length,
    });
  } catch (error) {
    console.error('❌ Get expired polls error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ ADMIN – Auto-delete Expired Polls (Optional - Manual Trigger)
 */
router.delete('/admin/cleanup/expired', async (req, res) => {
  try {
    const now = new Date();
    const result = await Poll.deleteMany({
      expiresAt: { $lt: now },
      isActive: false
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} expired polls`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ GET Poll Results - UPDATED
 */
router.get('/:id/results', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id).lean();
    
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found',
      });
    }

    // Calculate percentages for each option
    const optionsWithPercentage = poll.options.map(option => ({
      ...option,
      _id: option._id ? option._id.toString() : option._id,
      animeId: option.animeId ? option.animeId.toString() : option.animeId,
      percentage: poll.totalVotes > 0 ? 
        Math.round((option.votes / poll.totalVotes) * 100) : 0
    }));

    res.json({
      success: true,
      poll: {
        _id: poll._id.toString(),
        question: poll.question,
        totalVotes: poll.totalVotes || 0,
        options: optionsWithPercentage,
        isActive: poll.isActive,
        expiresAt: poll.expiresAt,
        isExpired: new Date(poll.expiresAt) < new Date(),
        votersCount: poll.voters?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ TEST
 */
router.get('/test', (req, res) => {
  const clientIp = getClientIp(req);
  res.json({
    success: true,
    message: 'Poll API working 🚀',
    timestamp: new Date().toISOString(),
    yourIp: clientIp,
    endpoints: {
      activePoll: 'GET /active',
      vote: 'POST /vote',
      checkVote: 'GET /check-vote/:pollId',
      createPoll: 'POST /admin/create',
      updatePoll: 'PUT /admin/:id',
      allPolls: 'GET /admin/all',
      togglePoll: 'PUT /admin/:id/toggle',
      deletePoll: 'DELETE /admin/:id',
      expiredPolls: 'GET /admin/expired',
      cleanupExpired: 'DELETE /admin/cleanup/expired',
      pollResults: 'GET /:id/results'
    }
  });
});

module.exports = router;