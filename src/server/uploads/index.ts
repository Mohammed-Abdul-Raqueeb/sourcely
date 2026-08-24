import 'server-only'
import sharp from 'sharp'
import type { ProductImage } from '@/lib/domain/catalog'
import { getUploadStorage, mediaUrl } from './storage'
import { MAX_DIMENSION } from '@/lib/uploads'
import { validateImageUpload } from './validate'

export { MAX_DIMENSION, MAX_UPLOAD_BYTES } from '@/lib/uploads'
export { mediaUrl, keyFromUrl, isValidKey } from './storage'

/**
 * Product image ingestion.
 *
 * The re-encode is the security control, not the resize. Decoding an image and
 * writing a fresh one from the decoded pixels means:
 *
 *   - A polyglot file — valid JPEG header, PHP or JavaScript in a comment
 *     segment — loses everything that was not pixel data.
 *   - EXIF goes, which routinely carries GPS coordinates and a camera serial
 *     number that a supplier did not intend to publish.
 *   - The output is a format we chose, so the byte stream we serve is one this
 *     process produced rather than one an uploader supplied.
 *
 * Everything is normalised to WebP: roughly a third smaller than equivalent
 * JPEG, supported by every browser this product targets, and having exactly
 * one output format means the serving path has one content type to reason
 * about.
 */

/** Long edge of the stored image. Beyond this is detail no product page shows. */
const TARGET_LONG_EDGE = 1_600

/** The blur placeholder Next renders while the real image loads. */
const BLUR_EDGE = 12

export interface UploadOutcome {
  ok: boolean
  image?: ProductImage
  reason?: string
}

export async function storeProductImage(file: unknown, alt: string): Promise<UploadOutcome> {
  const validated = await validateImageUpload(file)
  if (!validated.ok) return { ok: false, reason: validated.reason }

  try {
    // `limitInputPixels` is the guard against a decompression bomb: a 100 KB
    // PNG can declare 50000×50000 and cost gigabytes to decode. sharp throws
    // rather than allocating.
    const pipeline = sharp(validated.bytes, {
      limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
      // A malformed file should fail here, not produce a half-decoded image.
      failOn: 'error',
    })

    const metadata = await pipeline.metadata()
    if (!metadata.width || !metadata.height) {
      return { ok: false, reason: 'That image could not be read.' }
    }

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return {
        ok: false,
        reason: `That image is ${metadata.width}×${metadata.height}. The limit is ${MAX_DIMENSION} pixels on either edge.`,
      }
    }

    const processed = await pipeline
      .clone()
      // `rotate()` with no argument applies the EXIF orientation before that
      // metadata is discarded. Without it, a photo taken on a phone in
      // portrait is stored on its side.
      .rotate()
      .resize({
        width: TARGET_LONG_EDGE,
        height: TARGET_LONG_EDGE,
        fit: 'inside',
        // Never upscale: enlarging a 400px supplier thumbnail to 1600px makes
        // the file bigger and the image worse.
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true })

    // A tiny inline preview, so the card reserves its space and fades in
    // rather than reflowing when the real image arrives.
    const blur = await pipeline
      .clone()
      .rotate()
      .resize(BLUR_EDGE, BLUR_EDGE, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer()

    const stored = await getUploadStorage().put(processed.data, 'webp')

    return {
      ok: true,
      image: {
        url: mediaUrl(stored.key),
        alt: alt.trim().slice(0, 160) || 'Product image',
        width: processed.info.width,
        height: processed.info.height,
        blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      },
    }
  } catch (error) {
    // sharp throws for a decompression bomb, a truncated file and a format it
    // cannot decode. None of those should surface as a 500.
    console.error('[upload] processing failed:', error)
    return { ok: false, reason: 'That image could not be processed. Try a different file.' }
  }
}
