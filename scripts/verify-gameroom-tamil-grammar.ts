// Standalone verification script for the legacy GameRoom "Ina Ezhuthukkal"
// (ண்/ந்/ன் distinction) module -- confirms the fix for a real
// pedagogical bug: the blanked word used to leave the grapheme cluster
// immediately after the blank visible, and that cluster ALWAYS started
// with the category's fixed series letter (ண் -> ட, ந் -> த, ன் -> ற),
// letting a student answer every question by pattern-matching the
// visible letter instead of knowing the actual grammar rule. Same
// tsx-script convention as the GameRoom V2 verify-*.ts scripts (no
// Jest/Vitest in this repo).
//
// Run with: npx tsx scripts/verify-gameroom-tamil-grammar.ts

import { tamilGrammarModule } from '../lib/gameRoom/modules/tamilGrammar'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

// The three series letters that USED to follow the blank deterministically
// one-to-one with the category -- ட for every ண் question, த for every
// ந் question, ற for every ன் question.
const GIVEAWAY_LETTERS = ['ட', 'த', 'ற']

console.log('== tamilGrammarModule builds its full validated question bank ==')
const bank = tamilGrammarModule.getQuestionBank()
assert(bank.length === 180, `question bank has exactly 180 questions (got ${bank.length})`)

console.log('\n== No question leaks its category via the letter right after the blank ==')
let leakCount = 0
for (const q of bank) {
  const afterBlank = q.prompt.split('___')[1]?.charAt(0) ?? ''
  if (GIVEAWAY_LETTERS.includes(afterBlank)) {
    console.error(`  LEAK: ${q.id} -- prompt "${q.prompt}" still shows "${afterBlank}" right after the blank, which deterministically reveals correctAnswer="${q.correctAnswer}"`)
    leakCount++
  }
}
assert(leakCount === 0, `0 of ${bank.length} questions leak their category via the post-blank letter (found ${leakCount} leak(s))`)

console.log('\n== Every prompt still contains exactly one blank marker ==')
assert(
  bank.every((q) => q.prompt.includes('___') && q.prompt.split('___').length === 2),
  'every prompt has exactly one "___" blank (not zero, not more than one)'
)

console.log('\n== Every prompt still shows real surrounding context (not over-masked into uselessness) ==')
// The fix masks the blank's cluster AND the next cluster together -- this
// confirms that didn't go too far and blank the ENTIRE word (which would
// make the question unanswerable/meaningless), by requiring at least one
// visible character remains outside the blank for every question.
assert(
  bank.every((q) => q.prompt.replace(/_/g, '').trim().length > 0),
  'every prompt retains at least one visible (non-blank) character -- the fix narrows the leak without erasing the whole word'
)

console.log('\n== Spot-check specific known words against their expected masked form ==')
const byId = new Map(bank.map((q) => [q.id, q]))
const spotChecks: { id: string; expectedPrompt: string }[] = [
  { id: 'tamil-grammar:tan_001', expectedPrompt: 'அ___ம்' }, // அண்டம் -- ண் + ட masked together
  { id: 'tamil-grammar:tan_006', expectedPrompt: 'க___ம்' }, // கண்டம்
  { id: 'tamil-grammar:nan_001', expectedPrompt: 'ப___' }, // பந்து -- ந் + து masked together
]
for (const { id, expectedPrompt } of spotChecks) {
  const q = byId.get(id)
  assert(q !== undefined, `${id} exists in the question bank`)
  if (q) assert(q.prompt === expectedPrompt, `${id}: prompt is "${expectedPrompt}" (got "${q.prompt}")`)
}

console.log('\n== Category distribution unchanged (fix only touches display, not content) ==')
const byCategory = new Map<string, number>()
for (const q of bank) byCategory.set(q.category as string, (byCategory.get(q.category as string) ?? 0) + 1)
assert(byCategory.get('ண்') === 60, `ண் category still has 60 questions (got ${byCategory.get('ண்')})`)
assert(byCategory.get('ந்') === 60, `ந் category still has 60 questions (got ${byCategory.get('ந்')})`)
assert(byCategory.get('ன்') === 60, `ன் category still has 60 questions (got ${byCategory.get('ன்')})`)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
