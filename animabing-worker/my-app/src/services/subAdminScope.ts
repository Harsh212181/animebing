import { getDb, toObjectId, isValidObjectId } from './mongoService'

// null = koi restriction nahi (super admin ya animeAccess:'all' wala sub-admin)
export async function getOwnedAnimeIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  const createdIds = animes.map((a: any) => a._id.toString())

  const subAdminDoc = await db.collection('subadmins').findOne({ _id: toObjectId(admin.id) })
  const assignedIds: string[] = subAdminDoc?.assignedAnimeIds || []

  return Array.from(new Set([...createdIds, ...assignedIds]))
}

// Kisi bhi specific sub-admin ID ke liye uske (created+assigned) anime IDs — main admin ke filter-dropdown ke liye
export async function getAnimeIdsForSubAdmin(subAdminId: string, mongoUri: string, dbName: string): Promise<string[]> {
  const db = await getDb(mongoUri, dbName)
  const subAdminDoc = await db.collection('subadmins').findOne({ _id: toObjectId(subAdminId) })
  const created = await db.collection('animes')
    .find({ createdBy: subAdminId }, { projection: { _id: 1 } })
    .toArray()
  const createdIds = created.map((a: any) => a._id.toString())
  const assignedIds: string[] = subAdminDoc?.assignedAnimeIds || []
  return Array.from(new Set([...createdIds, ...assignedIds]))
}

export function toObjectIds(ids: string[]) {
  return ids.filter(isValidObjectId).map((id) => toObjectId(id))
}