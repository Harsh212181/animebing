import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { insertOne, findMany, updateOne, deleteOne } from '../services/mongoService'
import { verifyJWT } from '../middleware/auth' // ✅ corrected import

const instagramAuthRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

instagramAuthRoutes.get('/api/auth/instagram/connect', async (c) => {
  const token = c.req.query('token')
  let creator = { role: 'admin', id: null as string | null, username: 'Admin' }

  if (token) {
    try {
      const payload: any = await verifyJWT(token, c.env.JWT_SECRET) // ✅ fixed
      creator = { role: payload.role, id: payload.id, username: payload.username }
    } catch {
      // invalid/expired token — Admin fallback rahega
    }
  }

  const state = btoa(JSON.stringify(creator))
  const redirectUri = `${c.env.API_URL}/api/auth/instagram/callback`
  const scopes = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
  ].join(',')

  const authUrl =
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${c.env.IG_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}`

  return c.redirect(authUrl)
})

// ============================================================
// STEP 2: Meta yahan redirect karega login ke baad, ek 'code' ke saath
// ============================================================
instagramAuthRoutes.get('/api/auth/instagram/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  const state = c.req.query('state')

  if (error || !code) {
    return c.html(`<h3>Instagram connection failed or cancelled.</h3>`)
  }

  let creator = { role: 'admin', id: null as string | null, username: 'Admin' }
  if (state) {
    try {
      creator = JSON.parse(atob(decodeURIComponent(state)))
    } catch {
      // ignore, fallback to default
    }
  }
  const createdBy = creator.role === 'subadmin' ? creator.id : null
  const createdByUsername = creator.role === 'subadmin' ? creator.username : 'Admin'

  try {
    const redirectUri = `${c.env.API_URL}/api/auth/instagram/callback`

    // --- Short-lived token exchange karo ---
    const tokenForm = new URLSearchParams()
    tokenForm.append('client_id', c.env.IG_APP_ID)
    tokenForm.append('client_secret', c.env.IG_APP_SECRET)
    tokenForm.append('grant_type', 'authorization_code')
    tokenForm.append('redirect_uri', redirectUri)
    tokenForm.append('code', code)

    const shortTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenForm,
    })
    const shortTokenData: any = await shortTokenRes.json()

    if (!shortTokenData.access_token) {
      console.error('Short-lived token exchange failed', shortTokenData)
      return c.html(`<h3>Token exchange failed. Try connecting again.</h3>`)
    }

    const shortLivedToken = shortTokenData.access_token
    const igUserId = shortTokenData.user_id // initial user id (maybe different from /me)

    // --- Short-lived ko long-lived (60 din) token mein exchange karo ---
    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${c.env.IG_APP_SECRET}&access_token=${shortLivedToken}`
    )
    const longTokenData: any = await longTokenRes.json()
    const longLivedToken = longTokenData.access_token || shortLivedToken
    const expiresInSeconds = longTokenData.expires_in || 5184000 // fallback ~60 din

    // --- Username nikaalo profile info se (/me endpoint use karo) ---
    const profileRes = await fetch(
      `https://graph.instagram.com/v23.0/me?fields=user_id,username,profile_picture_url&access_token=${longLivedToken}`
    )
    const profileData: any = await profileRes.json()

    if (!profileRes.ok || !profileData.username) {
      console.error('Profile fetch failed via /me. Response:', JSON.stringify(profileData))
    }

    const igUsername = profileData.username || 'unknown'
    const resolvedIgUserId = String(profileData.user_id || igUserId)
    const profilePictureUrl = profileData.profile_picture_url || null

    // --- Is account ko webhook ke liye subscribe karo — warna Meta comment events kabhi nahi bhejega ---
    const subscribeRes = await fetch(
      `https://graph.instagram.com/v23.0/${resolvedIgUserId}/subscribed_apps?subscribed_fields=comments&access_token=${longLivedToken}`,
      { method: 'POST' }
    )
    const subscribeData: any = await subscribeRes.json()
    if (!subscribeData.success) {
      console.error('Webhook subscribe failed for', resolvedIgUserId, JSON.stringify(subscribeData))
    } else {
      console.log('✅ Webhook subscribed successfully for', resolvedIgUserId)
    }

    // --- Database mein save/update karo ---
    const existing = await findMany<any>(
      'instagramAccounts', { igUserId: resolvedIgUserId }, { limit: 1 },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000)

    if (existing.length > 0) {
      await updateOne(
        'instagramAccounts',
        { igUserId: resolvedIgUserId },
        { accessToken: longLivedToken, igUsername, profilePictureUrl, tokenExpiresAt, isActive: true },
        c.env.MONGODB_URI, c.env.MONGODB_DB
      )
    } else {
      await insertOne('instagramAccounts', {
        igUsername,
        igUserId: resolvedIgUserId,
        accessToken: longLivedToken,
        profilePictureUrl,
        tokenExpiresAt,
        isActive: true,
        connectedAt: new Date(),
        createdBy,
        createdByUsername,
      }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    }

    return c.html(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 60px;">
          <h2>✅ Instagram account "@${igUsername}" connected!</h2>
          <p>Ye tab band karke dashboard par wapas jao.</p>
          <script>
            if (window.opener) { window.opener.postMessage({ type: 'ig_connected', username: '${igUsername}' }, '*'); }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('Instagram OAuth callback failed', err)
    return c.html(`<h3>Something went wrong connecting your account. Please try again.</h3>`)
  }
})

// ============================================================
// Meta 'deauthorize' aur 'data-deletion' calls ek plain JSON body
// NAHI bhejta — ye ek 'signed_request' naam ka base64url-encoded,
// HMAC-SHA256 signed string bhejta hai (form-urlencoded body mein).
// Isko decode + verify karna zaroori hai. Ye helper dono routes
// mein use hoga.
// ============================================================
function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function verifyAndParseSignedRequest(signedRequest: string, appSecret: string): Promise<any | null> {
  const [encodedSig, encodedPayload] = signedRequest.split('.')
  if (!encodedSig || !encodedPayload) return null

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload))
  const expectedSigBytes = new Uint8Array(expectedSigBuffer)
  const actualSigBytes = base64UrlDecode(encodedSig)

  if (expectedSigBytes.length !== actualSigBytes.length) return null
  for (let i = 0; i < expectedSigBytes.length; i++) {
    if (expectedSigBytes[i] !== actualSigBytes[i]) return null
  }

  const payloadBytes = base64UrlDecode(encodedPayload)
  const payloadJson = new TextDecoder().decode(payloadBytes)
  return JSON.parse(payloadJson)
}

// ============================================================
// STEP 3: Meta calls this if a user removes your app from their
// Instagram/Facebook settings (required for Business Login apps)
// ============================================================
instagramAuthRoutes.post('/api/auth/instagram/deauthorize', async (c) => {
  try {
    const formData = await c.req.parseBody()
    const signedRequest = formData['signed_request'] as string

    if (!signedRequest) {
      console.warn('Deauthorize call received without signed_request')
      return c.json({ success: true })
    }

    const payload = await verifyAndParseSignedRequest(signedRequest, c.env.IG_APP_SECRET)
    if (!payload || !payload.user_id) {
      console.warn('Deauthorize signed_request invalid or unverifiable')
      return c.json({ success: true })
    }

    await updateOne(
      'instagramAccounts', { igUserId: String(payload.user_id) },
      { isActive: false, deauthorizedAt: new Date() },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({ success: true })
  } catch (err) {
    console.error('Deauthorize handling failed', err)
    return c.json({ success: true })
  }
})

// ============================================================
// STEP 4: Meta calls this when a user requests data deletion
// (required for Business Login / App Review). Must return a
// confirmation URL + code per Meta's spec.
// ============================================================
instagramAuthRoutes.post('/api/auth/instagram/data-deletion', async (c) => {
  try {
    const formData = await c.req.parseBody()
    const signedRequest = formData['signed_request'] as string
    const confirmationCode = `del_${Date.now()}`

    if (!signedRequest) {
      return c.json({ url: `${c.env.API_URL}/api/auth/instagram/data-deletion-status?id=${confirmationCode}`, confirmation_code: confirmationCode })
    }

    const payload = await verifyAndParseSignedRequest(signedRequest, c.env.IG_APP_SECRET)
    const userId = payload?.user_id

    if (userId) {
      await deleteOne('instagramAccounts', { igUserId: String(userId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      await deleteOne('automationRules', { accountId: String(userId) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    } else {
      console.warn('Data deletion signed_request invalid or unverifiable')
    }

    return c.json({
      url: `${c.env.API_URL}/api/auth/instagram/data-deletion-status?id=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error('Data deletion handling failed', err)
    return c.json({ url: `${c.env.API_URL}`, confirmation_code: 'error' })
  }
})

// Simple status page jo confirmation_code ka use karke dikhaya ja sakta hai
instagramAuthRoutes.get('/api/auth/instagram/data-deletion-status', (c) => {
  const id = c.req.query('id')
  return c.html(`<h3>Data deletion completed for request: ${id}</h3>`)
})

export default instagramAuthRoutes