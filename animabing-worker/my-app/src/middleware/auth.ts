 import { Context, Next } from 'hono'
import { Env, Variables } from '../index'

async function verifyJWT(token: string, secret: string): Promise<any> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token format')
  
  const [headerB64, payloadB64, signatureB64] = parts
  
  const signature = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    (ch) => ch.charCodeAt(0)
  )

  const data = encoder.encode(`${headerB64}.${payloadB64}`)
  
  const valid = await crypto.subtle.verify('HMAC', cryptoKey, signature, data)
  if (!valid) throw new Error('Invalid signature')

  const payload = JSON.parse(atob(payloadB64))
  
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error('Token expired')
  }

  if (!payload.id || !payload.username) {
    throw new Error('Invalid token payload')
  }

  return payload
}

export async function adminAuth(c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Access denied! No token provided.' }, 401)
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    return c.json({ success: false, error: 'Access denied! Invalid token format.' }, 401)
  }

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET)
    c.set('admin', payload)
    await next()
  } catch (err: any) {
    if (err.message === 'Token expired') {
      return c.json({ success: false, error: 'Token expired! Please login again.' }, 401)
    }
    return c.json({ success: false, error: 'Authentication failed!' }, 401)
  }
}