import type { Env } from '../index'
import { withDb } from './mongoService'

// Refresh tokens that expire within this many days.
// Cron runs daily, so each token gets ~20 attempts before it can expire.
const REFRESH_WINDOW_DAYS = 20
// Don't retry the same account more often than this (protects against cron running often)
const RETRY_AFTER_HOURS = 12
// Workers free plan allows ~50 subrequests per run, so keep a safe cap
const MAX_ACCOUNTS_PER_RUN = 25

export type TokenRefreshResult =
  | { ok: true; accessToken: string; expiresAt: Date }
  | { ok: false; error: string; expired: boolean }

/**
 * Calls Instagram's refresh endpoint for ONE long-lived token. No DB access here,
 * so both the cron job and the dashboard "Refresh token" button can reuse it.
 * Rules (Meta): token must be at least 24h old and not expired yet.
 */
export async function refreshOneAccountToken(accessToken: string): Promise<TokenRefreshResult> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token` +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`
    )
    const data: any = await res.json().catch(() => ({}))

    if (res.ok && data.access_token) {
      const expiresIn = Number(data.expires_in) || 5184000 // fallback ~60 days
      return {
        ok: true,
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      }
    }

    const err = data?.error
    const message = String(err?.message || `HTTP ${res.status}`).slice(0, 300)
    // code 190 = token invalid/expired -> user must reconnect the account
    return { ok: false, error: message, expired: err?.code === 190 }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 300), expired: false }
  }
}

/**
 * Daily job: refresh every account whose token is close to expiry (or has no known expiry).
 */
export async function refreshExpiringTokens(env: Env): Promise<{ checked: number; refreshed: number; failed: number }> {
  const stats = { checked: 0, refreshed: 0, failed: 0 }

  await withDb(env.MONGODB_URI, env.MONGODB_DB, 'refreshExpiringTokens', async (db) => {
    const now = Date.now()
    const expiryThreshold = new Date(now + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const retryThreshold = new Date(now - RETRY_AFTER_HOURS * 60 * 60 * 1000)

    const accounts = await db.collection('instagramAccounts').find({
      accessToken: { $exists: true, $ne: null },
      deauthorizedAt: { $exists: false },
      $and: [
        {
          $or: [
            { tokenExpiresAt: { $exists: false } },
            { tokenExpiresAt: null },
            { tokenExpiresAt: { $lt: expiryThreshold } },
          ],
        },
        {
          $or: [
            { tokenLastCheckedAt: { $exists: false } },
            { tokenLastCheckedAt: { $lt: retryThreshold } },
          ],
        },
      ],
    }).limit(MAX_ACCOUNTS_PER_RUN).toArray()

    for (const acc of accounts) {
      stats.checked++
      const result = await refreshOneAccountToken(acc.accessToken)

      if (result.ok) {
        stats.refreshed++
        await db.collection('instagramAccounts').updateOne(
          { _id: acc._id },
          {
            $set: {
              accessToken: result.accessToken,
              tokenExpiresAt: result.expiresAt,
              tokenStatus: 'ok',
              tokenError: null,
              tokenLastCheckedAt: new Date(),
              tokenRefreshedAt: new Date(),
            },
          }
        )
        console.log(`🔑 Token refreshed for @${acc.igUsername}, new expiry ${result.expiresAt.toISOString()}`)
      } else {
        stats.failed++
        await db.collection('instagramAccounts').updateOne(
          { _id: acc._id },
          {
            $set: {
              tokenStatus: result.expired ? 'expired' : 'error',
              tokenError: result.error,
              tokenLastCheckedAt: new Date(),
            },
          }
        )
        console.warn(`⚠️ Token refresh failed for @${acc.igUsername}: ${result.error}`)
      }
    }
  })

  console.log(`🔑 Token refresh run: checked=${stats.checked} refreshed=${stats.refreshed} failed=${stats.failed}`)
  return stats
}