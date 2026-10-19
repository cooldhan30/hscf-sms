import type { Question } from './types'

// No game -- live, assignment or practice -- ever asks the same question
// twice. Two questions count as the same when a student would see them as
// the same question, even if they are separate rows in the library:
//   Classic Quiz     same wording and the same right answer (the wrong
//                    options or their order may differ)
//   Match the Pairs  the same pairs, in any order
//   Word Builder     the same word or sentence to build
// Questions that only share a sentence stem ("which of these is a noun?")
// but ask about different words are different questions.

const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()

export function sameQuestionKey(q: Question): string {
  if (q.kind === 'choice') return `choice|${norm(q.prompt)}|${norm(q.options[q.answerIndex] ?? '')}`
  if (q.kind === 'match') return `match|${q.pairs.map((p) => `${norm(p.left)}=${norm(p.right)}`).sort().join('|')}`
  return `order|${q.unit}|${norm(q.answer)}`
}

// The list with repeats left out (the first of each is kept, in order).
export function withoutRepeats<T extends Question>(questions: T[]): T[] {
  const seen = new Set<string>()
  return questions.filter((q) => {
    const k = sameQuestionKey(q)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// The questions that repeat an earlier one in the list.
export function repeatsIn<T extends Question>(questions: T[]): T[] {
  const seen = new Set<string>()
  return questions.filter((q) => {
    const k = sameQuestionKey(q)
    if (seen.has(k)) return true
    seen.add(k)
    return false
  })
}
