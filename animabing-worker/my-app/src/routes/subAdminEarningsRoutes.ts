// src/routes/subAdminEarningsRoutes.ts
// 🆕 EARNINGS: sub-admin "views → $" earnings — driven by pageviews tagged
// with earningType at write-time in analyticsService.trackPageView().
//
//   'normal'        → counted toward $ earnings (short link 1-4 path was used)
//   'link5-direct'  → NOT counted — link5 was manually ON (direct, no short link)
//   'special-mode'  → NOT counted — a Special Mode forced link5 on
//
// Rate resolution: subAdmin.ratePerThousandViews (custom) ?? linksettings.globalRatePerThousandViews (default)

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { updateOne, toObjectId, isValidObjectId, getDb } from '../services/mongoService'
import { getSubAdminEarnings, getAllSubAdminEarningsSummary } from '../services/analyticsService'

const subAdminEarningsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

// ============ GET /me — sub-admin apni earnings dekhe ============
subAdminEarningsRoutes.get('/me', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    if (admin.role !== 'subadmin') {
      return c.json({ success: false, error: 'Only sub-admins have an earnings view here. Use /all-summary as main admin.' }, 403)
    }
    const data = await getSubAdminEarnings(admin.id, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!data) return c.json({ success: false, error: 'Sub-admin not found' }, 404)
    return c.json({ success: true, data })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET /all-summary — main admin: sab sub-admins ka summary ============
subAdminEarningsRoutes.get('/all-summary', adminAuth, superAdminOnly, async (c) => {
  try {
    const data = await getAllSubAdminEarningsSummary(c.env.MONGODB_URI, c.env.MONGODB_DB)

    // Global rate bhi saath mein bhej do taaki UI mein editable field dikh sake
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const settings = await db.collection('linksettings').findOne({})
    const globalRate = typeof settings?.globalRatePerThousandViews === 'number'
      ? settings.globalRatePerThousandViews
      : 0

    return c.json({ success: true, globalRate, data })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET /:subAdminId — main admin: ek specific sub-admin ki detail ============
subAdminEarningsRoutes.get('/:subAdminId', adminAuth, superAdminOnly, async (c) => {
  try {
    const subAdminId = c.req.param('subAdminId')
    if (!isValidObjectId(subAdminId)) return c.json({ success: false, error: 'Invalid ID' }, 400)
    const data = await getSubAdminEarnings(subAdminId, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!data) return c.json({ success: false, error: 'Sub-admin not found' }, 404)
    return c.json({ success: true, data })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ PUT /:subAdminId/rate — main admin: custom rate set/clear kare ============
// body: { rate: number | null }  — null bhejne se sub-admin wapas global rate use karega
subAdminEarningsRoutes.put('/:subAdminId/rate', adminAuth, superAdminOnly, async (c) => {
  try {
    const subAdminId = c.req.param('subAdminId')
    if (!isValidObjectId(subAdminId)) return c.json({ success: false, error: 'Invalid ID' }, 400)

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