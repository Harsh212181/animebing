// models/SocialMedia.cjs - NEW FILE
const mongoose = require('mongoose');

const socialMediaSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook', 'instagram', 'telegram', 'twitter', 'youtube'],
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  icon: String,
  displayName: String
}, { timestamps: true });

// ✅ Initialize default social media links
socialMediaSchema.statics.initDefaultLinks = async function() {
  const defaultLinks = [
    { 
      platform: 'facebook', 
      url: 'https://facebook.com/animabing',
      icon: '📘',
      displayName: 'Facebook'
    },
    { 
      platform: 'instagram', 
      url: 'https://instagram.com/animabing',
      icon: '📷',
      displayName: 'Instagram'
    },
    { 
      platform: 'telegram', 
      url: 'https://t.me/animabing',
      icon: '📢',
      displayName: 'Telegram'
    }
  ];

  for (const link of defaultLinks) {
    const existing = await this.findOne({ platform: link.platform });
    if (!existing) {
      await this.create(link);
      console.log(`✅ Created default social link: ${link.platform}`);
    }
  }
};

module.exports = mongoose.models.SocialMedia || mongoose.model('SocialMedia', socialMediaSchema);

// ✅ INITIALIZE DEFAULT LINKS
const SocialMedia = module.exports;
SocialMedia.initDefaultLinks().catch(console.error);