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
// (getSubAdminEarnings apne aap me already 1 connection use karta hai)
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
// ✅ FIX: pehle `getAllSubAdminEarningsSummary()` apna alag connection kholta
// tha, aur linksettings lookup ke liye ek aur alag `getDb()` = 2 connections.
// Ab ek `db` khul ke dono ko pass hota hai.
subAdminEarningsRoutes.get('/all-summary', adminAuth, superAdminOnly, async (c) => {
  try {
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const data = await getAllSubAdminEarningsSummary(c.env.MONGODB_URI, c.env.MONGODB_DB, db) // ✅ db pass kiya

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
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ GET /:subAdminId — main admin: ek specific sub-admin ki detail ============
subAdminEarningsRoutes.get('/:subAdminId', adminAuth, superAdminOnly, async (c) => {
  try {
    const subAdminId = c.req.param('subAdminId')
    if (!subAdminId || !isValidObjectId(subAdminId)) {
      return c.json({ success: false, error: 'Invalid ID' }, 400)
    }
    const data = await getSubAdminEarnings(subAdminId, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!data) return c.json({ success: false, error: 'Sub-admin not found' }, 404)
    return c.json({ success: true, data })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// ============ PUT /:subAdminId/rate — main admin: custom rate set/clear kare ============
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