import { graphemeClusters } from '../mayangoli/graphemes'

// The 5 grammar concepts this game teaches -- திணை (animacy class),
// பால் (gender/class agreement), எண் (number), இடம் (grammatical
// person), காலம் (tense). Each is its own category with its own fixed
// option set (workbook-supplied, never invented client-side per the
// spec's explicit rule) and its own option COUNT (2/3/5) -- unlike
// Mayangoli/tamilGrammar (Ina Ezhuthukkal), which both use a single
// fixed option set for their one category concept.
export type GrammarCategory = 'thinai' | 'paal' | 'enn' | 'idam' | 'kaalam'

export const GRAMMAR_CATEGORIES: { id: GrammarCategory; label: string }[] = [
  { id: 'thinai', label: 'திணை' },
  { id: 'paal', label: 'பால்' },
  { id: 'enn', label: 'எண்' },
  { id: 'idam', label: 'இடம்' },
  { id: 'kaalam', label: 'காலம்' },
]

const CATEGORY_IDS = new Set(GRAMMAR_CATEGORIES.map((c) => c.id))

export type GrammarDifficulty = 'easy' | 'medium' | 'hard'

// The workbook's own review vocabulary (README: "review_status =
// teacher_review. ஆசிரியர் சரிபார்த்த பின் approved ஆக மாற்றவும்") --
// deliberately NOT Mayangoli's generated/reviewed/approved labels,
// since this data didn't come from that pipeline: every entry was
// already teacher-authored/reviewed at import time, just not yet
// through the final sign-off step the README describes.
export type GrammarReviewStatus = 'teacher_review' | 'approved'

export interface RawGrammarEntry {
  id: string
  category: GrammarCategory
  wordOrPhrase: string
  correctAnswer: string
  // ALL choices for this question, including correctAnswer, in the
  // workbook's own column order (option_1..option_5, trailing empties
  // dropped) -- never generated/invented here, per the spec's explicit
  // "do not invent grammatical answers client-side" rule.
  options: string[]
  difficulty: GrammarDifficulty
  teachingNote: string
  reviewStatus: GrammarReviewStatus
  enabled: boolean
}

export interface GrammarEntry extends RawGrammarEntry {
  // Grapheme-cluster count of wordOrPhrase -- computed and asserted
  // non-empty here (Unicode-safety smoke check; this module doesn't
  // mask/split words the way Mayangoli/Ina Ezhuthukkal do, so there's
  // no reconstruction round-trip to assert, but every word must still
  // survive Intl.Segmenter without throwing or coming back empty).
  graphemeCount: number
}

export class GrammarEntryError extends Error {
  constructor(public entryId: string, reason: string) {
    super(`[${entryId}] ${reason}`)
    this.name = 'GrammarEntryError'
  }
}

// Validates and enriches one raw workbook row -- throws GrammarEntryError
// on any inconsistency (unknown category, correctAnswer not among its
// own options, duplicate options, empty text), matching the tamilGrammar/
// mayangoli modules' "validate the whole bank at module load time,
// throw loudly" discipline. Never silently drops or repairs a bad row --
// per the spec's explicit "never silently drop invalid rows" rule, a
// truly bad row must fail the build, not be quietly excluded.
export function buildGrammarEntry(raw: RawGrammarEntry): GrammarEntry {
  if (!CATEGORY_IDS.has(raw.category)) {
    throw new GrammarEntryError(raw.id, `unknown category "${raw.category}"`)
  }
  if (!raw.wordOrPhrase.trim()) {
    throw new GrammarEntryError(raw.id, 'wordOrPhrase is empty')
  }
  if (raw.options.length < 2) {
    throw new GrammarEntryError(raw.id, `expected at least 2 options, got ${raw.options.length}`)
  }
  if (new Set(raw.options).size !== raw.options.length) {
    throw new GrammarEntryError(raw.id, `duplicate options: ${JSON.stringify(raw.options)}`)
  }
  if (!raw.options.includes(raw.correctAnswer)) {
    throw new GrammarEntryError(raw.id, `correctAnswer "${raw.correctAnswer}" not present in options ${JSON.stringify(raw.options)}`)
  }

  const clusters = graphemeClusters(raw.wordOrPhrase)
  if (clusters.length === 0) {
    throw new GrammarEntryError(raw.id, 'wordOrPhrase produced zero grapheme clusters')
  }

  return { ...raw, graphemeCount: clusters.length }
}
