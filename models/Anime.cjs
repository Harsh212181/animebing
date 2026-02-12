 // models/Anime.cjs - UPDATED WITH PARTNER ID
const mongoose = require('mongoose');

// Schema for storing user votes
const voteSchema = new mongoose.Schema({
  ipAddress: { 
    type: String, 
    required: true 
  },
  voteType: { 
    type: String, 
    enum: ['like', 'dislike'],
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  }
});

const animeSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: String,
  genreList: [String],
  releaseYear: Number,
  thumbnail: String,
  bannerImage: String, // For featured/carousel display
  contentType: {
    type: String,
    enum: ['Anime', 'Movie', 'Manga'],
    default: 'Anime'
  },
  // UPDATED: Added 'English Sub' to enum
  subDubStatus: {
    type: String,
    enum: ['Hindi Dub', 'Hindi Sub', 'English Sub', 'Both', 'Subbed', 'Dubbed', 'Sub & Dub', 'Dual Audio'],
    default: 'Hindi Sub'
  },
  status: {
    type: String,
    enum: ['Ongoing', 'Complete'],
    default: 'Ongoing'
  },
  reportCount: { 
    type: Number, 
    default: 0 
  },
  lastReported: Date,
  
  // Last episode/chapter added timestamp
  lastContentAdded: { 
    type: Date, 
    default: Date.now 
  },

  // CORRECTED: USE 'featured' INSTEAD OF 'isFeatured' FOR CONSISTENCY
  featured: {
    type: Boolean,
    default: false
  },
  featuredOrder: {
    type: Number,
    default: 0
  },
  
  // ADDITIONAL FIELDS FOR BETTER FUNCTIONALITY
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  totalEpisodes: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  
  // SEO FIELDS
  seoTitle: {
    type: String,
    default: ''
  },
  seoDescription: {
    type: String,
    default: ''
  },
  seoKeywords: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // ✅ NEW FIELD: Partner association (for Partner Manager feature)
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null
  },
  
  // LIKE/DISLIKE SYSTEM FIELDS
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  votes: [voteSchema], // Store all votes with IP and type
  
  // FOR TOP 100 RANKINGS
  lastLikedDate: { 
    type: Date 
  },
  monthlyLikes: { 
    type: Number, 
    default: 0 
  },
  weeklyLikes: { 
    type: Number, 
    default: 0 
  },
  totalVotes: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// VIRTUAL FIELDS
animeSchema.virtual('episodes', {
  ref: 'Episode',
  localField: '_id',
  foreignField: 'animeId'
});

animeSchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'mangaId'
});

// LIKE/DISLIKE HELPER METHODS
animeSchema.methods.hasVoted = function(ip) {
  return this.votes.some(vote => vote.ipAddress === ip);
};

animeSchema.methods.getUserVote = function(ip) {
  const vote = this.votes.find(vote => vote.ipAddress === ip);
  return vote ? vote.voteType : null;
};

animeSchema.methods.addVote = function(ip, voteType) {
  // Remove existing vote if exists
  const existingVoteIndex = this.votes.findIndex(vote => vote.ipAddress === ip);
  
  if (existingVoteIndex !== -1) {
    const oldVote = this.votes[existingVoteIndex];
    
    // Decrement old vote count
    if (oldVote.voteType === 'like') {
      this.likes--;
      this.weeklyLikes--;
      this.monthlyLikes--;
    } else {
      this.dislikes--;
    }
    
    this.votes.splice(existingVoteIndex, 1);
  }
  
  // Add new vote
  this.votes.push({ ipAddress: ip, voteType, date: new Date() });
  
  // Increment new vote count
  if (voteType === 'like') {
    this.likes++;
    this.weeklyLikes++;
    this.monthlyLikes++;
    this.lastLikedDate = new Date();
  } else {
    this.dislikes++;
  }
  
  this.totalVotes = this.likes + this.dislikes;
  
  return this.save();
};

animeSchema.methods.removeVote = function(ip) {
  const voteIndex = this.votes.findIndex(vote => vote.ipAddress === ip);
  
  if (voteIndex !== -1) {
    const vote = this.votes[voteIndex];
    
    if (vote.voteType === 'like') {
      this.likes--;
      this.weeklyLikes--;
      this.monthlyLikes--;
    } else {
      this.dislikes--;
    }
    
    this.votes.splice(voteIndex, 1);
    this.totalVotes = this.likes + this.dislikes;
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

// METHOD TO UPDATE TIME-BASED COUNTS
animeSchema.methods.updateTimeBasedCounts = function() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Calculate weekly and monthly likes
  this.weeklyLikes = this.votes.filter(vote => 
    vote.voteType === 'like' && vote.date >= weekAgo
  ).length;
  
  this.monthlyLikes = this.votes.filter(vote => 
    vote.voteType === 'like' && vote.date >= monthAgo
  ).length;
  
  return this.save();
};

// MIDDLEWARE: Auto-generate slug, update lastContentAdded, set default SEO
animeSchema.pre('save', function(next) {
  // Generate slug if not present or title changed
  if (!this.slug || this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    if (this.slug) {
      this.slug = `${this.slug}-${Date.now().toString(36)}`;
    }
  }
  
  // Update lastContentAdded if episodes were modified (via virtual population, not direct)
  if (this.isModified('episodes') && this.episodes && this.episodes.length > 0) {
    this.lastContentAdded = new Date();
  }
  
  // Default SEO fields if empty
  if (!this.seoTitle) {
    this.seoTitle = `Watch ${this.title} Online in ${this.subDubStatus} | AnimeBing`;
  }
  
  if (!this.seoDescription) {
    this.seoDescription = `Watch ${this.title} online in ${this.subDubStatus}. HD quality streaming and downloads.`;
  }
  
  if (!this.seoKeywords) {
    const keywords = [];
    
    // Title-based keywords
    keywords.push(`${this.title} anime`, `watch ${this.title} online`, `${this.title} ${this.subDubStatus.toLowerCase()}`);
    
    // Genre-based keywords
    if (this.genreList && this.genreList.length > 0) {
      this.genreList.forEach(genre => {
        keywords.push(`${genre.toLowerCase()} anime`, `${this.title} ${genre.toLowerCase()}`);
      });
    }
    
    // Language/Type based keywords
    if (this.subDubStatus.includes('Hindi Dub')) {
      keywords.push('hindi dubbed anime', 'anime in hindi', 'hindi dub');
    }
    if (this.subDubStatus.includes('Hindi Sub')) {
      keywords.push('hindi subbed anime', 'anime with hindi subtitles', 'hindi sub');
    }
    if (this.subDubStatus.includes('English Sub')) {
      keywords.push('english subbed anime', 'anime in english', 'english sub');
    }
    
    // Content type keywords
    if (this.contentType === 'Movie') {
      keywords.push(`${this.title} movie`, 'anime movies', 'full anime movie');
    }
    
    const uniqueKeywords = [...new Set(keywords)];
    this.seoKeywords = uniqueKeywords.join(', ');
  }
  
  next();
});

// STATIC METHOD: Update lastContentAdded when episode added
animeSchema.statics.updateLastContent = async function(animeId) {
  await this.findByIdAndUpdate(animeId, {
    lastContentAdded: new Date(),
    updatedAt: new Date()
  });
};

// STATIC METHOD: Generate unique slug
animeSchema.statics.generateSlug = async function(title) {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  let existing = await this.findOne({ slug });
  let counter = 1;
  let originalSlug = slug;
  
  while (existing) {
    slug = `${originalSlug}-${counter}`;
    existing = await this.findOne({ slug });
    counter++;
  }
  
  return slug;
};

// STATIC METHOD: Get top anime by likes
animeSchema.statics.getTopAnime = async function(options = {}) {
  const { 
    type = 'all-time',
    contentType = null,
    limit = 100,
    page = 1
  } = options;
  
  const skip = (page - 1) * limit;
  
  let query = {};
  
  if (contentType && contentType !== 'all') {
    query.contentType = contentType;
  }
  
  let sortField = 'likes';
  if (type === 'monthly') {
    sortField = 'monthlyLikes';
  } else if (type === 'weekly') {
    sortField = 'weeklyLikes';
  }
  
  return await this.find(query)
    .sort({ [sortField]: -1, title: 1 })
    .skip(skip)
    .limit(limit)
    .select('title thumbnail likes dislikes monthlyLikes weeklyLikes contentType slug rating')
    .lean();
};

// INDEXES FOR PERFORMANCE
animeSchema.index({ featured: 1, featuredOrder: -1 });
animeSchema.index({ title: 'text' });
animeSchema.index({ lastContentAdded: -1 });
animeSchema.index({ createdAt: -1 });
animeSchema.index({ slug: 1 });
animeSchema.index({ seoTitle: 'text', seoDescription: 'text', seoKeywords: 'text' });

// LIKE/DISLIKE SYSTEM INDEXES
animeSchema.index({ likes: -1 });
animeSchema.index({ monthlyLikes: -1 });
animeSchema.index({ weeklyLikes: -1 });
animeSchema.index({ 'votes.ipAddress': 1 });
animeSchema.index({ contentType: 1, likes: -1 });
animeSchema.index({ 'votes.date': -1 });

// ✅ NEW INDEX FOR PARTNER FILTERING
animeSchema.index({ partnerId: 1 });

module.exports = mongoose.models.Anime || mongoose.model('Anime', animeSchema);