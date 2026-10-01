// src/utils/cache.ts

const CACHE_BUSTING_PARAMS = ['_', 't', 'ts', 'nocache', 'cachebust']

// ============================================================================
// ✅ HISSA A — ADMIN CACHE BYPASS
// Valid admin/sub-admin JWT wali request cache READ skip karti hai, taaki
// dashboard ko hamesha fresh data mile. Verify sirf HMAC se hota hai (no DB).
// Shortuser token (role: 'shortuser') ya fake token => bypass NAHI milega.
// ============================================================================
async function isAdminRequest(c: any): Promise<boolean> {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return false
    const token = auth.slice(7)
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const secret = c.env?.JWT_SECRET
    if (!secret) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sig = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (ch) => ch.charCodeAt(0)
    )
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return false

    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false

    return payload.role === 'admin' || payload.role === 'subadmin'
  } catch {
    return false
  }
}

export async function withEdgeCache(
  c: any,
  ttlSeconds: number,
  handler: () => Promise<any>,
  cacheKeyExtra?: string
): Promise<Response> {
  // @ts-ignore — `caches.default` Cloudflare Workers runtime me globally available hai
  const cache = caches.default

  // ✅ Cache key normalize karo — known busting params hata do
  const cacheUrl = new URL(c.req.url)
  for (const p of CACHE_BUSTING_PARAMS) cacheUrl.searchParams.delete(p)
  if (cacheKeyExtra) cacheUrl.searchParams.set('_ck', cacheKeyExtra)
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })

  // ✅ NEW: admin/sub-admin ho to cache READ skip
  const bypass = await isAdminRequest(c)

  // 1) Try cache first (sirf normal visitors ke liye)
  if (!bypass) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(cached.body, { status: cached.status, headers })
    }
  }

  // 2) Cache miss ya admin bypass — actual handler chalao (MongoDB call)
  const data = await handler()

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      // Admin ko browser-cache bhi na mile, user ko normal TTL
      'Cache-Control': bypass ? 'no-store' : `public, max-age=${ttlSeconds}`,
      'X-Cache': bypass ? 'BYPASS' : 'MISS',
    },
  })

  // 3) Cache me save. Admin ke bypass me bhi fresh data put karte hain,
  // taaki is datacenter ka cache bhi turant naya ho jaye.
  const toStore = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  })
  await cache.put(cacheKey, toStore)

  return response
}

export function fireAndForget(c: any, promise: Promise<any>) {
  c.executionCtx.waitUntil(
    promise.catch((err: any) => console.error('[fireAndForget] failed:', err))
  )
}

export async function invalidateEdgeCache(c: any, path: string) {
  try {
    // @ts-ignore
    const cache = caches.default
    const url = new URL(c.req.url)
    url.pathname = path
    url.search = ''
    await cache.delete(new Request(url.toString(), { method: 'GET' }))
  } catch (err) {
    console.error('[invalidateEdgeCache] failed:', err)
  }
}

export async function getCachedJSON(
  c: any,
  ttlSeconds: number,
  cacheKeyName: string,
  handler: () => Promise<any>
): Promise<any> {
  // @ts-ignore
  const cache = caches.default

  const cacheUrl = new URL(c.req.url)
  cacheUrl.pathname = '/__cache_data__' + cacheUrl.pathname
  cacheUrl.search = ''
  cacheUrl.searchParams.set('_key', cacheKeyName)
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })

  // ✅ NEW: admin ke liye read skip
  const bypass = await isAdminRequest(c)
  if (!bypass) {
    const cached = await cache.match(cacheKey)
    if (cached) return await cached.json()
  }

  const data = await handler()

  await cache.put(
    cacheKey,
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttlSeconds}`,
      },
    })
  )

  return data
}