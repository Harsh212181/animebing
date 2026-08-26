 import type { Env } from '../index'
import { withDb } from './mongoService'
import { HOURLY_SEND_LIMIT } from '../routes/instagramWebhookRoutes'

const DAILY_DM_LIMIT_PER_USER_PER_RULE = 4

// ✅ Ek single invocation me max kitne DM (fetch calls) — 50-subrequest free-tier
// limit se neeche, DB operations ke liye bhi jagah chhodte hue
const MAX_ITEMS_PER_RUN = 25

// ✅ 🆕 Ek "chain" (turant-turant self-trigger) me max kitne hops allowed —
// 8 × 25 = 200 items ek hi trigger ke andar clear ho sakte hain bina 5-min wait ke.
// Isse zyada bacha ho toh agla 5-min cron tick apne aap uthayega — infinite loop se bachne ke liye safety cap.
const MAX_CHAIN_DEPTH = 8

function getISTDateString(date: Date = new Date()): string {
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  return istDate.toISOString().slice(0, 10)
}

function getHourBucket(date: Date = new Date()): string {
  return Math.floor(date.getTime() / (60 * 60 * 1000)).toString()
}

async function countPendingQueueItems(env: Env): Promise<number> {
  return withDb(env.MONGODB_URI, env.MONGODB_DB, 'countPendingQueueItems', async (db) => {
    return db.collection('igDmQueue').countDocuments({ status: 'pending' })
  })
}

// ✅ Ek chunk (max MAX_ITEMS_PER_RUN) process karta hai, FIFO order me
async function processQueueChunk(env: Env): Promise<number> {
  let itemsProcessedThisRun = 0

  await withDb(env.MONGODB_URI, env.MONGODB_DB, 'processQueueChunk', async (db) => {
    const pendingAccountIds: string[] = await db.collection('igDmQueue').distinct('igAccountId', { status: 'pending' })

    for (const igAccountId of pendingAccountIds) {
      if (itemsProcessedThisRun >= MAX_ITEMS_PER_RUN) break

      const hourBucket = getHourBucket()
      const hourlyKey = `${igAccountId}_${hourBucket}`
      const hourlyDoc = await db.collection('igHourlyUsage').findOne({ key: hourlyKey })
      let hourlyUsed = hourlyDoc?.count || 0

      const hourlyRemaining = HOURLY_SEND_LIMIT - hourlyUsed
      if (hourlyRemaining <= 0) continue

      const runBudgetLeft = MAX_ITEMS_PER_RUN - itemsProcessedThisRun
      const takeCount = Math.min(hourlyRemaining, runBudgetLeft)
      if (takeCount <= 0) continue

      const account = await db.collection('instagramAccounts').findOne({ igUserId: igAccountId, isActive: true })
      if (!account) continue

      const queueItems = await db.collection('igDmQueue')
        .find({ igAccountId, status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(takeCount)
        .toArray()

      for (const item of queueItems) {
        if (itemsProcessedThisRun >= MAX_ITEMS_PER_RUN) break

        const dateStr = getISTDateString()
        const dailyKey = `${item.senderId}_${item.ruleId}_${dateStr}`
        const rl = await db.collection('dmRateLimits').findOne({ key: dailyKey })
        const dailyCount = rl?.count || 0

        if (dailyCount >= DAILY_DM_LIMIT_PER_USER_PER_RULE) {
          await db.collection('igDmQueue').updateOne({ _id: item._id }, { $set: { status: 'skipped_limit' } })
          await db.collection('automationLogs').updateOne(
            { commentId: item.commentId, sourceType: item.sourceType },
            { $set: { status: 'limit_reached' } }
          )
          itemsProcessedThisRun += 1
          continue
        }

        const sendResult = await fetch(
          `https://graph.instagram.com/v23.0/${igAccountId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: item.recipientRef,
              message: { text: item.dmMessage },
              access_token: account.accessToken,
            }),
          }
        )

        const sentStatus = sendResult.ok ? 'sent' : 'failed'
        if (!sendResult.ok) {
          console.error('Queue: failed to send DM:', await sendResult.text())
        } else {
          await db.collection('dmRateLimits').updateOne(
            { key: dailyKey },
            { $set: { senderId: item.senderId, ruleId: item.ruleId, date: dateStr }, $inc: { count: 1 } },
            { upsert: true }
          )
          await db.collection('igHourlyUsage').updateOne(
            { key: hourlyKey },
            { $set: { igAccountId, bucket: hourBucket }, $inc: { count: 1 } },
            { upsert: true }
          )
          hourlyUsed += 1
        }

        await db.collection('igDmQueue').updateOne({ _id: item._id }, { $set: { status: sentStatus } })
        await db.collection('automationLogs').updateOne(
          { commentId: item.commentId, sourceType: item.sourceType },
          { $set: { status: sentStatus } }
        )

        itemsProcessedThisRun += 1
        console.log(`Queue: ${sentStatus} DM to ${item.senderId} (rule ${item.ruleId})`)
      }
    }
  })

  return itemsProcessedThisRun
}

// ============================================================
// ✅ 🆕 CHAIN ORCHESTRATOR
// Ek chunk process karo, phir check karo kitna bacha — agar bacha hai
// aur chain-depth limit ke andar hai, toh TURANT khud ko naye HTTP
// request se trigger karo (naya invocation = fresh 50-subrequest budget).
// Isse 5 minute wait kiye bina backlog fast clear hota hai.
// ============================================================
export async function runQueueChain(env: Env, chainDepth: number = 0): Promise<void> {
  const remainingBefore = await countPendingQueueItems(env)
  if (remainingBefore === 0) {
    return // kuch pending hi nahi — kuch nahi karna
  }

  const processed = await processQueueChunk(env)
  console.log(`Queue chunk done (depth=${chainDepth}): ${processed} item(s) processed`)

  const remainingAfter = await countPendingQueueItems(env)

  if (remainingAfter > 0 && chainDepth < MAX_CHAIN_DEPTH) {
    // ✅ Turant agla chunk trigger karo — naye invocation ke roop me
    try {
      const res = await fetch(
        `${env.API_URL}/internal/instagram-dm-queue/continue?chain=${chainDepth + 1}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': env.JWT_SECRET,
          },
        }
      )
      if (!res.ok) {
        console.error('Chain continuation trigger failed, status:', res.status)
      }
    } catch (err) {
      console.error('Failed to trigger next queue chunk:', err)
    }
  } else if (remainingAfter > 0) {
    console.log(`Chain depth limit (${MAX_CHAIN_DEPTH}) reached — baaki ${remainingAfter} item(s) agle 5-min cron tick me chalenge`)
  }
}