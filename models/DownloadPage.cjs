 const mongoose = require('mongoose');

const downloadLinkSchema = new mongoose.Schema({
  episode: { type: Number, required: true },
  url: { type: String, required: true },
  quality: String,
  language: String,
  type: { type: String, enum: ['download', 'watch'], default: 'download' }
});

const downloadPageSchema = new mongoose.Schema({
  animeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anime', required: true },
  slug: { type: String, required: true, unique: true },
  title: { type: String, default: 'Download' },
  episodeNumber: { type: Number }, // ✅ NOT required (for existing documents)
  links: [downloadLinkSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DownloadPage', downloadPageSchema);