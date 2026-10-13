import { joinTiles, normalizeTamil } from './graphemes'
import type { ChoiceQuestion, MatchQuestion, OrderQuestion, QuestionResult } from './types'

// Academic grading for GameRoom Classic. Grades measure accuracy only:
//   Classic Quiz  -- 1 unit per question, correct option chosen
//   Match         -- 1 unit per pair, matched right on the first try
//   Word Builder  -- 1 unit per word/sentence, right on the first check
// grade = correct units / total units, as a whole-number percent.
// Live "points" (speed bonus) are entertainment only -- see livePoints().

export function gradeChoice(q: ChoiceQuestion, chosen: number): QuestionResult {
  const ok = chosen === q.answerIndex
  return { questionId: q.id, prompt: q.prompt, correctUnits: ok ? 1 : 0, totalUnits: 1, given: q.options[chosen] ?? '', expected: q.options[q.answerIndex] }
}

// firstPicks[leftIndex] = the right-hand item the student first paired it with.
export function gradeMatch(q: MatchQuestion, firstPicks: Record<number, string>): QuestionResult {
  const correct = q.pairs.filter((p, i) => firstPicks[i] === p.right).length
  const misses = q.pairs.flatMap((p, i) => (firstPicks[i] === p.right ? [] : [`${p.left} → ${firstPicks[i] ?? '—'}`]))
  return {
    questionId: q.id,
    prompt: q.prompt,
    correctUnits: correct,
    totalUnits: q.pairs.length,
    given: misses.length ? misses.join(', ') : 'All pairs right',
    expected: q.pairs.map((p) => `${p.left} → ${p.right}`).join(', '),
  }
}

export function isOrderCorrect(q: OrderQuestion, tiles: string[]): boolean {
  return normalizeTamil(joinTiles(tiles, q.unit)) === normalizeTamil(q.answer)
}

export function gradeOrder(q: OrderQuestion, firstTry: string[]): QuestionResult {
  const ok = isOrderCorrect(q, firstTry)
  return { questionId: q.id, prompt: q.prompt, correctUnits: ok ? 1 : 0, totalUnits: 1, given: joinTiles(firstTry, q.unit), expected: normalizeTamil(q.answer) }
}

export function totals(results: QuestionResult[]): { correct: number; total: number; percent: number } {
  const correct = results.reduce((n, r) => n + r.correctUnits, 0)
  const total = results.reduce((n, r) => n + r.totalUnits, 0)
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) }
}

// Live play only: 500 for a right answer plus up to 500 for speed.
export function livePoints(correct: boolean, msTaken: number, limitMs: number): number {
  if (!correct) return 0
  const left = Math.max(0, Math.min(1, 1 - msTaken / limitMs))
  return Math.round(500 + 500 * left)
}

export function starsFor(percent: number): number {
  if (percent >= 90) return 3
  if (percent >= 70) return 2
  if (percent >= 40) return 1
  return 0
}

export function encouragement(percent: number): { ta: string; en: string } {
  if (percent >= 90) return { ta: 'அருமை!', en: 'Excellent work!' }
  if (percent >= 70) return { ta: 'மிக நன்று!', en: 'Great job!' }
  if (percent >= 40) return { ta: 'நல்ல முயற்சி!', en: 'Good try — keep going!' }
  return { ta: 'மீண்டும் முயல்வோம்!', en: "Let's practise and try again!" }
}
