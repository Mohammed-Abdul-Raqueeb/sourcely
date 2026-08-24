'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Eye, EyeOff, KeyRound, Mail, MapPin, Phone, User } from 'lucide-react'
import { registerAction } from '@/server/actions/auth'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { cn } from '@/lib/cn'
import { Checkbox, Field, Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/button'
import { AuthFinePrint, AuthHeading, FormBanner, SubmitButton } from './form-shell'

/**
 * Registration.
 *
 * Company, phone, city and GSTIN are optional at signup and asked for again at
 * the point they are actually needed — the first quotation request. A B2B
 * signup form that demands a GSTIN before showing anything loses the buyer who
 * was only evaluating.
 */

/** Mirrors `checkPassword` on the server. Feedback only; the server decides. */
function scorePassword(password: string, email: string) {
  const problems: string[] = []
  if (password.length > 0 && password.length < 8) problems.push('At least 8 characters')
  if (password.length > 0 && !/[a-z]/.test(password)) problems.push('One lowercase letter')
  if (password.length > 0 && !/[A-Z0-9]/.test(password)) {
    problems.push('One capital letter or number')
  }

  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length > 2 && password.toLowerCase().includes(local)) {
    problems.push('Do not include your email address')
  }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++

  return { score: Math.min(4, score), problems }
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const
const STRENGTH_COLOURS = [
  'bg-danger',
  'bg-danger',
  'bg-warning',
  'bg-success',
  'bg-success',
] as const

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(registerAction, IDLE_FORM_STATE)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const strength = useMemo(() => scorePassword(password, email), [password, email])

  return (
    <>
      <AuthHeading
        title="Create your account"
        description={
          <>
            Already registered?{' '}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
              className="font-medium text-accent-text hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      />

      <FormBanner state={state} />

      <form action={formAction} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name} required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            autoFocus
            invalid={Boolean(state.fieldErrors?.name)}
            leadingIcon={<User className="size-4" aria-hidden />}
            placeholder="Rajesh Kumar"
          />
        </Field>

        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(state.fieldErrors?.email)}
            leadingIcon={<Mail className="size-4" aria-hidden />}
            placeholder="you@company.in"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={state.fieldErrors?.password}
          required
        >
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(state.fieldErrors?.password)}
            leadingIcon={<KeyRound className="size-4" aria-hidden />}
            trailingSlot={
              <IconButton
                label={showPassword ? 'Hide password' : 'Show password'}
                size="sm"
                onClick={() => setShowPassword((visible) => !visible)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </IconButton>
            }
          />
        </Field>

        {/* Strength meter -------------------------------------------------- */}
        {password.length > 0 && (
          <div aria-live="polite">
            <div className="flex gap-1" role="presentation">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    index < strength.score ? STRENGTH_COLOURS[strength.score] : 'bg-border'
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              {STRENGTH_LABELS[strength.score]}
              {strength.problems.length > 0 && (
                <span className="text-faint"> — {strength.problems[0]}</span>
              )}
            </p>
          </div>
        )}

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={state.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            invalid={Boolean(state.fieldErrors?.confirmPassword)}
            leadingIcon={<KeyRound className="size-4" aria-hidden />}
          />
        </Field>

        {/* Optional business details --------------------------------------- */}
        <details className="group rounded-lg border border-border bg-surface/50">
          <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-text-2 transition-colors hover:text-text">
            <span className="flex items-center justify-between gap-2">
              Business details
              <span className="text-[11px] font-normal text-faint">
                Optional — speeds up your first quotation
              </span>
            </span>
          </summary>

          <div className="space-y-4 border-t border-border p-4">
            <Field label="Company" htmlFor="company" error={state.fieldErrors?.company}>
              <Input
                id="company"
                name="company"
                autoComplete="organization"
                leadingIcon={<Building2 className="size-4" aria-hidden />}
                placeholder="Deccan Projects Pvt. Ltd."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone}>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  leadingIcon={<Phone className="size-4" aria-hidden />}
                  placeholder="+91 98450 22140"
                />
              </Field>

              <Field label="City" htmlFor="city" error={state.fieldErrors?.city}>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  leadingIcon={<MapPin className="size-4" aria-hidden />}
                  placeholder="Hyderabad"
                />
              </Field>
            </div>

            <Field
              label="GSTIN"
              htmlFor="gstin"
              error={state.fieldErrors?.gstin}
              hint="Needed on the invoice, not to browse"
            >
              <Input
                id="gstin"
                name="gstin"
                className="font-mono uppercase"
                placeholder="36AAGCD1129R1ZP"
                maxLength={15}
              />
            </Field>
          </div>
        </details>

        <Field error={state.fieldErrors?.terms}>
          <Checkbox
            name="terms"
            label={
              <span className="text-[13px] leading-relaxed whitespace-normal text-muted">
                I agree to the{' '}
                <Link href="/legal/terms" className="text-accent-text hover:underline">
                  terms of service
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="text-accent-text hover:underline">
                  privacy policy
                </Link>
                .
              </span>
            }
          />
        </Field>

        <SubmitButton loadingLabel="Creating your account…">Create account</SubmitButton>
      </form>

      <AuthFinePrint>
        Nothing you shortlist is shared with suppliers until you send a
        quotation request.
      </AuthFinePrint>
    </>
  )
}
