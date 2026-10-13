// Screenshot harness for GameRoom Classic (development only; never part of
// the Next app). Mounts the real screens with sample data so they can be
// looked at in Chrome without Clerk or a database. Phase 2 screens talk to
// an in-page stand-in for /api/gr-classic that runs the real validation and
// CSV code (lib/grClassic/validateQuestion, csv, importPlan) -- it mimics
// the API's shape only; the real checks also run in the database.
//   ?screen=home|teacher|library|create|... (see SCREENS)   &empty=1 = new teacher
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { Frame } from '@/components/grClassic/Frame'
import { Home } from '@/components/grClassic/Home'
import { TeacherDashboard } from '@/components/grClassic/teacher/TeacherDashboard'
import { CreateGameWizard } from '@/components/grClassic/teacher/CreateGameWizard'
import { QuestionLibrary } from '@/components/grClassic/teacher/QuestionLibrary'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { AssignmentResults } from '@/components/grClassic/teacher/AssignmentResults'
import { StudentHome } from '@/components/grClassic/student/StudentHome'
import { AssignmentsBoard } from '@/components/grClassic/student/AssignmentsBoard'
import { AssignmentReview } from '@/components/grClassic/student/AssignmentReview'
import { GamePlayer } from '@/components/grClassic/games/GamePlayer'
import { JoinLive } from '@/components/grClassic/live/JoinLive'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { STARTER_CATEGORIES } from '@/lib/grClassic/categories'
import { readImport } from '@/lib/grClassic/csv'
import { planImport } from '@/lib/grClassic/importPlan'
import { GAMES, LIBRARY, assignmentById, gameById, studentAssignments } from '@/lib/grClassic/sampleData'
import { validateQuestion, type QuestionInput, type ValidQuestion } from '@/lib/grClassic/validateQuestion'
import type { Category, GameSummary, Question } from '@/lib/grClassic/types'

const params = new URLSearchParams(location.search)
const empty = params.get('empty') === '1'

// ---- sample library with topic ids, as the server would send it ----
let categories: Category[] = STARTER_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name, own: false }))
const catId = (name: string) => categories.find((c) => c.name === name)?.id ?? null
const library: Question[] = empty ? [] : LIBRARY.map((q) => ({ ...q, categoryId: catId(q.category), difficulty: 'easy' }))
const summaries: GameSummary[] = empty ? [] : GAMES.map((g) => ({ id: g.id, title: g.title, type: g.type, category: g.category, questionCount: g.questions.length, updatedAt: g.updatedAt }))

function toQuestion(v: ValidQuestion, id: string): Question {
  const base = { id, categoryId: v.categoryId, category: categories.find((c) => c.id === v.categoryId)?.name ?? '', prompt: v.prompt, promptEn: v.promptEn ?? undefined, difficulty: v.difficulty }
  const p = v.payload as Record<string, unknown>
  if (v.kind === 'choice') return { ...base, kind: 'choice', options: p.options as string[], answerIndex: p.answerIndex as number, explanation: v.explanation ?? undefined }
  if (v.kind === 'match') return { ...base, kind: 'match', pairs: p.pairs as { left: string; right: string }[] }
  return { ...base, kind: 'order', unit: p.unit as 'letters' | 'words', answer: p.answer as string, hint: p.hint as string | undefined }
}
const keyOf = (q: Question) => {
  const v = validateQuestion({ ...(q as QuestionInput), categoryId: null })
  return v.ok ? v.value.contentKey : q.id
}

// ---- stand-in for /api/gr-classic ----
let seq = 1
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (!url.startsWith('/api/gr-classic')) return realFetch(input, init)
  const path = url.slice('/api/gr-classic'.length)
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(String(init.body)) : null
  await new Promise((r) => setTimeout(r, 120))
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  if (path === '/categories' && method === 'POST') {
    const c = { id: `cat-new-${seq++}`, name: String(body.name).trim(), own: true }
    categories = [...categories, c]
    return reply({ category: c }, 201)
  }
  if (path === '/questions' && method === 'POST') {
    const v = validateQuestion(body)
    if (!v.ok) return reply({ error: v.errors.join(' ') }, 400)
    const existing = library.find((q) => keyOf(q) === v.value.contentKey)
    if (existing) return reply({ question: existing, duplicate: true })
    const q = toQuestion(v.value, `new-${seq++}`)
    library.unshift(q)
    return reply({ question: q }, 201)
  }
  const one = path.match(/^\/questions\/([^/]+)$/)
  if (one && method === 'PATCH') {
    const v = validateQuestion(body)
    return v.ok ? reply({ question: toQuestion(v.value, one[1]) }) : reply({ error: v.errors.join(' ') }, 400)
  }
  if (one && method === 'DELETE') return reply({ archived: true })
  if (path === '/questions/import') {
    const parsed = readImport(body.csv)
    if (!parsed.ok) return reply({ error: parsed.error }, 400)
    const plan = planImport(parsed.rows, new Set(library.map(keyOf)), categories, (k) => k)
    const counts = { ok: plan.filter((r) => r.status === 'ok').length, duplicate: plan.filter((r) => r.status === 'duplicate').length, error: plan.filter((r) => r.status === 'error').length }
    if (!body.commit) return reply({ kind: parsed.kind, rows: plan.map(({ value: _v, ...r }) => r), counts })
    for (const r of plan.filter((p) => p.newTopic)) if (!catId(r.topic)) categories = [...categories, { id: `cat-new-${seq++}`, name: r.topic, own: true }]
    const qs = plan.filter((r) => r.status === 'ok').map((r) => toQuestion({ ...r.value!, categoryId: catId(r.topic) }, `imp-${seq++}`))
    library.unshift(...qs)
    return reply({ imported: qs.length, questions: qs, categories }, 201)
  }
  if (path === '/games' && method === 'POST') return reply({ id: `game-${seq++}` }, 201)
  const game = path.match(/^\/games\/([^/]+)(\/duplicate)?$/)
  if (game && game[2]) {
    const g = summaries.find((s) => s.id === game[1])!
    return reply({ game: { ...g, id: `${g.id}-copy-${seq++}`, title: `${g.title} (copy)` } }, 201)
  }
  if (game && method === 'DELETE') return reply({ archived: true })
  if (game && method === 'PATCH') return reply({ id: game[1] })
  return reply({ error: 'Not found' }, 404)
}

const g = (id: string) => gameById(id)!
const practice = (id: string) => <GamePlayer game={g(id)} mode="practice" exit={{ href: '#' }} />
const editGame = { ...g('g-word-builder'), categoryId: catId(g('g-word-builder').category), questions: library.filter((q) => g('g-word-builder').questions.some((x) => x.id === q.id)) }

export const SCREENS: Record<string, () => ReactNode> = {
  home: () => <Home />,
  teacher: () => <TeacherDashboard games={summaries} />,
  'teacher-pick-host': () => <TeacherDashboard games={summaries} pick="host" />,
  'teacher-assignments': () => <TeacherDashboard games={summaries} tab="assignments" />,
  'teachers-only': () => <TeachersOnly message="Teacher access required" />,
  library: () => <QuestionLibrary questions={library} categories={categories} />,
  create: () => <CreateGameWizard library={library} categories={categories} />,
  edit: () => <CreateGameWizard edit={editGame} library={library} categories={categories} />,
  assign: () => <AssignForm game={g('g-uyir-quiz')} />,
  results: () => <AssignmentResults assignment={assignmentById('a-uyir')!} game={g('g-uyir-quiz')} />,
  student: () => <StudentHome />,
  'student-assignments': () => <AssignmentsBoard />,
  review: () => <AssignmentReview a={studentAssignments().find((a) => a.assignment.id === 'a-inam')!} />,
  quiz: () => practice('g-uyir-quiz'),
  match: () => practice('g-porul-match'),
  word: () => practice('g-word-builder'),
  sentence: () => practice('g-sentence-builder'),
  'assignment-quiz': () => <GamePlayer game={g('g-uyir-quiz')} mode="assignment" assignment={{ attemptsLeftAfter: 1, showScore: true, randomize: false, dueAt: assignmentById('a-uyir')!.dueAt }} exit={{ href: '#' }} />,
  join: () => <JoinLive />,
  host: () => <HostLive game={g('g-uyir-quiz')} />,
  'host-race': () => <HostLive game={g('g-porul-match')} />,
}

const screen = params.get('screen') ?? 'home'
createRoot(document.getElementById('root')!).render(<Frame>{(SCREENS[screen] ?? SCREENS.home)()}</Frame>)
