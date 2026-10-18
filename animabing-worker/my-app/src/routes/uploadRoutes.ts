import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findOne, findMany, updateOne, deleteOne, insertOne, toObjectId, isValidObjectId } from '../services/mongoService'
import { IR2Provider } from '../models/types'
import { decryptSecret, encryptSecret } from '../services/encryptionService'
import { signDownloadUrl } from '../services/signedUrlService'
import {
  initiateMultipartUpload,
  generatePartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  listBucketObjects,
  deleteObject,
  deleteObjects,
  renameObject,
  generateSimplePutUrl,
  listBuckets,
  generateGetUrl,
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

// Sub-admin kitne R2 buckets connect kar sakta hai
const MAX_SUBADMIN_BUCKETS = 5

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
      publicBaseUrl: `https://${hostname}`,
    }
  }
  const provider = await findOne<IR2Provider>(
    'r2providers', { hostname, isActive: { $ne: false } }, c.env.MONGODB_URI, c.env.MONGODB_DB
  )
  if (!provider) return null
  const secretAccessKey = await decryptSecret(
    (provider as any).encryptedSecretAccessKey, (provider as any).iv, c.env.ENCRYPTION_KEY
  )
  // ✅ '.internal' hostname asli URL nahi hota — isse kabhi public URL mat banao
  const fallbackBase = hostname.endsWith('.internal') ? '' : `https://${hostname}`
  return {
    accountId: (provider as any).accountId,
    accessKeyId: (provider as any).accessKeyId,
    secretAccessKey,
    bucketName: (provider as any).bucketName,
    publicBaseUrl: ((provider as any).publicBaseUrl || fallbackBase).replace(/\/+$/, ''),
  }
}

function buildUrl(creds: any, key: string): string {
  return creds.publicBaseUrl ? `${creds.publicBaseUrl}/${encodeURIComponent(key)}` : ''
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
      dynamicList = dynamicList.filter((p: any) => p.ownerUsername === admin.username)
      return c.json(dynamicList)
    }

    return c.json([...staticList, ...dynamicList])
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// LIST objects in a bucket (dedupe + no cap) — ab har item ke saath ownerUsername bhi
uploadRoutes.get('/list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const hostnameParam = c.req.query('hostname')

    // Providers ek baar fetch — owner map + dynamic list dono ke liye
    const providers = await findMany<IR2Provider>(
      'r2providers', { isActive: { $ne: false } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const ownerByHostname = new Map<string, string>()
    providers.forEach((p: any) => {
      if (p.ownerUsername) ownerByHostname.set(p.hostname, p.ownerUsername)
    })

    let hostnamesToQuery: string[] = []

    if (hostnameParam && hostnameParam !== 'all') {
      const allowed = await checkHostnameAccess(hostnameParam, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!allowed) return c.json({ error: 'Access denied for this bucket' }, 403)
      hostnamesToQuery = [hostnameParam]
    } else {
      const staticList = Object.keys(staticBucketHostMap)
      let dynamicList = providers.map((p: any) => ({ hostname: p.hostname, ownerUsername: p.ownerUsername }))

      if (admin?.role === 'subadmin') {
        dynamicList = dynamicList.filter((p: any) => p.ownerUsername === admin.username)
        hostnamesToQuery = dynamicList.map(p => p.hostname)
      } else {
        hostnamesToQuery = [...staticList, ...dynamicList.map(p => p.hostname)]
      }
    }

    // Dedupe — same physical bucket (accountId+bucketName) sirf ek baar query karo
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
          const ownerUsername = ownerByHostname.get(hostname) || null
          return objects.map(o => ({
            key: o.key,
            size: o.size,
            lastModified: o.lastModified,
            hostname,
            ownerUsername,
            url: buildUrl(creds, o.key),
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

    const finalUrl = buildUrl(creds, key)
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

// BULK DELETE OBJECTS — accepts { items: { hostname, key }[] }
uploadRoutes.post('/bulk-delete', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const body = await c.req.json()
    const items: { hostname: string; key: string }[] = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return c.json({ error: 'items array zaroori hai (kam se kam ek item)' }, 400)
    }

    const byHostname = new Map<string, string[]>()
    for (const { hostname, key } of items) {
      if (!hostname || !key) continue
      if (!byHostname.has(hostname)) byHostname.set(hostname, [])
      byHostname.get(hostname)!.push(key)
    }

    const deleted: { hostname: string; key: string }[] = []
    const errors: { hostname: string; key: string; message: string }[] = []

    for (const [hostname, keys] of byHostname) {
      const allowed = await checkHostnameAccess(hostname, admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!allowed) {
        keys.forEach(key => errors.push({ hostname, key, message: 'Access denied' }))
        continue
      }

      const creds = await resolveUploadCreds(hostname, c)
      if (!creds) {
        keys.forEach(key => errors.push({ hostname, key, message: 'Invalid hostname' }))
        continue
      }

      try {
        const result = await deleteObjects(creds, keys)
        result.deleted.forEach(key => deleted.push({ hostname, key }))
        result.errors.forEach(e => errors.push({ hostname, key: e.key, message: e.message }))
      } catch (err: any) {
        keys.forEach(key => errors.push({ hostname, key, message: err.message || 'Delete failed' }))
      }
    }

    return c.json({ success: errors.length === 0, deleted, errors })
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
    return c.json({ success: true, url: buildUrl(creds, newKey) })
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

    if (!(hostname in staticBucketHostMap)) {
      const creds = await resolveUploadCreds(hostname, c)
      if (!creds) return c.json({ error: 'Invalid hostname' }, 400)
      // ✅ Pehle 6 ghante tha — ab watch 1 ghanta, download 15 minute
      const expiresIn = mode === 'download' ? 15 * 60 : 60 * 60
      const url = await generateGetUrl(creds, key, { expiresIn, download: mode === 'download' })
      return c.json({ url })
    }

    const fullUrl = `https://${hostname}/${encodeURIComponent(key)}`
    const signed = await signDownloadUrl(
      null as any,
      fullUrl,
      {
        R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
        ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      },
      mode === 'download' ? 'download' : 'watch'
    )
    return c.json({ url: signed })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Simple image upload (for thumbnails) using existing animedata bucket and public domain
const THUMBNAIL_FOLDER = 'image/'
const THUMBNAIL_HOSTNAME = 'files.animebing.in'

uploadRoutes.post('/image-presign', adminAuth, async (c) => {
  try {
    const { filename } = await c.req.json()
    if (!filename) return c.json({ error: 'filename required' }, 400)

    const creds = await resolveUploadCreds(THUMBNAIL_HOSTNAME, c)
    if (!creds) return c.json({ error: 'Bucket not configured' }, 500)

    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg'
    const key = `${THUMBNAIL_FOLDER}thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const uploadUrl = await generateSimplePutUrl(creds, key)
    const publicUrl = `https://${THUMBNAIL_HOSTNAME}/${key}`

    return c.json({ uploadUrl, publicUrl })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ SELF-SERVICE: Sub-admin multiple R2 buckets ============

function toSafeProvider(p: any) {
  return {
    id: String(p._id),
    hostname: p.hostname,
    bucketName: p.bucketName,
    accountId: p.accountId,
    isActive: p.isActive !== false,
    publicBaseUrl: p.publicBaseUrl || '',
  }
}

// STATUS — saare connected buckets (secret kabhi return nahi hota)
uploadRoutes.get('/my-provider', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') return c.json({ error: 'Yeh feature sirf sub-admin ke liye hai' }, 403)

    const list = await findMany<IR2Provider>(
      'r2providers', { ownerUsername: admin.username }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    return c.json({
      connected: list.length > 0,
      providers: list.map(toSafeProvider),
      maxBuckets: MAX_SUBADMIN_BUCKETS,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// CONNECT — naya bucket add karo (same account+bucket dobara bheja to credentials update honge)
uploadRoutes.post('/my-provider', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') return c.json({ error: 'Yeh feature sirf sub-admin ke liye hai' }, 403)

    const { bucketName, accountId, accessKeyId, secretAccessKey } = await c.req.json()
    if (!bucketName || !accountId || !accessKeyId || !secretAccessKey) {
      return c.json({ error: 'Bucket Name, Account ID, Access Key aur Secret Key zaroori hain' }, 400)
    }

    const { ciphertext, iv } = await encryptSecret(secretAccessKey, c.env.ENCRYPTION_KEY)

    const existing = await findOne<IR2Provider>(
      'r2providers', { ownerUsername: admin.username, accountId, bucketName },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    if (existing) {
      await updateOne(
        'r2providers', { _id: (existing as any)._id },
        { accessKeyId, encryptedSecretAccessKey: ciphertext, iv },
        c.env.MONGODB_URI, c.env.MONGODB_DB
      )
      return c.json({ success: true, hostname: (existing as any).hostname, updated: true })
    }

    const owned = await findMany<IR2Provider>(
      'r2providers', { ownerUsername: admin.username }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (owned.length >= MAX_SUBADMIN_BUCKETS) {
      return c.json({ error: `Maximum ${MAX_SUBADMIN_BUCKETS} buckets connect kar sakte ho` }, 400)
    }

    // 🔒 hostname backend banata hai — unique per (user + account + bucket)
    const safeBucket = String(bucketName).toLowerCase().replace(/[^a-z0-9-]/g, '')
    const hostname = `${admin.username}-${String(accountId).slice(0, 6)}-${safeBucket}-r2.internal`.toLowerCase()

    const clash = await findOne('r2providers', { hostname }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (clash) return c.json({ error: 'Yeh bucket pehle se connected hai' }, 400)

    await insertOne('r2providers', {
      hostname,
      bucketName,
      accountId,
      accessKeyId,
      encryptedSecretAccessKey: ciphertext,
      iv,
      ownerUsername: admin.username, // 🔒 hamesha JWT se
      label: `${bucketName} (${admin.username})`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, hostname })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DISCONNECT — ek specific bucket hatao
uploadRoutes.delete('/my-provider/:id', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') return c.json({ error: 'Yeh feature sirf sub-admin ke liye hai' }, 403)

    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const p = await findOne<IR2Provider>(
      'r2providers', { _id: toObjectId(id), ownerUsername: admin.username },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (!p) return c.json({ error: 'Bucket nahi mila' }, 404)

    await deleteOne('r2providers', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PUBLIC URL — ek specific bucket ka
uploadRoutes.patch('/my-provider/:id/public-url', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') return c.json({ error: 'Yeh feature sirf sub-admin ke liye hai' }, 403)

    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const p = await findOne<IR2Provider>(
      'r2providers', { _id: toObjectId(id), ownerUsername: admin.username },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (!p) return c.json({ error: 'Bucket nahi mila' }, 404)

    const { publicBaseUrl } = await c.req.json()
    let clean = ''
    if (publicBaseUrl) {
      try {
        const u = new URL(publicBaseUrl)
        if (u.protocol !== 'https:') throw new Error()
        clean = (u.origin + u.pathname).replace(/\/+$/, '')
      } catch {
        return c.json({ error: 'Valid https URL daalo (e.g. https://pub-xxxx.r2.dev)' }, 400)
      }
    }
    await updateOne('r2providers', { _id: toObjectId(id) }, { publicBaseUrl: clean }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, publicBaseUrl: clean })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Account ke andar ke buckets fetch karo (dropdown ke liye)
uploadRoutes.post('/list-buckets', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') {
      return c.json({ error: 'Yeh feature sirf sub-admin ke liye hai' }, 403)
    }
    const { accountId, accessKeyId, secretAccessKey } = await c.req.json()
    if (!accountId || !accessKeyId || !secretAccessKey) {
      return c.json({ error: 'Account ID, Access Key aur Secret Key zaroori hain' }, 400)
    }
    const buckets = await listBuckets(accountId, accessKeyId, secretAccessKey)
    return c.json({ buckets })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default uploadRoutes