// Standalone verification script for Matching's pure round/difficulty
// logic (lib/gameRoomV2/matching/*). Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script. Covers: round creation
// from a MATCH payload, tap-to-pair selection (correct/incorrect
// resolution, moves counter, streak), round completion, submission
// building (must exactly reuse the existing MATCH grading contract),
// and difficulty-driven progressive round scaling.
//
// Run with: npx tsx scripts/verify-gameroom-v2-matching.ts

import {
  createMatchingRound,
  isRoundComplete,
  selectCard,
  acknowledgeAttempt,
  buildRoundSubmission,
} from '../lib/gameRoomV2/matching/round'
import { MATCHING_DIFFICULTY_SETTINGS, getMatchingDifficultySettings, roundTimeLimitForIndex } from '../lib/gameRoomV2/matching/difficulty'
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

console.log('== Round creation ==')
let round = createMatchingRound(LEFT, RIGHT, 'verify-seed-1')
assert(round.cards.length === 6, 'a 3-pair MATCH payload creates a 6-card round')
assert(round.matchedPairIds.length === 0, 'a fresh round starts with nothing matched')
assert(round.moves === 0, 'a fresh round starts with zero moves')
assert(!isRoundComplete(round), 'a fresh round is not complete')

console.log('\n== Correct pair selection ==')
const puliCard = round.cards.find((c) => c.label === 'puli')!
const tigerCard = round.cards.find((c) => c.label === 'tiger')!
round = selectCard(round, puliCard.id)
assert(round.selectedCardId === puliCard.id, 'the first tap selects a card')
round = selectCard(round, tigerCard.id)
assert(round.selectedCardId === null, 'resolving an attempt clears the selection')
assert(round.matchedPairIds.includes(puliCard.pairId), 'a correct pair is recorded as matched')
assert(round.moves === 1, 'each resolved attempt counts as one move')
assert(round.currentStreak === 1, 'a correct match grows the streak')
assert(round.lastAttempt?.correct === true, 'lastAttempt reflects the correct outcome')

console.log('\n== Incorrect pair selection ==')
const yaanaiCard = round.cards.find((c) => c.label === 'yaanai')!
const dogCard = round.cards.find((c) => c.label === 'dog')!
round = selectCard(round, yaanaiCard.id)
round = selectCard(round, dogCard.id)
assert(!round.matchedPairIds.includes(yaanaiCard.pairId), 'an incorrect pair is never recorded as matched')
assert(round.moves === 2, 'an incorrect attempt still counts as a move')
assert(round.currentStreak === 0, 'an incorrect attempt resets the streak')
assert(round.lastAttempt?.correct === false, 'lastAttempt reflects the incorrect outcome')
round = acknowledgeAttempt(round)
assert(round.lastAttempt === null, 'acknowledging an attempt clears the one-shot flag')

console.log('\n== Reselecting a card ==')
round = selectCard(round, yaanaiCard.id)
round = selectCard(round, yaanaiCard.id)
assert(round.selectedCardId === null, 'tapping the same card twice deselects it instead of resolving an attempt')

console.log('\n== An already-matched card cannot be reselected ==')
const beforeReselect = round
round = selectCard(round, puliCard.id)
assert(round === beforeReselect, 'selecting an already-matched card is a no-op')

console.log('\n== Full round completion ==')
const elephantCard = round.cards.find((c) => c.label === 'elephant')!
const naaiCard = round.cards.find((c) => c.label === 'naai')!
round = selectCard(round, yaanaiCard.id)
round = selectCard(round, elephantCard.id)
assert(round.matchedPairIds.includes(yaanaiCard.pairId), 'the actual yaanai/elephant pair resolves correctly')
round = selectCard(round, dogCard.id)
round = selectCard(round, naaiCard.id)
assert(isRoundComplete(round), 'matching every pair completes the round')
assert(round.matchedPairIds.length === 3, 'all 3 pairs are recorded as matched')

console.log('\n== Submission reuses the existing MATCH grading contract exactly ==')
const submission = buildRoundSubmission(round)
assert(submission['puli'] === 'tiger', 'the submission maps each left label to its matched right label')
assert(submission['yaanai'] === 'elephant', 'the submission includes every matched pair')
assert(Object.keys(submission).length === 3, 'the submission has exactly one entry per matched pair')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(MATCHING_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Casual/Quick/Speedster)')
const casual = getMatchingDifficultySettings('casual')
const speedster = getMatchingDifficultySettings('speedster')
assert(casual.roundTimeLimitSeconds === null, 'Casual has no round timer')
assert(speedster.roundTimeLimitSeconds !== null, 'Speedster has a round timer')
assert(speedster.streakBonusPerStep > casual.streakBonusPerStep, 'Speedster grants a bigger streak bonus than Casual')

console.log('\n== Progressively harder rounds ==')
const quick = getMatchingDifficultySettings('quick')
const round0Limit = roundTimeLimitForIndex(quick, 0)
const round3Limit = roundTimeLimitForIndex(quick, 3)
assert(round0Limit !== null && round3Limit !== null, 'a timed difficulty always returns a numeric limit')
assert(round3Limit! < round0Limit!, 'a later round has a tighter time limit than an earlier round -- rounds get progressively harder')
assert(roundTimeLimitForIndex(quick, 100)! >= 12, 'the time limit never drops below a usable floor, no matter how many rounds have passed')
assert(roundTimeLimitForIndex(casual, 5) === null, "Casual's null timer is unaffected by round progression -- there is nothing to tighten")

console.log('\n== Registry: Matching has a real, testable engine behind it ==')
const engine = getGameEngineV2('matching')
assert(engine !== undefined, 'matching is registered')
assert(engine?.status === 'ACTIVE', 'Matching is ACTIVE, genuinely playable')
assert(engine?.compatibility.soloSupport === true, 'Matching supports solo play')
assert(engine?.compatibility.supportedQuestionTypes.includes('MATCH') === true, 'Matching supports MATCH questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
