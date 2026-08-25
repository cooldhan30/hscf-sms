import type { GameModule, GameQuestion } from '@/lib/gameRoom/gameModule'
import { WORD_BANK } from './wordBank'
import { buildQuestion, WordValidationError } from './blankGeneration'

const MODULE_ID = 'tamil-grammar'

// Every option set is the same fixed four consonants, per spec -- not a
// per-question generated distractor list.
const ALL_OPTIONS = ['ண்', 'ந்', 'ன்', 'ம்']

const CATEGORY_LABELS: Record<string, string> = {
  'ண்': 'டண்ணகரம்',
  'ந்': 'தந்நகரம்',
  'ன்': 'றன்னகரம்',
}

// Validates and builds the full question bank at module load time --
// fails loudly (throws, which fails the build/boot) rather than shipping
// a broken question, satisfying "validate all 180 questions before
// production" as a build-time guarantee instead of a separate manual
// step someone can forget to run.
function buildValidatedQuestionBank(): GameQuestion[] {
  const seenIds = new Set<string>()
  const seenWords = new Set<string>()
  const questions: GameQuestion[] = []

  for (const raw of WORD_BANK) {
    if (seenIds.has(raw.id)) {
      throw new WordValidationError(raw.id, `duplicate question id`)
    }
    if (seenWords.has(raw.word)) {
      throw new WordValidationError(raw.id, `duplicate word "${raw.word}"`)
    }
    seenIds.add(raw.id)
    seenWords.add(raw.word)

    const built = buildQuestion(raw)

    questions.push({
      id: `${MODULE_ID}:${built.id}`,
      prompt: built.blankedWord,
      correctAnswer: built.correctAnswer,
      options: ALL_OPTIONS,
      explanation: built.explanation,
      category: built.category,
    })
  }

  if (questions.length !== 180) {
    throw new Error(`Expected exactly 180 tamil-grammar questions, got ${questions.length}`)
  }

  return questions
}

// Built once at import time -- every session-creation and gameplay
// route calls getQuestionBank() and gets back this same validated array,
// never re-validating on every request.
const QUESTION_BANK = buildValidatedQuestionBank()

export const tamilGrammarModule: GameModule = {
  id: MODULE_ID,
  name: 'இன எழுத்துகள்',
  description: 'ண் (டண்ணகரம்), ந் (தந்நகரம்), ன் (றன்னகரம்) — Tamil consonant grammar practice',
  categories: Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
  getQuestionBank: () => QUESTION_BANK,
}
