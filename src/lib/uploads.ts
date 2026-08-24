/**
 * Upload limits shared by the browser and the server.
 *
 * In a neutral module for the same reason `MAX_COMPARE` is: importing a value
 * from a `'use client'` module into a Server Component yields a client
 * reference object rather than the value, and arithmetic on it silently
 * produces NaN instead of throwing. The reverse — importing a `server-only`
 * module into a client component — fails loudly at build time, which is better
 * but still a build failure.
 *
 * The client uses these to give immediate feedback. The server re-checks every
 * one of them; nothing here is a control.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** Refused before decode — libvips will allocate for a 30000×30000 image. */
export const MAX_DIMENSION = 6_000

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const
