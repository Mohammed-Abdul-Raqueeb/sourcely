'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FormState } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'

/**
 * Shared chrome for the auth forms.
 *
 * `useFormStatus` has to be read by a component *inside* the form, which is
 * why the submit button is its own component rather than a prop on the shell.
 */

export function AuthHeading({
  title,
  description,
}: {
  title: string
  description: ReactNode
}) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
        {title}
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{description}</p>
    </div>
  )
}

/**
 * Form-level banner. Field-level errors render next to their input; this is
 * for the ones that belong to the whole submission — bad credentials, rate
 * limits, a consumed reset token.
 */
export function FormBanner({ state }: { state: FormState }) {
  if (!state.message) return null

  const isError = state.status === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'mb-5 flex items-start gap-2.5 rounded-lg border px-3.5 py-3',
        isError
          ? 'border-danger/25 bg-danger-soft'
          : 'border-success/25 bg-success-soft'
      )}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', isError ? 'text-danger' : 'text-success')}
        aria-hidden
      />
      <p className="text-[13px] leading-relaxed text-text-2">{state.message}</p>
    </div>
  )
}

export function SubmitButton({
  children,
  loadingLabel,
}: {
  children: ReactNode
  loadingLabel?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="lg" fullWidth loading={pending}>
      {pending ? (loadingLabel ?? 'Working…') : children}
    </Button>
  )
}

/** Legal line under a submit button. */
export function AuthFinePrint({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-center text-[12px] leading-relaxed text-faint">{children}</p>
}
