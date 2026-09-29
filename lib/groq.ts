import 'server-only'

// Model is pinned deliberately -- do not change without an explicit ask.
// If Groq deprecates/removes this model, the chat-completion call below
// will start failing; check console.groq.com/docs/deprecations for a
// replacement before swapping this constant.
export const GROQ_MODEL = 'qwen/qwen3.8-27b'

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
        // qwen/qwen3.6-27b is a reasoning model -- by default it emits a
        // <think>...</think> chain-of-thought block before the real
        // answer, and that reasoning can be long enough to exhaust the
        // response on its own (confirmed directly against the live API:
        // a plain request hit finish_reason "length" with a 4000-token
        // cap and never even reached the closing </think> tag). Groq
        // exposes reasoning_effort: 'none' specifically to skip this for
        // models like this one -- there is no partial/low setting, only
        // 'none' or 'default'.
        reasoning_effort: 'none',
        max_tokens: 4000,
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
  const rawContent = data?.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new GroqRequestError('Groq returned an empty response')
  }

  if (typeof data?.usage?.total_tokens === 'number') {
    console.log(`[groq] model=${GROQ_MODEL} tokens=${data.usage.total_tokens}`)
  }

  // Defense-in-depth: reasoning_effort: 'none' above should mean there's
  // never a <think> block in the response, but strip one if it somehow
  // appears rather than showing raw chain-of-thought text to a teacher.
  const withoutThinking = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  return withoutThinking || rawContent.trim()
}

// Confirmed as a real, reproducible issue by direct testing: short/
// simple stories (Nilai 1-2 level constraints) substitute a different
// animal/character than the requested theme in roughly half of runs --
// not fixable through prompt wording alone. This does one cheap extra
// Groq call asking a yes/no relevance question, so the caller can retry
// generation once instead of silently shipping an off-topic story.
// Fails open (treats a check failure as "matches") since a broken
// verification call should never block story generation entirely.
export async function verifyStoryMatchesTheme(story: string, theme: string): Promise<boolean> {
  try {
    const answer = await groqChatCompletion([
      {
        role: 'system',
        content:
          'You check whether a short Tamil story matches a given theme. Answer with exactly one word: YES or NO. Answer NO if the story is about a clearly different subject/character than the theme (e.g. theme is "monkey" but the story is about a deer or bear).',
      },
      { role: 'user', content: `Theme: ${theme}\n\nStory: ${story}\n\nDoes this story match the theme?` },
    ])
    return answer.toUpperCase().includes('YES')
  } catch {
    return true
  }
}

// Vision model for reading a resource image's title (Resources upload).
// Pinned like GROQ_MODEL. Chosen by testing on real Tamil story pages:
// with the image scaled to 1024px wide it read 4 of 5 titles exactly and
// the fifth to within one letter (the teacher reviews every name anyway).
export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b'

export class GroqVisionRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('Groq rate limit reached')
    this.name = 'GroqVisionRateLimitError'
  }
}

// Returns the title printed on the image, or null if there isn't one.
// imageDataUrl: a data:image/...;base64 URL (the browser sends a
// downscaled JPEG). Throws GroqVisionRateLimitError on 429 so the caller
// can tell the browser how long to wait before the next image.
export async function groqReadImageTitle(imageDataUrl: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new GroqRequestError('GROQ_API_KEY is not configured')

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      reasoning_effort: 'none',
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This image is a page from a Tamil school resource (often a story). Reply with ONLY its title or main heading exactly as written, in the original script. If there is no clear title, reply NONE.',
            },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after'))
    throw new GroqVisionRateLimitError(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 10)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GroqRequestError(`Groq vision request failed (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  const raw: unknown = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string') return null
  const title = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^["'“”*#\s]+|["'“”*.\s]+$/g, '')
  return !title || /^none$/i.test(title) ? null : title
}
