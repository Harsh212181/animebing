 import { AwsClient } from 'aws4fetch'

interface Creds {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

function getClient(creds: Creds) {
  return new AwsClient({ accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey })
}

function objectEndpoint(creds: Creds, key: string) {
  return `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucketName}/${encodeURIComponent(key)}`
}

export async function initiateMultipartUpload(creds: Creds, key: string): Promise<string> {
  const client = getClient(creds)
  const url = `${objectEndpoint(creds, key)}?uploads`
  const res = await client.fetch(url, { method: 'POST' })
  if (!res.ok) throw new Error(`Initiate failed: ${res.status} ${await res.text()}`)
  const xml = await res.text()
  const match = /<UploadId>(.*?)<\/UploadId>/.exec(xml)
  if (!match) throw new Error('UploadId not found in response')
  return match[1]
}

export async function generatePartUploadUrl(
  creds: Creds, key: string, uploadId: string, partNumber: number
): Promise<string> {
  const client = getClient(creds)
  const url = new URL(objectEndpoint(creds, key))
  url.searchParams.set('partNumber', partNumber.toString())
  url.searchParams.set('uploadId', uploadId)
  const signed = await client.sign(url.toString(), { method: 'PUT', aws: { signQuery: true } })
  return signed.url
}

export async function completeMultipartUpload(
  creds: Creds, key: string, uploadId: string, parts: { partNumber: number; eTag: string }[]
): Promise<void> {
  const client = getClient(creds)
  const url = `${objectEndpoint(creds, key)}?uploadId=${uploadId}`
  const partsXml = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.eTag}</ETag></Part>`)
    .join('')
  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`
  const res = await client.fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/xml' } })
  if (!res.ok) throw new Error(`Complete failed: ${res.status} ${await res.text()}`)
}

export async function abortMultipartUpload(creds: Creds, key: string, uploadId: string): Promise<void> {
  const client = getClient(creds)
  const url = `${objectEndpoint(creds, key)}?uploadId=${uploadId}`
  await client.fetch(url, { method: 'DELETE' })
}

export interface R2ObjectSummary {
  key: string
  size: number
  lastModified: string
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export async function listBucketObjects(creds: Creds): Promise<R2ObjectSummary[]> {
  const client = getClient(creds)
  const results: R2ObjectSummary[] = []
  let continuationToken: string | undefined = undefined

  do {
    const url = new URL(`https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucketName}`)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('max-keys', '1000')
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken)

    const res = await client.fetch(url.toString(), { method: 'GET' })
    if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`)
    const xml = await res.text()

    const contentsBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []
    for (const block of contentsBlocks) {
      const keyMatch = /<Key>(.*?)<\/Key>/.exec(block)
      const sizeMatch = /<Size>(.*?)<\/Size>/.exec(block)
      const dateMatch = /<LastModified>(.*?)<\/LastModified>/.exec(block)
      if (keyMatch) {
        results.push({
          key: decodeXmlEntities(keyMatch[1]),
          size: sizeMatch ? parseInt(sizeMatch[1]) : 0,
          lastModified: dateMatch ? dateMatch[1] : '',
        })
      }
    }

    const truncatedMatch = /<IsTruncated>(.*?)<\/IsTruncated>/.exec(xml)
    const isTruncated = truncatedMatch?.[1] === 'true'
    const tokenMatch = /<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(xml)
    continuationToken = isTruncated ? tokenMatch?.[1] : undefined
  } while (continuationToken)

  return results
}

export async function deleteObject(creds: Creds, key: string): Promise<void> {
  const client = getClient(creds)
  const url = objectEndpoint(creds, key)
  const res = await client.fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status} ${await res.text()}`)
}

export async function renameObject(creds: Creds, oldKey: string, newKey: string): Promise<void> {
  const client = getClient(creds)
  const copySource = `/${creds.bucketName}/${encodeURIComponent(oldKey)}`
  const newUrl = objectEndpoint(creds, newKey)
  const res = await client.fetch(newUrl, {
    method: 'PUT',
    headers: { 'x-amz-copy-source': copySource }
  })
  if (!res.ok) throw new Error(`Rename (copy) failed: ${res.status} ${await res.text()}`)
  await deleteObject(creds, oldKey)
}

export async function generateSimplePutUrl(creds: Creds, key: string): Promise<string> {
  const client = getClient(creds)
  const url = objectEndpoint(creds, key)
  const signed = await client.sign(url, { method: 'PUT', aws: { signQuery: true } })
  return signed.url
}

// ✅ NEW: List all buckets for a given R2 account
export async function listBuckets(accountId: string, accessKeyId: string, secretAccessKey: string): Promise<string[]> {
  const client = new AwsClient({ accessKeyId, secretAccessKey })
  const url = `https://${accountId}.r2.cloudflarestorage.com/`
  const res = await client.fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`Bucket list fail ho gayi: ${res.status} ${await res.text()}`)
  const xml = await res.text()
  const nameMatches = [...xml.matchAll(/<Name>(.*?)<\/Name>/g)]
  return nameMatches.map(m => m[1])
}