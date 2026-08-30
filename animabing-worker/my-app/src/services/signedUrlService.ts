 import { AwsClient } from 'aws4fetch'
import { findOne } from './mongoService'
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

export async function isProtectedDomain(fullUrl: string, mongoUri: string, mongoDb: string): Promise<boolean> {
  try {
    const hostname = new URL(fullUrl).hostname
    if (hostname in staticBucketHostMap) return true
    const provider = await findOne('r2providers', { hostname, isActive: { $ne: false } }, mongoUri, mongoDb)
    return !!provider
  } catch {
    return false
  }
}

async function resolveCredentials(
  hostname: string,
  mainEnv: MainEnv,
  mongoUri: string,
  mongoDb: string
): Promise<ResolvedCreds | null> {
  // Pehle apna khud ka static map check karo (fast, DB call nahi lagti)
  if (hostname in staticBucketHostMap) {
    return {
      accountId: mainEnv.R2_ACCOUNT_ID,
      accessKeyId: mainEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: mainEnv.R2_SECRET_ACCESS_KEY,
      bucketName: staticBucketHostMap[hostname],
    }
  }
  // Warna DB me sub-admin ka provider dhoondo
  const provider = await findOne<IR2Provider>('r2providers', { hostname, isActive: { $ne: false } }, mongoUri, mongoDb)
  if (!provider) return null

  const secretAccessKey = await decryptSecret(
    (provider as any).encryptedSecretAccessKey,
    (provider as any).iv,
    mainEnv.ENCRYPTION_KEY
  )
  return {
    accountId: (provider as any).accountId,
    accessKeyId: (provider as any).accessKeyId,
    secretAccessKey,
    bucketName: (provider as any).bucketName,
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
  const creds = await resolveCredentials(url.hostname, mainEnv, mongoUri, mongoDb)
  if (!creds) {
    throw new Error(`No R2 provider registered for hostname: ${url.hostname}`)
  }

  const objectKey = decodeURIComponent(url.pathname.slice(1))
  const filename = objectKey.split('/').pop() || 'video.mkv'

  const endpoint = new URL(
    `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucketName}/${encodeURIComponent(objectKey)}`
  )
  endpoint.searchParams.set('X-Amz-Expires', expiresInSec.toString())
  if (mode === 'download') {
    endpoint.searchParams.set(
      'response-content-disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    )
  }

  const client = new AwsClient({ accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey })
  const signedRequest = await client.sign(endpoint.toString(), { method: 'GET', aws: { signQuery: true } })
  return signedRequest.url
}