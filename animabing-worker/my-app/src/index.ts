import { Hono } from 'hono'
import { cors } from 'hono/cors'
import adminRoutes from './routes/adminRoutes'
import animeRoutes from './routes/animeRoutes'
import episodeRoutes from './routes/episodeRoutes'
import chapterRoutes from './routes/chapterRoutes'
import appDownloadRoutes from './routes/appDownloadRoutes'
import contactRoutes from './routes/contactRoutes'
import downloadPageRoutes from './routes/downloadPageRoutes'
import linkSettingsRoutes from './routes/linkSettingsRoutes'
import partnerRoutes from './routes/partnerRoutes'
import pollRoutes from './routes/pollRoutes'
import reportRoutes from './routes/reportRoutes'
import sitemapRoutes from './routes/sitemapRoutes'
import socialRoutes from './routes/socialRoutes'
import shortenerRoutes from './routes/shortenerRoutes'
import shortUserRoutes from './routes/shortUserRoutes'
import referralRoutes from './routes/referralRoutes'   
import analyticsRoutes from './routes/analyticsRoutes'
import authRoutes from './routes/authRoutes'            
import { runWithDbContext } from './services/mongoService'    

export type Env = {
  MONGODB_URI: string
  MONGODB_DB: string
  ALLOWED_ORIGIN: string
  JWT_SECRET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  API_URL: string
  GOOGLE_CLIENT_ID: string          
  GOOGLE_CLIENT_SECRET: string     
  FRONTEND_URL: string              
}

export type Variables = {
  admin: any
  user: any
  shortUser: any
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// OPTIONS preflight
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// CORS
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false,
  })
  return corsMiddleware(c, next)
})

app.use('*', async (c, next) => {
  await runWithDbContext(() => next())
})

// ============ API ROUTES ============
app.route('/api/admin', adminRoutes)
app.route('/api/anime', animeRoutes)
app.route('/api/episodes', episodeRoutes)
app.route('/api/chapters', chapterRoutes)
app.route('/api/app-downloads', appDownloadRoutes)
app.route('/api', contactRoutes)
app.route('/api/download-pages', downloadPageRoutes)
app.route('/api/link-settings', linkSettingsRoutes)
app.route('/api/partners', partnerRoutes)
app.route('/api/polls', pollRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/social', socialRoutes)
app.route('/api/short-users', shortUserRoutes)
app.route('/api/short-users/referral', referralRoutes)    
app.route('/api/analytics', analyticsRoutes)
app.route('/api/auth', authRoutes)                        

// ============ SITEMAP ============
app.route('/', sitemapRoutes)

// ============ URL SHORTENER ============
app.route('/', shortenerRoutes)

// ============ HEALTH CHECK ============
app.get('/health', (c) => {
  return c.json({ message: 'Animabing Backend Working! 🚀', status: 'ok' })
})

export default app