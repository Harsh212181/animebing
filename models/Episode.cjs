  // models/Episode.cjs
const mongoose = require("mongoose");

const downloadLinkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: "Download Link"
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  quality: {
    type: String,
    trim: true,
    default: ""
  },
  type: {
    type: String,
    trim: true,
    default: "direct"
  }
});

const episodeSchema = new mongoose.Schema({
  animeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Anime",
    required: true,
    index: true
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
  // ✅ Changed from cutyLink to downloadLinks array
  downloadLinks: {
    type: [downloadLinkSchema],
    required: true,
    validate: {
      validator: function(v) {
        // Minimum 1, maximum 5 download links
        return v.length >= 1 && v.length <= 5;
      },
      message: "An episode must have between 1 and 5 download links"
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
