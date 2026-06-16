import { Hono } from 'hono'
import { getDb } from '../services/mongoService'
import type { Env, Variables } from '../index'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Google OAuth URL ─────────────────────────────────────────────────────────
auth.get('/google/url', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID
  const redirectUri = `${c.env.FRONTEND_URL}/auth/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })

  return c.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  })
})

// ─── Google OAuth Callback ────────────────────────────────────────────────────
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.json({ error: 'No code received' }, 400)

  try {
    const redirectUri = `${c.env.FRONTEND_URL}/auth/callback`

    // Step 1: Code → Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenRes.json() as any
    if (!tokens.access_token) {
      return c.json({ error: 'Google token failed' }, 400)
    }

    // Step 2: Access Token → Gmail + User Info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const googleUser = await userRes.json() as any
    const gmail = googleUser.email?.toLowerCase()

    if (!gmail) {
      return c.json({ error: 'Gmail nahi mila Google se' }, 400)
    }

    // Step 3: MongoDB mein Gmail se user dhundho
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const user = await db.collection('shortusers').findOne({
      $or: [
        { 'profile.gmail': gmail },
        { gmail: gmail },
        { gmailLinked: gmail },
      ]
    })

    // Step 4: User nahi mila
    if (!user) {
      return c.json({
        error: 'no_account',
        message: 'Is Gmail se koi account nahi mila. Pehle register karo.',
        gmail: gmail,
      }, 404)
    }

    // Step 5: User mila → JWT banao
    const jwt = await createJWT(
      {
        id: user._id.toString(),
        username: user.username,
        loginType: 'google',
        role: 'shortuser',  // ✅ FIX: yahi missing tha
      },
      c.env.JWT_SECRET
    )

    return c.json({
      success: true,
      token: jwt,
      user: {
        username: user.username,
        realName: user.realName,
        picture: googleUser.picture,
      },
    })

  } catch (err) {
    console.error('Google OAuth error:', err)
    return c.json({ error: 'OAuth failed' }, 500)
  }
})

// ─── JWT Helper ───────────────────────────────────────────────────────────────
async function createJWT(payload: Record<string, any>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const body = btoa(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })
  ).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`${header}.${body}`)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${header}.${body}.${sigB64}`
}

export default auth