import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { ISpecialMode } from '../models/types'
import { Db } from 'mongodb'
import { withEdgeCache, invalidateEdgeCache } from '../utils/cache'

const specialModeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

const ALL_LOCATIONS: Array<'home' | 'detail' | 'downloadLink'> = ['home', 'detail', 'downloadLink']

const getModeLocations = (m: any): Array<'home' | 'detail' | 'downloadLink'> =>
  Array.isArray(m.displayLocations) && m.displayLocations.length > 0 ? m.displayLocations : ALL_LOCATIONS

// ============================================================================
// ✅ EXPORTED HELPERS — ab `db` REQUIRED hai (no getDb fallback).
// Ye helpers in files se call hote hain:
//   • linkSettingsRoutes.ts → syncSpecialModeLinks(uri, dbName, db) ✓
//   • shortenerRoutes.ts    → isForceLink5ModeActive(uri, dbName, db) ✓
//   • linkSettingsRoutes.ts → getTodaysActiveMode (imported)
// Sab callers already db pass karte hain, isliye safe hai.
// ============================================================================

export async function getTodaysActiveModes(_mongoUri: string, _dbName: string, db: Db): Promise<ISpecialMode[]> {
  const now = new Date()
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const todayWeekday = indiaTime.getDay()
  const todayDateOnly = new Date(indiaTime.getFullYear(), indiaTime.getMonth(), indiaTime.getDate())

  const modes = await db.collection('specialmodes').find({ isEnabled: true }).toArray() as ISpecialMode[]

  const active: ISpecialMode[] = []

  for (const m of modes) {
    const days = (m as any).weekdays && (m as any).weekdays.length > 0
      ? (m as any).weekdays
      : (m.weekday !== undefined ? [m.weekday] : [])

    if (m.type === 'weekday' && days.includes(todayWeekday)) {
      active.push(m)
      continue
    }

    if (m.type === 'dateRange' && m.startDate && m.endDate) {
      const start = new Date(m.startDate)
      const end = new Date(m.endDate)
      const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (todayDateOnly >= startOnly && todayDateOnly <= endOnly) {
        active.push(m)
      }
    }
  }
  return active
}

// ✅ FIX: pehle ye getTodaysActiveModes(mongoUri, dbName) call karta tha bina
// db pass kiye — matlab ye apna connection kholta aur andar wala helper
// ek AUR connection kholta (2 connections). Ab db pass hota hai.
export async function getTodaysActiveMode(_mongoUri: string, _dbName: string, db: Db): Promise<ISpecialMode | null> {
  const modes = await getTodaysActiveModes(_mongoUri, _dbName, db)
  return modes[0] || null
}

export async function isForceLink5ModeActive(_mongoUri: string, _dbName: string, db: Db): Promise<boolean> {
  const settings: any = (await db.collection('linksettings').findOne({})) || {}
  const masterEnabled = settings.autoModeEnabled !== false
  if (!masterEnabled) return false

  const active = await getTodaysActiveModes(_mongoUri, _dbName, db)
  return active.some(m => !!(m as any).forceLink5Only)
}

export async function syncSpecialModeLinks(_mongoUri: string, _dbName: string, db: Db) {
  const settings: any = (await db.collection('linksettings').findOne({})) || {}
  const masterEnabled = settings.autoModeEnabled !== false

  const active = masterEnabled ? await getTodaysActiveModes(_mongoUri, _dbName, db) : []
  const forcingModes = active.filter(m => !!(m as any).forceLink5Only)
  const shouldForce = forcingModes.length > 0

  if (shouldForce) {
    const combinedIdKey = forcingModes
      .map(m => (m as any)._id?.toString())
      .filter(Boolean)
      .sort()
      .join(',')

    if (settings.specialModeAppliedId === combinedIdKey) return

    await db.collection('linksettings').updateOne({}, {
      $set: {
        specialModeAppliedId: combinedIdKey,
        preModeLink1: settings.link1 !== false,
        preModeLink2: settings.link2 !== false,
        preModeLink3: settings.link3 !== false,
        preModeLink4: settings.link4 !== false,
        preModeLink5: settings.link5 !== false,
        link1: false, link2: false, link3: false, link4: false, link5: true
      }
    }, { upsert: true })
  } else if (settings.specialModeAppliedId) {
    await db.collection('linksettings').updateOne({}, {
      $set: {
        link1: settings.preModeLink1 !== false,
        link2: settings.preModeLink2 !== false,
        link3: settings.preModeLink3 !== false,
        link4: settings.preModeLink4 !== false,
        link5: settings.preModeLink5 !== false
      },
      $unset: {
        specialModeAppliedId: '', preModeLink1: '', preModeLink2: '',
        preModeLink3: '', preModeLink4: '', preModeLink5: ''
      }
    })
  }
}

// ============ PUBLIC: active modes ============
// already uses withDb — no change
specialModeRoutes.get('/active', async (c) => {
  try {
    const result = await withEdgeCache(c, 30, () =>
      withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'specialActive', async (db) => {
        await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

        const settings = await db.collection('linksettings').findOne({})
        if (settings?.autoModeEnabled === false) return { active: false, modes: [] }

        const activeModes = await getTodaysActiveModes(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

        const modes = activeModes.map((m: any) => ({
          name: m.name,
          bannerText: m.bannerText || `Download all anime & movies without any ads – only during ${m.name}!`,
          forceLink5Only: !!m.forceLink5Only,
          displayLocations: getModeLocations(m),
        }))

        return { active: modes.length > 0, modes }
      })
    )
    return result
  } catch (err: any) {
    return c.json({ active: false, modes: [], error: err.message }, 500)
  }
})

// ============ ADMIN: list all modes — uses findMany helper → already safe ============
specialModeRoutes.get('/', adminAuth, async (c) => {
  try {
    const modes = await findMany<ISpecialMode>('specialmodes', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, data: modes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

function normalizeLocations(input: any): Array<'home' | 'detail' | 'downloadLink'> | undefined {
  if (input === undefined) return undefined
  if (!Array.isArray(input)) return ALL_LOCATIONS
  const valid = input.filter((v: any) => ALL_LOCATIONS.includes(v))
  return valid.length > 0 ? valid : ALL_LOCATIONS
}

// ============ ADMIN: create mode ============
// ✅ FIX: getDb → withDb
specialModeRoutes.post('/', adminAuth, async (c) => {
  try {
    const { name, type, weekday, weekdays, startDate, endDate, bannerText, isEnabled, forceLink5Only, displayLocations } = await c.req.json()

    if (!name || !name.trim()) return c.json({ success: false, error: 'Name required' }, 400)
    if (!['weekday', 'dateRange'].includes(type)) return c.json({ success: false, error: 'Invalid type' }, 400)

    const finalWeekdays: number[] = Array.isArray(weekdays) ? weekdays : (typeof weekday === 'number' ? [weekday] : [])

    if (type === 'weekday') {
      if (finalWeekdays.length === 0 || finalWeekdays.some((d: any) => typeof d !== 'number' || d < 0 || d > 6)) {
        return c.json({ success: false, error: 'Valid weekday (0-6) required' }, 400)
      }
    }
    if (type === 'dateRange' && (!startDate || !endDate)) {
      return c.json({ success: false, error: 'Start and end date required for festival mode' }, 400)
    }

    const mode: any = {
      name: name.trim(),
      type,
      bannerText: bannerText?.trim() || '',
      isEnabled: isEnabled !== false,
      forceLink5Only: Boolean(forceLink5Only),
      displayLocations: normalizeLocations(displayLocations) || ALL_LOCATIONS,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    if (type === 'weekday') {
      mode.weekdays = finalWeekdays
      mode.weekday = finalWeekdays[0]
    }
    if (type === 'dateRange') {
      mode.startDate = new Date(startDate)
      mode.endDate = new Date(endDate)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'specialMode/create', async (db) => {
      const result = await db.collection('specialmodes').insertOne(mode)
      await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

      c.executionCtx.waitUntil(invalidateEdgeCache(c, '/api/special-modes/active'))

      return c.json({ success: true, message: 'Mode created!', data: result })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: update mode ============
// ✅ FIX: getDb → withDb
specialModeRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    const body = await c.req.json()

    const updateData: any = { updatedAt: new Date() }
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.bannerText !== undefined) updateData.bannerText = body.bannerText.trim()
    if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled)

    if (body.weekdays !== undefined) {
      if (!Array.isArray(body.weekdays) || body.weekdays.length === 0 ||
          body.weekdays.some((d: any) => typeof d !== 'number' || d < 0 || d > 6)) {
        return c.json({ success: false, error: 'Valid weekday (0-6) required' }, 400)
      }
      updateData.weekdays = body.weekdays
      updateData.weekday = body.weekdays[0]
    } else if (body.weekday !== undefined) {
      updateData.weekday = body.weekday
      updateData.weekdays = [body.weekday]
    }

    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate)
    if (body.forceLink5Only !== undefined) updateData.forceLink5Only = Boolean(body.forceLink5Only)
    if (body.displayLocations !== undefined) updateData.displayLocations = normalizeLocations(body.displayLocations)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'specialMode/update', async (db) => {
      const updated = await db.collection('specialmodes').findOneAndUpdate(
        { _id: toObjectId(id) }, { $set: updateData }, { returnDocument: 'after' }
      )
      if (!updated) return c.json({ success: false, error: 'Mode not found' }, 404)

      await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

      c.executionCtx.waitUntil(invalidateEdgeCache(c, '/api/special-modes/active'))

      return c.json({ success: true, message: 'Updated!', data: updated })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: delete mode ============
// ✅ FIX: getDb → withDb
specialModeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'specialMode/delete', async (db) => {
      await db.collection('specialmodes').deleteOne({ _id: toObjectId(id) })
      await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

      c.executionCtx.waitUntil(invalidateEdgeCache(c, '/api/special-modes/active'))

      return c.json({ success: true, message: 'Mode deleted!' })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: master switch toggle ============
// ✅ FIX: getDb → withDb
specialModeRoutes.put('/master-toggle', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'specialMode/master-toggle', async (db) => {
      const settings = await db.collection('linksettings').findOne({})
      const newValue = !(settings?.autoModeEnabled !== false)
      await db.collection('linksettings').updateOne({}, { $set: { autoModeEnabled: newValue } }, { upsert: true })
      await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

      c.executionCtx.waitUntil(invalidateEdgeCache(c, '/api/special-modes/active'))

      return c.json({ success: true, autoModeEnabled: newValue })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default specialModeRoutes