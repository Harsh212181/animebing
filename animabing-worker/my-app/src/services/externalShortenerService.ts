import { Env } from '../index'

interface MultiShortenResult {
  'Cuty.io': string | null
  'Shrinkme': string | null
  'Gplinks': string | null
  'Linkjust.com': string | null
  'Link 5': string
}

// ?l= tag ka signature: bina isake koi l badal ke zyada rate nahi le sakta
export async function signTag(secret: string, slug: string, l: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${slug}:${l}`))
  return [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

export async function shortenWithAllProviders(url: string, env: Env): Promise<MultiShortenResult> {
  // url = https://animebing.in/download/<slug> — slug nikalo (signature isi se bandhta hai)
  const slug = (() => {
    try { return new URL(url).pathname.split('/').filter(Boolean).pop() || '' }
    catch { return '' }
  })()

  // Har provider ke liye alag ?l= tag + signature (1=Cuty, 2=Shrinkme, 3=Linkjust, 4=Gplinks)
  const tag = async (n: number) =>
    `${url}${url.includes('?') ? '&' : '?'}l=${n}&ls=${await signTag(env.JWT_SECRET, slug, n)}`

  const [t1, t2, t3, t4] = await Promise.all([tag(1), tag(2), tag(3), tag(4)])

  const [cuty, shrinkme, gplinks, linkjust] = await Promise.all([
    fetch(`https://api.cuty.io/quick?token=${env.CUTY_API_KEY}&url=${encodeURIComponent(t1)}&format=text`)
      .then(r => r.text())
      .then(t => (t && t.trim().startsWith('http')) ? t.trim() : null)
      .catch(() => null),

    fetch(`https://shrinkme.io/api?api=${env.SHRINKME_API_KEY}&url=${encodeURIComponent(t2)}`)
      .then(r => r.json())
      .then((d: any) => d.shortenedUrl || null)
      .catch(() => null),

    fetch(`https://api.gplinks.com/api?api=${env.GPLINKS_API_KEY}&url=${encodeURIComponent(t4)}`)
      .then(r => r.json())
      .then((d: any) => d.shortenedUrl || null)
      .catch(() => null),

    fetch(`https://linkjust.com/api?api=${env.LINKJUST_API_KEY}&url=${encodeURIComponent(t3)}`)
      .then(r => r.json())
      .then((d: any) => d.shortenedUrl || null)
      .catch(() => null),
  ])

  return {
    'Cuty.io': cuty,
    'Shrinkme': shrinkme,
    'Gplinks': gplinks,
    'Linkjust.com': linkjust,
    'Link 5': url, // direct, no shortening, no tag
  }
}

// ─── Bundle signing helpers (sub-admin link integrity) ─────────────────────

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// 5 links ki list + admin id se bandha token (12 ghante valid)
export async function signBundle(secret: string, adminId: string, urls: string[]): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600
  const sig = await hmacHex(secret, `bundle|${adminId}|${exp}|${urls.join('|')}`)
  return `${exp}.${sig}`
}

export async function verifyBundle(secret: string, adminId: string, urls: string[], token: string): Promise<boolean> {
  const [expStr, sig] = (token || '').split('.')
  const exp = parseInt(expStr, 10)
  if (!exp || !sig || Date.now() / 1000 > exp) return false
  return sig === await hmacHex(secret, `bundle|${adminId}|${exp}|${urls.join('|')}`)
}

// Do downloadLinks arrays ke sirf URLs compare karo (order-preserving).
// Agar same hain → token dobara maangne ki zarurat nahi (title edit case).
export function sameUrls(a: any, b: any): boolean {
  const arrA = Array.isArray(a) ? a : []
  const arrB = Array.isArray(b) ? b : []
  if (arrA.length !== arrB.length) return false
  for (let i = 0; i < arrA.length; i++) {
    if ((arrA[i]?.url || '') !== (arrB[i]?.url || '')) return false
  }
  return true
}

// Sub-admin ke episode/chapter save par lagao. null = OK, string = error message
export async function guardSubAdminLinks(
  admin: any, secret: string, downloadLinks: any, genToken: any
): Promise<string | null> {
  if (admin?.role !== 'subadmin') return null
  if (!Array.isArray(downloadLinks) || downloadLinks.length !== 5) {
    return 'Sub-admin ko saare 5 links (Auto-Generate se) add karne honge, single link nahi.'
  }
  const ok = await verifyBundle(secret, admin.id, downloadLinks.map((l: any) => l?.url || ''), String(genToken || ''))
  return ok ? null : 'Links Auto-Generate se bane hone chahiye (token invalid ya expire).'
}