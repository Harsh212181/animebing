 // models/Anime.cjs - UPDATED WITH MANGA AND MOVIE SUPPORT
const mongoose = require('mongoose');

const animeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  genreList: [String],
  releaseYear: Number,
  thumbnail: String,
  // ✅ Content type: Anime, Movie, or Manga
  contentType: {
    type: String,
    enum: ['Anime', 'Movie', 'Manga'],
    default: 'Anime'
  },
  // ✅ Updated: Match frontend types.ts
  subDubStatus: {
    type: String,
    enum: ['Hindi Dub', 'Hindi Sub', 'Both', 'Subbed', 'Dubbed', 'Sub & Dub', 'Dual Audio'],
    default: 'Hindi Sub'
  },
  // ✅ Status (Ongoing / Complete)
  status: {
    type: String,
    enum: ['Ongoing', 'Complete'],
    default: 'Ongoing'
  },
  // ✅ Report counts
  reportCount: { type: Number, default: 0 },
  lastReported: Date
}, { timestamps: true });

// ✅ Virtual populate for episodes (auto-join on query)
animeSchema.virtual('episodes', {
  ref: 'Episode',
  localField: '_id',
  foreignField: 'animeId'
});

// Virtual populate for chapters (for manga)
animeSchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'mangaId'
});

animeSchema.set('toJSON', { virtuals: true });
animeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Anime || mongoose.model('Anime', animeSchema);