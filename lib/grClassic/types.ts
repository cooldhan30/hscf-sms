// GameRoom Classic domain types. Shared by every play mode (live,
// practice, assignment) so a game is authored once and played anywhere.

export type GameType = 'quiz' | 'match' | 'word-builder'

export type Difficulty = 'easy' | 'medium' | 'hard'

// Multiple choice (Classic Quiz): 2-4 options, one correct.
export interface ChoiceQuestion {
  id: string
  categoryId?: string | null
  difficulty?: Difficulty
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
  categoryId?: string | null
  difficulty?: Difficulty
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
  categoryId?: string | null
  difficulty?: Difficulty
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
  categoryId?: string | null
  difficulty: Difficulty
  questions: Question[]
  // Seconds per question in Live play only; practice and assignments are untimed per question.
  liveSeconds: number
  updatedAt: string
}

// A topic in the question library. `own` = made by this teacher (starter topics are shared).
export interface Category {
  id: string
  name: string
  own: boolean
}

// What My Games lists -- a game without its questions.
export interface GameSummary {
  id: string
  title: string
  type: GameType
  category: string
  questionCount: number
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

// A published assignment. Title, type and questions are frozen when it is
// published, so later edits to the game never change it.
export interface Assignment {
  id: string
  gameId: string | null
  title: string
  type: GameType
  classIds: string[]
  dueAt: string
  status: 'open' | 'closed'
  settings: AssignmentSettings
  questionCount: number
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
  expected: string // '' when the answer may not be shown yet
  explanation?: string
}

export interface StudentResult {
  studentId: string
  name: string
  classId: string
  status: AttemptStatus
  percent: number | null
  attemptsUsed: number
  extraAttempts: number
  attemptLimit: number | null // null = unlimited (includes extra attempts)
  submittedAt: string | null
  late: boolean
  questions: QuestionResult[]
}

export type StudentAssignmentStatus = 'todo' | 'in-progress' | 'submitted' | 'overdue'

export interface StudentAssignment {
  assignment: Assignment
  className: string
  status: StudentAssignmentStatus
  attemptsUsed: number
  attemptLimit: number | null // null = unlimited
  bestPercent: number | null // the score that counts (best or latest, per the teacher)
  submittedAt: string | null
  questions: QuestionResult[]
  answersVisible: boolean
}

// What the server confirms after Finish & Submit.
export interface SubmitSummary {
  submittedAt: string
  percent: number
  correct: number
  total: number
  attemptsLeft: number | null // null = unlimited
  late: boolean
  answersNote: string
}

// A teacher's view of one of their classes when assigning.
export interface TeacherClass {
  id: string
  name: string
  studentCount: number
}

// One row of the teacher's assignment list.
export interface AssignmentSummary {
  id: string
  title: string
  type: GameType
  classNames: string[]
  dueAt: string
  status: 'open' | 'closed'
  submitted: number
  students: number
}
