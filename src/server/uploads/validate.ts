import 'server-only'
import { MAX_UPLOAD_BYTES } from '@/lib/uploads'

/**
 * Upload validation.
 *
 * The rule that governs this file: **nothing the client sends is evidence.**
 * The filename, its extension and the `Content-Type` are all attacker-chosen
 * strings. A file called `logo.png` with `Content-Type: image/png` is regularly
 * a PHP script, an SVG containing a script tag, or a zip bomb.
 *
 * So the checks run in this order, cheapest and most decisive first:
 *
 *   1. Declared size, to reject before reading anything into memory.
 *   2. Actual byte length, because the declared size is also a claim.
 *   3. Magic bytes, which is the first check whose input the server produced.
 *   4. Decode and re-encode (see ./index.ts) — the only complete answer.
 */

export { MAX_DIMENSION, MAX_UPLOAD_BYTES } from '@/lib/uploads'

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export interface ValidationFailure {
  ok: false
  reason: string
}

export interface ValidationSuccess {
  ok: true
  format: ImageFormat
  bytes: Uint8Array
}

export type ValidationResult = ValidationFailure | ValidationSuccess

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

/**
 * Identifies the format from the file's own bytes.
 *
 * SVG is deliberately absent and must stay absent. An SVG is an XML document
 * that can carry `<script>`, external entity references and foreignObject HTML;
 * served from our origin it is a stored-XSS primitive, and unlike a raster
 * format it cannot be made safe by re-encoding.
 */
export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'

  // RIFF....WEBP — the size field sits between the two markers.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }

  // ISO-BMFF: "ftyp" at offset 4, then an AVIF brand.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = new TextDecoder('latin1').decode(bytes.subarray(8, 12))
    if (brand === 'avif' || brand === 'avis') return 'avif'
  }

  return null
}

/**
 * Validates an uploaded file up to, but not including, the decode.
 *
 * Returns the bytes on success so the caller does not read the stream twice —
 * and so there is no window in which the bytes could change between the check
 * and the use.
 */
export async function validateImageUpload(file: unknown): Promise<ValidationResult> {
  if (!(file instanceof File)) {
    return { ok: false, reason: 'No file was received.' }
  }

  if (file.size === 0) {
    return { ok: false, reason: 'That file is empty.' }
  }

  // The declared size, checked first so an oversized upload is refused without
  // being buffered.
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // And again against what actually arrived. `File.size` is a claim.
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'That file is larger than the limit.' }
  }

  const format = sniffFormat(bytes)
  if (!format) {
    return {
      ok: false,
      reason: 'That is not a JPEG, PNG, WebP or AVIF image. SVG files are not accepted.',
    }
  }

  return { ok: true, format, bytes }
}
