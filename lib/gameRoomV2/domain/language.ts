export const QUESTION_SET_LANGUAGES = ['tamil', 'english', 'mixed'] as const
export type QuestionSetLanguage = (typeof QUESTION_SET_LANGUAGES)[number]

// Tamil Unicode block (U+0B80-U+0BFF) -- a simple, reliable presence
// check. This never transliterates or alters anything; it only reads
// which script(s) are present, purely to classify the set for the
// Library's Language filter.
const TAMIL_RANGE = /[஀-௿]/
const LATIN_LETTER_RANGE = /[A-Za-z]/

// Auto-detected at save time (never teacher-entered) from every
// question's prompt plus the set's own title fields, so it can never
// drift from what the content actually is. 'mixed' when both scripts
// appear anywhere in the combined text; 'tamil'/'english' when only one
// does; 'english' as the fallback for text with neither (e.g. numbers-
// only content) since that matches this app's default locale elsewhere.
export function detectLanguage(texts: string[]): QuestionSetLanguage {
  const combined = texts.join(' ')
  const hasTamil = TAMIL_RANGE.test(combined)
  const hasLatin = LATIN_LETTER_RANGE.test(combined)

  if (hasTamil && hasLatin) return 'mixed'
  if (hasTamil) return 'tamil'
  return 'english'
}
