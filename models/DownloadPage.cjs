const mongoose = require('mongoose');

const downloadLinkSchema = new mongoose.Schema({
  episode: { type: Number, required: true },
  url: { type: String, required: true },
  quality: String,          // optional
  language: String          // optional
});

const downloadPageSchema = new mongoose.Schema({
  animeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anime', required: true },
  slug: { type: String, required: true, unique: true },   // e.g. "naruto-eps-1-10"
  title: { type: String, default: 'Download' },           // button text
  links: [downloadLinkSchema],                             // up to 10 links
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DownloadPage', downloadPageSchema);