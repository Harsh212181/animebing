import { Context, Next } from 'hono'
import { Env, Variables } from '../index'
import { findOne, toObjectId, isValidObjectId } from '../services/mongoService'
import { ISubAdmin } from '../models/types'

async function verifyJWT(token: string, secret: string): Promise<any> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
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

// ============ GENERAL ADMIN AUTH (super admin + sub-admin dono ke liye) ============
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

    // Agar sub-admin hai, to har request pe DB se block status check karo
    if (payload.role === 'subadmin') {
      if (!isValidObjectId(payload.id)) {
        return c.json({ success: false, error: 'Invalid sub-admin token.' }, 401)
      }
      const subAdmin = await findOne<ISubAdmin>(
        'subadmins', { _id: toObjectId(payload.id) }, c.env.MONGODB_URI, c.env.MONGODB_DB
      )
      if (!subAdmin) {
        return c.json({ success: false, error: 'Sub-admin account not found.' }, 401)
      }
      if (subAdmin.isBlocked) {
        return c.json({ success: false, error: 'Your account has been blocked. Contact admin.' }, 403)
      }
      // Fresh permissions/animeAccess DB se — id ko bhi normalize karke rakhte hain (string consistency)
      payload.id = subAdmin._id!.toString()
      payload.permissions = subAdmin.permissions || []
      payload.animeAccess = subAdmin.animeAccess === 'all' ? 'all' : 'own'   // ✅ explicit default 'own'
    }

    c.set('admin', payload)
    await next()
  } catch (err: any) {
    if (err.message === 'Token expired') {
      return c.json({ success: false, error: 'Token expired! Please login again.' }, 401)
    }
    return c.json({ success: false, error: 'Authentication failed!' }, 401)
  }
}

// ============ SUPER ADMIN ONLY (sub-admin management ke liye) ============
export async function superAdminOnly(c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) {
  const admin = c.get('admin')
  if (!admin || admin.role === 'subadmin') {
    return c.json({ success: false, error: 'Only super admin can perform this action.' }, 403)
  }
  await next()
}

// ============ PERMISSION CHECK (sub-admin ke liye specific permission) ============
export function requirePermission(permission: string) {
  return async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
    const admin = c.get('admin')
    if (!admin) {
      return c.json({ success: false, error: 'Authentication required.' }, 401)
    }
    // Super admin ko sab kuch allowed hai
    if (admin.role !== 'subadmin') {
      await next()
      return
    }
    // Sub-admin ke liye permission check
    const permissions: string[] = admin.permissions || []
    if (!permissions.includes(permission)) {
      return c.json({ success: false, error: `You don't have permission to perform this action (${permission}).` }, 403)
    }
    await next()
  }
}

export { verifyJWT }