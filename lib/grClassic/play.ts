import { tilesFor, joinTiles, normalizeTamil } from './graphemes'
import { isOrderCorrect } from './scoring'
import { shuffle, shuffleAwayFrom } from './shuffle'
import type { Question } from './types'

// The shared play contract for every GameRoom Classic mode (teacher
// preview, practice, assignment, live). A device that plays a game only
// ever receives a PlayQuestion -- no answer keys. Every answer, match tap
// and hint goes back to whoever holds the real question (the server, or
// the teacher's own preview) through checkResponse() / hintFor(), which
// decide what may be revealed.

export type PlayQuestion =
  | { id: string; kind: 'choice'; prompt: string; promptEn?: string; options: string[] }
  | { id: string; kind: 'match'; prompt: string; promptEn?: string; lefts: string[]; rights: string[] }
  | { id: string; kind: 'order'; prompt: string; promptEn?: string; unit: 'letters' | 'words'; tiles: string[] }

export type PlayResponse =
  | { kind: 'choice'; choice: number }
  | { kind: 'match'; left: number; right: string } // one pairing attempt
  | { kind: 'order'; tiles: string[] }

export interface CheckResult {
  correct: boolean
  // Only filled in when the mode allows revealing answers:
  correctIndex?: number // choice
  expected?: string // human-readable right answer
  explanation?: string
}

export type Hint = { removeOption: number } | { pair: { left: number; right: string } } | { firstTile: string; text?: string } | { none: true }

// Strip the answer key. Match partners and word tiles are shuffled so their
// order gives nothing away; quiz options keep the teacher's order.
export function toPlayQuestion(q: Question): PlayQuestion {
  const base = { id: q.id, prompt: q.prompt, ...(q.promptEn ? { promptEn: q.promptEn } : {}) }
  if (q.kind === 'choice') return { ...base, kind: 'choice', options: q.options.slice() }
  if (q.kind === 'match') return { ...base, kind: 'match', lefts: q.pairs.map((p) => p.left), rights: shuffleAwayFrom(q.pairs.map((p) => p.right)) }
  return { ...base, kind: 'order', unit: q.unit, tiles: shuffleAwayFrom(tilesFor(q)) }
}

export function expectedText(q: Question): string {
  if (q.kind === 'choice') return q.options[q.answerIndex] ?? ''
  if (q.kind === 'match') return q.pairs.map((p) => `${p.left} → ${p.right}`).join(', ')
  return normalizeTamil(q.answer)
}

// Is this response right? `reveal` = may the player be told the answer.
// A response that doesn't fit the question (wrong kind, bad index, tiles
// that aren't this question's tiles) is simply wrong.
export function checkResponse(q: Question, r: PlayResponse, reveal: boolean): CheckResult {
  let correct = false
  if (q.kind === 'choice' && r.kind === 'choice') correct = Number.isInteger(r.choice) && r.choice === q.answerIndex
  else if (q.kind === 'match' && r.kind === 'match') correct = Number.isInteger(r.left) && q.pairs[r.left]?.right === r.right
  else if (q.kind === 'order' && r.kind === 'order') correct = Array.isArray(r.tiles) && r.tiles.every((t) => typeof t === 'string') && isOrderCorrect(q, r.tiles)
  if (!reveal) return { correct }
  // Matching reveals pair by pair as the player taps; no answer list.
  if (q.kind === 'match') return { correct }
  return {
    correct,
    expected: expectedText(q),
    ...(q.kind === 'choice' ? { correctIndex: q.answerIndex, ...(q.explanation ? { explanation: q.explanation } : {}) } : {}),
  }
}

// Practice hints. `matched` = left indexes already matched (match only).
export function hintFor(q: Question, matched: number[] = []): Hint {
  if (q.kind === 'choice') {
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answerIndex)
    return wrong.length > 1 ? { removeOption: shuffle(wrong)[0] } : { none: true }
  }
  if (q.kind === 'match') {
    const left = q.pairs.findIndex((_, i) => !matched.includes(i))
    return left === -1 ? { none: true } : { pair: { left, right: q.pairs[left].right } }
  }
  return { firstTile: tilesFor(q)[0], ...(q.hint ? { text: q.hint } : {}) }
}

// Readable form of a response, for results lists.
export function describeResponse(p: PlayQuestion, r: PlayResponse): string {
  if (p.kind === 'choice' && r.kind === 'choice') return p.options[r.choice] ?? ''
  if (p.kind === 'match' && r.kind === 'match') return `${p.lefts[r.left] ?? ''} → ${r.right}`
  if (p.kind === 'order' && r.kind === 'order') return joinTiles(r.tiles, p.unit)
  return ''
}

export function isPlayResponse(v: unknown): v is PlayResponse {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  if (r.kind === 'choice') return typeof r.choice === 'number'
  if (r.kind === 'match') return typeof r.left === 'number' && typeof r.right === 'string'
  if (r.kind === 'order') return Array.isArray(r.tiles) && r.tiles.length <= 40 && r.tiles.every((t) => typeof t === 'string' && t.length <= 200)
  return false
}

// How a PlaySession checks answers. The teacher preview and the sample
// screens use a local session (answers in memory); students use a server
// session (lib/grClassic answers stay on the server).
export interface PlaySession {
  check(questionId: string, response: PlayResponse): Promise<CheckResult>
  hint(questionId: string, matched?: number[]): Promise<Hint>
}

export function localSession(questions: Question[], reveal: boolean): PlaySession {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return {
    async check(id, response) {
      const q = byId.get(id)
      return q ? checkResponse(q, response, reveal) : { correct: false }
    },
    async hint(id, matched) {
      const q = byId.get(id)
      return q ? hintFor(q, matched) : { none: true }
    },
  }
}
