import { graphemeClusters, findTargetIndex, maskGraphemeAt, assertReconstructs, MayangoliWordError } from './graphemes'
import { getGroupForLetter, MAYANGOLI_GROUPS } from './groups'

// All 8 Mayangoli consonants across all 3 groups. A distractor letter
// may come from a different group than the word's own declared group
// (e.g. an ன்/ண்/ந்-group word can carry a ல்-shaped distractor), since
// all 8 letters are broadly confusable to a learner, not strictly
// siloed by group. Confirmed empirically against all 315 real
// word-bank entries.
const ALL_MAYANGOLI_LETTERS = MAYANGOLI_GROUPS.flatMap((g) => g.letters)

export type MayangoliDifficulty = 'easy' | 'medium' | 'hard'

// A word is only ever "verified true/false" by a human reviewer, never
// by virtue of having been generated -- per explicit requirement, an
// LLM-authored entry starts at 'generated' and must be promoted by a
// teacher/reviewer via the question-bank admin screen before it's
// treated as trustworthy content. `enabled` independently controls
// whether it's actually drawn into games right now (a reviewed-but-
// currently-disputed word can be turned off without losing its review
// history).
export type ReviewStatus = 'generated' | 'reviewed' | 'approved'

export interface RawMayangoliWord {
  id: string
  word: string
  // The BARE target consonant (ழ, ள, ல, ன, ண, ந, ர, or ற -- no
  // pulli). The actual grapheme in `word` may carry a pulli or not
  // depending on syllable position; both forms are checked at build
  // time (see graphemes.ts's findTargetIndex).
  targetLetter: string
  difficulty: MayangoliDifficulty
  meaningEnglish: string
  meaningTamil?: string
  // Wrong-answer options for this word, in the SAME grapheme shape as
  // the correct answer (e.g. targetLetter "ல" matched as "லை" in the
  // word -> distractors are "ளை"/"ழை", not the bare letters "ள"/"ழ").
  // May be any of the 8 Mayangoli consonants, not necessarily
  // targetLetter's own declared group.
  distractors: string[]
  tags?: string[]
  reviewStatus: ReviewStatus
  enabled: boolean
}

export interface MayangoliWord extends RawMayangoliWord {
  groupId: string
  clusters: string[]
  targetIndex: number
  // The exact grapheme cluster that was found in the word (either the
  // bare letter or its pulli form) -- what gets displayed once
  // revealed/reconstructed.
  matchedForm: string
  // The word with its target grapheme masked -- e.g. "பழம்" -> "ப__ம்".
  maskedWord: string
  // Each raw distractor's bare consonant (the part of the distractor
  // string before the shared suffix), e.g. "ளை"/"ழை" -> "ள"/"ழ". Used
  // by question generators that need a plain letter, not the full
  // grapheme-shaped substitution string (e.g. identify_the_letter).
  distractorBaseLetters: string[]
}

// Validates and enriches one raw word bank entry -- throws
// MayangoliWordError on any inconsistency (target letter not present,
// declared group mismatch, reconstruction failure), so a bad entry
// fails the build/boot loudly instead of shipping a broken question,
// matching the tamilGrammar module's "validate the whole bank at
// module load time" discipline.
export function buildMayangoliWord(raw: RawMayangoliWord): MayangoliWord {
  const clusters = graphemeClusters(raw.word)
  const { index: targetIndex, matchedForm } = findTargetIndex(clusters, raw.targetLetter)

  if (targetIndex === -1) {
    throw new MayangoliWordError(raw.id, `target letter "${raw.targetLetter}" not found in word "${raw.word}"`)
  }

  const group = getGroupForLetter(raw.targetLetter)
  if (!group) {
    throw new MayangoliWordError(raw.id, `target letter "${raw.targetLetter}" does not belong to any known Mayangoli group`)
  }

  // Each distractor is stored in the SAME grapheme shape as the
  // correct answer -- i.e. whatever follows the bare target letter in
  // `matchedForm` (a pulli, a fused dependent vowel sign, or nothing)
  // is carried over onto a different bare consonant. E.g. for
  // "மலை" (targetLetter "ல", matchedForm "லை"), the suffix is "ை",
  // so valid distractors are "ளை"/"ழை", not the bare letters "ள"/"ழ".
  // Confirmed empirically against all 315 real word-bank entries.
  const suffix = matchedForm.slice(raw.targetLetter.length)
  const distractorBaseLetters: string[] = []
  for (const d of raw.distractors) {
    if (d === raw.targetLetter || d === matchedForm) {
      throw new MayangoliWordError(raw.id, `distractor "${d}" duplicates the target letter/answer`)
    }
    const distractorBase = d.slice(0, d.length - suffix.length)
    if (d.slice(distractorBase.length) !== suffix || !ALL_MAYANGOLI_LETTERS.includes(distractorBase)) {
      throw new MayangoliWordError(
        raw.id,
        `distractor "${d}" is not a valid Mayangoli-letter substitution for matched form "${matchedForm}"`
      )
    }
    distractorBaseLetters.push(distractorBase)
  }

  assertReconstructs(raw.id, raw.word, clusters, targetIndex, matchedForm)

  return {
    ...raw,
    groupId: group.id,
    clusters,
    targetIndex,
    matchedForm,
    maskedWord: maskGraphemeAt(clusters, targetIndex),
    distractorBaseLetters,
  }
}
