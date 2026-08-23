import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { groqChatCompletion, GroqRateLimitError, GroqRequestError } from '@/lib/groq'
import { sarvamChatCompletion } from '@/lib/sarvam'
import { STORY_LEVEL_GUIDANCE, STORY_LEVEL_VALUES, type StoryLevel } from '@/lib/storyLevels'
import { isWorksheetContent, type WorksheetContent } from '@/lib/worksheetTypes'

class WorksheetParseError extends Error {
  constructor() {
    super('The generator returned malformed content -- please try again')
    this.name = 'WorksheetParseError'
  }
}

function buildSystemPrompt(language: 'ta' | 'en', level: StoryLevel): string {
  const guidance = STORY_LEVEL_GUIDANCE[level]

  const themeNote =
    language === 'en'
      ? 'The theme below may be written in English -- understand it, but all Tamil content you generate must still be written entirely in Tamil.'
      : 'The theme below is written in Tamil.'

  return [
    'You are a worksheet writer for a Tamil language school, producing a reading passage plus exercises for a student at a specific level.',
    'The user message is the REQUIRED theme/topic for the passage -- it must be clearly and directly about that theme, not generic or unrelated.',
    'Write all Tamil text in Tamil script only -- no English words or transliteration.',
    `Passage target length: ${guidance.wordCount}.`,
    `Passage vocabulary: ${guidance.vocabulary}`,
    `Passage sentence structure: ${guidance.sentenceStructure}`,
    'Vary character names, settings, and the passage\'s problem/resolution across different generations -- avoid the most obvious or stock scenario for the theme.',
    'Write with natural spoken-Tamil rhythm appropriate for a children\'s book being read aloud, not stiff textbook phrasing.',
    'For the vocabulary and word puzzle sections: only use real, dictionary-valid Tamil words that a native speaker would recognize. Do not invent words or append incorrect suffixes/letters. Double-check each word\'s spelling and grammatical validity before including it.',
    'Before returning your answer, re-check every sentence and every word for correct Tamil grammar, spelling, and case markers.',
    themeNote,
    'Return ONLY a single JSON object (no markdown fences, no commentary before or after) with exactly this shape:',
    '{"passage": string, "comprehensionQuestions": string[] (3-5 questions in Tamil about the passage), "vocabulary": [{"word": string, "meaning": string}] (5-8 words from the passage with simple Tamil meanings), "wordPuzzle": [{"word": string, "scrambled": string}] (4-6 real Tamil words from the passage with their letters shuffled into "scrambled")}',
  ].join(' ')
}

// Same Sarvam-primary/Groq-fallback pattern as app/api/generate-story/
// route.ts -- duplicated here rather than shared, matching this
// codebase's existing convention of route-local generation logic.
async function generateText(messages: { role: 'system' | 'user'; content: string }[]): Promise<string> {
  try {
    const text = await sarvamChatCompletion(messages, 2048)
    console.log('[generate-worksheet] provider=sarvam')
    return text
  } catch (err) {
    console.error('Sarvam generation failed, falling back to Groq:', err)
    const text = await groqChatCompletion(messages)
    console.log('[generate-worksheet] provider=groq-fallback')
    return text
  }
}

function parseWorksheet(raw: string): WorksheetContent {
  // The model may still wrap its answer in a markdown code fence despite
  // being told not to -- strip one if present before parsing.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new WorksheetParseError()
  }

  if (!isWorksheetContent(parsed)) {
    throw new WorksheetParseError()
  }

  return parsed
}

// POST /api/generate-worksheet -- teacher-only. Generates a Tamil reading
// passage plus comprehension questions, vocabulary, and a word puzzle
// from a theme via Sarvam, falling back to Groq (see generateText above).
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
  const level = requireEnum(body.level, STORY_LEVEL_VALUES, 'Level', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const systemPrompt = buildSystemPrompt(language ?? 'ta', level!)

  try {
    const raw = await generateText([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: theme },
    ])

    const worksheet = parseWorksheet(raw)
    return NextResponse.json({ worksheet })
  } catch (err) {
    if (err instanceof WorksheetParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json(
        { error: 'Worksheet generation is rate-limited right now -- please try again in a minute.' },
        { status: 429 }
      )
    }
    if (err instanceof GroqRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to generate worksheet' }, { status: 500 })
  }
}
