 import { Hono } from 'hono'
import type { Env, Variables } from '../index'
import { insertOne, findMany } from '../services/mongoService'

const instagramWebhookRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ============ WEBHOOK VERIFICATION ============
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

// ============ WEBHOOK EVENTS (comments, messages) ============
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
      const igAccountId = entry.id // 👈 ye webhook receive karne wale IG business account ka ID hai
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          await handleCommentEvent(change.value, igAccountId, env)
        }
      }
    }
  } catch (err) {
    console.error('Instagram webhook processing failed', err)
  }
}

async function handleCommentEvent(value: any, igAccountId: string, env: Env) {
  const commentId: string = value.id
  const commentText: string = (value.text || '').toLowerCase().trim()
  const senderId: string = value.from?.id
  const postId: string | undefined = value.media?.id || value.media_id

  if (!commentId || !senderId || !igAccountId) {
    console.log('Missing commentId/senderId/igAccountId — skipping', { commentId, senderId, igAccountId })
    return
  }

  // ✅ Apna hi comment ignore karo
  if (senderId === igAccountId) return

  // 👇 DB se connected account nikaalo — static env var ki jagah
  const accounts = await findMany<any>(
    'instagramAccounts',
    { igUserId: igAccountId, isActive: true },
    { limit: 1 },
    env.MONGODB_URI, env.MONGODB_DB
  )
  const account = accounts[0]
  if (!account) {
    console.log(`Comment aaya IG ID ${igAccountId} par, lekin koi active connected account nahi mila`)
    return
  }

  // ✅ Dedupe
  const alreadyProcessed = await findMany<any>(
    'automationLogs', { commentId }, { limit: 1 }, env.MONGODB_URI, env.MONGODB_DB
  )
  if (alreadyProcessed.length > 0) {
    console.log(`Comment ${commentId} already processed — skipping`)
    return
  }

  // ✅ Sab active rules is account ke
  const allRules = await findMany<any>(
    'automationRules',
    { accountId: igAccountId, isActive: true },
    {},
    env.MONGODB_URI, env.MONGODB_DB
  )

  const postRules = allRules.filter((r: any) => r.postId && r.postId === postId)
  const accountWideRules = allRules.filter((r: any) => !r.postId)
  const candidateRules = [...postRules, ...accountWideRules]

  const matchedRule = candidateRules.find((rule: any) => {
    const keyword = (rule.keyword || '').toLowerCase().trim()
    if (!keyword) return false
    return rule.matchType === 'exact'
      ? commentText === keyword
      : commentText.includes(keyword)
  })

  if (!matchedRule) {
    console.log(`No matching rule for comment: "${commentText}" on account ${igAccountId}`)
    return
  }

  // ✅ Private reply bhejo — DB ka token use karo
  const sendResult = await fetch(
    `https://graph.instagram.com/v23.0/${igAccountId}/messages`,
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
    const errText = await sendResult.text()
    console.error('Failed to send Instagram private reply:', errText)
  }

  await insertOne('automationLogs', {
    commentId,
    accountId: igAccountId,
    postId: postId || null,
    senderId,
    keyword: matchedRule.keyword,
    matchedText: commentText,
    status,
    createdAt: new Date(),
  }, env.MONGODB_URI, env.MONGODB_DB)
}

export default instagramWebhookRoutes