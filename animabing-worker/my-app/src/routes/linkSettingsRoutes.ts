import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { withDb } from '../services/mongoService'
import { ILinkSettings } from '../models/types'
import { getTodaysActiveMode, syncSpecialModeLinks } from './specialModeRoutes'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { Db } from 'mongodb'

const linkSettingsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

function getIndiaWeekday(): number {
  const now = new Date()
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return indiaTime.getDay()
}

function applyLink5Override<T extends { link1: boolean; link2: boolean; link3: boolean; link4: boolean; link5: boolean }>(s: T): T {
  if (s.link5) {
    return { ...s, link1: false, link2: false, link3: false, link4: false, link5: true }
  }
  return s
}

// ============================================================================
// getSettings — ab `db` REQUIRED hai (no getDb fallback)
// Caller withDb ke andar se hi db pass karta hai.
// ============================================================================
async function getSettings(mongoUri: string, dbName: string, db: Db): Promise<ILinkSettings> {
  let settings = await db.collection('linksettings').findOne({}) as ILinkSettings | null

  if (!settings) {
    const defaultSettings = {
      link1: true, link2: true, link3: true, link4: true, link5: true,
      autoSundayMode: false, _isSundayApplied: false, lastUpdated: new Date()
    }
    await db.collection('linksettings').insertOne({ ...defaultSettings, createdAt: new Date(), updatedAt: new Date() })
    settings = defaultSettings as ILinkSettings
  }

  await syncSpecialModeLinks(mongoUri, dbName, db)
  settings = await db.collection('linksettings').findOne({}) as ILinkSettings

  return settings!
}

// GET SETTINGS — RAW
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/get', async (db) => {
      const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      return c.json(settings)
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET EFFECTIVE SETTINGS
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/effective', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/effective', async (db) => {
      const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      return c.json(applyLink5Override(settings))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// UPDATE SETTINGS — 🔐 sirf super admin
// ✅ FIX: getDb → withDb
linkSettingsRoutes.put('/', adminAuth, superAdminOnly, async (c) => {
  try {
    const { link1, link2, link3, link4, link5, autoSundayMode } = await c.req.json()

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/update', async (db) => {
      const updates: any = { lastUpdated: new Date() }
      if (link1 !== undefined) updates.link1 = Boolean(link1)
      if (link2 !== undefined) updates.link2 = Boolean(link2)
      if (link3 !== undefined) updates.link3 = Boolean(link3)
      if (link4 !== undefined) updates.link4 = Boolean(link4)
      if (link5 !== undefined) updates.link5 = Boolean(link5)
      if (autoSundayMode !== undefined) updates.autoSundayMode = Boolean(autoSundayMode)

      await db.collection('linksettings').updateOne({}, { $set: updates }, { upsert: true })
      const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)

      return c.json({ success: true, message: 'Link settings updated!', settings })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// TOGGLE LINK — 🔐 sirf super admin
// ✅ FIX: getDb → withDb
linkSettingsRoutes.put('/toggle/:linkNumber', adminAuth, superAdminOnly, async (c) => {
  try {
    const linkNumber = parseInt(c.req.param('linkNumber') ?? '', 10)
    if (!Number.isInteger(linkNumber) || linkNumber < 1 || linkNumber > 5) {
      return c.json({ error: 'Link number must be between 1 and 5' }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/toggle', async (db) => {
      const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      const linkKey = `link${linkNumber}` as keyof ILinkSettings
      const newValue = !settings[linkKey]

      await db.collection('linksettings').updateOne({}, { $set: { [linkKey]: newValue, lastUpdated: new Date() } })

      const updated = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      return c.json({ success: true, message: `Link ${linkNumber} ${newValue ? 'activated' : 'deactivated'}`, settings: updated })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// STATUS
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/status', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/status', async (db) => {
      const raw = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ACTIVE LINKS
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/active', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/active', async (db) => {
      const raw = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      const settings = applyLink5Override(raw)
      const activeLinks = [1, 2, 3, 4, 5].filter(i => settings[`link${i}` as keyof ILinkSettings])
      return c.json({ activeLinks, activeCount: activeLinks.length })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// restore-preview
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/restore-preview', async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/restore-preview', async (db) => {
      await syncSpecialModeLinks(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
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
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// RESET — 🔐 sirf super admin
// ✅ FIX: getDb → withDb
linkSettingsRoutes.post('/reset', adminAuth, superAdminOnly, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/reset', async (db) => {
      await db.collection('linksettings').deleteMany({})
      await db.collection('linksettings').insertOne({
        link1: true, link2: true, link3: true, link4: true, link5: true,
        autoSundayMode: false, _isSundayApplied: false,
        lastUpdated: new Date(), createdAt: new Date(), updatedAt: new Date()
      })
      const settings = await getSettings(c.env.MONGODB_URI, c.env.MONGODB_DB, db)
      return c.json({ success: true, message: 'Reset to defaults', settings })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET current global rate
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/global-rate', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/global-rate/get', async (db) => {
      const settings = await db.collection('linksettings').findOne({})
      const globalRatePerThousandViews = typeof settings?.globalRatePerThousandViews === 'number'
        ? settings.globalRatePerThousandViews
        : 0
      return c.json({ success: true, globalRatePerThousandViews })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// SET global rate
// ✅ FIX: getDb → withDb
linkSettingsRoutes.put('/global-rate', adminAuth, superAdminOnly, async (c) => {
  try {
    const { rate } = await c.req.json()
    if (typeof rate !== 'number' || rate < 0) {
      return c.json({ success: false, error: 'rate must be a non-negative number' }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/global-rate/put', async (db) => {
      await db.collection('linksettings').updateOne(
        {},
        { $set: { globalRatePerThousandViews: rate } },
        { upsert: true }
      )
      return c.json({ success: true, globalRatePerThousandViews: rate })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// GET link-wise rates
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/link-rates', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/link-rates/get', async (db) => {
      const s: any = await db.collection('linksettings').findOne({})
      const r = s?.linkRates || {}
      return c.json({ success: true, linkRates: {
        link1: r.link1 ?? 0, link2: r.link2 ?? 0, link3: r.link3 ?? 0, link4: r.link4 ?? 0,
      }})
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// SET link-wise rates
// ✅ FIX: getDb → withDb
linkSettingsRoutes.put('/link-rates', adminAuth, superAdminOnly, async (c) => {
  try {
    const body = await c.req.json()
    const rates: Record<string, number> = {}
    for (const n of [1, 2, 3, 4]) {
      const v = body[`link${n}`]
      if (typeof v !== 'number' || !isFinite(v) || v < 0) {
        return c.json({ success: false, error: `link${n} must be a non-negative number` }, 400)
      }
      rates[`link${n}`] = v
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/link-rates/put', async (db) => {
      await db.collection('linksettings').updateOne({}, { $set: { linkRates: rates } }, { upsert: true })
      return c.json({ success: true, linkRates: rates })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// GET count-mode
// ✅ FIX: getDb → withDb
linkSettingsRoutes.get('/count-mode', adminAuth, superAdminOnly, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/count-mode/get', async (db) => {
      const s: any = await db.collection('linksettings').findOne({})
      return c.json({
        success: true,
        countEveryView: s?.countEveryView === true,
        dedupeWindowSec: typeof s?.dedupeWindowSec === 'number' ? s.dedupeWindowSec : 86400,
      })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// PUT count-mode
// ✅ FIX: getDb → withDb
linkSettingsRoutes.put('/count-mode', adminAuth, superAdminOnly, async (c) => {
  try {
    const body = await c.req.json()
    const $set: any = {}

    if (body.countEveryView !== undefined) {
      if (typeof body.countEveryView !== 'boolean') {
        return c.json({ success: false, error: 'countEveryView must be true or false' }, 400)
      }
      $set.countEveryView = body.countEveryView
    }
    if (body.dedupeWindowSec !== undefined) {
      const n = Number(body.dedupeWindowSec)
      if (!Number.isFinite(n) || n < 1 || n > 172800) {
        return c.json({ success: false, error: 'dedupeWindowSec must be between 1 second and 48 hours' }, 400)
      }
      $set.dedupeWindowSec = Math.round(n)
    }
    if (Object.keys($set).length === 0) {
      return c.json({ success: false, error: 'Nothing to update' }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'linkSettings/count-mode/put', async (db) => {
      await db.collection('linksettings').updateOne({}, { $set }, { upsert: true })
      return c.json({ success: true, ...$set })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default linkSettingsRoutes