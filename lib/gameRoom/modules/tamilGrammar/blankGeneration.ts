import type { RawWord, TamilGrammarCategory } from './wordBank'

// The three grammar rules this game teaches -- each category consonant
// must be immediately followed by a grapheme cluster starting with its
// paired series letter. A word merely CONTAINING ண்/ந்/ன் isn't enough
// (e.g. எண்ணம் contains ண் but the next letter is ண, not ட -- not a
// டண்ணகரம் example); the adjacency check below enforces this exactly.
const SERIES_MAP: Record<TamilGrammarCategory, string> = {
  'ண்': 'ட',
  'ந்': 'த',
  'ன்': 'ற',
}

// Split on real Tamil letters (grapheme clusters: a consonant plus its
// vowel sign, or a bare consonant+virama), not raw JS chars -- confirmed
// necessary by direct testing elsewhere in this codebase (see
// lib/tamilVocabEmoji.ts's blankOutOneLetter, which fixed the exact same
// class of bug for Worksheet Generator content: a naive per-character
// split produces nonsense for Tamil script).
const GRAPHEME_SEGMENTER = new Intl.Segmenter('ta', { granularity: 'grapheme' })

function graphemeClusters(word: string): string[] {
  return Array.from(GRAPHEME_SEGMENTER.segment(word), (s) => s.segment)
}

export class WordValidationError extends Error {
  constructor(public wordId: string, reason: string) {
    super(`[${wordId}] ${reason}`)
    this.name = 'WordValidationError'
  }
}

export interface BuiltQuestion {
  id: string
  category: TamilGrammarCategory
  word: string
  blankedWord: string
  correctAnswer: TamilGrammarCategory
  explanation: string
}

// Deterministic, code-only blanking -- there is no LLM in this path (the
// whole word bank is hand-supplied), but if there were, the earlier
// Worksheet Generator incident (an LLM asked to blank+reconstruct a
// Tamil word itself produced garbage) is exactly why this stays
// deterministic. Finds the FIRST grapheme cluster matching the word's
// category consonant that is immediately followed by a cluster starting
// with the correct paired series letter -- some words contain the same
// consonant again later as an unrelated grammatical suffix (e.g.
// என்றான் has ன் at both the rule-relevant position and as a common
// verb-ending), so "first occurrence" alone isn't sufficient; the
// adjacency check disambiguates correctly in every one of the 180 words
// (verified directly against the full bank before writing this).
export function buildQuestion(raw: RawWord): BuiltQuestion {
  const clusters = graphemeClusters(raw.word)
  const expectedNextStart = SERIES_MAP[raw.category]

  const targetIndex = clusters.findIndex(
    (cluster, i) => cluster === raw.category && (clusters[i + 1] ?? '').startsWith(expectedNextStart)
  )

  if (targetIndex === -1) {
    throw new WordValidationError(
      raw.id,
      `could not find "${raw.category}" followed by a "${expectedNextStart}"-series letter in "${raw.word}"`
    )
  }

  const blankedWord = clusters.map((c, i) => (i === targetIndex ? '___' : c)).join('')
  const reconstructed = clusters.map((c, i) => (i === targetIndex ? raw.category : c)).join('')

  if (reconstructed !== raw.word) {
    throw new WordValidationError(raw.id, `reconstruction mismatch: got "${reconstructed}", expected "${raw.word}"`)
  }

  return {
    id: raw.id,
    category: raw.category,
    word: raw.word,
    blankedWord,
    correctAnswer: raw.category,
    explanation: `${raw.category} + ${expectedNextStart} வரிசை`,
  }
}
