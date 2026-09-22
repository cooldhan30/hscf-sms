// Standalone verification script for Memory's pure round/difficulty
// logic (lib/gameRoomV2/memory/*). Same tsx-script convention as every
// other verify-gameroom-v2-*.ts script. Covers: round creation from a
// MATCH payload, classic flip-two-cards rules (can't flip a 3rd card,
// can't flip an already-face-up/matched card), match/mismatch
// resolution, moves counter, matched state never regressing, round
// completion, and submission building.
//
// Run with: npx tsx scripts/verify-gameroom-v2-memory.ts

import {
  createMemoryRound,
  isRoundComplete,
  canFlip,
  flipCard,
  resolveFlippedPair,
  acknowledgeAttempt,
  isCardFaceUp,
  buildRoundSubmission,
} from '../lib/gameRoomV2/memory/round'
import { MEMORY_DIFFICULTY_SETTINGS, getMemoryDifficultySettings } from '../lib/gameRoomV2/memory/difficulty'
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

const LEFT = ['puli', 'yaanai', 'naai']
const RIGHT = ['tiger', 'elephant', 'dog']

console.log('== Round creation: every card starts face down ==')
let round = createMemoryRound(LEFT, RIGHT, 'verify-seed-1')
assert(round.cards.length === 6, 'a 3-pair MATCH payload creates a 6-card round')
assert(round.flippedCardIds.length === 0, 'a fresh round has nothing flipped')
assert(round.matchedPairIds.length === 0, 'a fresh round has nothing matched')
assert(round.cards.every((c) => !isCardFaceUp(round, c)), 'every card starts face down')

function findByLabel(label: string) {
  return round.cards.find((c) => c.label === label)!
}

console.log('\n== Flipping cards: classic two-at-a-time rules ==')
let puli = findByLabel('puli')
assert(canFlip(round, puli.id), 'a fresh card can be flipped')
round = flipCard(round, puli.id)
assert(round.flippedCardIds.includes(puli.id), 'flipping a card adds it to flippedCardIds')
assert(isCardFaceUp(round, puli), 'a flipped card reports face up')

let tiger = findByLabel('tiger')
round = flipCard(round, tiger.id)
assert(round.flippedCardIds.length === 2, 'flipping a second card brings the flipped count to 2')

let naai = findByLabel('naai')
assert(!canFlip(round, naai.id), 'a third card cannot be flipped while two are already face up awaiting resolution')
const beforeThirdFlip = round
round = flipCard(round, naai.id)
assert(round === beforeThirdFlip, 'attempting to flip a third card is a no-op')

console.log('\n== Resolving a correct pair ==')
round = resolveFlippedPair(round)
assert(round.flippedCardIds.length === 0, 'resolving clears the flipped selection')
assert(round.matchedPairIds.includes(puli.pairId), 'a correct pair is recorded as matched')
assert(round.moves === 1, 'resolving counts as one move')
assert(round.currentStreak === 1, 'a correct match grows the streak')
assert(isCardFaceUp(round, puli), 'a matched card stays permanently face up')
round = acknowledgeAttempt(round)

console.log('\n== A matched card can never be flipped again ==')
assert(!canFlip(round, puli.id), 'an already-matched card cannot be flipped')
assert(!canFlip(round, tiger.id), "matching's other half also can't be flipped again")

console.log('\n== Resolving an incorrect pair: mismatch never destroys prior progress ==')
let yaanai = findByLabel('yaanai')
let dog = findByLabel('dog')
round = flipCard(round, yaanai.id)
round = flipCard(round, dog.id)
const matchedBeforeMismatch = [...round.matchedPairIds]
round = resolveFlippedPair(round)
assert(round.flippedCardIds.length === 0, 'a resolved mismatch also clears the flipped selection (both flip back down)')
assert(!round.matchedPairIds.includes(yaanai.pairId), 'a mismatched pair is never recorded as matched')
assert(JSON.stringify(round.matchedPairIds) === JSON.stringify(matchedBeforeMismatch), 'a mismatch never removes an already-matched pair -- prior progress is untouched')
assert(round.moves === 2, 'a mismatch still counts as a move')
assert(round.currentStreak === 0, 'a mismatch resets the streak')
assert(round.lastAttempt?.correct === false, 'lastAttempt reflects the incorrect outcome')
assert(!isCardFaceUp(round, yaanai), 'after resolution, a mismatched card is face down again (not matched, not currently flipped)')
round = acknowledgeAttempt(round)
assert(round.lastAttempt === null, 'acknowledging clears the one-shot flag')

console.log('\n== Re-attempting and completing the round ==')
round = flipCard(round, yaanai.id)
let elephant = findByLabel('elephant')
round = flipCard(round, elephant.id)
round = resolveFlippedPair(round)
assert(round.matchedPairIds.includes(yaanai.pairId), 'the actual yaanai/elephant pair resolves correctly on retry')
round = acknowledgeAttempt(round)

round = flipCard(round, dog.id)
let naaiCard = findByLabel('naai')
round = flipCard(round, naaiCard.id)
round = resolveFlippedPair(round)
assert(isRoundComplete(round), 'matching every pair completes the round')
assert(round.matchedPairIds.length === 3, 'all 3 pairs are recorded as matched')
assert(round.moves === 4, 'the full round took exactly 4 resolved moves (1 correct, 1 wrong, 2 correct)')

console.log('\n== Submission reuses the existing MATCH grading contract exactly ==')
const submission = buildRoundSubmission(round)
assert(submission['puli'] === 'tiger', 'the submission maps each left label to its matched right label')
assert(submission['yaanai'] === 'elephant', 'the submission includes every matched pair')
assert(Object.keys(submission).length === 3, 'the submission has exactly one entry per matched pair')

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
