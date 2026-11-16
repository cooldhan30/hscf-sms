import { splitLetters } from './graphemes'
import type { GameType } from './types'

// The rules of a GameRoom Classic live game, as plain functions so they
// can be checked without a database (scripts/verify-grc-live.ts).

export type LiveStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'race' | 'ended'

// A game nobody has touched for 3 hours is over.
export const LIVE_EXPIRY_MS = 3 * 60 * 60 * 1000
// Answers that leave the phone just as the timer hits zero still count.
export const ANSWER_GRACE_MS = 1500
// A player's game tab sends the account it joined with in this header; if
// the browser is now signed in as someone else, the server refuses with
// code WRONG_ACCOUNT (see lib/grClassic/server/liveAuth.ts).
export const PLAYER_HEADER = 'x-grc-player'
export const WRONG_ACCOUNT = 'WRONG_ACCOUNT'
// Auto-play on the teacher's screen: how long the answer, then the
// leaderboard, stay up before the game moves on by itself.
export const AUTO_REVEAL_MS = 5000
export const AUTO_LEADERBOARD_MS = 6000
// A player counts as "connected" if their phone checked in recently.
export const CONNECTED_MS = 15_000

// Every live game is a race: each student plays every question at their own
// pace (student feedback 2026-11-16: nobody should wait for the others).
// The older question-by-question steps (question / reveal / leaderboard)
// are kept so they can be brought back if wanted.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isRace(type: GameType): boolean {
  return true
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

// When the game should move on by itself from the step it is on (a time on
// the server's clock, possibly already past), or null = wait for the
// teacher. The server checks this on every poll -- the teacher's or any
// student's -- so once the teacher presses Start the game flows on its own,
// even if the teacher's tab is in the background.
//   question:    time is up, or every connected player has answered
//                (this happens even while auto-play is paused).
//   reveal:      the answer stays up AUTO_REVEAL_MS, then the leaderboard
//   leaderboard: stays up AUTO_LEADERBOARD_MS, then the next question
//   race:        AUTO_REVEAL_MS after the last player finishes, the winners
// `stepStartedAt` = when the current step began (or auto-play resumed).
export function autoMoveAt(
  s: { type: GameType; status: LiveStatus; autoPlay: boolean; stepStartedAt: number; questionEndsAt: number | null },
  info: { connected: number; answered: number; allFinishedAt: number | null }
): number | null {
  if (s.status === 'question') {
    if (info.connected > 0 && info.answered >= info.connected) return s.stepStartedAt
    return s.questionEndsAt
  }
  if (!s.autoPlay) return null
  if (s.status === 'reveal') return s.stepStartedAt + AUTO_REVEAL_MS
  if (s.status === 'leaderboard') return s.stepStartedAt + AUTO_LEADERBOARD_MS
  if (s.status === 'race' && info.allFinishedAt !== null) return Math.max(s.stepStartedAt, info.allFinishedAt) + AUTO_REVEAL_MS
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

// The class leaderboard as a student's phone sees it: names, scores and
// ranks (no ids), the points each player just won, and which row is them.
export interface BoardRow {
  rank: number
  nickname: string
  score: number
  gained: number
  me: boolean
}

export function playerBoard(standings: Standing[], meId: string, gained: Record<string, number> = {}): BoardRow[] {
  return standings.map((st) => ({ rank: st.rank, nickname: st.nickname, score: st.score, gained: gained[st.studentId] ?? 0, me: st.studentId === meId }))
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
  // Auto-play is on (the teacher can pause it), and when the game will move
  // on by itself from a reveal / leaderboard / finished race.
  autoPlay: boolean
  autoAt: string | null
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
  // Seconds a student gets for each Classic Quiz question.
  seconds: number
  question: import('./play').PlayQuestion | null
  questions: import('./play').PlayQuestion[] | null
  doneIds: string[]
  myAnswer: { choice: number | null; correct: boolean | null; points: number | null } | null
  correctIndex: number | null
  score: number
  rank: number | null
  podium: Standing[] | null
  // The whole class, after each question, during a race and at the end.
  leaderboard: BoardRow[] | null
}
