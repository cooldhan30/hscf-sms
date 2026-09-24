// Standalone verification script for GameRoom V2's Tamil-language
// correctness, covering the concrete bugs found and fixed during the
// 2026-09-24 accessibility/Tamil audit: grapheme-aware first-letter
// extraction (PlayerAvatar.tsx) and zero-width-joiner-tolerant answer
// comparison (gradeAnswer.ts / validateQuestion.ts, via the new shared
// lib/gameRoomV2/domain/textNormalize.ts). Same tsx-script convention
// as every other verify-gameroom-v2-*.ts script (no Jest/Vitest in
// this repo).
//
// Every example below is real Tamil script chosen to exercise a
// specific linguistic category the audit was asked to cover:
//   - குறில் (kuril, short vowel): அ
//   - நெடில் (nedil, long vowel): ஆ
//   - வல்லினம் (vallinam, hard/plosive consonant): க
//   - மெல்லினம் (mellinam, soft/nasal consonant): ங
//   - இடையினம் (idaiyinam, medial/glide consonant): ய
//   - உயிர்மெய் (uyirmei, consonant+vowel-sign combination): கி, கொ
//   - pulli/virama (dead consonant, no vowel): க்
//   - multi-code-point graphemes: கை, கொ (both 2 UTF-16 units, 1 visual glyph)
//
// Run with: npx tsx scripts/verify-gameroom-v2-tamil.ts

import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'
import { normalizeForComparison } from '../lib/gameRoomV2/domain/textNormalize'
import { validateQuestionPayload } from '../lib/gameRoomV2/domain/validateQuestion'
import { detectLanguage } from '../lib/gameRoomV2/domain/language'
import { firstGrapheme } from '../components/gameRoomV2/PlayerAvatar'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

// A ZWJ (U+200D) inserted mid-conjunct the way some Tamil keyboards/
// IMEs do for ஸ்ரீ -- renders IDENTICALLY to the plain form but differs
// in raw codepoints. This is the concrete "input behavior" risk the
// audit was asked to check.
const SRII_PLAIN: string = 'ஸ்ரீ' // ஸ்ரீ
const SRII_WITH_ZWJ: string = 'ஸ்‍ரீ' // ஸ் + ZWJ + ரீ -- same rendering

console.log('== Representative Tamil linguistic categories: basic Unicode sanity ==')
const categories: { label: string; text: string; expectGraphemeCount: number; expectUtf16Length: number }[] = [
  { label: 'குறில் (short vowel) அ', text: 'அ', expectGraphemeCount: 1, expectUtf16Length: 1 },
  { label: 'நெடில் (long vowel) ஆ', text: 'ஆ', expectGraphemeCount: 1, expectUtf16Length: 1 },
  { label: 'வல்லினம் (hard consonant) க', text: 'க', expectGraphemeCount: 1, expectUtf16Length: 1 },
  { label: 'மெல்லினம் (soft/nasal consonant) ங', text: 'ங', expectGraphemeCount: 1, expectUtf16Length: 1 },
  { label: 'இடையினம் (medial consonant) ய', text: 'ய', expectGraphemeCount: 1, expectUtf16Length: 1 },
  { label: 'உயிர்மெய் combination கி (ka + short-i sign)', text: 'கி', expectGraphemeCount: 1, expectUtf16Length: 2 },
  { label: 'உயிர்மெய் combination கொ (ka + o sign, 2-part vowel sign)', text: 'கொ', expectGraphemeCount: 1, expectUtf16Length: 2 },
  { label: 'pulli/virama form (dead consonant) க்', text: 'க்', expectGraphemeCount: 1, expectUtf16Length: 2 },
  { label: 'multi-code-point grapheme கை (ka + ai sign)', text: 'கை', expectGraphemeCount: 1, expectUtf16Length: 2 },
]
for (const c of categories) {
  assert(c.text.length === c.expectUtf16Length, `${c.label}: UTF-16 .length is ${c.expectUtf16Length} (confirms this IS a multi-unit case where relevant)`)
  const segmenter = new Intl.Segmenter('ta', { granularity: 'grapheme' })
  const graphemeCount = Array.from(segmenter.segment(c.text)).length
  assert(graphemeCount === c.expectGraphemeCount, `${c.label}: is exactly ${c.expectGraphemeCount} visual grapheme(s) via Intl.Segmenter`)
}

console.log('\n== normalizeForComparison: ZWJ-variant Tamil text compares equal ==')
assert(SRII_PLAIN !== SRII_WITH_ZWJ, 'sanity check: the two ஸ்ரீ variants genuinely differ at the raw string level (proves this is a real, not hypothetical, risk)')
assert(
  normalizeForComparison(SRII_PLAIN) === normalizeForComparison(SRII_WITH_ZWJ),
  'normalizeForComparison makes the plain and ZWJ-inserted ஸ்ரீ variants compare equal'
)
assert(normalizeForComparison('தமிழ்') === normalizeForComparison('தமிழ்'), 'identical input normalizes to identical output (idempotent, no corruption)')
assert(
  normalizeForComparison('  தமிழ்  ') !== normalizeForComparison('தமிழ்'),
  'normalizeForComparison does NOT trim whitespace itself -- callers still own trim() (kept as a separate, explicit step in gradeAnswer.ts)'
)

console.log('\n== gradeAnswer: TEXT_INPUT accepts a ZWJ-variant Tamil answer as correct ==')
const textInputPayload = { acceptedAnswers: [SRII_PLAIN] }
assert(gradeAnswer('TEXT_INPUT', textInputPayload, SRII_PLAIN) === true, 'the exact stored answer is graded correct')
assert(
  gradeAnswer('TEXT_INPUT', textInputPayload, SRII_WITH_ZWJ) === true,
  'a ZWJ-variant of the SAME visual answer is ALSO graded correct -- this is the actual bug fix: before normalizeForComparison, this returned false for a visually-identical answer'
)
assert(gradeAnswer('TEXT_INPUT', textInputPayload, 'முற்றிலும் வேறு பதில்') === false, 'a genuinely different answer is still graded incorrect')

console.log('\n== gradeAnswer: FILL_BLANK accepts a ZWJ-variant Tamil answer in any blank ==')
const fillBlankPayload = { blanks: [[SRII_PLAIN], ['தமிழ்']] }
assert(gradeAnswer('FILL_BLANK', fillBlankPayload, [SRII_WITH_ZWJ, 'தமிழ்']) === true, 'a ZWJ-variant in blank 1 alongside an exact match in blank 2 is graded fully correct')
assert(gradeAnswer('FILL_BLANK', fillBlankPayload, [SRII_PLAIN, 'வேறு']) === false, 'blank 2 being wrong still fails the whole answer (every blank must match)')

console.log('\n== gradeAnswer: selection-based types (MULTIPLE_CHOICE etc.) are untouched by normalization ==')
// These submit a value taken verbatim from the same options array the
// question displays -- never independently typed -- so ZWJ variance
// cannot occur between submission and answer key. Confirms the fix was
// scoped to the two free-text types only, not applied where it isn't
// needed (and couldn't cause harm, but shouldn't silently mask a real
// options-array bug by being overly lenient there either).
const mcPayload = { options: ['தமிழ்', 'ஆங்கிலம்'], correctAnswer: 'தமிழ்' }
assert(gradeAnswer('MULTIPLE_CHOICE', mcPayload, 'தமிழ்') === true, 'MULTIPLE_CHOICE: exact option match is still graded correct')
assert(gradeAnswer('MULTIPLE_CHOICE', mcPayload, 'தமிழ' /* missing pulli */) === false, 'MULTIPLE_CHOICE: a genuinely different string (not a ZWJ variant, an actually different word) is still graded incorrect -- confirms no over-broad fuzzy matching was introduced')

console.log('\n== validateQuestionPayload: MULTIPLE_CHOICE catches ZWJ-variant duplicate options ==')
const dupOptionsPayload = { options: [SRII_PLAIN, SRII_WITH_ZWJ, 'மூன்றாவது'], correctAnswer: SRII_PLAIN }
const dupProblems = validateQuestionPayload('MULTIPLE_CHOICE', 'கேள்வி', dupOptionsPayload)
assert(
  dupProblems.some((p) => p.includes('unique')),
  'two options that are ZWJ-variants of the same visual text are flagged as duplicates, not silently accepted as 2 distinct choices a student could never tell apart'
)
const distinctOptionsPayload = { options: ['தமிழ்', 'ஆங்கிலம்', 'இந்தி'], correctAnswer: 'தமிழ்' }
assert(
  validateQuestionPayload('MULTIPLE_CHOICE', 'கேள்வி', distinctOptionsPayload).length === 0,
  'three genuinely distinct Tamil options pass validation cleanly (no false-positive duplicate flag)'
)

console.log('\n== detectLanguage: representative Tamil/mixed content across all categories above ==')
assert(detectLanguage(['அஆஇஈ']) === 'tamil', 'pure vowel content (குறில்/நெடில்) detected as tamil')
assert(detectLanguage(['க ங ய']) === 'tamil', 'pure consonant content (வல்லினம்/மெல்லினம்/இடையினம்) detected as tamil')
assert(detectLanguage(['கிருஷ்ணா கொடுத்தான்']) === 'tamil', 'uyirmei-combination-heavy sentence detected as tamil')
assert(detectLanguage(['Krishna கொடுத்தான்']) === 'mixed', 'Tamil uyirmei combinations mixed with English detected as mixed')

console.log('\n== PlayerAvatar.firstGrapheme: correctly extracts the full grapheme, not the bare consonant ==')
// The exact bug this guards against: name.charAt(0) on a name starting
// with a consonant+vowel-sign grapheme silently drops the vowel sign
// and shows a DIFFERENT, incorrect letter -- not a crash, which is
// exactly why it was easy to miss originally.
const namesStartingWithUyirmei: { name: string; expectedInitial: string }[] = [
  { name: 'கிருஷ்ணா', expectedInitial: 'கி' }, // starts with ka + short-i sign
  { name: 'கௌதமன்', expectedInitial: 'கௌ' }, // starts with ka + au sign (a 2-part vowel sign, like கொ)
  { name: 'தெய்வானை', expectedInitial: 'தெ' }, // starts with tha + e sign
  { name: 'ஸ்ரீதேவி', expectedInitial: 'ஸ்' }, // starts with a pulli/virama (dead consonant) form
]
for (const { name, expectedInitial } of namesStartingWithUyirmei) {
  assert(name.charAt(0) !== expectedInitial, `"${name}": confirms charAt(0) alone ("${name.charAt(0)}") does NOT already equal the correct grapheme -- proves this is a real case, not a coincidentally-safe one`)
  assert(firstGrapheme(name) === expectedInitial, `"${name}": firstGrapheme() correctly extracts "${expectedInitial}" (what PlayerAvatar.tsx now shows as the avatar initial)`)
}
assert(firstGrapheme('') === '', 'empty string input returns an empty grapheme rather than throwing')
assert(firstGrapheme('Krishna') === 'K', 'a Latin name still gets a correct single-character initial (no regression for non-Tamil names)')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
