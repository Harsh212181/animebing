// load-test.js  (v7 - higher load limit-finder, real homepage flow, no DB writes)
//
// QUICK TEST (60 sec, 8 VUs):
//   k6 run -e MODE=quick load-test.js
//
// HIGH LOAD LIMIT-FINDER (~5 min, 20 -> 60 VUs):
//   k6 run load-test.js
//
// Doosre URL pe test karna ho:
//   k6 run -e BASE_URL=https://animebing.in load-test.js

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

// Status code counters (status_0 = timeout / connection fail)
const status200 = new Counter('status_200')
const status404 = new Counter('status_404')
const status429 = new Counter('status_429')
const status500 = new Counter('status_500')
const status502 = new Counter('status_502')
const status503 = new Counter('status_503')
const status504 = new Counter('status_504')
const status0 = new Counter('status_0_timeout')
const statusOther = new Counter('status_other')

function countStatus(code) {
  if (code === 200) status200.add(1)
  else if (code === 404) status404.add(1)
  else if (code === 429) status429.add(1)
  else if (code === 500) status500.add(1)
  else if (code === 502) status502.add(1)
  else if (code === 503) status503.add(1)
  else if (code === 504) status504.add(1)
  else if (code === 0) status0.add(1)
  else statusOther.add(1)
}

// ---------- Stages ----------
const fullStages = [
  { duration: '30s', target: 20 },
  { duration: '60s', target: 20 },
  { duration: '30s', target: 40 },
  { duration: '60s', target: 40 },
  { duration: '30s', target: 60 },
  { duration: '60s', target: 60 },
  { duration: '30s', target: 0 },
]

const quickStages = [
  { duration: '10s', target: 8 },
  { duration: '40s', target: 8 },
  { duration: '10s', target: 0 },
]

export const options = {
  stages: MODE === 'quick' ? quickStages : fullStages,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.05'],
    status_429: [{ threshold: 'count<5', abortOnFail: true }],
    status_0_timeout: [{ threshold: 'count<5', abortOnFail: true }],
  },
}

// ---------- Real slugs (tail se liye gaye) ----------
const SAMPLE_ANIME_SLUGS = [
  'overlord-session-3-hindi-dub',
  'i-was-reincarnation-as-the-7th-prince-session-2',
]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ---------- Helper: check + error log + status count ----------
function track(name, res, okStatuses, latencyTrend) {
  if (latencyTrend) latencyTrend.add(res.timings.duration)
  countStatus(res.status)

  const ok = okStatuses.indexOf(res.status) !== -1
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
  // 1) Homepage: asli site jaisi 6 calls ek saath (parallel)
  const homeResponses = http.batch([
    ['GET', `${BASE_URL}/api/anime/settings/section-visibility`],
    ['GET', `${BASE_URL}/api/anime/featured?section=banner&v=1`],
    ['GET', `${BASE_URL}/api/anime/featured?section=anime&v=1`],
    ['GET', `${BASE_URL}/api/anime/featured?section=movie&v=1`],
    ['GET', `${BASE_URL}/api/anime/featured?section=manga&v=1`],
    ['GET', `${BASE_URL}/api/anime?page=1&limit=36`],
  ])

  track('section_visibility', homeResponses[0], [200], homepageLatency)
  track('featured_banner', homeResponses[1], [200], featuredLatency)
  track('featured_anime', homeResponses[2], [200], featuredLatency)
  track('featured_movie', homeResponses[3], [200], featuredLatency)
  track('featured_manga', homeResponses[4], [200], featuredLatency)
  track('anime_list', homeResponses[5], [200], homepageLatency)

  sleep(3) // user homepage dekhta hai

  // 2) Anime detail page
  const slug = randomFrom(SAMPLE_ANIME_SLUGS)
  const res = http.get(`${BASE_URL}/api/anime/${slug}`)
  track('anime_detail', res, [200], animeDetailLatency)

  sleep(3) // user detail page padhta hai
}