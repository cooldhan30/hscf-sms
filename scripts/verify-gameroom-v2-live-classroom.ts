// Standalone verification script for GameRoom V2 Live Classroom's pure
// domain logic (lib/gameRoomV2/liveClassroom/*): nickname privacy,
// presence/staleness detection, join-code normalization, engine
// branching, and the full session-status state machine. Same
// tsx-script convention as every other verify-gameroom-v2-*.ts script.
//
// This is NOT a database-integration test -- there is no local Postgres
// harness in this repo, so the SECURITY DEFINER RPC ownership checks
// added in migration 080 (sms_gamev2_{start,pause,resume,end}
// _live_session, sms_gamev2_join_active_live_session) cannot be
// exercised here. Their SQL is verified by direct code review (see
// docs/gameroom-v2-completion-plan.md's Phase 0 entry) instead; what
// THIS script verifies is every pure TypeScript rule the API routes
// and client components actually call into, so a regression in the
// state-machine logic itself is caught without needing a live database.
//
// Run with: npx tsx scripts/verify-gameroom-v2-live-classroom.ts

import { deriveLiveNickname } from '../lib/gameRoomV2/liveClassroom/nickname'
import { isPresenceStale, isPresentlyConnected } from '../lib/gameRoomV2/liveClassroom/presence'
import { normalizeJoinCode } from '../lib/gameRoomV2/liveClassroom/joinCode'
import { LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS, hasDedicatedLiveClassroomComponent } from '../lib/gameRoomV2/liveClassroom/engineBranch'
import {
  canJoinByCode,
  requiresLateJoinBridge,
  canStart,
  canPause,
  canResume,
  canEnd,
  shouldRenderGameplay,
  isLiveSessionStale,
  type LiveSessionStatus,
} from '../lib/gameRoomV2/liveClassroom/lifecycle'
import { GAME_ENGINES_V2, getGameEngineV2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Nickname privacy: first name + last initial only, never full last name ==')
assert(deriveLiveNickname('Kavya', 'Ramachandran') === 'Kavya R.', 'a full name derives to first name + last initial, never the full last name')
assert(!deriveLiveNickname('Kavya', 'Ramachandran').includes('Ramachandran'), 'the full last name never appears in the derived nickname')
assert(deriveLiveNickname('Kavya', null) === 'Kavya', 'a missing last name still produces a usable nickname (first name alone)')
assert(deriveLiveNickname(null, null) === 'Player', 'missing both names falls back to a generic, non-empty placeholder, never a blank nickname')
assert(deriveLiveNickname('  Arjun  ', '  Pillai  ') === 'Arjun P.', 'incidental whitespace in profile fields is trimmed')

console.log('\n== Presence: tolerant of brief gaps, catches genuinely stale clients ==')
const now = Date.now()
assert(!isPresenceStale(new Date(now - 2000).toISOString(), now), 'a heartbeat 2 seconds ago is not stale -- tolerates normal poll cadence')
assert(isPresenceStale(new Date(now - 30_000).toISOString(), now), 'a heartbeat 30 seconds ago IS stale -- catches a genuinely vanished client')
assert(
  isPresentlyConnected({ connected: true, lastSeenAt: new Date(now - 2000).toISOString() }, now),
  'connected=true with a fresh heartbeat is presently connected'
)
assert(
  !isPresentlyConnected({ connected: true, lastSeenAt: new Date(now - 60_000).toISOString() }, now),
  'connected=true with a STALE heartbeat is NOT presently connected -- the flag alone is not enough'
)
assert(
  !isPresentlyConnected({ connected: false, lastSeenAt: new Date(now).toISOString() }, now),
  'connected=false is never presently connected even with a fresh heartbeat timestamp -- an explicit leave always wins'
)

console.log('\n== Join code normalization ==')
assert(normalizeJoinCode('abcd1234') === 'ABCD1234', 'a lowercase-typed code is uppercased before use')
assert(normalizeJoinCode('  ABCD1234  ') === 'ABCD1234', 'incidental whitespace around a pasted code is trimmed')

console.log('\n== Engine branching: the pure source of truth LivePlayClient.tsx maps to real components ==')
assert(LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS.includes('racing'), 'racing has a dedicated Live Classroom play component (RacingGame)')
assert(LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS.includes('boss-battle'), 'boss-battle has a dedicated Live Classroom play component (BossBattleGame)')
assert(hasDedicatedLiveClassroomComponent('racing'), 'hasDedicatedLiveClassroomComponent agrees for racing')
assert(hasDedicatedLiveClassroomComponent('boss-battle'), 'hasDedicatedLiveClassroomComponent agrees for boss-battle')
assert(!hasDedicatedLiveClassroomComponent('classic-quiz'), 'classic-quiz has NO dedicated component -- it IS the GameSessionRuntime fallback, which is correct, not a gap')
assert(!hasDedicatedLiveClassroomComponent('tower-defense'), 'tower-defense has no dedicated Live Classroom component (not integrated this pass)')
assert(!hasDedicatedLiveClassroomComponent('word-ninja'), 'word-ninja has no dedicated Live Classroom component (not integrated this pass)')

console.log('\n== Registry: liveClassroomSupport is exactly what is actually integrated ==')
// Every engine declaring liveClassroomSupport: true must be either
// classic-quiz (the GameSessionRuntime fallback engine) or have a real
// dedicated component per engineBranch.ts -- the exact guarantee that
// closes the Phase 1 registry/reality mismatch: a teacher hosting a
// live session for ANY liveClassroomSupport:true engine now gets that
// engine's REAL play experience, never a silent fallback to the
// generic quiz UI for an engine that promised something else.
const liveCapableEngines = GAME_ENGINES_V2.filter((e) => e.compatibility.liveClassroomSupport)
assert(liveCapableEngines.length === 3, `exactly 3 engines declare liveClassroomSupport (classic-quiz, racing, boss-battle) -- found ${liveCapableEngines.length}`)
for (const engine of liveCapableEngines) {
  const isFallbackEngine = engine.id === 'classic-quiz'
  const hasRealComponent = hasDedicatedLiveClassroomComponent(engine.id)
  assert(
    isFallbackEngine || hasRealComponent,
    `${engine.id}'s liveClassroomSupport claim is backed by a real integration (dedicated component or the classic-quiz fallback), never a Phase-1-style unimplemented promise`
  )
}
assert(getGameEngineV2('classic-quiz')?.compatibility.liveClassroomSupport === true, 'Classic Quiz declares live classroom support')
assert(getGameEngineV2('racing')?.compatibility.liveClassroomSupport === true, 'Racing declares live classroom support')
assert(getGameEngineV2('boss-battle')?.compatibility.liveClassroomSupport === true, 'Boss Battle declares live classroom support')
// "Do not blindly enable every game" -- every other ACTIVE engine
// correctly stays false, since no LivePlayClient.tsx branch (or
// verified session-lifecycle compatibility) exists for them yet.
for (const id of ['tower-defense', 'treasure-quest', 'word-ninja', 'space-mission', 'kingdom-builder', 'mystery-mansion', 'matching', 'memory']) {
  assert(!getGameEngineV2(id)?.compatibility.liveClassroomSupport, `${id} correctly does NOT declare live classroom support (not integrated this pass)`)
}

console.log('\n== Lifecycle state machine: join-code validity ==')
assert(canJoinByCode('LOBBY'), 'a join code works at LOBBY -- the normal case')
assert(canJoinByCode('ACTIVE'), 'a join code works at ACTIVE -- late join')
assert(canJoinByCode('PAUSED'), 'a join code works at PAUSED -- late join while paused')
assert(!canJoinByCode('ENDED'), 'a join code never works at ENDED -- the only status that refuses joining')

console.log('\n== Lifecycle state machine: late-join bridge requirement ==')
assert(!requiresLateJoinBridge('LOBBY'), 'joining during LOBBY does not need the late-join bridge -- the bulk start RPC creates the session row instead')
assert(requiresLateJoinBridge('ACTIVE'), 'joining during ACTIVE requires the late-join bridge RPC')
assert(requiresLateJoinBridge('PAUSED'), 'joining during PAUSED requires the late-join bridge RPC')
assert(!requiresLateJoinBridge('ENDED'), 'ENDED never requires a bridge -- joining is already refused before this matters')

console.log('\n== Lifecycle state machine: host action legality ==')
assert(canStart('LOBBY'), 'Start is legal from LOBBY')
assert(!canStart('ACTIVE'), 'Start is illegal once already ACTIVE')
assert(!canStart('PAUSED'), 'Start is illegal from PAUSED')
assert(!canStart('ENDED'), 'Start is illegal from ENDED')
assert(canPause('ACTIVE'), 'Pause is legal from ACTIVE')
assert(!canPause('LOBBY'), 'Pause is illegal from LOBBY')
assert(!canPause('PAUSED'), 'Pause is illegal from an already-PAUSED session')
assert(!canPause('ENDED'), 'Pause is illegal from ENDED')
assert(canResume('PAUSED'), 'Resume is legal from PAUSED')
assert(!canResume('ACTIVE'), 'Resume is illegal from an already-ACTIVE session')
assert(!canResume('LOBBY'), 'Resume is illegal from LOBBY')
assert(!canResume('ENDED'), 'Resume is illegal from ENDED')
assert(canEnd('LOBBY'), 'End is legal from LOBBY -- a teacher can end before the game even starts')
assert(canEnd('ACTIVE'), 'End is legal from ACTIVE')
assert(canEnd('PAUSED'), 'End is legal from PAUSED')
assert(!canEnd('ENDED'), 'End is illegal on an already-ENDED session')

console.log('\n== Lifecycle state machine: exactly one legal forward transition set per status ==')
// A sanity check that the whole state machine is internally consistent:
// every non-terminal status has SOME legal action, and ENDED has none.
const ALL_STATUSES: LiveSessionStatus[] = ['LOBBY', 'ACTIVE', 'PAUSED', 'ENDED']
for (const status of ALL_STATUSES) {
  const anyActionLegal = canStart(status) || canPause(status) || canResume(status) || canEnd(status)
  if (status === 'ENDED') {
    assert(!anyActionLegal, 'ENDED is a true terminal state -- no host action is ever legal from it')
  } else {
    assert(anyActionLegal, `${status} has at least one legal host action -- no non-terminal status is a dead end`)
  }
}

console.log('\n== Lifecycle state machine: gameplay rendering ==')
assert(shouldRenderGameplay('ACTIVE', true), 'ACTIVE + a bridged sessionId renders gameplay')
assert(shouldRenderGameplay('PAUSED', true), 'PAUSED + a bridged sessionId renders gameplay (frozen board, not a waiting-room screen)')
assert(!shouldRenderGameplay('ACTIVE', false), 'ACTIVE without a sessionId yet does NOT render gameplay -- still the waiting room until the bridge lands')
assert(!shouldRenderGameplay('LOBBY', true), 'LOBBY never renders gameplay even if a sessionId somehow exists')
assert(!shouldRenderGameplay('ENDED', true), 'ENDED never renders gameplay')

console.log('\n== Stale room detection ==')
const nowMs = Date.now()
assert(!isLiveSessionStale('LOBBY', new Date(nowMs - 60_000).toISOString(), nowMs), 'a 1-minute-old LOBBY is not stale')
assert(!isLiveSessionStale('ACTIVE', new Date(nowMs - 60 * 60 * 1000).toISOString(), nowMs), 'a 1-hour-old ACTIVE session (a long but real class period) is not stale')
assert(isLiveSessionStale('LOBBY', new Date(nowMs - 5 * 60 * 60 * 1000).toISOString(), nowMs), 'a 5-hour-old LOBBY the host never started is stale')
assert(isLiveSessionStale('ACTIVE', new Date(nowMs - 5 * 60 * 60 * 1000).toISOString(), nowMs), 'a 5-hour-old ACTIVE session is stale -- the host likely disconnected and never returned')
assert(isLiveSessionStale('PAUSED', new Date(nowMs - 5 * 60 * 60 * 1000).toISOString(), nowMs), 'a 5-hour-old PAUSED session is stale')
assert(!isLiveSessionStale('ENDED', new Date(nowMs - 100 * 60 * 60 * 1000).toISOString(), nowMs), 'ENDED is never stale, no matter how old -- it already reached its real terminal state, staleness is meaningless for it')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
