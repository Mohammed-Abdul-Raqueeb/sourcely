import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/password-forms'
import { AuthHeading } from '@/components/auth/form-shell'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <>
        <AuthHeading
          title="This link is incomplete"
          description="The reset link is missing its token. Links can be truncated by some email clients — request a fresh one and open it directly."
        />
        <ButtonLink href="/forgot-password" size="lg" fullWidth>
          Request a new link
        </ButtonLink>
        <p className="mt-6 text-center text-[13px] text-muted">
          <Link href="/login" className="font-medium text-accent-text hover:underline">
            Back to sign in
          </Link>
        </p>
      </>
    )
  }

  return <ResetPasswordForm token={token} />
}
