// models/AdSlot.cjs - FINAL VERSION
const mongoose = require('mongoose');

const adSlotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  position: { 
    type: String, 
    required: true,
    enum: ['header', 'sidebar', 'in_content', 'sticky_footer', 'popup'],
    unique: true
  },
  adCode: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  displayRules: {
    maxPerPage: { type: Number, default: 1 },
    devices: { type: [String], default: ['desktop', 'mobile'] }
  },
  earnings: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 }
}, { timestamps: true });

// ✅ AUTO-CREATE DEFAULT AD SLOTS
adSlotSchema.statics.initDefaultSlots = async function() {
  const defaultSlots = [
    { name: 'Header Banner', position: 'header' },
    { name: 'Sidebar Ad', position: 'sidebar' },
    { name: 'In-Content Ad', position: 'in_content' },
    { name: 'Sticky Footer', position: 'sticky_footer' },
    { name: 'Popup Ad', position: 'popup' }
  ];

  for (const slot of defaultSlots) {
    const existing = await this.findOne({ position: slot.position });
    if (!existing) {
      await this.create(slot);
      console.log(`✅ Created default ad slot: ${slot.name}`);
    }
  }
};

module.exports = mongoose.models.AdSlot || mongoose.model('AdSlot', adSlotSchema);

// ✅ INITIALIZE DEFAULT SLOTS
const AdSlot = module.exports;
AdSlot.initDefaultSlots().catch(console.error);