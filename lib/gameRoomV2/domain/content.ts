import type { GameRoomQuestionType, QuestionPayloadFor } from './questionTypes'
import type { QuestionSetLanguage } from './language'

export const QUESTION_SET_VISIBILITIES = ['PRIVATE', 'SCHOOL', 'PUBLIC'] as const
export type QuestionSetVisibility = (typeof QUESTION_SET_VISIBILITIES)[number]

export const QUESTION_SET_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type QuestionSetDifficulty = (typeof QUESTION_SET_DIFFICULTIES)[number]

// The CONTENT half of GameRoom V2's content/gameplay split. A teacher
// authors a GameRoomQuestionSet once; it carries no reference to any
// game engine at all -- which engines can play it is determined later,
// by comparing this set's `questionTypes` against a
// GameEngineCompatibility.supportedQuestionTypes (see engine.ts). This
// is the deliberate architectural difference from legacy GameRoom,
// where a "module" bundles its own question bank AND its own play
// engine together (lib/gameRoom/gameModule.ts's GameModule interface) --
// V2 question sets are engine-agnostic by construction, not by
// convention.
export interface GameRoomQuestionSet {
  id: string
  title: string
  description: string | null
  // Optional Tamil/English-specific display titles (migration 074) --
  // separate from `title` (the internal/administrative name) so a
  // teacher can show students "திணை சவால்" while the set is still
  // titled "Grammar Set 3 - Thinai" in their own list. Either or both
  // may be null; `title` is always the fallback for display.
  tamilTitle: string | null
  englishTitle: string | null
  // நிலை -- reuses the same GRADE_LEVEL_OPTIONS values as the rest of
  // the app (lib/constants.ts), not a separate scale.
  level: string | null
  subject: string | null
  topic: string | null
  difficulty: QuestionSetDifficulty | null
  estimatedDurationMinutes: number | null
  tags: string[]
  visibility: QuestionSetVisibility
  // Auto-detected from the set's own text at save time (see
  // language.ts's detectLanguage()) -- never teacher-entered, so it
  // can't drift from the actual content.
  language: QuestionSetLanguage
  // null = a shared/library set usable by any class, same convention
  // as sms_resources.class_id.
  classId: string | null
  createdBy: string
  // Every distinct question_type present among this set's questions --
  // denormalized (see migration 073's comment) purely so a question-set
  // picker can filter/label sets by compatible engines without loading
  // every question.
  questionTypes: GameRoomQuestionType[]
  questionCount: number
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface GameRoomQuestion<T extends GameRoomQuestionType = GameRoomQuestionType> {
  id: string
  questionSetId: string
  sortOrder: number
  questionType: T
  prompt: string
  payload: QuestionPayloadFor<T>
  explanation: string | null
  mediaUrl: string | null
  points: number
  createdAt: string
  updatedAt: string
}

// A question set together with its ordered questions -- the shape an
// engine actually needs to run a session; a picker/list view only needs
// the GameRoomQuestionSet summary above.
export interface GameRoomQuestionSetWithQuestions extends GameRoomQuestionSet {
  questions: GameRoomQuestion[]
}
