// Browser harness for the Little Learners games (development only; never
// part of the Next app or the production build). Mounts the REAL game
// component with an in-page stand-in for the session API, so the game can
// be played and screenshotted in Chromium without a login or a database.
// The stand-in only mimics the API's shape; real grading stays on the server.
//
//   node scripts/kids-harness/build.mjs && open the printed file
//   ?engine=balloon-pop  ?set=vowels|mixed  ?wrong=1 (every answer graded wrong)
import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import { BalloonPopGame } from '@/components/gameRoomV2/balloonPop/BalloonPopGame'

type Q = { type: string; prompt: string; payload: Record<string, unknown>; answer: string | boolean; reveal: string }

// The built-in உயிரெழுத்துகள் quiz (lib/gameRoomV2/builtin/content/letters.ts)
const VOWELS: Q[] = [
  { type: 'MULTIPLE_CHOICE', prompt: 'தமிழின் முதல் எழுத்து எது? (Which is the first Tamil letter?)', payload: { options: ['க', 'அ', 'ஃ', 'ஔ'] }, answer: 'அ', reveal: 'அ' },
  { type: 'MULTIPLE_CHOICE', prompt: 'அ, ஆ, இ, ___ -- அடுத்த உயிரெழுத்து எது?', payload: { options: ['உ', 'எ', 'ஈ', 'ஐ'] }, answer: 'ஈ', reveal: 'ஈ' },
  { type: 'MULTIPLE_CHOICE', prompt: '"ஆடு" என்ற சொல் எந்த எழுத்தில் தொடங்குகிறது?', payload: { options: ['அ', 'ஔ', 'ஆ', 'ஓ'] }, answer: 'ஆ', reveal: 'ஆ' },
  { type: 'MULTIPLE_CHOICE', prompt: 'இவற்றுள் உயிரெழுத்து எது? (Which one is a vowel?)', payload: { options: ['க்', 'ஏ', 'ம', 'ஃ'] }, answer: 'ஏ', reveal: 'ஏ' },
  { type: 'MULTIPLE_CHOICE', prompt: '"ஐ" எந்த வகை எழுத்து?', payload: { options: ['மெய்யெழுத்து', 'உயிரெழுத்து', 'உயிர்மெய்யெழுத்து', 'ஆய்த எழுத்து'] }, answer: 'உயிரெழுத்து', reveal: 'உயிரெழுத்து' },
  { type: 'TRUE_FALSE', prompt: 'உயிரெழுத்துகள் 12. (There are 12 vowels.)', payload: {}, answer: true, reveal: 'True' },
]

const params = new URLSearchParams(location.search)
const QUESTIONS = VOWELS
const autoWrong = params.get('wrong') === '1'
const session = { status: 'ACTIVE' as string, currentIndex: Number(params.get('start') ?? 0), correct: 0 }
;(window as unknown as { __harness: unknown }).__harness = { session, QUESTIONS }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const m = url.match(/\/api\/gameroom-v2\/sessions\/[^/]+\/(\w+)/)
  if (!m) return realFetch(input, init)
  const action = m[1]
  const total = QUESTIONS.length
  if (action === 'answer') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { questionIndex: number; answer: string | boolean }
    const q = QUESTIONS[body.questionIndex]
    const correct = !autoWrong && body.answer === q.answer
    if (correct) session.correct++
    session.currentIndex = Math.min(total, session.currentIndex + 1)
    if (session.currentIndex >= total) session.status = 'COMPLETED'
    return json({ isCorrect: correct, points: correct ? 1000 : 0, xpEarned: correct ? 10 : 0, coinsEarned: correct ? 2 : 0, correctAnswer: correct ? null : q.reveal, explanation: null, completed: session.status === 'COMPLETED' })
  }
  if (action === 'complete') {
    return json({ sessionId: 'harness', score: session.correct * 1000, accuracyPct: Math.round((session.correct / total) * 100), correctCount: session.correct, incorrectCount: total - session.correct, totalQuestions: total, xpEarned: session.correct * 12, coinsEarned: session.correct * 2, bestStreak: session.correct, skillsPracticed: ['உயிரெழுத்துகள்'], newlyEarnedAchievementIds: [] })
  }
  if (action === 'abandon') return json({ ok: true })
  const q = session.status === 'ACTIVE' && session.currentIndex < total ? QUESTIONS[session.currentIndex] : null
  return json({
    status: session.status,
    engineId: params.get('engine') ?? 'balloon-pop',
    currentIndex: session.currentIndex,
    totalQuestions: total,
    remainingSeconds: q ? 30 : null,
    question: q ? { id: `q${session.currentIndex}`, questionType: q.type, prompt: q.prompt, payload: q.payload, mediaUrl: null, points: 10 } : null,
  })
}

const ENGINES: Record<string, ComponentType<{ sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }>> = {
  'balloon-pop': BalloonPopGame,
}
const Engine = ENGINES[params.get('engine') ?? 'balloon-pop']
const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<Engine sessionId="harness" onExit={() => location.reload()} onPlayAgain={() => location.reload()} onHome={() => location.reload()} />)
