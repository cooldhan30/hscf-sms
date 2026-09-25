import { stableIndex } from './ids'
import type { BuiltinQuestion } from './types'

// Small authoring helpers for built-in content. Each one produces a
// payload in exactly the shape lib/gameRoomV2/domain/questionTypes.ts
// defines (and validateQuestionPayload() enforces -- see
// scripts/verify-gameroom-v2-builtin-content.ts).

// Multiple choice. The correct answer is placed at a deterministic,
// content-derived index so it is not always the first option.
export function mc(prompt: string, correct: string, distractors: string[], explanation?: string): BuiltinQuestion {
  const others = distractors.filter((d) => d !== correct)
  const at = stableIndex(`${prompt}|${correct}`, others.length + 1)
  const options = [...others.slice(0, at), correct, ...others.slice(at)]
  return { questionType: 'MULTIPLE_CHOICE', prompt, payload: { options, correctAnswer: correct }, explanation }
}

export function match(prompt: string, pairs: [string, string][], explanation?: string): BuiltinQuestion {
  return { questionType: 'MATCH', prompt, payload: { pairs: pairs.map(([left, right]) => ({ left, right })) }, explanation }
}

// Categorize: `groups` maps each category to its items, in display order.
export function sort(prompt: string, groups: Record<string, string[]>, explanation?: string): BuiltinQuestion {
  const categories = Object.keys(groups)
  const answerKey: Record<string, string> = {}
  const byCategory = categories.map((c) => groups[c])
  // Interleave categories so items don't arrive grouped by answer.
  const items: string[] = []
  const longest = Math.max(...byCategory.map((g) => g.length))
  for (let i = 0; i < longest; i++) {
    categories.forEach((c, ci) => {
      const item = byCategory[ci][i]
      if (item !== undefined) {
        items.push(item)
        answerKey[item] = c
      }
    })
  }
  return { questionType: 'CATEGORIZE', prompt, payload: { items, categories, answerKey }, explanation }
}

// A fixed, non-identity scramble of the correct order (rotate by a
// content-derived offset; for 2 items, a swap).
function scramble(correct: string[]): string[] {
  const n = correct.length
  const offset = 1 + stableIndex(correct.join('|'), n - 1)
  const rotated = [...correct.slice(offset), ...correct.slice(0, offset)]
  return rotated
}

export function orderLetters(prompt: string, correctOrder: string[], explanation?: string): BuiltinQuestion {
  return { questionType: 'ORDER_LETTERS', prompt, payload: { letters: scramble(correctOrder), correctOrder }, explanation }
}

export function orderWords(prompt: string, correctOrder: string[], explanation?: string): BuiltinQuestion {
  return { questionType: 'ORDER_WORDS', prompt, payload: { words: scramble(correctOrder), correctOrder }, explanation }
}

// Vocabulary helpers ------------------------------------------------------

export interface VocabWord {
  ta: string
  en: string
}

// Picks `count` distractors for words[index] from the same list,
// deterministically (rotating through the list).
function pickDistractors(words: VocabWord[], index: number, count: number, field: 'ta' | 'en'): string[] {
  const out: string[] = []
  for (let step = 1; out.length < count && step < words.length; step++) {
    const candidate = words[(index + step * 3) % words.length][field]
    if (candidate !== words[index][field] && !out.includes(candidate)) out.push(candidate)
  }
  for (let step = 1; out.length < count && step < words.length; step++) {
    const candidate = words[(index + step) % words.length][field]
    if (candidate !== words[index][field] && !out.includes(candidate)) out.push(candidate)
  }
  return out
}

// Alternates direction: Tamil -> English meaning, then English -> Tamil word.
export function vocabQuiz(words: VocabWord[]): BuiltinQuestion[] {
  return words.map((w, i) =>
    i % 2 === 0
      ? mc(`"${w.ta}" என்பதன் பொருள் என்ன? (What does "${w.ta}" mean?)`, w.en, pickDistractors(words, i, 3, 'en'))
      : mc(`"${w.en}" -- தமிழில் எப்படிச் சொல்வது? (Which Tamil word means "${w.en}"?)`, w.ta, pickDistractors(words, i, 3, 'ta'))
  )
}

// Tamil <-> English matching rounds of `perRound` pairs.
export function vocabMatch(words: VocabWord[], perRound = 4): BuiltinQuestion[] {
  const rounds: BuiltinQuestion[] = []
  for (let i = 0; i + perRound <= words.length; i += perRound) {
    const slice = words.slice(i, i + perRound)
    rounds.push(match('தமிழ்ச் சொல்லை அதன் பொருளுடன் பொருத்துக (Match each Tamil word to its meaning)', slice.map((w) => [w.ta, w.en])))
  }
  return rounds
}
