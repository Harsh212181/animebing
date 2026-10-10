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
// ✅ Ek request ke andar helper jo: connect -> operation -> close (guaranteed)
export async function withDb<T>(
  mongoUri: string,
  dbName: string,
  label: string,
  fn: (db: Db) => Promise<T>,
  opTimeoutMs = 8000
): Promise<T> {
  const t0 = Date.now()
  const client = new MongoClient(mongoUri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 1,   // 🔧 5 -> 1 (ek client se ek hi operation hota hai)
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
    try {
      await withTimeout(client.close(true), 2000, `close[${label}]`)
    } catch (closeErr) {
      logErr(`close FAILED for ${label} (ignored, isolate will GC it)`, closeErr)
    }
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