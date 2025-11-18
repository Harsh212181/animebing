// models/Analytics.cjs - COMPREHENSIVE ANALYTICS SYSTEM
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  pageViews: { 
    type: Number, 
    default: 0 
  },
  uniqueVisitors: { 
    type: Number, 
    default: 0 
  },
  adClicks: { 
    type: Number, 
    default: 0 
  },
  earnings: { 
    type: Number, 
    default: 0 
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  referrer: {
    type: String,
    default: 'Direct'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  operatingSystem: {
    type: String,
    default: 'Unknown'
  },
  visitorIPs: [{
    type: String
  }]
}, { 
  timestamps: true 
});

// ✅ Daily summary index for faster queries
analyticsSchema.index({ date: 1 }, { unique: true });

// ✅ Static method to get today's analytics
analyticsSchema.statics.getToday = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.findOne({ date: today });
};

// ✅ Static method to record a visit
analyticsSchema.statics.recordVisit = async function(req, earnings = 0) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers.referer || 'Direct';
    
    // Simple device detection (in production use proper library)
    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    // Simple browser detection
    let browser = 'Unknown';
    if (/Chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Safari/i.test(userAgent)) browser = 'Safari';
    else if (/Edge/i.test(userAgent)) browser = 'Edge';
    
    // Simple OS detection
    let os = 'Unknown';
    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Macintosh/i.test(userAgent)) os = 'macOS';
    else if (/Linux/i.test(userAgent)) os = 'Linux';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';

    // Get or create today's record
    let analytics = await this.findOne({ date: today });
    
    if (!analytics) {
      analytics = new this({ 
        date: today,
        uniqueVisitors: 1,
        pageViews: 1,
        deviceType,
        country: 'India', // Default for demo
        referrer,
        browser,
        operatingSystem: os,
        earnings,
        visitorIPs: [ip]
      });
    } else {
      analytics.pageViews += 1;
      analytics.earnings += earnings;
      // ✅ FIX: Better unique visitor tracking
      if (!analytics.visitorIPs.includes(ip)) {
        analytics.uniqueVisitors += 1;
        analytics.visitorIPs.push(ip);
      }
    }
    
    await analytics.save();
    return analytics;
  } catch (error) {
    console.error('Analytics recording error:', error);
  }
};

module.exports = mongoose.models.Analytics || mongoose.model('Analytics', analyticsSchema);