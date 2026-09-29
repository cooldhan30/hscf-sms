import 'server-only'
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Tamil text-to-speech via Sarvam (docs.sarvam.ai: POST /text-to-speech),
// cached in the private `gameroom-tts` bucket (migration 092) so each
// word/letter is synthesized -- and paid for -- only once. Used by the
// Little Learners game Listen & Choose.
//
// Model and voice are pinned like lib/sarvam.ts's chat model.
const TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech'
const TTS_MODEL = 'bulbul:v3'
const TTS_SPEAKER = 'kavitha'
const TTS_LANGUAGE = 'ta-IN'
const BUCKET = 'gameroom-tts'
const REQUEST_TIMEOUT_MS = 20_000
const LINK_TTL_SECONDS = 600

export class TtsUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TtsUnavailableError'
  }
}

// A signed link (10 minutes) to an MP3 of `text` spoken in Tamil.
export async function tamilSpeechUrl(admin: SupabaseClient, text: string): Promise<string> {
  const clean = text.trim().slice(0, 200)
  if (!clean) throw new TtsUnavailableError('Nothing to say')
  // The file name is a hash (with the voice settings), never the text
  const key = `${createHash('sha256').update(`${TTS_LANGUAGE}|${TTS_MODEL}|${TTS_SPEAKER}|${clean}`).digest('hex')}.mp3`
  const bucket = admin.storage.from(BUCKET)

  const { data: cached } = await bucket.exists(key)
  if (!cached) {
    const apiKey = process.env.SARVAM_API_KEY
    if (!apiKey) throw new TtsUnavailableError('SARVAM_API_KEY is not configured')

    const res = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        text: clean,
        language_code: TTS_LANGUAGE,
        model: TTS_MODEL,
        speaker: TTS_SPEAKER,
        pace: 0.85,
        output_audio_codec: 'mp3',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((e: unknown) => {
      throw new TtsUnavailableError(e instanceof Error ? e.message : 'Sarvam request failed')
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new TtsUnavailableError(`Sarvam TTS failed (${res.status}): ${body.slice(0, 300)}`)
    }
    const data = (await res.json().catch(() => null)) as { audios?: string[] } | null
    const audio = data?.audios?.[0]
    if (!audio) throw new TtsUnavailableError('Sarvam TTS returned no audio')

    const { error } = await bucket.upload(key, Buffer.from(audio, 'base64'), { contentType: 'audio/mpeg', upsert: true })
    if (error) throw new TtsUnavailableError(`Could not cache the audio: ${error.message}`)
    console.log(`[sarvam-tts] synthesized ${clean.length} chars`)
  }

  const { data: signed, error } = await bucket.createSignedUrl(key, LINK_TTL_SECONDS)
  if (error || !signed?.signedUrl) throw new TtsUnavailableError(error?.message ?? 'Could not sign the audio link')
  return signed.signedUrl
}
