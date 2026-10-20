import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findOne, findMany, updateOne, deleteOne, insertOne, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
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
  headObjectSize,
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

// Sub-admin kitne apne R2 buckets connect kar sakta hai
const MAX_SUBADMIN_BUCKETS = 5

// ============ PLANS / BILLING CONFIG ============
const GB = 1024 ** 3
const GRACE_DAYS = 3                  // mahine ke pehle itne din bina payment ke bhi upload chalega
const IST_MS = 5.5 * 3600 * 1000
const round2 = (n: number) => Math.round(n * 100) / 100

function istNow() { return new Date(Date.now() + IST_MS) }
function currentMonth() {
  const n = istNow()
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`
}

// ============ HELPERS ============
function encodeKeyPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

function physicalId(hostname: string): string {
  return hostname in staticBucketHostMap ? `static:${staticBucketHostMap[hostname]}` : `prov:${hostname}`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-\[\] ]/g, '').trim()
}

function buildUrl(creds: any, key: string): string {
  return creds.publicBaseUrl ? `${creds.publicBaseUrl}/${encodeKeyPath(key)}` : ''
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
  // '.internal' hostname asli URL nahi hota — isse kabhi public URL mat banao
  const fallbackBase = hostname.endsWith('.internal') ? '' : `https://${hostname}`
  return {
    accountId: (provider as any).accountId,
    accessKeyId: (provider as any).accessKeyId,
    secretAccessKey,
    bucketName: (provider as any).bucketName,
    publicBaseUrl: ((provider as any).publicBaseUrl || fallbackBase).replace(/\/+$/, ''),
  }
}

// ---- Grants (bucket access plans) ----
// ---- Usage cache ----
// Folder ka size har baar R2 se list karke nahi nikalte. Ek baar list karke grant me save
// (grant.usage) kar dete hain. Dobara tabhi padhte hain jab:
//   • cache nahi hai / 6 ghante purana hai
//   • folder me kuch delete hua (stale mark hota hai)
//   • admin "Refresh" dabaye
// Naya upload hone par list nahi hota — asli file size (HEAD) cache me jod diya jata hai.
const USAGE_TTL_MS = 6 * 3600 * 1000

interface UsageCache { bytes: number; files: number; updatedAt: string; stale?: boolean }

function isFreshUsage(u: UsageCache | undefined | null): u is UsageCache {
  if (!u || u.stale || !u.updatedAt) return false
  return Date.now() - new Date(u.updatedAt).getTime() < USAGE_TTL_MS
}

async function recomputeUsage(g: any, creds: any, c: any): Promise<UsageCache> {
  const objs = await listBucketObjects(creds, `${g.username}/`)
  const usage: UsageCache = {
    bytes: objs.reduce((s, o) => s + o.size, 0),
    files: objs.length,
    updatedAt: new Date().toISOString(),
    stale: false,
  }
  await saveUsage(g, usage, c)
  return usage
}

async function saveUsage(g: any, usage: UsageCache, c: any) {
  await updateOne('bucketgrants', { _id: g._id }, { usage }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  g.usage = usage
}

async function getUsage(g: any, creds: any, c: any, force = false): Promise<UsageCache> {
  if (!force && isFreshUsage(g.usage)) return g.usage
  return recomputeUsage(g, creds, c)
}

// Delete hone par cache purana ho jata hai — agli baar zarurat padne par dobara read hoga
async function markUsageStale(hostname: string, keys: string[], c: any) {
  try {
    const users = new Set(keys.filter(k => k.includes('/')).map(k => k.split('/')[0]))
    if (!users.size) return
    const phys = physicalId(hostname)
    const grants = await findMany<any>('bucketgrants', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    for (const g of grants) {
      if (physicalId(g.hostname) === phys && users.has(g.username)) {
        const base = g.usage || { bytes: 0, files: 0, updatedAt: new Date().toISOString() }
        await updateOne('bucketgrants', { _id: g._id }, { usage: { ...base, stale: true } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      }
    }
  } catch { /* cache hai, fail hone par bhi 6 ghante me khud theek ho jayega */ }
}

// ============ RESERVATIONS (concurrent upload safety) ============
const RESERVATION_TTL_MS = 24 * 3600 * 1000

// Mongo field name me '.' ya '$' nahi chalta
const safeId = (uploadId: string) => uploadId.replace(/[^A-Za-z0-9_-]/g, '_')

// Atomic: sirf tab reserve hoga jab used + pending + naya size <= limit
async function reserveSpace(g: any, uploadId: string, size: number, limitBytes: number, c: any): Promise<boolean> {
  return withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'upload/reserve', async (db) => {
    const col = db.collection('bucketgrants')
    const now = Date.now()

    // 1) Purani (expire hui) reservations saaf karo
    const cur: any = await col.findOne({ _id: g._id }, { projection: { reservations: 1 } })
    const expired = Object.entries(cur?.reservations || {})
      .filter(([, r]: any) => now - (r.at || 0) > RESERVATION_TTL_MS)
    if (expired.length) {
      const unset: Record<string, ''> = {}
      let freed = 0
      for (const [k, r] of expired as [string, any][]) { unset[`reservations.${k}`] = ''; freed += r.size || 0 }
      await col.updateOne({ _id: g._id }, { $unset: unset, $inc: { pendingBytes: -freed } })
    }

    // 2) Atomic limit check + reserve
    const res = await col.updateOne(
      {
        _id: g._id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ['$usage.bytes', 0] }, { $max: [0, { $ifNull: ['$pendingBytes', 0] }] }, size] },
            limitBytes,
          ],
        },
      },
      {
        $inc: { pendingBytes: size },
        $set: { [`reservations.${safeId(uploadId)}`]: { size, at: now } },
      }
    )
    return res.matchedCount === 1
  })
}

async function releaseReservation(grantId: any, uploadId: string, c: any) {
  try {
    await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'upload/release', async (db) => {
      const col = db.collection('bucketgrants')
      const k = `reservations.${safeId(uploadId)}`
      const before: any = await col.findOneAndUpdate(
        { _id: grantId, [k]: { $exists: true } },
        { $unset: { [k]: '' } },
        { returnDocument: 'before' }
      )
      const size = before?.reservations?.[safeId(uploadId)]?.size
      if (size) await col.updateOne({ _id: grantId }, { $inc: { pendingBytes: -size } })
    })
  } catch { /* TTL se khud saaf ho jayegi */ }
}

// Atomic usage update — dono uploads ek saath complete hon to bhi koi size lost nahi hoga
async function incUsage(grantId: any, bytes: number, files: number, c: any): Promise<number> {
  return withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'upload/inc-usage', async (db) => {
    const after: any = await db.collection('bucketgrants').findOneAndUpdate(
      { _id: grantId },
      {
        $inc: { 'usage.bytes': bytes, 'usage.files': files },
        $set: { 'usage.updatedAt': new Date().toISOString(), 'usage.stale': false },
      },
      { returnDocument: 'after' }
    )
    return Number(after?.usage?.bytes) || 0
  })
}

// Limit beech mahine me badhao to:
//  • naya limit usi din se lag jata hai (upload ke liye)
//  • is mahine ka paid amount nahi badalta; fark "dueAmount" (top-up) ke roop me dikhta hai
//  • agle mahine se poora naya limit (purana + naya) × price ka bill banta hai
function planInfo(g: any) {
  const month = currentMonth()
  const planFee = round2((Number(g.limitGb) || 0) * (Number(g.pricePerGb) || 0))
  const paidEntry = (g.payments || []).find((p: any) => p.month === month)
  const paid = !!paidEntry
  const paidAmount = paidEntry ? round2(Number(paidEntry.amount) || 0) : 0
  const free = planFee === 0
  const dueAmount = free ? 0 : round2(Math.max(0, planFee - paidAmount))
  const inGrace = !paid && !free && istNow().getUTCDate() <= GRACE_DAYS
  return {
    month,
    planFee,
    paid, paidAmount, dueAmount, free, inGrace,
    canUpload: paid || free || inGrace,
  }
}

function serializeGrant(g: any, usage: UsageCache | null, label: string) {
  const p = planInfo(g)
  const limitBytes = (Number(g.limitGb) || 0) * GB
  const usedBytes = usage ? usage.bytes : null
  const pct = usedBytes === null || limitBytes <= 0 ? 0 : Math.round((usedBytes / limitBytes) * 1000) / 10
  const level: 'ok' | 'near' | 'full' = pct >= 100 ? 'full' : pct >= 80 ? 'near' : 'ok'
  return {
    id: String(g._id),
    hostname: g.hostname,
    label,
    username: g.username,
    limitGb: g.limitGb,
    pricePerGb: g.pricePerGb,
    usedBytes,
    usageUpdatedAt: usage?.updatedAt || null,
    pct,
    level,                       // ok | near (80%+) | full (100%)
    month: p.month,
    fee: p.planFee,
    planFee: p.planFee,
    paid: p.paid,
    paidAmount: p.paidAmount,
    dueAmount: p.dueAmount,      // paid hone ke baad bhi limit badhi ho to top-up baaki
    free: p.free,
    inGrace: p.inGrace,
    canUpload: p.canUpload,
    graceDays: GRACE_DAYS,
    payments: (g.payments || []).slice(-6).reverse(),
  }
}

function labelOf(hostname: string, providerByHost: Map<string, any>): string {
  if (hostname in staticBucketHostMap) return hostname
  const p = providerByHost.get(hostname)
  return p?.label || hostname
}

async function activeProviders(c: any): Promise<any[]> {
  return findMany<IR2Provider>(
    'r2providers', { isActive: { $ne: false } }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
  ) as any
}

// ---- Access resolution ----
interface Access {
  allowed: boolean
  prefix: string | null   // sub-admin ko shared bucket me sirf is folder tak access
  grant?: any
}

async function resolveAccess(hostname: string, admin: any, c: any): Promise<Access> {
  const isSub = admin?.role === 'subadmin'
  const isStatic = hostname in staticBucketHostMap

  if (!isSub) {
    if (isStatic) return { allowed: true, prefix: null }
    const p = await findOne<IR2Provider>('r2providers', { hostname, isActive: { $ne: false } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return { allowed: !!p, prefix: null }
  }

  let providerOwner: string | null = null
  if (!isStatic) {
    const p: any = await findOne<IR2Provider>('r2providers', { hostname, isActive: { $ne: false } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!p) return { allowed: false, prefix: null }
    providerOwner = p.ownerUsername || null
    if (providerOwner === admin.username) return { allowed: true, prefix: null }   // apna khud ka R2
    if (providerOwner) return { allowed: false, prefix: null }                      // kisi aur ka
  }

  // Shared bucket — grant chahiye
  const grant = await findOne<any>('bucketgrants', { hostname, username: admin.username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
  if (!grant) return { allowed: false, prefix: null }
  return { allowed: true, prefix: `${admin.username}/`, grant }
}

function keyAllowed(access: Access, key: string): boolean {
  return !access.prefix || key.startsWith(access.prefix)
}

const isAdminOnly = (c: any) => c.get('admin')?.role !== 'subadmin'

// ============ BUCKETS (upload dropdown) ============
uploadRoutes.get('/buckets', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const providers = await activeProviders(c)
    const providerByHost = new Map(providers.map((p: any) => [p.hostname, p]))

    if (admin?.role === 'subadmin') {
      const own = providers
        .filter((p: any) => p.ownerUsername === admin.username)
        .map((p: any) => ({ hostname: p.hostname, label: p.label || p.hostname, ownerUsername: p.ownerUsername }))

      const grants = await findMany<any>('bucketgrants', { username: admin.username }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
      const shared = grants
        .filter((g: any) => g.hostname in staticBucketHostMap || (providerByHost.get(g.hostname) && !providerByHost.get(g.hostname).ownerUsername))
        .map((g: any) => ({ hostname: g.hostname, label: `${labelOf(g.hostname, providerByHost)} (shared)`, shared: true }))

      return c.json([...own, ...shared])
    }

    const staticList = Object.keys(staticBucketHostMap).map(h => ({ hostname: h, label: h }))
    const dynamicList = providers.map((p: any) => ({
      hostname: p.hostname, label: p.label || p.hostname, ownerUsername: p.ownerUsername
    }))
    return c.json([...staticList, ...dynamicList])
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ LIST ============
uploadRoutes.get('/list', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const isSub = admin?.role === 'subadmin'
    const hostnameParam = c.req.query('hostname')

    const providers = await activeProviders(c)
    const providerByHost = new Map(providers.map((p: any) => [p.hostname, p]))

    const grants = await findMany<any>(
      'bucketgrants', isSub ? { username: admin.username } : {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    const grantUsersByPhys = new Map<string, Set<string>>()
    grants.forEach((g: any) => {
      const k = physicalId(g.hostname)
      if (!grantUsersByPhys.has(k)) grantUsersByPhys.set(k, new Set())
      grantUsersByPhys.get(k)!.add(g.username)
    })

    type Target = { hostname: string; prefix: string | null }
    const targets: Target[] = []

    if (hostnameParam && hostnameParam !== 'all') {
      const access = await resolveAccess(hostnameParam, admin, c)
      if (!access.allowed) return c.json({ error: 'Access denied for this bucket' }, 403)
      targets.push({ hostname: hostnameParam, prefix: access.prefix })
    } else if (isSub) {
      providers
        .filter((p: any) => p.ownerUsername === admin.username)
        .forEach((p: any) => targets.push({ hostname: p.hostname, prefix: null }))
      grants.forEach((g: any) => {
        const okHost = g.hostname in staticBucketHostMap ||
          (providerByHost.get(g.hostname) && !providerByHost.get(g.hostname).ownerUsername)
        if (okHost) targets.push({ hostname: g.hostname, prefix: `${admin.username}/` })
      })
    } else {
      Object.keys(staticBucketHostMap).forEach(h => targets.push({ hostname: h, prefix: null }))
      providers.forEach((p: any) => targets.push({ hostname: p.hostname, prefix: null }))
    }

    // Dedupe — same physical bucket + same prefix sirf ek baar query karo
    const seen = new Set<string>()
    const uniqueQueries: { hostname: string; prefix: string | null; creds: any }[] = []
    for (const t of targets) {
      const creds = await resolveUploadCreds(t.hostname, c)
      if (!creds) continue
      const k = `${creds.accountId}|${creds.bucketName}|${t.prefix || ''}`
      if (seen.has(k)) continue
      seen.add(k)
      uniqueQueries.push({ ...t, creds })
    }

    const results = await Promise.all(
      uniqueQueries.map(async ({ hostname, prefix, creds }) => {
        try {
          const objects = await listBucketObjects(creds, prefix || undefined)
          const users = grantUsersByPhys.get(physicalId(hostname))
          const providerOwner = providerByHost.get(hostname)?.ownerUsername || null

          return objects.map(o => {
            let ownerUsername: string | null = providerOwner
            if (isSub) {
              ownerUsername = admin.username
            } else if (users && o.key.includes('/')) {
              const seg = o.key.split('/')[0]
              if (users.has(seg)) ownerUsername = seg   // sub-admin ke folder ki file
            }
            return {
              key: o.key,
              size: o.size,
              lastModified: o.lastModified,
              hostname,
              ownerUsername,
              url: buildUrl(creds, o.key),
            }
          })
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

// ============ INITIATE (limit + payment check yahin hota hai) ============
uploadRoutes.post('/initiate', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, filename, size } = await c.req.json()
    if (!hostname || !filename) return c.json({ error: 'hostname aur filename zaroori hai' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed) return c.json({ error: 'Is bucket par aapko access nahi hai' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname / provider not found' }, 400)

    let key = sanitizeFilename(filename)
    if (!key) return c.json({ error: 'Invalid filename' }, 400)

    if (access.prefix && access.grant) {
      const g = access.grant
      const plan = planInfo(g)

      if (!plan.canUpload) {
        return c.json({
          error: `Is mahine (${plan.month}) ki fee ₹${plan.planFee.toFixed(2)} abhi pending hai. Admin ko payment karke confirm karwao, phir upload kar sakte ho.`,
          code: 'PAYMENT_PENDING',
        }, 402)
      }

      key = access.prefix + key
    }

    const uploadId = await initiateMultipartUpload(creds, key)

    // 🔒 Atomic reserve: parallel uploads ek dusre ka space nahi kha sakte
    if (access.prefix && access.grant) {
      const g = access.grant
      const ok = await reserveSpace(g, uploadId, Number(size) || 0, Number(g.limitGb) * GB, c)
      if (!ok) {
        try { await abortMultipartUpload(creds, key, uploadId) } catch { /* ignore */ }
        return c.json({
          error: 'Limit poori ho gayi, admin se limit badhwao. (Is file ke liye jagah nahi bachi)',
          code: 'LIMIT_EXCEEDED',
        }, 413)
      }
    }

    return c.json({ uploadId, key, hostname })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PART URL
uploadRoutes.post('/part-url', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, key, uploadId, partNumber } = await c.req.json()
    if (!hostname || !key || !uploadId || !partNumber) return c.json({ error: 'Missing fields' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, key)) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    const url = await generatePartUploadUrl(creds, key, uploadId, partNumber)
    return c.json({ url })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// COMPLETE — upload poora hone ke baad asli size se limit dobara check
uploadRoutes.post('/complete', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, key, uploadId, parts } = await c.req.json()
    if (!hostname || !key || !uploadId || !Array.isArray(parts)) return c.json({ error: 'Missing fields' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, key)) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await completeMultipartUpload(creds, key, uploadId, parts)

    // 🔒 Frontend ka bheja size jhootha ho sakta hai — asli size R2 se (HEAD) lekar dobara check
    if (access.prefix && access.grant) {
      const g = access.grant
      const limitBytes = Number(g.limitGb) * GB

      let realSize = -1
      try { realSize = await headObjectSize(creds, key) } catch { realSize = -1 }

      // Fresh cache ke liye DB se latest padho (g purana ho sakta hai)
      const latest = await findOne<any>('bucketgrants', { _id: g._id }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      const cacheFresh = isFreshUsage(latest?.usage)

      let total: number
      if (cacheFresh && realSize >= 0) {
        total = await incUsage(g._id, realSize, 1, c)           // atomic $inc
      } else {
        const objs = await listBucketObjects(creds, access.prefix)   // nayi file already shamil
        total = objs.reduce((s, o) => s + o.size, 0)
        await saveUsage(g, { bytes: total, files: objs.length, updatedAt: new Date().toISOString(), stale: false }, c)
      }

      if (total > limitBytes) {
        try { await deleteObject(creds, key) } catch { /* ignore */ }
        if (cacheFresh && realSize >= 0) await incUsage(g._id, -realSize, -1, c)   // wapas ghatao
        else if (realSize >= 0) await incUsage(g._id, -realSize, -1, c)
        else await markUsageStale(hostname, [key], c)
        await releaseReservation(g._id, uploadId, c)
        return c.json({
          error: `Limit poori ho gayi, admin se limit badhwao. Yeh file limit (${g.limitGb} GB) se bahar ja rahi thi, isliye hata di gayi.`,
          code: 'LIMIT_EXCEEDED',
        }, 413)
      }

      await releaseReservation(g._id, uploadId, c)   // usage count ho gaya, ab reservation hatao
    }

    return c.json({ success: true, url: buildUrl(creds, key) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ABORT
uploadRoutes.post('/abort', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, key, uploadId } = await c.req.json()
    if (!hostname || !key || !uploadId) return c.json({ error: 'Missing fields' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, key)) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await abortMultipartUpload(creds, key, uploadId)
    if (access.grant) await releaseReservation(access.grant._id, uploadId, c)
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

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, key)) return c.json({ error: 'Access denied' }, 403)

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await deleteObject(creds, key)
    await markUsageStale(hostname, [key], c)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// BULK DELETE
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
      const access = await resolveAccess(hostname, admin, c)
      if (!access.allowed) {
        keys.forEach(key => errors.push({ hostname, key, message: 'Access denied' }))
        continue
      }

      const okKeys = keys.filter(k => keyAllowed(access, k))
      keys.filter(k => !keyAllowed(access, k)).forEach(key => errors.push({ hostname, key, message: 'Access denied' }))
      if (okKeys.length === 0) continue

      const creds = await resolveUploadCreds(hostname, c)
      if (!creds) {
        okKeys.forEach(key => errors.push({ hostname, key, message: 'Invalid hostname' }))
        continue
      }

      try {
        const result = await deleteObjects(creds, okKeys)
        result.deleted.forEach(key => deleted.push({ hostname, key }))
        result.errors.forEach(e => errors.push({ hostname, key: e.key, message: e.message }))
        if (result.deleted.length) await markUsageStale(hostname, result.deleted, c)
      } catch (err: any) {
        okKeys.forEach(key => errors.push({ hostname, key, message: err.message || 'Delete failed' }))
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
    const { hostname, oldKey, newKey: newKeyIn } = await c.req.json()
    if (!hostname || !oldKey || !newKeyIn) return c.json({ error: 'Missing fields' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, oldKey)) return c.json({ error: 'Access denied' }, 403)

    // Sub-admin hamesha apne folder ke andar hi rename kar sakta hai
    let newKey = String(newKeyIn)
    if (access.prefix) {
      const rest = newKey.startsWith(access.prefix) ? newKey.slice(access.prefix.length) : newKey
      const clean = sanitizeFilename(rest.replace(/\//g, ''))
      if (!clean) return c.json({ error: 'Invalid name' }, 400)
      newKey = access.prefix + clean
    }

    const creds = await resolveUploadCreds(hostname, c)
    if (!creds) return c.json({ error: 'Invalid hostname' }, 400)

    await renameObject(creds, oldKey, newKey)
    return c.json({ success: true, url: buildUrl(creds, newKey), key: newKey })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET all marked shows (sirf apne)
uploadRoutes.get('/marks', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const me = admin?.username || 'unknown'
    const marks = await findMany<any>('markedshows', { markedBy: me }, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(marks.map((m: any) => ({ groupKey: m.groupKey, displayName: m.displayName })))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// MARK a show (group)
uploadRoutes.post('/mark', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const me = admin?.username || 'unknown'
    const { groupKey, displayName } = await c.req.json()
    if (!groupKey) return c.json({ error: 'groupKey zaroori hai' }, 400)

    await updateOne(
      'markedshows',
      { groupKey, markedBy: me },
      { groupKey, displayName: displayName || groupKey, markedBy: me },
      c.env.MONGODB_URI,
      c.env.MONGODB_DB,
      true
    )
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UNMARK a show (sirf apna mark)
uploadRoutes.delete('/mark', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const me = admin?.username || 'unknown'
    const groupKey = c.req.query('groupKey')
    if (!groupKey) return c.json({ error: 'groupKey zaroori hai' }, 400)

    await deleteOne('markedshows', { groupKey, markedBy: me }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PREVIEW URL — Watch / Download signed link
uploadRoutes.post('/preview-url', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { hostname, key, mode } = await c.req.json()
    if (!hostname || !key) return c.json({ error: 'Missing fields' }, 400)

    const access = await resolveAccess(hostname, admin, c)
    if (!access.allowed || !keyAllowed(access, key)) return c.json({ error: 'Access denied' }, 403)

    if (!(hostname in staticBucketHostMap)) {
      const creds = await resolveUploadCreds(hostname, c)
      if (!creds) return c.json({ error: 'Invalid hostname' }, 400)
      // Watch 1 ghanta, Download 15 minute
      const expiresIn = mode === 'download' ? 15 * 60 : 60 * 60
      const url = await generateGetUrl(creds, key, { expiresIn, download: mode === 'download' })
      return c.json({ url })
    }

    const fullUrl = `https://${hostname}/${encodeKeyPath(key)}`
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

// Simple image upload (thumbnails)
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

// ============================================================
//  SHARED BUCKET GRANTS — admin ek bucket kai sub-admins ko de sakta hai
//  (har sub-admin ka alag folder, limit aur monthly fee)
// ============================================================

// Kaun kaun se buckets share kiye ja sakte hain (static + bina owner wale providers)
uploadRoutes.get('/grantable', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)

    const out: { hostname: string; label: string; kind: 'static' | 'provider' }[] = []
    const seen = new Set<string>()
    for (const [host, bucket] of Object.entries(staticBucketHostMap)) {
      if (seen.has(bucket)) continue
      seen.add(bucket)
      out.push({ hostname: host, label: `${bucket} (${host})`, kind: 'static' })
    }
    const providers = await activeProviders(c)
    providers
      .filter((p: any) => !p.ownerUsername)
      .forEach((p: any) => out.push({ hostname: p.hostname, label: p.label || p.hostname, kind: 'provider' }))

    return c.json(out)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Saare grants + used GB
uploadRoutes.get('/grants', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)

    const grants = await findMany<any>('bucketgrants', {}, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const providers = await activeProviders(c)
    const providerByHost = new Map(providers.map((p: any) => [p.hostname, p]))

    const force = c.req.query('refresh') === '1'   // admin "Refresh" dabaye to R2 se dobara padho
    const rows = await Promise.all(grants.map(async (g: any) => {
      let usage: UsageCache | null = null
      try {
        const creds = await resolveUploadCreds(g.hostname, c)
        if (creds) usage = await getUsage(g, creds, c, force)
        else usage = g.usage || null
      } catch { usage = g.usage || null }
      return serializeGrant(g, usage, labelOf(g.hostname, providerByHost))
    }))

    rows.sort((a, b) => a.username.localeCompare(b.username) || a.label.localeCompare(b.label))
    return c.json({ month: currentMonth(), graceDays: GRACE_DAYS, grants: rows })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

function validLimit(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n <= 100000 ? round2(n) : null
}
function validPrice(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? round2(n) : null
}

// Naya grant (ya same bucket+sub-admin par limit/price update)
uploadRoutes.post('/grants', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)

    const { hostname, username, limitGb, pricePerGb } = await c.req.json()
    const limit = validLimit(limitGb)
    const price = validPrice(pricePerGb)
    if (!hostname || !username) return c.json({ error: 'Bucket aur sub-admin select karo' }, 400)
    if (limit === null) return c.json({ error: 'Valid limit (GB) daalo' }, 400)
    if (price === null) return c.json({ error: 'Valid price daalo' }, 400)

    // Sirf share-able bucket
    if (!(hostname in staticBucketHostMap)) {
      const p: any = await findOne<IR2Provider>('r2providers', { hostname, isActive: { $ne: false } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (!p) return c.json({ error: 'Bucket nahi mila' }, 404)
      if (p.ownerUsername) return c.json({ error: 'Yeh bucket kisi sub-admin ka apna hai, share nahi ho sakta' }, 400)
    }

    const sub = await findOne<any>('subadmins', { username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!sub) return c.json({ error: `Sub-admin "${username}" nahi mila` }, 404)

    const existing = await findOne<any>('bucketgrants', { hostname, username }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (existing) {
      await updateOne('bucketgrants', { _id: existing._id }, { limitGb: limit, pricePerGb: price, updatedAt: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      return c.json({ success: true, updated: true })
    }

    await insertOne('bucketgrants', {
      hostname, username, limitGb: limit, pricePerGb: price,
      payments: [], createdAt: new Date(), updatedAt: new Date(),
    } as any, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Limit / price kabhi bhi badlo
uploadRoutes.patch('/grants/:id', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const g = await findOne<any>('bucketgrants', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!g) return c.json({ error: 'Grant nahi mila' }, 404)

    const body = await c.req.json()
    const patch: any = { updatedAt: new Date() }
    // addGb: purane limit me aur GB jodo (purana + naya). Naya limit usi din se lag jata hai.
    if (body.addGb !== undefined) {
      const a = validLimit(body.addGb)
      if (a === null) return c.json({ error: 'Valid GB daalo' }, 400)
      patch.limitGb = round2((Number(g.limitGb) || 0) + a)
    } else if (body.limitGb !== undefined) {
      const l = validLimit(body.limitGb)
      if (l === null) return c.json({ error: 'Valid limit (GB) daalo' }, 400)
      patch.limitGb = l
    }
    if (body.pricePerGb !== undefined) {
      const p = validPrice(body.pricePerGb)
      if (p === null) return c.json({ error: 'Valid price daalo' }, 400)
      patch.pricePerGb = p
    }
    await updateOne('bucketgrants', { _id: toObjectId(id) }, patch, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Is mahine ki payment: paid / unpaid mark karo
uploadRoutes.post('/grants/:id/paid', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    const g = await findOne<any>('bucketgrants', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!g) return c.json({ error: 'Grant nahi mila' }, 404)

    const { paid } = await c.req.json()
    const month = currentMonth()
    const others = (g.payments || []).filter((p: any) => p.month !== month)

    let payments = others
    if (paid) {
      payments = [...others, {
        month,
        amount: round2((Number(g.limitGb) || 0) * (Number(g.pricePerGb) || 0)), // is waqt ka price lock
        limitGb: g.limitGb,
        pricePerGb: g.pricePerGb,
        paidAt: new Date(),
        markedBy: admin?.username || 'admin',
      }].sort((a: any, b: any) => a.month.localeCompare(b.month)).slice(-24)
    }

    await updateOne('bucketgrants', { _id: toObjectId(id) }, { payments, updatedAt: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, paid: !!paid })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Access hatao (files bucket me rehti hain)
uploadRoutes.delete('/grants/:id', adminAuth, async (c) => {
  try {
    if (!isAdminOnly(c)) return c.json({ error: 'Sirf main admin ke liye' }, 403)
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('bucketgrants', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Sub-admin: apne plans (limit, used, fee, paid status)
uploadRoutes.get('/my-grants', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin?.role !== 'subadmin') return c.json([])

    const grants = await findMany<any>('bucketgrants', { username: admin.username }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const providers = await activeProviders(c)
    const providerByHost = new Map(providers.map((p: any) => [p.hostname, p]))

    const force = c.req.query('refresh') === '1'
    const rows = await Promise.all(grants.map(async (g: any) => {
      let usage: UsageCache | null = null
      try {
        const creds = await resolveUploadCreds(g.hostname, c)
        if (creds) usage = await getUsage(g, creds, c, force)
        else usage = g.usage || null
      } catch { usage = g.usage || null }
      return serializeGrant(g, usage, labelOf(g.hostname, providerByHost))
    }))
    return c.json(rows)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============ SELF-SERVICE: Sub-admin multiple R2 buckets (apna khud ka R2) ============

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
      ownerUsername: admin.username,
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