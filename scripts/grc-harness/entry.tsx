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
import { LocalAssignmentPlayer } from '@/components/grClassic/games/LocalAssignmentPlayer'
import { JoinLive } from '@/components/grClassic/live/JoinLive'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { HostSetup } from '@/components/grClassic/live/HostSetup'
import { liveStandIn } from './liveStandIn'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { STARTER_CATEGORIES } from '@/lib/grClassic/categories'
import { readImport } from '@/lib/grClassic/csv'
import { planImport } from '@/lib/grClassic/importPlan'
import { checkResponse, hintFor, toPlayQuestion } from '@/lib/grClassic/play'
import { ASSIGNMENTS, CLASSES, GAMES, LIBRARY, assignmentById, className, gameById, resultsFor, studentAssignments } from '@/lib/grClassic/sampleData'
import { AssignmentRunner } from '@/components/grClassic/student/AssignmentRunner'
import { totals } from '@/lib/grClassic/scoring'
import { validateQuestion, type QuestionInput, type ValidQuestion } from '@/lib/grClassic/validateQuestion'
import type { AssignmentSummary, Category, GameSummary, PracticeGame, Question, QuestionResult } from '@/lib/grClassic/types'
import { PracticeRunner } from '@/components/grClassic/student/PracticeRunner'

const params = new URLSearchParams(location.search)
const live = liveStandIn(params)
const empty = params.get('empty') === '1'

// ---- sample library with topic ids, as the server would send it ----
let categories: Category[] = STARTER_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name, own: false }))
const catId = (name: string) => categories.find((c) => c.name === name)?.id ?? null
const library: Question[] = empty ? [] : LIBRARY.map((q) => ({ ...q, categoryId: catId(q.category), difficulty: 'easy' }))
const summaries: GameSummary[] = empty ? [] : GAMES.map((g, i) => ({ id: g.id, title: g.title, type: g.type, category: g.category, questionCount: g.questions.length, updatedAt: g.updatedAt, practice: i !== 1 }))
const practiceList: PracticeGame[] = empty ? [] : GAMES.map((g, i) => ({ id: g.id, title: g.title, type: g.type, questionCount: g.questions.length, teacher: 'Ms. Vani', bestPercent: i === 0 ? 80 : i === 2 ? 45 : null, plays: i === 0 || i === 2 ? 2 : 0 }))

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

// ---- sample assignments, as the server would send them ----
const assignmentSummaries: AssignmentSummary[] = empty ? [] : ASSIGNMENTS.map((a) => {
  const rs = resultsFor(a)
  return { id: a.id, title: a.title, type: a.type, classNames: a.classIds.map(className), dueAt: a.dueAt, status: a.status, submitted: rs.filter((r) => r.status === 'submitted').length, students: rs.length }
})
const sampleView = (id: string) => {
  const a = assignmentById(id)!
  return { assignment: a, classes: a.classIds.map((c) => ({ id: c, name: className(c) })), results: resultsFor(a) }
}

// ---- a stand-in attempt for the real AssignmentRunner (?resume=2, ?timer=1, ?closed=1, ?failsubmit=1) ----
const runGame = gameById('g-uyir-quiz')!
const answers = new Map<string, QuestionResult>()
let submitFailures = params.get('failsubmit') === '1' ? 1 : 0

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
  const lv = live(path, method, body)
  if (lv) return reply(lv.data, lv.status)

  // Practice: checked like the real server, with the answer revealed.
  const prac = path.match(new RegExp('^/practice/([^/]+)/(check|hint|finish)$'))
  if (prac) {
    if (prac[2] === 'finish') {
      ;(window as unknown as { __practiceFinished: number }).__practiceFinished = body.percent
      return reply({ bestPercent: body.percent, plays: 1 })
    }
    const q = gameById(prac[1])?.questions.find((x) => x.id === body.questionId)
    if (!q) return reply({ error: 'Question not found.' }, 404)
    return reply(prac[2] === 'check' ? checkResponse(q, body.response, true) : hintFor(q, body.matched))
  }
  const pswitch = path.match(new RegExp('^/games/([^/]+)/practice$'))
  if (pswitch) return reply({ practice: body.practice })
  // Saved-game preview: answers checked here, like the real server (?fail=1 = server down)
  const play = path.match(/^\/games\/([^/]+)\/(check|hint)$/)
  if (play) {
    if (params.get('fail') === '1') return reply({ error: 'Service unavailable' }, 503)
    const q = gameById(play[1])?.questions.find((x) => x.id === body.questionId)
    if (!q) return reply({ error: 'Question not found.' }, 404)
    return reply(play[2] === 'check' ? checkResponse(q, body.response, true) : hintFor(q, body.matched))
  }
  if (path === '/assignments' && method === 'POST') return reply({ id: 'a-uyir' }, 201)
  const asg = path.match(/^\/assignments\/([^/]+)(\/grant|\/start)?$/)
  if (asg && asg[2] === '/grant') return reply({ extra: 1 })
  if (asg && asg[2] === '/start') {
    if (params.get('closed') === '1') return reply({ error: 'Your teacher has closed this assignment.' }, 409)
    const resume = Number(params.get('resume') ?? 0)
    runGame.questions.slice(0, resume).forEach((q) => answers.set(q.id, { questionId: q.id, prompt: q.prompt, correctUnits: 1, totalUnits: 1, given: '', expected: '' }))
    return reply({ attemptId: 'att-1', title: runGame.title, type: runGame.type, questions: runGame.questions.map(toPlayQuestion), answeredIds: Array.from(answers.keys()), deadlineAt: params.get('timer') === '1' ? new Date(Date.now() + 8000).toISOString() : null, attemptNo: 1, attemptsLeftAfter: 1 })
  }
  if (asg && method === 'PATCH') return reply({ dueAt: body.dueAt ?? assignmentById(asg[1])!.dueAt, status: body.status ?? 'open' })
  const att = path.match(/^\/attempts\/([^/]+)\/(check|submit)$/)
  if (att && att[2] === 'check') {
    const q = runGame.questions.find((x) => x.id === body.questionId)!
    const res = checkResponse(q, body.response, false)
    if (!answers.has(q.id)) answers.set(q.id, { questionId: q.id, prompt: q.prompt, correctUnits: res.correct ? 1 : 0, totalUnits: 1, given: '', expected: '' })
    return reply(res)
  }
  if (att && att[2] === 'submit') {
    if (submitFailures-- > 0) return reply({ error: 'Something went wrong. Your answers so far are saved — please try again.' }, 500)
    const t = totals(runGame.questions.map((q) => answers.get(q.id) ?? { questionId: q.id, prompt: '', correctUnits: 0, totalUnits: 1, given: '', expected: '' }))
    return reply({ submittedAt: new Date().toISOString(), percent: t.percent, correct: t.correct, total: t.total, attemptsLeft: 1, late: false, answersNote: 'The right answers appear after the due date.' })
  }
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
const remote = (id: string) => <GamePlayer game={g(id)} play={{ source: 'remote', base: `/games/${id}`, questions: g(id).questions.map(toPlayQuestion) }} mode="preview" exit={{ href: '#' }} />
const practice = (id: string) => <GamePlayer game={g(id)} play={{ source: 'local', questions: g(id).questions }} mode="practice" exit={{ href: '#' }} />
const editGame = { ...g('g-word-builder'), categoryId: catId(g('g-word-builder').category), questions: library.filter((q) => g('g-word-builder').questions.some((x) => x.id === q.id)) }

export const SCREENS: Record<string, () => ReactNode> = {
  home: () => <Home />,
  teacher: () => <TeacherDashboard games={summaries} assignments={assignmentSummaries} />,
  'teacher-pick-host': () => <TeacherDashboard games={summaries} assignments={assignmentSummaries} pick="host" />,
  'teacher-assignments': () => <TeacherDashboard games={summaries} assignments={assignmentSummaries} tab="assignments" />,
  'teachers-only': () => <TeachersOnly message="Teacher access required" />,
  library: () => <QuestionLibrary questions={library} categories={categories} />,
  create: () => <CreateGameWizard library={library} categories={categories} />,
  edit: () => <CreateGameWizard edit={editGame} library={library} categories={categories} />,
  assign: () => <AssignForm game={{ id: 'g-uyir-quiz', title: g('g-uyir-quiz').title, type: 'quiz', category: g('g-uyir-quiz').category, questionCount: 5 }} classes={empty ? [] : CLASSES} />,
  results: () => <AssignmentResults view={sampleView('a-uyir')} />,
  student: () => <StudentHome name="Kavin" assignments={empty ? [] : studentAssignments()} practice={practiceList} />,
  practice: () => <PracticeRunner gameId="g-uyir-quiz" title={g('g-uyir-quiz').title} type="quiz" questions={g('g-uyir-quiz').questions.map(toPlayQuestion)} />,
  'student-assignments': () => <AssignmentsBoard items={empty ? [] : studentAssignments()} />,
  runner: () => <AssignmentRunner assignmentId="a-run" />,
  review: () => <AssignmentReview a={studentAssignments().find((a) => a.assignment.id === 'a-inam')!} />,
  quiz: () => practice('g-uyir-quiz'),
  match: () => practice('g-porul-match'),
  word: () => practice('g-word-builder'),
  sentence: () => practice('g-sentence-builder'),
  'assignment-quiz': () => <LocalAssignmentPlayer game={g('g-uyir-quiz')} attemptsLeftAfter={1} randomize={false} exitHref="#" />,
  'remote-quiz': () => remote('g-uyir-quiz'),
  'remote-match': () => remote('g-porul-match'),
  'remote-word': () => remote('g-word-builder'),
  join: () => <JoinLive name="Kavin" />,
  host: () => <HostLive sessionId="live-1" />,
  'host-setup': () => <HostSetup gameId="g-uyir-quiz" title={g('g-uyir-quiz').title} type="quiz" classes={CLASSES} />,
}

const screen = params.get('screen') ?? 'home'
createRoot(document.getElementById('root')!).render(<Frame>{(SCREENS[screen] ?? SCREENS.home)()}</Frame>)
