// models/DownloadPage.cjs
const mongoose = require('mongoose');

const downloadLinkSchema = new mongoose.Schema({
  episode: { type: Number, required: true },
  url: { type: String, required: true },
  quality: String,          // e.g., "1080p", "720p"
  language: String,         // e.g., "English", "Japanese"
  type: { type: String, enum: ['download', 'watch'], default: 'download' }
});

const downloadPageSchema = new mongoose.Schema({
  animeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Anime', 
    required: true,
    index: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true 
  },
  title: { 
    type: String, 
    default: 'Download' 
  },
  // ✅ NEW: episode number this page belongs to (required)
  episodeNumber: {
    type: Number,
    required: true,
    min: 1
  },
  links: [downloadLinkSchema],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamps on save
downloadPageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DownloadPage', downloadPageSchema);