 import { AsyncLocalStorage } from 'node:async_hooks'
import { MongoClient, Db, ObjectId, Filter, Document } from 'mongodb'

type RequestStore = { clients: MongoClient[] }
const dbRequestContext = new AsyncLocalStorage<RequestStore>()

export async function runWithDbContext<T>(fn: () => Promise<T>): Promise<T> {
  const store: RequestStore = { clients: [] }
  return dbRequestContext.run(store, async () => {
    try {
      return await fn()
    } finally {
      
      await Promise.all(store.clients.map((c) => c.close().catch(() => {})))
    }
  })
}

export async function getDb(mongoUri: string, dbName: string): Promise<Db> {
  const client = new MongoClient(mongoUri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
    maxIdleTimeMS: 10000,
  } as any)
  await client.connect()

  const store = dbRequestContext.getStore()
  if (store) {
    store.clients.push(client)
  } else {
    
    console.warn(
      '[mongoService] getDb() called outside runWithDbContext — this connection will leak. ' +
      'Make sure index.ts wraps the app with the dbContext middleware.'
    )
  }

  return client.db(dbName)
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
  const database = await getDb(mongoUri, dbName)
  const col = database.collection(collection)

  let cursor = col.find(filter, { projection: options.projection })

  if (options.sort) cursor = cursor.sort(options.sort)
  if (options.skip) cursor = cursor.skip(options.skip)
  if (options.limit) cursor = cursor.limit(options.limit)

  return cursor.toArray() as Promise<T[]>
}

// ============ FIND ONE ============
export async function findOne<T>(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
): Promise<T | null> {
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).findOne(filter) as Promise<T | null>
}

// ============ INSERT ONE ============
export async function insertOne(
  collection: string,
  document: Document,
  mongoUri: string,
  dbName: string
) {
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).insertOne({
    ...document,
    createdAt: new Date(),
    updatedAt: new Date()
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
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).findOneAndUpdate(
    filter,
    {
      $set: {
        ...update,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after', upsert }
  )
}

// ============ DELETE ONE ============
export async function deleteOne(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
) {
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).deleteOne(filter)
}

// ============ DELETE MANY ============
export async function deleteMany(
  collection: string,
  filter: Filter<Document>,
  mongoUri: string,
  dbName: string
) {
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).deleteMany(filter)
}

// ============ COUNT ============
export async function countDocuments(
  collection: string,
  filter: Filter<Document> = {},
  mongoUri: string,
  dbName: string
): Promise<number> {
  const database = await getDb(mongoUri, dbName)
  return database.collection(collection).countDocuments(filter)
}

// ============ OBJECT ID HELPER ============
export function toObjectId(id: string | undefined): ObjectId {
  if (!id) throw new Error('Invalid ID: id is undefined')
  return new ObjectId(id)
}

export function isValidObjectId(id: string | undefined): boolean {
  if (!id) return false
  return ObjectId.isValid(id)
}