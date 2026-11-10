import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { withDb } from '../services/mongoService'

const instagramWebhookRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const DAILY_DM_LIMIT_PER_USER_PER_RULE = 4
export const HOURLY_SEND_LIMIT = 700 // Meta's cap is 750/hour, 700 provides a safety buffer

// ============================================================
// 🔐 Webhook signature check (X-Hub-Signature-256)
// Meta signs the RAW body with the app secret (HMAC-SHA256).
// ============================================================
async function verifyMetaSignature(
  rawBody: ArrayBuffer,
  header: string | undefined,
  appSecret: string | undefined
): Promise<boolean> {
  if (!header || !appSecret) return false
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim())
  if (!m) return false

  const sig = new Uint8Array(32)
  for (let i = 0; i < 32; i++) sig[i] = parseInt(m[1].substr(i * 2, 2), 16)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  // crypto.subtle.verify compares in constant time
  return crypto.subtle.verify('HMAC', key, sig, rawBody)
}

instagramWebhookRoutes.get('/webhook/instagram', (c) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode === 'subscribe' && token === c.env.IG_VERIFY_TOKEN) {
    console.log('✅ Instagram webhook verified successfully')
    return c.text(challenge || '', 200)
  }

  console.warn('❌ Instagram webhook verification failed — token mismatch')
  return c.text('Forbidden', 403)
})

instagramWebhookRoutes.post('/webhook/instagram', async (c) => {
  // Read the raw bytes first — the signature is calculated on exactly these bytes
  const raw = await c.req.arrayBuffer()

  const valid = await verifyMetaSignature(raw, c.req.header('x-hub-signature-256'), c.env.IG_APP_SECRET)
  if (!valid) {
    // Safe rollout switch: set IG_SIGNATURE_LOG_ONLY=true in Worker vars to only warn (not block)
    if ((c.env as any).IG_SIGNATURE_LOG_ONLY === 'true') {
      console.warn('⚠️ Invalid webhook signature (log-only mode, request allowed)')
    } else {
      console.warn('❌ Invalid webhook signature — request rejected')
      return c.text('Forbidden', 403)
    }
  }

  let body: any
  try {
    body = JSON.parse(new TextDecoder().decode(raw))
  } catch (err) {
    console.error('Failed to parse Instagram webhook body', err)
    return c.text('EVENT_RECEIVED', 200)
  }

  console.log('📩 Instagram webhook received:', JSON.stringify(body))
  c.executionCtx.waitUntil(processInstagramWebhook(body, c.env))
  return c.text('EVENT_RECEIVED', 200)
})

// ============================================================
// ⚡ Run many events at the same time (max `limit` at once).
// Meta can send several comments in ONE webhook; doing them one by one
// would make the last user wait for everyone before them.
// ============================================================
async function runLimited(tasks: (() => Promise<unknown>)[], limit = 5) {
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      try {
        await tasks[i]()
      } catch (err) {
        console.error('Webhook event failed', err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

async function processInstagramWebhook(body: any, env: Env) {
  try {
    const tasks: (() => Promise<unknown>)[] = []
    for (const entry of body.entry || []) {
      const igAccountId = entry.id
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          tasks.push(() => handleCommentEvent(change.value, igAccountId, env))
        }
      }
      for (const msgEvent of entry.messaging || []) {
        tasks.push(() => handleDirectMessageEvent(msgEvent, igAccountId, env))
      }
    }
    await runLimited(tasks, 5)
  } catch (err) {
    console.error('Instagram webhook processing failed', err)
  }
}

function getISTDateString(date: Date = new Date()): string {
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  return istDate.toISOString().slice(0, 10)
}

function getHourBucket(date: Date = new Date()): string {
  return Math.floor(date.getTime() / (60 * 60 * 1000)).toString()
}

// ============================================================
// ⏰ Post code SCHEDULE (India time / IST)
//
// pc.schedule = {
//   enabled: boolean,
//   days:    number[]            // 0 = Sun ... 6 = Sat
//   slots:   { startTime, endTime }[]   // 24h "HH:mm" (IST), e.g. 21:30
// }
// - schedule missing / disabled  -> code is ALWAYS on
// - old format (startTime/endTime directly on schedule) still works
// - overnight slot (22:00 -> 02:00) works; the after-midnight part
//   belongs to the PREVIOUS day's window.
// ============================================================
type Slot = { startTime: string; endTime: string }

function toMinutes(t: string): number {
  const [h, m] = String(t || '').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// new format: slots[]; old format: startTime/endTime (one slot)
function getSlots(schedule: any): Slot[] {
  if (Array.isArray(schedule.slots) && schedule.slots.length > 0) return schedule.slots
  return [{ startTime: schedule.startTime || '00:00', endTime: schedule.endTime || '23:59' }]
}

/** true = the code is ON right now. */
export function isCodeScheduleOpen(schedule: any, now: Date = new Date()): boolean {
  if (!schedule || !schedule.enabled) return true
  const days: number[] = Array.isArray(schedule.days) ? schedule.days : []
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const day = ist.getUTCDay() // 0 = Sun
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()

  return getSlots(schedule).some((slot) => {
    const start = toMinutes(slot.startTime)
    const end = toMinutes(slot.endTime)
    if (start <= end) return days.includes(day) && minutes >= start && minutes <= end
    // overnight slot (22:00 -> 02:00)
    if (minutes >= start) return days.includes(day)
    if (minutes <= end) return days.includes((day + 6) % 7)
    return false
  })
}

/**
 * Which schedule applies to this code?
 *   pc.scheduleMode = 'global' -> the account's GLOBAL schedule (account.postCodeSchedule)
 *                     'custom' -> the code's own schedule (pc.schedule)
 *                     'always' -> no schedule, always on
 * Old codes (no scheduleMode): own schedule enabled -> 'custom', otherwise -> 'global'.
 * Returns null = no schedule = always on.
 */
export function effectiveSchedule(pc: any, account: any): any | null {
  const mode = pc?.scheduleMode || (pc?.schedule?.enabled ? 'custom' : 'global')
  if (mode === 'always') return null
  if (mode === 'custom') return pc.schedule || null
  return account?.postCodeSchedule || null
}

// ============================================================
// 🔒 Duplicate protection
// Needs a UNIQUE index on automationLogs (commentId, sourceType).
// The first worker to insert the "processing" log owns the event;
// a duplicate webhook delivery hits the unique index and stops.
// ============================================================
async function claimEvent(db: any, doc: any): Promise<any | null> {
  try {
    const result = await db.collection('automationLogs').insertOne(doc)
    return result.insertedId
  } catch (err: any) {
    if (err?.code === 11000 || String(err?.message || '').includes('E11000')) {
      console.log(`Duplicate event ${doc.commentId} — already claimed, skipping`)
      return null
    }
    throw err
  }
}

async function finishLog(db: any, logId: any, fields: Record<string, any>) {
  await db.collection('automationLogs').updateOne(
    { _id: logId },
    { $set: { ...fields, updatedAt: new Date() } }
  )
}

// ------------------------------------------------------------
// Post-caption code resolution
// ------------------------------------------------------------

// Caption must contain:  ID:482913   (case-insensitive, space after colon allowed)
const CODE_REGEX = /\bID:\s?(\d{6})\b/i

// Posts without a code are re-checked at most every 10 minutes (saves API calls)
const NO_CODE_RECHECK_MS = 10 * 60 * 1000

/**
 * Finds the 6-digit code in the post caption and returns the saved postCode document.
 * - First comment on a post: fetches caption from Instagram, saves postId -> code in cache.
 * - Next comments: served from cache (no extra API call).
 * - No code / paused code: returns null.
 *
 * Fields used by the caller:
 *   pc.code        — the 6-digit code
 *   pc.link        — legacy link (old codes that have no dmMessage)
 *   pc.dmMessage   — this code's own DM message
 *   pc.triggerMode — 'any' | 'exact' | 'contains' (defaults to 'any')
 *   pc.keyword     — keyword used when triggerMode is 'exact' / 'contains'
 *   pc.schedule    — days + time slots (IST) when the code is ON
 */
async function resolvePostCode(
  db: any,
  account: any,
  postId: string | undefined
): Promise<any | null> {
  if (!postId) return null
  const accountId: string = account.igUserId

  let code: string | null = null
  const cached = await db.collection('postCodeCache').findOne({ accountId, postId })

  if (cached?.code) {
    code = cached.code
  } else if (cached?.checkedAt && Date.now() - new Date(cached.checkedAt).getTime() < NO_CODE_RECHECK_MS) {
    return null // checked recently: this post has no code
  } else {
    try {
      const res = await fetch(
        `https://graph.instagram.com/${postId}?fields=caption&access_token=${account.accessToken}`
      )
      if (res.ok) {
        const data: any = await res.json()
        const m = CODE_REGEX.exec(data.caption || '')
        if (m) {
          code = m[1]
        } else {
          // remember "no code here" for a while
          await db.collection('postCodeCache').updateOne(
            { accountId, postId },
            { $set: { accountId, postId, code: null, checkedAt: new Date() } },
            { upsert: true }
          )
          return null
        }
      } else {
        console.warn('Caption fetch failed for post', postId, await res.text())
      }
    } catch (err) {
      console.error('Caption fetch error', err)
    }
  }

  if (!code) return null

  const pc = await db.collection('postCodes').findOne({ accountId, code, isActive: true })
  if (!pc) return null

  if (!cached?.code) {
    await db.collection('postCodeCache').updateOne(
      { accountId, postId },
      { $set: { accountId, postId, code, createdAt: new Date() } },
      { upsert: true }
    )
    await db.collection('postCodes').updateOne(
      { _id: pc._id },
      { $set: { postId, usedAt: new Date() } }
    )
  }

  return pc
}

/** Does this comment satisfy the code's trigger (every comment / exact / contains)? */
function codeTriggerMatches(pc: any, commentText: string): boolean {
  const mode = pc.triggerMode || 'any'
  if (mode === 'any') return true
  const kw = String(pc.keyword || '').toLowerCase().trim()
  if (!kw) return false
  return mode === 'exact' ? commentText === kw : commentText.includes(kw)
}

/**
 * Rule message example:  "Ye lo tumhara link: {link} 🎌"
 * - {link} is replaced with the link
 * - no link -> {link} falls back to your site homepage
 * - message without {link} + link given -> link is added on a new line
 */
function buildDmMessage(template: string, link: string): string {
  const finalLink = link || 'https://animebing.in'
  if (template.includes('{link}')) return template.split('{link}').join(finalLink)
  return link ? `${template}\n${link}` : template
}

// ============================================================
// ✅ COMMENT EVENT
//
// 1) POST CODE first — if the post caption has an active ID:xxxxxx whose own
//    DM message exists and whose trigger matches the comment
//    (every comment / exact keyword / contains keyword), send ONLY that message.
//    No rule is needed for this.
//    ⏰ If the code has a schedule and we are outside it -> NO DM at all.
// 2) Otherwise RULES — normal keyword rule matching (post rules, then account-wide).
//
// A comment gets one DM: either the code's message or the rule's message, never merged.
// ⏱ console.log lines starting with ⏱ show where the time goes (remove later).
// ============================================================
async function handleCommentEvent(value: any, igAccountId: string, env: Env) {
  const commentId: string = value.id
  const commentText: string = (value.text || '').toLowerCase().trim()
  const senderId: string = value.from?.id
  const postId: string | undefined = value.media?.id || value.media_id

  if (!commentId || !senderId || !igAccountId) return
  if (senderId === igAccountId) return

  await withDb(env.MONGODB_URI, env.MONGODB_DB, 'handleCommentEvent', async (db) => {
    const t0 = Date.now()

    // two reads at the same time
    const [already, account] = await Promise.all([
      db.collection('automationLogs').findOne({ commentId, sourceType: 'comment' }),
      db.collection('instagramAccounts').findOne({ igUserId: igAccountId, isActive: true }),
    ])
    if (already) {
      console.log(`Comment ${commentId} already processed — skipping`)
      return
    }
    if (!account) return
    console.log(`⏱ first reads done at +${Date.now() - t0}ms`)

    // ---- 1) post code ----
    const pc = await resolvePostCode(db, account, postId)
    console.log(`⏱ post code resolved at +${Date.now() - t0}ms`)

    // ⏰ Code's schedule is OFF right now -> no DM for this post (neither code nor rule)
    if (pc && !isCodeScheduleOpen(effectiveSchedule(pc, account))) {
      console.log(`Code ID:${pc.code} is outside its schedule — skipping comment ${commentId}`)
      return
    }

    const codeMessage: string =
      pc && (pc.dmMessage || '').trim() && codeTriggerMatches(pc, commentText) ? pc.dmMessage.trim() : ''

    let trigger: { id: string; keyword: string; message: string }

    if (codeMessage) {
      trigger = { id: `code_${pc._id.toString()}`, keyword: `ID:${pc.code}`, message: codeMessage }
    } else {
      // ---- 2) rules ----
      const allRules = await db.collection('automationRules')
        .find({ accountId: igAccountId, isActive: true })
        .toArray()

      const postRules = allRules.filter((r: any) => r.postId && r.postId === postId)
      const accountWideRules = allRules.filter((r: any) => !r.postId)
      const candidateRules = [...postRules, ...accountWideRules]

      const matchedRule = candidateRules.find((rule: any) => {
        const keyword = (rule.keyword || '').toLowerCase().trim()
        if (!keyword) return false
        return rule.matchType === 'exact' ? commentText === keyword : commentText.includes(keyword)
      })

      if (!matchedRule) {
        console.log(`No code/rule matched for comment: "${commentText}" on account ${igAccountId}`)
        return
      }

      trigger = {
        id: matchedRule._id.toString(),
        keyword: matchedRule.keyword,
        // only old link-only codes (no dmMessage) still inject their link into the rule message
        message: buildDmMessage(
          matchedRule.dmMessage,
          pc && !(pc.dmMessage || '').trim() ? pc.link || '' : ''
        ),
      }
    }

    const dateStr = getISTDateString()
    const dailyKey = `${senderId}_${trigger.id}_${dateStr}`
    const hourBucket = getHourBucket()
    const hourlyKey = `${igAccountId}_${hourBucket}`

    // 🔒 claim this comment + read both limits in ONE round trip (saves ~0.5 s)
    // If another delivery already claimed it, logId is null and we stop.
    const [logId, rl, hourlyDoc] = await Promise.all([
      claimEvent(db, {
        commentId, sourceType: 'comment', accountId: igAccountId, postId: postId || null,
        senderId, keyword: trigger.keyword, matchedText: commentText,
        status: 'processing', createdAt: new Date(), updatedAt: new Date(),
      }),
      db.collection('dmRateLimits').findOne({ key: dailyKey }),
      db.collection('igHourlyUsage').findOne({ key: hourlyKey }),
    ])
    if (!logId) return
    console.log(`⏱ claimed + limits at +${Date.now() - t0}ms`)

    try {
      if ((rl?.count || 0) >= DAILY_DM_LIMIT_PER_USER_PER_RULE) {
        await finishLog(db, logId, { status: 'limit_reached' })
        return
      }

      if ((hourlyDoc?.count || 0) >= HOURLY_SEND_LIMIT) {
        await db.collection('igDmQueue').insertOne({
          igAccountId, senderId, ruleId: trigger.id,
          dmMessage: trigger.message,
          sourceType: 'comment',
          commentId,
          recipientRef: { comment_id: commentId },
          status: 'pending',
          createdAt: new Date(),
        })
        await finishLog(db, logId, { status: 'queued' })
        console.log(`Hourly limit reached — comment ${commentId} queued for later`)
        return
      }

      // NOTE: no 'v23.0' here — graph.instagram.com expects unversioned calls
      const tSend = Date.now()
      const sendResult = await fetch(
        `https://graph.instagram.com/${igAccountId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { comment_id: commentId },
            message: { text: trigger.message },
            access_token: account.accessToken,
          }),
        }
      )
      console.log(`⏱ Instagram send took ${Date.now() - tSend}ms, total so far +${Date.now() - t0}ms`)

      if (!sendResult.ok) {
        const errText = (await sendResult.text()).slice(0, 300)
        console.error('Failed to send Instagram private reply:', errText)
        await finishLog(db, logId, { status: 'failed', error: errText })
        return
      }

      // DM is out: mark "sent" FIRST (this is what the dashboard shows)
      await finishLog(db, logId, { status: 'sent' })

      // counters in parallel; a failure here must NOT turn a sent DM into "failed"
      try {
        await Promise.all([
          db.collection('dmRateLimits').updateOne(
            { key: dailyKey },
            { $set: { senderId, ruleId: trigger.id, date: dateStr }, $inc: { count: 1 } },
            { upsert: true }
          ),
          db.collection('igHourlyUsage').updateOne(
            { key: hourlyKey },
            { $set: { igAccountId, bucket: hourBucket }, $inc: { count: 1 } },
            { upsert: true }
          ),
          codeMessage
            ? db.collection('postCodes').updateOne({ _id: pc._id }, { $inc: { hits: 1 } })
            : Promise.resolve(),
        ])
      } catch (counterErr) {
        console.error('Counter update failed after a successful send', counterErr)
      }
      console.log(`⏱ all done at +${Date.now() - t0}ms`)
    } catch (err: any) {
      // never leave a log stuck in "processing"
      console.error('handleCommentEvent failed after claim', err)
      try {
        await finishLog(db, logId, { status: 'failed', error: String(err?.message || err).slice(0, 300) })
      } catch { /* ignore */ }
    }
  }, 30000)
}

// ============================================================
// ✅ DIRECT MESSAGE EVENT — same hourly + daily limit logic
// ============================================================
async function handleDirectMessageEvent(msgEvent: any, igAccountId: string, env: Env) {
  const messageId: string = msgEvent.message?.mid
  const messageText: string = (msgEvent.message?.text || '').toLowerCase().trim()
  const senderId: string = msgEvent.sender?.id

  if (!messageId || !senderId || !messageText || !igAccountId) return
  if (senderId === igAccountId) return

  await withDb(env.MONGODB_URI, env.MONGODB_DB, 'handleDirectMessageEvent', async (db) => {
    const already = await db.collection('automationLogs').findOne({ commentId: messageId, sourceType: 'dm' })
    if (already) return

    const account = await db.collection('instagramAccounts').findOne({ igUserId: igAccountId, isActive: true })
    if (!account) return

    const allRules = await db.collection('automationRules')
      .find({ accountId: igAccountId, isActive: true })
      .toArray()

    const matchedRule = allRules.find((rule: any) => {
      const keyword = (rule.keyword || '').toLowerCase().trim()
      if (!keyword) return false
      return rule.matchType === 'exact' ? messageText === keyword : messageText.includes(keyword)
    })

    if (!matchedRule) return

    // 🔒 Claim this DM event
    const logId = await claimEvent(db, {
      commentId: messageId, sourceType: 'dm', accountId: igAccountId, postId: matchedRule.postId || null,
      senderId, keyword: matchedRule.keyword, matchedText: messageText,
      status: 'processing', createdAt: new Date(), updatedAt: new Date(),
    })
    if (!logId) return

    try {
      const ruleId = matchedRule._id.toString()
      const dateStr = getISTDateString()
      const dailyKey = `${senderId}_${ruleId}_${dateStr}`

      const rl = await db.collection('dmRateLimits').findOne({ key: dailyKey })
      const dailyCount = rl?.count || 0

      if (dailyCount >= DAILY_DM_LIMIT_PER_USER_PER_RULE) {
        await finishLog(db, logId, { status: 'limit_reached' })
        return
      }

      const dmText = buildDmMessage(matchedRule.dmMessage, '')

      const hourBucket = getHourBucket()
      const hourlyKey = `${igAccountId}_${hourBucket}`
      const hourlyDoc = await db.collection('igHourlyUsage').findOne({ key: hourlyKey })
      const hourlyUsed = hourlyDoc?.count || 0

      if (hourlyUsed >= HOURLY_SEND_LIMIT) {
        await db.collection('igDmQueue').insertOne({
          igAccountId, senderId, ruleId,
          dmMessage: dmText,
          sourceType: 'dm',
          commentId: messageId,
          recipientRef: { id: senderId },
          status: 'pending',
          createdAt: new Date(),
        })
        await finishLog(db, logId, { status: 'queued' })
        return
      }

      const sendResult = await fetch(
        `https://graph.instagram.com/${igAccountId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: dmText },
            access_token: account.accessToken,
          }),
        }
      )

      if (!sendResult.ok) {
        const errText = (await sendResult.text()).slice(0, 300)
        console.error('Failed to send Instagram DM reply:', errText)
        await finishLog(db, logId, { status: 'failed', error: errText })
        return
      }

      await db.collection('dmRateLimits').updateOne(
        { key: dailyKey },
        { $set: { senderId, ruleId, date: dateStr }, $inc: { count: 1 } },
        { upsert: true }
      )
      await db.collection('igHourlyUsage').updateOne(
        { key: hourlyKey },
        { $set: { igAccountId, bucket: hourBucket }, $inc: { count: 1 } },
        { upsert: true }
      )
      await finishLog(db, logId, { status: 'sent' })
    } catch (err: any) {
      console.error('handleDirectMessageEvent failed after claim', err)
      try {
        await finishLog(db, logId, { status: 'failed', error: String(err?.message || err).slice(0, 300) })
      } catch { /* ignore */ }
    }
  }, 30000)
}

// ============================================================
// ✅ INTERNAL ROUTE — for queue chain continuation.
// Only our own backend calls this (protected by secret header),
// public users cannot access it.
// ============================================================
instagramWebhookRoutes.post('/internal/instagram-dm-queue/continue', async (c) => {
  const secret = c.req.header('x-internal-secret')
  if (secret !== c.env.JWT_SECRET) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const chainDepth = parseInt(c.req.query('chain') || '0', 10)
  const { runQueueChain } = await import('../services/instagramQueueService')

  c.executionCtx.waitUntil(runQueueChain(c.env, chainDepth))
  return c.json({ success: true })
})

export default instagramWebhookRoutes