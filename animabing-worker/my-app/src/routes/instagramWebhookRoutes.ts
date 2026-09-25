import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { withDb } from '../services/mongoService'

const instagramWebhookRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

const DAILY_DM_LIMIT_PER_USER_PER_RULE = 4
export const HOURLY_SEND_LIMIT = 700 // Meta's cap is 750/hour, 700 provides a safety buffer

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
  let body: any
  try {
    body = await c.req.json()
  } catch (err) {
    console.error('Failed to parse Instagram webhook body', err)
    return c.text('EVENT_RECEIVED', 200)
  }

  console.log('📩 Instagram webhook received:', JSON.stringify(body))
  c.executionCtx.waitUntil(processInstagramWebhook(body, c.env))
  return c.text('EVENT_RECEIVED', 200)
})

async function processInstagramWebhook(body: any, env: Env) {
  try {
    for (const entry of body.entry || []) {
      const igAccountId = entry.id
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          await handleCommentEvent(change.value, igAccountId, env)
        }
      }
      for (const msgEvent of entry.messaging || []) {
        await handleDirectMessageEvent(msgEvent, igAccountId, env)
      }
    }
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
// ✅ COMMENT EVENT — check both daily limit and hourly (Meta) limit
// ============================================================
async function handleCommentEvent(value: any, igAccountId: string, env: Env) {
  const commentId: string = value.id
  const commentText: string = (value.text || '').toLowerCase().trim()
  const senderId: string = value.from?.id
  const postId: string | undefined = value.media?.id || value.media_id

  if (!commentId || !senderId || !igAccountId) return
  if (senderId === igAccountId) return

  await withDb(env.MONGODB_URI, env.MONGODB_DB, 'handleCommentEvent', async (db) => {
    const already = await db.collection('automationLogs').findOne({ commentId, sourceType: 'comment' })
    if (already) {
      console.log(`Comment ${commentId} already processed — skipping`)
      return
    }

    const account = await db.collection('instagramAccounts').findOne({ igUserId: igAccountId, isActive: true })
    if (!account) return

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
      console.log(`No matching rule for comment: "${commentText}" on account ${igAccountId}`)
      return
    }

    const ruleId = matchedRule._id.toString()
    const dateStr = getISTDateString()
    const dailyKey = `${senderId}_${ruleId}_${dateStr}`

    const rl = await db.collection('dmRateLimits').findOne({ key: dailyKey })
    const dailyCount = rl?.count || 0

    if (dailyCount >= DAILY_DM_LIMIT_PER_USER_PER_RULE) {
      await db.collection('automationLogs').insertOne({
        commentId, sourceType: 'comment', accountId: igAccountId, postId: postId || null,
        senderId, keyword: matchedRule.keyword, matchedText: commentText,
        status: 'limit_reached', createdAt: new Date(), updatedAt: new Date(),
      })
      return
    }

    // ✅ 🆕 Check Meta's hourly (750/hr) budget
    const hourBucket = getHourBucket()
    const hourlyKey = `${igAccountId}_${hourBucket}`
    const hourlyDoc = await db.collection('igHourlyUsage').findOne({ key: hourlyKey })
    const hourlyUsed = hourlyDoc?.count || 0

    if (hourlyUsed >= HOURLY_SEND_LIMIT) {
      // ✅ Budget exhausted — cannot send immediately, put in queue (createdAt will be used for FIFO)
      await db.collection('igDmQueue').insertOne({
        igAccountId, senderId, ruleId,
        dmMessage: matchedRule.dmMessage,
        sourceType: 'comment',
        commentId,
        recipientRef: { comment_id: commentId },
        status: 'pending',
        createdAt: new Date(),
      })
      await db.collection('automationLogs').insertOne({
        commentId, sourceType: 'comment', accountId: igAccountId, postId: postId || null,
        senderId, keyword: matchedRule.keyword, matchedText: commentText,
        status: 'queued', createdAt: new Date(), updatedAt: new Date(),
      })
      console.log(`Hourly limit reached — comment ${commentId} queued for later`)
      return
    }

    // ⚠️ FIX: Removed 'v23.0' — graph.instagram.com (Instagram Login API)
    // expects unversioned calls, otherwise Meta gives a misleading error
    // like "Unsupported request".
    const sendResult = await fetch(
      `https://graph.instagram.com/${igAccountId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text: matchedRule.dmMessage },
          access_token: account.accessToken,
        }),
      }
    )

    const status = sendResult.ok ? 'sent' : 'failed'
    if (!sendResult.ok) {
      console.error('Failed to send Instagram private reply:', await sendResult.text())
    } else {
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
    }

    await db.collection('automationLogs').insertOne({
      commentId, sourceType: 'comment', accountId: igAccountId, postId: postId || null,
      senderId, keyword: matchedRule.keyword, matchedText: commentText, status,
      createdAt: new Date(), updatedAt: new Date(),
    })
  })
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

    const ruleId = matchedRule._id.toString()
    const dateStr = getISTDateString()
    const dailyKey = `${senderId}_${ruleId}_${dateStr}`

    const rl = await db.collection('dmRateLimits').findOne({ key: dailyKey })
    const dailyCount = rl?.count || 0

    if (dailyCount >= DAILY_DM_LIMIT_PER_USER_PER_RULE) {
      await db.collection('automationLogs').insertOne({
        commentId: messageId, sourceType: 'dm', accountId: igAccountId, postId: matchedRule.postId || null,
        senderId, keyword: matchedRule.keyword, matchedText: messageText,
        status: 'limit_reached', createdAt: new Date(), updatedAt: new Date(),
      })
      return
    }

    const hourBucket = getHourBucket()
    const hourlyKey = `${igAccountId}_${hourBucket}`
    const hourlyDoc = await db.collection('igHourlyUsage').findOne({ key: hourlyKey })
    const hourlyUsed = hourlyDoc?.count || 0

    if (hourlyUsed >= HOURLY_SEND_LIMIT) {
      await db.collection('igDmQueue').insertOne({
        igAccountId, senderId, ruleId,
        dmMessage: matchedRule.dmMessage,
        sourceType: 'dm',
        commentId: messageId,
        recipientRef: { id: senderId },
        status: 'pending',
        createdAt: new Date(),
      })
      await db.collection('automationLogs').insertOne({
        commentId: messageId, sourceType: 'dm', accountId: igAccountId, postId: matchedRule.postId || null,
        senderId, keyword: matchedRule.keyword, matchedText: messageText,
        status: 'queued', createdAt: new Date(), updatedAt: new Date(),
      })
      return
    }

    // ⚠️ FIX: Removed 'v23.0' here too — same reason
    const sendResult = await fetch(
      `https://graph.instagram.com/${igAccountId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: matchedRule.dmMessage },
          access_token: account.accessToken,
        }),
      }
    )

    const status = sendResult.ok ? 'sent' : 'failed'
    if (!sendResult.ok) {
      console.error('Failed to send Instagram DM reply:', await sendResult.text())
    } else {
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
    }

    await db.collection('automationLogs').insertOne({
      commentId: messageId, sourceType: 'dm', accountId: igAccountId, postId: matchedRule.postId || null,
      senderId, keyword: matchedRule.keyword, matchedText: messageText, status,
      createdAt: new Date(), updatedAt: new Date(),
    })
  })
}

// ============================================================
// ✅ 🆕 INTERNAL ROUTE — for queue chain continuation.
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