 // server.cjs - CLEANED VERSION
const express = require('express');
const cors = require('cors');
const connectDB = require('./db.cjs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const Analytics = require('./models/Analytics.cjs');
const { generalLimiter, authLimiter, adminLimiter, apiLimiter } = require('./middleware/rateLimit.cjs');

const app = express();

app.use(cors());
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

// ✅ AUTO-CREATE ADMIN
const createAdmin = async () => {
  try {
    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    const username = process.env.ADMIN_USER || 'Hellobrother';
    const password = process.env.ADMIN_PASS || 'Anime2121818144';
    
    let admin = await Admin.findOne({ username });
    
    if (!admin) {
      console.log('🆕 Creating new admin user...');
      const hashedPassword = await bcrypt.hash(password, 10);
      admin = await Admin.create({
        username: username,
        password: hashedPassword,
        email: 'admin@animabing.com'
      });
      console.log('✅ Admin user created:', username);
    } else {
      console.log('✅ Admin exists:', username);
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
      await admin.save();
      console.log('🔁 Admin password verified and updated');
    }
    
    console.log('🔑 Login Credentials:');
    console.log('   Username:', username);
    console.log('   Password:', password);
    console.log('   Use these to login at: http://localhost:5173');
    
  } catch (err) {
    console.error('❌ Admin creation error:', err.message);
  }
};
createAdmin();

// ✅ IMPORT MIDDLEWARE AND ROUTES
const adminAuth = require('./middleware/adminAuth.cjs');
const animeRoutes = require('./routes/animeRoutes.cjs');
const episodeRoutes = require('./routes/episodeRoutes.cjs');
const chapterRoutes = require('./routes/chapterRoutes.cjs');
const reportRoutes = require('./routes/reportRoutes.cjs');
const socialRoutes = require('./routes/socialRoutes.cjs');
const appDownloadRoutes = require('./routes/appDownloadRoutes.cjs');
const adRoutes = require('./routes/adRoutes.cjs');
const adminRoutes = require('./routes/adminRoutes.cjs');

// ✅ ADMIN LOGIN ROUTE
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('\n🔐 LOGIN ATTEMPT:', { 
      username, 
      password: password ? '***' : 'missing',
      timestamp: new Date().toISOString()
    });
    
    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ error: 'Username and password required' });
    }

    const Admin = require('./models/Admin.cjs');
    const bcrypt = require('bcryptjs');
    
    console.log('🔍 Looking for admin in database...');
    const admin = await Admin.findOne({ username });
    console.log('👤 Admin found:', admin ? 'Yes' : 'No');
    
    if (!admin) {
      console.log('❌ Admin not found for username:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('🔑 Comparing passwords...');
    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('✅ Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password does not match for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: admin._id, username: admin.username }, 
      process.env.JWT_SECRET || 'supersecretkey', 
      { expiresIn: '24h' }
    );

    console.log('🎉 LOGIN SUCCESSFUL for user:', username);
    console.log('✅ Token generated successfully');
    
    res.json({ 
      success: true, 
      message: 'Login successful', 
      token, 
      username: admin.username 
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Server error' });
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

// ✅ CONTACT FORM ROUTE
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    console.log('📧 CONTACT FORM SUBMISSION:', { name, email, subject, message });

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'animebingofficial@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
      }
    });

    const mailOptions = {
      from: email,
      to: 'animebingofficial@gmail.com',
      subject: `Animabing Contact: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>Sent from Animabing Contact Form</em></p>
      `
    };

    await transporter.sendMail(mailOptions);

    console.log('✅ Contact form email sent successfully');
    
    res.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.'
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.'
    });
  }
});

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
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Animabing Server</h1>
        <p>✅ Backend API is running correctly</p>
        <p>📺 Frontend is available at: <a href="http://localhost:5173" target="_blank">http://localhost:5173</a></p>
        <p>⚙️ Admin Access: Press Ctrl+Shift+Alt on the frontend</p>
        <p>🔧 API Base: http://localhost:3000/api</p>
      </div>
    </body>
    </html>
  `);
});

// ✅ START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Admin: Hellobrother / Anime2121818144`);
  console.log(`📊 Admin Access: Press Ctrl+Shift+Alt`);
});