import type { ReactNode } from 'react'

/**
 * Legal and policy pages.
 *
 * These describe what the software actually does — what it stores, how long it
 * keeps it, how passwords and addresses are handled — and every statement here
 * is checkable against the code. That makes them genuinely useful.
 *
 * What they are not is a binding contract drafted for a specific company. That
 * document depends on the operating entity, its jurisdiction and its insurance,
 * none of which a codebase knows. So each page carries a visible notice saying
 * so, rather than presenting invented terms in a tone that implies a lawyer
 * wrote them. A convincing-looking legal page that nobody reviewed is worse
 * than an honest one.
 */

export const LEGAL_SLUGS = ['terms', 'privacy', 'refunds', 'security'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

export interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface LegalDocument {
  slug: LegalSlug
  title: string
  lede: string
  /** ISO date the wording last changed. Rendered, so it must be maintained. */
  updated: string
  sections: LegalSection[]
}

export const LEGAL_NAV: { slug: LegalSlug; label: string }[] = [
  { slug: 'terms', label: 'Terms of service' },
  { slug: 'privacy', label: 'Privacy policy' },
  { slug: 'refunds', label: 'Refund policy' },
  { slug: 'security', label: 'Security' },
]

const UPDATED = '2026-08-01'

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: 'terms',
    title: 'Terms of service',
    lede: 'What the platform undertakes to do, what it does not, and where responsibility sits between a buyer and a supplier.',
    updated: UPDATED,
    sections: [
      {
        heading: 'What this service is',
        paragraphs: [
          'Sourcely is a product discovery and quotation platform for industrial supply. It indexes supplier catalogues, matches a stated requirement against them, and carries a quotation request from a buyer to a supplier.',
          'It is not a party to any resulting transaction. Pricing, delivery, warranty and settlement are agreed directly between the buyer and the supplier, and the terms of that agreement are theirs.',
        ],
      },
      {
        heading: 'Catalogue information',
        paragraphs: [
          'Specifications, prices and availability are supplied by the listing supplier. Reasonable steps are taken to structure and validate that data, but the platform does not independently verify each figure.',
          'Prices shown in the catalogue are indicative and exclusive of GST unless stated otherwise. The binding figure is the one on a quotation. Availability reflects the last update received and is not a reservation.',
        ],
      },
      {
        heading: 'Match scores and recommendations',
        paragraphs: [
          'The match percentage is a computed measure of fit against the requirement as parsed. It is a search aid, not an engineering assessment, and it does not certify a product as suitable for a particular installation.',
          'Selection remains the buyer’s responsibility. Where an application is safety-critical, pressure-bearing, or subject to statutory certification, verify the specification against the manufacturer datasheet before ordering.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'You are responsible for the confidentiality of your credentials and for activity under your account. Notify us immediately if you believe an account has been accessed without authorisation; you can end every other session yourself from account settings.',
          'Accounts may be suspended for activity that degrades the service for others — automated scraping, attempts to circumvent rate limits, or submitting quotation requests without a genuine intent to buy.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: ['You agree not to:'],
        bullets: [
          'extract the catalogue by automated means, or attempt to reconstruct it in bulk',
          'probe, scan or test the security of the platform without written authorisation',
          'submit content that infringes a third party’s rights or misrepresents a product',
          'use quotation requests to harvest supplier pricing without a genuine requirement',
        ],
      },
      {
        heading: 'Availability',
        paragraphs: [
          'The service is provided on a reasonable-efforts basis. Maintenance is scheduled outside Indian business hours where practical, and unplanned interruptions will be resolved as quickly as reasonably possible. No specific uptime is guaranteed except under a separate written agreement.',
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          'To the extent permitted by law, the platform is not liable for indirect or consequential loss, including loss of profit, contract or production, arising from the use of the service or from a transaction agreed through it.',
          'Nothing here limits liability that cannot be limited by law.',
        ],
      },
      {
        heading: 'Governing law',
        paragraphs: [
          'These terms are governed by the laws of India, with exclusive jurisdiction in the courts of the operating entity’s registered location.',
        ],
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Privacy policy',
    lede: 'What is collected, why it is collected, how long it is kept, and what you can remove yourself.',
    updated: UPDATED,
    sections: [
      {
        heading: 'What is collected',
        paragraphs: [
          'Account details you provide: name, email address, and optionally company, phone, city and GSTIN. GSTIN is collected because business supply in India is invoiced against it, and it is used for nothing else.',
          'Activity generated by using the platform: searches and their result counts, products viewed and saved, comparisons, quotation requests and the messages on them.',
          'Technical data needed to operate the service: a visitor identifier cookie, and the client address of privileged actions — stored only as a salted hash, never in the clear.',
        ],
      },
      {
        heading: 'What is not collected',
        paragraphs: [
          'No third-party advertising or analytics trackers are embedded. No behavioural profile is built for advertising, and no personal data is sold or rented to anybody.',
          'Passwords are not stored. What is stored is a bcrypt hash from which the password cannot be recovered, including by us.',
        ],
      },
      {
        heading: 'Why searches are recorded',
        paragraphs: [
          'Search records exist to find the gaps: a query that returned nothing is either a product the catalogue lacks or vocabulary the parser did not recognise, and the two need different fixes.',
          'Aggregate demand — what buyers in a category searched for and did not find — is shared with suppliers in that category. It never identifies the buyer, their company, or any individual search.',
          'Your own history is visible on your dashboard and you can clear it at any time.',
        ],
      },
      {
        heading: 'Who sees your data',
        paragraphs: [
          'A quotation request is visible to the supplier it is addressed to, including the contact and delivery details you entered, because a quotation cannot be produced without them.',
          'Platform staff can see quotation records in order to operate the service. Every such access to an account or quotation record is written to an append-only audit trail.',
          'Nothing else about your account is visible to other buyers or to suppliers you have not contacted.',
        ],
      },
      {
        heading: 'Where a language model is involved',
        paragraphs: [
          'When AI assistance is enabled, the text of your query is sent to the model provider to be converted into a structured requirement, and computed results are sent to be rephrased.',
          'Your account details, saved products and quotation history are not sent. The model is not trained on your data, and the deployment can be run with the model disabled entirely — the same products are returned, ranked identically.',
        ],
      },
      {
        heading: 'Retention',
        paragraphs: [
          'Account and quotation records are kept while the account is open and for the period required for tax and contractual purposes afterwards.',
          'Search and view events are retained for analysis and then aggregated. Audit entries are retained on a fixed schedule and cannot be edited or deleted through the application by anyone, including administrators.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can access and correct your details in account settings, clear your search history, remove saved products and searches, and end sessions on other devices at any time.',
          'To request a copy of your data or its deletion, contact us. Deletion is subject to records we are required to retain — quotation history with tax implications, for instance.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'Two cookies are set, both strictly necessary and neither used for advertising: a session cookie once you sign in, and a visitor identifier so an anonymous shortlist survives navigation and can be carried into an account you create later.',
          'Both are httpOnly and SameSite-restricted, so neither is readable by page scripts or sent on cross-site requests.',
        ],
      },
    ],
  },

  refunds: {
    slug: 'refunds',
    title: 'Refund policy',
    lede: 'Two different things can be refunded here, and they work differently: platform subscriptions, and goods bought from a supplier.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Goods purchased from a supplier',
        paragraphs: [
          'Sourcely does not sell goods and does not take payment for them. A quotation is priced and settled directly with the supplier, so returns, replacements and refunds are governed by that supplier’s terms and by the quotation you accepted.',
          'Check the return window, restocking charge and freight responsibility on the quotation before accepting it. Made-to-order and cut-to-length items are commonly non-returnable, and that is a supplier term rather than a platform one.',
          'If a supplier will not honour terms stated on a quotation issued through the platform, tell us. We can see the quotation, its messages and the audit record of every change to it, and we will intervene — though the contract remains between you and them.',
        ],
      },
      {
        heading: 'Platform subscriptions',
        paragraphs: [
          'Supplier and enterprise plans are billed in advance. Cancel at any time and the account stays active, with listings live, until the end of the paid period. No pro-rata refund is given for a partial month.',
          'A first annual subscription can be refunded in full within 14 days of the initial payment if the platform has not been used to respond to a quotation in that period.',
          'Where a billing error is ours — a duplicate charge, or a charge after a cancellation was confirmed — it is refunded in full to the original payment method.',
        ],
      },
      {
        heading: 'Buyer accounts',
        paragraphs: [
          'Buyer accounts are free, so there is nothing to refund. Search, comparison, the assistant and quotation requests remain free permanently rather than for a trial period.',
        ],
      },
      {
        heading: 'How to raise one',
        paragraphs: [
          'For a subscription, contact us with the account email and the invoice reference; approved refunds are processed to the original payment method, typically within 7 to 10 working days depending on your bank.',
          'For goods, raise it on the quotation thread so the supplier, the specification and the pricing stay in one place.',
        ],
      },
    ],
  },

  security: {
    slug: 'security',
    title: 'Security',
    lede: 'How authentication, authorisation, data handling and disclosure are actually implemented.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Authentication',
        paragraphs: [
          'Passwords are hashed with bcrypt at cost factor 12 and are never stored, logged or transmitted in a recoverable form.',
          'Sign-in performs a hash comparison whether or not the address is registered, so response time cannot be used to discover who has an account. The same uniform message is returned either way.',
          'Sessions are signed tokens backed by a server-side record, so a session can be revoked immediately rather than remaining valid until it expires. Changing your password ends every other session.',
          'Sign-in, registration and password reset are rate limited per client address, and reset tokens are single-use and expire in one hour.',
        ],
      },
      {
        heading: 'Authorisation',
        paragraphs: [
          'Route guards run in middleware as a fast path, but they are not the security boundary. Every protected page and every action re-checks against the session store, and every query for buyer data carries the owner’s identifier in the query itself.',
          'That means a page which forgot to check still cannot read another buyer’s data, because the query cannot express it. Requests for a resource you do not own return 404 rather than 403 — confirming that something exists is itself a disclosure.',
        ],
      },
      {
        heading: 'Data protection',
        paragraphs: [
          'Traffic is served over TLS. Client addresses in the audit trail are stored as salted hashes rather than in the clear, which answers the question an audit trail needs to answer without holding the address itself.',
          'Uploaded images are validated on their actual bytes rather than their filename or declared type, then decoded and re-encoded. That removes embedded scripts, polyglot payloads and EXIF metadata — which routinely carries GPS coordinates a supplier did not intend to publish.',
          'Exported files are generated on demand, marked uncacheable, and every export is recorded in the audit trail with the account that requested it.',
        ],
      },
      {
        heading: 'Application hardening',
        paragraphs: [
          'A Content-Security-Policy is applied to every response, with a per-request nonce on authenticated and interactive routes. Framing is denied outright, content-type sniffing is disabled, and plugin content is blocked.',
          'Form submissions and state-changing API calls are origin-checked. Session and visitor cookies are httpOnly and SameSite-restricted.',
          'Input is validated against a schema at the server boundary, and rate limits apply to authentication, the AI endpoint, quotation submission and uploads.',
        ],
      },
      {
        heading: 'The audit trail',
        paragraphs: [
          'Privileged actions — product edits, status changes, quotation pricing, sign-ins, session revocations and data exports — are written to an append-only log recording the actor, the action, the fields that changed, and a hash of the client address.',
          'There is no edit or delete path anywhere in the application. Retention is a scheduled database job, so an operator cannot quietly remove an entry about themselves.',
        ],
      },
      {
        heading: 'Reporting a vulnerability',
        paragraphs: [
          'If you believe you have found a security issue, report it to us before disclosing it publicly and allow reasonable time for a fix. Include enough detail to reproduce it.',
          'Please do not run automated scanners against the production service, access or modify data that is not yours, or degrade the service for other users while testing. Good-faith research reported this way will not be pursued.',
        ],
      },
    ],
  },
}

export type { ReactNode }
