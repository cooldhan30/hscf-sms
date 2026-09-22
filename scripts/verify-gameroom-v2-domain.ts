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
assert(GAME_ENGINES_V2.length === 5, `5 engines registered as scaffolding (found ${GAME_ENGINES_V2.length})`)
assert(
  GAME_ENGINES_V2.every((e) => e.status === 'COMING_SOON'),
  'every registered engine is COMING_SOON -- none implemented yet, per explicit scope'
)
assert(getGameEngineV2('classic-quiz') !== undefined, "getGameEngineV2('classic-quiz') resolves")
assert(getGameEngineV2('tower-defense') !== undefined, "getGameEngineV2('tower-defense') resolves (metadata only, not built)")
assert(getGameEngineV2('does-not-exist') === undefined, 'getGameEngineV2 returns undefined for an unknown id')

console.log('\n== Content/gameplay separation: compatibility matching ==')
const mcqOnly = compatibleEnginesForQuestionTypes(['MULTIPLE_CHOICE'])
assert(mcqOnly.some((e) => e.id === 'classic-quiz'), 'a MULTIPLE_CHOICE-only set is compatible with Classic Quiz')
assert(mcqOnly.some((e) => e.id === 'tower-defense'), 'a MULTIPLE_CHOICE-only set is compatible with Tower Defense')
assert(mcqOnly.some((e) => e.id === 'racing'), 'a MULTIPLE_CHOICE-only set is compatible with Racing')

const matchOnly = compatibleEnginesForQuestionTypes(['MATCH'])
assert(
  matchOnly.length === 1 && matchOnly[0].id === 'treasure-quest',
  'a MATCH-only set is compatible with exactly Treasure Quest'
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
