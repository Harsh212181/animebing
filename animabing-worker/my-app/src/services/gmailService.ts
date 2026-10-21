// src/services/gmailService.ts
// Gmail API (OAuth2 refresh-token) helpers for Cloudflare Workers.
// Self-contained: refresh tokens are encrypted with AES-GCM using a key derived
// from env.ENCRYPTION_KEY (SHA-256), so it works whatever format that secret has.

import type { Env } from '../index'

const enc = new TextEncoder()
const dec = new TextDecoder()

export const GMAIL_SCOPE = 'openid email https://www.googleapis.com/auth/gmail.send'

// ───────────── base64 helpers ─────────────
function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  let b = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  const bin = atob(b)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ───────────── refresh-token encryption ─────────────
async function aesKey(env: Env): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(env.ENCRYPTION_KEY))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptToken(env: Env, plain: string): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(plain))
  return { encrypted: toBase64Url(new Uint8Array(ct)), iv: toBase64Url(iv) }
}

export async function decryptToken(env: Env, encrypted: string, iv: string): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) as BufferSource },
    await aesKey(env),
    fromBase64Url(encrypted) as BufferSource
  )
  return dec.decode(pt)
}

// ───────────── signed OAuth state (CSRF protection) ─────────────
async function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signState(env: Env, adminId: string): Promise<string> {
  const payload = toBase64Url(enc.encode(JSON.stringify({ a: adminId, exp: Date.now() + 10 * 60 * 1000, n: crypto.randomUUID() })))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`
}

export async function verifyState(env: Env, state: string): Promise<{ a: string } | null> {
  try {
    const [payload, sig] = state.split('.')
    if (!payload || !sig) return null
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromBase64Url(sig) as BufferSource, enc.encode(payload))
    if (!ok) return null
    const data = JSON.parse(dec.decode(fromBase64Url(payload)))
    if (!data.exp || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

// ───────────── Google OAuth ─────────────
export function buildAuthUrl(env: Env, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',   // refresh token chahiye
    prompt: 'consent select_account', // har baar refresh token + account chooser
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

export async function exchangeCode(env: Env, code: string, redirectUri: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data: any = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed')
  return data as { access_token: string; refresh_token?: string; id_token: string }
}

export function emailFromIdToken(idToken: string): string {
  const claims = JSON.parse(dec.decode(fromBase64Url(idToken.split('.')[1])))
  if (!claims.email) throw new Error('Google did not return an email address')
  return String(claims.email).toLowerCase()
}

/** Refresh token -> short-lived access token. Throws err.code = 'invalid_grant' if the token was revoked/expired. */
export async function getAccessToken(env: Env, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data: any = await res.json()
  if (!res.ok) {
    const err: any = new Error(data.error_description || data.error || 'Token refresh failed')
    err.code = data.error
    throw err
  }
  return data.access_token as string
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    })
  } catch { /* best effort */ }
}

// ───────────── Send mail ─────────────
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim() // header-injection guard
const encodeWord = (s: string) => `=?UTF-8?B?${toBase64(enc.encode(clean(s)))}?=`

export async function sendGmail(
  accessToken: string,
  opts: { from: string; fromName?: string; to: string; subject: string; text: string; replyTo?: string }
): Promise<string> {
  const headers = [
    `From: ${opts.fromName ? `${encodeWord(opts.fromName)} ` : ''}<${clean(opts.from)}>`,
    `To: ${clean(opts.to)}`,
    ...(opts.replyTo ? [`Reply-To: ${clean(opts.replyTo)}`] : []),
    `Subject: ${encodeWord(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ]
  const body = (toBase64(enc.encode(opts.text)).match(/.{1,76}/g) || []).join('\r\n')
  const raw = toBase64Url(enc.encode(`${headers.join('\r\n')}\r\n\r\n${body}`))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Gmail API error ${res.status}`)
  return data.id as string
}