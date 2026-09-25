import { Db } from 'mongodb'
import { toObjectId, isValidObjectId } from './mongoService'

// ============================================================================
// ✅ FIX: Ye functions ab apna alag MongoDB connection nahi kholte.
// Pehle: har call apna `getDb()` chalata tha → ek hi route me 2-3+ connections.
// Ab: caller (route handler) ek baar `getDb()`/`withDb()` se connection kholta
// hai aur wahi `db` object yahan pass karta hai. Isse ek request ke andar
// sirf EK MongoDB connection khulta hai, chahe kitne bhi scope-check helpers
// call ho rahe hon.
//
// ⚠️ BREAKING CHANGE: purane signature the (admin, mongoUri, dbName) aur
// (subAdminId, mongoUri, dbName). Ab dono me teesra/doosra arg `db: Db` hai.
// Jo bhi route inhe call karta hai, use pehle apna `db` banana hoga aur
// yahan pass karna hoga (neeche animeRoutes.ts me example dekho).
// ============================================================================

// null = koi restriction nahi (super admin ya animeAccess:'all' wala sub-admin)
export async function getOwnedAnimeIds(admin: any, db: Db): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null

  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  const createdIds = animes.map((a: any) => a._id.toString())

  const subAdminDoc = await db.collection('subadmins').findOne({ _id: toObjectId(admin.id) })
  const assignedIds: string[] = subAdminDoc?.assignedAnimeIds || []

  return Array.from(new Set([...createdIds, ...assignedIds]))
}

// Kisi bhi specific sub-admin ID ke liye uske (created+assigned) anime IDs —
// main admin ke filter-dropdown ke liye
export async function getAnimeIdsForSubAdmin(subAdminId: string, db: Db): Promise<string[]> {
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