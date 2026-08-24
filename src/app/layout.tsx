import type { Metadata, Viewport } from 'next'
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { SITE } from '@/lib/site'

/**
 * Three faces, three jobs:
 *   Archivo       display — headlines, section titles
 *   Inter         UI      — body, labels, controls
 *   JetBrains Mono data   — SKUs, prices, spec values, match scores
 *
 * Loaded as variables so `@theme inline` in globals.css can bind them to
 * `font-display` / `font-sans` / `font-mono` utilities.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    'industrial products',
    'B2B procurement',
    'AI product search',
    'HVAC',
    'valves',
    'electrical',
    'RFQ',
    'industrial supply India',
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      data-theme="dark"
      className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Synchronous and external. It has to run before first paint or a
          light-theme user sees a dark flash, and it has to be external so the
          Content-Security-Policy needs neither 'unsafe-inline' nor a nonce —
          a nonce would mean reading headers() here, which opts every
          prerendered page out of static generation. See src/middleware.ts.
        */}
        {/*
          Intentionally blocking — no async, no defer, not next/script.
          Deferring it by any means lets the body paint in the default dark
          theme first, so every light-theme visitor gets a flash on every
          navigation. The file is under a kilobyte, same-origin and cached
          immutably, so the cost is one cheap round trip on a cold load.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
