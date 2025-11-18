// models/Chapter.cjs - NEW FILE
const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema({
  mangaId: {
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
  chapterNumber: {
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
    required: true,
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

// Better indexing
chapterSchema.index({ mangaId: 1, chapterNumber: 1, session: 1 }, { unique: true });
chapterSchema.index({ mangaId: 1 });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', chapterSchema);