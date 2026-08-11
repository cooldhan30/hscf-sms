import 'server-only'

// Email delivery, with a deliberate fallback rather than a hard failure.
//
// If RESEND_API_KEY is configured the app sends the message itself, from
// the server, and the recipient gets it whether or not anyone is at a
// desk. If it is NOT configured -- which is the state of this project
// today -- sendEmail reports that nothing was sent and hands back a
// prefilled mailto: link instead, so the admin's own email client opens
// with the message ready and the reminder still actually goes out.
//
// Resend is called over plain HTTP rather than through its SDK: this is
// one POST with a JSON body, and a dependency for that is not worth the
// install or the version churn.

export interface EmailMessage {
  to: string[]
  subject: string
  text: string
}

export type EmailResult =
  | { sent: true }
  | { sent: false; reason: 'not-configured' | 'failed'; error?: string; mailto: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM)
}

// Opens the sender's own email client with everything filled in. Multiple
// recipients are comma-separated, which every mail client understands.
export function buildMailtoLink(message: EmailMessage): string {
  const params = new URLSearchParams({
    subject: message.subject,
    body: message.text,
  })
  return `mailto:${message.to.join(',')}?${params.toString()}`
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (message.to.length === 0) {
    return { sent: false, reason: 'failed', error: 'No recipient address', mailto: '' }
  }

  if (!isEmailConfigured()) {
    return { sent: false, reason: 'not-configured', mailto: buildMailtoLink(message) }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    })

    if (!res.ok) {
      // Most commonly an unverified sending domain. Surface it rather
      // than swallowing it, but still hand back the mailto so the admin
      // has a way to send the reminder right now.
      const detail = await res.text().catch(() => '')
      return {
        sent: false,
        reason: 'failed',
        error: detail.slice(0, 300) || `Email provider returned ${res.status}`,
        mailto: buildMailtoLink(message),
      }
    }

    return { sent: true }
  } catch (err) {
    return {
      sent: false,
      reason: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      mailto: buildMailtoLink(message),
    }
  }
}
