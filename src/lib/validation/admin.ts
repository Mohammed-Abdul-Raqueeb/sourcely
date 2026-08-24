import { z } from 'zod'
import { AVAILABILITY_STATES } from '@/lib/domain/catalog'
import { RFQ_STATUSES } from '@/lib/domain/account'

/**
 * Admin input schemas.
 *
 * Every one of these guards a write that reaches the public catalogue, so the
 * bounds are deliberately tight — a price of `-1` or a SKU with a slash in it
 * would render, index and route badly long after whoever typed it has moved on.
 */

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'A SKU needs at least 3 characters')
  .max(32, 'Keep SKUs under 32 characters')
  .regex(/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/, 'Use letters, numbers and hyphens only')

export const productSchema = z.object({
  sku: skuSchema,
  name: z.string().trim().min(6, 'Give the product a full descriptive name').max(160),
  shortDescription: z
    .string()
    .trim()
    .min(20, 'One clear sentence — this is what buyers read on the card')
    .max(300),
  description: z
    .string()
    .trim()
    .min(60, 'Describe what it is for and how it is specified')
    .max(4000),

  categoryKey: z.string().trim().min(1, 'Choose a category'),
  subcategoryKey: z.string().trim().min(1, 'Choose a subcategory'),
  brandKey: z.string().trim().min(1, 'Choose a brand'),
  sellerKey: z.string().trim().min(1, 'Choose a seller'),

  price: z.coerce
    .number()
    .int('Prices are whole rupees')
    .min(1, 'Price must be at least ₹1')
    .max(100_000_000, 'That price looks wrong'),
  listPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  priceUnit: z.string().trim().min(2).max(40),
  taxRatePercent: z.coerce.number().min(0).max(50),

  status: z.enum(['active', 'draft', 'archived']),

  availabilityState: z.enum(AVAILABILITY_STATES),
  quantityOnHand: z.coerce.number().int().min(0).max(1_000_000).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
  minOrderQuantity: z.coerce.number().int().min(1).max(100_000),
  unit: z.string().trim().min(1).max(24),

  warrantyMonths: z.coerce.number().int().min(0).max(600).optional(),
  /** Comma separated in the form; split server-side. */
  certifications: z.string().trim().max(300).optional(),
  tags: z.string().trim().max(400).optional(),
  applications: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  artwork: z.string().trim().min(1).max(40),
})

export type ProductInput = z.infer<typeof productSchema>

export const rfqUpdateSchema = z.object({
  rfqId: z.string().trim().min(1),
  status: z.enum(RFQ_STATUSES),
  validUntil: z.string().trim().optional().or(z.literal('')),
})

export const rfqMessageSchema = z.object({
  rfqId: z.string().trim().min(1),
  body: z
    .string()
    .trim()
    .min(4, 'Write something the buyer can act on')
    .max(4000, 'Keep it under 4000 characters'),
})
