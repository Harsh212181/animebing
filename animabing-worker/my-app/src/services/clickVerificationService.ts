import { ObjectId, Db } from 'mongodb'
import { IClickSession, IShortenerClickSettings } from '../models/types'

const DEFAULT_SETTINGS: IShortenerClickSettings = {
  requireFullCycle: true,
  sessionExpiryMinutes: 45,
  minDwellSeconds: 3,
  updatedAt: new Date()
}

// ============================================================================
// ✅ MIGRATED: Saare exported functions ab `db: Db` accept karte hain (pehla arg).
// Har caller `withDb` ke andar wrap karega — connection pooling via mongoService.
// ============================================================================

// ============ SETTINGS ============
export async function getClickSettings(db: Db): Promise<IShortenerClickSettings> {
  const doc = await db.collection('shortenerclicksettings').findOne({})
  if (!doc) return DEFAULT_SETTINGS
  return {
    requireFullCycle: doc.requireFullCycle ?? true,
    sessionExpiryMinutes: doc.sessionExpiryMinutes ?? 45,
    minDwellSeconds: doc.minDwellSeconds ?? 3,
    updatedAt: doc.updatedAt
  }
}

// ============ USER-AWARE SETTINGS RESOLVER ============
export async function getEffectiveClickSettings(
  db: Db,
  userId: ObjectId | null
): Promise<IShortenerClickSettings & { source: 'user' | 'global' }> {
  const globalSettings = await getClickSettings(db)

  if (!userId) return { ...globalSettings, source: 'global' }

  const user = await db.collection('shortusers').findOne(
    { _id: userId },
    { projection: { requireFullCycle: 1 } }
  )

  if (user && (user.requireFullCycle === true || user.requireFullCycle === false)) {
    return { ...globalSettings, requireFullCycle: user.requireFullCycle, source: 'user' }
  }

  return { ...globalSettings, source: 'global' }
}

// ============ BULK UPDATE — single ya multiple users ============
export async function updateUsersFullCycleOverride(
  db: Db,
  userIds: string[],
  value: boolean | null
): Promise<{ modifiedCount: number }> {
  const objectIds = userIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  if (objectIds.length === 0) return { modifiedCount: 0 }

  const result = await db.collection('shortusers').updateMany(
    { _id: { $in: objectIds } },
    { $set: { requireFullCycle: value } }
  )
  return { modifiedCount: result.modifiedCount }
}

export async function updateClickSettings(
  db: Db,
  data: Partial<IShortenerClickSettings>
): Promise<IShortenerClickSettings> {
  await db.collection('shortenerclicksettings').updateOne(
    {}, { $set: { ...data, updatedAt: new Date() } }, { upsert: true }
  )
  return getClickSettings(db)
}

// ============ HMAC SIGN/VERIFY ============
async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function hmacVerify(data: string, sig: string, secret: string): Promise<boolean> {
  return (await hmacSign(data, secret)) === sig
}

// ============ BOT CHECK (shared, simple) ============
export function isFunnelBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  const ua = userAgent.toLowerCase()
  const patterns = ['bot', 'crawl', 'spider', 'curl', 'wget', 'python', 'java', 'go-http', 'node-fetch', 'okhttp', 'axios', 'php', 'headless']
  return patterns.some((p) => ua.includes(p))
}

// ============ RATE LIMIT: same IP se bahut zyada sessions ============
async function isRateLimited(db: Db, ip: string): Promise<boolean> {
  if (ip === 'unknown') return false
  const oneMinAgo = new Date(Date.now() - 60 * 1000)
  const recentCount = await db.collection('clicksessions').countDocuments({
    ip,
    createdAt: { $gte: oneMinAgo }
  })
  return recentCount >= 10
}

// ============ STEP 1: shortlink hit hote hi session start ============
export async function createClickSession(
  db: Db,
  code: string,
  linkId: ObjectId,
  userId: ObjectId | null,
  ip: string,
  userAgent: string,
  secret: string
): Promise<string | null> {
  const limited = await isRateLimited(db, ip)
  if (limited) return null

  const settings = await getClickSettings(db)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + settings.sessionExpiryMinutes * 60 * 1000)

  const session: IClickSession = {
    code, linkId, userId, ip, userAgent,
    stage: 'started',
    createdAt: now,
    expiresAt
  }
  const result = await db.collection('clicksessions').insertOne(session)
  const sessionId = result.insertedId.toHexString()
  const sig = await hmacSign(sessionId, secret)
  return `${sessionId}.${sig}`
}

// ✅ FIX: `db` caller se aata hai — apna connection nahi kholta
async function resolveSession(db: Db, token: string, secret: string) {
  if (!token || !token.includes('.')) return null
  const [sessionId, sig] = token.split('.')
  if (!sessionId || !sig || !ObjectId.isValid(sessionId)) return null
  if (!(await hmacVerify(sessionId, sig, secret))) return null

  const session = await db.collection('clicksessions').findOne({ _id: new ObjectId(sessionId) })
  if (!session) return null
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null
  return session
}

// ============ STEP 2: anime detail page pe pahuncha ============
export async function advanceClickSession(
  db: Db,
  token: string,
  animeId: string | undefined,
  currentIp: string,
  secret: string
): Promise<boolean> {
  const session = await resolveSession(db, token, secret)
  if (!session) return false
  if (session.stage === 'completed') return false
  if (session.stage === 'anime_viewed') return false

  const MIN_ADVANCE_MS = 800
  const elapsed = Date.now() - new Date(session.createdAt).getTime()
  if (elapsed < MIN_ADVANCE_MS) return false

  const ipMismatch = session.ip !== 'unknown' && currentIp !== 'unknown' && session.ip !== currentIp

  await db.collection('clicksessions').updateOne(
    { _id: session._id },
    { $set: { stage: 'anime_viewed', animeId: animeId || session.animeId, animeViewedAt: new Date(), ipMismatch } }
  )
  return true
}

// ============ STEP 3: final watch/download click = funnel complete ============
export async function completeClickSession(
  db: Db,
  token: string,
  animeId: string | undefined,
  secret: string
): Promise<{ success: boolean; error?: string; linkId?: ObjectId }> {
  const session = await resolveSession(db, token, secret)
  if (!session) return { success: false, error: 'Invalid or expired session' }

  if (session.stage === 'completed') return { success: false, error: 'Session already used' }
  if (session.stage !== 'anime_viewed') return { success: false, error: 'Invalid funnel order' }

  if (session.animeId && animeId && String(session.animeId) !== String(animeId)) {
    return { success: false, error: 'Anime mismatch — not the shortlink-linked anime' }
  }

  const settings = await getClickSettings(db)
  if (session.animeViewedAt) {
    const dwellMs = Date.now() - new Date(session.animeViewedAt).getTime()
    if (dwellMs < settings.minDwellSeconds * 1000) {
      return { success: false, error: 'Too fast — suspicious activity' }
    }
  }

  await db.collection('clicksessions').updateOne(
    { _id: session._id },
    { $set: { stage: 'completed', completedAt: new Date() } }
  )

  return { success: true, linkId: session.linkId }
}