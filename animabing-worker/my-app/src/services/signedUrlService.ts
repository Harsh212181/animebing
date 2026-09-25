import { AwsClient } from 'aws4fetch'
import { Db } from 'mongodb'
import { getDb } from './mongoService'
import { decryptSecret } from './encryptionService'
import { IR2Provider } from '../models/types'

// ✅ Aapke apne (main account) buckets — yeh waise hi rahenge
const staticBucketHostMap: Record<string, string> = {
  'files.animebing.in': 'animedata',
  'watch.files.animebing.in': 'animedata',
  'movie.animebing.in': 'movies-store',
  'movie2.animebing.in': 'movies-store-2',
  'manga.animebing.in': 'manga-explanation',
  'manga2.animebing.in': 'manga-explanation-2',
  'hindi-sub-ongoing.animebing.in': 'hindi-sub-ongoing',
  'hindi-dub-ongoing.animebing.in': 'hindi-dub-ongoing',
  'hindi-sub2.animebing.in': 'hindi-sub-2',
  'hindi-sub.animebing.in': 'hindi-sub',
  'hindi-dub2.animebing.in': 'hindi-dub-2',
  'hindi-dub.animebing.in': 'hindi-dub',
  'english.animebing.in': 'english-sub',
}

interface MainEnv {
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  ENCRYPTION_KEY: string
}

interface ResolvedCreds {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

// ============================================================================
// ✅ FIX #1 (bug, connections se independent): pehle `isProtectedDomain()` aur
// `resolveCredentials()` DONO `r2providers` collection me EXACT SAME
// `{ hostname, isActive: { $ne: false } }` query chalate the — matlab har
// protected link ke liye same data 2 baar DB se fetch ho raha tha.
//
// ✅ FIX #2 (connections): downloadPageRoutes.ts ke `/:slug` route me
// `links.map(async link => { isProtectedDomain(...); signDownloadUrl(...) })`
// chalta hai — matlab N links = kam se kam 2N DB round-trips (findOne ka
// har helper call apna alag connection kholta hai).
//
// Fix: neeche `prefetchR2Providers()` naya function hai jo EK BAAR me saare
// distinct non-static hostnames ke providers fetch kar leta hai (1 hi query,
// $in filter se). Result ek Map hai jo baaki sab sync functions ko pass hota
// hai — ab per-link koi DB call hi nahi lagti (sirf decryption, jo DB-free
// crypto operation hai).
// ============================================================================

// Static bucket hai to turant bata do (DB call ki zarurat nahi)
export function isStaticBucketHost(hostname: string): boolean {
  return hostname in staticBucketHostMap
}

// ✅ NEW — ek hi query me saare non-static hostnames ke providers fetch karo
export async function prefetchR2Providers(
  urls: string[],
  mongoUri: string,
  dbName: string
): Promise<Map<string, IR2Provider>> {
  const hostnames = Array.from(new Set(
    urls
      .map((u) => { try { return new URL(u).hostname } catch { return null } })
      .filter((h): h is string => !!h && !isStaticBucketHost(h))
  ))

  const map = new Map<string, IR2Provider>()
  if (hostnames.length === 0) return map

  const db: Db = await getDb(mongoUri, dbName)
  const providers = await db.collection('r2providers')
    .find({ hostname: { $in: hostnames }, isActive: { $ne: false } })
    .toArray()

  for (const p of providers) {
    map.set((p as any).hostname, p as any as IR2Provider)
  }
  return map
}

// Sync version — DB call nahi karta, sirf prefetch kiya hua map check karta hai
export function isProtectedDomainSync(fullUrl: string, providerMap: Map<string, IR2Provider>): boolean {
  try {
    const hostname = new URL(fullUrl).hostname
    return isStaticBucketHost(hostname) || providerMap.has(hostname)
  } catch {
    return false
  }
}

function resolveCredentialsSync(
  hostname: string,
  mainEnv: MainEnv,
  providerMap: Map<string, IR2Provider>
): { provider?: IR2Provider; staticBucket?: string } | null {
  if (isStaticBucketHost(hostname)) {
    return { staticBucket: staticBucketHostMap[hostname] }
  }
  const provider = providerMap.get(hostname)
  if (!provider) return null
  return { provider }
}

// ✅ NEW — batch-safe signing: providerMap ek baar prefetch karke pass karo,
// koi per-link DB call nahi lagti
export async function signDownloadUrlBatch(
  fullUrl: string,
  mainEnv: MainEnv,
  mode: 'watch' | 'download',
  providerMap: Map<string, IR2Provider>
): Promise<string> {
  const url = new URL(fullUrl)
  const resolved = resolveCredentialsSync(url.hostname, mainEnv, providerMap)
  if (!resolved) throw new Error(`No R2 provider registered for hostname: ${url.hostname}`)

  let accountId: string, accessKeyId: string, secretAccessKey: string, bucketName: string

  if (resolved.staticBucket) {
    accountId = mainEnv.R2_ACCOUNT_ID
    accessKeyId = mainEnv.R2_ACCESS_KEY_ID
    secretAccessKey = mainEnv.R2_SECRET_ACCESS_KEY
    bucketName = resolved.staticBucket
  } else {
    const p = resolved.provider as any
    accountId = p.accountId
    accessKeyId = p.accessKeyId
    secretAccessKey = await decryptSecret(p.encryptedSecretAccessKey, p.iv, mainEnv.ENCRYPTION_KEY)
    bucketName = p.bucketName
  }

  const objectKey = decodeURIComponent(url.pathname.slice(1))
  const filename = objectKey.split('/').pop() || 'video.mkv'

  const endpoint = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${encodeURIComponent(objectKey)}`
  )
  endpoint.searchParams.set('X-Amz-Expires', '5400')
  if (mode === 'download') {
    endpoint.searchParams.set(
      'response-content-disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    )
  }

  const client = new AwsClient({ accessKeyId, secretAccessKey })
  const signedRequest = await client.sign(endpoint.toString(), { method: 'GET', aws: { signQuery: true } })
  return signedRequest.url
}

// ============================================================================
// ⚠️ BACKWARD-COMPAT — purane function names abhi bhi kaam karte hain (kisi
// aur jagah bhi import ho sakte hain), lekin ye still per-call DB query karte
// hain. NAYE CODE ME `prefetchR2Providers` + `isProtectedDomainSync` +
// `signDownloadUrlBatch` use karo (downloadPageRoutes.ts ke `/:slug` route
// ko is naye pattern se update karna hai — neeche snippet dekho).
// ============================================================================
export async function isProtectedDomain(fullUrl: string, mongoUri: string, mongoDb: string): Promise<boolean> {
  try {
    const hostname = new URL(fullUrl).hostname
    if (isStaticBucketHost(hostname)) return true
    const db = await getDb(mongoUri, mongoDb)
    const provider = await db.collection('r2providers').findOne({ hostname, isActive: { $ne: false } })
    return !!provider
  } catch {
    return false
  }
}

export async function signDownloadUrl(
  fullUrl: string,
  mainEnv: MainEnv,
  mode: 'watch' | 'download' = 'download',
  mongoUri: string,
  mongoDb: string,
  expiresInSec = 5400
): Promise<string> {
  const url = new URL(fullUrl)
  const db = await getDb(mongoUri, mongoDb)

  let accountId: string, accessKeyId: string, secretAccessKey: string, bucketName: string

  if (isStaticBucketHost(url.hostname)) {
    accountId = mainEnv.R2_ACCOUNT_ID
    accessKeyId = mainEnv.R2_ACCESS_KEY_ID
    secretAccessKey = mainEnv.R2_SECRET_ACCESS_KEY
    bucketName = staticBucketHostMap[url.hostname]
  } else {
    const provider = await db.collection('r2providers').findOne({ hostname: url.hostname, isActive: { $ne: false } }) as any
    if (!provider) throw new Error(`No R2 provider registered for hostname: ${url.hostname}`)
    accountId = provider.accountId
    accessKeyId = provider.accessKeyId
    secretAccessKey = await decryptSecret(provider.encryptedSecretAccessKey, provider.iv, mainEnv.ENCRYPTION_KEY)
    bucketName = provider.bucketName
  }

  const objectKey = decodeURIComponent(url.pathname.slice(1))
  const filename = objectKey.split('/').pop() || 'video.mkv'

  const endpoint = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${encodeURIComponent(objectKey)}`
  )
  endpoint.searchParams.set('X-Amz-Expires', expiresInSec.toString())
  if (mode === 'download') {
    endpoint.searchParams.set(
      'response-content-disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    )
  }

  const client = new AwsClient({ accessKeyId, secretAccessKey })
  const signedRequest = await client.sign(endpoint.toString(), { method: 'GET', aws: { signQuery: true } })
  return signedRequest.url
}

/*
============================================================================
📌 downloadPageRoutes.ts ke `/:slug` route me ye badlaav karo taaki naya
batch-safe pattern use ho (per-link DB calls khatam ho jayein):

// PEHLE (N links = kam se kam 2N DB connections):
const signedLinks = await Promise.all(
  ((page as any).links || []).map(async (link: any) => {
    const protectedDomain = await isProtectedDomain(link.url, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (protectedDomain) {
      const signed = await signDownloadUrl(link.url, {...}, link.type, c.env.MONGODB_URI, c.env.MONGODB_DB)
      return { ...link, url: signed }
    }
    return link
  })
)

// BAAD MEIN (poori page ke links ke liye sirf 1 DB query):
import { prefetchR2Providers, isProtectedDomainSync, signDownloadUrlBatch } from '../services/signedUrlService'

const allLinks = (page as any).links || []
const providerMap = await prefetchR2Providers(
  allLinks.map((l: any) => l.url), c.env.MONGODB_URI, c.env.MONGODB_DB
)
const signedLinks = await Promise.all(
  allLinks.map(async (link: any) => {
    if (isProtectedDomainSync(link.url, providerMap)) {
      try {
        const signed = await signDownloadUrlBatch(link.url, {
          R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
          ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
        }, link.type, providerMap)
        return { ...link, url: signed }
      } catch (e) {
        console.error('Signing failed for link:', link.url, e)
        return link
      }
    }
    return link
  })
)
============================================================================
*/