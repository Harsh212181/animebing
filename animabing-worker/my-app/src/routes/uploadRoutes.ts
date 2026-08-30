 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findOne, findMany, updateOne, deleteOne } from '../services/mongoService'
import { IR2Provider } from '../models/types'
import { decryptSecret } from '../services/encryptionService'
import { signDownloadUrl } from '../services/signedUrlService'
import {
  initiateMultipartUpload,
  generatePartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  listBucketObjects,
  deleteObject,
  renameObject,
} from '../services/multipartUploadService'

const uploadRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

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

async function checkHostnameAccess(hostname: string, admin: any, mongoUri: string, mongoDb: string): Promise<boolean> {
  if (hostname in staticBucketHostMap) {
    return admin?.role !== 'subadmin'
  }
  const provider = await findOne<IR2Provider>('r2providers', { hostname, isActive: { $ne: false } }, mongoUri, mongoDb)
  if (!provider) return false
  if (admin?.role === 'subadmin') {
    return (provider as any).ownerUsername === admin.username
  }
  return true
}

async function resolveUploadCreds(hostname: string, c: any) {
  if (hostname in staticBucketHostMap) {
    return {
      accountId: c.env.R2_ACCOUNT_ID,
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      bucketName: staticBucketHostMap[hostname],
    }
  }
  const provider = await findOne<IR2Provider>(
    'r2providers', { hostname, isActive: { $ne: false } }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!provider) return null
  const secretAccessKey = await decryptSecret(
    (provider as any).encryptedSecretAccessKey, (provider as any).iv, c.env.ENCRYPTION_KEY
  )
  return {
    accountId: (provider as any).accountId,
    accessKeyId: (provider as any).accessKeyId,
    secretAccessKey,
    bucketName: (provider as any).bucketName,
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-\[\] ]/g, '').trim()
}

// LIST available buckets for upload dropdown
uploadRoutes.get('/buckets', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const staticList = Object.keys(staticBucketHostMap).map(h => ({ hostname: h, label: h }))
    const providers = await findMany<IR2Provider>(
      'r2providers', { isActive: { $ne: false } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    let dynamicList = providers.map((p: any) => ({
      hostname: p.hostname, label: p.label || p.hostname, ownerUsername: p.ownerUsername
    }))

    if (admin?.role === 'subadmin') {
      // ✅ Sub-admin ko sirf apne registered buckets dikhenge
      dynamicList = dynamicList.filter((p: any) => p.ownerUsername === admin.username)
      return c.json(dynamicList)
    }

    return c.json([...staticList, ...dynamicList])
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// LIST objects in a bucket (dedupe + no cap)
uploadRoutes.get('/list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const hostnameParam = c.req.query('hostname')

    let hostnamesToQuery: string[] = []

    if (hostnameParam && hostnameParam !== 'all') {
      const allowed = await checkHostnameAccess(hostnameParam, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!allowed) return c.json({ error: 'Access denied for this bucket' }, 403)
      hostnamesToQuery = [hostnameParam]
    } else {
      const staticList = Object.keys(staticBucketHostMap)
      const providers = await findMany<IR2Provider>('r2providers', { isActive: { $ne: false } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
      let dynamicList = providers.map((p: any) => ({ hostname: p.hostname, ownerUsername: p.ownerUsername }))

      if (admin?.role === 'subadmin') {
        dynamicList = dynamicList.filter((p: any) => p.ownerUsername === admin.username)
        hostnamesToQuery = dynamicList.map(p => p.hostname)
      } else {
        hostnamesToQuery = [...staticList, ...dynamicList.map(p => p.hostname)]
      }
    }

    // ✅ Dedupe — same physical bucket (accountId+bucketName) sirf ek baar query karo
    const seenBucketKeys = new Set<string>()
    const uniqueQueries: { hostname: string; creds: any }[] = []

    for (const hostname of hostnamesToQuery) {
      const creds = await resolveUploadCreds(hostname, c)
      if (!creds) continue
      const bucketKey = `${creds.accountId}|${creds.bucketName}`
      if (seenBucketKeys.has(bucketKey)) continue
      seenBucketKeys.add(bucketKey)
      uniqueQueries.push({ hostname, creds })
    }

    const results = await Promise.all(
      uniqueQueries.map(async ({ hostname, creds }) => {
        try {
          const objects = await listBucketObjects(creds)
          return objects.map(o => ({
            key: o.key,
            size: o.size,
            lastModified: o.lastModified,
            hostname,
            url: `https://${hostname}/${encodeURIComponent(o.key)}`,
          }))
        } catch {
          return []
        }
      })
    )

    return c.json(results.flat())
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// INITIATE
uploadRoutes.post('/initiate', adminAuth, async (c) => {
  try {
    const { hostname, filename } = await c.req.json()
    if (!hostname || !filename) return c.json({ error: 'hostname aur filename zaroori hai' }, 400)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname / provider not found' }, 400)

    const key = sanitizeFilename(filename)
    const uploadId = await initiateMultipartUpload(creds, key)

    return c.json({ uploadId, key, hostname })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PART URL
uploadRoutes.post('/part-url', adminAuth, async (c) => {
  try {
    const { hostname, key, uploadId, partNumber } = await c.req.json()
    if (!hostname || !key || !uploadId || !partNumber) return c.json({ error: 'Missing fields' }, 400)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    const url = await generatePartUploadUrl(creds, key, uploadId, partNumber)
    return c.json({ url })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// COMPLETE
uploadRoutes.post('/complete', adminAuth, async (c) => {
  try {
    const { hostname, key, uploadId, parts } = await c.req.json()
    if (!hostname || !key || !uploadId || !Array.isArray(parts)) return c.json({ error: 'Missing fields' }, 400)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await completeMultipartUpload(creds, key, uploadId, parts)

    const finalUrl = `https://${hostname}/${encodeURIComponent(key)}`
    return c.json({ success: true, url: finalUrl })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ABORT
uploadRoutes.post('/abort', adminAuth, async (c) => {
  try {
    const { hostname, key, uploadId } = await c.req.json()
    if (!hostname || !key || !uploadId) return c.json({ error: 'Missing fields' }, 400)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await abortMultipartUpload(creds, key, uploadId)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE OBJECT
uploadRoutes.delete('/object', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const hostname = c.req.query('hostname')
    const key = c.req.query('key')
    if (!hostname || !key) return c.json({ error: 'hostname aur key zaroori hai' }, 400)

    const allowed = await checkHostnameAccess(hostname, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!allowed) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await deleteObject(creds, key)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// RENAME OBJECT
uploadRoutes.post('/rename', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, oldKey, newKey } = await c.req.json()
    if (!hostname || !oldKey || !newKey) return c.json({ error: 'Missing fields' }, 400)

    const allowed = await checkHostnameAccess(hostname, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!allowed) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await renameObject(creds, oldKey, newKey)
    return c.json({ success: true, url: `https://${hostname}/${encodeURIComponent(newKey)}` })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET all marked shows
uploadRoutes.get('/marks', adminAuth, async (c) => {
  try {
    const marks = await findMany<any>('markedshows', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(marks.map((m: any) => ({ groupKey: m.groupKey, displayName: m.displayName })))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// MARK a show (group) — upsert, double-click safe
uploadRoutes.post('/mark', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { groupKey, displayName } = await c.req.json()
    if (!groupKey) return c.json({ error: 'groupKey zaroori hai' }, 400)

    await updateOne(
      'markedshows',
      { groupKey },
      { groupKey, displayName: displayName || groupKey, markedBy: admin?.username || 'unknown' },
      c.env.MONGODB_URI,
      c.env.MONGODB_DB,
      true // upsert
    )
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UNMARK a show
uploadRoutes.delete('/mark', adminAuth, async (c) => {
  try {
    const groupKey = c.req.query('groupKey')
    if (!groupKey) return c.json({ error: 'groupKey zaroori hai' }, 400)

    await deleteOne('markedshows', { groupKey }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PREVIEW URL — Watch (stream) ya Download (attachment) ke liye signed link
uploadRoutes.post('/preview-url', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, key, mode } = await c.req.json()
    if (!hostname || !key) return c.json({ error: 'Missing fields' }, 400)

    const allowed = await checkHostnameAccess(hostname, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!allowed) return c.json({ error: 'Access denied' }, 403)

    const fullUrl = `https://${hostname}/${encodeURIComponent(key)}`
    const signed = await signDownloadUrl(
      fullUrl,
      {
        R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
        ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      },
      mode === 'download' ? 'download' : 'watch',
      c.env.MONGODB_URI,
      c.env.MONGODB_DB
    )
    return c.json({ url: signed })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default uploadRoutes