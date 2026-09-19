import type { GameModule, GameQuestion } from '@/lib/gameRoom/gameModule'
import { ALL_GRAMMAR_ENTRIES } from './selectWords'
import { GRAMMAR_CATEGORIES, type GrammarCategory } from './wordEntry'

const MODULE_ID = 'grammar-classification'

// One question per workbook entry (no per-word question-type variants
// like Mayangoli's old multi-type design) -- the workbook already
// supplies a complete, teacher-authored question (word + correct
// answer + full option set) per row, so there is nothing to dynamically
// generate beyond composing the on-screen prompt text.
//
// GameQuestion has exactly ONE prompt string (see mayangoli/index.ts's
// note on this same constraint) -- each category's fixed question
// phrasing ("இது எந்தத் திணை?" etc, from the spec) is folded onto the
// same line as the word/phrase itself.
const CATEGORY_PROMPT_SUFFIX: Record<GrammarCategory, string> = {
  thinai: 'இது எந்தத் திணை?',
  paal: 'இது எந்தப் பால்?',
  enn: 'இது எந்த எண்?',
  idam: 'இது எந்த இடம்?',
  kaalam: 'இது எந்தக் காலம்?',
}

function composePrompt(category: GrammarCategory, wordOrPhrase: string): string {
  return `${wordOrPhrase} — ${CATEGORY_PROMPT_SUFFIX[category]}`
}

function buildValidatedQuestionBank(): GameQuestion[] {
  const questions: GameQuestion[] = []
  const seenIds = new Set<string>()

  for (const entry of ALL_GRAMMAR_ENTRIES) {
    const id = `${MODULE_ID}:${entry.id}`
    if (seenIds.has(id)) {
      throw new Error(`[${MODULE_ID}] duplicate question id "${id}"`)
    }
    seenIds.add(id)

    questions.push({
      id,
      prompt: composePrompt(entry.category, entry.wordOrPhrase),
      correctAnswer: entry.correctAnswer,
      // The workbook's own option set/order, per the spec's explicit
      // "use the options supplied by the workbook... do not invent
      // grammatical answers client-side" rule -- shuffled per-read by
      // the engine (lib/gameRoom/shuffle.ts), never pre-shuffled here.
      options: entry.options,
      explanation: entry.teachingNote,
      category: entry.category,
    })
  }

  if (questions.length !== ALL_GRAMMAR_ENTRIES.length) {
    throw new Error(`[${MODULE_ID}] expected ${ALL_GRAMMAR_ENTRIES.length} questions, got ${questions.length}`)
  }

  return questions
}

const QUESTION_BANK = buildValidatedQuestionBank()

export const tamilGrammarClassificationModule: GameModule = {
  id: MODULE_ID,
  name: 'திணை • பால் • எண் • இடம் • காலம்',
  description: 'தமிழ் இலக்கண சவால் — சொல்லைப் பார்த்து சரியான இலக்கண வகையைத் தேர்ந்தெடு!',
  categories: GRAMMAR_CATEGORIES,
  getQuestionBank: () => QUESTION_BANK,
}
