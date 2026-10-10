// src/routes/subAdminEarningsRoutes.ts
// 🆕 EARNINGS: sub-admin "views → $" earnings — driven by pageviews tagged
// with earningType at write-time in analyticsService.trackPageView().

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { updateOne, toObjectId, isValidObjectId, withDb } from '../services/mongoService'
import { getSubAdminEarnings, getAllSubAdminEarningsSummary } from '../services/analyticsService'

const subAdminEarningsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============================================================================
// ✅ MIGRATED: getSubAdminEarnings + getAllSubAdminEarningsSummary ab `db: Db`
// accept karte hain (pehla arg). Har route `withDb` ke andar — connection
// pooling via mongoService.
// ============================================================================

// ============ GET /me ============
subAdminEarningsRoutes.get('/me', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin.role !== 'subadmin') {
      return c.json({ success: false, error: 'Only sub-admins have an earnings view here. Use /all-summary as main admin.' }, 403)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'subAdminEarnings/me', async (db) => {
      const data = await getSubAdminEarnings(db, admin.id)
      if (!data) return c.json({ success: false, error: 'Sub-admin not found' }, 404)
      return c.json({ success: true, data })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET /all-summary ============
subAdminEarningsRoutes.get('/all-summary', adminAuth, superAdminOnly, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'subAdminEarnings/all-summary', async (db) => {
      const data = await getAllSubAdminEarningsSummary(db)

      const settings: any = await db.collection('linksettings').findOne({})

      const globalRate =
        typeof settings?.globalRatePerThousandViews === 'number'
          ? settings.globalRatePerThousandViews
          : 0

      const r = settings?.linkRates || {}
      const linkRates = {
        link1: r.link1 ?? 0,
        link2: r.link2 ?? 0,
        link3: r.link3 ?? 0,
        link4: r.link4 ?? 0,
      }

      return c.json({ success: true, globalRate, linkRates, data })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET /:subAdminId ============
subAdminEarningsRoutes.get('/:subAdminId', adminAuth, superAdminOnly, async (c) => {
  try {
    const subAdminId = c.req.param('subAdminId')
    if (!subAdminId || !isValidObjectId(subAdminId)) {
      return c.json({ success: false, error: 'Invalid ID' }, 400)
    }

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'subAdminEarnings/by-id', async (db) => {
      const data = await getSubAdminEarnings(db, subAdminId)
      if (!data) return c.json({ success: false, error: 'Sub-admin not found' }, 404)
      return c.json({ success: true, data })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ PUT /:subAdminId/rate ============
// already uses updateOne helper → single withDb internally — no change
subAdminEarningsRoutes.put('/:subAdminId/rate', adminAuth, superAdminOnly, async (c) => {
  try {
    const subAdminId = c.req.param('subAdminId')
    if (!subAdminId || !isValidObjectId(subAdminId)) {
      return c.json({ success: false, error: 'Invalid ID' }, 400)
    }

    const { rate } = await c.req.json()
    if (rate !== null && (typeof rate !== 'number' || rate < 0)) {
      return c.json({ success: false, error: 'rate must be a non-negative number, or null to clear' }, 400)
    }

    const updated = await updateOne(
      'subadmins',
      { _id: toObjectId(subAdminId) },
      { ratePerThousandViews: rate },
      c.env.MONGODB_URI, c.env.MONGODB_DB
    )
    if (!updated) return c.json({ success: false, error: 'Sub-admin not found' }, 404)

    return c.json({ success: true, message: rate === null ? 'Reverted to global rate' : 'Custom rate updated', ratePerThousandViews: rate })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default subAdminEarningsRoutes