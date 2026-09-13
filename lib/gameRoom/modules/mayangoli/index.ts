import type { GameModule, GameQuestion } from '@/lib/gameRoom/gameModule'
import { ALL_MAYANGOLI_WORDS } from './selectWords'
import { generateMayangoliQuestion } from './generateQuestion'
import { MAYANGOLI_QUESTION_TYPES } from './questionTypes'
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
        prompt: q.prompt,
        correctAnswer: q.correctAnswer,
        options: q.options,
        explanation: q.supportingText ?? word.meaningEnglish,
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
