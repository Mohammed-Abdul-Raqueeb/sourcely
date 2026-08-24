import 'server-only'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Where processed images live.
 *
 * A driver seam with one implementation, for the same reason the repositories
 * have one: the call site should not change when this becomes S3.
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

let storage: UploadStorage | null = null

export function getUploadStorage(): UploadStorage {
  storage ??= new LocalUploadStorage()
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
