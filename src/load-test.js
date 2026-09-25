// load-test.js
// ============================================================================
// Ye script k6 (https://k6.io) ke saath chalta hai — ek free, open-source
// load-testing tool. Isse pata chalega ki tumhara actual server kitne
// concurrent users pe struggle karna shuru karta hai.
//
// ✅ INSTALL (ek baar):
//   Mac:     brew install k6
//   Windows: winget install k6 --source winget   (ya choco install k6)
//   Linux:   sudo apt install k6  (ya https://k6.io/docs/get-started/installation/ dekho)
//
// ✅ RUN:
//   k6 run load-test.js
//
// ✅ BASE_URL apna daalo (neeche env var se ya seedha edit karke):
//   k6 run -e BASE_URL=https://your-worker.workers.dev load-test.js
// ============================================================================

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'https://animabing-backend.animabingwatch.workers.dev'

// ✅ Custom metrics — inse pata chalega ki KAUNSA route sabse pehle toot raha hai
const errorRate = new Rate('errors')
const homepageLatency = new Trend('homepage_latency')
const animeDetailLatency = new Trend('anime_detail_latency')
const downloadPageLatency = new Trend('download_page_latency')
const pageviewLatency = new Trend('pageview_latency')

// ============================================================================
// ✅ STAGES — dheere dheere load badhao, ek dum spike mat karo.
// Ye "ramping" pattern hai: 30 sec me 10 tak jao, phir 1 min tak wahi rakho,
// phir 30 tak badhao, phir 60, phir 100 — jahan bhi errors badhna shuru
// hon, wahi tumhari "safe capacity" ke aas paas hai.
//
// ⚠️ Pehli baar chalao to conservative stages se shuru karo (neeche wale),
// production ko achanak 100+ users se mat maaro. Dheere dheere upar badhao.
// ============================================================================
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warm-up
    { duration: '1m', target: 10 },    // baseline — yahan sab kuch fast hona chahiye
    { duration: '30s', target: 30 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 60 },
    { duration: '1m', target: 60 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },    // cool-down
  ],
  thresholds: {
    // Agar 95% requests 2 second se zyada lein, ya 5% se zyada fail hon,
    // to k6 test ko "failed" mark karega — tumhe turant pata chal jayega.
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.05'],
  },
}

// ✅ Real anime detail slugs (animebing.in/detail/... se liye gaye)
const SAMPLE_ANIME_SLUGS = [
  'the-extras-academy-survival-guide-manhwa-explation',
  'the-necromancer-familys-young-heir',
]

// ✅ Real download-page slugs (animebing.in/download/... se liye gaye)
const SAMPLE_DOWNLOAD_SLUGS = [
  'takopis-original-sin-jhfiurt83y4u3',
  'mob-psycho-100-season-2-hindi-dub-bsdhfbw',
  'welcome-to-demon-school-iruma-kun-season-2-hindi-dub-bkhsbkcv',
]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function () {
  // 1) Homepage — sabse zyada traffic yahan aata hai
  let res = http.get(`${BASE_URL}/api/anime?page=1&limit=24`)
  homepageLatency.add(res.timings.duration)
  check(res, { 'homepage: status 200': (r) => r.status === 200 }) || errorRate.add(1)
  sleep(0.5)

  // 2) Featured anime
  res = http.get(`${BASE_URL}/api/anime/featured`)
  check(res, { 'featured: status 200': (r) => r.status === 200 }) || errorRate.add(1)
  sleep(0.3)

  // 3) Anime detail page (real user browsing pattern)
  const slug = randomFrom(SAMPLE_ANIME_SLUGS)
  res = http.get(`${BASE_URL}/api/anime/slug/${slug}`)
  animeDetailLatency.add(res.timings.duration)
  check(res, { 'anime detail: status 200 or 404': (r) => r.status === 200 || r.status === 404 }) || errorRate.add(1)
  sleep(1) // user "reads" the page

  // 4) Pageview tracking (fires on every real page load)
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
  pageviewLatency.add(res.timings.duration)
  check(res, { 'pageview: status 200': (r) => r.status === 200 }) || errorRate.add(1)
  sleep(0.3)

  // 5) Download page (highest-connection-count route before your fixes)
  const dlSlug = randomFrom(SAMPLE_DOWNLOAD_SLUGS)
  res = http.get(`${BASE_URL}/api/download-pages/${dlSlug}`)
  downloadPageLatency.add(res.timings.duration)
  check(res, { 'download page: status 200 or 404': (r) => r.status === 200 || r.status === 404 }) || errorRate.add(1)
  sleep(1)
}