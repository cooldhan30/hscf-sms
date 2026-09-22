import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'

// Extracts a "confusion pair" (what the student answered vs. what was
// actually correct) from a wrong single-answer-shaped response --
// this is the concrete mechanism behind the flagship "7 students
// repeatedly confused ண/ந/ன" insight: it only ever runs on ALREADY
// server-graded wrong answers (never re-derives correctness itself),
// and only for question types where "the student picked option A
// instead of the correct option B" is a meaningful, single pairwise
// mistake -- not for open-ended or multi-part types (TEXT_INPUT,
// FILL_BLANK, ORDER_*, MATCH, CATEGORIZE) where "what did they
// confuse" isn't a single pair.
//
// Returns null for a correct answer, an unsupported question type, or
// a submission shape that doesn't parse as expected (never throws on
// malformed/legacy data).
export interface ConfusionPair {
  correctValue: string
  submittedValue: string
}

export function extractConfusionPair(
  questionType: GameRoomQuestionType,
  payload: Record<string, unknown>,
  submittedAnswer: unknown,
  isCorrect: boolean
): ConfusionPair | null {
  if (isCorrect) return null

  switch (questionType) {
    case 'MULTIPLE_CHOICE':
    case 'IMAGE_CHOICE':
    case 'AUDIO_CHOICE': {
      const correctValue = payload.correctAnswer
      if (typeof correctValue !== 'string' || typeof submittedAnswer !== 'string' || !submittedAnswer) return null
      return { correctValue, submittedValue: submittedAnswer }
    }
    case 'TRUE_FALSE': {
      const correctValue = payload.correctAnswer
      if (typeof correctValue !== 'boolean' || typeof submittedAnswer !== 'boolean') return null
      return { correctValue: String(correctValue), submittedValue: String(submittedAnswer) }
    }
    default:
      return null
  }
}

// A stable, order-independent key for a pair of values being confused
// with each other -- "ண confused with ந" and "ந confused with ண" are
// the SAME underlying confusion from a teacher's point of view (a
// student mixing up two letters, regardless of which direction a
// specific wrong answer happened to go), so both normalize to one key.
export function confusionPairKey(a: string, b: string): string {
  return [a, b].sort().join(' / ')
}
