import 'server-only'

// Model is pinned deliberately -- do not change without an explicit ask.
// If Groq deprecates/removes this model, the chat-completion call below
// will start failing; check console.groq.com/docs/deprecations for a
// replacement before swapping this constant.
export const GROQ_MODEL = 'qwen/qwen3.6-27b'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000

export class GroqRateLimitError extends Error {
  constructor() {
    super('Groq rate limit reached')
    this.name = 'GroqRateLimitError'
  }
}

export class GroqRequestError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'GroqRequestError'
  }
}

interface GroqChatMessage {
  role: 'system' | 'user'
  content: string
}

// Thin wrapper over Groq's OpenAI-compatible chat completions endpoint --
// plain fetch rather than an SDK dependency, matching how every other
// external API in this app (B2, Resend) is called directly rather than
// through a client library.
export async function groqChatCompletion(messages: GroqChatMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new GroqRequestError('GROQ_API_KEY is not configured')
  }

  let res: Response
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new GroqRequestError('Groq request timed out after 30 seconds')
    }
    throw new GroqRequestError(err instanceof Error ? err.message : 'Groq request failed')
  }

  if (res.status === 429) {
    throw new GroqRateLimitError()
  }

  if (res.status === 404 || res.status === 400) {
    // Groq returns 400/404 for an unknown/deprecated model id, not a
    // dedicated status code -- surface this distinctly from a generic
    // failure so it doesn't get misread as a transient error.
    const body = await res.text().catch(() => '')
    if (/model/i.test(body)) {
      console.error(
        `Groq rejected model "${GROQ_MODEL}" -- it may be deprecated or renamed. ` +
          `Check console.groq.com/docs/deprecations for a replacement and update GROQ_MODEL in lib/groq.ts. ` +
          `Response: ${body}`
      )
      throw new GroqRequestError(`Groq model "${GROQ_MODEL}" was rejected -- see server logs`, res.status)
    }
    throw new GroqRequestError(`Groq request failed: ${body || res.statusText}`, res.status)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GroqRequestError(`Groq request failed (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new GroqRequestError('Groq returned an empty response')
  }

  return content.trim()
}
