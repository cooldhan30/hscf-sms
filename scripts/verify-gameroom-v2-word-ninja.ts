// Standalone verification script for Word Ninja's pure lane/flight
// simulation (lib/gameRoomV2/wordNinja/*). Same tsx-script convention
// as every other verify-gameroom-v2-*.ts script. Covers: the lane
// model being generic over any category count (the "reusable content
// model" requirement -- 2-category and 5-category CATEGORIZE questions
// use the exact same mechanic), word flight scheduling, slash/miss
// handling, and -- critically -- that a completed round produces
// EXACTLY the Record<item, category> shape gradeAnswer's existing
// CATEGORIZE case already grades, with no server changes needed.
//
// Run with: npx tsx scripts/verify-gameroom-v2-word-ninja.ts

import { buildLanes, createFlyingWords, assignWordToLane, allWordsAssigned, buildCategorizeSubmission } from '../lib/gameRoomV2/wordNinja/lanes'
import { WORD_NINJA_DIFFICULTY_SETTINGS, getWordNinjaDifficultySettings } from '../lib/gameRoomV2/wordNinja/difficulty'
import { createInitialRound, tickRound, slashWord, isRoundReadyToSubmit, buildRoundSubmission } from '../lib/gameRoomV2/wordNinja/round'
import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'
import { getGameEngineV2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Reusable content model: lanes are generic over any category count ==')
const binaryLanes = buildLanes(['ஒருமை', 'பன்மை'])
assert(binaryLanes.length === 2, 'a 2-category CATEGORIZE question produces 2 lanes')
const fiveLanes = buildLanes(['a', 'b', 'c', 'd', 'e'])
assert(fiveLanes.length === 5, 'a 5-category CATEGORIZE question produces 5 lanes with the exact same function -- no special-casing by count')
assert(binaryLanes.every((l, i) => l.index === i), 'lanes preserve the category order given, so a teacher-authored order is respected')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(WORD_NINJA_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Normal/Hard)')
const easy = getWordNinjaDifficultySettings('easy')
const hard = getWordNinjaDifficultySettings('hard')
assert(easy.flightDurationMs > hard.flightDurationMs, 'Easy words fly slower (longer duration) than Hard')
assert(easy.maxConcurrentWords < hard.maxConcurrentWords, 'Hard has more words in the air at once than Easy')
assert(
  !('questionDifficulty' in easy) && !('categories' in easy) && !('items' in easy),
  'difficulty settings never reference question content/difficulty -- that comes only from the Question Set'
)

console.log('\n== Flying word lifecycle ==')
let words = createFlyingWords(['பூனை', 'நாய்', 'வீடு'])
assert(words.length === 3, 'one flying word per item')
assert(words.every((w) => w.assignedCategory === undefined), 'every word starts unassigned')
words = assignWordToLane(words, words[0].id, 'பெயர்ச்சொல்')
assert(words[0].assignedCategory === 'பெயர்ச்சொல்', 'slashing a word into a lane assigns it that category')
assert(words[1].assignedCategory === undefined, 'assigning one word never affects another word\'s assignment')
assert(!allWordsAssigned(words), 'the batch is not fully assigned until every word has a lane')
words = assignWordToLane(words, words[1].id, 'பெயர்ச்சொல்')
words = assignWordToLane(words, words[2].id, 'பெயர்ச்சொல்')
assert(allWordsAssigned(words), 'once every word has a lane, the batch is fully assigned')

console.log('\n== Submission shape matches gradeAnswer\'s existing CATEGORIZE contract exactly ==')
const submission = buildCategorizeSubmission(words)
assert(
  submission['பூனை'] === 'பெயர்ச்சொல்' && submission['நாய்'] === 'பெயர்ச்சொல்' && submission['வீடு'] === 'பெயர்ச்சொல்',
  'the built submission maps every item to its assigned category, same Record<item, category> shape CategorizeInput already produces'
)
const gradedTrue = gradeAnswer(
  'CATEGORIZE',
  { items: ['பூனை', 'நாய்', 'வீடு'], categories: ['பெயர்ச்சொல்', 'வினைச்சொல்'], answerKey: { பூனை: 'பெயர்ச்சொல்', நாய்: 'பெயர்ச்சொல்', வீடு: 'பெயர்ச்சொல்' } },
  submission
)
assert(gradedTrue === true, 'a Word Ninja round\'s submission is graded correct by the EXISTING gradeAnswer CATEGORIZE case, with zero server changes')
const gradedFalse = gradeAnswer(
  'CATEGORIZE',
  { items: ['பூனை', 'நாய்', 'வீடு'], categories: ['பெயர்ச்சொல்', 'வினைச்சொல்'], answerKey: { பூனை: 'வினைச்சொல்', நாய்: 'பெயர்ச்சொல்', வீடு: 'பெயர்ச்சொல்' } },
  submission
)
assert(gradedFalse === false, 'a wrong lane assignment is graded incorrect, same all-or-nothing rule every CATEGORIZE question already uses')

console.log('\n== Round flight scheduling ==')
const settings = getWordNinjaDifficultySettings('normal')
let round = createInitialRound(['a', 'b', 'c', 'd'])
assert(round.queue.length === 4 && round.active.length === 0, 'a fresh round queues every item with nothing yet in flight')
round = tickRound(round, settings.spawnIntervalMs, settings)
assert(round.active.length > 0, 'ticking past the spawn interval brings a word into flight')
assert(round.active.length <= settings.maxConcurrentWords, 'never more words in flight than maxConcurrentWords allows')

console.log('\n== Missed words still require resolution -- never silently dropped ==')
round = createInitialRound(['a'])
round = tickRound(round, settings.spawnIntervalMs, settings)
const activeWordId = round.active[0].id
round = tickRound(round, settings.flightDurationMs + 100, settings)
assert(round.active[0].missed === true, 'a word whose flight time fully elapses is flagged missed')
assert(round.active[0].assignedCategory === undefined, 'a missed word is NOT auto-assigned any category -- it still needs a real slash')
round = slashWord(round, activeWordId, 'பெயர்ச்சொல்')
assert(round.active.length === 0 && round.resolved.length === 1, 'a missed word can still be slashed after the fact -- flight time never locks it out')

console.log('\n== Round completion detection ==')
round = createInitialRound(['a', 'b'])
assert(!isRoundReadyToSubmit(round), 'a fresh round is not ready to submit')
let iterations = 0
while (round.queue.length > 0 || round.active.length > 0) {
  round = tickRound(round, 100, settings)
  for (const active of round.active) {
    round = slashWord(round, active.id, 'category-a')
  }
  iterations++
  if (iterations > 1000) break
}
assert(iterations <= 1000, 'a round resolves in a bounded number of ticks, never hangs')
round = tickRound(round, 100, settings)
assert(isRoundReadyToSubmit(round), 'once every word is slashed and the queue is empty, the round is ready to submit')
const finalSubmission = buildRoundSubmission(round)
assert(Object.keys(finalSubmission).length === 2, 'the final submission includes every item from the round')

console.log('\n== Registry: Word Ninja is now a real, playable engine ==')
const engine = getGameEngineV2('word-ninja')
assert(engine?.status === 'ACTIVE', 'Word Ninja is ACTIVE in the registry')
assert(engine?.compatibility.supportedQuestionTypes.includes('CATEGORIZE') ?? false, 'Word Ninja declares CATEGORIZE support -- the only question type its mechanic actually renders')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
