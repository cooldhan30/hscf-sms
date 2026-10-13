// GameRoom Classic domain types. Shared by every play mode (live,
// practice, assignment) so a game is authored once and played anywhere.

export type GameType = 'quiz' | 'match' | 'word-builder'

export type Difficulty = 'easy' | 'medium' | 'hard'

// Multiple choice (Classic Quiz): 2-4 options, one correct.
export interface ChoiceQuestion {
  id: string
  kind: 'choice'
  category: string
  prompt: string
  promptEn?: string
  options: string[]
  answerIndex: number
  explanation?: string
  imageUrl?: string
}

// Match the Pairs: each left item has exactly one right item.
export interface MatchQuestion {
  id: string
  kind: 'match'
  category: string
  prompt: string
  promptEn?: string
  pairs: { left: string; right: string }[]
}

// Word Builder: arrange letters into a word, or words into a sentence.
// `answer` is the finished word/sentence; tiles are derived from it with
// Tamil-aware letter splitting (lib/grClassic/graphemes.ts).
export interface OrderQuestion {
  id: string
  kind: 'order'
  category: string
  prompt: string
  promptEn?: string
  unit: 'letters' | 'words'
  answer: string
  hint?: string
}

export type Question = ChoiceQuestion | MatchQuestion | OrderQuestion
export type QuestionKind = Question['kind']

// Each game type plays exactly one question kind -- incompatible formats
// are never forced into a game.
export const QUESTION_KIND_FOR_GAME: Record<GameType, QuestionKind> = {
  quiz: 'choice',
  match: 'match',
  'word-builder': 'order',
}

export interface Game {
  id: string
  title: string
  type: GameType
  category: string
  difficulty: Difficulty
  questions: Question[]
  // Seconds per question in Live play only; practice and assignments are untimed per question.
  liveSeconds: number
  updatedAt: string
}

export interface ClassInfo {
  id: string
  name: string
  studentCount: number
}

export interface AssignmentSettings {
  maxAttempts: number | null // null = unlimited
  timerMinutes: number | null
  passingPercent: number | null
  randomize: boolean
  allowLate: boolean
  showAnswers: 'after-due' | 'after-submit' | 'never'
  scorePolicy: 'best' | 'latest'
}

export const DEFAULT_ASSIGNMENT_SETTINGS: AssignmentSettings = {
  maxAttempts: 2,
  timerMinutes: null,
  passingPercent: null,
  randomize: true,
  allowLate: false,
  showAnswers: 'after-due',
  scorePolicy: 'best',
}

export interface Assignment {
  id: string
  gameId: string
  classIds: string[]
  dueAt: string
  status: 'open' | 'closed'
  settings: AssignmentSettings
}

export type AttemptStatus = 'not-started' | 'in-progress' | 'submitted'

// One question's outcome. `units` lets Matching count pairs while Quiz and
// Word Builder count one per question.
export interface QuestionResult {
  questionId: string
  prompt: string
  correctUnits: number
  totalUnits: number
  given: string
  expected: string
}

export interface StudentResult {
  studentId: string
  name: string
  classId: string
  status: AttemptStatus
  percent: number | null
  attemptsUsed: number
  extraAttempts: number
  submittedAt: string | null
  questions: QuestionResult[]
}

export type StudentAssignmentStatus = 'todo' | 'in-progress' | 'submitted' | 'overdue'

export interface StudentAssignment {
  assignment: Assignment
  game: Game
  className: string
  status: StudentAssignmentStatus
  attemptsUsed: number
  bestPercent: number | null
  submittedAt: string | null
  questions: QuestionResult[]
}
