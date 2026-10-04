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

    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false

    return payload.role === 'admin' || payload.role === 'subadmin'
  } catch {
    return false
  }
}

// ============================================================================
// ✅ FIX — STALE-WHILE-REVALIDATE (SWR)
// Pehle: TTL khatam hote hi cache MISS hota tha, aur har request foreground
// me MongoDB pe jaati thi. Load ke waqt stampede ban jaati thi.
//
// Ab: cached data ko uske TTL ke baad bhi 30x tak "stale" rakha jaata hai.
//   • Fresh (TTL ke andar) → turant HIT, koi DB call nahi
//   • Stale (TTL ke bahar, par 30x ke andar) → purana data turant serve,
//     background me refresh chal jata hai (throttled — same key ke liye
//     sirf ek inflight refresh)
//   • Miss (cache bilkul khaali) → foreground me handler chalao
// ============================================================================
const inflightRefresh = new Map<string, Promise<void>>()
const STALE_MULTIPLIER = 30 // fresh TTL ka 30x tak stale copy rakho

export async function withEdgeCache(
  c: any,
  ttlSeconds: number,
  handler: () => Promise<any>,
  cacheKeyExtra?: string
): Promise<Response> {
  // @ts-ignore
  const cache = caches.default

  const cacheUrl = new URL(c.req.url)
  for (const p of CACHE_BUSTING_PARAMS) cacheUrl.searchParams.delete(p)
  if (cacheKeyExtra) cacheUrl.searchParams.set('_ck', cacheKeyExtra)
  const keyStr = cacheUrl.toString()
  const cacheKey = new Request(keyStr, { method: 'GET' })

  const bypass = await isAdminRequest(c)

  const buildStored = (data: any) =>
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttlSeconds * STALE_MULTIPLIER}`,
        'X-Cached-At': String(Date.now()),
      },
    })

  const refresh = () => {
    if (inflightRefresh.has(keyStr)) return
    const p = (async () => {
      try {
        const data = await handler()
        await cache.put(cacheKey, buildStored(data))
      } catch (e) {
        console.error('[edgeCache] refresh failed:', e)
      } finally {
        inflightRefresh.delete(keyStr)
      }
    })()
    inflightRefresh.set(keyStr, p)
    c.executionCtx.waitUntil(p)
  }

  if (!bypass) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const cachedAt = Number(cached.headers.get('X-Cached-At') || 0)
      const fresh = cachedAt > 0 && Date.now() - cachedAt < ttlSeconds * 1000
      if (!fresh) refresh() // stale hai: purana abhi do, naya background mein lao
      const headers = new Headers(cached.headers)
      headers.set('X-Cache', fresh ? 'HIT' : 'STALE')
      headers.set('Cache-Control', `public, max-age=${ttlSeconds}`)
      return new Response(cached.body, { status: cached.status, headers })
    }
  }

  // Cache bilkul khaali (pehli baar) ya admin bypass: foreground mein lao
  const data = await handler()
  c.executionCtx.waitUntil(cache.put(cacheKey, buildStored(data)))

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': bypass ? 'no-store' : `public, max-age=${ttlSeconds}`,
      'X-Cache': bypass ? 'BYPASS' : 'MISS',
    },
  })
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

  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}`,
        },
      })
    )
  )

  return data
}