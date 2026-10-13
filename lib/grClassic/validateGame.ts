import { clean, isUuid } from './validateQuestion'
import type { Difficulty, GameType } from './types'

export const GAME_TYPES: GameType[] = ['quiz', 'match', 'word-builder']
export const LIVE_SECONDS = [10, 20, 30, 60]
export const MAX_GAME_QUESTIONS = 100

export interface ValidGame {
  title: string
  type: GameType
  categoryId: string | null
  difficulty: Difficulty
  liveSeconds: number
  questionIds: string[]
}

export function validateGame(input: Record<string, unknown>): { ok: true; value: ValidGame } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const title = clean(input.title)
  if (!title) errors.push('Give your game a name.')
  if (title.length > 120) errors.push('The game name can be at most 120 characters.')
  const type = input.type as GameType
  if (!GAME_TYPES.includes(type)) errors.push('Choose a game type.')
  const difficulty = (['easy', 'medium', 'hard'] as Difficulty[]).includes(input.difficulty as Difficulty) ? (input.difficulty as Difficulty) : 'easy'
  const liveSeconds = LIVE_SECONDS.includes(Number(input.liveSeconds)) ? Number(input.liveSeconds) : 20
  const categoryId = input.categoryId === null || input.categoryId === undefined || input.categoryId === '' ? null : isUuid(input.categoryId) ? input.categoryId : (errors.push('Topic is not valid.'), null)
  const ids = Array.isArray(input.questionIds) ? input.questionIds : []
  if (ids.some((x) => !isUuid(x))) errors.push('Some questions are not valid.')
  // A question appears in a game at most once; keep the first position.
  const questionIds = Array.from(new Set(ids.filter(isUuid)))
  if (questionIds.length === 0) errors.push('Add at least one question.')
  if (questionIds.length > MAX_GAME_QUESTIONS) errors.push(`A game can have at most ${MAX_GAME_QUESTIONS} questions.`)
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { title, type, categoryId, difficulty, liveSeconds, questionIds } }
}
