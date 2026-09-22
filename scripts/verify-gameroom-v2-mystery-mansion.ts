// Standalone verification script for Mystery Mansion's pure
// investigation/mystery-generation logic
// (lib/gameRoomV2/mysteryMansion/*). Same tsx-script convention as
// every other verify-gameroom-v2-*.ts script. Covers: room sequence
// well-formedness, deterministic-but-varied mystery generation (same
// seed -> same mystery, different seed -> a genuinely different one),
// tone (no horror/scary language), room/clue progression, wrong
// answers never destroying progress, and full mystery resolution.
//
// Run with: npx tsx scripts/verify-gameroom-v2-mystery-mansion.ts

import { MANSION_ROOMS, ROOM_COUNT, getRoom } from '../lib/gameRoomV2/mysteryMansion/rooms'
import { MYSTERY_TEMPLATES, getMysteryTemplate } from '../lib/gameRoomV2/mysteryMansion/templates'
import { generateMystery, buildResolutionText } from '../lib/gameRoomV2/mysteryMansion/generator'
import { MYSTERY_MANSION_DIFFICULTY_SETTINGS, getMysteryMansionDifficultySettings } from '../lib/gameRoomV2/mysteryMansion/difficulty'
import {
  createInitialInvestigation,
  currentRoom,
  cluesFound,
  applyCorrectAnswer,
  applyWrongAnswer,
  investigationProgressPct,
} from '../lib/gameRoomV2/mysteryMansion/investigation'
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

console.log('== Room sequence: well-formed, matches the spec\'s suggested areas ==')
assert(ROOM_COUNT === 6, `exactly 6 rooms declared (found ${ROOM_COUNT})`)
for (const id of ['entrance', 'library', 'study', 'gallery', 'attic', 'garden']) {
  assert(MANSION_ROOMS.some((r) => r.id === id), `${id} is one of the mansion's rooms`)
}
assert(MANSION_ROOMS[0].id === 'entrance', 'the entrance is always the first room')
assert(MANSION_ROOMS[ROOM_COUNT - 1].id === 'garden', 'the garden is always the final room')
assert(getRoom('library').id === 'library', 'getRoom resolves a known room id')
let threw = false
try {
  getRoom('nowhere' as never)
} catch {
  threw = true
}
assert(threw, 'getRoom throws for an unknown room id')

console.log('\n== Tone: mysterious and adventurous, never horror ==')
const scaryWords = ['blood', 'kill', 'dead', 'death', 'scream', 'horror', 'terrify', 'nightmare', 'ghost', 'haunt', 'monster', 'demon', 'evil']
const allText = [
  ...MANSION_ROOMS.map((r) => `${r.name} ${r.ambiance}`),
  ...MYSTERY_TEMPLATES.map((t) => `${t.missingItem} ${t.suspects.join(' ')} ${t.resolutionText('someone', 'the library')}`),
].join(' ').toLowerCase()
for (const word of scaryWords) {
  assert(!allText.includes(word), `no room/mystery text contains a horror-associated term ("${word}")`)
}

console.log('\n== Mystery generation: deterministic per seed, varied across seeds ==')
assert(MYSTERY_TEMPLATES.length >= 3, `at least 3 mystery templates available (found ${MYSTERY_TEMPLATES.length})`)
const mysteryA1 = generateMystery('session-abc')
const mysteryA2 = generateMystery('session-abc')
assert(JSON.stringify(mysteryA1) === JSON.stringify(mysteryA2), 'the SAME seed always regenerates the SAME mystery (a page refresh mid-game stays consistent)')
assert(mysteryA1.foundLocationRoomId !== 'entrance', 'the mystery never resolves at the entrance -- that is only where the case begins')
assert(Object.keys(mysteryA1.clueByRoomId).length === ROOM_COUNT, 'every room has exactly one clue assigned')
assert(getMysteryTemplate(mysteryA1.template.id).id === mysteryA1.template.id, 'getMysteryTemplate resolves the generated mystery\'s own template')

const seeds = Array.from({ length: 12 }, (_, i) => `session-${i}`)
const distinctMysterySignatures = new Set(seeds.map((s) => JSON.stringify(generateMystery(s))))
assert(distinctMysterySignatures.size > 1, 'different session seeds produce genuinely different mysteries -- replaying does not repeat the same case every time')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(MYSTERY_MANSION_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Junior/Detective/Master Detective)')
const junior = getMysteryMansionDifficultySettings('junior')
const detective = getMysteryMansionDifficultySettings('detective')
assert(!junior.wrongAnswerCostsLead, 'Junior Detective never costs a lead for a wrong answer')
assert(detective.wrongAnswerCostsLead, 'Detective costs a lead for a wrong answer')
assert(
  !('questionDifficulty' in junior) && !('questionTypes' in junior),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Room/clue progression: correct answers reveal clues and unlock doors ==')
let state = createInitialInvestigation('verify-seed-1', detective)
assert(state.currentRoomIndex === 0, 'the investigation starts in the entrance')
assert(state.unlockedRoomIds.length === 1, 'only the entrance is unlocked at the start')
assert(cluesFound(state).length === 0, 'no clues are found at the start')
assert(currentRoom(state).id === 'entrance', 'currentRoom reflects the starting room')
state = applyCorrectAnswer(state)
assert(cluesFound(state).length === 1, 'a correct answer reveals the current room\'s clue')
assert(state.currentRoomIndex === 1, 'a correct answer advances to the next room')
assert(state.unlockedRoomIds.length === 2, 'a correct answer unlocks the next room\'s door')
assert(currentRoom(state).id === 'library', 'currentRoom now reflects the newly entered room')

console.log('\n== Wrong answers: cost a lead, never remove progress, never send the player backward ==')
state = createInitialInvestigation('verify-seed-2', detective)
state = applyCorrectAnswer(state)
const roomBeforeWrong = state.currentRoomIndex
const cluesBeforeWrong = [...cluesFound(state)]
const unlockedBeforeWrong = [...state.unlockedRoomIds]
const leadsBefore = state.leads
state = applyWrongAnswer(state, detective)
assert(state.leads === leadsBefore - 1, 'a wrong answer under Detective costs exactly one lead')
assert(state.currentRoomIndex === roomBeforeWrong, 'a wrong answer never moves the player to a different room')
assert(JSON.stringify(cluesFound(state)) === JSON.stringify(cluesBeforeWrong), 'a wrong answer never removes an already-found clue')
assert(JSON.stringify(state.unlockedRoomIds) === JSON.stringify(unlockedBeforeWrong), 'a wrong answer never re-locks an already-unlocked room')
assert(state.currentStreak === 0, 'a wrong answer resets the streak')

console.log('\n== Leads never go negative, and running out is never a blocker ==')
state = createInitialInvestigation('verify-seed-3', detective)
for (let i = 0; i < 10; i++) state = applyWrongAnswer(state, detective)
assert(state.leads === 0, 'leads bottom out at exactly zero, never negative')
state = applyCorrectAnswer(state)
assert(state.currentRoomIndex === 1, 'the investigation keeps advancing on a correct answer even with zero leads -- there is no failure/lockout state')

console.log('\n== Junior Detective never costs a lead ==')
state = createInitialInvestigation('verify-seed-4', junior)
const juniorLeadsBefore = state.leads
state = applyWrongAnswer(state, junior)
assert(state.leads === juniorLeadsBefore, 'Junior Detective\'s wrong answers never touch the lead count')

console.log('\n== Full mystery resolution ==')
state = createInitialInvestigation('verify-seed-5', junior)
let iterations = 0
while (!state.mysterySolved && iterations < 20) {
  state = applyCorrectAnswer(state)
  iterations++
}
assert(state.mysterySolved, 'answering every room\'s question correctly eventually solves the mystery')
assert(iterations <= ROOM_COUNT, 'solving the mystery takes exactly ROOM_COUNT correct answers, never hangs')
assert(cluesFound(state).length === ROOM_COUNT, 'every room\'s clue is collected once the mystery is solved')
assert(investigationProgressPct(state) === 100, 'investigation progress reads 100% once the mystery is solved')
const resolution = buildResolutionText(state.mystery)
assert(resolution.length > 0, 'a non-empty resolution text is produced for the solved mystery')
assert(resolution.includes(state.mystery.suspect), 'the resolution text names the actual generated suspect')

console.log('\n== Registry: Mystery Mansion has a real, testable engine behind it ==')
const engine = getGameEngineV2('mystery-mansion')
assert(engine !== undefined, 'mystery-mansion is registered')
assert(engine?.status === 'ACTIVE', 'Mystery Mansion is ACTIVE, genuinely playable')
assert(engine?.compatibility.soloSupport === true, 'Mystery Mansion supports solo play')
assert(engine?.compatibility.supportedQuestionTypes.includes('MULTIPLE_CHOICE') === true, 'Mystery Mansion supports MULTIPLE_CHOICE questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
