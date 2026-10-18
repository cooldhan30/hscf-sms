import { QUESTION_KIND_FOR_GAME, type GameType } from './types'

// "Play by topic": every topic in the shared question library is a ready
// game. A teacher (live, for a class) or a student (on their own) only
// picks the topic, the game type, how many questions and the time per
// question -- the server then draws that many questions at random.

// Questions with no topic are offered as one more "topic".
export const NO_TOPIC = 'none'
export const QUESTION_COUNTS = [5, 10, 15, 20] as const
export const SECONDS_PER_QUESTION = [10, 20, 30, 60] as const
export const MAX_QUESTIONS = 100

export interface TopicSummary {
  id: string // a topic id, or NO_TOPIC
  name: string
  counts: Record<GameType, number>
}

export interface TopicPlay {
  topic: string // a topic id, or NO_TOPIC
  type: GameType
  count: number // 1..MAX_QUESTIONS; more than the topic has = all of them
  seconds: number // one of SECONDS_PER_QUESTION
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseTopicPlay(input: Record<string, unknown> | null | undefined): { ok: true; value: TopicPlay } | { ok: false; error: string } {
  const topic = typeof input?.topic === 'string' ? input.topic : ''
  if (topic !== NO_TOPIC && !UUID.test(topic)) return { ok: false, error: 'Choose a topic.' }
  const type = input?.type
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(QUESTION_KIND_FOR_GAME, type)) return { ok: false, error: 'Choose a game type.' }
  const count = Number(input?.count)
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) return { ok: false, error: `Choose between 1 and ${MAX_QUESTIONS} questions.` }
  const seconds = Number(input?.seconds)
  if (!(SECONDS_PER_QUESTION as readonly number[]).includes(seconds)) return { ok: false, error: 'Choose the time per question.' }
  return { ok: true, value: { topic, type: type as GameType, count, seconds } }
}

// The game types a topic can be played as (it has questions of that kind).
export function typesFor(t: TopicSummary): GameType[] {
  return (Object.keys(t.counts) as GameType[]).filter((g) => t.counts[g] > 0)
}
