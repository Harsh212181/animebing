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

export type Env = {
  MONGODB_URI: string
  MONGODB_DB: string
  ALLOWED_ORIGIN: string
  JWT_SECRET: string
  ADMIN_USER: string
  ADMIN_PASS: string
}

export type Variables = {
  admin: any
  user: any
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// OPTIONS preflight — sabse pehle
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

// ROUTES
app.route('/api/admin', adminRoutes)
// ✅ /api/admin/protected HATA DIYA — ab /api/admin directly use hoga
// ReportsManager.tsx mein URLs update karo:
//   /api/admin/protected/reports  →  /api/admin/reports
//   /api/admin/protected/reports/:id  →  /api/admin/reports/:id
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
app.route('/', sitemapRoutes)
app.route('/api/social', socialRoutes)

// TEST ROUTE
app.get('/health', (c) => {
  return c.json({
    message: 'Animabing Backend Working! 🚀',
    status: 'ok'
  })
})

export default app