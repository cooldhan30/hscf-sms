// Standalone verification script for Matching's pure round/difficulty
// logic (lib/gameRoomV2/matching/*). Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script. Covers: round creation
// from a STRIPPED MATCH payload (left/right shuffled independently, as
// /state sends them), tap-to-pair claims resolved by a server-style pair
// oracle, moves/mistakes/streak, completion, the first-try submission
// graded by the existing MATCH grader, star ratings, and
// difficulty-driven progressive round scaling.
//
// Run with: npx tsx scripts/verify-gameroom-v2-matching.ts

import {
  createMatchingRound,
  isRoundComplete,
  totalPairs,
  selectCard,
  pendingLabels,
  resolveAttempt,
  cancelAttempt,
  acknowledgeAttempt,
  buildRoundSubmission,
  matchingStars,
  type MatchingRoundState,
} from '../lib/gameRoomV2/matching/round'
import { isPairInMatchPayload, PAIR_CHECK_ENGINES } from '../lib/gameRoomV2/matching/pairCheck'
import { MATCHING_DIFFICULTY_SETTINGS, getMatchingDifficultySettings, roundTimeLimitForIndex } from '../lib/gameRoomV2/matching/difficulty'
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

// The authored question, and what /state actually sends: each side
// shuffled on its own (so left[i] and right[i] are NOT a pair).
const PAYLOAD = {
  pairs: [
    { left: 'puli', right: 'tiger' },
    { left: 'yaanai', right: 'elephant' },
    { left: 'naai', right: 'dog' },
    { left: 'poonai', right: 'cat' },
  ],
}
const LEFT = shuffledOptionsFor(PAYLOAD.pairs.map((p) => p.left), 'salt:s1:q1:left')
const RIGHT = shuffledOptionsFor(PAYLOAD.pairs.map((p) => p.right), 'salt:s1:q1:right')
assert(
  LEFT.some((l, i) => !isPairInMatchPayload(PAYLOAD, l, RIGHT[i])),
  'fixture: the independently shuffled sides are NOT index-aligned (the old engine wrongly assumed they were)'
)

const oracle = (r: MatchingRoundState) => {
  const l = pendingLabels(r)!
  return isPairInMatchPayload(PAYLOAD, l.left, l.right)
}
const card = (r: MatchingRoundState, label: string) => r.cards.find((c) => c.label === label)!
function claim(r: MatchingRoundState, a: string, b: string) {
  r = selectCard(r, card(r, a).id)
  r = selectCard(r, card(r, b).id)
  return resolveAttempt(r, oracle(r))
}

console.log('== Round creation ==')
let round = createMatchingRound(LEFT, RIGHT, 'verify-seed-1')
assert(round.cards.length === 8 && totalPairs(round) === 4, 'a 4-pair MATCH payload creates an 8-card round')
assert(round.cards.every((c) => !('pairId' in c)), 'cards carry no client-side pair identity (the client cannot know the pairs)')
assert(round.matchedCardIds.length === 0 && round.moves === 0, 'a fresh round starts with nothing matched and zero moves')
assert(!isRoundComplete(round), 'a fresh round is not complete')

console.log('\n== Selecting and claiming ==')
round = selectCard(round, card(round, 'puli').id)
assert(round.selectedCardId === card(round, 'puli').id, 'the first tap selects a card')
round = selectCard(round, card(round, 'naai').id)
assert(round.selectedCardId === card(round, 'naai').id && !round.pending, 'tapping another card on the SAME side switches the selection (a pair is one of each side)')
round = selectCard(round, card(round, 'naai').id)
assert(round.selectedCardId === null, 'tapping the selected card again deselects it')
round = selectCard(round, card(round, 'puli').id)
round = selectCard(round, card(round, 'tiger').id)
assert(!!round.pending && pendingLabels(round)?.left === 'puli' && pendingLabels(round)?.right === 'tiger', 'a left + right tap becomes a pending claim for the server to check')
const frozen = selectCard(round, card(round, 'yaanai').id)
assert(frozen === round, 'taps are ignored while a claim is being checked')
round = resolveAttempt(round, oracle(round))
assert(round.matchedCardIds.length === 2 && round.pairs['puli'] === 'tiger', 'a pair the server confirms is locked in')
assert(round.lastAttempt?.correct === true && round.currentStreak === 1, 'correct claim: feedback + streak')

console.log('\n== A wrong claim ==')
round = claim(round, 'yaanai', 'dog')
assert(!round.pairs['yaanai'] && round.matchedCardIds.length === 2, 'a pair the server rejects is never matched')
assert(round.mistakes === 1 && round.currentStreak === 0 && round.lastAttempt?.correct === false, 'a mix-up counts, breaks the streak, and flashes red')
round = acknowledgeAttempt(round)
assert(round.lastAttempt === null, 'acknowledging clears the one-shot feedback')
round = selectCard(round, card(round, 'puli').id)
assert(round.selectedCardId === null, 'an already-matched card cannot be selected again')
round = selectCard(round, card(round, 'naai').id)
round = selectCard(round, card(round, 'dog').id)
round = cancelAttempt(round)
assert(!round.pending && round.moves === 2, 'a failed check can be cancelled without counting a move')

console.log('\n== Completion and the first-try submission ==')
round = claim(round, 'yaanai', 'elephant')
round = claim(round, 'naai', 'dog')
round = claim(round, 'poonai', 'cat')
assert(isRoundComplete(round), 'finding every pair completes the round')
const submission = buildRoundSubmission(round)
assert(Object.keys(submission).length === 4, 'the submission has one entry per left card')
assert(submission['yaanai'] === 'dog', "each left card's FIRST claim is what gets submitted")
assert(gradeAnswer('MATCH', PAYLOAD, submission) === false, 'a round solved by trial and error is graded wrong by the existing MATCH grader')
let clean = createMatchingRound(LEFT, RIGHT, 'verify-seed-2')
for (const p of PAYLOAD.pairs) clean = claim(clean, p.left, p.right)
assert(isRoundComplete(clean) && clean.mistakes === 0, 'a clean round: every pair right first time')
assert(gradeAnswer('MATCH', PAYLOAD, buildRoundSubmission(clean)) === true, 'a clean round is graded correct by the existing MATCH grader, unchanged')

console.log('\n== Stars (in-match only) ==')
assert(matchingStars(0, false) === 3, 'perfect and in time: 3 stars')
assert(matchingStars(1, false) === 2 && matchingStars(0, true) === 2, 'one slip, or perfect but over time: 2 stars')
assert(matchingStars(3, true) === 1, 'otherwise: 1 star')

console.log('\n== Pair checks are server-side and narrowly scoped ==')
assert(isPairInMatchPayload(PAYLOAD, 'puli', 'tiger') && !isPairInMatchPayload(PAYLOAD, 'puli', 'dog'), 'the pair oracle answers from the authored pairs')
assert(!isPairInMatchPayload({}, 'a', 'b') && !isPairInMatchPayload(null, 'a', 'b'), 'a malformed payload never reports a pair')
assert(PAIR_CHECK_ENGINES.length === 2 && PAIR_CHECK_ENGINES.includes('matching') && PAIR_CHECK_ENGINES.includes('memory'), 'only Matching and Memory sessions may check pairs')

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
