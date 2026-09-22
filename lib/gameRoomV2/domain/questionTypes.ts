// Every question type GameRoom V2 is designed to support, now or later.
// This list intentionally includes types with no engine/UI implementing
// them yet (PRONUNCIATION, READING_FLUENCY) -- the point of naming them
// here is that adding a real implementation later never requires
// touching this enum, sms_gamev2_questions' CHECK constraint (which
// already lists all of these, see migration 073), or any existing
// question set's data. Only a genuinely new type beyond this list would
// need both.
export const GAME_ROOM_V2_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'IMAGE_CHOICE',
  'TEXT_INPUT',
  'FILL_BLANK',
  'MATCH',
  'ORDER_LETTERS',
  'ORDER_WORDS',
  'CATEGORIZE',
  'AUDIO_CHOICE',
  // Planned, no engine/authoring UI yet -- see architecture note above.
  'PRONUNCIATION',
  'READING_FLUENCY',
] as const

export type GameRoomQuestionType = (typeof GAME_ROOM_V2_QUESTION_TYPES)[number]

// Types with a real engine/authoring implementation today vs. types
// reserved for the roadmap -- kept as a separate list rather than
// removing the others from GAME_ROOM_V2_QUESTION_TYPES, so "planned but
// not built" stays a first-class, visible distinction instead of an
// undocumented gap.
export const IMPLEMENTED_QUESTION_TYPES: readonly GameRoomQuestionType[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'IMAGE_CHOICE',
  'TEXT_INPUT',
  'FILL_BLANK',
  'MATCH',
  'ORDER_LETTERS',
  'ORDER_WORDS',
  'CATEGORIZE',
  'AUDIO_CHOICE',
]

// --- Per-type payload shapes -----------------------------------------
// sms_gamev2_questions.payload (JSONB) must satisfy exactly one of
// these depending on the row's question_type. Validated at the API
// layer (not a DB CHECK -- see migration 073's comment on `payload`),
// so a new type's payload shape can be designed and validated in code
// before ever needing a schema change.

export interface MultipleChoicePayload {
  options: string[]
  correctAnswer: string
}

export interface TrueFalsePayload {
  correctAnswer: boolean
}

export interface ImageChoicePayload {
  // Each option is an image to pick, not text -- correctAnswer is the
  // matching imageUrl.
  options: { imageUrl: string; label?: string }[]
  correctAnswer: string
}

export interface TextInputPayload {
  // Multiple acceptable spellings/answers, compared case/whitespace-
  // insensitively at grading time -- not exact string equality only.
  acceptedAnswers: string[]
}

export interface FillBlankPayload {
  // prompt contains a blank marker (e.g. "___"); blanks lists the
  // accepted answer(s) per marker in order.
  blanks: string[][]
}

export interface MatchPayload {
  pairs: { left: string; right: string }[]
}

export interface OrderLettersPayload {
  // The scrambled letters to arrange; correctOrder is the target
  // arrangement (same multiset as `letters`).
  letters: string[]
  correctOrder: string[]
}

export interface OrderWordsPayload {
  words: string[]
  correctOrder: string[]
}

export interface CategorizePayload {
  items: string[]
  categories: string[]
  // Maps each item (must be a key present in `items`) to one of
  // `categories`.
  answerKey: Record<string, string>
}

export interface AudioChoicePayload {
  audioUrl: string
  options: string[]
  correctAnswer: string
}

// Reserved for the roadmap -- shapes are a best-effort forward
// declaration, not yet backed by any engine, and may still change
// before either is actually implemented.
export interface PronunciationPayload {
  targetText: string
  targetAudioUrl?: string
}

export interface ReadingFluencyPayload {
  passageText: string
  expectedWordsPerMinute?: number
}

export type QuestionPayloadFor<T extends GameRoomQuestionType> = T extends 'MULTIPLE_CHOICE'
  ? MultipleChoicePayload
  : T extends 'TRUE_FALSE'
    ? TrueFalsePayload
    : T extends 'IMAGE_CHOICE'
      ? ImageChoicePayload
      : T extends 'TEXT_INPUT'
        ? TextInputPayload
        : T extends 'FILL_BLANK'
          ? FillBlankPayload
          : T extends 'MATCH'
            ? MatchPayload
            : T extends 'ORDER_LETTERS'
              ? OrderLettersPayload
              : T extends 'ORDER_WORDS'
                ? OrderWordsPayload
                : T extends 'CATEGORIZE'
                  ? CategorizePayload
                  : T extends 'AUDIO_CHOICE'
                    ? AudioChoicePayload
                    : T extends 'PRONUNCIATION'
                      ? PronunciationPayload
                      : T extends 'READING_FLUENCY'
                        ? ReadingFluencyPayload
                        : never
