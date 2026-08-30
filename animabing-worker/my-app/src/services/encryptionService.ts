async function getKey(base64Secret: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Secret), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string, envSecret: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey(envSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decryptSecret(ciphertext: string, iv: string, envSecret: string): Promise<string> {
  const key = await getKey(envSecret)
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const cipherBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes)
  return new TextDecoder().decode(plainBuf)
}