export interface EmailAddress {
  name?: string
  email: string
}

export interface EmailMessage {
  to: EmailAddress
  subject: string
  /** Plain-text body. Always present — never send HTML alone. */
  text: string
  html: string
  /** Threading hint so a conversation about one quotation stays together. */
  references?: string
}

export interface SendResult {
  ok: boolean
  /** Transport that handled it, for the admin diagnostics page. */
  transport: 'smtp' | 'resend' | 'log'
  /** Provider message id where one is returned. */
  id?: string
  error?: string
}

export interface Mailer {
  readonly name: SendResult['transport']
  send(message: EmailMessage): Promise<SendResult>
}
