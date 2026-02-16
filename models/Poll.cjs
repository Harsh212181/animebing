 // models/Poll.cjs - UPDATED WITH DEVICE TYPE TRACKING

const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  animeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Anime',
    default: null
  },
  image: { 
    type: String, 
    default: ''
  },
  votes: { 
    type: Number, 
    default: 0 
  },
  order: { 
    type: Number, 
    default: 0 
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const pollSchema = new mongoose.Schema({
  question: { 
    type: String, 
    required: true,
    trim: true
  },
  options: [pollOptionSchema],
  expiresAt: { 
    type: Date, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  totalVotes: { 
    type: Number, 
    default: 0 
  },
  // Voters tracking array – stores deviceId and deviceType
  voters: [{
    deviceId: {                // Unique device identifier
      type: String,
      required: true
    },
    deviceType: {              // NEW: device type (mobile, tablet, desktop)
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown'
    },
    votedAt: {
      type: Date,
      default: Date.now
    },
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
});

// Automatically update updatedAt on save
pollSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// UPDATED: Add vote method with deviceId and deviceType tracking
pollSchema.methods.addVote = async function(optionId, deviceId, deviceType = 'unknown') {
  try {
    // Check if device already voted
    const hasVoted = this.voters.some(voter => voter.deviceId === deviceId);
    
    if (hasVoted) {
      throw new Error('You have already voted in this poll');
    }

    // Check if poll is active
    if (!this.isActive) {
      throw new Error('This poll is not active');
    }

    // Check if poll has expired
    const now = new Date();
    if (this.expiresAt < now) {
      throw new Error('This poll has expired');
    }

    const option = this.options.id(optionId);
    if (!option) {
      throw new Error('Option not found');
    }
    
    // Add vote
    option.votes += 1;
    this.totalVotes += 1;
    
    // Record voter information with deviceId and deviceType
    this.voters.push({
      deviceId: deviceId,
      deviceType: deviceType,   // Store device type
      votedAt: now,
      optionId: optionId
    });
    
    await this.save();
    
    return { 
      success: true, 
      totalVotes: this.totalVotes,
      optionVotes: option.votes 
    };
  } catch (error) {
    throw error;
  }
};

// Method to check if device has voted
pollSchema.methods.hasDeviceVoted = function(deviceId) {
  return this.voters.some(voter => voter.deviceId === deviceId);
};

// Method to get device's vote option
pollSchema.methods.getDeviceVote = function(deviceId) {
  const voter = this.voters.find(v => v.deviceId === deviceId);
  return voter ? voter.optionId : null;
};

// Static method to get expired polls
pollSchema.statics.getExpiredPolls = async function() {
  try {
    const now = new Date();
    const expiredPolls = await this.find({
      expiresAt: { $lt: now },
      isActive: true
    });
    return expiredPolls;
  } catch (error) {
    throw error;
  }
};

// Static method to auto-deactivate expired polls
pollSchema.statics.autoDeactivateExpired = async function() {
  try {
    const now = new Date();
    const result = await this.updateMany(
      {
        expiresAt: { $lt: now },
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

// Index for faster queries
pollSchema.index({ expiresAt: 1 });
pollSchema.index({ isActive: 1, expiresAt: 1 });
pollSchema.index({ createdAt: -1 });
pollSchema.index({ 'voters.deviceId': 1 });        // Index for deviceId lookup
pollSchema.index({ 'voters.deviceType': 1 });       // Index for deviceType breakdown (optional)

module.exports = mongoose.model('Poll', pollSchema);