import { z } from 'zod'

/**
 * Auth input schemas.
 *
 * Shared by the client form and the server action deliberately: the client
 * copy gives immediate feedback, the server copy is the one that decides. A
 * schema that only exists on the client is decoration.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'That email is too long')
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase())

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'Use fewer than 200 characters')

/** Optional Indian GSTIN. Format-checked only — not verified against the GSTN. */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/,
    'That does not look like a valid GSTIN'
  )
  .optional()
  .or(z.literal(''))

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{7,17}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''))

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  next: z.string().optional(),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Enter your full name')
      .max(80, 'That name is too long'),
    email: emailSchema,
    company: z.string().trim().max(120).optional().or(z.literal('')),
    phone: phoneSchema,
    city: z.string().trim().max(80).optional().or(z.literal('')),
    gstin: gstinSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.union([z.literal('on'), z.literal('true'), z.boolean()]).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => Boolean(data.terms), {
    message: 'You must accept the terms to continue',
    path: ['terms'],
  })

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'This reset link is not valid'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  phone: phoneSchema,
  city: z.string().trim().max(80).optional().or(z.literal('')),
  gstin: gstinSchema,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ProfileInput = z.infer<typeof profileSchema>

/* -------------------------------------------------------------------------- */
/* Form result                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The shape every auth server action returns.
 *
 * `useActionState` needs a serialisable result; field errors are keyed by
 * input name so the form can render them next to the offending control.
 */
export interface FormState {
  status: 'idle' | 'error' | 'success'
  message?: string
  fieldErrors?: Record<string, string>
  /** Populated on success where the client needs to react, e.g. a reset link. */
  data?: Record<string, string>
}

export const IDLE_FORM_STATE: FormState = { status: 'idle' }

/** Flattens a Zod error into the `fieldErrors` shape. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !result[key]) {
      result[key] = issue.message
    }
  }
  return result
}
