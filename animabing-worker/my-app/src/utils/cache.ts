// src/utils/cache.ts
// ============================================================================
// ✅ Cloudflare Cache API helper — GET routes ko cache karta hai taaki
// repeat requests MongoDB tak jaayein hi na.
//
// 🆕 FIX #1: `X-Cache: HIT` / `X-Cache: MISS` response header add kiya —
// isse tum `curl -I <url>` ya browser DevTools (Network tab → Headers) me
// SEEDHA dekh sakte ho ki cache kaam kar rahi hai ya nahi, guess karne ki
// zarurat nahi.
//
// 🆕 FIX #2: Frontend agar cache-busting query params bhejta hai (jaise
// `?_=1790356728895` — ye axios/fetch ka common pattern hai jab caller khud
// "no-cache" chahta hai), to har request ka URL alag ban jaata hai aur edge
// cache KABHI HIT NAHI HOTI, chahe backend ki caching perfectly sahi ho.
// Ab `withEdgeCache` cache-key banate waqt in known busting params ko
// (`_`, `t`, `nocache`, `ts`) HATA deta hai — taaki cache-key stable rahe
// chahe frontend kuch bhi extra bhej de. (Response abhi bhi normal jaata
// hai, sirf CACHE KEY normalize hoti hai.)
// ============================================================================

const CACHE_BUSTING_PARAMS = ['_', 't', 'ts', 'nocache', 'cachebust']

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

  // 1) Try cache first
  const cached = await cache.match(cacheKey)
  if (cached) {
    // ✅ Debug header — dikhata hai ki ye response cache se aaya
    const headers = new Headers(cached.headers)
    headers.set('X-Cache', 'HIT')
    return new Response(cached.body, { status: cached.status, headers })
  }

  // 2) Cache miss — actual handler chalao (MongoDB call yahan hoti hai)
  const data = await handler()

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
      'X-Cache': 'MISS', // ✅ debug header
    },
  })

  // 3) ✅ FIX: waitUntil (background) ki jagah AWAIT karo. Isse response
  // thoda (~5-10ms) der se jayega, lekin cache turant save ho jati hai —
  // agar isi second mein aur concurrent requests aayen (stampede), unhe
  // cache MIL JAYEGI, MongoDB tak nahi jaana padega.
  await cache.put(cacheKey, response.clone())

  return response
}

export function fireAndForget(c: any, promise: Promise<any>) {
  c.executionCtx.waitUntil(
    promise.catch((err: any) => console.error('[fireAndForget] failed:', err))
  )
}

// ============================================================================
// ✅ NEW — `invalidateEdgeCache`: kisi bhi `withEdgeCache` se cached route ko
// admin action ke turant baad clear karne ke liye (jaise special-mode
// create/update/delete/toggle karne ke baad — taaki admin ko fresh data
// TTL khatam hone ka wait kiye bina turant dikhe).
//
// `path` waisa hi do jaisa route ka pathname hai (jaise '/api/special-modes/active'),
// origin khud request se le lega.
// ============================================================================
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

// ============================================================================
// ✅ NEW — `getCachedJSON`: jab response me kuch hissa PER-USER hai (jaise
// pollRoutes ka `deviceId` — har visitor ka alag) to poora Response cache
// karna galat hoga, kyunki har unique deviceId ek unique cache-key bana dega
// aur cache kabhi cross-user hit hi nahi karegi.
//
// Ye helper sirf SHARED data (jo sabke liye same hai) cache karta hai, aur
// route ko wo raw data deta hai — route uske upar per-user fields
// (hasVoted, userVoteOption, etc.) SEEDHE compute kar sakta hai, bina
// dobara DB hit kiye.
//
// `cacheKeyName` ek stable string do (jaise 'polls-active') — deviceId
// jaisi cheez isme mat daalna, warna wahi purani problem wapas aa jayegi.
// ============================================================================
export async function getCachedJSON(
  c: any,
  ttlSeconds: number,
  cacheKeyName: string,
  handler: () => Promise<any>
): Promise<any> {
  // @ts-ignore
  const cache = caches.default

  // Real route path se collide na ho isliye ek internal-only path use kiya
  const cacheUrl = new URL(c.req.url)
  cacheUrl.pathname = '/__cache_data__' + cacheUrl.pathname
  cacheUrl.search = ''
  cacheUrl.searchParams.set('_key', cacheKeyName)
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })

  const cached = await cache.match(cacheKey)
  if (cached) {
    return await cached.json()
  }

  const data = await handler()

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  })
  // ✅ FIX: yahan bhi await karo, same reason
  await cache.put(cacheKey, response)

  return data
}