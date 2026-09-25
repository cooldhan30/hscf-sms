import type { GameRoomQuestionType, QuestionSetDifficulty, QuestionSetVisibility } from '@/lib/gameRoomV2/domain'
import type { LearningDimension } from '@/lib/gameRoomV2/analytics'

// A question as the builder edits it client-side, before it's ever
// saved. `localId` is a stable key for React lists/reordering/dedup --
// generated client-side, distinct from the real DB `id` a saved
// question gets back from the server (an unsaved or edited-and-not-
// yet-saved question has no meaningful DB id to key off of).
//
// dimension/conceptTags are OPTIONAL learning-analytics metadata
// (migration 078) -- entirely separate from questionType/payload
// (which describe how the question is PLAYED) and separate from the
// parent set's subject/topic/tags (which describe the set as a whole).
// Leaving both blank is completely valid: analytics simply falls back
// to the set's own tags for concepts and excludes the question from
// dimension-specific rollups (see lib/gameRoomV2/analytics/
// dimensions.ts's effectiveDimension/effectiveConceptTags) -- there is
// no requirement to fill these in for a question set to save.
export interface DraftQuestion {
  localId: string
  id?: string
  questionType: GameRoomQuestionType
  prompt: string
  payload: Record<string, unknown>
  explanation: string
  mediaUrl: string | null
  points: number
  dimension: LearningDimension | null
  conceptTags: string[]
}

export function makeLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyDraftQuestion(questionType: GameRoomQuestionType): DraftQuestion {
  return {
    localId: makeLocalId(),
    questionType,
    prompt: '',
    payload: emptyPayloadFor(questionType),
    explanation: '',
    mediaUrl: null,
    points: 100,
    dimension: null,
    conceptTags: [],
  }
}

// Starting shape for a freshly-added question of each type -- matches
// the field names lib/gameRoomV2/domain/questionTypes.ts's per-type
// payload interfaces expect, so validateQuestionPayload() sees the
// right (if still incomplete) shape from the moment a question is
// added, rather than an empty {}.
function emptyPayloadFor(questionType: GameRoomQuestionType): Record<string, unknown> {
  switch (questionType) {
    case 'MULTIPLE_CHOICE':
      return { options: ['', ''], correctAnswer: '' }
    case 'TRUE_FALSE':
      return { correctAnswer: null }
    case 'IMAGE_CHOICE':
      return { options: [{ imageUrl: '', label: '' }, { imageUrl: '', label: '' }], correctAnswer: '' }
    case 'TEXT_INPUT':
      return { acceptedAnswers: [''] }
    case 'FILL_BLANK':
      return { blanks: [] }
    case 'MATCH':
      return { pairs: [{ left: '', right: '' }, { left: '', right: '' }] }
    case 'ORDER_LETTERS':
      return { letters: ['', ''], correctOrder: [] }
    case 'ORDER_WORDS':
      return { words: ['', ''], correctOrder: [] }
    case 'CATEGORIZE':
      return { items: ['', ''], categories: ['', ''], answerKey: {} }
    case 'AUDIO_CHOICE':
      return { audioUrl: '', options: ['', ''], correctAnswer: '' }
    default:
      return {}
  }
}

export interface SetMetadata {
  title: string
  description: string
  tamilTitle: string
  englishTitle: string
  level: string
  subject: string
  topic: string
  difficulty: QuestionSetDifficulty | ''
  estimatedDurationMinutes: string
  tags: string[]
  visibility: QuestionSetVisibility
  // Lets students start this set on their own from the GameRoom home.
  // Separate from `visibility` (teacher-to-teacher sharing). Live
  // Classroom never needs it -- a hosted set is always playable.
  published: boolean
}

export function emptyMetadata(): SetMetadata {
  return {
    title: '',
    description: '',
    tamilTitle: '',
    englishTitle: '',
    level: '',
    subject: '',
    topic: '',
    difficulty: '',
    estimatedDurationMinutes: '',
    tags: [],
    visibility: 'PRIVATE',
    published: false,
  }
}
