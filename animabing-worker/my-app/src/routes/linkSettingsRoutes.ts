 import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findOne, updateOne, insertOne, deleteMany, getDb } from '../services/mongoService'
import { ILinkSettings } from '../models/types'
import { getTodaysActiveMode, syncSpecialModeLinks } from './specialModeRoutes'
import { adminAuth, superAdminOnly } from '../middleware/auth' // added for global rate endpoints

const linkSettingsRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

function getIndiaWeekday(): number {
  const now = new Date()
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return indiaTime.getDay()
}

// Link 5 master override rule (consumption-only display helper)
function applyLink5Override<T extends { link1: boolean; link2: boolean; link3: boolean; link4: boolean; link5: boolean }>(s: T): T {
  if (s.link5) {
    return { ...s, link1: false, link2: false, link3: false, link4: false, link5: true }
  }
  return s
}

// ✅ SINGLE SOURCE OF TRUTH — sirf syncSpecialModeLinks() hi link1-5 ko
// force/restore karta hai, aur wo sirf forceLink5Only=true wale mode ke liye karta hai.
// getSettings() ab sirf latest settings padhta hai, khud koi override apply nahi karta.
async function getSettings(mongoUri: string, dbName: string): Promise<ILinkSettings> {
  const db = await getDb(mongoUri, dbName)
  let settings = await db.collection('linksettings').findOne({}) as ILinkSettings | null

  if (!settings) {
    const defaultSettings = {
      link1: true, link2: true, link3: true, link4: true, link5: true,
      autoSundayMode: false, _isSundayApplied: false, lastUpdated: new Date()
    }
    await db.collection('linksettings').insertOne({ ...defaultSettings, createdAt: new Date(), updatedAt: new Date() })
    settings = defaultSettings as ILinkSettings
  }

  // ✅ Sirf ek jagah se sync — forceLink5Only respect karta hai
  await syncSpecialModeLinks(mongoUri, dbName)
  settings = await db.collection('linksettings').findOne({}) as ILinkSettings

  return settings!
}

// GET SETTINGS — RAW (admin dashboard ke liye, real toggle states + pre-mode snapshot dikhata hai)
linkSettingsRoutes.get('/', async (c) => {
  try {
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(settings)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET EFFECTIVE SETTINGS (override-applied — frontend/download pages ke liye use karo)
linkSettingsRoutes.get('/effective', async (c) => {
  try {
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(applyLink5Override(settings))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE SETTINGS
linkSettingsRoutes.put('/', async (c) => {
  try {
    const { link1, link2, link3, link4, link5, autoSundayMode } = await c.req.json()
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)

    const updates: any = { lastUpdated: new Date() }
    if (link1 !== undefined) updates.link1 = Boolean(link1)
    if (link2 !== undefined) updates.link2 = Boolean(link2)
    if (link3 !== undefined) updates.link3 = Boolean(link3)
    if (link4 !== undefined) updates.link4 = Boolean(link4)
    if (link5 !== undefined) updates.link5 = Boolean(link5)
    if (autoSundayMode !== undefined) updates.autoSundayMode = Boolean(autoSundayMode)

    await db.collection('linksettings').updateOne({}, { $set: updates }, { upsert: true })
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Link settings updated!', settings })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// TOGGLE LINK
linkSettingsRoutes.put('/toggle/:linkNumber', async (c) => {
  try {
    const linkNumber = parseInt(c.req.param('linkNumber'))
    if (linkNumber < 1 || linkNumber > 5) {
      return c.json({ error: 'Link number must be between 1 and 5' }, 400)
    }

    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const linkKey = `link${linkNumber}` as keyof ILinkSettings
    const newValue = !settings[linkKey]

    await db.collection('linksettings').updateOne({}, { $set: { [linkKey]: newValue, lastUpdated: new Date() } })

    const updated = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: `Link ${linkNumber} ${newValue ? 'activated' : 'deactivated'}`, settings: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// STATUS — override applied (consumer-facing summary)
linkSettingsRoutes.get('/status', async (c) => {
  try {
    const raw = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = applyLink5Override(raw)
    const activeLinks = [1, 2, 3, 4, 5].filter(i => settings[`link${i}` as keyof ILinkSettings])

    return c.json({
      totalLinks: 5,
      activeLinks,
      activeCount: activeLinks.length,
      settings: {
        link1: settings.link1, link2: settings.link2, link3: settings.link3,
        link4: settings.link4, link5: settings.link5,
        autoSundayMode: raw.autoSundayMode
      },
      link5OverrideActive: raw.link5,
      lastUpdated: raw.lastUpdated
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ACTIVE LINKS — override applied
linkSettingsRoutes.get('/active', async (c) => {
  try {
    const raw = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = applyLink5Override(raw)
    const activeLinks = [1, 2, 3, 4, 5].filter(i => settings[`link${i}` as keyof ILinkSettings])
    return c.json({ activeLinks, activeCount: activeLinks.length })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ✅ NEW — jab koi forceLink5Only mode active hai, ye batata hai ki
// mode khatam hone pe kaunse links restore honge (admin dashboard preview ke liye)
linkSettingsRoutes.get('/restore-preview', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings: any = await db.collection('linksettings').findOne({})

    const isForced = !!settings?.specialModeAppliedId
    if (!isForced) {
      return c.json({ forced: false })
    }

    return c.json({
      forced: true,
      willRestoreTo: {
        link1: settings.preModeLink1 !== false,
        link2: settings.preModeLink2 !== false,
        link3: settings.preModeLink3 !== false,
        link4: settings.preModeLink4 !== false,
        link5: settings.preModeLink5 !== false,
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// RESET
linkSettingsRoutes.post('/reset', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('linksettings').deleteMany({})
    await db.collection('linksettings').insertOne({
      link1: true, link2: true, link3: true, link4: true, link5: true,
      autoSundayMode: false, _isSundayApplied: false,
      lastUpdated: new Date(), createdAt: new Date(), updatedAt: new Date()
    })
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Reset to defaults', settings })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ── GET current global rate (koi bhi adminAuth wala dekh sakta hai) ──
// GET /api/link-settings/global-rate
linkSettingsRoutes.get('/global-rate', adminAuth, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await db.collection('linksettings').findOne({})
    const globalRatePerThousandViews = typeof settings?.globalRatePerThousandViews === 'number'
      ? settings.globalRatePerThousandViews
      : 0
    return c.json({ success: true, globalRatePerThousandViews })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ── SET global rate (super admin only) ──────────────────────────────
// PUT /api/link-settings/global-rate   body: { rate: number }
linkSettingsRoutes.put('/global-rate', adminAuth, superAdminOnly, async (c) => {
  try {
    const { rate } = await c.req.json()
    if (typeof rate !== 'number' || rate < 0) {
      return c.json({ success: false, error: 'rate must be a non-negative number' }, 400)
    }
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    await db.collection('linksettings').updateOne(
      {},
      { $set: { globalRatePerThousandViews: rate } },
      { upsert: true }
    )
    return c.json({ success: true, globalRatePerThousandViews: rate })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default linkSettingsRoutes