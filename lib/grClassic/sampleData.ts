import { inDays } from './format'
import { joinTiles, tilesFor } from './graphemes'
import { DEFAULT_ASSIGNMENT_SETTINGS } from './types'
import type { Assignment, ChoiceQuestion, ClassInfo, Game, MatchQuestion, OrderQuestion, Question, QuestionResult, StudentAssignment, StudentResult } from './types'

// Phase 1 prototype data only -- nothing here is read from or written to
// the database. Replaced by real queries in Phases 2-4.

const choice = (id: string, category: string, prompt: string, promptEn: string, options: string[], answerIndex: number, explanation?: string): ChoiceQuestion => ({ id, kind: 'choice', category, prompt, promptEn, options, answerIndex, explanation })
const match = (id: string, category: string, prompt: string, promptEn: string, pairs: [string, string][]): MatchQuestion => ({ id, kind: 'match', category, prompt, promptEn, pairs: pairs.map(([left, right]) => ({ left, right })) })
const order = (id: string, category: string, unit: OrderQuestion['unit'], answer: string, promptEn: string, hint?: string): OrderQuestion => ({
  id,
  kind: 'order',
  category,
  prompt: unit === 'letters' ? 'எழுத்துக்களை அடுக்கிச் சொல்லை அமை' : 'சொற்களை அடுக்கி வாக்கியம் அமை',
  promptEn,
  unit,
  answer,
  hint,
})

const UYIR = 'உயிர் எழுத்துக்கள்'
const INAM = 'வல்லினம் / மெல்லினம் / இடையினம்'
const PEYAR = 'பெயர்ச்சொல் வகைகள்'
const THINAI = 'திணை'
const PORUL = 'சொல் பொருள்'
const VAAKKIYAM = 'வாக்கிய அமைப்பு'

export const LIBRARY: Question[] = [
  choice('q-uyir-1', UYIR, 'தமிழில் எத்தனை உயிர் எழுத்துக்கள் உள்ளன?', 'How many vowels are there in Tamil?', ['10', '12', '18', '247'], 1, 'அ முதல் ஔ வரை 12 உயிர் எழுத்துக்கள்.'),
  choice('q-uyir-2', UYIR, 'இவற்றில் நெடில் எழுத்து எது?', 'Which one is a long vowel (நெடில்)?', ['அ', 'இ', 'ஊ', 'எ'], 2, 'நெடில்: ஆ ஈ ஊ ஏ ஐ ஓ ஔ'),
  choice('q-uyir-3', UYIR, 'இவற்றில் குறில் எழுத்து எது?', 'Which one is a short vowel (குறில்)?', ['ஆ', 'ஈ', 'உ', 'ஓ'], 2, 'குறில்: அ இ உ எ ஒ'),
  choice('q-uyir-4', UYIR, '"அம்மா" என்ற சொல் எந்த எழுத்தில் தொடங்குகிறது?', 'Which letter does "அம்மா" start with?', ['அ', 'ஆ', 'இ', 'உ'], 0),
  choice('q-uyir-5', UYIR, '"ஐ" குறிலா நெடிலா?', 'Is "ஐ" short or long?', ['குறில்', 'நெடில்'], 1, 'ஐ ஒரு நெடில் எழுத்து.'),
  choice('q-inam-1', INAM, 'தமிழில் எத்தனை மெய் எழுத்துக்கள் உள்ளன?', 'How many consonants are there in Tamil?', ['12', '16', '18', '30'], 2),
  choice('q-inam-2', INAM, 'இவற்றில் வல்லின எழுத்து எது?', 'Which one is வல்லினம் (hard)?', ['க', 'ங', 'ய', 'ம'], 0, 'வல்லினம்: க ச ட த ப ற'),
  choice('q-inam-3', INAM, 'இவற்றில் மெல்லின எழுத்து எது?', 'Which one is மெல்லினம் (soft)?', ['ச', 'ஞ', 'ர', 'ட'], 1, 'மெல்லினம்: ங ஞ ண ந ம ன'),
  choice('q-inam-4', INAM, 'இவற்றில் இடையின எழுத்து எது?', 'Which one is இடையினம் (medium)?', ['ப', 'ந', 'வ', 'த'], 2, 'இடையினம்: ய ர ல வ ழ ள'),
  choice('q-peyar-1', PEYAR, '"சென்னை" எந்த வகைப் பெயர்ச்சொல்?', 'What kind of noun is "சென்னை"?', ['இடப்பெயர்', 'பொருட்பெயர்', 'காலப்பெயர்', 'சினைப்பெயர்'], 0, 'ஓர் இடத்தின் பெயர் -- இடப்பெயர்.'),
  choice('q-peyar-2', PEYAR, '"காலை" எந்த வகைப் பெயர்ச்சொல்?', 'What kind of noun is "காலை"?', ['பொருட்பெயர்', 'காலப்பெயர்', 'இடப்பெயர்', 'பண்புப்பெயர்'], 1, 'நேரத்தைக் குறிப்பது -- காலப்பெயர்.'),
  choice('q-thinai-1', THINAI, '"மாணவன்" எந்தத் திணை?', 'Which திணை is "மாணவன்"?', ['உயர்திணை', 'அஃறிணை'], 0, 'மனிதர்கள் உயர்திணை.'),
  choice('q-thinai-2', THINAI, '"மரம்" எந்தத் திணை?', 'Which திணை is "மரம்"?', ['உயர்திணை', 'அஃறிணை'], 1, 'மனிதர் அல்லாதவை அஃறிணை.'),
  match('q-porul-1', PORUL, 'சொல்லையும் பொருளையும் பொருத்துக', 'Match each word to its meaning', [['பூனை', 'cat'], ['நாய்', 'dog'], ['பசு', 'cow'], ['யானை', 'elephant']]),
  match('q-porul-2', PORUL, 'சொல்லையும் பொருளையும் பொருத்துக', 'Match each word to its meaning', [['மரம்', 'tree'], ['வீடு', 'house'], ['நீர்', 'water'], ['பழம்', 'fruit']]),
  match('q-inam-m1', INAM, 'எழுத்தையும் அதன் வகையையும் பொருத்துக', 'Match each letter to its group', [['க', 'வல்லினம்'], ['ம', 'மெல்லினம்'], ['ல', 'இடையினம்'], ['ஆ', 'உயிர் எழுத்து']]),
  order('q-word-1', UYIR, 'letters', 'அம்மா', 'mother', 'அ-வில் தொடங்கும்'),
  order('q-word-2', UYIR, 'letters', 'பள்ளி', 'school'),
  order('q-word-3', UYIR, 'letters', 'தமிழ்', 'Tamil'),
  order('q-word-4', UYIR, 'letters', 'கண்ணாடி', 'mirror'),
  order('q-word-5', UYIR, 'letters', 'மயில்', 'peacock'),
  order('q-sent-1', VAAKKIYAM, 'words', 'நான் பள்ளிக்குச் செல்கிறேன்', 'I am going to school.'),
  order('q-sent-2', VAAKKIYAM, 'words', 'அம்மா சோறு சமைக்கிறார்', 'Mother is cooking rice.'),
  order('q-sent-3', VAAKKIYAM, 'words', 'பறவை வானில் பறக்கிறது', 'The bird is flying in the sky.'),
]

const q = (...ids: string[]) => ids.map((id) => LIBRARY.find((x) => x.id === id)!)

export const GAMES: Game[] = [
  { id: 'g-uyir-quiz', title: 'உயிர் எழுத்துக்கள் வினாடி வினா', type: 'quiz', category: UYIR, difficulty: 'easy', questions: q('q-uyir-1', 'q-uyir-2', 'q-uyir-3', 'q-uyir-4', 'q-uyir-5'), liveSeconds: 20, updatedAt: inDays(-2) },
  { id: 'g-inam-quiz', title: 'வல்லினம் · மெல்லினம் · இடையினம்', type: 'quiz', category: INAM, difficulty: 'medium', questions: q('q-inam-1', 'q-inam-2', 'q-inam-3', 'q-inam-4'), liveSeconds: 20, updatedAt: inDays(-5) },
  { id: 'g-porul-match', title: 'சொல்லும் பொருளும்', type: 'match', category: PORUL, difficulty: 'easy', questions: q('q-porul-1', 'q-porul-2'), liveSeconds: 20, updatedAt: inDays(-1) },
  { id: 'g-inam-match', title: 'எழுத்து வகைகளைப் பொருத்து', type: 'match', category: INAM, difficulty: 'medium', questions: q('q-inam-m1'), liveSeconds: 20, updatedAt: inDays(-9) },
  { id: 'g-word-builder', title: 'எழுத்துக்களை அடுக்கு', type: 'word-builder', category: UYIR, difficulty: 'easy', questions: q('q-word-1', 'q-word-2', 'q-word-3', 'q-word-4', 'q-word-5'), liveSeconds: 30, updatedAt: inDays(-3) },
  { id: 'g-sentence-builder', title: 'வாக்கியம் அமைப்போம்', type: 'word-builder', category: VAAKKIYAM, difficulty: 'medium', questions: q('q-sent-1', 'q-sent-2', 'q-sent-3'), liveSeconds: 30, updatedAt: inDays(-4) },
]

export function gameById(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id)
}

export const CLASSES: ClassInfo[] = [
  { id: 'c-2a', name: 'Grade 2 · A', studentCount: 6 },
  { id: 'c-3a', name: 'Grade 3 · A', studentCount: 6 },
  { id: 'c-4b', name: 'Grade 4 · B', studentCount: 5 },
]

const ROSTER: { id: string; name: string; classId: string }[] = [
  ['Kavin', 'c-2a'], ['Nila', 'c-2a'], ['Aadhav', 'c-2a'], ['Meera', 'c-2a'], ['Yazhini', 'c-2a'], ['Arjun', 'c-2a'],
  ['Kayal', 'c-3a'], ['Ilan', 'c-3a'], ['Mugil', 'c-3a'], ['Tamizh', 'c-3a'], ['Anbu', 'c-3a'], ['Malar', 'c-3a'],
  ['Sudar', 'c-4b'], ['Oviya', 'c-4b'], ['Vetri', 'c-4b'], ['Inba', 'c-4b'], ['Thendral', 'c-4b'],
].map(([name, classId], i) => ({ id: `s-${i + 1}`, name, classId }))

export const LIVE_ROSTER = ROSTER.filter((s) => s.classId === 'c-2a' || s.classId === 'c-3a').map((s) => s.name)

export const ASSIGNMENTS: Assignment[] = [
  { id: 'a-uyir', gameId: 'g-uyir-quiz', classIds: ['c-2a', 'c-3a'], dueAt: inDays(3), status: 'open', settings: { ...DEFAULT_ASSIGNMENT_SETTINGS } },
  { id: 'a-words', gameId: 'g-word-builder', classIds: ['c-2a'], dueAt: inDays(-1), status: 'open', settings: { ...DEFAULT_ASSIGNMENT_SETTINGS } },
  { id: 'a-porul', gameId: 'g-porul-match', classIds: ['c-3a', 'c-4b'], dueAt: inDays(7), status: 'open', settings: { ...DEFAULT_ASSIGNMENT_SETTINGS, allowLate: true } },
  { id: 'a-inam', gameId: 'g-inam-quiz', classIds: ['c-2a'], dueAt: inDays(-4), status: 'closed', settings: { ...DEFAULT_ASSIGNMENT_SETTINGS, showAnswers: 'after-submit' } },
  { id: 'a-sent', gameId: 'g-sentence-builder', classIds: ['c-2a'], dueAt: inDays(5), status: 'open', settings: { ...DEFAULT_ASSIGNMENT_SETTINGS, maxAttempts: 3 } },
]

export function assignmentById(id: string): Assignment | undefined {
  return ASSIGNMENTS.find((a) => a.id === id)
}

export function className(id: string): string {
  return CLASSES.find((c) => c.id === id)?.name ?? id
}

// Deterministic fake answers: student n gets question k right unless (n + k) % 4 === 0.
function fakeResults(game: Game, seed: number): QuestionResult[] {
  return game.questions.map((question, k) => {
    const right = (seed + k) % 4 !== 0
    if (question.kind === 'choice') {
      const wrongIndex = (question.answerIndex + 1) % question.options.length
      return { questionId: question.id, prompt: question.prompt, correctUnits: right ? 1 : 0, totalUnits: 1, given: question.options[right ? question.answerIndex : wrongIndex], expected: question.options[question.answerIndex] }
    }
    if (question.kind === 'match') {
      const n = question.pairs.length
      return { questionId: question.id, prompt: question.prompt, correctUnits: right ? n : n - 2, totalUnits: n, given: right ? 'All pairs right' : `${question.pairs[0].left} → ${question.pairs[1].right}, ${question.pairs[1].left} → ${question.pairs[0].right}`, expected: question.pairs.map((p) => `${p.left} → ${p.right}`).join(', ') }
    }
    return { questionId: question.id, prompt: question.prompt, correctUnits: right ? 1 : 0, totalUnits: 1, given: right ? question.answer : joinTiles(tilesFor(question).reverse(), question.unit), expected: question.answer }
  })
}

const percentOf = (rs: QuestionResult[]) => Math.round((100 * rs.reduce((n, r) => n + r.correctUnits, 0)) / rs.reduce((n, r) => n + r.totalUnits, 0))

export function resultsFor(assignment: Assignment): StudentResult[] {
  const game = gameById(assignment.gameId)!
  return ROSTER.filter((s) => assignment.classIds.includes(s.classId)).map((s, i) => {
    const n = Number(s.id.slice(2))
    const bucket = (n * 7 + assignment.id.length) % 6
    const status = bucket <= 2 ? 'submitted' : bucket === 3 ? 'in-progress' : 'not-started'
    const questions = status === 'submitted' ? fakeResults(game, n) : []
    return {
      studentId: s.id,
      name: s.name,
      classId: s.classId,
      status,
      percent: status === 'submitted' ? percentOf(questions) : null,
      attemptsUsed: status === 'submitted' ? 1 + (n % 2) : status === 'in-progress' ? 1 : 0,
      extraAttempts: 0,
      submittedAt: status === 'submitted' ? inDays(-1 - (i % 3), 18) : null,
      questions,
    }
  })
}

// The sample student (Kavin, Grade 2 · A) sees these.
export const SAMPLE_STUDENT = { name: 'Kavin', classId: 'c-2a' }

export function studentAssignments(): StudentAssignment[] {
  const row = (id: string, status: StudentAssignment['status'], attemptsUsed: number, seed: number | null): StudentAssignment => {
    const assignment = assignmentById(id)!
    const game = gameById(assignment.gameId)!
    const questions = seed === null ? [] : fakeResults(game, seed)
    return {
      assignment,
      game,
      className: className(SAMPLE_STUDENT.classId),
      status,
      attemptsUsed,
      bestPercent: seed === null ? null : percentOf(questions),
      submittedAt: seed === null ? null : inDays(-5, 17),
      questions,
    }
  }
  return [row('a-sent', 'todo', 0, null), row('a-uyir', 'in-progress', 1, null), row('a-inam', 'submitted', 1, 1), row('a-words', 'overdue', 0, null)]
}

export const SAMPLE_LIVE_PIN = '482913'
