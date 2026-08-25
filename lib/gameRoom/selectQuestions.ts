import type { GameModule, GameQuestion } from './gameModule'
import { shuffle } from './shuffle'

export type QuizMode = 'full' | 'count' | 'category'

export interface SelectQuestionsOptions {
  mode: QuizMode
  // Required when mode === 'category'.
  category?: string
  // Required when mode === 'count'.
  count?: number
}

export class InvalidQuizConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidQuizConfigError'
  }
}

// Randomization #1 (session-level): selects the FIXED question set every
// player in this session will receive. This runs exactly once, at
// session creation -- the resulting question ids are stored on
// sms_game_sessions.question_ids. Randomization #2 (each player's own
// shuffled order of this same set) happens separately, once per player,
// at join time -- see app/api/game-room/join/route.ts.
export function selectSessionQuestions(module: GameModule, options: SelectQuestionsOptions): GameQuestion[] {
  const bank = module.getQuestionBank()

  if (options.mode === 'full') {
    return shuffle(bank)
  }

  if (options.mode === 'category') {
    if (!options.category) {
      throw new InvalidQuizConfigError('category is required for category mode')
    }
    const filtered = bank.filter((q) => q.category === options.category)
    if (filtered.length === 0) {
      throw new InvalidQuizConfigError(`no questions found for category "${options.category}"`)
    }
    return shuffle(filtered)
  }

  // mode === 'count': an even split across the module's categories (if
  // it has any), matching the original spec's example -- a 60-question
  // mixed quiz becomes 20 questions from each of 3 categories. Modules
  // with no category concept just shuffle+slice the whole bank.
  if (!options.count || options.count <= 0) {
    throw new InvalidQuizConfigError('count is required and must be positive for count mode')
  }
  if (options.count > bank.length) {
    throw new InvalidQuizConfigError(`count (${options.count}) exceeds the question bank size (${bank.length})`)
  }

  if (!module.categories || module.categories.length === 0) {
    return shuffle(bank).slice(0, options.count)
  }

  const perCategory = Math.floor(options.count / module.categories.length)
  const remainder = options.count - perCategory * module.categories.length

  const selected: GameQuestion[] = []
  module.categories.forEach((cat, i) => {
    const fromThisCategory = perCategory + (i < remainder ? 1 : 0)
    const categoryQuestions = shuffle(bank.filter((q) => q.category === cat.id)).slice(0, fromThisCategory)
    selected.push(...categoryQuestions)
  })

  return shuffle(selected)
}
