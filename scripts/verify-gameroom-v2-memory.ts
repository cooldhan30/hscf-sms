// Standalone verification script for Memory's pure round/difficulty
// logic (lib/gameRoomV2/memory/*). Same tsx-script convention as every
// other verify-gameroom-v2-*.ts script. Covers: round creation from a
// STRIPPED MATCH payload (sides shuffled independently, as /state sends
// them), classic flip-two-cards rules, same-side pairs resolving locally,
// left+right pairs resolved by a server-style pair oracle, matched state
// never regressing, completion, submission graded by the existing MATCH
// grader, and star ratings.
//
// Run with: npx tsx scripts/verify-gameroom-v2-memory.ts

import {
  createMemoryRound,
  isRoundComplete,
  totalPairs,
  canFlip,
  flipCard,
  flippedPairToCheck,
  resolveFlippedPair,
  acknowledgeAttempt,
  isCardFaceUp,
  buildRoundSubmission,
  memoryStars,
  type MemoryRoundState,
} from '../lib/gameRoomV2/memory/round'
import { isPairInMatchPayload } from '../lib/gameRoomV2/matching/pairCheck'
import { MEMORY_DIFFICULTY_SETTINGS, getMemoryDifficultySettings } from '../lib/gameRoomV2/memory/difficulty'
import { shuffledOptionsFor } from '../lib/gameRoomV2/shuffle'
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

const PAYLOAD = {
  pairs: [
    { left: 'puli', right: 'tiger' },
    { left: 'yaanai', right: 'elephant' },
    { left: 'naai', right: 'dog' },
  ],
}
const LEFT = shuffledOptionsFor(PAYLOAD.pairs.map((p) => p.left), 'salt:s2:q9:left')
const RIGHT = shuffledOptionsFor(PAYLOAD.pairs.map((p) => p.right), 'salt:s2:q9:right')

// What the UI does: a left+right pair asks the server; same-side never pairs.
function resolve(r: MemoryRoundState) {
  const labels = flippedPairToCheck(r)
  return resolveFlippedPair(r, labels ? isPairInMatchPayload(PAYLOAD, labels.left, labels.right) : false)
}

console.log('== Round creation: every card starts face down ==')
let round = createMemoryRound(LEFT, RIGHT, 'verify-seed-1')
assert(round.cards.length === 6 && totalPairs(round) === 3, 'a 3-pair MATCH payload creates a 6-card round')
assert(round.flippedCardIds.length === 0 && round.matchedCardIds.length === 0, 'a fresh round has nothing flipped or matched')
assert(round.cards.every((c) => !isCardFaceUp(round, c)), 'every card starts face down')

const by = (label: string) => round.cards.find((c) => c.label === label)!

console.log('\n== Flipping cards: classic two-at-a-time rules ==')
assert(canFlip(round, by('puli').id), 'a fresh card can be flipped')
round = flipCard(round, by('puli').id)
assert(isCardFaceUp(round, by('puli')), 'a flipped card reports face up')
assert(!canFlip(round, by('puli').id), 'the same card cannot be flipped twice')
round = flipCard(round, by('tiger').id)
assert(round.flippedCardIds.length === 2, 'flipping a second card brings the flipped count to 2')
assert(!canFlip(round, by('naai').id), 'a third card cannot be flipped while two are face up')
assert(flippedPairToCheck(round)?.left === 'puli' && flippedPairToCheck(round)?.right === 'tiger', 'a left+right pair is sent to the server as left/right labels')
round = resolve(round)
assert(round.pairs['puli'] === 'tiger' && round.matchedCardIds.length === 2, 'a confirmed pair is recorded as matched')
assert(isCardFaceUp(round, by('tiger')), 'matched cards stay face up')
round = acknowledgeAttempt(round)

console.log('\n== Mismatches ==')
round = flipCard(round, by('yaanai').id)
round = flipCard(round, by('naai').id)
assert(flippedPairToCheck(round) === null, 'two cards from the same side need no server check -- they can never pair')
round = resolve(round)
assert(round.lastAttempt?.correct === false && round.flippedCardIds.length === 0, 'a same-side flip resolves as a mismatch and both flip back')
round = flipCard(round, by('yaanai').id)
round = flipCard(round, by('dog').id)
round = resolve(round)
assert(!round.pairs['yaanai'] && round.matchedCardIds.length === 2, 'a server-rejected pair is never matched, and earlier matches never regress')
assert(round.currentStreak === 0, 'a mismatch breaks the streak')

console.log('\n== Completion ==')
round = flipCard(round, by('yaanai').id)
round = flipCard(round, by('elephant').id)
round = resolve(round)
round = flipCard(round, by('dog').id)
round = flipCard(round, by('naai').id)
round = resolve(round)
assert(isRoundComplete(round), 'matching every pair completes the round')
assert(round.moves === 5, 'the full round took exactly 5 resolved moves (3 correct, 2 wrong)')

console.log('\n== Submission reuses the existing MATCH grading contract exactly ==')
const submission = buildRoundSubmission(round)
assert(Object.keys(submission).length === 3 && submission['naai'] === 'dog', 'the submission maps every left label to its confirmed right label')
assert(gradeAnswer('MATCH', PAYLOAD, submission) === true, 'the existing MATCH grader accepts the confirmed pairs, unchanged')

console.log('\n== Stars (in-match only) ==')
assert(memoryStars(4, 3) === 3 && memoryStars(6, 3) === 2 && memoryStars(9, 3) === 1, 'fewer flips earn more stars')

console.log('\n== Difficulty: alters gameplay parameters only, no round timer ==')
assert(MEMORY_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Medium/Hard)')
const easy = getMemoryDifficultySettings('easy')
const hard = getMemoryDifficultySettings('hard')
assert(easy.mismatchRevealMs > hard.mismatchRevealMs, 'Easy shows a mismatch longer than Hard, giving more time to memorize')
assert(hard.streakBonusPerStep > easy.streakBonusPerStep, 'Hard grants a bigger streak bonus than Easy')
assert(
  !('roundTimeLimitSeconds' in easy),
  'Memory difficulty settings never declare a round timer -- recall is rewarded by pace, not a countdown'
)

console.log('\n== Registry: Memory has a real, testable engine behind it ==')
const engine = getGameEngineV2('memory')
assert(engine !== undefined, 'memory is registered')
assert(engine?.status === 'ACTIVE', 'Memory is ACTIVE, genuinely playable')
assert(engine?.compatibility.soloSupport === true, 'Memory supports solo play')
assert(engine?.compatibility.supportedQuestionTypes.includes('MATCH') === true, 'Memory supports MATCH questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
