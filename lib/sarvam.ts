import 'server-only'

// Model is pinned deliberately -- do not change without an explicit ask.
// sarvam-m and sarvam-30b are deprecated; sarvam-105b is the current model.
export const SARVAM_MODEL = 'sarvam-105b'

const SARVAM_ENDPOINT = 'https://api.sarvam.ai/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000

export class SarvamRateLimitError extends Error {
  constructor() {
    super('Sarvam rate limit reached')
    this.name = 'SarvamRateLimitError'
  }
}

export class SarvamRequestError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'SarvamRequestError'
  }
}

interface SarvamChatMessage {
  role: 'system' | 'user'
  content: string
}

// Thin wrapper over Sarvam's OpenAI-compatible chat completions endpoint --
// plain fetch rather than an SDK dependency, matching lib/groq.ts and every
// other external API in this app.
export async function sarvamChatCompletion(messages: SarvamChatMessage[], maxTokens = 2048): Promise<string> {
  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) {
    throw new SarvamRequestError('SARVAM_API_KEY is not configured')
  }

  let res: Response
  try {
    res = await fetch(SARVAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SARVAM_MODEL,
        messages,
        temperature: 0.8,
        // sarvam-105b is a reasoning model with thinking mode ON by
        // default -- unlike Groq's qwen model (which takes the STRING
        // 'none' for reasoning_effort), Sarvam's API takes a literal
        // JSON null here. Passing anything else (including omitting the
        // field) lets it burn the entire max_tokens budget on invisible
        // reasoning and return empty content with finish_reason "length".
        // Do not "fix" this to match Groq's 'none' convention.
        reasoning_effort: null,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new SarvamRequestError('Sarvam request timed out after 30 seconds')
    }
    throw new SarvamRequestError(err instanceof Error ? err.message : 'Sarvam request failed')
  }

  if (res.status === 429) {
    throw new SarvamRateLimitError()
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`Sarvam request failed (${res.status}): ${body || res.statusText}`)
    throw new SarvamRequestError(`Sarvam request failed (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  const rawContent = data?.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    console.error('Sarvam response missing choices/content:', JSON.stringify(data))
    throw new SarvamRequestError('Sarvam returned an empty response')
  }

  if (typeof data?.usage?.total_tokens === 'number') {
    console.log(`[sarvam] model=${SARVAM_MODEL} tokens=${data.usage.total_tokens}`)
  }

  // Defense-in-depth: reasoning_effort: null above should mean there's
  // never a <think> block in the response, but strip one if it somehow
  // appears rather than showing raw chain-of-thought text to a teacher.
  const withoutThinking = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  return withoutThinking || rawContent.trim()
}
