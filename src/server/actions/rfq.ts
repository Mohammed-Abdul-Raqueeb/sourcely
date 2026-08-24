'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { toFieldErrors, type FormState } from '@/lib/validation/auth'
import { gstinSchema, phoneSchema } from '@/lib/validation/auth'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { requireUser } from '@/server/auth/session'
import { clientIdentifier, rateLimit } from '@/server/security/rate-limit'
import { rfqReceivedEmail, sendMailInBackground } from '@/server/mail'

/**
 * Quotation request creation.
 *
 * Line quantities and product ids are re-validated against the catalogue on
 * the server: a request that names a product that does not exist, or a
 * quantity below the seller's minimum order, must not reach a supplier's
 * inbox looking legitimate.
 */

const rfqSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  company: z.string().trim().min(2, 'Enter your company name').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: phoneSchema,
  city: z.string().trim().min(2, 'Enter the delivery city').max(80),
  gstin: gstinSchema,
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a 6-digit pincode')
    .optional()
    .or(z.literal('')),
  requiredBy: z.string().trim().optional().or(z.literal('')),
  requirements: z
    .string()
    .trim()
    .min(10, 'Tell the supplier what this is for — a line or two is enough')
    .max(2000),
})

export async function createRfqAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser('/account/rfq')

  const identity = await clientIdentifier()
  const limit = await rateLimit(`rfq:${identity}`, 12, 60 * 60_000)
  if (!limit.ok) {
    return {
      status: 'error',
      message: 'Too many quotation requests in a short window. Try again shortly.',
    }
  }

  const parsed = rfqSchema.safeParse({
    name: formData.get('name'),
    company: formData.get('company'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    city: formData.get('city'),
    gstin: formData.get('gstin') ?? '',
    pincode: formData.get('pincode') ?? '',
    requiredBy: formData.get('requiredBy') ?? '',
    requirements: formData.get('requirements'),
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  /* --- Lines ----------------------------------------------------------- */

  const catalog = getCatalogRepository()
  const productIds = formData.getAll('productId').map(String).slice(0, 40)

  const items: {
    productId: string
    quantity: number
    note: string | null
    quotedUnitPrice: null
    quotedLeadTimeDays: null
  }[] = []

  /** Names for the confirmation email, gathered while the products are loaded. */
  const productNames = new Map<string, string>()

  for (const productId of productIds) {
    const product = await catalog.findById(productId)
    if (!product) continue
    productNames.set(productId, product.name)

    const rawQuantity = Number.parseInt(String(formData.get(`quantity:${productId}`) ?? ''), 10)
    const minimum = product.availability.minOrderQuantity
    const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : minimum

    if (quantity < minimum) {
      return {
        status: 'error',
        message: `${product.name} has a minimum order of ${minimum} ${product.availability.unit}${minimum === 1 ? '' : 's'}.`,
      }
    }

    items.push({
      productId,
      quantity: Math.min(quantity, 1_000_000),
      note: String(formData.get(`note:${productId}`) ?? '').trim().slice(0, 300) || null,
      quotedUnitPrice: null,
      quotedLeadTimeDays: null,
    })
  }

  if (items.length === 0) {
    return {
      status: 'error',
      message: 'Add at least one product to request a quotation for.',
    }
  }

  /* --- Create ------------------------------------------------------------ */

  const activity = getActivityRepository()

  const rfq = await activity.createRfq({
    userId: user.id,
    status: 'submitted',
    contact: {
      name: parsed.data.name,
      company: parsed.data.company,
      email: parsed.data.email,
      phone: parsed.data.phone || '',
      city: parsed.data.city,
      gstin: parsed.data.gstin || null,
    },
    items,
    requirements: parsed.data.requirements,
    deliveryPincode: parsed.data.pincode || null,
    requiredByDate: parsed.data.requiredBy
      ? new Date(parsed.data.requiredBy).toISOString()
      : null,
    sourceConversationId: null,
    quotedTotal: null,
    validUntil: null,
  })

  await activity.createNotification({
    userId: user.id,
    kind: 'rfq_status',
    title: `${rfq.reference} submitted`,
    body: `Your request for ${items.length} line${items.length === 1 ? '' : 's'} has gone to the supplier. You will be notified as soon as it is priced.`,
    href: `/account/rfq/${rfq.id}`,
  })

  // Backgrounded, and sent before the redirect below — `redirect()` works by
  // throwing, so nothing after it in this function runs.
  sendMailInBackground(
    rfqReceivedEmail({
      to: { name: parsed.data.name, email: parsed.data.email },
      rfq,
      productNames,
    })
  )

  revalidatePath('/account/rfq')
  revalidatePath('/account')
  redirect(`/account/rfq/${rfq.id}`)
}
