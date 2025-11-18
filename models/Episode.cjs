 // models/Episode.cjs - UPDATED VERSION WITH CRITICAL FIX MERGED
const mongoose = require("mongoose");

const episodeSchema = new mongoose.Schema({
  animeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Anime",
    required: true,
    index: true // ✅ ADD INDEX
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  episodeNumber: {
    type: Number,
    required: true,
    min: 1
  },
  session: {
    type: Number,
    default: 1,
    min: 1
  },
  cutyLink: {
    type: String,
    required: true, // ✅ REQUIRED KARO
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid URL format'
    }
  },
  secureFileReference: String
}, {
  timestamps: true
});

// ✅ BETTER INDEXING
episodeSchema.index({ animeId: 1, episodeNumber: 1, session: 1 }, { unique: true });
episodeSchema.index({ animeId: 1 }); // Separate index for queries

module.exports = mongoose.models.Episode || mongoose.model('Episode', episodeSchema);