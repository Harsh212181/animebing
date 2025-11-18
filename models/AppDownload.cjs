 // models/AppDownload.cjs
const mongoose = require('mongoose');

const appDownloadSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['android', 'ios'],
    required: true
  },
  downloadUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  version: String
}, { timestamps: true });

module.exports = mongoose.models.AppDownload || mongoose.model('AppDownload', appDownloadSchema);