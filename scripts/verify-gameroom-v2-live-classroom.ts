// Standalone verification script for GameRoom V2 Live Classroom's pure
// domain logic (lib/gameRoomV2/liveClassroom/*): nickname privacy,
// presence/staleness detection, and join-code normalization. Same
// tsx-script convention as every other verify-gameroom-v2-*.ts script.
//
// Run with: npx tsx scripts/verify-gameroom-v2-live-classroom.ts

import { deriveLiveNickname } from '../lib/gameRoomV2/liveClassroom/nickname'
import { isPresenceStale, isPresentlyConnected } from '../lib/gameRoomV2/liveClassroom/presence'
import { normalizeJoinCode } from '../lib/gameRoomV2/liveClassroom/joinCode'
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

console.log('\n== Registry: liveClassroomSupport is exactly what this phase implements ==')
// Per the explicit "first implement and test using a simple game mode,
// do not immediately retrofit every game" instruction, only
// classic-quiz is actually wired to Live Classroom infrastructure this
// pass -- racing/boss-battle already DECLARE liveClassroomSupport:true
// (a promise made ahead of this infrastructure existing) but aren't
// integrated yet.
assert(getGameEngineV2('classic-quiz')?.compatibility.liveClassroomSupport === true, 'Classic Quiz declares live classroom support -- the engine this phase actually integrates')
const liveCapableEngines = GAME_ENGINES_V2.filter((e) => e.compatibility.liveClassroomSupport)
assert(liveCapableEngines.length >= 3, `at least 3 engines declare liveClassroomSupport (classic-quiz + racing + boss-battle promised ahead of implementation) -- found ${liveCapableEngines.length}`)
assert(!getGameEngineV2('tower-defense')?.compatibility.liveClassroomSupport, 'Tower Defense correctly does NOT declare live classroom support (solo-only engine)')
assert(!getGameEngineV2('word-ninja')?.compatibility.liveClassroomSupport, 'Word Ninja correctly does NOT declare live classroom support (solo-only engine)')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
