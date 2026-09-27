// Browser playtest harness for Tamil Grand Prix (development only; never
// part of the Next app or the production build). It mounts the REAL
// RaceGame3D component, with an in-page stand-in for the session API so
// the race, its question gates and the podium can be driven in Chromium
// without a login or a database. The stand-in only mimics the API's
// shape; grading in the real app stays on the server.
//
//   node scripts/racing-harness/build.mjs && open the printed file
import { createRoot } from 'react-dom/client'
import { RaceGame3D } from '@/components/gameRoomV2/racing3d/RaceGame3D'

const QUESTIONS = [
  { prompt: '"அம்மா" -- எந்த எழுத்தில் தொடங்குகிறது?', options: ['அ', 'ஆ', 'இ', 'உ'], answer: 'அ' },
  { prompt: '"பூ" என்பதன் பொருள்?', options: ['Flower', 'Tree', 'Water', 'Sun'], answer: 'Flower' },
  { prompt: 'எண் 5 -- தமிழில்?', options: ['ஐந்து', 'மூன்று', 'ஏழு', 'பத்து'], answer: 'ஐந்து' },
  { prompt: '"நீர்" என்பதன் பொருள்?', options: ['Fire', 'Water', 'Air', 'Earth'], answer: 'Water' },
  { prompt: 'உயிர் எழுத்துகள் எத்தனை?', options: ['12', '18', '30', '247'], answer: '12' },
  { prompt: '"வீடு" என்பதன் பொருள்?', options: ['School', 'House', 'Road', 'Car'], answer: 'House' },
]

const session = { status: 'ACTIVE' as string, currentIndex: 0, startedAt: Date.now() }
const params = new URLSearchParams(location.search)
const autoWrong = params.get('wrong') === '1'
;(window as unknown as { __harness: unknown }).__harness = { session, QUESTIONS }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const m = url.match(/\/api\/gameroom-v2\/sessions\/[^/]+\/(\w+)/)
  if (!m) return realFetch(input, init)
  const action = m[1]
  const total = QUESTIONS.length
  if (action === 'pause' && session.status === 'ACTIVE') session.status = 'PAUSED'
  if (action === 'resume' && session.status === 'PAUSED') session.status = 'ACTIVE'
  if (action === 'answer') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { questionIndex: number; answer: string }
    const q = QUESTIONS[body.questionIndex]
    const correct = !autoWrong && body.answer === q.answer
    session.currentIndex = Math.min(total, session.currentIndex + 1)
    if (session.currentIndex >= total) session.status = 'COMPLETED'
    return json({ isCorrect: correct, points: correct ? 10 : 0, responseTimeMs: 1500, correctAnswer: correct ? null : q.answer, explanation: correct ? null : 'மீண்டும் முயலுங்கள்.' })
  }
  if (action === 'complete') {
    return json({ sessionId: 'harness', score: 40, accuracyPct: 67, correctCount: 4, incorrectCount: 2, totalQuestions: total, xpEarned: 55, coinsEarned: 12, bestStreak: 3, skillsPracticed: ['Vocabulary'], newlyEarnedAchievementIds: [] })
  }
  if (action === 'abandon') return json({ ok: true })
  const q = session.status === 'ACTIVE' && session.currentIndex < total ? QUESTIONS[session.currentIndex] : null
  return json({
    status: session.status,
    currentIndex: session.currentIndex,
    totalQuestions: total,
    remainingSeconds: q ? 30 : null,
    question: q ? { id: `q${session.currentIndex}`, questionType: 'MULTIPLE_CHOICE', prompt: q.prompt, payload: { options: q.options }, mediaUrl: null, points: 10 } : null,
  })
}

try {
  window.localStorage.setItem('tamizhi.e2e', '1')
} catch {
  // storage unavailable
}
const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<RaceGame3D sessionId="harness" onExit={() => location.reload()} onPlayAgain={() => location.reload()} onHome={() => location.reload()} />)
