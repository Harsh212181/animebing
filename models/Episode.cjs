 // models/Episode.cjs - CUTYLINK REQUIREMENTS COMPLETELY REMOVED
const mongoose = require("mongoose");

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
  cutyLink: {
    type: String,
    default: "", // ✅ REQUIRED HATA DO, DEFAULT EMPTY STRING
    // ✅ VALIDATION COMPLETELY REMOVED
  },
  secureFileReference: String
}, {
  timestamps: true
});

// ✅ BETTER INDEXING
episodeSchema.index({ animeId: 1, episodeNumber: 1, session: 1 }, { unique: true });
episodeSchema.index({ animeId: 1 }); // Separate index for queries

module.exports = mongoose.models.Episode || mongoose.model('Episode', episodeSchema);
