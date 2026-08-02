import { Env } from '../index'

interface MultiShortenResult {
  'Cuty.io': string | null
  'Shrinkme': string | null
  'Gplinks': string | null
  'Linkjust.com': string | null
  'Link 5': string
}

export async function shortenWithAllProviders(url: string, env: Env): Promise<MultiShortenResult> {
  const [cuty, shrinkme, gplinks, linkjust] = await Promise.all([
    fetch(`https://api.cuty.io/quick?token=${env.CUTY_API_KEY}&url=${encodeURIComponent(url)}&format=text`)
      .then(r => r.text())
      .then(t => (t && t.trim().startsWith('http')) ? t.trim() : null)
      .catch(() => null),

    fetch(`https://shrinkme.io/api?api=${env.SHRINKME_API_KEY}&url=${encodeURIComponent(url)}`)
      .then(r => r.json()).then((d: any) => d.shortenedUrl || null).catch(() => null),

    fetch(`https://api.gplinks.com/api?api=${env.GPLINKS_API_KEY}&url=${encodeURIComponent(url)}`)
      .then(r => r.json()).then((d: any) => d.shortenedUrl || null).catch(() => null),

    fetch(`https://linkjust.com/api?api=${env.LINKJUST_API_KEY}&url=${encodeURIComponent(url)}`)
      .then(r => r.json()).then((d: any) => d.shortenedUrl || null).catch(() => null),
  ])

  return {
    'Cuty.io': cuty,
    'Shrinkme': shrinkme,
    'Gplinks': gplinks,
    'Linkjust.com': linkjust,
    'Link 5': url, // direct, no shortening
  }
}