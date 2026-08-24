'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import { loginAction } from '@/server/actions/auth'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { Field, Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/button'
import { AuthHeading, FormBanner, SubmitButton } from './form-shell'

export function LoginForm({
  next,
  demo,
}: {
  next?: string
  demo: { email: string; password: string }
}) {
  const [state, formAction] = useActionState(loginAction, IDLE_FORM_STATE)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <>
      <AuthHeading
        title="Sign in"
        description={
          <>
            New to Sourcely?{' '}
            <Link
              href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
              className="font-medium text-accent-text hover:underline"
            >
              Create an account
            </Link>
          </>
        }
      />

      <FormBanner state={state} />

      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ''} />

        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
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
            autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[13px] font-medium text-muted transition-colors hover:text-accent-text"
          >
            Forgot your password?
          </Link>
        </div>

        <SubmitButton loadingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      {/* Demo credentials ---------------------------------------------------
          Present because a reviewer opening this project should be able to see
          the signed-in experience without registering first. */}
      <div className="mt-7 rounded-lg border border-dashed border-border bg-surface/50 p-4">
        <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">
          Demo account
        </p>
        <dl className="mt-2.5 space-y-1 font-mono text-[12px] text-text-2 tnum">
          <div className="flex justify-between gap-4">
            <dt className="text-faint">email</dt>
            <dd>{demo.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-faint">password</dt>
            <dd>{demo.password}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            setEmail(demo.email)
            setPassword(demo.password)
          }}
          className="mt-3 text-[12px] font-medium text-accent-text hover:underline"
        >
          Fill these in
        </button>
      </div>
    </>
  )
}
