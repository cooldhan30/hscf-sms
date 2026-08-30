// Tamil grapheme-cluster segmentation -- splits a Tamil word into the
// "learning units" a Nilai 1 student is taught to read as single
// characters, NOT raw Unicode code points. This matters because a
// single visible Tamil syllable is often 2-3 Unicode code points:
//   "ர" + "ம்" (pulli, U+0BCD)        -> 2 code points, 1 taught unit
//   "க" + "ா"  (vowel sign, U+0BBE)   -> 2 code points, 1 taught unit
//   "மா" ("ம" + "ா") is one uyirmei unit; "ம்" ("ம" + pulli) is one
//   mei unit. Splitting by code point would show a bare consonant
//   followed by a floating pulli/vowel-sign as two separate tiles,
//   which is not how a child is taught to read the word.
//
// Algorithm: walk the string one base consonant/vowel at a time, and
// greedily attach any trailing combining marks (pulli U+0BCD, or one
// of the dependent vowel signs U+0BBE-U+0BCC) to that base character --
// the standard definition of a Tamil grapheme cluster for this
// script. This does NOT attempt full Unicode grapheme-cluster
// segmentation (no Intl.Segmenter dependency) -- it hand-rolls the
// Tamil-specific combining-mark rule, which is all this script needs.
const TAMIL_PULLI = '்'
const TAMIL_VOWEL_SIGNS = new Set([
  'ா', // ா
  'ி', // ி
  'ீ', // ீ
  'ு', // ு
  'ூ', // ூ
  'ெ', // ெ
  'ே', // ே
  'ை', // ை
  'ொ', // ொ
  'ோ', // ோ
  'ௌ', // ௌ
])

export function segmentTamilWord(word: string): string[] {
  const units: string[] = []
  let i = 0

  while (i < word.length) {
    let unit = word[i]
    i++

    // Attach a trailing pulli or dependent vowel sign to the base
    // character that precedes it -- together they form one taught
    // unit (a mei consonant with pulli, or an uyirmei syllable).
    if (i < word.length && (word[i] === TAMIL_PULLI || TAMIL_VOWEL_SIGNS.has(word[i]))) {
      unit += word[i]
      i++
    }

    units.push(unit)
  }

  return units
}
