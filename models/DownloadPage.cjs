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
  episodeNumber: { type: Number }, // optional
  links: {
    type: [downloadLinkSchema],
    validate: {
      validator: function(links) {
        const watchCount = links.filter(link => link.type === 'watch').length;
        const downloadCount = links.filter(link => link.type === 'download').length;
        return watchCount <= 12 && downloadCount <= 12;
      },
      message: props => 
        `Watch links cannot exceed 12 (currently ${props.value.filter(l => l.type === 'watch').length}) ` +
        `and download links cannot exceed 12 (currently ${props.value.filter(l => l.type === 'download').length})`
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt on save
downloadPageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DownloadPage', downloadPageSchema);