// Standalone verification script for GameRoom V2's domain layer (see
// scripts/verify-gameroom-v2-isolation.ts for why this repo uses tsx
// scripts instead of a test framework). Asserts the content/gameplay
// separation actually works as designed: a question set's declared
// question types determine which engines can play it, purely by
// comparing two independent declarations -- nothing hardcodes a
// set-to-engine mapping.
//
// Run with: npx tsx scripts/verify-gameroom-v2-domain.ts

import { GAME_ROOM_V2_QUESTION_TYPES, IMPLEMENTED_QUESTION_TYPES } from '../lib/gameRoomV2/domain/questionTypes'
import { GAME_ENGINES_V2, getGameEngineV2, compatibleEnginesForQuestionTypes } from '../lib/gameRoomV2/registry'
import { LEARNING_WORLDS, getLearningWorld } from '../lib/gameRoomV2/domain/learningWorld'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Question type roadmap ==')
assert(GAME_ROOM_V2_QUESTION_TYPES.includes('MULTIPLE_CHOICE'), 'MULTIPLE_CHOICE is a declared question type')
assert(GAME_ROOM_V2_QUESTION_TYPES.includes('PRONUNCIATION'), 'PRONUNCIATION is declared for the roadmap')
assert(GAME_ROOM_V2_QUESTION_TYPES.includes('READING_FLUENCY'), 'READING_FLUENCY is declared for the roadmap')
assert(
  !IMPLEMENTED_QUESTION_TYPES.includes('PRONUNCIATION'),
  'PRONUNCIATION is NOT marked implemented yet (roadmap-only, per spec)'
)
assert(
  !IMPLEMENTED_QUESTION_TYPES.includes('READING_FLUENCY'),
  'READING_FLUENCY is NOT marked implemented yet (roadmap-only, per spec)'
)
assert(GAME_ROOM_V2_QUESTION_TYPES.length === 12, `exactly 12 question types declared (found ${GAME_ROOM_V2_QUESTION_TYPES.length})`)

console.log('\n== Engine registry ==')
assert(GAME_ENGINES_V2.length === 18, `18 engines registered (found ${GAME_ENGINES_V2.length})`)
// Classic Quiz (a thin reference engine mounting GameSessionRuntime
// directly), Tower Defense, Racing, Boss Battle, Treasure Quest (each a
// custom visual frame built around QuestionOverlay), Word Ninja (its
// own lane-slashing UI submitting the same CATEGORIZE answer shape
// directly), Space Mission (a mission-path flight visual, also built
// around QuestionOverlay/GameHUD), Kingdom Builder (a CSS/SVG
// settlement scene, same pattern), Mystery Mansion (a
// per-session-seeded room-by-room investigation, same pattern), and
// Matching/Memory (built on the shared card/grid layer --
// lib/gameRoomV2/cardGrid + components/gameRoomV2/cardGrid --
// submitting the same Record<left,right> MATCH answer shape
// MatchInput's dropdown form does) -- see
// components/gameRoomV2/{towerDefense,racing,bossBattle,treasureQuest,wordNinja,spaceMission,kingdomBuilder,mysteryMansion,matching,memory}/
// -- are the real, playable engines so far; every other engine stays
// COMING_SOON until it gets the same treatment.
const ACTIVE_ENGINE_IDS = ['classic-quiz', 'tower-defense', 'racing', 'boss-battle', 'word-ninja', 'matching', 'memory', 'balloon-pop', 'letter-train', 'parachute-catch', 'fishing-pond', 'missing-letter', 'letter-parade']
// Built, but hidden (COMING_SOON) by the gameplay overhaul until each is
// rebuilt into a real game -- see lib/gameRoomV2/registry.ts.
const HIDDEN_ENGINE_IDS = ['treasure-quest', 'space-mission', 'kingdom-builder', 'mystery-mansion']
assert(
  GAME_ENGINES_V2.filter((e) => e.status === 'COMING_SOON' || e.status === 'HIDDEN').length === GAME_ENGINES_V2.length - ACTIVE_ENGINE_IDS.length,
  `every engine except {${ACTIVE_ENGINE_IDS.join(', ')}} is still COMING_SOON (or HIDDEN)`
)
assert(getGameEngineV2('classic-quiz')?.status === 'ACTIVE', 'Classic Quiz is ACTIVE, genuinely playable')
assert(getGameEngineV2('tower-defense')?.status === 'ACTIVE', 'Tower Defense is ACTIVE, genuinely playable')
assert(getGameEngineV2('racing')?.status === 'ACTIVE', 'Racing is ACTIVE, genuinely playable')
assert(getGameEngineV2('boss-battle')?.status === 'ACTIVE', 'Boss Battle is ACTIVE, genuinely playable')
assert(getGameEngineV2('treasure-quest')?.status === 'COMING_SOON', 'Treasure Quest is hidden (COMING_SOON) until it is rebuilt as a real game')
assert(getGameEngineV2('word-ninja')?.status === 'ACTIVE', 'Word Ninja is ACTIVE, genuinely playable')
assert(getGameEngineV2('space-mission')?.status === 'COMING_SOON', 'Space Mission is hidden (COMING_SOON) until it is rebuilt as a real game')
assert(getGameEngineV2('kingdom-builder')?.status === 'COMING_SOON', 'Kingdom Builder is hidden (COMING_SOON) until it is rebuilt as a real game')
assert(getGameEngineV2('mystery-mansion')?.status === 'COMING_SOON', 'Mystery Mansion is hidden (COMING_SOON) until it is rebuilt as a real game')
assert(getGameEngineV2('matching')?.status === 'ACTIVE', 'Matching is ACTIVE, genuinely playable')
assert(getGameEngineV2('memory')?.status === 'ACTIVE', 'Memory is ACTIVE, genuinely playable')
assert(HIDDEN_ENGINE_IDS.every((id) => !ACTIVE_ENGINE_IDS.includes(id)), 'no hidden engine is counted as ACTIVE')
assert(getGameEngineV2('does-not-exist') === undefined, 'getGameEngineV2 returns undefined for an unknown id')
for (const id of ['word-ninja', 'space-mission', 'kingdom-builder', 'mystery-mansion', 'crossword', 'matching', 'memory']) {
  assert(getGameEngineV2(id) !== undefined, `getGameEngineV2('${id}') resolves (home-screen roster engine)`)
}

console.log('\n== Learning Worlds ==')
assert(LEARNING_WORLDS.length === 6, `6 learning worlds declared (found ${LEARNING_WORLDS.length})`)
for (const id of [
  'letters-world',
  'sounds-world',
  'words-world',
  'sentence-world',
  'story-world',
  'tamil-challenge-world',
]) {
  assert(getLearningWorld(id) !== undefined, `getLearningWorld('${id}') resolves`)
}
assert(
  LEARNING_WORLDS.every((w) => w.engineIds.every((id) => getGameEngineV2(id) !== undefined)),
  'every world only references engine ids that actually exist in the registry'
)

console.log('\n== Content/gameplay separation: compatibility matching ==')
const mcqOnly = compatibleEnginesForQuestionTypes(['MULTIPLE_CHOICE'])
assert(mcqOnly.some((e) => e.id === 'classic-quiz'), 'a MULTIPLE_CHOICE-only set is compatible with Classic Quiz')
assert(mcqOnly.some((e) => e.id === 'tower-defense'), 'a MULTIPLE_CHOICE-only set is compatible with Tower Defense')
assert(mcqOnly.some((e) => e.id === 'racing'), 'a MULTIPLE_CHOICE-only set is compatible with Racing')

const matchOnly = compatibleEnginesForQuestionTypes(['MATCH'])
assert(
  matchOnly.some((e) => e.id === 'treasure-quest') && matchOnly.some((e) => e.id === 'matching'),
  'a MATCH-only set is compatible with Treasure Quest and the lightweight Matching activity'
)

const mixedUnsupported = compatibleEnginesForQuestionTypes(['MULTIPLE_CHOICE', 'PRONUNCIATION'])
assert(
  mixedUnsupported.length === 0,
  'a set mixing MULTIPLE_CHOICE with an unsupported type (PRONUNCIATION) matches zero engines'
)

// The whole point of the architecture: the SAME question set (by
// declared types) is playable by MULTIPLE engines, decided purely by
// comparing declarations -- never a hardcoded set-to-engine link.
const quizAndTowerCompatible = compatibleEnginesForQuestionTypes(['MULTIPLE_CHOICE', 'TRUE_FALSE'])
assert(
  quizAndTowerCompatible.length >= 2,
  `a MULTIPLE_CHOICE+TRUE_FALSE set is playable through ${quizAndTowerCompatible.length} engines (>= 2 expected)`
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
