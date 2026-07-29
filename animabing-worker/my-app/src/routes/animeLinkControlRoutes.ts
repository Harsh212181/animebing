 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, requirePermission } from '../middleware/auth'
import {
  findMany, insertOne, updateOne, deleteOne,
  toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IAnimeLinkControl } from '../models/types'

const animeLinkControlRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============ HELPER: sub-admin (animeAccess:'own') ke owned anime IDs ============
async function getOwnedAnimeIds(admin: any, mongoUri: string, dbName: string): Promise<string[] | null> {
  if (admin.role !== 'subadmin' || admin.animeAccess !== 'own') return null
  const db = await getDb(mongoUri, dbName)
  const animes = await db.collection('animes')
    .find({ createdBy: admin.id }, { projection: { _id: 1 } })
    .toArray()
  return animes.map((a: any) => a._id.toString())
}

// ============ LIST GROUPS (admin + sub-admin, filtered) ============
animeLinkControlRoutes.get('/', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)

    const filter: any = {}
    if (ownedAnimeIds !== null) {
      // ✅ sub-admin (own access) → sirf wahi groups jinme unka khud ka anime ho
      filter.animeIds = { $in: ownedAnimeIds }
    }

    const groups = await findMany<IAnimeLinkControl>(
      'animelinkcontrols', filter, { sort: { createdAt: -1 } },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const ownedSet = ownedAnimeIds ? new Set(ownedAnimeIds) : null

    const enriched = await Promise.all(groups.map(async (g: any) => {
      let ids = (g.animeIds || []).filter(isValidObjectId)
      // ✅ sub-admin ko group ke andar bhi sirf apna anime dikhe (agar kabhi mix ho)
      if (ownedSet) ids = ids.filter((id: string) => ownedSet.has(id))
      const objIds = ids.map((id: string) => toObjectId(id))
      const animes = objIds.length
        ? await db.collection('animes').find({ _id: { $in: objIds } }, { projection: { title: 1, thumbnail: 1 } }).toArray()
        : []
      return { ...g, animeDetails: animes }
    }))

    return c.json({ success: true, data: enriched })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ CREATE GROUP ============
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

    // ✅ sub-admin (own access) sirf apna khud ka anime hi use kar sake
    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (ownedAnimeIds !== null) {
      const ownedSet = new Set(ownedAnimeIds)
      const notOwned = animeIds.filter((id: string) => !ownedSet.has(id))
      if (notOwned.length > 0) {
        return c.json({ success: false, error: 'Aap sirf apna khud ka add kiya hua anime use kar sakte ho' }, 403)
      }
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const existingGroups = await db.collection('animelinkcontrols').find({
      animeIds: { $in: animeIds }
    }).toArray()
    if (existingGroups.length > 0) {
      const conflictNames = existingGroups.map((g: any) => g.name).join(', ')
      return c.json({ success: false, error: `Ye anime pehle se assigned hai: ${conflictNames}. Pehle wahan se remove karo.` }, 400)
    }

    const group: any = {
      name: (name && name.trim()) || 'Unnamed Group',
      animeIds,
      link1: Boolean(link1), link2: Boolean(link2), link3: Boolean(link3), link4: Boolean(link4),
      createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByUsername: admin.username,
      createdAt: new Date(), updatedAt: new Date()
    }

    const result = await insertOne('animelinkcontrols', group, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Link control group created!', data: result })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ UPDATE GROUP ============
animeLinkControlRoutes.put('/:id', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    const { name, animeIds, link1, link2, link3, link4 } = await c.req.json()

    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    if (ownedAnimeIds !== null) {
      const ownedSet = new Set(ownedAnimeIds)
      const existingGroup = await db.collection('animelinkcontrols').findOne({ _id: toObjectId(id) })
      if (!existingGroup) return c.json({ success: false, error: 'Group not found' }, 404)
      const belongsToMe = (existingGroup.animeIds || []).some((aid: string) => ownedSet.has(aid))
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

    const updated = await updateOne('animelinkcontrols', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!updated) return c.json({ success: false, error: 'Group not found' }, 404)
    return c.json({ success: true, message: 'Updated!', data: updated })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ DELETE GROUP ============
animeLinkControlRoutes.delete('/:id', adminAuth, requirePermission('link-control'), async (c) => {
  try {
    const admin = c.get('admin')
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const ownedAnimeIds = await getOwnedAnimeIds(admin, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (ownedAnimeIds !== null) {
      const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
      const ownedSet = new Set(ownedAnimeIds)
      const existingGroup = await db.collection('animelinkcontrols').findOne({ _id: toObjectId(id) })
      if (!existingGroup) return c.json({ success: false, error: 'Group not found' }, 404)
      const belongsToMe = (existingGroup.animeIds || []).some((aid: string) => ownedSet.has(aid))
      if (!belongsToMe) {
        return c.json({ success: false, error: 'Aap sirf apna group delete kar sakte ho' }, 403)
      }
    }

    await deleteOne('animelinkcontrols', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Group deleted! Anime ab global settings use karega.' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ EFFECTIVE SETTINGS (PUBLIC — unchanged) ============
animeLinkControlRoutes.get('/effective/:animeId', async (c) => {
  try {
    const animeId = c.req.param('animeId')
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

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
          link1: group.link1,
          link2: group.link2,
          link3: group.link3,
          link4: group.link4,
          link5: globalSettings.link5,
          source: 'override',
          groupName: group.name
        }
      }
    }

    if (globalSettings.link5) {
      effective.link1 = false
      effective.link2 = false
      effective.link3 = false
      effective.link4 = false
      effective.link5 = true
    }

    return c.json({ success: true, data: effective })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default animeLinkControlRoutes