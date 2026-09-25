// src/utils/cache.ts
// ============================================================================
// ✅ Cloudflare Cache API helper — GET routes ko cache karta hai taaki
// repeat requests MongoDB tak jaayein hi na. Ye Worker ke edge pe cache
// karta hai (har Cloudflare data-center apna copy rakhta hai) — matlab
// agar 100 users same anime dekh rahe hain, sirf PEHLA request MongoDB
// hit karta hai, baaki 99 seedha cache se serve hote hain — koi naya
// TLS/connection overhead nahi.
//
// IMPORTANT: Cache API sirf GET requests ke liye hai, aur sirf tab kaam
// karta hai jab response `Cache-Control` header ke saath ho. Ye helper
// dono khud handle karta hai.
// ============================================================================

/**
 * Wraps a Hono GET route handler with Cloudflare edge caching.
 *
 * @param c        Hono context
 * @param ttlSeconds  Kitni der tak response cache me rahe (seconds)
 * @param handler  Async function jo actual data fetch karta hai aur JSON-able object return karta hai
 * @param cacheKeyExtra  Optional extra string cache key me add karne ke liye
 *                       (jaise query params jo URL me already hain unke alawa
 *                       kuch aur cheez agar cache key me chahiye)
 */
export async function withEdgeCache(
  c: any,
  ttlSeconds: number,
  handler: () => Promise<any>,
  cacheKeyExtra?: string
): Promise<Response> {
  // @ts-ignore — `caches.default` Cloudflare Workers runtime me globally available hai
  const cache = caches.default

  // Cache key = full request URL (+ optional extra suffix for variants)
  const cacheUrl = new URL(c.req.url)
  if (cacheKeyExtra) cacheUrl.searchParams.set('_ck', cacheKeyExtra)
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })

  // 1) Try cache first — agar mil gaya, MongoDB tak jaana hi nahi
  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

  // 2) Cache miss — actual handler chalao (ye MongoDB call karega)
  const data = await handler()

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      // Browser + Cloudflare edge dono ke liye cache instruction
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  })

  // 3) Cache me store karo (background me — response wait nahi karega)
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

/**
 * Fire-and-forget helper — kisi bhi async DB write (jaise view counter
 * increment) ko response ke saath block kiye bina background me chalata hai.
 * Cached responses ke saath use karo taaki views phir bhi count hote rahein,
 * lekin user ko wait na karna pade.
 */
export function fireAndForget(c: any, promise: Promise<any>) {
  c.executionCtx.waitUntil(
    promise.catch((err: any) => console.error('[fireAndForget] failed:', err))
  )
}