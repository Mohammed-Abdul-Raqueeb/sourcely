import 'server-only'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobNotFoundError, head, put } from '@vercel/blob'

/**
 * Where processed images live.
 *
 * A driver seam with two implementations, chosen the same way the data
 * repositories choose theirs:
 *
 *   local  files under UPLOAD_DIR, served by streaming through the media
 *          route. Zero infrastructure; correct wherever the filesystem is
 *          durable (development, a host with a mounted volume).
 *   blob   Vercel Blob object storage, served by redirecting the media route
 *          to the store's CDN URL. Required on serverless hosts, where the
 *          function filesystem is ephemeral and per-instance.
 *
 * The local driver writes outside `public/`. Writing into `public/` looks
 * simpler and is wrong on three counts — Next only serves files that existed at
 * build time, a serverless filesystem is ephemeral and per-instance, and
 * anything landing in `public/` is served with whatever content type is
 * inferred from its name. Files here are served by a route handler that sets
 * the type from what the re-encode actually produced.
 */

export interface StoredObject {
  /** Opaque key: `ab/cd/abcdef…webp`. Never contains user input. */
  key: string
  bytes: number
}

export interface UploadStorage {
  put(data: Buffer, extension: string): Promise<StoredObject>
  get(key: string): Promise<Buffer | null>
  /**
   * The URL a browser should fetch this key from, when the store serves its
   * own traffic (a CDN-backed object store). Absent on the local driver, which
   * has no public surface — the media route streams the bytes instead.
   */
  publicUrl?(key: string): Promise<string | null>
}

function uploadRoot(): string {
  // Resolved per call rather than at module load: the test harness sets this
  // after import, and an env var read at import time is read too early.
  return path.resolve(process.env.UPLOAD_DIR ?? '.data/uploads')
}

/**
 * Content-addressed: the key is a hash of the bytes.
 *
 * Two useful consequences. Uploading the same image twice costs one file
 * rather than two, and the key carries no user-controlled text at all — which
 * removes path traversal as a category rather than as a check.
 */
function keyFor(data: Buffer, extension: string): string {
  const digest = createHash('sha256').update(data).digest('hex')
  // Two levels of fan-out. A single directory holding a hundred thousand files
  // is slow to list on every filesystem worth naming.
  return `${digest.slice(0, 2)}/${digest.slice(2, 4)}/${digest.slice(4, 40)}.${extension}`
}

/** Rejects any key that is not exactly the shape `put()` produces. */
export function isValidKey(key: string): boolean {
  return /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{36}\.(jpe?g|png|webp|avif)$/.test(key)
}

class LocalUploadStorage implements UploadStorage {
  async put(data: Buffer, extension: string): Promise<StoredObject> {
    const key = keyFor(data, extension)
    const target = path.join(uploadRoot(), key)

    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)

    return { key, bytes: data.length }
  }

  async get(key: string): Promise<Buffer | null> {
    if (!isValidKey(key)) return null

    // Belt and braces. The key is already validated against a strict pattern,
    // but a containment check costs nothing and would survive that pattern
    // being loosened by someone who did not know why it was strict.
    const root = uploadRoot()
    const target = path.resolve(root, key)
    if (!target.startsWith(root + path.sep)) return null

    try {
      return await readFile(target)
    } catch {
      return null
    }
  }
}

/**
 * Blob pathnames are namespaced under a prefix so the store can hold anything
 * else later without colliding with the content-addressed tree.
 */
const BLOB_PREFIX = 'uploads/'

/** Stated at write time so the store never has to infer a type from a name. */
const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
}

class BlobUploadStorage implements UploadStorage {
  /**
   * key → public URL, resolved at most once per process. Safe to cache
   * indefinitely: the key is a hash of the bytes, so a key can never come to
   * mean different content.
   */
  private readonly urls = new Map<string, string>()

  async put(data: Buffer, extension: string): Promise<StoredObject> {
    const key = keyFor(data, extension)
    const blob = await put(BLOB_PREFIX + key, data, {
      access: 'public',
      contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
      // The key is a hash of the bytes, so a repeat upload IS the same object:
      // overwriting is idempotent rather than destructive, and a random suffix
      // would break the deterministic key → URL mapping the media route needs.
      addRandomSuffix: false,
      allowOverwrite: true,
      // Mirrors the immutable year the media route advertises for local files.
      cacheControlMaxAge: 31536000,
    })
    this.urls.set(key, blob.url)
    return { key, bytes: data.length }
  }

  async publicUrl(key: string): Promise<string | null> {
    if (!isValidKey(key)) return null

    const cached = this.urls.get(key)
    if (cached) return cached

    try {
      const blob = await head(BLOB_PREFIX + key)
      this.urls.set(key, blob.url)
      return blob.url
    } catch (error) {
      // A missing blob is an ordinary 404. Anything else — a bad token, a
      // suspended store — is configuration and must surface as the error it
      // is, not dissolve into a soft 404 on every image.
      if (error instanceof BlobNotFoundError) return null
      throw error
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const url = await this.publicUrl(key)
    if (!url) return null

    const response = await fetch(url)
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  }
}

export type UploadDriver = 'local' | 'blob'

/**
 * Explicit `UPLOAD_DRIVER` wins; otherwise the presence of the Blob token
 * selects blob, so connecting a store is the whole configuration.
 */
export function resolveUploadDriver(): UploadDriver {
  const configured = process.env.UPLOAD_DRIVER?.toLowerCase()
  if (configured === 'blob' || configured === 'local') return configured
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local'
}

let storage: UploadStorage | null = null

export function getUploadStorage(): UploadStorage {
  if (storage) return storage

  const driver = resolveUploadDriver()

  if (driver === 'blob' && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'UPLOAD_DRIVER=blob requires BLOB_READ_WRITE_TOKEN. Create a Blob store in the ' +
        'Vercel dashboard (Storage → Blob) and connect it to the project.'
    )
  }

  // A Vercel function may write to /tmp and nowhere else, and even that is
  // gone on the next invocation — let alone the next deploy. Refusing to boot
  // is better than accepting uploads into oblivion.
  if (driver === 'local' && process.env.VERCEL) {
    throw new Error(
      'Uploads cannot use the local filesystem on Vercel — it is ephemeral, so every ' +
        'uploaded image would vanish. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN).'
    )
  }

  storage = driver === 'blob' ? new BlobUploadStorage() : new LocalUploadStorage()
  return storage
}

/** The public URL for a stored key. */
export function mediaUrl(key: string): string {
  return `/api/media/${key}`
}

/** Extracts the storage key from a URL this module produced, or null. */
export function keyFromUrl(url: string): string | null {
  const match = /^\/api\/media\/(.+)$/.exec(url)
  const key = match?.[1]
  return key && isValidKey(key) ? key : null
}
