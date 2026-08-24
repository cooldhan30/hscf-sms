import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { groqChatCompletion, GroqRateLimitError, GroqRequestError } from '@/lib/groq'
import { sarvamChatCompletion } from '@/lib/sarvam'
import { STORY_LEVEL_GUIDANCE, STORY_LEVEL_VALUES, defaultWorksheetTypeForLevel, type StoryLevel } from '@/lib/storyLevels'
import { looksProperlySpaced } from '@/lib/storyValidation'
import { isRawWorksheetContent, type WorksheetContent, type WorksheetType } from '@/lib/worksheetTypes'
import { emojiForWord, availableVocabWords, blankOutOneLetter, PLACEHOLDER_EMOJI } from '@/lib/tamilVocabEmoji'

class WorksheetParseError extends Error {
  constructor() {
    super('The generator returned malformed content -- please try again')
    this.name = 'WorksheetParseError'
  }
}

const WORKSHEET_TYPE_VALUES = ['picture_fillblank', 'reading_comprehension'] as const

function buildSystemPrompt(language: 'ta' | 'en', level: StoryLevel, worksheetType: WorksheetType): string {
  const guidance = STORY_LEVEL_GUIDANCE[level]

  const themeNote =
    language === 'en'
      ? 'The theme below may be written in English -- understand it, but all Tamil content you generate must still be written entirely in Tamil.'
      : 'The theme below is written in Tamil.'

  const shared = [
    'You are a worksheet writer for a Tamil language school.',
    'The user message is the REQUIRED theme/topic -- everything you generate must be clearly and directly related to it, not generic or unrelated.',
    'Write all Tamil text in Tamil script only -- no English words or transliteration.',
    'Ensure correct word spacing in all Tamil output -- never merge two words together into one. Proofread your own output for spacing and grammar errors before finalizing.',
    themeNote,
  ]

  if (worksheetType === 'picture_fillblank') {
    return [
      ...shared,
      `Pick 5 to 8 words related to the theme, ONLY from this exact list of allowed Tamil words (do not invent, translate, or alter any word -- copy each chosen word EXACTLY as spelled here, and do not use any word outside this list): ${availableVocabWords().join(', ')}.`,
      'Give the worksheet a short Tamil title that clearly reflects the REQUESTED THEME (not a generic label like "sentence practice" or "grammar practice") -- e.g. if the theme is about animals, the title should mention animals.',
      'Return ONLY a single JSON object (no markdown fences, no commentary before or after) with exactly this shape:',
      '{"worksheetType": "picture_fillblank", "title": string, "passage": "", "items": [{"word": string}], "questions": [], "vocabulary": []}',
    ].join(' ')
  }

  return [
    ...shared,
    `Passage target length: ${guidance.wordCount}.`,
    `Passage vocabulary: ${guidance.vocabulary}`,
    `Passage sentence structure: ${guidance.sentenceStructure}`,
    'Vary character names, settings, and the passage\'s problem/resolution across different generations -- avoid the most obvious or stock scenario for the theme.',
    'Write with natural spoken-Tamil rhythm appropriate for a children\'s book being read aloud, not stiff textbook phrasing.',
    'Only use real, dictionary-valid Tamil words that a native speaker would recognize in the vocabulary section. Do not invent words or append incorrect suffixes/letters. Double-check each word\'s spelling and grammatical validity before including it.',
    'Before returning your answer, re-check every sentence and every word for correct Tamil grammar, spelling, and case markers.',
    'Return ONLY a single JSON object (no markdown fences, no commentary before or after) with exactly this shape:',
    '{"worksheetType": "reading_comprehension", "title": string (a short Tamil title for this worksheet), "passage": string, "items": [], "questions": string[] (3-5 questions in Tamil about the passage), "vocabulary": [{"term": string, "definition": string}] (5-8 words from the passage with simple Tamil meanings)}',
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

// Returns the raw LLM shape -- picture_fillblank items have no `emoji`
// yet at this point (see isRawWorksheetContent in lib/worksheetTypes.ts
// for why). The caller resolves emoji and builds the final
// WorksheetContent afterward.
function parseWorksheet(raw: string): ReturnType<typeof requireRawWorksheetContent> {
  // The model may still wrap its answer in a markdown code fence despite
  // being told not to -- strip one if present before parsing.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new WorksheetParseError()
  }

  return requireRawWorksheetContent(parsed)
}

function requireRawWorksheetContent(parsed: unknown) {
  if (!isRawWorksheetContent(parsed)) {
    throw new WorksheetParseError()
  }
  return parsed
}

// A generated worksheet is only as spacing-correct/on-topic as the raw
// text the model produced -- for picture_fillblank that's each item's
// word/blankedWord, for reading_comprehension that's the passage. Joining
// the relevant strings gives looksProperlySpaced (lib/storyValidation.ts)
// one combined check without needing a type-specific implementation.
function textToValidate(content: { worksheetType: WorksheetType; passage: string; items: { word: string }[] }): string {
  if (content.worksheetType === 'picture_fillblank') {
    return content.items.map((i) => i.word).join(' ')
  }
  return content.passage
}

// POST /api/generate-worksheet -- teacher-only. Generates either a
// picture fill-in-the-blank exercise or a reading-comprehension passage
// (see lib/worksheetTypes.ts) from a theme via Sarvam, falling back to
// Groq (see generateText above).
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
  const worksheetType =
    body.worksheetType === undefined
      ? defaultWorksheetTypeForLevel(typeof body.level === 'string' ? body.level : '')
      : requireEnum(body.worksheetType, WORKSHEET_TYPE_VALUES, 'Worksheet type', errors)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const systemPrompt = buildSystemPrompt(language ?? 'ta', level!, worksheetType!)

  try {
    let raw = await generateText([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: theme },
    ])
    let worksheet = parseWorksheet(raw)

    if (!looksProperlySpaced(textToValidate(worksheet))) {
      raw = await generateText([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${theme}\n\n(Your previous attempt had a spacing/word-merging error -- make sure every word is correctly separated by spaces.)`,
        },
      ])
      worksheet = parseWorksheet(raw)
    }

    // The LLM only ever picks WHICH word to use -- blanking a letter out
    // and picking its emoji are both done deterministically here, never
    // trusted to the model (see blankOutOneLetter/emojiForWord in
    // lib/tamilVocabEmoji.ts for why). A word the model invented, altered,
    // or picked outside the allowed list (despite being told not to)
    // won't blank cleanly or won't resolve to a real emoji -- silently
    // dropped rather than shown as broken/placeholder content.
    const items = worksheet.items.flatMap((item) => {
      const blanked = blankOutOneLetter(item.word)
      if (!blanked) return []
      const emoji = emojiForWord(item.word)
      if (emoji === PLACEHOLDER_EMOJI) return []
      return [{ word: item.word, ...blanked, emoji }]
    })

    if (worksheet.worksheetType === 'picture_fillblank' && items.length === 0) {
      throw new WorksheetParseError()
    }

    const finalWorksheet: WorksheetContent = { ...worksheet, items }

    return NextResponse.json({ worksheet: finalWorksheet })
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
    console.error('[generate-worksheet] unexpected error:', err)
    return NextResponse.json({ error: 'Failed to generate worksheet' }, { status: 500 })
  }
}
