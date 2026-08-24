import type { Rfq } from '@/lib/domain/account'
import { SITE, CONTACT } from '@/lib/site'
import { formatPrice } from '@/lib/format'
import type { EmailMessage } from './types'

/**
 * Transactional email templates.
 *
 * Two constraints shape everything here and neither is negotiable:
 *
 *   1. Email clients are not browsers. Outlook renders through Word, Gmail
 *      strips <style> blocks and anything it does not recognise. So: tables
 *      for layout, inline styles only, no flexbox, no grid, no custom
 *      properties, no web fonts.
 *   2. Every message has a plain-text alternative carrying the same
 *      information. A text/plain part is what screen readers, corporate
 *      gateways that strip HTML, and spam filters actually read — an
 *      HTML-only message scores badly and reads as nothing at all.
 *
 * The palette is the Slate & Amber light theme rather than the dark one, which
 * is the correct choice even for a dark-first product: most clients render on
 * white and force-invert a dark message unpredictably.
 */

const COLOR = {
  bg: '#f4f4f1',
  surface: '#ffffff',
  border: '#e2e0db',
  text: '#16181d',
  muted: '#5b6068',
  faint: '#8b9098',
  accent: '#b46a05',
  accentBg: '#fdf5e7',
} as const

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"

/** HTML-escapes interpolated values. Product names and notes are user data. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function url(path: string): string {
  return `${SITE.url.replace(/\/$/, '')}${path}`
}

interface LayoutOptions {
  preheader: string
  heading: string
  body: string
  cta?: { label: string; href: string }
  footnote?: string
}

/**
 * The shell every message shares.
 *
 * `preheader` is the grey line a client shows next to the subject in the
 * inbox list. Left unset, clients pull the first text they find — usually
 * "View in browser" or the recipient's own address.
 */
function layout({ preheader, heading, body, cta, footnote }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:10px;">
          <tr>
            <td style="padding:28px 32px 0;">
              <span style="font-size:15px;font-weight:700;letter-spacing:-0.2px;color:${COLOR.text};">${escape(SITE.name)}</span>
              <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${COLOR.accent};margin:0 0 2px 3px;"></span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;color:${COLOR.text};">${escape(heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px 0;font-size:14.5px;line-height:1.65;color:${COLOR.muted};">
              ${body}
            </td>
          </tr>
          ${
            cta
              ? `<tr>
            <td style="padding:26px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:7px;background:${COLOR.accent};">
                    <a href="${cta.href}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">${escape(cta.label)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ''
          }
          ${
            footnote
              ? `<tr>
            <td style="padding:24px 32px 0;font-size:12.5px;line-height:1.6;color:${COLOR.faint};">
              ${footnote}
            </td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding:28px 32px 26px;">
              <div style="border-top:1px solid ${COLOR.border};padding-top:16px;font-size:12px;line-height:1.6;color:${COLOR.faint};">
                ${escape(SITE.legalName)}${CONTACT.email ? ` · <a href="mailto:${CONTACT.email}" style="color:${COLOR.faint};">${escape(CONTACT.email)}</a>` : ''}
                <br>You are receiving this because you have a ${escape(SITE.name)} account.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

export function passwordResetEmail(input: {
  to: { name: string; email: string }
  token: string
  expiresInMinutes: number
}): EmailMessage {
  const link = url(`/reset-password?token=${encodeURIComponent(input.token)}`)
  const expiry = `${input.expiresInMinutes} minutes`

  return {
    to: { name: input.to.name, email: input.to.email },
    subject: `Reset your ${SITE.name} password`,
    html: layout({
      preheader: `The link expires in ${expiry}.`,
      heading: 'Reset your password',
      body: [
        paragraph(`Hello ${escape(input.to.name.split(' ')[0] ?? 'there')},`),
        paragraph(
          `Someone asked to reset the password for the ${escape(SITE.name)} account registered to this address. Choose a new one using the button below.`
        ),
      ].join(''),
      cta: { label: 'Choose a new password', href: link },
      // Naming the expiry and the no-op path is what turns this from a
      // phishing-shaped email into one a cautious recipient can act on.
      footnote: [
        `This link expires in ${expiry} and can be used once.`,
        `If you did not request it, no action is needed — your password stays as it is.`,
        `<br><br>If the button does not work, copy this address into your browser:<br><span style="font-family:${MONO};font-size:11.5px;word-break:break-all;color:${COLOR.muted};">${escape(link)}</span>`,
      ].join(' '),
    }),
    text: [
      `Hello ${input.to.name.split(' ')[0] ?? 'there'},`,
      '',
      `Someone asked to reset the password for the ${SITE.name} account registered to this address.`,
      '',
      `Choose a new password: ${link}`,
      '',
      `This link expires in ${expiry} and can be used once.`,
      `If you did not request it, no action is needed — your password stays as it is.`,
      '',
      SITE.legalName,
    ].join('\n'),
  }
}

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

function lineItemsHtml(rfq: Rfq, names: Map<string, string>): string {
  const rows = rfq.items
    .map((item) => {
      const name = escape(names.get(item.productId) ?? item.productId)
      const price =
        item.quotedUnitPrice != null
          ? `${formatPrice(item.quotedUnitPrice)} each`
          : '<span style="color:' + COLOR.faint + ';">pending</span>'

      return `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${COLOR.border};font-size:13.5px;color:${COLOR.text};">${name}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${COLOR.border};font-size:13.5px;color:${COLOR.muted};text-align:right;white-space:nowrap;">${item.quantity} ×</td>
        <td style="padding:9px 0 9px 16px;border-bottom:1px solid ${COLOR.border};font-size:13.5px;color:${COLOR.text};text-align:right;white-space:nowrap;">${price}</td>
      </tr>`
    })
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;">${rows}</table>`
}

function lineItemsText(rfq: Rfq, names: Map<string, string>): string[] {
  return rfq.items.map((item) => {
    const name = names.get(item.productId) ?? item.productId
    const price =
      item.quotedUnitPrice != null ? ` @ ${formatPrice(item.quotedUnitPrice)} each` : ''
    return `  · ${item.quantity} × ${name}${price}`
  })
}

export function rfqReceivedEmail(input: {
  to: { name: string; email: string }
  rfq: Rfq
  productNames: Map<string, string>
}): EmailMessage {
  const { rfq } = input
  const link = url(`/account/rfq/${rfq.id}`)

  return {
    to: input.to,
    subject: `${rfq.reference} — we have your request`,
    references: rfq.reference,
    html: layout({
      preheader: `${rfq.items.length} ${rfq.items.length === 1 ? 'line' : 'lines'} received. We will respond with pricing.`,
      heading: 'Your request has been received',
      body: [
        paragraph(`Hello ${escape(input.to.name.split(' ')[0] ?? 'there')},`),
        paragraph(
          `We have your quotation request <strong style="color:${COLOR.text};font-family:${MONO};">${escape(rfq.reference)}</strong>. Our team will price it and respond; you will get an email as soon as the quotation is ready.`
        ),
        lineItemsHtml(rfq, input.productNames),
      ].join(''),
      cta: { label: 'Track this request', href: link },
    }),
    text: [
      `Hello ${input.to.name.split(' ')[0] ?? 'there'},`,
      '',
      `We have your quotation request ${rfq.reference}.`,
      '',
      ...lineItemsText(rfq, input.productNames),
      '',
      `Track it here: ${link}`,
      '',
      SITE.legalName,
    ].join('\n'),
  }
}

export function rfqQuotedEmail(input: {
  to: { name: string; email: string }
  rfq: Rfq
  productNames: Map<string, string>
}): EmailMessage {
  const { rfq } = input
  const link = url(`/account/rfq/${rfq.id}`)

  const total =
    rfq.quotedTotal != null
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;">
          <tr>
            <td style="padding:12px 0 0;font-size:13.5px;color:${COLOR.muted};">Total</td>
            <td style="padding:12px 0 0;font-size:17px;font-weight:600;color:${COLOR.text};text-align:right;font-family:${MONO};">${formatPrice(rfq.quotedTotal)}</td>
          </tr>
        </table>`
      : ''

  const validity = rfq.validUntil
    ? `This quotation is valid until ${new Date(rfq.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : ''

  return {
    to: input.to,
    subject: `${rfq.reference} — your quotation is ready`,
    references: rfq.reference,
    html: layout({
      preheader:
        rfq.quotedTotal != null
          ? `${formatPrice(rfq.quotedTotal)} for ${rfq.items.length} ${rfq.items.length === 1 ? 'line' : 'lines'}.`
          : 'Pricing is ready for your request.',
      heading: 'Your quotation is ready',
      body: [
        paragraph(`Hello ${escape(input.to.name.split(' ')[0] ?? 'there')},`),
        paragraph(
          `Pricing for <strong style="color:${COLOR.text};font-family:${MONO};">${escape(rfq.reference)}</strong> is ready.`
        ),
        lineItemsHtml(rfq, input.productNames),
        total,
      ].join(''),
      cta: { label: 'View the quotation', href: link },
      footnote: validity
        ? `${validity} Prices exclude GST unless stated otherwise on the quotation.`
        : 'Prices exclude GST unless stated otherwise on the quotation.',
    }),
    text: [
      `Hello ${input.to.name.split(' ')[0] ?? 'there'},`,
      '',
      `Pricing for ${rfq.reference} is ready.`,
      '',
      ...lineItemsText(rfq, input.productNames),
      ...(rfq.quotedTotal != null ? ['', `Total: ${formatPrice(rfq.quotedTotal)}`] : []),
      ...(validity ? ['', validity] : []),
      '',
      `View it here: ${link}`,
      '',
      SITE.legalName,
    ].join('\n'),
  }
}

/* -------------------------------------------------------------------------- */
/* Generic notification                                                       */
/* -------------------------------------------------------------------------- */

export function notificationEmail(input: {
  to: { name: string; email: string }
  title: string
  body: string
  href?: string | null
}): EmailMessage {
  const link = input.href ? url(input.href) : null

  return {
    to: input.to,
    subject: input.title,
    html: layout({
      preheader: input.body.slice(0, 120),
      heading: input.title,
      body: paragraph(escape(input.body)),
      ...(link ? { cta: { label: 'Open in Sourcely', href: link } } : {}),
    }),
    text: [
      input.title,
      '',
      input.body,
      ...(link ? ['', link] : []),
      '',
      SITE.legalName,
    ].join('\n'),
  }
}
