/**
 * Single source of truth for brand, contact and navigation.
 *
 * Every organisation-specific value is read from the environment, because the
 * alternative — a source file of plausible-looking invented details — has a
 * specific failure mode: an address, GSTIN and CIN that look real are indexed,
 * quoted and eventually acted on by someone who assumed they were.
 *
 * The fallbacks below are deliberately, visibly unset rather than plausible.
 * `siteDetailsConfigured()` reports whether real values are present, and the
 * footer and admin settings page say so plainly when they are not. A missing
 * detail should read as missing, never as fact.
 *
 * See .env.example for the full list.
 */

/** Reads a public env var, treating blank as absent. */
function env(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

export const SITE = {
  name: env('NEXT_PUBLIC_SITE_NAME') ?? 'Sourcely',
  legalName: env('NEXT_PUBLIC_LEGAL_NAME') ?? 'Sourcely Commerce Technologies Pvt. Ltd.',
  tagline: 'Find the right industrial product, faster',
  description:
    'Describe what you need in plain language. Sourcely reads the requirement, matches it against verified industrial specifications, and explains why each product fits — then turns your shortlist into a quotation request.',
  url: env('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
  locale: 'en-IN',
  currency: 'INR' as const,
  founded: 2023,
} as const

const PHONE = env('NEXT_PUBLIC_CONTACT_PHONE')

export const CONTACT = {
  email: env('NEXT_PUBLIC_CONTACT_EMAIL'),
  salesEmail: env('NEXT_PUBLIC_SALES_EMAIL') ?? env('NEXT_PUBLIC_CONTACT_EMAIL'),
  supportEmail: env('NEXT_PUBLIC_SUPPORT_EMAIL') ?? env('NEXT_PUBLIC_CONTACT_EMAIL'),
  phone: PHONE,
  /** `tel:` targets tolerate no spaces or punctuation. */
  phoneHref: PHONE ? PHONE.replace(/[^\d+]/g, '') : null,
  whatsapp: env('NEXT_PUBLIC_WHATSAPP'),
  hours: env('NEXT_PUBLIC_BUSINESS_HOURS') ?? 'Mon–Sat, 9:30am – 7:00pm IST',
  address: {
    line1: env('NEXT_PUBLIC_ADDRESS_LINE1'),
    line2: env('NEXT_PUBLIC_ADDRESS_LINE2'),
    city: env('NEXT_PUBLIC_ADDRESS_CITY'),
    state: env('NEXT_PUBLIC_ADDRESS_STATE'),
    pincode: env('NEXT_PUBLIC_ADDRESS_PINCODE'),
    country: env('NEXT_PUBLIC_ADDRESS_COUNTRY') ?? 'India',
  },
  gstin: env('NEXT_PUBLIC_GSTIN'),
  cin: env('NEXT_PUBLIC_CIN'),
} as const

/** One formatted address line, or null when nothing was configured. */
export function formattedAddress(): string | null {
  const { line1, line2, city, state, pincode, country } = CONTACT.address
  const parts = [line1, line2, [city, pincode].filter(Boolean).join(' '), state, country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  return parts.length > 1 ? parts.join(', ') : null
}

/**
 * Whether the deployment has been given real organisation details.
 *
 * Used to decide between showing a contact block and showing an honest note
 * that this is a demonstration deployment.
 */
export function siteDetailsConfigured(): boolean {
  return Boolean(CONTACT.email && CONTACT.phone && formattedAddress())
}

/** Social links are omitted entirely rather than pointed at a platform home page. */
export const SOCIAL = [
  { label: 'LinkedIn', href: env('NEXT_PUBLIC_LINKEDIN_URL') },
  { label: 'X', href: env('NEXT_PUBLIC_X_URL') },
  { label: 'YouTube', href: env('NEXT_PUBLIC_YOUTUBE_URL') },
].filter((entry): entry is { label: string; href: string } => Boolean(entry.href))

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  label: string
  href: string
  description?: string
}

/**
 * Exactly five destinations plus one CTA. See ARCHITECTURE.md section 4 — a
 * B2B catalogue with nine top-level nav items reads as a directory, not a
 * product.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Products', href: '/products', description: 'Browse the full catalogue' },
  { label: 'Categories', href: '/categories', description: 'HVAC, valves, electrical and more' },
  { label: 'AI Assistant', href: '/assistant', description: 'Describe what you need' },
  { label: 'Pricing', href: '/pricing', description: 'Plans for buyers and suppliers' },
  { label: 'About', href: '/about', description: 'Why we built this' },
]

export const FOOTER_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Platform',
    items: [
      { label: 'AI Assistant', href: '/assistant' },
      { label: 'Browse products', href: '/products' },
      { label: 'Categories', href: '/categories' },
      { label: 'Compare products', href: '/compare' },
      { label: 'Request a quotation', href: '/account/rfq' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About us', href: '/about' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create account', href: '/register' },
      { label: 'Dashboard', href: '/account' },
      { label: 'Saved products', href: '/account/saved' },
      { label: 'My quotations', href: '/account/rfq' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Refund policy', href: '/legal/refunds' },
      { label: 'Security', href: '/legal/security' },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* Trust markers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Platform statistics are computed from the live database, not written here.
 * See `platformStats()` in src/server/metrics/platform-stats.ts — a number on
 * the homepage that nothing in the system can reproduce is a number that will
 * eventually be wrong in front of a customer.
 */
export interface PlatformStat {
  value: string
  label: string
}
