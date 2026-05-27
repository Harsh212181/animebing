import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findOne, updateOne, insertOne, deleteMany, getDb } from '../services/mongoService'
import { ILinkSettings } from '../models/types'

const linkSettingsRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

function getIndiaWeekday(): number {
  const now = new Date()
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return indiaTime.getDay()
}

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

  // Auto Sunday Logic
  if (settings.autoSundayMode) {
    const day = getIndiaWeekday()
    if (day === 0 && !settings._isSundayApplied) {
      await db.collection('linksettings').updateOne({}, {
        $set: {
          normalState: { link1: settings.link1, link2: settings.link2, link3: settings.link3, link4: settings.link4, link5: settings.link5 },
          link1: false, link2: false, link3: false, link4: false, link5: true,
          _isSundayApplied: true, lastUpdated: new Date()
        }
      })
      settings = await db.collection('linksettings').findOne({}) as ILinkSettings
    } else if (day === 1 && settings._isSundayApplied) {
      const ns = settings.normalState || { link1: true, link2: true, link3: true, link4: true, link5: true }
      await db.collection('linksettings').updateOne({}, {
        $set: {
          link1: ns.link1, link2: ns.link2, link3: ns.link3, link4: ns.link4, link5: ns.link5,
          _isSundayApplied: false, lastUpdated: new Date()
        }
      })
      settings = await db.collection('linksettings').findOne({}) as ILinkSettings
    }
  }

  return settings!
}

// GET SETTINGS
linkSettingsRoutes.get('/', async (c) => {
  try {
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(settings)
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

// TOGGLE AUTO SUNDAY
linkSettingsRoutes.put('/toggle-autosunday', async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const newMode = !settings.autoSundayMode

    await db.collection('linksettings').updateOne({}, { $set: { autoSundayMode: newMode, lastUpdated: new Date() } })
    const updated = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: `Auto Sunday mode is now ${newMode ? 'ON' : 'OFF'}`, settings: updated })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// STATUS
linkSettingsRoutes.get('/status', async (c) => {
  try {
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const activeLinks = [1, 2, 3, 4, 5].filter(i => settings[`link${i}` as keyof ILinkSettings])

    return c.json({
      totalLinks: 5,
      activeLinks,
      activeCount: activeLinks.length,
      settings: {
        link1: settings.link1, link2: settings.link2, link3: settings.link3,
        link4: settings.link4, link5: settings.link5,
        autoSundayMode: settings.autoSundayMode
      },
      lastUpdated: settings.lastUpdated
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ACTIVE LINKS
linkSettingsRoutes.get('/active', async (c) => {
  try {
    const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const activeLinks = [1, 2, 3, 4, 5].filter(i => settings[`link${i}` as keyof ILinkSettings])
    return c.json({ activeLinks, activeCount: activeLinks.length })
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

export default linkSettingsRoutes