import type { NextRequest } from 'next/server'
import { getUploadStorage, isValidKey } from '@/server/uploads/storage'

/**
 * Serves uploaded product images.
 *
 * Public and unauthenticated, because product photography is public. What it
 * must not be is a file server: the key is matched against the exact pattern
 * the storage layer generates, so it can only ever name something this system
 * wrote, and never a path.
 */

/** A year. The key is a hash of the content, so the URL changes when the bytes do. */
const CACHE = 'public, max-age=31536000, immutable'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params
  const key = segments.join('/')

  if (!isValidKey(key)) {
    return new Response('Not found', { status: 404 })
  }

  const data = await getUploadStorage().get(key)
  if (!data) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(data), {
    headers: {
      // Stated, never inferred. Everything stored is re-encoded to WebP by
      // the upload pipeline, so this is a fact about the bytes rather than a
      // guess from the filename.
      'Content-Type': 'image/webp',
      'Content-Length': String(data.length),
      'Cache-Control': CACHE,
      'X-Content-Type-Options': 'nosniff',
      // Belt and braces against a future format being served from here: even
      // if something scriptable landed in the store, it could not execute.
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
