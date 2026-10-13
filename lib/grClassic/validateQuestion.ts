import { splitLetters, splitWords } from './graphemes'
import type { Difficulty, QuestionKind } from './types'

// One place that decides what a valid GameRoom Classic question is. Used
// by the API (the real check), and by the browser for instant feedback
// and the CSV import preview. All text is NFC-normalised and trimmed, so
// Tamil typed on different keyboards is stored the same way.

export const LIMITS = {
  prompt: 500,
  option: 120,
  explanation: 1000,
  pairSide: 80,
  answer: 200,
  hint: 200,
  minOptions: 2,
  maxOptions: 4,
  minPairs: 2,
  maxPairs: 6,
  maxLetters: 20,
  maxWords: 12,
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export const DEFAULT_ORDER_PROMPT = { letters: 'எழுத்துக்களை அடுக்கிச் சொல்லை அமை', words: 'சொற்களை அடுக்கி வாக்கியம் அமை' }
export const DEFAULT_MATCH_PROMPT = 'பொருத்துக'

// Loose shape accepted from forms, CSV rows and API bodies.
export interface QuestionInput {
  kind?: unknown
  categoryId?: unknown
  prompt?: unknown
  promptEn?: unknown
  explanation?: unknown
  difficulty?: unknown
  options?: unknown
  answerIndex?: unknown
  pairs?: unknown
  unit?: unknown
  answer?: unknown
  hint?: unknown
}

export type QuestionPayload =
  | { options: string[]; answerIndex: number }
  | { pairs: { left: string; right: string }[] }
  | { unit: 'letters' | 'words'; answer: string; hint?: string }

export interface ValidQuestion {
  kind: QuestionKind
  categoryId: string | null
  prompt: string
  promptEn: string | null
  explanation: string | null
  difficulty: Difficulty
  payload: QuestionPayload
  // Normalised fingerprint for duplicate detection (hashed before storing).
  contentKey: string
}

export function clean(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

const keyText = (s: string) => s.toLocaleLowerCase()

export function validateQuestion(input: QuestionInput): { ok: true; value: ValidQuestion } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const kind = input.kind
  if (kind !== 'choice' && kind !== 'match' && kind !== 'order') return { ok: false, errors: ['Question type must be quiz, matching or word builder.'] }

  const promptEn = clean(input.promptEn) || null
  const explanation = clean(input.explanation) || null
  const difficulty = DIFFICULTIES.includes(input.difficulty as Difficulty) ? (input.difficulty as Difficulty) : 'easy'
  const categoryId = input.categoryId === null || input.categoryId === undefined || input.categoryId === '' ? null : isUuid(input.categoryId) ? input.categoryId : (errors.push('Topic is not valid.'), null)
  if (promptEn && promptEn.length > LIMITS.prompt) errors.push(`English text can be at most ${LIMITS.prompt} characters.`)
  if (explanation && explanation.length > LIMITS.explanation) errors.push(`Explanation can be at most ${LIMITS.explanation} characters.`)

  let prompt = clean(input.prompt)
  let payload: QuestionPayload
  let key: string

  if (kind === 'choice') {
    if (!prompt) errors.push('Write the question.')
    const options = Array.isArray(input.options) ? input.options.map(clean) : []
    const kept = options.filter(Boolean)
    const answerIndex = typeof input.answerIndex === 'number' ? input.answerIndex : Number(input.answerIndex)
    if (kept.length < LIMITS.minOptions) errors.push('Give at least two answers.')
    if (kept.length > LIMITS.maxOptions) errors.push('Give at most four answers.')
    if (kept.some((o) => o.length > LIMITS.option)) errors.push(`Each answer can be at most ${LIMITS.option} characters.`)
    if (new Set(kept.map(keyText)).size !== kept.length) errors.push('Two answers are the same.')
    const correct = Number.isInteger(answerIndex) ? options[answerIndex] : undefined
    if (!correct) errors.push('Mark which answer is right.')
    payload = { options: kept, answerIndex: correct ? kept.indexOf(correct) : 0 }
    key = `choice|${keyText(prompt)}|${kept.map(keyText).sort().join('¦')}|${keyText(correct ?? '')}`
  } else if (kind === 'match') {
    prompt = prompt || DEFAULT_MATCH_PROMPT
    const raw = Array.isArray(input.pairs) ? input.pairs : []
    const pairs = raw
      .map((p) => ({ left: clean((p as { left?: unknown })?.left), right: clean((p as { right?: unknown })?.right) }))
      .filter((p) => p.left || p.right)
    if (pairs.some((p) => !p.left || !p.right)) errors.push('Every pair needs both sides filled in.')
    if (pairs.length < LIMITS.minPairs) errors.push('Give at least two pairs.')
    if (pairs.length > LIMITS.maxPairs) errors.push('Give at most six pairs.')
    if (pairs.some((p) => p.left.length > LIMITS.pairSide || p.right.length > LIMITS.pairSide)) errors.push(`Each item can be at most ${LIMITS.pairSide} characters.`)
    if (new Set(pairs.map((p) => keyText(p.left))).size !== pairs.length) errors.push('Two items on the left are the same.')
    if (new Set(pairs.map((p) => keyText(p.right))).size !== pairs.length) errors.push('Two partners on the right are the same.')
    payload = { pairs }
    key = `match|${pairs.map((p) => `${keyText(p.left)}=${keyText(p.right)}`).sort().join('¦')}`
  } else {
    const answer = clean(input.answer)
    const unit: 'letters' | 'words' = input.unit === 'letters' || input.unit === 'words' ? input.unit : answer.includes(' ') ? 'words' : 'letters'
    const hint = clean(input.hint) || undefined
    if (!answer) errors.push('Type the word or sentence.')
    else {
      const tiles = unit === 'letters' ? splitLetters(answer) : splitWords(answer)
      if (tiles.length < 2) errors.push(unit === 'letters' ? 'The word needs at least two letters.' : 'The sentence needs at least two words.')
      if (unit === 'letters' && tiles.length > LIMITS.maxLetters) errors.push(`A word can have at most ${LIMITS.maxLetters} letters.`)
      if (unit === 'words' && tiles.length > LIMITS.maxWords) errors.push(`A sentence can have at most ${LIMITS.maxWords} words.`)
    }
    if (answer.length > LIMITS.answer) errors.push(`The answer can be at most ${LIMITS.answer} characters.`)
    if (hint && hint.length > LIMITS.hint) errors.push(`The hint can be at most ${LIMITS.hint} characters.`)
    prompt = prompt || DEFAULT_ORDER_PROMPT[unit]
    payload = hint ? { unit, answer, hint } : { unit, answer }
    key = `order|${unit}|${keyText(unit === 'letters' ? answer.replace(/ /g, '') : answer)}`
  }
  if (prompt.length > LIMITS.prompt) errors.push(`The question can be at most ${LIMITS.prompt} characters.`)

  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { kind, categoryId, prompt, promptEn, explanation, difficulty, payload, contentKey: key } }
}
