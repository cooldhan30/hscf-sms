// Standalone verification script for the GameRoom V2 shared gameplay
// framework hardening pass: the pure, DOM-free helpers backing
// useGameSessionState.ts (lib/gameRoomV2/gameplay/sessionPolling.ts).
// The hook itself is React-coupled (poll/interval/effect timing) and
// is exercised indirectly through the 6 engines it now powers; this
// script covers the pure logic it delegates to -- exactly the part
// worth asserting on without a DOM. Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script (no formal test
// framework exists in this repo).
//
// Run with: npx tsx scripts/verify-gameroom-v2-shared-framework.ts

import { buildGameResult, pauseToggleEndpoint, shouldAbandonOnExit } from '../lib/gameRoomV2/gameplay/sessionPolling'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== buildGameResult: shapes the /complete response into a GameResult, responses always empty ==')
const completePayload = {
  sessionId: 'session-1',
  score: 1200,
  accuracyPct: 80,
  correctCount: 8,
  incorrectCount: 2,
  totalQuestions: 10,
  xpEarned: 120,
  coinsEarned: 24,
  bestStreak: 5,
  skillsPracticed: ['Grammar', 'Thinai'],
}
const built = buildGameResult(completePayload)
assert(
  Array.isArray(built.newlyEarnedAchievementIds) && built.newlyEarnedAchievementIds.length === 0,
  'newlyEarnedAchievementIds defaults to an empty array when the raw payload omits it (older callers / already-finalized re-fetch)'
)

const builtWithAchievements = buildGameResult({ ...completePayload, newlyEarnedAchievementIds: ['first-game', 'ten-correct'] })
assert(
  JSON.stringify(builtWithAchievements.newlyEarnedAchievementIds) === JSON.stringify(['first-game', 'ten-correct']),
  'newlyEarnedAchievementIds is passed through unchanged when present -- this is what the game-feel pass wires the achievement sound/badge display to'
)
assert(built.sessionId === completePayload.sessionId, 'sessionId passed through unchanged')
assert(built.score === completePayload.score, 'score passed through unchanged, never recomputed client-side')
assert(built.accuracyPct === completePayload.accuracyPct, 'accuracyPct passed through unchanged')
assert(built.correctCount === completePayload.correctCount, 'correctCount passed through unchanged')
assert(built.incorrectCount === completePayload.incorrectCount, 'incorrectCount passed through unchanged')
assert(built.totalQuestions === completePayload.totalQuestions, 'totalQuestions passed through unchanged')
assert(built.xpEarned === completePayload.xpEarned, 'xpEarned passed through unchanged')
assert(built.coinsEarned === completePayload.coinsEarned, 'coinsEarned passed through unchanged')
assert(built.bestStreak === completePayload.bestStreak, 'bestStreak passed through unchanged')
assert(
  JSON.stringify(built.skillsPracticed) === JSON.stringify(completePayload.skillsPracticed),
  'skillsPracticed passed through unchanged'
)
assert(Array.isArray(built.responses) && built.responses.length === 0, 'responses is always an empty array -- never recomputed/fabricated client-side')

console.log('\n== shouldAbandonOnExit: only the two terminal statuses skip the /abandon call ==')
assert(shouldAbandonOnExit('CREATED') === true, 'CREATED still needs abandon on exit')
assert(shouldAbandonOnExit('READY') === true, 'READY still needs abandon on exit')
assert(shouldAbandonOnExit('ACTIVE') === true, 'ACTIVE still needs abandon on exit')
assert(shouldAbandonOnExit('PAUSED') === true, 'PAUSED still needs abandon on exit')
assert(shouldAbandonOnExit('COMPLETED') === false, 'COMPLETED must never be abandoned again')
assert(shouldAbandonOnExit('ABANDONED') === false, 'ABANDONED must never be abandoned again')
assert(shouldAbandonOnExit(undefined) === false, 'no session loaded yet -- nothing to abandon')

console.log('\n== pauseToggleEndpoint: toggles to the opposite of the current status ==')
assert(pauseToggleEndpoint('ACTIVE') === 'pause', 'ACTIVE session toggles to pause')
assert(pauseToggleEndpoint('READY') === 'pause', 'any non-PAUSED status toggles to pause')
assert(pauseToggleEndpoint('PAUSED') === 'resume', 'PAUSED session toggles to resume')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
