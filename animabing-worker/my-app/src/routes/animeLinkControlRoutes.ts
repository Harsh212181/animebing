import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import {
  toObjectId, isValidObjectId, withDb
} from '../services/mongoService'
import { IAnimeLinkControl } from '../models/types'
import { withEdgeCache, invalidateEdgeCache } from '../utils/cache'

const animeLinkControlRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============ HELPER: sub-admin (animeAccess:'own') ke owned anime IDs ============
// ✅ FIX: ab `db` caller (withDb) se aata hai — apna connection nahi kholta
async function getOwnedAnimeIds(admin: any, db: any): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  return animes.map((a: any) => a._id.toString())
}

// ============ HELPER: affected anime IDs ke effective-cache clear karo ============
async function invalidateEffectiveCacheForAnimeIds(c: any, animeIds: string[] | undefined | null) {
  if (!animeIds || animeIds.length === 0) return
  for (const aid of animeIds) {
    try {
      await invalidateEdgeCache(c, `/api/anime-link-control/effective/${aid}`)
    } catch (_) {
      // cache-miss pe error aaye to silently ignore karo
    }
  }
}

// ============ LIST GROUPS (admin + sub-admin, filtered) ============
// ✅ FIX: pehle 3 connections khulte the (getOwnedAnimeIds + findMany + getDb),
// ab sirf 1 withDb me sab kuch
animeLinkControlRoutes.get('/', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeLinkControl/list', async (db) => {
      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)

      const filter: any = {}
      if (ownedAnimeIds !== null) {
        filter.animeIds = { $in: ownedAnimeIds }
      }

      const groups = await db.collection('animelinkcontrols')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray()

      const ownedSet = ownedAnimeIds ? new Set(ownedAnimeIds) : null

      const enriched = await Promise.all(groups.map(async (g: any) => {
        let ids = (g.animeIds || []).filter(isValidObjectId)
        if (ownedSet) ids = ids.filter((id: string) => ownedSet.has(id))
        const objIds = ids.map((id: string) => toObjectId(id))
        const animes = objIds.length
          ? await db.collection('animes').find({ _id: { $in: objIds } }, { projection: { title: 1, thumbnail: 1 } }).toArray()
          : []
        return { ...g, animeDetails: animes }
      }))

      return c.json({ success: true, data: enriched })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ CREATE GROUP ============
// ✅ FIX: pehle 3 connections (getOwnedAnimeIds + getDb + insertOne),
// ab sirf 1 withDb me sab
animeLinkControlRoutes.post('/', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const { name, animeIds, link1, link2, link3, link4 } = await c.req.json()

    if (!animeIds || !Array.isArray(animeIds) || animeIds.length === 0) {
      return c.json({ success: false, error: 'At least one anime required' }, 400)
    }
    for (const id of animeIds) {
      if (!isValidObjectId(id)) return c.json({ success: false, error: `Invalid anime ID: ${id}` }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeLinkControl/create', async (db) => {
      // ✅ sub-admin (own access) sirf apna khud ka anime hi use kar sake
      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)
      if (ownedAnimeIds !== null) {
        const ownedSet = new Set(ownedAnimeIds)
        const notOwned = animeIds.filter((id: string) => !ownedSet.has(id))
        if (notOwned.length > 0) {
          return c.json({ success: false, error: 'Aap sirf apna khud ka add kiya hua anime use kar sakte ho' }, 403)
        }
      }

      const existingGroups = await db.collection('animelinkcontrols').find({
        animeIds: { $in: animeIds }
      }).toArray()
      if (existingGroups.length > 0) {
        const conflictNames = existingGroups.map((g: any) => g.name).join(', ')
        return c.json({ success: false, error: `Ye anime pehle se assigned hai: ${conflictNames}. Pehle wahan se remove karo.` }, 400)
      }

      const now = new Date()
      const group: any = {
        name: (name && name.trim()) || 'Unnamed Group',
        animeIds,
        link1: Boolean(link1), link2: Boolean(link2), link3: Boolean(link3), link4: Boolean(link4),
        createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
        createdByUsername: admin.username,
        createdAt: now,
        updatedAt: now,
      }

      const result = await db.collection('animelinkcontrols').insertOne(group)

      // ✅ naye animeIds ke effective-cache invalidate karo
      await invalidateEffectiveCacheForAnimeIds(c, animeIds)

      return c.json({ success: true, message: 'Link control group created!', data: result })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UPDATE GROUP ============
// ✅ FIX: pehle 3 connections (getOwnedAnimeIds + getDb + updateOne),
// ab sirf 1 withDb me sab
animeLinkControlRoutes.put('/:id', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    const { name, animeIds, link1, link2, link3, link4 } = await c.req.json()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeLinkControl/update', async (db) => {
      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)

      // ✅ purane animeIds capture karo (invalidation ke liye)
      const existingGroupDoc = await db.collection('animelinkcontrols').findOne({ _id: toObjectId(id) })
      if (!existingGroupDoc) return c.json({ success: false, error: 'Group not found' }, 404)
      const oldAnimeIds: string[] = Array.isArray(existingGroupDoc.animeIds) ? existingGroupDoc.animeIds : []

      if (ownedAnimeIds !== null) {
        const ownedSet = new Set(ownedAnimeIds)
        const belongsToMe = (existingGroupDoc.animeIds || []).some((aid: string) => ownedSet.has(aid))
        if (!belongsToMe) {
          return c.json({ success: false, error: 'Aap sirf apna group edit kar sakte ho' }, 403)
        }
        if (animeIds) {
          const notOwned = animeIds.filter((aid: string) => !ownedSet.has(aid))
          if (notOwned.length > 0) {
            return c.json({ success: false, error: 'Aap sirf apna khud ka add kiya hua anime use kar sakte ho' }, 403)
          }
        }
      }

      if (animeIds) {
        for (const aid of animeIds) {
          if (!isValidObjectId(aid)) return c.json({ success: false, error: `Invalid anime ID: ${aid}` }, 400)
        }
        const existingGroups = await db.collection('animelinkcontrols').find({
          _id: { $ne: toObjectId(id) },
          animeIds: { $in: animeIds }
        }).toArray()
        if (existingGroups.length > 0) {
          const conflictNames = existingGroups.map((g: any) => g.name).join(', ')
          return c.json({ success: false, error: `Ye anime pehle se assigned hai: ${conflictNames}` }, 400)
        }
      }

      const updateData: any = { updatedAt: new Date() }
      if (name !== undefined) updateData.name = name.trim()
      if (animeIds !== undefined) updateData.animeIds = animeIds
      if (link1 !== undefined) updateData.link1 = Boolean(link1)
      if (link2 !== undefined) updateData.link2 = Boolean(link2)
      if (link3 !== undefined) updateData.link3 = Boolean(link3)
      if (link4 !== undefined) updateData.link4 = Boolean(link4)

      const updated = await db.collection('animelinkcontrols').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      )
      if (!updated) return c.json({ success: false, error: 'Group not found' }, 404)

      // ✅ purane + naye dono animeIds ke cache invalidate karo
      const affected = new Set<string>([...oldAnimeIds])
      if (animeIds) for (const aid of animeIds) affected.add(aid)
      await invalidateEffectiveCacheForAnimeIds(c, Array.from(affected))

      return c.json({ success: true, message: 'Updated!', data: updated })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE GROUP ============
// ✅ FIX: pehle 3 connections (getOwnedAnimeIds + getDb + deleteOne),
// ab sirf 1 withDb me sab
animeLinkControlRoutes.delete('/:id', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'animeLinkControl/delete', async (db) => {
      const ownedAnimeIds = await getOwnedAnimeIds(admin, db)

      const existingGroup = await db.collection('animelinkcontrols').findOne({ _id: toObjectId(id) })
      if (!existingGroup) return c.json({ success: false, error: 'Group not found' }, 404)
      const affectedAnimeIds: string[] = Array.isArray(existingGroup.animeIds) ? existingGroup.animeIds : []

      if (ownedAnimeIds !== null) {
        const ownedSet = new Set(ownedAnimeIds)
        const belongsToMe = (existingGroup.animeIds || []).some((aid: string) => ownedSet.has(aid))
        if (!belongsToMe) {
          return c.json({ success: false, error: 'Aap sirf apna group delete kar sakte ho' }, 403)
        }
      }

      await db.collection('animelinkcontrols').deleteOne({ _id: toObjectId(id) })

      // ✅ delete hone wale group ke animeIds ke cache invalidate karo
      await invalidateEffectiveCacheForAnimeIds(c, affectedAnimeIds)

      return c.json({ success: true, message: 'Group deleted! Anime ab global settings use karega.' })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ EFFECTIVE SETTINGS (PUBLIC — edge-cached 30s) ============
// ✅ Already uses withDb — no change needed
animeLinkControlRoutes.get('/effective/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')

    const response = await withEdgeCache(c, 30, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkEffective', async (db) => {
        let globalSettings: any = await db.collection('linksettings').findOne({})
        if (!globalSettings) {
          globalSettings = { link1: true, link2: true, link3: true, link4: true, link5: true }
        }

        let effective = {
          link1: globalSettings.link1,
          link2: globalSettings.link2,
          link3: globalSettings.link3,
          link4: globalSettings.link4,
          link5: globalSettings.link5,
          source: 'global' as 'global' | 'override',
          groupName: null as string | null
        }

        if (isValidObjectId(animeId)) {
          const group = await db.collection('animelinkcontrols').findOne({ animeIds: animeId })
          if (group) {
            effective = {
              link1: group.link1, link2: group.link2, link3: group.link3, link4: group.link4,
              link5: globalSettings.link5, source: 'override', groupName: group.name
            }
          }
        }

        if (globalSettings.link5) {
          effective.link1 = false; effective.link2 = false
          effective.link3 = false; effective.link4 = false
          effective.link5 = true
        }
        return effective
      })
    )

    return response
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeLinkControlRoutes