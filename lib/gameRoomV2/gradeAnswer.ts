import type {
  GameRoomQuestionType,
  MultipleChoicePayload,
  TrueFalsePayload,
  ImageChoicePayload,
  TextInputPayload,
  FillBlankPayload,
  MatchPayload,
  OrderLettersPayload,
  OrderWordsPayload,
  CategorizePayload,
  AudioChoicePayload,
} from './domain'
import { normalizeForComparison } from './domain/textNormalize'

// The ONE place grading happens, for every question type. This is the
// concrete mechanism behind "the game should not need to understand
// question implementation details" -- an engine calls SHOW QUESTION,
// the student submits *something*, and this function is the only code
// that knows how to compare that submission against the question's
// stored payload. No engine implementation ever re-derives correctness
// itself.
//
// This function itself is a pure comparison with no secrets embedded in
// it (no 'server-only' guard, so scripts/verify-gameroom-v2-gameplay.ts
// can exercise it directly) -- but ONLY ever called from server routes
// (sessions/[id]/answer/route.ts) with the question's real payload,
// which itself never reaches the client: state/route.ts strips every
// answer-key field before a question is ever sent to a browser (see
// that file's stripAnswerKey()). The actual leak this guards against
// is a client-facing route accidentally forwarding the raw payload, not
// this function being imported client-side.
export function gradeAnswer(questionType: GameRoomQuestionType, payload: unknown, submittedAnswer: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>

  switch (questionType) {
    case 'MULTIPLE_CHOICE': {
      const v = p as unknown as MultipleChoicePayload
      return typeof submittedAnswer === 'string' && submittedAnswer === v.correctAnswer
    }
    case 'TRUE_FALSE': {
      const v = p as unknown as TrueFalsePayload
      return typeof submittedAnswer === 'boolean' && submittedAnswer === v.correctAnswer
    }
    case 'IMAGE_CHOICE': {
      const v = p as unknown as ImageChoicePayload
      return typeof submittedAnswer === 'string' && submittedAnswer === v.correctAnswer
    }
    case 'TEXT_INPUT': {
      const v = p as unknown as TextInputPayload
      if (typeof submittedAnswer !== 'string') return false
      // normalizeForComparison (NFC + strip zero-width joiners) matters
      // for Tamil specifically: some keyboards/IMEs insert a ZWJ around
      // certain conjuncts, producing a string that renders IDENTICALLY
      // to the teacher's stored answer but fails a raw === comparison.
      // .toLowerCase() is kept for English content mixed into the same
      // field -- it's a safe no-op on Tamil script (no case there).
      const normalized = normalizeForComparison(submittedAnswer.trim().toLowerCase())
      return (v.acceptedAnswers ?? []).some((a) => normalizeForComparison(a.trim().toLowerCase()) === normalized)
    }
    case 'FILL_BLANK': {
      const v = p as unknown as FillBlankPayload
      if (!Array.isArray(submittedAnswer)) return false
      const blanks = v.blanks ?? []
      if (submittedAnswer.length !== blanks.length) return false
      return submittedAnswer.every((ans, i) => {
        if (typeof ans !== 'string') return false
        const normalized = normalizeForComparison(ans.trim().toLowerCase())
        return (blanks[i] ?? []).some((a) => normalizeForComparison(a.trim().toLowerCase()) === normalized)
      })
    }
    case 'MATCH': {
      const v = p as unknown as MatchPayload
      // Expected submission: Record<left, right> mapping every pair's
      // left side to the right side the student matched it with.
      if (submittedAnswer === null || typeof submittedAnswer !== 'object') return false
      const submitted = submittedAnswer as Record<string, string>
      const pairs = v.pairs ?? []
      if (pairs.length === 0) return false
      return pairs.every((pair) => submitted[pair.left] === pair.right)
    }
    case 'ORDER_LETTERS': {
      const v = p as unknown as OrderLettersPayload
      return Array.isArray(submittedAnswer) && arraysEqual(submittedAnswer, v.correctOrder ?? [])
    }
    case 'ORDER_WORDS': {
      const v = p as unknown as OrderWordsPayload
      return Array.isArray(submittedAnswer) && arraysEqual(submittedAnswer, v.correctOrder ?? [])
    }
    case 'CATEGORIZE': {
      const v = p as unknown as CategorizePayload
      // Expected submission: Record<item, category>, same shape as
      // answerKey.
      if (submittedAnswer === null || typeof submittedAnswer !== 'object') return false
      const submitted = submittedAnswer as Record<string, string>
      const answerKey = v.answerKey ?? {}
      const items = v.items ?? []
      if (items.length === 0) return false
      return items.every((item) => submitted[item] === answerKey[item])
    }
    case 'AUDIO_CHOICE': {
      const v = p as unknown as AudioChoicePayload
      return typeof submittedAnswer === 'string' && submittedAnswer === v.correctAnswer
    }
    default:
      // PRONUNCIATION/READING_FLUENCY have no grading logic yet (no
      // engine authors or plays them -- see
      // domain/questionTypes.ts's IMPLEMENTED_QUESTION_TYPES). A
      // session can never reach a question of these types today since
      // the Builder blocks authoring them, but grading defaults to
      // false rather than throwing if one somehow exists.
      return false
  }
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, i) => item === b[i])
}
