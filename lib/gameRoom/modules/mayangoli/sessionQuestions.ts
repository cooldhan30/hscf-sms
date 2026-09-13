import { getMayangoliWordById, ALL_MAYANGOLI_WORDS } from './selectWords'
import { generateMayangoliQuestion } from './generateQuestion'
import { MAYANGOLI_QUESTION_TYPES, type MayangoliQuestion, type MayangoliQuestionType } from './questionTypes'
import { shuffledOptionsFor } from '@/lib/gameRoom/shuffle'

// Picks question index N's type deterministically from (sessionId,
// index), never repeating the immediately preceding index's type (a
// light anti-repetition rule -- a stronger no-repeat-in-N-window isn't
// needed at whole-game lengths this small since the space is only 5
// types). Recomputes index N-1's type itself (recursively, bottomed
// out at index 0) rather than requiring callers to track/pass it, so
// every caller (advance/answer/state routes, possibly on different
// requests) derives the identical sequence from server state alone.
export function pickQuestionType(sessionId: string, questionIndex: number): MayangoliQuestionType {
  const previousType = questionIndex > 0 ? pickQuestionType(sessionId, questionIndex - 1) : null
  const candidates = previousType ? MAYANGOLI_QUESTION_TYPES.filter((t) => t !== previousType) : MAYANGOLI_QUESTION_TYPES
  const seed = `${sessionId}:${questionIndex}:question_type`
  return shuffledOptionsFor(candidates, seed)[0]
}

// Resolves the fully rendered MayangoliQuestion for a session's current
// question_ids[questionIndex] -- the single source of truth used by
// every route (advance/answer/state) that needs "what is question N".
export function resolveMayangoliQuestion(
  sessionId: string,
  questionIds: string[],
  questionIndex: number
): { question: MayangoliQuestion; questionType: MayangoliQuestionType } {
  const wordId = questionIds[questionIndex]
  const word = getMayangoliWordById(wordId)
  if (!word) {
    throw new Error(`Word "${wordId}" not found in Mayangoli word bank (index ${questionIndex})`)
  }

  const questionType = pickQuestionType(sessionId, questionIndex)
  const question = generateMayangoliQuestion(word, ALL_MAYANGOLI_WORDS, questionType, sessionId, questionIndex)
  return { question, questionType }
}
