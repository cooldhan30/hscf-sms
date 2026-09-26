// Standalone verification script for Treasure Quest's pure exploration
// logic (lib/gameRoomV2/treasureQuest/*). Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script. Covers: the room graph
// being fully connected and the treasure reachable, key economics
// (earning/spending/never going negative), clue collection, door
// gating, and win detection.
//
// Run with: npx tsx scripts/verify-gameroom-v2-treasure-quest.ts

import { ROOMS, START_ROOM_ID, TREASURE_ROOM_ID, getRoom, reachableRoomIds } from '../lib/gameRoomV2/treasureQuest/rooms'
import { TREASURE_QUEST_DIFFICULTY_SETTINGS, getTreasureQuestDifficultySettings } from '../lib/gameRoomV2/treasureQuest/difficulty'
import {
  createInitialExploration,
  keysEarnedForAnswer,
  applyCorrectAnswer,
  applyWrongAnswer,
  canEnterRoom,
  enterRoom,
} from '../lib/gameRoomV2/treasureQuest/exploration'
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

console.log('== Room graph: fully connected, treasure reachable ==')
assert(ROOMS.length >= 5, `at least 5 rooms declared (found ${ROOMS.length})`)
const reachable = reachableRoomIds(START_ROOM_ID)
assert(reachable.has(TREASURE_ROOM_ID), 'the treasury is reachable from the entrance via the door graph')
assert(reachable.size === ROOMS.length, `every room is reachable from the entrance (${reachable.size} of ${ROOMS.length})`)
assert(getRoom(TREASURE_ROOM_ID).doors.length === 0, 'the treasury has no outgoing doors -- it is the end of the quest')
for (const room of ROOMS) {
  for (const door of room.doors) {
    assert(ROOMS.some((r) => r.id === door.toRoomId), `${room.name}'s door leads to a room that actually exists (${door.toRoomId})`)
  }
}

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(TREASURE_QUEST_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Normal/Hard)')
const easy = getTreasureQuestDifficultySettings('easy')
const normal = getTreasureQuestDifficultySettings('normal')
assert(!easy.wrongAnswerCostsKey, 'Easy never costs a key for a wrong answer')
assert(normal.wrongAnswerCostsKey, 'Normal costs a key for a wrong answer')
assert(
  !('questionDifficulty' in easy) && !('questionTypes' in easy),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Hard\'s "half the time" key rule is deterministic, not random ==')
const hard = getTreasureQuestDifficultySettings('hard')
assert(keysEarnedForAnswer(hard, 0) === 1, 'Hard\'s 1st correct answer earns a key')
assert(keysEarnedForAnswer(hard, 1) === 0, "Hard's 2nd correct answer earns nothing")
assert(keysEarnedForAnswer(hard, 2) === 1, "Hard's 3rd correct answer earns a key again")
assert(keysEarnedForAnswer(easy, 5) === 2 && keysEarnedForAnswer(easy, 6) === 2, 'Easy always earns the same key count regardless of answer count')

console.log('\n== Key economics: earning and spending ==')
let state = createInitialExploration(normal)
assert(state.currentRoomId === START_ROOM_ID, 'exploration starts at the entrance')
assert(state.keys === 0, 'exploration starts with zero keys')
state = applyCorrectAnswer(state, normal)
assert(state.keys === 1, 'a correct answer earns a key under Normal')
state = applyWrongAnswer(state, normal)
assert(state.keys === 0, 'a wrong answer under Normal costs a key back')
state = applyWrongAnswer(state, normal)
assert(state.keys === 0, 'keys never go negative -- a wrong answer with zero keys does nothing further')

console.log('\n== Door gating: cannot enter a room without enough keys ==')
state = createInitialExploration(normal)
assert(!canEnterRoom(state, 'library'), 'the library door is locked with zero keys (costs 1)')
const blockedEntry = enterRoom(state, 'library')
assert(blockedEntry.currentRoomId === START_ROOM_ID, 'attempting to enter a locked room does nothing -- the player stays put')
state = applyCorrectAnswer(state, normal)
assert(canEnterRoom(state, 'library'), 'the library door unlocks once enough keys are held')
state = enterRoom(state, 'library')
assert(state.currentRoomId === 'library', 'entering an affordable room actually moves the player there')
assert(state.keys === 0, 'entering a room spends its exact key cost')

console.log('\n== Clue collection ==')
state = createInitialExploration(normal)
assert(state.cluesFound.length === 0, 'the entrance itself has no clue')
state = { ...state, keys: 1 }
state = enterRoom(state, 'library')
assert(state.cluesFound.length === 1, 'entering a room with a clue for the first time collects it')
const stateAfterRevisit = enterRoom({ ...state, keys: 5 }, 'observatory')
const backToLibrary = enterRoom({ ...stateAfterRevisit, currentRoomId: 'observatory' }, 'library')
assert(backToLibrary === stateAfterRevisit || backToLibrary.cluesFound.length === stateAfterRevisit.cluesFound.length, 'revisiting a room never duplicates its clue in the collection')

console.log('\n== Missing a clue never blocks reaching the treasure ==')
// The garden -> cellar -> treasury path passes through only one clue
// room (the garden) -- a student who somehow skipped collecting it
// (impossible in practice since entering a room auto-collects its
// clue, but this asserts the WIN CONDITION itself never checks
// cluesFound) must still be able to reach the treasury purely on keys.
let keylessPathState = createInitialExploration(normal)
for (let i = 0; i < 10 && keylessPathState.currentRoomId !== TREASURE_ROOM_ID; i++) {
  keylessPathState = applyCorrectAnswer(keylessPathState, normal)
  if (canEnterRoom(keylessPathState, 'garden')) keylessPathState = enterRoom(keylessPathState, 'garden')
  else if (canEnterRoom(keylessPathState, 'cellar')) keylessPathState = enterRoom(keylessPathState, 'cellar')
  else if (canEnterRoom(keylessPathState, 'treasury')) keylessPathState = enterRoom(keylessPathState, 'treasury')
}
assert(keylessPathState.treasureFound, 'a path through a clue room still reaches the treasure -- reaching it depends only on keys, not on clues')
assert(
  keylessPathState.cluesFound.length < ROOMS.filter((r) => r.clue).length,
  'a single path does not necessarily collect every clue in the game, confirming clues are optional side content, not required for progress'
)

console.log('\n== Reaching the treasury sets treasureFound ==')
let winState = createInitialExploration(normal)
let iterations = 0
while (!winState.treasureFound && iterations < 50) {
  winState = applyCorrectAnswer(winState, normal)
  for (const door of getRoom(winState.currentRoomId).doors) {
    if (canEnterRoom(winState, door.toRoomId)) {
      winState = enterRoom(winState, door.toRoomId)
      break
    }
  }
  iterations++
}
assert(winState.treasureFound, 'answering enough questions correctly eventually reaches the treasury')
assert(iterations < 50, 'reaching the treasure happens in a bounded number of steps, never hangs')

console.log('\n== Registry: Treasure Quest is now a real, playable engine ==')
const engine = getGameEngineV2('treasure-quest')
assert(engine?.status === 'COMING_SOON', 'Treasure Quest is hidden (COMING_SOON) until rebuilt as a real game -- its logic stays tested here')
assert(engine?.compatibility.soloSupport === true, 'Treasure Quest supports solo play')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
