import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPPool from 'nodemailer/lib/smtp-pool'
import type { EmailAddress, EmailMessage, Mailer, SendResult } from './types'

/**
 * Mail transports.
 *
 *   smtp    anything speaking SMTP — Amazon SES, Postmark, a corporate relay.
 *   resend  Resend's HTTP API, which needs no outbound SMTP port and so works
 *           on hosts that block 25/465/587 (most serverless platforms do).
 *   log     writes the message to the server log instead of sending it.
 *
 * The transport is chosen by which environment variables are present, so
 * nothing above this file knows or cares which one is in use.
 */

function formatAddress(address: EmailAddress): string {
  // Quote the display name: an unescaped comma or colon in it produces a
  // header the receiving server parses as two recipients.
  return address.name ? `"${address.name.replace(/"/g, '')}" <${address.email}>` : address.email
}

function sender(): EmailAddress {
  return {
    email: process.env.MAIL_FROM ?? 'no-reply@localhost',
    name: process.env.MAIL_FROM_NAME ?? 'Sourcely',
  }
}

/* -------------------------------------------------------------------------- */
/* SMTP                                                                       */
/* -------------------------------------------------------------------------- */

declare global {
  var __sourcelySmtp: Transporter | undefined
}

/**
 * Parses `SMTP_URL` into explicit options.
 *
 * One variable rather than five, and the parse is done here rather than handed
 * to nodemailer as a URL string so the defaults are visible: implicit TLS on
 * 465 for `smtps:`, STARTTLS on 587 otherwise. Credentials are
 * percent-decoded, because SMTP passwords routinely contain `@` and `/`.
 */
function smtpOptions(): SMTPPool.Options {
  const url = new URL(process.env.SMTP_URL!)
  const secure = url.protocol === 'smtps:'

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : secure ? 465 : 587,
    secure,
    ...(url.username
      ? {
          auth: {
            user: decodeURIComponent(url.username),
            pass: decodeURIComponent(url.password),
          },
        }
      : {}),

    // Pooled: opening a TLS connection per message is the biggest cost in this
    // path, and providers rate-limit new connections far harder than messages
    // on an established one.
    pool: true,
    maxConnections: 3,

    // Without these a black-holed relay holds the socket until the platform's
    // own request timeout fires.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  }
}

class SmtpMailer implements Mailer {
  readonly name = 'smtp' as const

  private transporter(): Transporter {
    // Memoised on globalThis so dev-server module reloads reuse the pool
    // rather than leaking a connection per file save.
    globalThis.__sourcelySmtp ??= nodemailer.createTransport(smtpOptions())
    return globalThis.__sourcelySmtp
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const info = await this.transporter().sendMail({
      from: formatAddress(sender()),
      to: formatAddress(message.to),
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.references ? { references: message.references } : {}),
    })

    // Accepted by the relay is not delivered. Anything reported as sent here
    // may still bounce afterwards.
    return { ok: true, transport: 'smtp', id: info.messageId }
  }
}

/* -------------------------------------------------------------------------- */
/* Resend                                                                     */
/* -------------------------------------------------------------------------- */

class ResendMailer implements Mailer {
  readonly name = 'resend' as const

  async send(message: EmailMessage): Promise<SendResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formatAddress(sender()),
        to: [formatAddress(message.to)],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      // Read the body for the provider's reason — "failed with 422" alone
      // sends whoever is on call to read Resend's docs instead of the log.
      const detail = await response.text().catch(() => '')
      throw new Error(`resend responded ${response.status}: ${detail.slice(0, 300)}`)
    }

    const body = (await response.json()) as { id?: string }
    return { ok: true, transport: 'resend', id: body.id }
  }
}

/* -------------------------------------------------------------------------- */
/* Log                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The fallback when nothing is configured.
 *
 * It deliberately prints the whole plain-text body, including any link. A
 * developer running the password-reset flow locally needs that link, and the
 * alternative — silently discarding the message and reporting success — makes
 * a broken mail configuration indistinguishable from a working one.
 */
class LogMailer implements Mailer {
  readonly name = 'log' as const

  async send(message: EmailMessage): Promise<SendResult> {
    console.info(
      [
        '',
        '─── email (not sent: no transport configured) ───────────────────',
        `To:      ${formatAddress(message.to)}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '─────────────────────────────────────────────────────────────────',
        '',
      ].join('\n')
    )
    return { ok: true, transport: 'log' }
  }
}

/* -------------------------------------------------------------------------- */

export function resolveMailer(): Mailer {
  if (process.env.RESEND_API_KEY) return new ResendMailer()
  if (process.env.SMTP_URL) return new SmtpMailer()
  return new LogMailer()
}

/** Which transport the next send will use. For the admin diagnostics page. */
export function mailTransportName(): SendResult['transport'] {
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SMTP_URL) return 'smtp'
  return 'log'
}

/** True when a real transport is configured and a sender address is set. */
export function mailConfigured(): boolean {
  return mailTransportName() !== 'log' && Boolean(process.env.MAIL_FROM)
}
