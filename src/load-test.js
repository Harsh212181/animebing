// load-test.js  (v2 - error codes + sahi error rate + quick mode)
//
// FULL TEST (~7.5 min):
//   k6 run load-test.js
//
// QUICK TEST (60 sec, 60 VUs) - pehle isse chalao:
//   k6 run -e MODE=quick load-test.js
//
// Alag URL:
//   k6 run -e BASE_URL=https://your-worker.workers.dev load-test.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'https://animabing-backend.animabingwatch.workers.dev'
const MODE = __ENV.MODE || 'full'

// ---------- Custom metrics ----------
const errorRate = new Rate('errors')
const homepageLatency = new Trend('homepage_latency')
const featuredLatency = new Trend('featured_latency')
const animeDetailLatency = new Trend('anime_detail_latency')
const downloadPageLatency = new Trend('download_page_latency')
const pageviewLatency = new Trend('pageview_latency')

// Status code counters (status_0 = timeout / connection fail)
const statusCounters = {}
function countStatus(code) {
  const key = `status_${code}`
  if (!statusCounters[key]) statusCounters[key] = new Counter(key)
  statusCounters[key].add(1)
}

// ---------- Stages ----------
const fullStages = [
  { duration: '30s', target: 10 },
  { duration: '1m', target: 10 },
  { duration: '30s', target: 40 },
  { duration: '1m', target: 40 },
  { duration: '30s', target: 70 },
  { duration: '1m', target: 70 },
  { duration: '30s', target: 100 },
  { duration: '2m', target: 100 },
  { duration: '30s', target: 0 },
]

const quickStages = [
  { duration: '10s', target: 60 },
  { duration: '40s', target: 60 },
  { duration: '10s', target: 0 },
]

export const options = {
  stages: MODE === 'quick' ? quickStages : fullStages,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.05'],
  },
}

// ---------- Real slugs ----------
const SAMPLE_ANIME_SLUGS = [
  'the-extras-academy-survival-guide-manhwa-explation',
  'the-necromancer-familys-young-heir',
]

const SAMPLE_DOWNLOAD_SLUGS = [
  'takopis-original-sin-jhfiurt83y4u3',
  'mob-psycho-100-season-2-hindi-dub-bsdhfbw',
  'welcome-to-demon-school-iruma-kun-season-2-hindi-dub-bkhsbkcv',
]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ---------- Helper: check + error log + status count ----------
function track(name, res, okStatuses, latencyTrend) {
  if (latencyTrend) latencyTrend.add(res.timings.duration)
  countStatus(res.status)

  const ok = okStatuses.includes(res.status)
  errorRate.add(ok ? 0 : 1)
  check(res, { [`${name}: status ok`]: () => ok })

  if (!ok && Math.random() < 0.2) { // 20% sample, console spam se bachne ke liye
    console.log(
      `FAIL [${name}] status=${res.status} time=${Math.round(res.timings.duration)}ms ` +
      `err=${res.error || '-'} body=${String(res.body).slice(0, 150)}`
    )
  }
  return ok
}

export default function () {
  // 1) Homepage
  let res = http.get(`${BASE_URL}/api/anime?page=1&limit=24`)
  track('homepage', res, [200], homepageLatency)
  sleep(0.5)

  // 2) Featured
  res = http.get(`${BASE_URL}/api/anime/featured`)
  track('featured', res, [200], featuredLatency)
  sleep(0.3)

  // 3) Anime detail
  const slug = randomFrom(SAMPLE_ANIME_SLUGS)
  res = http.get(`${BASE_URL}/api/anime/slug/${slug}`)
  track('anime_detail', res, [200, 404], animeDetailLatency)
  sleep(1)

  // 4) Pageview
  res = http.post(
    `${BASE_URL}/api/analytics/pageview`,
    JSON.stringify({
      path: `/detail/${slug}`,
      slug,
      pageType: 'anime-detail',
      sessionId: `loadtest-${__VU}-${__ITER}`,
      visitorId: `loadtest-visitor-${__VU}`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  track('pageview', res, [200], pageviewLatency)
  sleep(0.3)

  // 5) Download page
  const dlSlug = randomFrom(SAMPLE_DOWNLOAD_SLUGS)
  res = http.get(`${BASE_URL}/api/download-pages/${dlSlug}`)
  track('download_page', res, [200, 404], downloadPageLatency)
  sleep(1)
}