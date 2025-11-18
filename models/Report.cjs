 // models/Report.cjs - VERIFIED VERSION
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  animeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anime',
    required: true
  },
  episodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Episode'
  },
  episodeNumber: Number,
  issueType: {
    type: String,
    enum: ['Link Not Working', 'Wrong Episode', 'Poor Quality', 'Audio Issue', 'Subtitle Issue', 'Other'],
    required: true
  },
  description: String,
  email: {
    type: String,
    default: 'Not provided'
  },
  username: {
    type: String,
    default: 'Anonymous'
  },
  userIP: String,
  userAgent: String,
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Fixed', 'Invalid'],
    default: 'Pending'
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminResponse: String,
  responseDate: Date
}, { 
  timestamps: true 
});

// ✅ Add this for better error messages
reportSchema.post('save', function(error, doc, next) {
  if (error.name === 'ValidationError') {
    console.log('❌ Validation Error:', error.errors);
  }
  next(error);
});

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);