import type { NextRequest } from 'next/server'
import { requireRoleForApi } from '@/server/auth/session'
import { clientIdentifier, LIMITS, rateLimit } from '@/server/security/rate-limit'
import { recordAudit } from '@/server/audit/record'
import { storeProductImage } from '@/server/uploads'

/**
 * Product image upload.
 *
 * Returns the processed `ProductImage` for the admin form to attach to its
 * hidden fields; it does not touch the product record itself. Keeping the
 * upload and the save separate means an abandoned form leaves an orphaned
 * image rather than a half-written product, and an orphan is the cheaper
 * failure — it is reclaimable by a sweep, a corrupted product is not.
 */

export const dynamic = 'force-dynamic'

/** Above this the platform's own body limit rejects it first anyway. */
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const user = await requireRoleForApi('staff')
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 })

  // Image processing is the most expensive thing a request can ask this server
  // to do, so it is limited per account rather than per address — a shared
  // office NAT should not have one operator's uploads throttled by another's.
  const identity = await clientIdentifier()
  const limit = await rateLimit(
    `upload:${user.id}:${identity}`,
    LIMITS.upload.limit,
    LIMITS.upload.windowMs
  )

  if (!limit.ok) {
    return Response.json(
      { error: 'Too many uploads in a short window.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    // A truncated or malformed multipart body, or one over the platform limit.
    return Response.json({ error: 'That upload could not be read.' }, { status: 400 })
  }

  const result = await storeProductImage(form.get('file'), String(form.get('alt') ?? ''))

  if (!result.ok || !result.image) {
    // 422, not 400: the request was well formed, its content was unacceptable.
    return Response.json({ error: result.reason ?? 'Upload rejected.' }, { status: 422 })
  }

  await recordAudit({
    action: 'upload',
    targetType: 'image',
    targetId: result.image.url,
    summary: `${user.email} uploaded an image (${result.image.width}×${result.image.height})`,
  })

  return Response.json({ image: result.image })
}
