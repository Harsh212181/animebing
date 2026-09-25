import { ObjectId, Db } from 'mongodb'
import { getDb } from './mongoService'
import { IClickSession, IShortenerClickSettings } from '../models/types'

const DEFAULT_SETTINGS: IShortenerClickSettings = {
  requireFullCycle: true,
  sessionExpiryMinutes: 45,
  minDwellSeconds: 3,
  updatedAt: new Date()
}

// ============================================================================
// ✅ FIX: har function ab EK OPTIONAL trailing `existingDb` param leta hai
// (episodeSyncService.ts wala backward-compatible pattern). Isse
// `createClickSession` — jo HAR SHORTLINK CLICK pe chalta hai jab
// requireFullCycle ON ho — pehle 3 alag connections khol raha tha
// (isRateLimited + getClickSettings + apna insert), ab sirf 1.
// ============================================================================

// ============ SETTINGS ============
export async function getClickSettings(mongoUri: string, dbName: string, existingDb?: Db): Promise<IShortenerClickSettings> {
  const db = existingDb || await getDb(mongoUri, dbName)
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
// ✅ FIX: pehle getClickSettings() + apna alag getDb() = 2 connections.
// Ab ek `db` khul ke dono ko diya jaata hai.
export async function getEffectiveClickSettings(
  userId: ObjectId | null,
  mongoUri: string, dbName: string,
  existingDb?: Db
): Promise<IShortenerClickSettings & { source: 'user' | 'global' }> {
  const db = existingDb || await getDb(mongoUri, dbName)
  const globalSettings = await getClickSettings(mongoUri, dbName, db)

  if (!userId) return { ...globalSettings, source: 'global' }

  const user = await db.collection('shortusers').findOne({ _id: userId }, { projection: { requireFullCycle: 1 } })

  if (user && (user.requireFullCycle === true || user.requireFullCycle === false)) {
    return { ...globalSettings, requireFullCycle: user.requireFullCycle, source: 'user' }
  }

  return { ...globalSettings, source: 'global' }
}

// ============ BULK UPDATE — single ya multiple users ============
export async function updateUsersFullCycleOverride(
  userIds: string[],
  value: boolean | null,
  mongoUri: string, dbName: string
): Promise<{ modifiedCount: number }> {
  const db = await getDb(mongoUri, dbName)
  const objectIds = userIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  if (objectIds.length === 0) return { modifiedCount: 0 }

  const result = await db.collection('shortusers').updateMany(
    { _id: { $in: objectIds } },
    { $set: { requireFullCycle: value } }
  )
  return { modifiedCount: result.modifiedCount }
}

export async function updateClickSettings(
  data: Partial<IShortenerClickSettings>,
  mongoUri: string, dbName: string
): Promise<IShortenerClickSettings> {
  const db = await getDb(mongoUri, dbName)
  await db.collection('shortenerclicksettings').updateOne(
    {}, { $set: { ...data, updatedAt: new Date() } }, { upsert: true }
  )
  return getClickSettings(mongoUri, dbName, db)
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
// ✅ FIX: ab `existingDb` optional param leta hai
async function isRateLimited(ip: string, mongoUri: string, dbName: string, existingDb?: Db): Promise<boolean> {
  if (ip === 'unknown') return false
  const db = existingDb || await getDb(mongoUri, dbName)
  const oneMinAgo = new Date(Date.now() - 60 * 1000)
  const recentCount = await db.collection('clicksessions').countDocuments({
    ip,
    createdAt: { $gte: oneMinAgo }
  })
  return recentCount >= 10
}

// ============ STEP 1: shortlink hit hote hi session start ============
// ✅ FIX: pehle isRateLimited() + getClickSettings() + apna getDb() = 3
// alag connections. Ab ek hi `db` khul ke sabko pass hota hai — 1 connection.
export async function createClickSession(
  code: string,
  linkId: ObjectId,
  userId: ObjectId | null,
  ip: string,
  userAgent: string,
  secret: string,
  mongoUri: string, dbName: string
): Promise<string | null> {
  const db = await getDb(mongoUri, dbName)

  const limited = await isRateLimited(ip, mongoUri, dbName, db)
  if (limited) return null

  const settings = await getClickSettings(mongoUri, dbName, db)

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

async function resolveSession(token: string, secret: string, mongoUri: string, dbName: string) {
  if (!token || !token.includes('.')) return null
  const [sessionId, sig] = token.split('.')
  if (!sessionId || !sig || !ObjectId.isValid(sessionId)) return null
  if (!(await hmacVerify(sessionId, sig, secret))) return null

  const db = await getDb(mongoUri, dbName)
  const session = await db.collection('clicksessions').findOne({ _id: new ObjectId(sessionId) })
  if (!session) return null
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null
  return { db, session }
}

// ============ STEP 2: anime detail page pe pahuncha ============
// (Ye pehle se hi resolveSession ka db reuse kar raha tha — sahi tha, koi change nahi)
export async function advanceClickSession(
  token: string, animeId: string | undefined, currentIp: string,
  secret: string, mongoUri: string, dbName: string
): Promise<boolean> {
  const resolved = await resolveSession(token, secret, mongoUri, dbName)
  if (!resolved) return false
  const { db, session } = resolved
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
// ✅ FIX: pehle `getClickSettings()` apna alag connection kholta tha (resolveSession
// ke db se alag). Ab resolved.db pass karte hain — total 1 connection is poore
// funnel-completion call ke liye.
export async function completeClickSession(
  token: string, animeId: string | undefined, secret: string, mongoUri: string, dbName: string
): Promise<{ success: boolean; error?: string; linkId?: ObjectId }> {
  const resolved = await resolveSession(token, secret, mongoUri, dbName)
  if (!resolved) return { success: false, error: 'Invalid or expired session' }
  const { db, session } = resolved

  if (session.stage === 'completed') return { success: false, error: 'Session already used' }
  if (session.stage !== 'anime_viewed') return { success: false, error: 'Invalid funnel order' }

  if (session.animeId && animeId && String(session.animeId) !== String(animeId)) {
    return { success: false, error: 'Anime mismatch — not the shortlink-linked anime' }
  }

  const settings = await getClickSettings(mongoUri, dbName, db) // ✅ db pass kiya
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