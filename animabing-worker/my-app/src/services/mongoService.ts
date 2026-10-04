import { MongoClient, Db, ObjectId, Filter, Document } from 'mongodb'

function log(...args: any[]) {
  console.log(`[DB ${new Date().toISOString()}]`, ...args)
}
function logErr(...args: any[]) {
  console.error(`[DB-ERROR ${new Date().toISOString()}]`, ...args)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT after ${ms}ms: ${label}`))
    }, ms)
    promise
      .then((val) => { clearTimeout(timer); resolve(val) })
      .catch((err) => { clearTimeout(timer); reject(err) })
  })
}

const MAX_CONCURRENT_DB = 8
let activeDb = 0
const dbQueue: Array<() => void> = []

async function acquireDbSlot() {
  if (activeDb < MAX_CONCURRENT_DB) { activeDb++; return }
  await new Promise<void>((resolve) => dbQueue.push(resolve))
}
function releaseDbSlot() {
  const next = dbQueue.shift()
  if (next) next()      // slot seedha agle ko de do
  else activeDb--
}

export async function getDb(mongoUri: string, dbName: string): Promise<Db> {
  const t0 = Date.now()
  const client = new MongoClient(mongoUri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 8000,
    maxPoolSize: 5,
    minPoolSize: 0,
  })
  try {
    await withTimeout(client.connect(), 6000, 'getDb connect')
    log(`getDb connected (${Date.now() - t0}ms)`)
    return client.db(dbName)
  } catch (err) {
    logErr(`getDb connect FAILED (${Date.now() - t0}ms)`, err)
    throw err
  }
}

// ✅ Ek request ke andar helper jo: connect -> operation -> close (guaranteed)
// 🆕 FIX: 'export' add kiya gaya — instagramWebhookRoutes.ts aur
// instagramQueueService.ts dono is function ko directly import karte hain,
// export missing hone ki wajah se wahan red/unresolved error aa raha tha.
//
// 🆕 UPDATE: opTimeoutMs optional param add kiya (default 8000ms). Lamba batch
// chalane wale callers ab `withDb(..., 30000)` pass kar sakte hain.
// socketTimeoutMS ko bhi 10000 -> 30000 kar diya taaki lamba batch beech me
// na tute.
export async function withDb<T>(
  mongoUri: string,
  dbName: string,
  label: string,
  fn: (db: Db) => Promise<T>,
  opTimeoutMs = 8000
): Promise<T> {
  // ✅ CONNECTION LIMITER: slot acquire karo (agar 8 already active hain to
  // yahan await pe rukega jab tak koi release na kare)
  await acquireDbSlot()

  const t0 = Date.now()
  const client = new MongoClient(mongoUri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,   // 🆕 10000 -> 30000 (lamba batch ke liye)
    maxPoolSize: 5,
    minPoolSize: 0,
  })

  try {
    await withTimeout(client.connect(), 6000, `connect[${label}]`)
    log(`connected (${Date.now() - t0}ms) for ${label}`)

    const db = client.db(dbName)
    const result = await withTimeout(fn(db), opTimeoutMs, `op[${label}]`)
    log(`${label} succeeded (${Date.now() - t0}ms total)`)
    return result
  } catch (err) {
    logErr(`${label} FAILED (${Date.now() - t0}ms total)`, err)
    throw err
  } finally {
    // ✅ close ka bhi apna chhota timeout, aur ye await kiya jaata hai isi request
    // ke andar — koi orphaned promise doosre request me leak nahi hoti
    try {
      await withTimeout(client.close(true), 2000, `close[${label}]`)
    } catch (closeErr) {
      logErr(`close FAILED for ${label} (ignored, isolate will GC it)`, closeErr)
    }
    // ✅ CONNECTION LIMITER: sabse aakhir me slot release karo — queue me
    // wait kar raha next caller ab aage badhega
    releaseDbSlot()
  }
}

// ============ FIND MANY ============
export async function findMany<T>(
  collection: string,
  filter: Filter<Document> = {},
  options: {
    sort?: Record<string, 1 | -1>
    limit?: number
    skip?: number
    projection?: Record<string, 0 | 1>
  } = {},
  mongoUri: string,
  dbName: string
): Promise<T[]> {
  return withDb(mongoUri, dbName, `findMany[${collection}]`, async (db) => {
    const col = db.collection(collection)
    let cursor = col.find(filter, { projection: options.projection })
    if (options.sort) cursor = cursor.sort(options.sort)
    if (options.skip) cursor = cursor.skip(options.skip)
    if (options.limit) cursor = cursor.limit(options.limit)
    const result = await cursor.toArray()
    log(`  -> ${result.length} docs, filter=${JSON.stringify(filter)}`)
    return result as T[]
  })
}

// ============ FIND ONE ============
export async function findOne<T>(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
): Promise<T | null> {
  return withDb(mongoUri, dbName, `findOne[${collection}]`, async (db) => {
    const result = await db.collection(collection).findOne(filter)
    log(`  -> ${result ? 'FOUND' : 'NOT FOUND'}, filter=${JSON.stringify(filter)}`)
    return result as T | null
  })
}

// ============ INSERT ONE ============
export async function insertOne(
  collection: string,
  document: Document,
  mongoUri: string,
  dbName: string
) {
  return withDb(mongoUri, dbName, `insertOne[${collection}]`, async (db) => {
    const result = await db.collection(collection).insertOne({
      ...document,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    log(`  -> id=${result.insertedId}`)
    return result
  })
}

// ============ UPDATE ONE ============
export async function updateOne(
  collection: string,
  filter: Filter<Document>,
  update: Document,
  mongoUri: string,
  dbName: string,
  upsert = false
) {
  return withDb(mongoUri, dbName, `updateOne[${collection}]`, async (db) => {
    const result = await db.collection(collection).findOneAndUpdate(
      filter,
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: 'after', upsert }
    )
    log(`  -> ${result ? 'UPDATED' : 'NO MATCH'}, filter=${JSON.stringify(filter)}`)
    return result
  })
}

// ============ DELETE ONE ============
export async function deleteOne(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
) {
  return withDb(mongoUri, dbName, `deleteOne[${collection}]`, async (db) => {
    const result = await db.collection(collection).deleteOne(filter)
    log(`  -> deletedCount=${result.deletedCount}`)
    return result
  })
}

// ============ DELETE MANY ============
export async function deleteMany(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
) {
  return withDb(mongoUri, dbName, `deleteMany[${collection}]`, async (db) => {
    const result = await db.collection(collection).deleteMany(filter)
    log(`  -> deletedCount=${result.deletedCount}`)
    return result
  })
}

// ============ COUNT ============
export async function countDocuments(
  collection: string,
  filter: Filter<Document> = {},
  mongoUri: string,
  dbName: string
): Promise<number> {
  return withDb(mongoUri, dbName, `countDocuments[${collection}]`, async (db) => {
    const result = await db.collection(collection).countDocuments(filter)
    log(`  -> ${result}`)
    return result
  })
}

// ============ OBJECT ID HELPER ============
export function toObjectId(id: string | undefined): ObjectId {
  if (!id) throw new Error('Invalid ID: id is undefined')
  return new ObjectId(id)
}

export function isValidObjectId(id: string | undefined): id is string {
  if (!id) return false
  return ObjectId.isValid(id)
}