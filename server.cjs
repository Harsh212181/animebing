 // server.cjs - FIXED VERSION WITH PATH-TO-REGEXP ERROR RESOLVED
const express = require('express');
const cors = require('cors');
const connectDB = require('./db.cjs');
require('dotenv').config();

const Analytics = require('./models/Analytics.cjs');
const { generalLimiter, authLimiter, adminLimiter, apiLimiter } = require('./middleware/rateLimit.cjs');

// ✅ IMPORT MIDDLEWARE AND ROUTES - MOVE TO TOP
const adminAuth = require('./middleware/adminAuth.cjs');
const animeRoutes = require('./routes/animeRoutes.cjs');
const episodeRoutes = require('./routes/episodeRoutes.cjs');
const chapterRoutes = require('./routes/chapterRoutes.cjs');
const reportRoutes = require('./routes/reportRoutes.cjs');
const socialRoutes = require('./routes/socialRoutes.cjs');
const appDownloadRoutes = require('./routes/appDownloadRoutes.cjs');
const adRoutes = require('./routes/adRoutes.cjs');
const adminRoutes = require('./routes/adminRoutes.cjs');
const contactRoutes = require('./routes/contactRoutes.cjs');

const app = express();

// ✅ FIXED CORS CONFIGURATION - YAHI MAIN PROBLEM THI
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://rainbow-sfogliatella-b724c0.netlify.app',
    'https://animabing.onrender.com',
    'https://*.netlify.app',
    'https://*.render.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ✅ FIXED: PRE-FLIGHT REQUESTS HANDLING - Use regex pattern instead of '*'
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(express.static('public'));

// Database Connection
connectDB();

// ✅ RATE LIMITING MIDDLEWARE
app.use('/api/', apiLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/protected', adminLimiter);

// ✅ ANALYTICS TRACKING MIDDLEWARE
app.use((req, res, next) => {
  if (req.path === '/' || 
      req.path.includes('/anime') || 
      req.path.includes('/api/anime') ||
      req.path.includes('/search')) {
    Analytics.recordVisit(req, 0);
  }
  next();
});

// ✅ FIXED ADMIN CREATION FUNCTION
const createAdmin = async () => {
  try {
    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    const username = process.env.ADMIN_USER || 'Hellobrother';
    const password = process.env.ADMIN_PASS || 'Anime2121818144';
    
    console.log('🔄 Checking admin user...');
    
    let admin = await Admin.findOne({ username });
    
    if (!admin) {
      console.log('🆕 Creating new admin user...');
      const hashedPassword = await bcrypt.hash(password, 12);
      
      admin = await Admin.create({
        username: username,
        password: hashedPassword,
        email: 'admin@animabing.com',
        role: 'admin'
      });
      
      console.log('✅ Admin user created successfully!');
    } else {
      console.log('✅ Admin user already exists');
      
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash(password, 12);
      admin.password = hashedPassword;
      await admin.save();
      console.log('🔁 Admin password updated');
    }
    
    console.log('=================================');
    console.log('🔑 ADMIN LOGIN CREDENTIALS:');
    console.log('   Username:', username);
    console.log('   Password:', password);
    console.log('   Login URL: http://localhost:5173');
    console.log('   Press Ctrl+Shift+Alt for admin button');
    console.log('=================================');
    
  } catch (err) {
    console.error('❌ ADMIN CREATION ERROR:', err);
    console.log('💡 TROUBLESHOOTING:');
    console.log('1. Check MongoDB connection');
    console.log('2. Check bcrypt installation: npm install bcryptjs');
    console.log('3. Check environment variables in .env file');
  }
};
createAdmin();

// ✅ EMERGENCY ADMIN RESET ROUTE
app.get('/api/admin/emergency-reset', async (req, res) => {
  try {
    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    console.log('🆕 EMERGENCY ADMIN RESET INITIATED...');
    
    // Delete any existing admin
    await Admin.deleteMany({});
    console.log('✅ Cleared existing admin users');
    
    // Create new admin with hashed password
    const hashedPassword = await bcrypt.hash('Anime2121818144', 12);
    const admin = new Admin({
      username: 'Hellobrother',
      password: hashedPassword,
      email: 'admin@animabing.com',
      role: 'superadmin'
    });
    
    await admin.save();
    console.log('✅ EMERGENCY ADMIN CREATED SUCCESSFULLY!');
    
    res.json({ 
      success: true, 
      message: '✅ EMERGENCY: Admin account created successfully!',
      credentials: {
        username: 'Hellobrother',
        password: 'Anime2121818144'
      },
      instructions: 'Use these credentials to login at /admin route'
    });
    
  } catch (error) {
    console.error('❌ EMERGENCY ADMIN RESET ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Check MongoDB connection and bcrypt installation'
    });
  }
});

// ✅ ADMIN DEBUG ROUTE
app.get('/api/admin/debug', async (req, res) => {
  try {
    const Admin = require('./models/Admin.cjs');
    
    const adminCount = await Admin.countDocuments();
    const allAdmins = await Admin.find().select('username email createdAt');
    
    console.log('🔍 ADMIN DEBUG INFO:');
    console.log('Total Admins:', adminCount);
    console.log('Admin List:', allAdmins);
    
    res.json({
      success: true,
      totalAdmins: adminCount,
      admins: allAdmins,
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    console.error('Admin debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ EMERGENCY ADMIN CREATION ROUTE
app.get('/api/admin/create-default-admin', async (req, res) => {
  try {
    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    console.log('🆕 EMERGENCY: Creating default admin user...');
    
    // Delete existing admin if any
    await Admin.deleteMany({ username: 'Hellobrother' });
    
    // Create new admin
    const hashedPassword = await bcrypt.hash('Anime2121818144', 12);
    const admin = new Admin({
      username: 'Hellobrother',
      password: hashedPassword,
      email: 'admin@animabing.com',
      role: 'admin'
    });
    
    await admin.save();
    
    console.log('✅ EMERGENCY ADMIN CREATED:', admin.username);
    
    res.json({ 
      success: true, 
      message: '✅ EMERGENCY: Admin created successfully!',
      credentials: {
        username: 'Hellobrother',
        password: 'Anime2121818144'
      },
      instructions: 'Use these credentials to login at your frontend admin panel'
    });
  } catch (error) {
    console.error('❌ EMERGENCY Admin creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// ✅ FIXED ADMIN LOGIN ROUTE
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('\n🔐 LOGIN ATTEMPT:', { 
      username, 
      hasPassword: !!password,
      timestamp: new Date().toISOString()
    });
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Username and password required' 
      });
    }

    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    // Find admin
    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.log('❌ Admin not found:', username);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid username or password' 
      });
    }

    console.log('🔑 Admin found, comparing passwords...');
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('✅ Password match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: admin._id, 
        username: admin.username,
        role: admin.role 
      }, 
      process.env.JWT_SECRET || 'supersecretkey', 
      { expiresIn: '24h' }
    );

    console.log('🎉 LOGIN SUCCESSFUL for:', username);
    
    res.json({ 
      success: true, 
      message: 'Login successful', 
      token, 
      username: admin.username,
      role: admin.role
    });
    
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error during login' 
    });
  }
});

// ✅ AD CLICK TRACKING ROUTE
app.post('/api/admin/protected/track-ad-click', adminAuth, async (req, res) => {
  try {
    const { slotId, earnings } = req.body;
    
    const AdSlot = require('./models/AdSlot.cjs');
    const Analytics = require('./models/Analytics.cjs');
    
    const updatedSlot = await AdSlot.findByIdAndUpdate(
      slotId,
      {
        $inc: {
          clicks: 1,
          earnings: earnings || 0.5
        }
      },
      { new: true }
    );

    await Analytics.recordVisit(req, earnings || 0.5);

    res.json({
      success: true,
      message: 'Ad click tracked',
      adSlot: updatedSlot
    });
  } catch (error) {
    console.error('Ad tracking error:', error);
    res.status(500).json({ error: 'Failed to track ad click' });
  }
});

// ✅ Social media API
app.get('/api/social', async (req, res) => {
  try {
    const SocialMedia = require('./models/SocialMedia.cjs');
    const socialLinks = await SocialMedia.find({ isActive: true });
    res.json(socialLinks);
  } catch (error) {
    console.error('Social media API error:', error);
    res.json([
      {
        platform: 'facebook',
        url: 'https://facebook.com/animabing',
        isActive: true,
        icon: 'facebook',
        displayName: 'Facebook'
      },
      {
        platform: 'instagram', 
        url: 'https://instagram.com/animabing',
        isActive: true,
        icon: 'instagram',
        displayName: 'Instagram'
      },
      {
        platform: 'telegram',
        url: 'https://t.me/animabing', 
        isActive: true,
        icon: 'telegram',
        displayName: 'Telegram'
      }
    ]);
  }
});

// ✅ App downloads API
app.get('/api/app-downloads', async (req, res) => {
  try {
    const AppDownload = require('./models/AppDownload.cjs');
    const appDownloads = await AppDownload.find({ isActive: true });
    res.json(appDownloads);
  } catch (error) {
    console.error('App downloads API error:', error);
    res.json([]);
  }
});

// ✅ EPISODES BY ANIME ID ROUTE - ADDED
app.get('/api/episodes/:animeId', async (req, res) => {
  try {
    const { animeId } = req.params;
    console.log('📺 Fetching episodes for anime:', animeId);
    
    const Episode = require('./models/Episode.cjs');
    const episodes = await Episode.find({ animeId }).sort({ session: 1, episodeNumber: 1 });
    
    console.log(`✅ Found ${episodes.length} episodes for anime ${animeId}`);
    res.json(episodes);
  } catch (error) {
    console.error('Episodes fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PROTECTED ADMIN ROUTES
app.use('/api/admin/protected', adminAuth, adminRoutes);

// ✅ PUBLIC ROUTES
app.use('/api/anime', animeRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/app-downloads', appDownloadRoutes);
app.use('/api/ads', adRoutes);
app.use('/api', contactRoutes);

// ✅ DEBUG ROUTES (KEEP FOR TROUBLESHOOTING)
app.get('/api/debug/episodes', async (req, res) => {
  try {
    const Episode = require('./models/Episode.cjs');
    const Anime = require('./models/Anime.cjs');
    
    const allEpisodes = await Episode.find().populate('animeId', 'title');
    
    console.log('📋 ALL EPISODES IN DATABASE:');
    allEpisodes.forEach(ep => {
      console.log(`- ${ep.animeId?.title || 'NO ANIME'} | EP ${ep.episodeNumber} | Session ${ep.session} | AnimeID: ${ep.animeId?._id}`);
    });
    
    res.json({
      totalEpisodes: allEpisodes.length,
      episodes: allEpisodes
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/anime/:animeId', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    const Episode = require('./models/Episode.cjs');
    
    const animeId = req.params.animeId;
    const anime = await Anime.findById(animeId);
    const episodes = await Episode.find({ animeId });
    
    console.log('🔍 DEBUG ANIME:');
    console.log('Anime Title:', anime?.title);
    console.log('Anime ID:', anime?._id);
    console.log('Requested ID:', animeId);
    console.log('Episodes found:', episodes.length);
    
    res.json({
      anime: anime,
      episodes: episodes,
      animeId: animeId,
      episodesCount: episodes.length
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/animes', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    const animes = await Anime.find().select('title _id contentType');
    
    console.log('📺 ALL ANIMES IN DATABASE:');
    animes.forEach(anime => {
      console.log(`- ${anime.title} | ID: ${anime._id} | Type: ${anime.contentType}`);
    });
    
    res.json({
      totalAnimes: animes.length,
      animes: animes
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Animabing Server Running',
    timestamp: new Date().toISOString()
  });
});

// ✅ FEATURED ANIME TEST ROUTE - PROPERLY DEFINED
app.get('/api/test/featured', async (req, res) => {
  try {
    console.log('🎯 Test featured route hit');
    const Anime = require('./models/Anime.cjs');
    
    // Get some featured anime for testing
    const featured = await Anime.find({ featured: true })
      .select('title thumbnail releaseYear subDubStatus')
      .limit(6)
      .lean();
    
    console.log(`✅ Found ${featured.length} featured anime for testing`);
    
    res.json({
      success: true,
      data: featured,
      message: `Found ${featured.length} featured anime for testing`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test featured error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// ✅ SIMPLE FEATURED TEST ROUTE (BACKUP)
app.get('/api/featured-test', (req, res) => {
  res.json({
    success: true,
    message: 'Featured test route is working!',
    data: [
      {
        id: 'test-1',
        title: 'Test Anime 1',
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Test+1',
        releaseYear: 2023,
        subDubStatus: 'Hindi Dub'
      },
      {
        id: 'test-2', 
        title: 'Test Anime 2',
        thumbnail: 'https://via.placeholder.com/300x400/374151/FFFFFF?text=Test+2',
        releaseYear: 2023,
        subDubStatus: 'Hindi Sub'
      }
    ]
  });
});

// ✅ ROOT
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Animabing - Anime & Movies</title>
      <style>
        body {
          background: #0a0c1c;
          color: white;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 {
          color: #8B5CF6;
          margin-bottom: 1rem;
        }
        a {
          color: #8B5CF6;
          text-decoration: none;
          font-weight: bold;
          margin: 0 10px;
        }
        a:hover {
          text-decoration: underline;
        }
        .cors-info {
          background: #1a1c2c;
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          text-align: left;
        }
        .test-links {
          margin: 1rem 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Animabing Server</h1>
        <p>✅ Backend API is running correctly</p>
        <p>📺 Frontend: <a href="https://rainbow-sfogliatella-b724c0.netlify.app" target="_blank">Netlify</a></p>
        <p>⚙️ Admin Access: Press Ctrl+Shift+Alt on the frontend</p>
        
        <div class="test-links">
          <h3>🔧 Test Routes:</h3>
          <p>
            <a href="/api/health">Health Check</a> | 
            <a href="/api/test/featured">Test Featured</a> | 
            <a href="/api/featured-test">Simple Test</a>
          </p>
        </div>
        
        <div class="cors-info">
          <h3>🔒 CORS Configuration:</h3>
          <ul>
            <li>✅ Localhost:5173 - Allowed</li>
            <li>✅ Localhost:3000 - Allowed</li>
            <li>✅ Netlify Frontend - Allowed</li>
            <li>✅ Render Backend - Allowed</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// ✅ START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Admin: ${process.env.ADMIN_USER} / ${process.env.ADMIN_PASS}`);
  console.log(`🌐 Frontend: https://rainbow-sfogliatella-b724c0.netlify.app`);
  console.log(`🔗 API: https://animabing.onrender.com/api`);
  console.log(`🔒 CORS: Enabled for all required domains`);
  console.log(`🧪 Test Routes:`);
  console.log(`   - https://animabing.onrender.com/api/health`);
  console.log(`   - https://animabing.onrender.com/api/test/featured`);
  console.log(`   - https://animabing.onrender.com/api/featured-test`);
});
