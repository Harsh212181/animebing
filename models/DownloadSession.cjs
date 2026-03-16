const mongoose = require('mongoose');

const DownloadSessionSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  userAgent: { type: String, required: true },
  animeId: { type: String, required: true },
  source: { type: String, enum: ['home', 'detail'], required: true },
  expiresAt: { type: Date, required: true }
});

// TTL index: MongoDB will automatically delete expired documents
DownloadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DownloadSession', DownloadSessionSchema);