'use client'

import { useActionState, useState, useTransition } from 'react'
import { Building2, KeyRound, LogOut, MapPin, Monitor, Phone, User } from 'lucide-react'
import type { User as UserModel } from '@/lib/domain/account'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { formatRelative } from '@/lib/format'
import {
  changePasswordAction,
  revokeSessionAction,
  signOutEverywhereAction,
  updateProfileAction,
} from '@/server/actions/auth'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormBanner, SubmitButton } from '@/components/auth/form-shell'

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export function ProfileForm({ user }: { user: UserModel }) {
  const [state, formAction] = useActionState(updateProfileAction, IDLE_FORM_STATE)

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormBanner state={state} />

      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name} required>
        <Input
          id="name"
          name="name"
          defaultValue={user.name}
          autoComplete="name"
          required
          invalid={Boolean(state.fieldErrors?.name)}
          leadingIcon={<User className="size-4" aria-hidden />}
        />
      </Field>

      <Field
        label="Email"
        htmlFor="email-readonly"
        hint="Contact support to change the email on your account."
      >
        <Input
          id="email-readonly"
          defaultValue={user.email}
          disabled
          readOnly
          className="font-mono"
        />
      </Field>

      <Field label="Company" htmlFor="company" error={state.fieldErrors?.company}>
        <Input
          id="company"
          name="company"
          defaultValue={user.company ?? ''}
          autoComplete="organization"
          leadingIcon={<Building2 className="size-4" aria-hidden />}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={user.phone ?? ''}
            autoComplete="tel"
            leadingIcon={<Phone className="size-4" aria-hidden />}
          />
        </Field>

        <Field label="City" htmlFor="city" error={state.fieldErrors?.city}>
          <Input
            id="city"
            name="city"
            defaultValue={user.city ?? ''}
            autoComplete="address-level2"
            leadingIcon={<MapPin className="size-4" aria-hidden />}
          />
        </Field>
      </div>

      <Field
        label="GSTIN"
        htmlFor="gstin"
        error={state.fieldErrors?.gstin}
        hint="Appears on quotations and invoices."
      >
        <Input
          id="gstin"
          name="gstin"
          defaultValue={user.gstin ?? ''}
          className="font-mono uppercase"
          maxLength={15}
          placeholder="36AAGCD1129R1ZP"
        />
      </Field>

      <div className="pt-1">
        <SubmitButton loadingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Password                                                                   */
/* -------------------------------------------------------------------------- */

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, IDLE_FORM_STATE)

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormBanner state={state} />

      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
        required
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.fieldErrors?.currentPassword)}
          leadingIcon={<KeyRound className="size-4" aria-hidden />}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="new-password"
        error={state.fieldErrors?.password}
        hint="At least 8 characters, with a capital letter or a number."
        required
      >
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.fieldErrors?.password)}
          leadingIcon={<KeyRound className="size-4" aria-hidden />}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm-new-password"
        error={state.fieldErrors?.confirmPassword}
        required
      >
        <Input
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.fieldErrors?.confirmPassword)}
          leadingIcon={<KeyRound className="size-4" aria-hidden />}
        />
      </Field>

      <p className="text-[12px] leading-relaxed text-faint">
        Changing your password signs out every other device. This one stays
        signed in.
      </p>

      <SubmitButton loadingLabel="Updating…">Change password</SubmitButton>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export interface SessionSummary {
  id: string
  device: string
  createdAt: string
  lastSeenAt: string
  current: boolean
}

export function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  const [pending, startTransition] = useTransition()
  const [revoking, setRevoking] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0">
            <Monitor className="size-4 shrink-0 text-faint" aria-hidden />

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-text">
                {session.device}
                {session.current && (
                  <span className="rounded-full border border-success/25 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                    This device
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                Active {formatRelative(session.lastSeenAt)} · started{' '}
                {formatRelative(session.createdAt)}
              </p>
            </div>

            {!session.current && (
              <Button
                variant="ghost"
                size="xs"
                loading={pending && revoking === session.id}
                onClick={() => {
                  setRevoking(session.id)
                  startTransition(() => void revokeSessionAction(session.id))
                }}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form action={signOutEverywhereAction}>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          leadingIcon={<LogOut className="size-3.5" aria-hidden />}
        >
          Sign out everywhere
        </Button>
      </form>
    </div>
  )
}
