import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { groqChatCompletion, GroqRateLimitError, GroqRequestError } from '@/lib/groq'

function buildSystemPrompt(targetAge: number | null, language: 'ta' | 'en'): string {
  const ageGuidance =
    targetAge && targetAge <= 6
      ? 'The reader is a very young child (around 4-6 years old). Use very simple, common Tamil words, short sentences, and a straightforward storyline.'
      : targetAge && targetAge <= 9
        ? 'The reader is a young child (around 7-9 years old). Use simple vocabulary with a bit more descriptive detail than a beginner story.'
        : targetAge && targetAge <= 12
          ? 'The reader is a child around 10-12 years old. Use richer vocabulary and a more developed storyline and characters.'
          : 'The reader is an older student. Use more advanced vocabulary and more detailed storytelling.'

  const themeNote =
    language === 'en'
      ? 'The theme below may be written in English -- understand it, but the story itself must still be written entirely in Tamil.'
      : 'The theme below is written in Tamil.'

  return [
    'You are a children\'s story writer for a Tamil language school.',
    'Write the ENTIRE story in Tamil script only -- no English words or transliteration.',
    'The story must have a clear beginning, middle, and end.',
    ageGuidance,
    'Avoid unnecessarily complex or archaic vocabulary.',
    themeNote,
    'Return only the story text -- no title, no preamble, no notes about the story.',
  ].join(' ')
}

// POST /api/generate-story -- teacher-only. Generates a children's Tamil
// story from a theme via Groq (see lib/groq.ts for the model/timeout/
// rate-limit handling this route relies on).
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const theme = requireString(body.theme, 'Theme', errors)
  const language = body.language === undefined ? 'ta' : requireEnum(body.language, ['ta', 'en'] as const, 'Language', errors)

  let targetAge: number | null = null
  if (body.targetAge !== undefined && body.targetAge !== null && body.targetAge !== '') {
    const parsed = Number(body.targetAge)
    if (Number.isNaN(parsed) || parsed <= 0) {
      errors.push('Target age must be a positive number')
    } else {
      targetAge = parsed
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const systemPrompt = buildSystemPrompt(targetAge, language ?? 'ta')

  try {
    const story = await groqChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: theme },
    ])

    return NextResponse.json({ story })
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json(
        { error: 'Story generation is rate-limited right now -- please try again in a minute.' },
        { status: 429 }
      )
    }
    if (err instanceof GroqRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 })
  }
}
