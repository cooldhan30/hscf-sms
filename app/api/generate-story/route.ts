import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { groqChatCompletion, verifyStoryMatchesTheme, GroqRateLimitError, GroqRequestError } from '@/lib/groq'
import { sarvamChatCompletion } from '@/lib/sarvam'
import { STORY_LEVEL_GUIDANCE, STORY_LEVEL_VALUES, type StoryLevel } from '@/lib/storyLevels'
import { looksProperlySpaced } from '@/lib/storyValidation'

function buildSystemPrompt(language: 'ta' | 'en', level: StoryLevel): string {
  const guidance = STORY_LEVEL_GUIDANCE[level]

  const themeNote =
    language === 'en'
      ? 'The theme below may be written in English -- understand it, but the story itself must still be written entirely in Tamil.'
      : 'The theme below is written in Tamil.'

  return [
    'You are a children\'s story writer for a Tamil language school.',
    'The user message is the REQUIRED theme/topic/subject for the story -- the story\'s characters, setting, and events must be clearly and directly about that theme. Do not write a generic or unrelated story.',
    'Write the ENTIRE story in Tamil script only -- no English words or transliteration.',
    'The story must have a clear beginning, middle, and end, and must stay on the given theme throughout.',
    'Vary character names, settings, and the story\'s problem/resolution across different generations -- avoid defaulting to the most obvious or stock scenario for the theme.',
    'Write with natural spoken-Tamil rhythm appropriate for a children\'s book being read aloud, not stiff textbook phrasing.',
    'Ensure correct word spacing in all Tamil output -- never merge two words together into one. Proofread your own output for spacing and grammar errors before finalizing.',
    'Stay strictly on the requested topic/character -- do not introduce unrelated animals or characters not implied by the theme.',
    'Before returning your answer, re-check every sentence for correct Tamil grammar, case markers, and verb agreement.',
    `Target length: ${guidance.wordCount}.`,
    `Vocabulary: ${guidance.vocabulary}`,
    `Sentence structure: ${guidance.sentenceStructure}`,
    themeNote,
    'Return only the story text -- no title, no preamble, no notes about the story.',
  ].join(' ')
}

// Sarvam (sarvam-105b) is the primary provider -- better Tamil grammar and
// creative variety than Groq's qwen model. Groq is kept as an automatic
// fallback so a Sarvam outage/rate-limit doesn't take down story
// generation entirely; any Sarvam failure (its own error classes, a
// network error, a malformed response) falls through to Groq silently
// from the caller's perspective. Logged so provider mix/usage can be
// monitored (see the [sarvam]/[groq] token logs in their respective libs).
async function generateText(messages: { role: 'system' | 'user'; content: string }[]): Promise<string> {
  try {
    const story = await sarvamChatCompletion(messages)
    console.log('[generate-story] provider=sarvam')
    return story
  } catch (err) {
    console.error('Sarvam generation failed, falling back to Groq:', err)
    const story = await groqChatCompletion(messages)
    console.log('[generate-story] provider=groq-fallback')
    return story
  }
}

// POST /api/generate-story -- teacher-only. Generates a children's Tamil
// story from a theme via Sarvam, falling back to Groq (see generateText
// above, and lib/sarvam.ts / lib/groq.ts for the model/timeout/rate-limit
// handling this route relies on).
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
    let story = await generateText([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: theme },
    ])

    // Confirmed as a real, reproducible issue (see lib/groq.ts): short/
    // simple stories sometimes substitute a different animal/character
    // than the requested theme. One cheap verification call + one retry
    // catches most of these instead of silently shipping an off-topic
    // story -- if the retry ALSO fails the check, it's still returned
    // rather than erroring out entirely, since a plausible-but-imperfect
    // story beats no story. Verification always uses Groq directly (not
    // generateText) -- it's a cheap yes/no classification, not creative
    // writing, so it doesn't need Sarvam's quality and stays on the
    // simpler, already-proven path.
    const matchesTheme = await verifyStoryMatchesTheme(story, theme)
    if (!matchesTheme) {
      story = await generateText([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${theme}\n\n(Your previous attempt did not clearly match this theme -- make sure the story is directly and obviously about "${theme}".)`,
        },
      ])
    }

    // Independent of the theme-relevance check above: a deterministic,
    // non-LLM regex check (see lib/storyValidation.ts) that catches
    // word-merging bugs (e.g. "சிறிய" + "யானை" glued into "சிறியயானை")
    // the model still occasionally produces despite the explicit spacing
    // instruction. Same "one retry, ship anyway if it still fails"
    // philosophy as the theme check -- kept as a separate gate rather
    // than combined, so each failure mode's corrective message stays
    // targeted to what actually went wrong.
    if (!looksProperlySpaced(story)) {
      story = await generateText([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${theme}\n\n(Your previous attempt had a spacing/word-merging error -- make sure every word is correctly separated by spaces.)`,
        },
      ])
    }

    // To pair an illustration with this story once the client has the
    // text, POST /api/story-image/generate with a prompt derived from
    // the story (e.g. its opening scene or a one-line summary), then
    // poll GET /api/story-image/status?promptId=... every few seconds
    // until { status: 'done', url } comes back -- see lib/comfyui.ts.
    // Not wired in here: image generation takes 30-50s on the home-server
    // GPU, so it belongs in its own client-driven poll loop rather than
    // blocking this (already rate-limited) text response.
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
