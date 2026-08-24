import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, CircleSlash, TriangleAlert } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { resolveDriver } from '@/server/repositories'
import { resolveProviderName } from '@/server/ai/provider'
import { sessionTtlHours } from '@/server/auth/tokens'
import { LIMITS, rateLimitBackend } from '@/server/security/rate-limit'
import { SITE, CONTACT, formattedAddress, siteDetailsConfigured } from '@/lib/site'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SectionCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Settings' }

/**
 * System settings.
 *
 * Read-only, and deliberately so: every value here comes from an environment
 * variable. A settings screen that writes application config to a database
 * creates two sources of truth and a deployment that behaves differently from
 * its own configuration — the one thing an operator must be able to trust.
 *
 * What it does instead is tell you what the running process actually resolved,
 * and flag anything that will fail in production.
 */
export default async function AdminSettingsPage() {
  const user = await requireRole('admin', '/admin/settings')

  const driver = resolveDriver()
  const provider = resolveProviderName()
  const backend = rateLimitBackend()
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY)
  const secret = process.env.AUTH_SECRET ?? ''
  const secretOk = secret.length >= 32
  const production = process.env.NODE_ENV === 'production'

  const warnings: { level: 'error' | 'warn'; text: string }[] = []

  if (!secretOk) {
    warnings.push({
      level: production ? 'error' : 'warn',
      text: production
        ? 'AUTH_SECRET is missing or too short. Sessions cannot be verified — every sign-in will fail.'
        : 'AUTH_SECRET is unset. A fixed development key is in use; production will refuse to start without a real one.',
    })
  }

  if (provider === 'claude' && !hasApiKey) {
    warnings.push({
      level: 'warn',
      text: 'AI_PROVIDER is set to claude but ANTHROPIC_API_KEY is empty. The offline engine is handling every request.',
    })
  }

  if (driver === 'memory' && production) {
    warnings.push({
      level: 'warn',
      text: 'DATA_DRIVER is memory in production. Data is stored in a JSON file and is not suitable for real traffic.',
    })
  }

  const rows: { label: string; value: string; note?: string; ok?: boolean }[] = [
    {
      label: 'Data driver',
      value: driver,
      note: driver === 'memory' ? 'JSON file, seeded catalogue' : 'PostgreSQL + pgvector',
      ok: driver === 'postgres' || !production,
    },
    {
      label: 'AI provider',
      value: provider === 'claude' ? (hasApiKey ? 'claude' : 'claude (no key → offline)') : 'offline',
      note:
        provider === 'claude' && hasApiKey
          ? process.env.ANTHROPIC_MODEL || 'claude-opus-5'
          : 'Deterministic parser and templated explanations',
      ok: provider === 'offline' || hasApiKey,
    },
    {
      label: 'Session lifetime',
      value: `${sessionTtlHours()} hours`,
      note: 'AUTH_SESSION_TTL_HOURS',
      ok: true,
    },
    {
      label: 'Auth secret',
      value: secretOk ? `configured (${secret.length} chars)` : 'not configured',
      note: secretOk ? undefined : 'Development fallback key in use',
      ok: secretOk,
    },
    {
      label: 'Environment',
      value: process.env.NODE_ENV ?? 'development',
      ok: true,
    },
  ]

  return (
    <>
      <PageHeader
        title="Settings"
        description="What this process actually resolved at startup. Everything here is environment configuration, not stored state."
      />

      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning.text}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-4 py-3',
                warning.level === 'error'
                  ? 'border-danger/25 bg-danger-soft'
                  : 'border-warning/25 bg-warning-soft'
              )}
            >
              <TriangleAlert
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  warning.level === 'error' ? 'text-danger' : 'text-warning'
                )}
                aria-hidden
              />
              <p className="text-[13px] leading-relaxed text-text-2">{warning.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Runtime" description="Resolved from the environment" padded={false}>
          <dl className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <dt className="text-[13px] text-text-2">{row.label}</dt>
                  {row.note && <p className="mt-0.5 text-[12px] text-faint">{row.note}</p>}
                </div>
                <dd className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[12.5px] text-text tnum">{row.value}</span>
                  {row.ok ? (
                    <CircleCheck className="size-3.5 text-success" aria-label="OK" />
                  ) : (
                    <CircleSlash className="size-3.5 text-warning" aria-label="Needs attention" />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard
          title="Rate limits"
          description={
            backend === 'redis'
              ? 'Per identity, shared across instances'
              : 'Per identity, in-process'
          }
          padded={false}
        >
          <dl className="divide-y divide-border">
            {[
              { label: 'Sign-in attempts', limit: LIMITS.login },
              { label: 'Registrations', limit: LIMITS.register },
              { label: 'Password resets', limit: LIMITS.passwordReset },
              { label: 'Assistant queries', limit: LIMITS.assistant },
              { label: 'API requests', limit: LIMITS.api },
              { label: 'Image uploads', limit: LIMITS.upload },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-[13px] text-text-2">{row.label}</dt>
                <dd className="font-mono text-[12.5px] text-muted tnum">
                  {row.limit.limit} / {Math.round(row.limit.windowMs / 60_000)} min
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border px-5 py-3 text-[12px] leading-relaxed text-faint">
            {backend === 'redis' ? (
              <>
                Counted in Redis by an atomic token-bucket script, so every
                instance draws on one shared quota.
              </>
            ) : (
              <>
                Counted in-process — correct for a single instance, but each
                replica behind a load balancer would grant its own quota. Set{' '}
                <code className="font-mono text-text-2">REDIS_URL</code> to
                share one bucket across all of them.
              </>
            )}
          </p>
        </SectionCard>

        <SectionCard title="Brand & contact">
          <dl className="space-y-2.5 text-[13px]">
            {[
              { label: 'Product', value: SITE.name, env: 'NEXT_PUBLIC_SITE_NAME' },
              { label: 'Legal entity', value: SITE.legalName, env: 'NEXT_PUBLIC_LEGAL_NAME' },
              { label: 'Support email', value: CONTACT.supportEmail, env: 'NEXT_PUBLIC_SUPPORT_EMAIL' },
              { label: 'Phone', value: CONTACT.phone, env: 'NEXT_PUBLIC_CONTACT_PHONE' },
              { label: 'Registered office', value: formattedAddress(), env: 'NEXT_PUBLIC_ADDRESS_LINE1' },
              { label: 'GSTIN', value: CONTACT.gstin, env: 'NEXT_PUBLIC_GSTIN' },
              { label: 'CIN', value: CONTACT.cin, env: 'NEXT_PUBLIC_CIN' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-muted">{row.label}</dt>
                <dd className="text-right font-mono text-[12.5px] text-text-2">
                  {row.value ?? <span className="text-faint">not set · {row.env}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-[12px] leading-relaxed text-faint">
            {siteDetailsConfigured() ? (
              <>
                Read from the environment at boot. Change them in the
                deployment&rsquo;s configuration, not in source.
              </>
            ) : (
              <>
                Unset values are omitted from the site rather than filled with
                plausible substitutes, and the footer says the deployment is a
                demonstration. Set the variables above to publish real details.
              </>
            )}
          </p>
        </SectionCard>

        <SectionCard title="Access">
          <p className="text-[13px] leading-relaxed text-muted">
            You are signed in as{' '}
            <span className="text-text">{user.name}</span> with the{' '}
            <Badge tone="accent" size="sm">
              {user.role}
            </Badge>{' '}
            role. This page requires <code className="font-mono">admin</code>;
            the rest of the console requires{' '}
            <code className="font-mono">staff</code>.
          </p>

          <ul className="mt-4 space-y-2 border-t border-border pt-3 text-[12px] leading-relaxed text-faint">
            <li>
              Role checks run in the layout and again in every server action —
              an action is a public endpoint whose id is in the client bundle.
            </li>
            <li>
              A customer reaching an admin route gets a 404, not a 403.
              Confirming the console exists is a hint worth withholding.
            </li>
            <li>
              Every privileged action here is recorded in the append-only{' '}
              <Link href="/admin/audit" className="text-accent-text hover:underline">
                audit trail
              </Link>
              , including who did it and from where.
            </li>
          </ul>

          <Link
            href="/account/settings"
            className="mt-4 inline-block text-[12.5px] font-medium text-accent-text hover:underline"
          >
            Your own account settings
          </Link>
        </SectionCard>
      </div>
    </>
  )
}
