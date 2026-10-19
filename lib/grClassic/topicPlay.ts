import { shuffle } from './shuffle'
import { QUESTION_KIND_FOR_GAME, type GameType } from './types'

// "Play by topic": every topic in the shared question library is a ready
// game, and topics can be combined (the library stays modular). A teacher
// (live, or as an assignment) or a student (on their own) only picks the
// topics, the game type, how many questions and the time per question --
// the server then draws that many questions at random, evenly across the
// chosen topics.

// Questions with no topic are offered as one more "topic".
export const NO_TOPIC = 'none'
export const QUESTION_COUNTS = [5, 10, 15, 20] as const
export const SECONDS_PER_QUESTION = [10, 20, 30, 60] as const
export const MAX_QUESTIONS = 100
export const MAX_TOPICS = 10

export interface TopicSummary {
  id: string // a topic id, or NO_TOPIC
  name: string
  counts: Record<GameType, number>
}

export interface TopicPlay {
  topics: string[] // topic ids (or NO_TOPIC), 1..MAX_TOPICS, no repeats
  type: GameType
  count: number // 1..MAX_QUESTIONS; more than the topics have = all of them
  seconds: number // one of SECONDS_PER_QUESTION
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Accepts `topics` as a list or "id1,id2" (from a link), or a single `topic`.
export function parseTopicPlay(input: Record<string, unknown> | null | undefined): { ok: true; value: TopicPlay } | { ok: false; error: string } {
  const raw = input?.topics ?? input?.topic
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const topics = Array.from(new Set(list.map((t) => (typeof t === 'string' ? t.trim() : ''))))
  if (!topics.length || topics.some((t) => t !== NO_TOPIC && !UUID.test(t))) return { ok: false, error: 'Choose a topic.' }
  if (topics.length > MAX_TOPICS) return { ok: false, error: `Choose at most ${MAX_TOPICS} topics.` }
  const type = input?.type
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(QUESTION_KIND_FOR_GAME, type)) return { ok: false, error: 'Choose a game type.' }
  const count = Number(input?.count)
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) return { ok: false, error: `Choose between 1 and ${MAX_QUESTIONS} questions.` }
  const seconds = Number(input?.seconds)
  if (!(SECONDS_PER_QUESTION as readonly number[]).includes(seconds)) return { ok: false, error: 'Choose the time per question.' }
  return { ok: true, value: { topics, type: type as GameType, count, seconds } }
}

// The game types a topic can be played as (it has questions of that kind).
export function typesFor(t: TopicSummary): GameType[] {
  return (Object.keys(t.counts) as GameType[]).filter((g) => t.counts[g] > 0)
}

// Several topics together: their question counts added up.
export function combineTopics(chosen: TopicSummary[]): TopicSummary | null {
  if (!chosen.length) return null
  const counts: Record<GameType, number> = { quiz: 0, match: 0, 'word-builder': 0 }
  for (const t of chosen) for (const g of Object.keys(counts) as GameType[]) counts[g] += t.counts[g]
  return { id: chosen.map((t) => t.id).join(','), name: topicsTitle(chosen.map((t) => t.name)), counts }
}

// "உயிர் + திணை" -- the game's title (at most 120 characters).
export function topicsTitle(names: string[]): string {
  const title = names.join(' + ')
  return title.length <= 120 ? title : `${title.slice(0, 117)}…`
}

// Up to n items taken evenly from each group (in random order within a
// group): a big topic can't crowd out a small one, and when a group runs
// out the others fill the gap. The result is shuffled.
export function pickEvenly<T>(groups: T[][], n: number, mix: <U>(items: U[]) => U[] = shuffle): T[] {
  const queues = groups.map((g) => mix(g))
  const out: T[] = []
  for (let round = 0; out.length < n && queues.some((q) => round < q.length); round++) {
    for (const q of mix(queues)) if (round < q.length && out.length < n) out.push(q[round])
  }
  return mix(out)
}

// ---- Play Offline scores per topic ----

// One finished question, as the student's browser reports it (practice
// only -- never a grade).
export interface PlayedQuestion {
  questionId: string
  correct: number // units right first time
  total: number // units in the question (1, or the pairs of a match board)
}

export interface TopicTally {
  topic: string // a topic id, or NO_TOPIC
  answered: number
  correct: number
  percent: number
}

// A finished game added up per topic: each question counts towards its
// own topic (a game can combine topics). topicOf: question id -> topic
// id or null; questions it doesn't know are left out.
export function tallyByTopic(played: PlayedQuestion[], topicOf: Map<string, string | null>): TopicTally[] {
  const by = new Map<string, { answered: number; correct: number }>()
  for (const p of played) {
    if (!topicOf.has(p.questionId)) continue
    const key = topicOf.get(p.questionId) ?? NO_TOPIC
    const t = by.get(key) ?? { answered: 0, correct: 0 }
    t.answered += p.total
    t.correct += Math.min(p.correct, p.total)
    by.set(key, t)
  }
  return Array.from(by, ([topic, t]) => ({ topic, ...t, percent: t.answered ? Math.round((100 * t.correct) / t.answered) : 0 }))
}

// One topic on the student's dashboard (sms_grc_topic_progress).
export interface TopicScore {
  topic: string // a topic id, or NO_TOPIC
  name: string
  plays: number
  answered: number
  correct: number
  bestPercent: number
  lastPercent: number
  lastPlayedAt: string
}

// What the student's browser may send when a game ends.
export function parsePlayed(input: unknown): PlayedQuestion[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_QUESTIONS) return null
  const out: PlayedQuestion[] = []
  for (const r of input) {
    const q = r as Record<string, unknown>
    if (typeof q?.questionId !== 'string' || !UUID.test(q.questionId)) return null
    const total = Number(q.total)
    const correct = Number(q.correct)
    if (!Number.isInteger(total) || total < 1 || total > 20 || !Number.isInteger(correct) || correct < 0 || correct > total) return null
    out.push({ questionId: q.questionId, correct, total })
  }
  return out
}
