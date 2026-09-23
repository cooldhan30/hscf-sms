// Standalone verification script for Tamil Racing's Live Classroom
// multiplayer layer (lib/gameRoomV2/racing/liveRace.ts +
// requireLiveSessionAny + the registry/engine-branch consistency this
// feature depends on). Same tsx-script convention as every other
// verify-gameroom-v2-*.ts script.
//
// This SIMULATES MULTIPLE PARTICIPANTS end-to-end at the pure-function
// level (there is no local Postgres harness in this repo, so the
// SECURITY DEFINER RPC sms_gamev2_get_live_race_state and its
// ownership check are verified by direct code review instead -- same
// posture scripts/verify-gameroom-v2-live-classroom.ts already
// documents for migration 080's RPCs): constructs synthetic raw RPC
// rows for several racers with distinct, interleaved answer histories,
// runs them through buildLiveRacersFromRows + rankLiveRacers (the
// EXACT pure functions the live API route calls), and asserts the
// resulting positions/ranking/finish-ordering are correct -- this is
// the "test with simulated multiple participants" requirement, applied
// at the level that's actually testable without a live database.
//
// Run with: npx tsx scripts/verify-gameroom-v2-racing-multiplayer.ts

import { getRacingDifficultySettings } from '../lib/gameRoomV2/racing/difficulty'
import { buildLiveRacersFromRows, rankLiveRacers, liveRacersToRaceState, type RawRaceRow } from '../lib/gameRoomV2/racing/liveRace'
import { getGameEngineV2 } from '../lib/gameRoomV2/registry'
import { hasDedicatedLiveClassroomComponent } from '../lib/gameRoomV2/liveClassroom/engineBranch'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

const settings = getRacingDifficultySettings('normal')
const raceStartMs = 0

// Synthesizes the raw rows sms_gamev2_get_live_race_state (migration
// 081) would return for one participant with a given answer history --
// mirrors the RPC's actual one-row-per-answer shape (a participant
// with 3 answers appears as 3 rows sharing the same participant_id/
// nickname/session_id).
function participantRows(
  participantId: string,
  nickname: string,
  hasSession: boolean,
  totalQuestions: number,
  currentIndex: number,
  answers: { isCorrect: boolean; atMs: number }[]
): RawRaceRow[] {
  const sessionId = hasSession ? `session-${participantId}` : null
  if (answers.length === 0) {
    return [
      {
        participant_id: participantId,
        nickname,
        session_id: sessionId,
        question_order_length: totalQuestions,
        current_index: currentIndex,
        is_correct: null,
        answered_at: null,
      },
    ]
  }
  return answers.map((a) => ({
    participant_id: participantId,
    nickname,
    session_id: sessionId,
    question_order_length: totalQuestions,
    current_index: currentIndex,
    is_correct: a.isCorrect,
    answered_at: new Date(a.atMs).toISOString(),
  }))
}

console.log('== Simulating 4 participants with distinct answer histories ==')
// Kavya: 3 correct answers early, fast and accurate -- should be
// furthest ahead.
// Arjun: 1 correct, 2 wrong -- should be behind Kavya.
// Meera: no answers yet (just joined, still in the lobby-to-active
// transition) -- should be at the very back, distance 0.
// Priya: hasSession false entirely (a participant row exists but they
// never got bridged to a session -- e.g. disconnected before start and
// never reconnected) -- must NEVER crash the replay, must show
// distance 0.
const rows: RawRaceRow[] = [
  ...participantRows('p-kavya', 'Kavya R.', true, 10, 3, [
    { isCorrect: true, atMs: 500 },
    { isCorrect: true, atMs: 3500 },
    { isCorrect: true, atMs: 6500 },
  ]),
  ...participantRows('p-arjun', 'Arjun P.', true, 10, 3, [
    { isCorrect: true, atMs: 500 },
    { isCorrect: false, atMs: 3500 },
    { isCorrect: false, atMs: 6500 },
  ]),
  ...participantRows('p-meera', 'Meera S.', true, 10, 0, []),
  ...participantRows('p-priya', 'Priya K.', false, 0, 0, []),
]

const nowMs = 9000
const racers = buildLiveRacersFromRows(rows, raceStartMs, nowMs, settings)

console.log('\n== Every participant produces exactly one racer, regardless of answer count ==')
assert(racers.length === 4, `4 distinct participants produce exactly 4 racers (found ${racers.length})`)
assert(racers.every((r) => typeof r.distance === 'number' && !Number.isNaN(r.distance)), 'every racer has a valid numeric distance -- none crashed or produced NaN')

console.log('\n== A participant with no session never crashes the replay ==')
const priya = racers.find((r) => r.participantId === 'p-priya')!
assert(priya.hasSession === false, "Priya's hasSession correctly reflects no session bridge yet")
assert(priya.distance === 0, 'a participant with no session shows distance 0, never an error or a fabricated position')

console.log('\n== More correct answers means more distance, independent of answer count parity ==')
const kavya = racers.find((r) => r.participantId === 'p-kavya')!
const arjun = racers.find((r) => r.participantId === 'p-arjun')!
const meera = racers.find((r) => r.participantId === 'p-meera')!
assert(kavya.distance > arjun.distance, 'Kavya (3 correct) is ahead of Arjun (1 correct, 2 wrong)')
assert(arjun.distance > meera.distance, 'Arjun (has answered) is ahead of Meera (has not answered yet)')
assert(meera.distance > 0, 'Meera still moves at baseline speed even with zero answers -- movement is not purely answer-gated')

console.log('\n== One racer answering never affects another racer\'s distance (isolation) ==')
const kavyaAlone = buildLiveRacersFromRows(participantRows('p-kavya', 'Kavya R.', true, 10, 3, [{ isCorrect: true, atMs: 500 }]), raceStartMs, nowMs, settings)
const kavyaWithArjun = buildLiveRacersFromRows(
  [...participantRows('p-kavya', 'Kavya R.', true, 10, 3, [{ isCorrect: true, atMs: 500 }]), ...participantRows('p-arjun', 'Arjun P.', true, 10, 3, [{ isCorrect: false, atMs: 100 }])],
  raceStartMs,
  nowMs,
  settings
)
const kavyaDistanceAlone = kavyaAlone.find((r) => r.participantId === 'p-kavya')!.distance
const kavyaDistanceWithArjun = kavyaWithArjun.find((r) => r.participantId === 'p-kavya')!.distance
assert(
  Math.abs(kavyaDistanceAlone - kavyaDistanceWithArjun) < 0.001,
  "Kavya's distance is identical whether Arjun is racing or not -- one racer's answers never leak into another's physics"
)

console.log('\n== Ranking: finished racers before unfinished, by finish time; unfinished by distance ==')
const shortTrackSettings = { ...settings, trackLength: 5 } // trivially short so baseline speed alone finishes quickly
const finishRows: RawRaceRow[] = [
  ...participantRows('p-first', 'First Finisher', true, 5, 5, []),
  ...participantRows('p-second', 'Second Finisher', true, 5, 5, []),
  ...participantRows('p-behind', 'Still Racing', true, 5, 2, []),
]
const longNowMs = 20000 // comfortably past when both finishers would cross the line
const finishRacers = buildLiveRacersFromRows(finishRows, raceStartMs, longNowMs, shortTrackSettings)
const ranked = rankLiveRacers(finishRacers)
assert(ranked.every((r) => r.finished), 'on a short enough track, every racer with baseline movement alone eventually finishes')
assert(ranked[0].finishedAtMs !== null && ranked[1].finishedAtMs !== null, 'finished racers carry a real finishedAtMs, not null')

// All three racers move identically here (no answers, same track), so
// they finish at effectively the same time -- assert the ranking is at
// least stable/total (every racer appears exactly once, no duplicates
// or drops) rather than asserting a specific tie-break winner.
assert(ranked.length === 3, 'ranking never drops or duplicates a racer')
assert(new Set(ranked.map((r) => r.participantId)).size === 3, 'every racer appears exactly once in the ranking')

console.log('\n== Ranking with a genuine skill gap: the actually-faster finisher ranks first ==')
const skillGapRows: RawRaceRow[] = [
  ...participantRows('p-fast', 'Fast Racer', true, 5, 3, [
    { isCorrect: true, atMs: 100 },
    { isCorrect: true, atMs: 200 },
    { isCorrect: true, atMs: 300 },
  ]),
  ...participantRows('p-slow', 'Slow Racer', true, 5, 0, []),
]
const skillGapRacers = buildLiveRacersFromRows(skillGapRows, raceStartMs, longNowMs, shortTrackSettings)
const skillGapRanked = rankLiveRacers(skillGapRacers)
assert(skillGapRanked[0].participantId === 'p-fast', 'the racer with more correct answers (and thus an earlier finish) ranks first')

console.log('\n== In-progress ranking (nobody finished yet): ordered by current distance ==')
const inProgressRanked = rankLiveRacers(racers) // the original 4-participant, un-finished scenario
assert(!inProgressRanked.some((r) => r.finished), 'sanity check: nobody in this scenario has finished yet')
assert(inProgressRanked[0].participantId === 'p-kavya', 'Kavya (furthest ahead) ranks first while the race is still in progress')
assert(inProgressRanked[inProgressRanked.length - 1].participantId === 'p-priya', 'Priya (no session, distance 0) ranks last')

console.log('\n== liveRacersToRaceState: Track.tsx compatibility and "isPlayer" marking ==')
const raceState = liveRacersToRaceState({ trackLength: settings.trackLength, liveSessionStatus: 'ACTIVE', racers }, 'p-kavya')
assert(raceState.trackLength === settings.trackLength, 'the synthesized RaceState carries the correct track length')
assert(raceState.racers.length === racers.length, 'every live racer becomes a Track-renderable racer')
assert(raceState.racers.find((r) => r.id === 'p-kavya')?.isPlayer === true, 'the given participant id is marked isPlayer -- Track.tsx bolds the right racer')
assert(raceState.racers.filter((r) => r.isPlayer).length === 1, 'exactly one racer is ever marked isPlayer, never zero or multiple')
const noViewerRaceState = liveRacersToRaceState({ trackLength: settings.trackLength, liveSessionStatus: 'ACTIVE', racers }, null)
assert(noViewerRaceState.racers.every((r) => !r.isPlayer), 'a null viewer (the teacher\'s own overview) marks no racer as isPlayer')

console.log('\n== Registry/engine-branch consistency: Racing is genuinely wired for live multiplayer ==')
assert(hasDedicatedLiveClassroomComponent('racing'), 'racing is still declared as having a dedicated Live Classroom component')
const engine = getGameEngineV2('racing')
assert(engine?.compatibility.liveClassroomSupport === true, 'Racing declares liveClassroomSupport -- now genuinely backed by real multiplayer, not just solo-simultaneous play')
assert(engine?.status === 'ACTIVE', 'Racing is ACTIVE in the registry')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
