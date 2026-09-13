export type MayangoliQuestionType =
  | 'fill_missing_letter'
  | 'choose_correct_spelling'
  | 'meaning_challenge'
  | 'find_wrong_spelling'

export const MAYANGOLI_QUESTION_TYPES: MayangoliQuestionType[] = [
  'fill_missing_letter',
  'choose_correct_spelling',
  'meaning_challenge',
  'find_wrong_spelling',
]

// One rendered question, fully resolved server-side -- the client only
// ever displays this shape and submits back one of `options`' values.
// No raw MayangoliWord/answer key is ever sent until after the reveal.
export interface MayangoliQuestion {
  questionType: MayangoliQuestionType
  wordId: string
  targetLetter: string
  groupId: string
  prompt: string
  // What the student picks from -- always includes exactly one correct
  // value, order pre-shuffled server-side and stable for this question.
  options: string[]
  correctAnswer: string
  // Optional supporting text shown alongside the prompt (e.g. an
  // English meaning hint, or the full word for context).
  supportingText?: string
}
