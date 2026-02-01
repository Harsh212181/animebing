const mongoose = require('mongoose');

const LinkSettingsSchema = new mongoose.Schema({
  link1: {
    type: Boolean,
    default: true,
    required: true
  },
  link2: {
    type: Boolean,
    default: true,
    required: true
  },
  link3: {
    type: Boolean,
    default: true,
    required: true
  },
  link4: {
    type: Boolean,
    default: true,
    required: true
  },
  link5: {
    type: Boolean,
    default: true,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'linksettings'
});

// Create a singleton instance
LinkSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

LinkSettingsSchema.statics.updateSettings = async function(newSettings) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(newSettings);
  } else {
    Object.keys(newSettings).forEach(key => {
      if (settings[key] !== undefined) {
        settings[key] = newSettings[key];
      }
    });
    settings.lastUpdated = Date.now();
    await settings.save();
  }
  return settings;
};

// Method to get only active links
LinkSettingsSchema.methods.getActiveLinks = function() {
  const activeLinks = [];
  for (let i = 1; i <= 5; i++) {
    if (this[`link${i}`]) {
      activeLinks.push(i);
    }
  }
  return activeLinks;
};

const LinkSettings = mongoose.model('LinkSettings', LinkSettingsSchema);

module.exports = LinkSettings;