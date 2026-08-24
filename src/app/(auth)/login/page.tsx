import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { DEMO_ACCOUNTS } from '@/server/repositories/memory/store'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Sourcely account to manage shortlists, comparisons and quotation requests.',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <LoginForm next={next} demo={DEMO_ACCOUNTS.customer} />
}
