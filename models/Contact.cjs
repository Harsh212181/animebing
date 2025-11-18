// models/Contact.cjs
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['new', 'read', 'replied', 'email_failed'],
    default: 'new' 
  },
  ip: String,
  userAgent: String,
  adminNotes: String,
  repliedAt: Date
}, { 
  timestamps: true 
});

module.exports = mongoose.models.Contact || mongoose.model('Contact', contactSchema);