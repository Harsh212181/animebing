import { insertOne, findMany } from './mongoService'
import { IActivityLog } from '../models/types'

export async function logActivity(
  log: Omit<IActivityLog, '_id' | 'createdAt'>,
  mongoUri: string,
  dbName: string
) {
  try {
    await insertOne('activitylogs', { ...log, createdAt: new Date() }, mongoUri, dbName)
  } catch (err) {
    console.error('Failed to log activity:', err)
    // Activity log fail hone se main action fail nahi hona chahiye
  }
}

export async function getActivityLogs(
  filter: any,
  mongoUri: string,
  dbName: string,
  limit = 100
): Promise<IActivityLog[]> {
  return findMany<IActivityLog>(
    'activitylogs', filter, { sort: { createdAt: -1 }, limit }, mongoUri, dbName
  )
}