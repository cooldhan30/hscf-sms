import type { GameModule, GameQuestion } from '@/lib/gameRoom/gameModule'
import { ALL_MAYANGOLI_WORDS } from './selectWords'
import { generateMayangoliQuestion } from './generateQuestion'
import { MAYANGOLI_QUESTION_TYPES, type MayangoliQuestionType } from './questionTypes'
import { MAYANGOLI_GROUPS } from './groups'

const MODULE_ID = 'mayangoli'

// Mayangoli plugs into the EXISTING self-paced Game Room engine as a
// classic GameModule (not the standalone synchronized-session system
// this module briefly had) -- per explicit product decision: teachers
// wanted each student answering independently, moving on immediately
// after answering with their own instant feedback, not a room-wide
// lockstep pace gated on the teacher clicking Reveal/Next. That's
// exactly the self-paced engine's existing contract, so building a
// second parallel engine to get the same behavior would be pure
// duplication.
//
// generateMayangoliQuestion's option-shuffling is seeded (not random)
// so this bank is STABLE across builds/deploys -- reusing it here with
// each word's own id (rather than a live sessionId/questionIndex, which
// don't exist at module-load time) as the seed salt gives every word+
// questionType combination a fixed, permanent option order, matching
// GameQuestion's "fixed canonical order, shuffled per-read by the
// engine" contract exactly.

// GameQuestion has exactly ONE prompt string, rendered as a single
// plain-text line at text-4xl font-black (PlayGameClient.tsx's <p>, no
// whitespace-pre-line) -- unlike the old synchronized-session UI,
// there's no separate instruction/supportingText slot, and a full
// sentence reads poorly at that size/weight (and is inconsistent with
// every other module's terse, mostly-Tamil prompt). Confirmed as a real
// bug: fill_missing_letter rendered the masked word with no meaning
// hint attached, leaving no context for what's being asked -- fixed by
// folding the English meaning into the same line, in parentheses.
// (A separate identify_the_letter type was dropped entirely: it showed
// the COMPLETE, correctly-spelled word and asked the student to pick
// which of 3 letters was correct -- but the letter was already visible
// in the word, so there was nothing to actually figure out. Not a
// terse-instruction problem like this one; the mechanic itself didn't
// work.)
function composePrompt(questionType: MayangoliQuestionType, rawPrompt: string, supportingText?: string): string {
  switch (questionType) {
    case 'fill_missing_letter':
      // rawPrompt is the masked word (e.g. "ப__ம்"); supportingText is
      // the English meaning, shown as a small hint in parentheses.
      return supportingText ? `${rawPrompt} (${supportingText})` : rawPrompt
    case 'choose_correct_spelling':
      // rawPrompt is the English meaning -- already self-explanatory
      // paired with the spelling options below it.
      return rawPrompt
    case 'meaning_challenge':
      // rawPrompt is the Tamil word itself -- pairing it with English
      // meaning options below already makes the task clear.
      return rawPrompt
    case 'find_wrong_spelling':
      return rawPrompt
  }
}

function buildValidatedQuestionBank(): GameQuestion[] {
  const questions: GameQuestion[] = []
  const seenIds = new Set<string>()

  for (const word of ALL_MAYANGOLI_WORDS) {
    for (const questionType of MAYANGOLI_QUESTION_TYPES) {
      const q = generateMayangoliQuestion(word, ALL_MAYANGOLI_WORDS, questionType, word.id, 0)
      const id = `${MODULE_ID}:${word.id}:${questionType}`

      if (seenIds.has(id)) {
        throw new Error(`[${MODULE_ID}] duplicate question id "${id}"`)
      }
      seenIds.add(id)

      questions.push({
        id,
        prompt: composePrompt(questionType, q.prompt, q.supportingText),
        correctAnswer: q.correctAnswer,
        options: q.options,
        explanation: word.meaningEnglish,
        category: word.groupId,
      })
    }
  }

  const expected = ALL_MAYANGOLI_WORDS.length * MAYANGOLI_QUESTION_TYPES.length
  if (questions.length !== expected) {
    throw new Error(`[${MODULE_ID}] expected ${expected} questions, got ${questions.length}`)
  }

  return questions
}

const QUESTION_BANK = buildValidatedQuestionBank()

export const mayangoliModule: GameModule = {
  id: MODULE_ID,
  name: 'மயங்கொலி Challenge',
  description: 'ல்/ள்/ழ், ன்/ண்/ந், ர்/ற் — practice telling apart commonly-confused Tamil letters',
  categories: MAYANGOLI_GROUPS.map((g) => ({ id: g.id, label: g.label })),
  getQuestionBank: () => QUESTION_BANK,
}
