'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import { forgotPasswordAction, resetPasswordAction } from '@/server/actions/auth'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { Field, Input } from '@/components/ui/input'
import { ButtonLink, IconButton } from '@/components/ui/button'
import { AuthHeading, FormBanner, SubmitButton } from './form-shell'

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, IDLE_FORM_STATE)

  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter the email on your account and we will send a link to set a new password. The link expires in one hour."
      />

      <FormBanner state={state} />

      {/* No mailer is wired up yet, so in development the link is surfaced
          here instead. Being explicit about that beats a success message
          about an email that was never sent. */}
      {state.data?.resetPath && (
        <div className="mb-5 rounded-lg border border-dashed border-accent-line bg-accent-soft/60 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-accent-text uppercase">
            Development mode — no email service configured
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            The link below would normally arrive by email.
          </p>
          <ButtonLink
            href={state.data.resetPath}
            size="sm"
            className="mt-3"
            trailingIcon={<ExternalLink className="size-3.5" aria-hidden />}
          >
            Open reset link
          </ButtonLink>
        </div>
      )}

      {state.status !== 'success' && (
        <form action={formAction} className="space-y-4" noValidate>
          <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              invalid={Boolean(state.fieldErrors?.email)}
              leadingIcon={<Mail className="size-4" aria-hidden />}
              placeholder="you@company.in"
            />
          </Field>

          <SubmitButton loadingLabel="Sending…">Send reset link</SubmitButton>
        </form>
      )}

      <p className="mt-6 text-center text-[13px] text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-accent-text hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE_FORM_STATE)
  const [showPassword, setShowPassword] = useState(false)

  const done = state.status === 'success'

  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description={
          done
            ? 'You can sign in with your new password now.'
            : 'Pick something you have not used elsewhere. Every device signed in to this account will be signed out.'
        }
      />

      <FormBanner state={state} />

      {done ? (
        <ButtonLink href="/login" size="lg" fullWidth>
          Sign in
        </ButtonLink>
      ) : (
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="token" value={token} />

          <Field
            label="New password"
            htmlFor="password"
            error={state.fieldErrors?.password}
            required
          >
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              required
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

          <Field
            label="Confirm new password"
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

          <SubmitButton loadingLabel="Updating…">Set new password</SubmitButton>
        </form>
      )}
    </>
  )
}
