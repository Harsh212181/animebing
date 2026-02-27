 // server.cjs - UPDATED WITH PRODUCTION-SAFE TRUST PROXY + PARTNER ROUTES + DEVICE-BASED POLL VOTING
const express = require('express');
const cors = require('cors');
const connectDB = require('./db.cjs');
require('dotenv').config();

const Analytics = require('./models/Analytics.cjs');
const { generalLimiter, authLimiter, adminLimiter, apiLimiter } = require('./middleware/rateLimit.cjs');

// ✅ IMPORT MIDDLEWARE AND ROUTES
const adminAuth = require('./middleware/adminAuth.cjs');
const animeRoutes = require('./routes/animeRoutes.cjs');
const episodeRoutes = require('./routes/episodeRoutes.cjs');
const chapterRoutes = require('./routes/chapterRoutes.cjs');
const reportRoutes = require('./routes/reportRoutes.cjs');
const socialRoutes = require('./routes/socialRoutes.cjs');
const appDownloadRoutes = require('./routes/appDownloadRoutes.cjs');
const adminRoutes = require('./routes/adminRoutes.cjs');
const contactRoutes = require('./routes/contactRoutes.cjs');

// ✅ POLL ROUTES ADDED HERE
const pollRoutes = require('./routes/pollRoutes.cjs');

// ✅ IMPORTANT: Add this line
const linkSettingsRoutes = require('./routes/linkSettingsRoutes.cjs');

// ✅ NEW: PARTNER ROUTES (Partner Manager)
const partnerRoutes = require('./routes/partnerRoutes.cjs');

// ✅ FIX: IMPORT SITEMAP ROUTES (MISSING BEFORE)
const sitemapRoutes = require('./routes/sitemapRoutes.cjs');

const app = express();

// ✅ CRITICAL FIX: TRUST PROXY ONLY IN PRODUCTION (safe for express-rate-limit)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);  // trust first proxy
} // else: no trust proxy in development → no ERR_ERL_PERMISSIVE_TRUST_PROXY

app.use(cors());

// ✅ FIX: INCREASE BODY LIMIT FOR IMAGE URLS AND POLL DATA
app.use(express.json({ limit: '50mb' })); // 50MB तक की data allow करें
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// ✅ FIX: MOUNT SITEMAP ROUTES AT ROOT
// This makes /sitemap.xml (index), /sitemap-static.xml, /sitemap-anime.xml, /sitemap-episodes.xml available
app.use('/', sitemapRoutes);

// ✅ REMOVED THE OLD /sitemap.xml ROUTE (it conflicted and was incomplete)
// The sitemap index from sitemapRoutes.cjs now handles everything properly.

// ✅ ROBOTS.TXT (For SEO)
app.get('/robots.txt', (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/
Disallow: /download/ # Added to prevent crawling download pages
Sitemap: https://animebing.in/sitemap.xml

# SEO Instructions for Google
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 2

# Block bad bots
User-agent: AhrefsBot
Disallow: /
User-agent: SemrushBot
Disallow: /

# SEO Sitemaps
Sitemap: https://animebing.in/sitemap.xml
Sitemap: https://animebing.in/rss.xml`;
  
  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

// ✅ RSS FEED FOR SEO
app.get('/rss.xml', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    
    const recentAnime = await Anime.find({})
      .select('title description thumbnail slug seoDescription updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    
    const currentDate = new Date().toUTCString();
    
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AnimeBing - Latest Anime Updates</title>
    <link>https://animebing.in</link>
    <description>Watch anime online in Hindi and English. Latest anime episodes and movies.</description>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="https://animebing.in/rss.xml" rel="self" type="application/rss+xml" />\n`;
    
    recentAnime.forEach(anime => {
      const pubDate = anime.updatedAt ? new Date(anime.updatedAt).toUTCString() : currentDate;
      const description = anime.seoDescription || anime.description || `Watch ${anime.title} online`;
      const animeSlug = anime.slug || anime._id;
      
      rss += `    <item>
      <title><![CDATA[${anime.title}]]></title>
      <link>https://animebing.in/detail/${animeSlug}</link>
      <guid>https://animebing.in/detail/${animeSlug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
      <enclosure url="${anime.thumbnail || ''}" type="image/jpeg" />
    </item>\n`;
    });
    
    rss += `  </channel>
</rss>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(rss);
    
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

// ✅ FIXED ADMIN CREATION FUNCTION (unchanged)
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

// ✅ EMERGENCY ADMIN RESET ROUTE (unchanged)
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

// ✅ ADMIN DEBUG ROUTE (unchanged)
app.get('/api/admin/debug', async (req, res) => {
  try {
    const Admin = require('./models/Admin.cjs');
    const LinkSettings = require('./models/LinkSettings.cjs');
    
    const adminCount = await Admin.countDocuments();
    const allAdmins = await Admin.find().select('username email createdAt');
    const linkSettings = await LinkSettings.getSettings();
    
    console.log('🔍 ADMIN DEBUG INFO:');
    console.log('Total Admins:', adminCount);
    console.log('Admin List:', allAdmins);
    console.log('Link Settings:', linkSettings.getActiveLinks());
    
    res.json({
      success: true,
      totalAdmins: adminCount,
      admins: allAdmins,
      linkSettings: {
        ...linkSettings.toObject(),
        activeLinks: linkSettings.getActiveLinks()
      },
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

// ✅ EMERGENCY ADMIN CREATION ROUTE (unchanged)
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

// ✅ FIXED ADMIN LOGIN ROUTE (unchanged)
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

// ✅ App downloads API (unchanged)
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

// ✅ EPISODES BY ANIME ID ROUTE - ADDED (unchanged)
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

// ============================================
// ✅ PUBLIC ROUTES - UPDATED ORDER
// ============================================

// ✅ LINK SETTINGS ROUTES
app.use('/api/link-settings', linkSettingsRoutes);
console.log('✅ Link Settings Routes mounted at /api/link-settings');

// ✅ SOCIAL MEDIA ROUTES
app.use('/api/social', socialRoutes);

// ✅ POLL ROUTES
app.use('/api/poll', pollRoutes);
console.log('✅ Poll Routes mounted at /api/poll (device-based voting)');

// ✅ ANIME ROUTES (MUST BE BEFORE ADMIN PROTECTED ROUTES)
app.use('/api/anime', animeRoutes);

// ✅ OTHER PUBLIC ROUTES
app.use('/api/episodes', episodeRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/app-downloads', appDownloadRoutes);
app.use('/api', contactRoutes);

// ============================================
// ✅ PROTECTED ADMIN ROUTES
// ============================================
app.use('/api/admin/protected', adminAuth, adminRoutes);

// ✅ NEW: PARTNER ROUTES (Partner Manager) - Admin Protected
app.use('/api/partners', partnerRoutes);
console.log('✅ Partner Routes mounted at /api/partners');

// ============================================
// ✅ DEBUG ROUTES (KEEP FOR TROUBLESHOOTING)
// ============================================
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

app.get('/api/debug/link-settings', async (req, res) => {
  try {
    const LinkSettings = require('./models/LinkSettings.cjs');
    
    const settings = await LinkSettings.getSettings();
    const activeLinks = settings.getActiveLinks();
    
    console.log('🔗 LINK SETTINGS DEBUG:');
    console.log('Link 1 Active:', settings.link1);
    console.log('Link 2 Active:', settings.link2);
    console.log('Link 3 Active:', settings.link3);
    console.log('Link 4 Active:', settings.link4);
    console.log('Link 5 Active:', settings.link5);
    console.log('Active Links:', activeLinks);
    
    res.json({
      success: true,
      settings: settings,
      activeLinks: activeLinks,
      totalActive: activeLinks.length
    });
  } catch (error) {
    console.error('Link settings debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ SOCIAL MEDIA DEBUG ROUTE (unchanged)
app.get('/api/debug/social', async (req, res) => {
  try {
    const SocialMedia = require('./models/SocialMedia.cjs');
    
    const allLinks = await SocialMedia.find().sort({ platform: 1 });
    const activeLinks = await SocialMedia.find({ isActive: true });
    
    console.log('🔗 SOCIAL MEDIA DEBUG:');
    console.log('Total Links:', allLinks.length);
    console.log('Active Links:', activeLinks.length);
    
    allLinks.forEach(link => {
      console.log(`- ${link.platform}: ${link.url} [${link.isActive ? 'Active' : 'Inactive'}]`);
    });
    
    res.json({
      success: true,
      totalLinks: allLinks.length,
      activeLinks: activeLinks.length,
      allLinks: allLinks,
      activeLinks: activeLinks
    });
  } catch (error) {
    console.error('Social media debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ POLL SYSTEM DEBUG ROUTE (unchanged)
app.get('/api/debug/polls', async (req, res) => {
  try {
    const Poll = require('./models/Poll.cjs');
    
    const allPolls = await Poll.find().sort({ createdAt: -1 });
    const activePolls = await Poll.find({ isActive: true }).sort({ createdAt: -1 });
    
    console.log('🗳️ POLL SYSTEM DEBUG:');
    console.log('Total Polls:', allPolls.length);
    console.log('Active Polls:', activePolls.length);
    
    allPolls.forEach(poll => {
      console.log(`- "${poll.question}" [${poll.isActive ? 'Active' : 'Inactive'}] - ${poll.options.length} options - ${poll.totalVotes || 0} votes (voters: ${poll.voters?.length || 0})`);
    });
    
    res.json({
      success: true,
      totalPolls: allPolls.length,
      activePolls: activePolls.length,
      allPolls: allPolls,
      activePolls: activePolls
    });
  } catch (error) {
    console.error('Poll debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ NEW: LIKE/DISLIKE SYSTEM DEBUG ROUTE (unchanged)
app.get('/api/debug/vote-system', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    
    const totalAnime = await Anime.countDocuments();
    const animeWithVotes = await Anime.find({ 
      $or: [
        { likes: { $gt: 0 } },
        { dislikes: { $gt: 0 } }
      ]
    }).select('title likes dislikes monthlyLikes weeklyLikes totalVotes');
    
    const totalLikes = animeWithVotes.reduce((sum, anime) => sum + (anime.likes || 0), 0);
    const totalDislikes = animeWithVotes.reduce((sum, anime) => sum + (anime.dislikes || 0), 0);
    
    console.log('👍👎 LIKE/DISLIKE SYSTEM DEBUG:');
    console.log('Total Anime:', totalAnime);
    console.log('Anime with votes:', animeWithVotes.length);
    console.log('Total Likes:', totalLikes);
    console.log('Total Dislikes:', totalDislikes);
    
    // Sample top 5 anime by likes
    const topAnime = await Anime.find()
      .select('title likes dislikes monthlyLikes weeklyLikes')
      .sort({ likes: -1 })
      .limit(5)
      .lean();
    
    res.json({
      success: true,
      stats: {
        totalAnime,
        animeWithVotes: animeWithVotes.length,
        totalLikes,
        totalDislikes,
        totalVotes: totalLikes + totalDislikes
      },
      endpoints: {
        getVoteStatus: 'GET /api/anime/:id/vote-status',
        submitVote: 'POST /api/anime/:id/vote',
        animeStatistics: 'GET /api/anime/:id/statistics',
        top100: 'GET /api/anime/top100'
      },
      sampleTopAnime: topAnime
    });
  } catch (error) {
    console.error('Vote system debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ TEST LIKE/DISLIKE API (unchanged)
app.get('/api/test-vote-system', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    
    // Get first anime to test
    const testAnime = await Anime.findOne().select('_id title slug');
    
    if (!testAnime) {
      return res.json({
        success: false,
        message: 'No anime found to test'
      });
    }
    
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    res.json({
      success: true,
      message: 'Like/Dislike System Test Endpoint',
      testAnime: {
        id: testAnime._id,
        title: testAnime.title,
        slug: testAnime.slug
      },
      clientIP: clientIP,
      testEndpoints: {
        getVoteStatus: `GET /api/anime/${testAnime._id}/vote-status`,
        submitLike: `POST /api/anime/${testAnime._id}/vote - Body: {"voteType": "like"}`,
        submitDislike: `POST /api/anime/${testAnime._id}/vote - Body: {"voteType": "dislike"}`,
        getStatistics: `GET /api/anime/${testAnime._id}/statistics`
      },
      note: 'IP address is automatically captured from request headers'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ✅ HEALTH CHECK WITH SEO INFO (unchanged)
app.get('/api/health', async (req, res) => {
  try {
    const LinkSettings = require('./models/LinkSettings.cjs');
    const Poll = require('./models/Poll.cjs');
    const Anime = require('./models/Anime.cjs');
    
    const settings = await LinkSettings.getSettings();
    const activeLinks = settings.getActiveLinks();
    const activePolls = await Poll.countDocuments({ isActive: true });
    const totalPolls = await Poll.countDocuments();
    const totalAnime = await Anime.countDocuments();
    const animeWithVotes = await Anime.countDocuments({ $or: [{ likes: { $gt: 0 } }, { dislikes: { $gt: 0 } }] });
    
    res.json({ 
      status: 'OK', 
      message: 'Animabing Server Running - SEO OPTIMIZED + POLL SYSTEM (DEVICE-BASED) + LIKE/DISLIKE + PARTNER MANAGER',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      linkSettings: {
        activeLinks: activeLinks,
        totalLinks: 5,
        settings: {
          link1: settings.link1,
          link2: settings.link2,
          link3: settings.link3,
          link4: settings.link4,
          link5: settings.link5
        }
      },
      pollSystem: {
        totalPolls: totalPolls,
        activePolls: activePolls,
        votingMechanism: 'device-based (UUID stored in localStorage)',
        endpoints: {
          activePoll: 'GET /api/poll/active?deviceId=xxx',
          submitVote: 'POST /api/poll/vote (with deviceId in body)',
          createPoll: 'POST /api/poll/admin/create (admin)',
          allPolls: 'GET /api/poll/admin/all (admin)'
        }
      },
      likeDislikeSystem: {
        totalAnime: totalAnime,
        animeWithVotes: animeWithVotes,
        endpoints: {
          getVoteStatus: 'GET /api/anime/:id/vote-status',
          submitVote: 'POST /api/anime/:id/vote',
          getStatistics: 'GET /api/anime/:id/statistics',
          top100: 'GET /api/anime/top100'
        }
      },
      partnerManager: {
        endpoints: {
          getAll: 'GET /api/partners',
          create: 'POST /api/partners',
          delete: 'DELETE /api/partners/:id',
          getAnime: 'GET /api/partners/:id/anime',
          assignAnime: 'POST /api/partners/:id/anime',
          removeAnime: 'DELETE /api/partners/:id/anime/:animeId'
        }
      },
      seoFeatures: {
        sitemap: 'https://animebing.in/sitemap.xml',
        robots: 'https://animebing.in/robots.txt',
        rssFeed: 'https://animebing.in/rss.xml',
        dynamicUrls: 'Enabled',
        structuredData: 'Enabled',
        linkControl: 'Enabled',
        pollSystem: 'Enabled (device-based)',
        likeDislike: 'Enabled',
        partnerManager: 'Enabled'
      },
      serverConfig: {
        bodyLimit: '50MB',
        cors: 'Enabled',
        rateLimiting: 'Enabled',
        pollLimit: '10 options per poll',
        trustProxy: process.env.NODE_ENV === 'production' ? 'Enabled (1 hop)' : 'Disabled (development)',
        ipDetection: 'Automatic from request (for like/dislike)',
        deviceIdDetection: 'Client-generated UUID (for polls)'
      },
      seoWarning: '✅ Search query URLs REMOVED from sitemap to avoid Google penalties'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Server error',
      error: error.message 
    });
  }
});

// ✅ TEST ENDPOINT FOR LINK SETTINGS (unchanged)
app.get('/api/test-link-settings', async (req, res) => {
  try {
    const LinkSettings = require('./models/LinkSettings.cjs');
    const settings = await LinkSettings.getSettings();
    
    res.json({
      success: true,
      message: 'Link settings test endpoint working',
      settings: settings,
      activeLinks: settings.getActiveLinks(),
      totalActive: settings.getActiveLinks().length,
      testEndpoints: {
        getAll: 'GET /api/link-settings',
        toggleLink: 'PUT /api/link-settings/toggle/1',
        getStatus: 'GET /api/link-settings/status'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ✅ TEST ENDPOINT FOR POLL SYSTEM (unchanged)
app.get('/api/test-poll-system', async (req, res) => {
  try {
    const Poll = require('./models/Poll.cjs');
    
    const activePoll = await Poll.findOne({ isActive: true });
    const totalPolls = await Poll.countDocuments();
    
    res.json({
      success: true,
      message: 'Poll system test endpoint working (device-based voting)',
      pollStatus: {
        totalPolls: totalPolls,
        hasActivePoll: !!activePoll,
        activePoll: activePoll ? {
          question: activePoll.question,
          options: activePoll.options.length,
          votes: activePoll.totalVotes || 0,
          voters: activePoll.voters?.length || 0
        } : null
      },
      endpoints: {
        getActivePoll: 'GET /api/poll/active?deviceId=xxx',
        submitVote: 'POST /api/poll/vote (with deviceId in body)',
        adminCreate: 'POST /api/poll/admin/create',
        adminAll: 'GET /api/poll/admin/all'
      },
      note: 'Device ID is generated on the client and stored in localStorage. No IP addresses are stored.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ✅ EMERGENCY: SET ALL ANIME AS FEATURED ROUTE (unchanged)
app.get('/api/emergency/set-all-featured', async (req, res) => {
  try {
    const Anime = require('./models/Anime.cjs');
    
    console.log('🆕 EMERGENCY: Setting ALL anime as featured...');
    
    const result = await Anime.updateMany(
      {}, 
      { 
        $set: { 
          featured: true,
          featuredOrder: 1 
        } 
      }
    );
    
    console.log(`✅ Set ${result.modifiedCount} anime as featured`);
    
    const featuredAnime = await Anime.find({ featured: true })
      .select('title featured featuredOrder')
      .limit(10)
      .lean();
    
    res.json({ 
      success: true, 
      message: `Set ${result.modifiedCount} anime as featured`,
      modifiedCount: result.modifiedCount,
      sampleFeatured: featuredAnime
    });
    
  } catch (error) {
    console.error('❌ Emergency featured error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ EMERGENCY: RESET SOCIAL MEDIA LINKS (unchanged)
app.get('/api/emergency/reset-social', async (req, res) => {
  try {
    const SocialMedia = require('./models/SocialMedia.cjs');
    
    console.log('🆕 EMERGENCY: Resetting social media links...');
    
    // Delete all existing social media links
    await SocialMedia.deleteMany({});
    
    // Initialize default links
    await SocialMedia.initDefaultLinks();
    
    const links = await SocialMedia.find().sort({ platform: 1 });
    
    console.log('✅ Social media links reset to defaults');
    
    res.json({
      success: true,
      message: 'Social media links reset to default (Facebook, Instagram, Telegram)',
      links: links
    });
  } catch (error) {
    console.error('❌ Social media reset error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ EMERGENCY: FIX SOCIAL MEDIA LINKS WITH CORRECT URLS (NEW ROUTE) (unchanged)
app.get('/api/emergency/fix-social-urls', async (req, res) => {
  try {
    const SocialMedia = require('./models/SocialMedia.cjs');
    
    console.log('🆕 EMERGENCY: Fixing social media links with correct URLs...');
    
    // Delete all existing social media links
    await SocialMedia.deleteMany({});
    
    // CORRECT LINKS with proper formatting
    const correctLinks = [
      {
        platform: 'instagram',
        url: 'https://instagram.com/animebingofficial', // Removed ?igsh parameter
        isActive: true,
        icon: 'instagram',
        displayName: 'Instagram'
      },
      {
        platform: 'telegram', 
        url: 'https://t.me/animebingofficial', // Fixed typo: animebingofficile -> animebingofficial
        isActive: true,
        icon: 'telegram',
        displayName: 'Telegram'
      },
      {
        platform: 'facebook',
        url: 'https://facebook.com/animebingofficial', // Proper Facebook page link
        isActive: true,
        icon: 'facebook',
        displayName: 'Facebook'
      }
    ];
    
    // Insert the correct links
    await SocialMedia.insertMany(correctLinks);
    console.log('✅ Inserted CORRECTED social media links');
    
    // Verify
    const allLinks = await SocialMedia.find().sort({ platform: 1 });
    
    res.json({
      success: true,
      message: '✅ EMERGENCY: Social media links fixed with CORRECT URLs!',
      note: 'Instagram: Removed ?igsh parameter, Telegram: Fixed typo, Facebook: Changed to page link',
      links: allLinks,
      instructions: 'Now refresh your website and test the social media icons. They will now open correct profiles.'
    });
    
  } catch (error) {
    console.error('❌ Emergency social media fix error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ EMERGENCY: INITIALIZE LINK SETTINGS (unchanged)
app.get('/api/emergency/init-link-settings', async (req, res) => {
  try {
    const LinkSettings = require('./models/LinkSettings.cjs');
    
    console.log('🆕 EMERGENCY: Initializing link settings...');
    
    // Delete existing settings
    await LinkSettings.deleteMany({});
    
    // Create default settings
    const settings = await LinkSettings.create({
      link1: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true
    });
    
    console.log('✅ Link settings initialized');
    
    res.json({
      success: true,
      message: 'Link settings initialized successfully',
      settings: settings,
      activeLinks: settings.getActiveLinks()
    });
  } catch (error) {
    console.error('❌ Link settings init error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ EMERGENCY: INITIALIZE POLL SYSTEM (unchanged)
app.get('/api/emergency/init-poll-system', async (req, res) => {
  try {
    const Poll = require('./models/Poll.cjs');
    
    console.log('🆕 EMERGENCY: Initializing poll system...');
    
    // Delete existing polls
    await Poll.deleteMany({});
    
    // Create sample poll
    const samplePoll = await Poll.create({
      question: "Which anime should we watch next?",
      options: [
        {
          animeId: "sample_1",
          title: "One Piece",
          image: "https://res.cloudinary.com/dqgioy4ys/image/upload/f_webp,q_auto:eco,w_193/v1767165392/WhatsApp_Image_2025-12-31_at_9.12.59_AM_doqp5k.jpg"
        },
        {
          animeId: "sample_2",
          title: "Demon Slayer",
          image: "https://example.com/demon-slayer.jpg"
        }
      ],
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });
    
    console.log('✅ Poll system initialized with sample poll');
    
    res.json({
      success: true,
      message: 'Poll system initialized successfully (device-based voting)',
      samplePoll: {
        question: samplePoll.question,
        options: samplePoll.options.length,
        expiresAt: samplePoll.expiresAt
      },
      endpoints: {
        getActivePoll: 'GET /api/poll/active?deviceId=xxx',
        submitVote: 'POST /api/poll/vote (with deviceId in body)',
        adminCreate: 'POST /api/poll/admin/create',
        adminAll: 'GET /api/poll/admin/all'
      }
    });
  } catch (error) {
    console.error('❌ Poll system init error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// ✅ ROOT ROUTE - SEO OPTIMIZED VERSION
// ============================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>AnimeBing - Watch Anime Online in Hindi & English | Free Anime Streaming</title>
      <meta name="description" content="Watch anime online for free in Hindi Dub, Hindi Sub, and English Sub. HD quality streaming and downloads. Latest anime episodes and movies on AnimeBing.">
      <meta name="keywords" content="watch anime online, hindi anime, english anime, anime in hindi, anime in english, free anime streaming, anime download, anime binge">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="https://animebing.in">
      
      <!-- Open Graph -->
      <meta property="og:title" content="AnimeBing - Watch Anime Online in Hindi & English">
      <meta property="og:description" content="Watch anime online for free in Hindi and English. HD quality streaming and downloads.">
      <meta property="og:image" content="/AnimeBinglogo.jpg">
      <meta property="og:url" content="https://animebing.in">
      <meta property="og:type" content="website">
      
      <!-- Twitter Card -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="AnimeBing - Watch Anime Online in Hindi & English">
      <meta name="twitter:description" content="Watch anime online for free in Hindi and English. HD quality streaming and downloads.">
      <meta name="twitter:image" content="/AnimeBinglogo.jpg">
      
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
          max-width: 800px;
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
        .seo-badge {
          background: #4CAF50;
          color: white;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 10px;
        }
        .section {
          margin: 2rem 0;
          padding: 1rem;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          text-align: left;
        }
        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 1rem;
        }
        .btn {
          background: #8B5CF6;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover {
          background: #7C3AED;
        }
        .status {
          color: #4CAF50;
          font-weight: bold;
        }
        .seo-info {
          background: #1a1c2c;
          padding: 1.5rem;
          border-radius: 10px;
          margin: 1.5rem 0;
          border-left: 4px solid #4CAF50;
        }
        .seo-checklist {
          list-style: none;
          padding: 0;
        }
        .seo-checklist li {
          margin: 8px 0;
          padding-left: 24px;
          position: relative;
        }
        .seo-checklist li:before {
          content: "✅";
          position: absolute;
          left: 0;
          color: #4CAF50;
        }
        .link-status {
          background: #2d3748;
          padding: 10px;
          border-radius: 8px;
          margin: 10px 0;
        }
        .link-status .active {
          color: #4CAF50;
        }
        .link-status .inactive {
          color: #f56565;
        }
        .feature-badge {
          background: #8B5CF6;
          color: white;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10px;
          margin-left: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>AnimeBing Server <span class="seo-badge">SEO OPTIMIZED + LINK CONTROL + POLL SYSTEM (DEVICE-BASED) + LIKE/DISLIKE + PARTNER MANAGER</span></h1>
        <p class="status">✅ Backend API is running correctly - SEO Ready for Google</p>
        <p>📺 Frontend: <a href="https://animebing.in" target="_blank">AnimeBing.in</a></p>
        <p>⚙️ Admin Access: Press Ctrl+Shift+Alt on the frontend</p>
        
        <div class="section">
          <h3>🔗 Global Download Link Settings:</h3>
          <div class="link-status">
            <p>Link 1: <span class="active">ON</span></p>
            <p>Link 2: <span class="active">ON</span></p>
            <p>Link 3: <span class="active">ON</span></p>
            <p>Link 4: <span class="active">ON</span></p>
            <p>Link 5: <span class="active">ON</span></p>
            <p><small>Control these links from Admin Dashboard → Global Link Settings</small></p>
          </div>
        </div>
        
        <div class="section">
          <h3>👍👎 Like/Dislike System <span class="feature-badge">FIXED</span>:</h3>
          <div class="link-status">
            <p>✅ IP address automatically detected</p>
            <p>✅ Trust proxy enabled in production only</p>
            <p>✅ Route order fixed</p>
            <p>✅ Real-time vote updates</p>
            <p>✅ Monthly/Weekly rankings</p>
            <p><small>Users can now like/dislike anime on detail pages</small></p>
          </div>
        </div>
        
        <div class="section">
          <h3>🗳️ Poll/Voting System <span class="feature-badge">DEVICE-BASED</span>:</h3>
          <div class="link-status">
            <p>✅ Poll System Active</p>
            <p>✅ Create polls from admin panel</p>
            <p>✅ Add anime or custom options</p>
            <p>✅ Real-time voting</p>
            <p>✅ Users vote with device ID (no IP stored)</p>
            <p><small>Control polls from Admin Dashboard → Poll Manager</small></p>
          </div>
        </div>
        
        <div class="section">
          <h3>🤝 Partner Manager <span class="feature-badge">NEW</span>:</h3>
          <div class="link-status">
            <p>✅ Create and manage partners</p>
            <p>✅ Assign/remove anime to partners</p>
            <p>✅ Partner-specific anime lists</p>
            <p>✅ Anime count tracking</p>
            <p><small>Control partners from Admin Dashboard → Partner Manager</small></p>
          </div>
        </div>
        
        <div class="seo-info">
          <h3>🔍 SEO Features Enabled:</h3>
          <ul class="seo-checklist">
            <li>Dynamic Sitemap: <a href="/sitemap.xml" target="_blank">/sitemap.xml</a></li>
            <li>Robots.txt: <a href="/robots.txt" target="_blank">/robots.txt</a></li>
            <li>RSS Feed: <a href="/rss.xml" target="_blank">/rss.xml</a></li>
            <li>Dynamic URLs with slugs</li>
            <li>Structured Data (JSON-LD)</li>
            <li>Meta Tags on all pages</li>
            <li>Open Graph & Twitter Cards</li>
            <li>Admin SEO Control Panel</li>
            <li>Global Download Link Control ✅</li>
            <li>Like/Dislike System ✅ <span class="feature-badge">FIXED</span></li>
            <li>Poll/Voting System ✅ <span class="feature-badge">DEVICE-BASED</span></li>
            <li>Partner Manager ✅ <span class="feature-badge">NEW</span></li>
          </ul>
          <p style="color: #4CAF50; margin-top: 10px; font-weight: bold;">
            ✅ LIKE/DISLIKE SYSTEM FIXED: IP detection, route order, and trust proxy configured<br>
            ✅ POLL SYSTEM: Device-based voting (UUID stored in localStorage)
          </p>
        </div>
        
        <div class="section">
          <h3>🚀 Ready for Google Search Console:</h3>
          <p><strong>Steps to submit to Google:</strong></p>
          <ol>
            <li>Go to <a href="https://search.google.com/search-console" target="_blank">Google Search Console</a></li>
            <li>Add property: <code>https://animebing.in</code></li>
            <li>Verify ownership (HTML tag method recommended)</li>
            <li>Submit sitemap: <code>https://animebing.in/sitemap.xml</code></li>
            <li>Wait 24-48 hours for indexing</li>
          </ol>
        </div>
        
        <div class="links">
          <a href="/api/health" class="btn">Health Check</a>
          <a href="/sitemap.xml" class="btn" target="_blank">View Sitemap</a>
          <a href="/robots.txt" class="btn" target="_blank">View Robots.txt</a>
          <a href="/api/anime/featured" class="btn">Check Featured Anime</a>
          <a href="/api/debug/link-settings" class="btn">Check Link Settings</a>
          <a href="/api/test-vote-system" class="btn">Test Vote System</a>
          <a href="/api/debug/vote-system" class="btn">Debug Vote System</a>
          <a href="/api/poll/active" class="btn">Check Active Poll</a>
          <a href="/api/test-poll-system" class="btn">Test Poll System</a>
          <a href="/api/partners" class="btn">Test Partners API</a>
        </div>
        
        <p style="margin-top: 2rem; color: #9CA3AF; font-size: 0.9rem;">
          Server Time: ${new Date().toLocaleString()}<br>
          SEO Status: Complete - Ready for Google Indexing<br>
          Like/Dislike: ✅ Fixed and Working<br>
          Link Control: Active (5 links globally controllable)<br>
          Poll System: ✅ Active (device-based voting)<br>
          Partner Manager: ✅ Active (Create and manage partners)<br>
          Body Limit: 50MB (Fixed for poll system)<br>
          Trust Proxy: ${process.env.NODE_ENV === 'production' ? '✅ Enabled (1 hop)' : '❌ Disabled (development)'}<br>
          Sitemap Status: ✅ SEO Safe (No search query URLs)<br>
          Next Step: Submit to Google Search Console
        </p>
      </div>
      
      <!-- JSON-LD Structured Data -->
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "AnimeBing",
        "url": "https://animebing.in",
        "description": "Watch anime online for free in Hindi and English. HD quality streaming and downloads.",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://animebing.in/?search={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
      </script>
    </body>
    </html>
  `);
});

// ✅ START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('===============================================');
  console.log('🚀 AnimeBing Server Started Successfully!');
  console.log('===============================================');
  console.log(`📊 PORT: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔧 Admin: ${process.env.ADMIN_USER || 'Hellobrother'}`);
  console.log(`🔑 Pass: ${process.env.ADMIN_PASS || 'Anime2121818144'}`);
  console.log('===============================================');
  console.log('✅ LIKE/DISLIKE SYSTEM FIXES APPLIED:');
  console.log('   1. ✅ Trust proxy ONLY in production (conditional)');
  console.log('   2. ✅ Route order fixed in animeRoutes.cjs');
  console.log('   3. ✅ IP address automatically detected from request');
  console.log('   4. ✅ Vote status endpoint updated');
  console.log('   5. ✅ Featured route comes before dynamic routes');
  console.log('===============================================');
  console.log('📁 API ENDPOINTS FOR LIKE/DISLIKE:');
  console.log('   - GET /api/anime/:id/vote-status - Check user vote');
  console.log('   - POST /api/anime/:id/vote - Vote (send voteType in body)');
  console.log('   - GET /api/anime/:id/statistics - Anime stats');
  console.log('   - GET /api/anime/top100 - Top 100 anime by likes');
  console.log('===============================================');
  console.log('🗳️ POLL SYSTEM (DEVICE-BASED) ENDPOINTS:');
  console.log('   - GET /api/poll/active?deviceId=xxx - Get active poll');
  console.log('   - POST /api/poll/vote - Vote (send pollId, optionId, deviceId)');
  console.log('   - GET /api/poll/check-vote/:pollId?deviceId=xxx - Check if voted');
  console.log('   - GET /api/poll/admin/all - Admin: all polls');
  console.log('   - POST /api/poll/admin/create - Admin: create poll');
  console.log('===============================================');
  console.log('🤝 PARTNER MANAGER ENDPOINTS:');
  console.log('   - GET /api/partners - List all partners');
  console.log('   - POST /api/partners - Create partner');
  console.log('   - DELETE /api/partners/:id - Delete partner');
  console.log('   - GET /api/partners/:id/anime - Get partner anime');
  console.log('   - POST /api/partners/:id/anime - Assign anime');
  console.log('   - DELETE /api/partners/:id/anime/:animeId - Remove anime');
  console.log('===============================================');
  console.log('🔍 DEBUG ENDPOINTS:');
  console.log('   - GET /api/debug/vote-system - Debug vote system');
  console.log('   - GET /api/test-vote-system - Test vote system');
  console.log('   - GET /api/debug/polls - Debug poll system');
  console.log('   - GET /api/test-poll-system - Test poll system');
  console.log('   - GET /api/partners - Test partners API');
  console.log('===============================================');
  console.log('💡 NEXT STEPS:');
  console.log('   1. Go to frontend (http://localhost:5173)');
  console.log('   2. Navigate to any anime detail page to test like/dislike');
  console.log('   3. Poll card will appear if there is an active poll');
  console.log('   4. Check Admin Dashboard → Poll Manager to create polls');
  console.log('   5. Go to Admin Dashboard → Partner Manager to manage partners');
  console.log('===============================================');
  console.log(`🛡️  TRUST PROXY STATUS: ${process.env.NODE_ENV === 'production' ? 'ENABLED (1 hop)' : 'DISABLED (development safe)'}`);
  console.log('===============================================');
});