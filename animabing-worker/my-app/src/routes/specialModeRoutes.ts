import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import { findMany, insertOne, updateOne, deleteOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { ISpecialMode } from '../models/types'

const specialModeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============ HELPER: aaj ke date/weekday se match karne wala enabled mode dhoondo ============
export async function getTodaysActiveMode(mongoUri: string, dbName: string): Promise<ISpecialMode | null> {
  const db = await getDb(mongoUri, dbName)

  const now = new Date()
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const todayWeekday = indiaTime.getDay() // 0=Sun...6=Sat
  const todayDateOnly = new Date(indiaTime.getFullYear(), indiaTime.getMonth(), indiaTime.getDate())

  const modes = await db.collection('specialmodes').find({ isEnabled: true }).toArray() as ISpecialMode[]

  for (const m of modes) {
    if (m.type === 'weekday' && m.weekday === todayWeekday) return m
    if (m.type === 'dateRange' && m.startDate && m.endDate) {
      const start = new Date(m.startDate)
      const end = new Date(m.endDate)
      const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (todayDateOnly >= startOnly && todayDateOnly <= endOnly) return m
    }
  }
  return null
}

// ============ 👇 NEW: link settings ko active mode ke hisaab se sync karo ============
// Jab koi "forceLink5Only" mode active ho jaaye → link1-4 off, link5 on karo,
// lekin uske PEHLE current settings ko snapshot (backup) kar lo.
// Jab wo mode khatam ho jaaye (ya disable ho jaaye) → snapshot se wapas restore karo.
export async function syncSpecialModeLinks(mongoUri: string, dbName: string) {
  const db = await getDb(mongoUri, dbName)
  const settings: any = (await db.collection('linksettings').findOne({})) || {}
  const masterEnabled = settings.autoModeEnabled !== false

  const active = masterEnabled ? await getTodaysActiveMode(mongoUri, dbName) : null
  const shouldForce = !!(active && (active as any).forceLink5Only)

  if (shouldForce) {
    const activeIdStr = (active as any)._id?.toString()
    // Isi mode ke liye pehle se apply ho chuka hai to dobara mat chhedo
    if (settings.specialModeAppliedId === activeIdStr) return

    await db.collection('linksettings').updateOne({}, {
      $set: {
        specialModeAppliedId: activeIdStr,
        preModeLink1: settings.link1 !== false,
        preModeLink2: settings.link2 !== false,
        preModeLink3: settings.link3 !== false,
        preModeLink4: settings.link4 !== false,
        preModeLink5: settings.link5 !== false,
        link1: false, link2: false, link3: false, link4: false, link5: true
      }
    }, { upsert: true })
  } else if (settings.specialModeAppliedId) {
    // Mode khatam ho gaya ya disable ho gaya → purani settings wapas laao
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

// ============ PUBLIC: homepage ke liye — kya koi mode abhi active hai? ============
// 👇 Har call pe pehle sync karo, taaki din start/end hote hi links auto adjust ho jaayein
// (homepage frequently ye endpoint hit karta hai, isliye ye hi natural "cron" ka kaam karta hai)
specialModeRoutes.get('/active', async (c) => {
  try {
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const active = await getTodaysActiveMode(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await db.collection('linksettings').findOne({})
    const masterEnabled = settings?.autoModeEnabled !== false

    if (!active || !masterEnabled) {
      return c.json({ active: false })
    }

    return c.json({
      active: true,
      name: active.name,
      bannerText: active.bannerText || `Download all anime & movies without any ads – only during ${active.name}!`,
      forceLink5Only: !!(active as any).forceLink5Only
    })
  } catch (err: any) {
    return c.json({ active: false, error: err.message }, 500)
  }
})

// ============ ADMIN: list all modes ============
specialModeRoutes.get('/', adminAuth, async (c) => {
  try {
    const modes = await findMany<ISpecialMode>('specialmodes', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, data: modes })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: create mode ============
specialModeRoutes.post('/', adminAuth, async (c) => {
  try {
    const { name, type, weekday, startDate, endDate, bannerText, isEnabled, forceLink5Only } = await c.req.json()

    if (!name || !name.trim()) return c.json({ success: false, error: 'Name required' }, 400)
    if (!['weekday', 'dateRange'].includes(type)) return c.json({ success: false, error: 'Invalid type' }, 400)
    if (type === 'weekday' && (weekday === undefined || weekday < 0 || weekday > 6)) {
      return c.json({ success: false, error: 'Valid weekday (0-6) required' }, 400)
    }
    if (type === 'dateRange' && (!startDate || !endDate)) {
      return c.json({ success: false, error: 'Start and end date required for festival mode' }, 400)
    }

    const mode: any = {
      name: name.trim(),
      type,
      bannerText: bannerText?.trim() || '',
      isEnabled: isEnabled !== false,
      forceLink5Only: Boolean(forceLink5Only), // 👈 NEW
      createdAt: new Date(),
      updatedAt: new Date()
    }
    if (type === 'weekday') mode.weekday = weekday
    if (type === 'dateRange') {
      mode.startDate = new Date(startDate)
      mode.endDate = new Date(endDate)
    }

    const result = await insertOne('specialmodes', mode, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // 👇 turant sync karo — agar aaj hi ye mode active ban gaya to link foran adjust ho
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Mode created!', data: result })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: update mode ============
specialModeRoutes.put('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    const body = await c.req.json()

    const updateData: any = { updatedAt: new Date() }
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.bannerText !== undefined) updateData.bannerText = body.bannerText.trim()
    if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled)
    if (body.weekday !== undefined) updateData.weekday = body.weekday
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate)
    if (body.forceLink5Only !== undefined) updateData.forceLink5Only = Boolean(body.forceLink5Only) // 👈 NEW

    const updated = await updateOne('specialmodes', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!updated) return c.json({ success: false, error: 'Mode not found' }, 404)

    // 👇 turant sync — agar isEnabled/forceLink5Only badla to links foran adjust ho
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Updated!', data: updated })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: delete mode ============
specialModeRoutes.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    await deleteOne('specialmodes', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    // 👇 agar delete kiya gaya mode hi currently applied tha, to links wapas restore ho
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Mode deleted!' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ ADMIN: master switch toggle ============
specialModeRoutes.put('/master-toggle', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await db.collection('linksettings').findOne({})
    const newValue = !(settings?.autoModeEnabled !== false)
    await db.collection('linksettings').updateOne({}, { $set: { autoModeEnabled: newValue } }, { upsert: true })

    // 👇 master off/on hote hi turant sync (off karne pe purane links wapas aa jaayenge)
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, autoModeEnabled: newValue })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default specialModeRoutes