import 'server-only'
import { mailConfigured, mailTransportName, resolveMailer } from './transports'
import type { EmailMessage, SendResult } from './types'

export type { EmailMessage, SendResult } from './types'
export { mailConfigured, mailTransportName } from './transports'
export * from './templates'

/**
 * Sends a transactional email.
 *
 * Never throws. A quotation is not un-issued because the notification about it
 * bounced, and a password reset that fails to email must still have created a
 * valid token. Every caller is a business action that has already succeeded by
 * the time this runs, so a transport failure is logged and swallowed rather
 * than propagated into a user-facing error.
 *
 * That does mean a silent failure is possible, which is why `mailConfigured()`
 * is surfaced on the admin diagnostics page: the place to notice that mail is
 * broken is a dashboard, not a customer complaint.
 */
export async function sendMail(message: EmailMessage): Promise<SendResult> {
  const mailer = resolveMailer()

  try {
    const result = await mailer.send(message)
    if (result.transport !== 'log') {
      console.info(`[mail] ${message.subject} -> ${message.to.email} via ${result.transport}`)
    }
    return result
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[mail] failed to send "${message.subject}" to ${message.to.email}:`, reason)
    return { ok: false, transport: mailTransportName(), error: reason }
  }
}

/**
 * Fire-and-forget send.
 *
 * For the common case where the caller is a server action whose response the
 * user is waiting on. An SMTP handshake can take several seconds, and holding
 * a form submission open for it makes the whole application feel slow.
 */
export function sendMailInBackground(message: EmailMessage): void {
  void sendMail(message)
}

/** Whether a real transport is configured. Shown on the admin settings page. */
export function mailReady(): boolean {
  return mailConfigured()
}
