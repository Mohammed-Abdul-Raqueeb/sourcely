import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a Sourcely account to save products, compare specifications and send quotation requests.',
  robots: { index: false, follow: false },
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <RegisterForm next={next} />
}
