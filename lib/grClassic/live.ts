import { splitLetters } from './graphemes'
import type { GameType } from './types'

// The rules of a GameRoom Classic live game, as plain functions so they
// can be checked without a database (scripts/verify-grc-live.ts).

export type LiveStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'race' | 'ended'

// A game nobody has touched for 3 hours is over.
export const LIVE_EXPIRY_MS = 3 * 60 * 60 * 1000
// Answers that leave the phone just as the timer hits zero still count.
export const ANSWER_GRACE_MS = 1500
// A player counts as "connected" if their phone checked in recently.
export const CONNECTED_MS = 15_000

// Classic Quiz is played question by question; Match the Pairs and Word
// Builder are a race where everyone plays every question at their own pace.
export function isRace(type: GameType): boolean {
  return type !== 'quiz'
}

// What the teacher's "Next" button does from each step.
export function nextStep(type: GameType, status: LiveStatus, index: number, count: number): { status: LiveStatus; index: number } | null {
  if (isRace(type)) {
    if (status === 'lobby') return { status: 'race', index: 0 }
    if (status === 'race') return { status: 'ended', index }
    return null
  }
  if (status === 'lobby') return { status: 'question', index: 0 }
  if (status === 'question') return { status: 'reveal', index }
  if (status === 'reveal') return { status: 'leaderboard', index }
  if (status === 'leaderboard') return index + 1 < count ? { status: 'question', index: index + 1 } : { status: 'ended', index }
  return null
}

export function isExpired(updatedAt: string, now = Date.now()): boolean {
  return now - new Date(updatedAt).getTime() > LIVE_EXPIRY_MS
}

export function makePin(rand: () => number = Math.random): string {
  return String(100000 + Math.floor(rand() * 900000))
}

export function normalizePin(input: unknown): string {
  return typeof input === 'string' ? input.replace(/\D/g, '').slice(0, 6) : ''
}

// Players appear under their first name. Two players with the same first
// name get their last initial added, then a number if still the same.
export function nicknameFor(first: string, last: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLocaleLowerCase()))
  const base = (first || 'Player').trim().slice(0, 30)
  if (!used.has(base.toLocaleLowerCase())) return base
  // Whole first letter, so a Tamil initial keeps its vowel sign (மு, not ம).
  const first1 = splitLetters(last)[0]
  const initial = first1 ? `${base} ${first1.toLocaleUpperCase()}.` : base
  if (!used.has(initial.toLocaleLowerCase())) return initial
  for (let n = 2; ; n++) if (!used.has(`${initial} ${n}`.toLocaleLowerCase())) return `${initial} ${n}`
}

// May an answer be accepted right now?
export function canAnswerLive(s: { status: LiveStatus; question_ends_at: string | null }, isRaceGame: boolean, now = Date.now()): boolean {
  if (isRaceGame) return s.status === 'race'
  return s.status === 'question' && !!s.question_ends_at && now <= new Date(s.question_ends_at).getTime() + ANSWER_GRACE_MS
}

// Race games: 100 points per thing right first time, plus a bonus for
// finishing early (500 for first, then 100 less for each place).
export const RACE_POINTS_PER_UNIT = 100
export function raceBonus(finishPlace: number): number {
  return Math.max(0, 500 - 100 * finishPlace)
}

export interface Standing {
  studentId: string
  nickname: string
  score: number
  rank: number
}

// Highest score first; equal scores share a rank (1, 1, 3).
export function rankPlayers(players: { student_id: string; nickname: string; finished_at: string | null }[], answers: { student_id: string; points: number }[], race: boolean): Standing[] {
  const points = new Map<string, number>()
  for (const a of answers) points.set(a.student_id, (points.get(a.student_id) ?? 0) + a.points)
  if (race) {
    const finishers = players.filter((p) => p.finished_at).sort((x, y) => new Date(x.finished_at!).getTime() - new Date(y.finished_at!).getTime())
    finishers.forEach((p, i) => points.set(p.student_id, (points.get(p.student_id) ?? 0) + raceBonus(i)))
  }
  const sorted = players.map((p) => ({ studentId: p.student_id, nickname: p.nickname, score: points.get(p.student_id) ?? 0 })).sort((x, y) => y.score - x.score || x.nickname.localeCompare(y.nickname))
  let rank = 0
  return sorted.map((p, i) => {
    if (i === 0 || sorted[i - 1].score !== p.score) rank = i + 1
    return { ...p, rank }
  })
}

// ---- What the server sends ----

// To the hosting teacher (projector). Includes the current question WITH
// its answer, so it is only ever sent to the teacher who owns the game.
export interface HostState {
  id: string
  title: string
  type: GameType
  pin: string
  className: string
  status: LiveStatus
  index: number
  count: number
  liveSeconds: number
  serverNow: string
  endsAt: string | null
  players: { studentId: string; nickname: string; connected: boolean }[]
  question: import('./types').Question | null
  answered: number
  distribution: number[] | null
  standings: Standing[]
  gained: Record<string, number>
  race: { studentId: string; nickname: string; done: number; score: number; finished: boolean }[] | null
}

// To one student's phone. Never contains answer keys; the right option
// is only included once the teacher has revealed it.
export interface PlayerState {
  title: string
  type: GameType
  status: LiveStatus
  index: number
  count: number
  serverNow: string
  endsAt: string | null
  nickname: string
  playersCount: number
  question: import('./play').PlayQuestion | null
  questions: import('./play').PlayQuestion[] | null
  doneIds: string[]
  myAnswer: { choice: number | null; correct: boolean | null; points: number | null } | null
  correctIndex: number | null
  score: number
  rank: number | null
  podium: Standing[] | null
}
