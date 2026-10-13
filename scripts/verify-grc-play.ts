// GameRoom Classic Phase 3: the shared play contract (lib/grClassic/play.ts).
// Proves what a player's device receives carries no answer keys, and that
// checking and hints behave the same for every game type.
// Run with: npx tsx scripts/verify-grc-play.ts
import { checkResponse, describeResponse, hintFor, isPlayResponse, localSession, toPlayQuestion, type PlayQuestion } from '../lib/grClassic/play'
import { tilesFor } from '../lib/grClassic/graphemes'
import { LIBRARY } from '../lib/grClassic/sampleData'
import type { ChoiceQuestion, MatchQuestion, OrderQuestion } from '../lib/grClassic/types'

let failures = 0
let passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++
  else {
    failures++
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`)
  }
}

const quiz = LIBRARY.find((q) => q.id === 'q-uyir-2') as ChoiceQuestion // answer ஊ (index 2), has explanation
const match = LIBRARY.find((q) => q.id === 'q-porul-1') as MatchQuestion
const word = LIBRARY.find((q) => q.id === 'q-word-4') as OrderQuestion // கண்ணாடி
const sentence = LIBRARY.find((q) => q.id === 'q-sent-1') as OrderQuestion

// --- 1. No answer keys in what the device receives (every sample question, 50 shuffles each) ---
const FORBIDDEN = ['answerIndex', 'answer', 'pairs', 'explanation', 'hint', 'correct', 'expected', 'category', 'categoryId', 'difficulty']
for (const q of LIBRARY) {
  for (let i = 0; i < 50; i++) {
    const p = toPlayQuestion(q) as Record<string, unknown>
    const leaked = FORBIDDEN.filter((k) => k in p)
    if (leaked.length) {
      eq(`${q.id} leaks ${leaked.join(',')}`, leaked, [])
      break
    }
    if (q.kind === 'match') {
      const mp = p as Extract<PlayQuestion, { kind: 'match' }>
      if (mp.rights.every((r, k) => r === q.pairs[k].right)) eq(`${q.id} partners left in answer order`, 'in order', 'shuffled')
      if ([...mp.rights].sort().join() !== q.pairs.map((x) => x.right).sort().join()) eq(`${q.id} partners changed`, mp.rights, q.pairs)
    }
    if (q.kind === 'order') {
      const op = p as Extract<PlayQuestion, { kind: 'order' }>
      const answerTiles = tilesFor(q)
      if (op.tiles.every((t, k) => t === answerTiles[k])) eq(`${q.id} tiles left in answer order`, 'in order', 'shuffled')
      if ([...op.tiles].sort().join('|') !== [...answerTiles].sort().join('|')) eq(`${q.id} tiles changed`, op.tiles, answerTiles)
    }
  }
}
passes++
eq('quiz keeps the teacher’s option order', (toPlayQuestion(quiz) as { options: string[] }).options, quiz.options)
eq('order tiles are whole Tamil letters', [...(toPlayQuestion(word) as { tiles: string[] }).tiles].sort(), [...tilesFor(word)].sort())

// --- 2. Checking: practice (reveal) vs assignment (no reveal) ---
eq('quiz right, reveal', checkResponse(quiz, { kind: 'choice', choice: 2 }, true), { correct: true, expected: 'ஊ', correctIndex: 2, explanation: quiz.explanation })
eq('quiz wrong, reveal shows answer', checkResponse(quiz, { kind: 'choice', choice: 0 }, true).correctIndex, 2)
eq('quiz wrong, NO reveal shows nothing', checkResponse(quiz, { kind: 'choice', choice: 0 }, false), { correct: false })
eq('quiz right, NO reveal', checkResponse(quiz, { kind: 'choice', choice: 2 }, false), { correct: true })
eq('match right pair', checkResponse(match, { kind: 'match', left: 0, right: 'cat' }, true), { correct: true })
eq('match wrong pair never lists answers', checkResponse(match, { kind: 'match', left: 0, right: 'dog' }, true), { correct: false })
eq('word right', checkResponse(word, { kind: 'order', tiles: ['க', 'ண்', 'ணா', 'டி'] }, false), { correct: true })
eq('word wrong, reveal gives answer', checkResponse(word, { kind: 'order', tiles: ['ண்', 'க', 'ணா', 'டி'] }, true), { correct: false, expected: 'கண்ணாடி' })
eq('word wrong, NO reveal', checkResponse(word, { kind: 'order', tiles: ['ண்', 'க', 'ணா', 'டி'] }, false), { correct: false })
eq('sentence right', checkResponse(sentence, { kind: 'order', tiles: ['நான்', 'பள்ளிக்குச்', 'செல்கிறேன்'] }, false).correct, true)

// --- 3. Tampered or mismatched responses are just wrong ---
eq('wrong kind', checkResponse(quiz, { kind: 'order', tiles: ['ஊ'] }, true).correct, false)
eq('index out of range', checkResponse(quiz, { kind: 'choice', choice: 9 }, true).correct, false)
eq('fractional index', checkResponse(quiz, { kind: 'choice', choice: 2.5 }, true).correct, false)
eq('match bad left', checkResponse(match, { kind: 'match', left: 99, right: 'cat' }, true).correct, false)
eq('order tiles with extra text', checkResponse(word, { kind: 'order', tiles: ['கண்ணாடி', 'x'] }, true).correct, false)
eq('isPlayResponse rejects junk', [null, 'x', { kind: 'choice' }, { kind: 'order', tiles: 'abc' }, { kind: 'match', left: '0', right: 'a' }, { kind: 'order', tiles: Array(41).fill('a') }].map(isPlayResponse), [false, false, false, false, false, false])
eq('isPlayResponse accepts real ones', [{ kind: 'choice', choice: 1 }, { kind: 'match', left: 0, right: 'a' }, { kind: 'order', tiles: ['அ'] }].map(isPlayResponse), [true, true, true])

// --- 4. Hints ---
for (let i = 0; i < 30; i++) {
  const h = hintFor(quiz)
  if (!('removeOption' in h) || h.removeOption === quiz.answerIndex) {
    eq('quiz hint never removes the right answer', h, 'a wrong option')
    break
  }
}
passes++
eq('two-option quiz has no hint', hintFor(LIBRARY.find((q) => q.id === 'q-uyir-5') as ChoiceQuestion), { none: true })
eq('match hint skips matched pairs', hintFor(match, [0, 1]), { pair: { left: 2, right: 'cow' } })
eq('match hint when all matched', hintFor(match, [0, 1, 2, 3]), { none: true })
eq('word hint', hintFor(LIBRARY.find((q) => q.id === 'q-word-1') as OrderQuestion), { firstTile: 'அ', text: 'அ-வில் தொடங்கும்' })

// --- 5. Local session = same rules ---
const run = async () => {
  const s = localSession([quiz, word], false)
  eq('local session, no reveal', await s.check(quiz.id, { kind: 'choice', choice: 0 }), { correct: false })
  eq('local session, unknown question', await s.check('nope', { kind: 'choice', choice: 0 }), { correct: false })
  eq('describe response', describeResponse(toPlayQuestion(word), { kind: 'order', tiles: ['க', 'ண்', 'ணா', 'டி'] }), 'கண்ணாடி')

  console.log(failures ? `\n${failures} FAILURE(S), ${passes} passed` : `\nPASS: ${passes} checks.`)
  process.exit(failures ? 1 : 0)
}
run()
