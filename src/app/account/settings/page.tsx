import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/format'
import { getSession } from '@/server/auth/session'
import { getAccountRepository } from '@/server/repositories'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SectionCard } from '@/components/account/ui'
import {
  PasswordForm,
  ProfileForm,
  SessionList,
  type SessionSummary,
} from '@/components/account/settings-forms'

export const metadata: Metadata = { title: 'Settings' }

/**
 * Turns a raw user-agent into something a person can recognise.
 *
 * Deliberately coarse. The purpose is "is that me?", not device fingerprinting,
 * and storing a precise device signature would be collecting data we have no
 * use for.
 */
function describeDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Safari\//.test(userAgent)
        ? 'Safari'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : 'Browser'

  const platform = /Windows/.test(userAgent)
    ? 'Windows'
    : /Macintosh|Mac OS/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown platform'

  return `${browser} on ${platform}`
}

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) notFound()

  const accounts = getAccountRepository()
  const [record, sessions] = await Promise.all([
    accounts.findUserById(session.user.id),
    accounts.listSessions(session.user.id),
  ])

  if (!record) notFound()

  // Strip the password hash before anything reaches a component.
  const { passwordHash: _passwordHash, ...user } = record

  const summaries: SessionSummary[] = sessions.map((entry) => ({
    id: entry.id,
    device: describeDevice(entry.userAgent),
    createdAt: entry.createdAt,
    lastSeenAt: entry.lastSeenAt,
    current: entry.id === session.sessionId,
  }))

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, your password, and the devices signed in to this account."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Profile"
            description="Used to pre-fill quotation requests."
          >
            <ProfileForm user={user} />
          </SectionCard>

          <SectionCard title="Password">
            <PasswordForm />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Account">
            <dl className="divide-y divide-border">
              {[
                { label: 'Account type', value: <Badge tone="neutral" size="md">{user.role}</Badge> },
                {
                  label: 'Email verified',
                  value: user.emailVerified ? (
                    <Badge tone="success" size="md">Verified</Badge>
                  ) : (
                    <Badge tone="warning" size="md">Not verified</Badge>
                  ),
                },
                { label: 'Member since', value: <span className="font-mono text-[13px] text-text-2 tnum">{formatDate(user.createdAt)}</span> },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="text-[13px] text-muted">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard
            title="Signed-in devices"
            description="Revoke anything you do not recognise."
          >
            <SessionList sessions={summaries} />
          </SectionCard>

          <SectionCard title="Data">
            <p className="text-[13px] leading-relaxed text-muted">
              Your search history, shortlist and quotation requests are visible
              only to you. Suppliers see a quotation request only once you send
              it, and only the lines it contains.
            </p>
            <p className="mt-3 text-[12px] text-faint">
              Clearing search history is on the{' '}
              <a href="/account/searches" className="text-accent-text hover:underline">
                search history
              </a>{' '}
              page.
            </p>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
