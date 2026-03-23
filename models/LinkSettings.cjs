const mongoose = require('mongoose');

// Sub-schema to store the normal (non‑Sunday) configuration
const normalStateSchema = new mongoose.Schema({
  link1: { type: Boolean, default: true },
  link2: { type: Boolean, default: true },
  link3: { type: Boolean, default: true },
  link4: { type: Boolean, default: true },
  link5: { type: Boolean, default: true }
});

const LinkSettingsSchema = new mongoose.Schema({
  link1: { type: Boolean, default: true, required: true },
  link2: { type: Boolean, default: true, required: true },
  link3: { type: Boolean, default: true, required: true },
  link4: { type: Boolean, default: true, required: true },
  link5: { type: Boolean, default: true, required: true },
  autoSundayMode: { type: Boolean, default: false },
  normalState: { type: normalStateSchema, default: () => ({}) },
  _isSundayApplied: { type: Boolean, default: false }, // internal flag
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'linksettings'
});

// =====================
//  HELPER: Get current weekday in India timezone (Asia/Kolkata)
//  Returns 0 = Sunday, 1 = Monday, ... 6 = Saturday
// =====================
function getIndiaWeekday() {
  const now = new Date();
  // Convert to India timezone by constructing a Date object from the localized string
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.getDay(); // 0 = Sunday, 1 = Monday, ...
}

// =====================
//  AUTO SUNDAY LOGIC
// =====================
LinkSettingsSchema.methods.applyAutoSundayLogic = async function () {
  // If Auto Sunday Mode is OFF, do nothing
  if (!this.autoSundayMode) return;

  const day = getIndiaWeekday(); // 0 = Sunday, 1 = Monday, …

  // 🟥 SUNDAY LOGIC
  if (day === 0) {
    // Only apply once per Sunday
    if (!this._isSundayApplied) {
      // Save current state into normalState
      this.normalState = {
        link1: this.link1,
        link2: this.link2,
        link3: this.link3,
        link4: this.link4,
        link5: this.link5
      };

      // Turn OFF all links
      this.link1 = false;
      this.link2 = false;
      this.link3 = false;
      this.link4 = false;

      // Only link5 ON
      this.link5 = true;

      this._isSundayApplied = true;
      await this.safeSave();
    }
  }
  // 🟩 MONDAY LOGIC (restore)
  else if (day === 1) {
    if (this._isSundayApplied) {
      // Safe restore with fallback defaults if normalState fields are missing
      const ns = this.normalState || {};
      this.link1 = ns.link1 ?? true;
      this.link2 = ns.link2 ?? true;
      this.link3 = ns.link3 ?? true;
      this.link4 = ns.link4 ?? true;
      this.link5 = ns.link5 ?? true;

      this._isSundayApplied = false;
      await this.safeSave();
    }
  }
};

// Safe save with error logging (helps with race conditions)
LinkSettingsSchema.methods.safeSave = async function () {
  try {
    return await this.save();
  } catch (err) {
    console.error('❌ Save conflict / error:', err);
    throw err; // rethrow so caller can handle
  }
};

// =====================
//  STATIC HELPERS
// =====================
// Get singleton settings – automatically applies Sunday logic
LinkSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }

  // 🔥 Run Auto Sunday logic
  await settings.applyAutoSundayLogic();

  return settings;
};

// Update settings – also re‑applies Sunday logic or restores if mode turned OFF
LinkSettingsSchema.statics.updateSettings = async function (newSettings) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(newSettings);
  } else {
    // Track if autoSundayMode changed
    const oldMode = settings.autoSundayMode;

    // Apply the new values
    Object.keys(newSettings).forEach(key => {
      if (settings[key] !== undefined) {
        settings[key] = newSettings[key];
      }
    });
    settings.lastUpdated = Date.now();
    await settings.safeSave();

    // Handle mode transitions
    if (!oldMode && settings.autoSundayMode) {
      // Mode turned ON – run logic immediately
      await settings.applyAutoSundayLogic();
    } else if (oldMode && !settings.autoSundayMode && settings._isSundayApplied) {
      // Mode turned OFF while Sunday state was active – restore normal state immediately
      const ns = settings.normalState || {};
      settings.link1 = ns.link1 ?? true;
      settings.link2 = ns.link2 ?? true;
      settings.link3 = ns.link3 ?? true;
      settings.link4 = ns.link4 ?? true;
      settings.link5 = ns.link5 ?? true;

      settings._isSundayApplied = false;
      await settings.safeSave();
    }
  }
  return settings;
};

// Helper: get array of active link numbers
LinkSettingsSchema.methods.getActiveLinks = function () {
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