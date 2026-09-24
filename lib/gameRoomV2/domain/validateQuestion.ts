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
} from './questionTypes'
import { normalizeForComparison } from './textNormalize'

// Prevents malformed sets from ever being saved (per the Question Set
// Builder's explicit "Validate" workflow step). Runs identically on the
// client (as the teacher types, for immediate feedback) and the server
// (POST/PATCH routes, as the actual enforcement -- a client-only check
// can always be bypassed by calling the API directly). Returns a list
// of human-readable problems; an empty list means the question is
// well-formed and safe to persist.
//
// Only MULTIPLE_CHOICE/TRUE_FALSE/IMAGE_CHOICE/TEXT_INPUT/FILL_BLANK/
// MATCH/ORDER_LETTERS/ORDER_WORDS/CATEGORIZE/AUDIO_CHOICE are validated
// here -- PRONUNCIATION/READING_FLUENCY have no authoring UI yet (see
// questionTypes.ts's IMPLEMENTED_QUESTION_TYPES) and are rejected
// outright by requireQuestionTypeIsImplemented() before this is ever
// called for them.
export function validateQuestionPayload(
  questionType: GameRoomQuestionType,
  prompt: string,
  payload: unknown
): string[] {
  const problems: string[] = []

  if (!prompt || !prompt.trim()) {
    problems.push('Question text cannot be blank.')
  }

  if (payload === null || typeof payload !== 'object') {
    problems.push('Question data is missing.')
    return problems
  }
  const p = payload as Record<string, unknown>

  switch (questionType) {
    case 'MULTIPLE_CHOICE': {
      const v = p as Partial<MultipleChoicePayload>
      const options = Array.isArray(v.options) ? v.options.filter((o) => typeof o === 'string' && o.trim()) : []
      if (options.length < 2) problems.push('Multiple choice needs at least 2 answer choices.')
      // normalizeForComparison so two options that render IDENTICALLY
      // (e.g. one typed with a zero-width joiner a Tamil keyboard/IME
      // inserted, one without) are correctly caught as duplicates,
      // rather than silently passing as "unique" because their raw
      // Unicode differs invisibly.
      const uniqueOptions = new Set(options.map((o) => normalizeForComparison(o.trim())))
      if (uniqueOptions.size !== options.length) problems.push('Answer choices must be unique.')
      if (!v.correctAnswer || !v.correctAnswer.trim()) {
        problems.push('Multiple choice needs a correct answer selected.')
      } else if (!options.includes(v.correctAnswer)) {
        problems.push('The correct answer must be one of the answer choices.')
      }
      break
    }
    case 'TRUE_FALSE': {
      const v = p as Partial<TrueFalsePayload>
      if (typeof v.correctAnswer !== 'boolean') problems.push('True/False needs a correct answer selected.')
      break
    }
    case 'IMAGE_CHOICE': {
      const v = p as Partial<ImageChoicePayload>
      const options = Array.isArray(v.options) ? v.options.filter((o) => o && typeof o.imageUrl === 'string' && o.imageUrl.trim()) : []
      if (options.length < 2) problems.push('Image choice needs at least 2 image options.')
      if (!v.correctAnswer || !options.some((o) => o.imageUrl === v.correctAnswer)) {
        problems.push('Image choice needs a correct image selected.')
      }
      break
    }
    case 'TEXT_INPUT': {
      const v = p as Partial<TextInputPayload>
      const answers = Array.isArray(v.acceptedAnswers) ? v.acceptedAnswers.filter((a) => typeof a === 'string' && a.trim()) : []
      if (answers.length === 0) problems.push('Text input needs at least one accepted answer.')
      break
    }
    case 'FILL_BLANK': {
      const v = p as Partial<FillBlankPayload>
      const blankCount = (prompt.match(/___/g) ?? []).length
      const blanks = Array.isArray(v.blanks) ? v.blanks : []
      if (blankCount === 0) problems.push('Fill in the blank needs at least one "___" marker in the question text.')
      if (blanks.length !== blankCount) {
        problems.push(`Found ${blankCount} blank marker(s) in the text but ${blanks.length} answer set(s) -- these must match.`)
      }
      if (blanks.some((b) => !Array.isArray(b) || b.filter((a) => typeof a === 'string' && a.trim()).length === 0)) {
        problems.push('Every blank needs at least one accepted answer.')
      }
      break
    }
    case 'MATCH': {
      const v = p as Partial<MatchPayload>
      const pairs = Array.isArray(v.pairs) ? v.pairs.filter((pr) => pr && pr.left?.trim() && pr.right?.trim()) : []
      if (pairs.length < 2) problems.push('Matching needs at least 2 complete pairs.')
      break
    }
    case 'ORDER_LETTERS':
    case 'ORDER_WORDS': {
      const v = p as Partial<OrderLettersPayload | OrderWordsPayload>
      const items = 'letters' in v ? v.letters : (v as Partial<OrderWordsPayload>).words
      const itemLabel = questionType === 'ORDER_LETTERS' ? 'letters' : 'words'
      const cleanItems = Array.isArray(items) ? items.filter((i) => typeof i === 'string' && i.trim()) : []
      const correctOrder = Array.isArray(v.correctOrder) ? v.correctOrder.filter((i) => typeof i === 'string' && i.trim()) : []
      if (cleanItems.length < 2) problems.push(`Ordering needs at least 2 ${itemLabel} to arrange.`)
      if (correctOrder.length !== cleanItems.length) {
        problems.push(`The correct order must include every one of the ${itemLabel} exactly once.`)
      } else {
        const sortedItems = [...cleanItems].sort()
        const sortedOrder = [...correctOrder].sort()
        if (JSON.stringify(sortedItems) !== JSON.stringify(sortedOrder)) {
          problems.push(`The correct order must use exactly the same ${itemLabel} provided, no more and no fewer.`)
        }
      }
      break
    }
    case 'CATEGORIZE': {
      const v = p as Partial<CategorizePayload>
      const items = Array.isArray(v.items) ? v.items.filter((i) => typeof i === 'string' && i.trim()) : []
      const categories = Array.isArray(v.categories) ? v.categories.filter((c) => typeof c === 'string' && c.trim()) : []
      if (items.length < 2) problems.push('Categorize needs at least 2 items.')
      if (categories.length < 2) problems.push('Categorize needs at least 2 categories.')
      const answerKey = v.answerKey && typeof v.answerKey === 'object' ? v.answerKey : {}
      const missing = items.filter((i) => !(i in answerKey))
      if (missing.length > 0) problems.push('Every item needs a category assigned.')
      const invalidCategory = Object.values(answerKey).filter((c) => typeof c !== 'string' || !categories.includes(c))
      if (invalidCategory.length > 0) problems.push('Every item must be assigned to one of the declared categories.')
      break
    }
    case 'AUDIO_CHOICE': {
      const v = p as Partial<AudioChoicePayload>
      if (!v.audioUrl || !v.audioUrl.trim()) problems.push('Audio choice needs an audio clip.')
      const options = Array.isArray(v.options) ? v.options.filter((o) => typeof o === 'string' && o.trim()) : []
      if (options.length < 2) problems.push('Audio choice needs at least 2 answer choices.')
      if (!v.correctAnswer || !options.includes(v.correctAnswer)) {
        problems.push('Audio choice needs a correct answer selected from the options.')
      }
      break
    }
    default:
      problems.push(`"${questionType}" has no authoring support yet.`)
  }

  return problems
}

// A question set as a whole needs at least one well-formed question --
// "Blank question cannot save" from the spec applies both per-question
// (validateQuestionPayload above) and to the set overall (an empty set
// is itself malformed, since nothing could ever be played from it).
export function validateQuestionSet(questions: { questionType: GameRoomQuestionType; prompt: string; payload: unknown }[]): string[] {
  const problems: string[] = []
  if (questions.length === 0) {
    problems.push('A question set needs at least one question.')
    return problems
  }
  questions.forEach((q, i) => {
    const questionProblems = validateQuestionPayload(q.questionType, q.prompt, q.payload)
    questionProblems.forEach((p) => problems.push(`Question ${i + 1}: ${p}`))
  })
  return problems
}
