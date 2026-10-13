// GameRoom Classic: Tamil text handling and grading rules.
// Run with: npx tsx scripts/verify-grc-tamil.ts
import { joinTiles, splitLetters, splitWords, tilesFor } from '../lib/grClassic/graphemes'
import { gradeChoice, gradeMatch, gradeOrder, livePoints, totals } from '../lib/grClassic/scoring'
import { GAMES, LIBRARY } from '../lib/grClassic/sampleData'
import { toCsv } from '../lib/grClassic/format'
import type { ChoiceQuestion, MatchQuestion, OrderQuestion } from '../lib/grClassic/types'

let failures = 0
let passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++
  else {
    failures++
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`)
  }
}

// --- 1. Every uyirmei and mei letter is one tile ---
const CONSONANTS = 'க ங ச ஞ ட ண த ந ப ம ய ர ல வ ழ ள ற ன'.split(' ')
const SIGNS = ['', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ', '்']
let letters = 0
for (const c of CONSONANTS)
  for (const s of SIGNS) {
    letters++
    eq(`single letter ${c + s}`, splitLetters(c + s), [c + s])
  }
const VOWELS = 'அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ ஃ'.split(' ')
for (const v of VOWELS) eq(`vowel ${v}`, splitLetters(v), [v])
console.log(`Checked ${letters} uyirmei/mei letters + ${VOWELS.length} uyir/aaytham letters.`)

// --- 2. Words split into whole letters ---
eq('அம்மா', splitLetters('அம்மா'), ['அ', 'ம்', 'மா'])
eq('கண்ணாடி', splitLetters('கண்ணாடி'), ['க', 'ண்', 'ணா', 'டி'])
eq('தமிழ்', splitLetters('தமிழ்'), ['த', 'மி', 'ழ்'])
eq('பள்ளிக்கூடம்', splitLetters('பள்ளிக்கூடம்'), ['ப', 'ள்', 'ளி', 'க்', 'கூ', 'ட', 'ம்'])
eq('கௌதம் (composed ௌ)', splitLetters('கௌதம்'), ['கௌ', 'த', 'ம்'])
// க + ெ + ௗ (decomposed) must normalise to the same single letter கௌ
const decomposed = 'க' + String.fromCharCode(0x0bc6, 0x0bd7)
eq('decomposed கௌ normalises', splitLetters(decomposed), ['கௌ'])
eq('decomposed கொ (க + ெ + ா)', splitLetters('க' + String.fromCharCode(0x0bc6, 0x0bbe)), ['கொ'])
eq('ஸ்ரீ', splitLetters('ஸ்ரீ'), ['ஸ்', 'ரீ'])
eq('spaces ignored for letters', splitLetters(' அ ம் மா '), ['அ', 'ம்', 'மா'])
eq('sentence words', splitWords('நான்  பள்ளிக்குச் செல்கிறேன்'), ['நான்', 'பள்ளிக்குச்', 'செல்கிறேன்'])

// --- 3. Every sample word-builder question round-trips through its tiles ---
for (const q of LIBRARY.filter((x): x is OrderQuestion => x.kind === 'order')) {
  eq(`round trip ${q.answer}`, joinTiles(tilesFor(q), q.unit), q.answer)
  eq(`no stray marks ${q.answer}`, tilesFor(q).every((t) => !/^[ா-்ௗ]/.test(t)), true)
}

// --- 4. Grading ---
const quiz = LIBRARY.find((q) => q.id === 'q-uyir-1') as ChoiceQuestion
eq('quiz right', gradeChoice(quiz, 1).correctUnits, 1)
eq('quiz wrong', gradeChoice(quiz, 0).correctUnits, 0)
const m = LIBRARY.find((q) => q.id === 'q-porul-1') as MatchQuestion
eq('match all first try', gradeMatch(m, { 0: 'cat', 1: 'dog', 2: 'cow', 3: 'elephant' }).correctUnits, 4)
eq('match two swapped', gradeMatch(m, { 0: 'dog', 1: 'cat', 2: 'cow', 3: 'elephant' }).correctUnits, 2)
eq('match missing pick counts wrong', gradeMatch(m, { 0: 'cat' }).correctUnits, 1)
const w = LIBRARY.find((q) => q.id === 'q-word-4') as OrderQuestion
eq('word right', gradeOrder(w, ['க', 'ண்', 'ணா', 'டி']).correctUnits, 1)
eq('word wrong order', gradeOrder(w, ['ண்', 'க', 'ணா', 'டி']).correctUnits, 0)
eq('word decomposed input still right', gradeOrder(LIBRARY.find((q) => q.id === 'q-word-1') as OrderQuestion, ['அ', 'ம்', 'ம' + 'ா']).correctUnits, 1)
eq('totals', totals([{ questionId: 'a', prompt: '', correctUnits: 3, totalUnits: 4, given: '', expected: '' }, { questionId: 'b', prompt: '', correctUnits: 1, totalUnits: 1, given: '', expected: '' }]), { correct: 4, total: 5, percent: 80 })
eq('totals empty', totals([]).percent, 0)
eq('live points wrong = 0', livePoints(false, 100, 20000), 0)
eq('live points instant = 1000', livePoints(true, 0, 20000), 1000)
eq('live points at buzzer = 500', livePoints(true, 20000, 20000), 500)

// --- 5. Sample games are well-formed ---
for (const g of GAMES) {
  eq(`${g.id} has questions`, g.questions.length > 0, true)
  for (const q of g.questions) {
    if (q.kind === 'choice') eq(`${q.id} answer in range`, q.answerIndex >= 0 && q.answerIndex < q.options.length && q.options.length >= 2 && q.options.length <= 4, true)
    if (q.kind === 'match') eq(`${q.id} unique partners`, new Set(q.pairs.map((p) => p.right)).size, q.pairs.length)
  }
}

// --- 6. CSV keeps Tamil and starts with a BOM for Excel ---
const csv = toCsv([['மாணவர்', 'Score'], ['கயல், "K"', 90]])
eq('csv BOM', csv.charCodeAt(0), 0xfeff)
eq('csv tamil + quoting', csv.slice(1), 'மாணவர்,Score\r\n"கயல், ""K""",90')

console.log(failures ? `\n${failures} FAILURE(S), ${passes} passed` : `\nPASS: ${passes} checks.`)
process.exit(failures ? 1 : 0)
