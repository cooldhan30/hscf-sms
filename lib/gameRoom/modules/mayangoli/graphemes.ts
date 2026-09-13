// Tamil grapheme-cluster utilities for Mayangoli -- same approach as
// lib/gameRoom/modules/tamilGrammar/blankGeneration.ts (confirmed
// correct there and reused verbatim here): split with Intl.Segmenter's
// 'ta' grapheme granularity, never raw JS characters/indices, since a
// single visible Tamil syllable is frequently 2+ Unicode code points
// (e.g. "ழ" + pulli, or a consonant + a dependent vowel sign) and
// naive indexing corrupts them.
const GRAPHEME_SEGMENTER = new Intl.Segmenter('ta', { granularity: 'grapheme' })

export function graphemeClusters(word: string): string[] {
  return Array.from(GRAPHEME_SEGMENTER.segment(word), (s) => s.segment)
}

export class MayangoliWordError extends Error {
  constructor(public wordId: string, reason: string) {
    super(`[${wordId}] ${reason}`)
    this.name = 'MayangoliWordError'
  }
}

// Finds the (first) grapheme cluster containing `bareLetter` as its
// base consonant. A Tamil grapheme cluster is one of:
//   - the bare consonant with a following dependent vowel sign fused
//     into ONE cluster (e.g. "ல" + "ை" -> "லை" as a single grapheme:
//     மலை -> ம|லை, கிளி -> கி|ளி) -- confirmed by direct testing that
//     Intl.Segmenter does NOT split the consonant from its vowel sign;
//   - the bare consonant alone, when it carries the plain inherent
//     vowel (பழம் -> ப|ழ|ம், மரம் -> ம|ர|ம்);
//   - the consonant + pulli, when it closes a syllable with no vowel
//     (தமிழ் -> த|மி|ழ், பந்து -> ப|ந்|து).
// So the correct test is "cluster === bareLetter" (plain form),
// "cluster === bareLetter + pulli" (closed form), or
// "cluster.startsWith(bareLetter) && cluster !== bareLetter+pulli"
// (vowel-sign-fused form) -- collapsed below into a single startsWith
// check plus an explicit pulli-form exclusion from being double-
// matched as a "starts with" case (a cluster can't be both).
export function findTargetIndex(clusters: string[], bareLetter: string): { index: number; matchedForm: string } {
  const index = clusters.findIndex((c) => c === bareLetter || c.startsWith(bareLetter))
  if (index === -1) return { index: -1, matchedForm: '' }
  return { index, matchedForm: clusters[index] }
}

// Masks the grapheme at `index` with a fixed-width blank placeholder,
// leaving every other grapheme cluster completely intact -- never
// touches individual Unicode code points within a cluster.
export function maskGraphemeAt(clusters: string[], index: number, placeholder = '__'): string {
  return clusters.map((c, i) => (i === index ? placeholder : c)).join('')
}

// Reconstructs the word from clusters with the target grapheme swapped
// back in, then asserts it equals the original -- the same
// "reconstruction must round-trip exactly" safety check
// blankGeneration.ts uses, catching any masking bug before it ships a
// corrupted prompt.
export function assertReconstructs(
  wordId: string,
  original: string,
  clusters: string[],
  index: number,
  matchedForm: string
) {
  const reconstructed = clusters.map((c, i) => (i === index ? matchedForm : c)).join('')
  if (reconstructed !== original) {
    throw new MayangoliWordError(wordId, `reconstruction mismatch: got "${reconstructed}", expected "${original}"`)
  }
}
