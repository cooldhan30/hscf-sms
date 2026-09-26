// Standalone verification script for Kingdom Builder's pure kingdom
// logic (lib/gameRoomV2/kingdomBuilder/*). Same tsx-script convention
// as every other verify-gameroom-v2-*.ts script. Covers: the build
// order being well-formed, resource economics, difficulty settings,
// streak-driven visual upgrade tiers, auto-construction on
// affordability, wrong answers never destroying built progress, and
// full-kingdom completion.
//
// Run with: npx tsx scripts/verify-gameroom-v2-kingdom-builder.ts

import { BUILD_ORDER, getBuilding, nextBuildingToConstruct, isKingdomComplete } from '../lib/gameRoomV2/kingdomBuilder/buildings'
import { EMPTY_RESOURCES, addResources, canAfford, spendResources, resourcesEarnedForAnswer } from '../lib/gameRoomV2/kingdomBuilder/resources'
import { KINGDOM_BUILDER_DIFFICULTY_SETTINGS, getKingdomBuilderDifficultySettings } from '../lib/gameRoomV2/kingdomBuilder/difficulty'
import {
  STREAK_UPGRADE_TIERS,
  streakUpgradeTier,
  createInitialKingdom,
  applyCorrectAnswer,
  applyWrongAnswer,
  acknowledgeCompletion,
  kingdomProgressPct,
  kingdomComplete,
} from '../lib/gameRoomV2/kingdomBuilder/kingdom'
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

console.log('== Build order: well-formed, no religious framing ==')
assert(BUILD_ORDER.length === 6, `exactly 6 buildings declared (found ${BUILD_ORDER.length})`)
assert(BUILD_ORDER.map((b) => b.id).includes('house'), 'house is in the build order')
assert(BUILD_ORDER.map((b) => b.id).includes('farm'), 'farm is in the build order')
assert(BUILD_ORDER.map((b) => b.id).includes('tower'), 'tower is in the build order')
assert(BUILD_ORDER.map((b) => b.id).includes('pavilion'), 'a decorative pavilion (not "temple") is in the build order')
assert(BUILD_ORDER.map((b) => b.id).includes('castle'), 'castle is the culminating structure')
const religiousWords = ['temple', 'god', 'pray', 'worship', 'shrine', 'deity']
for (const b of BUILD_ORDER) {
  const text = `${b.name} ${b.description}`.toLowerCase()
  for (const word of religiousWords) {
    assert(!text.includes(word), `${b.name}'s name/description contains no religious term ("${word}")`)
  }
}
assert(BUILD_ORDER[BUILD_ORDER.length - 1].id === 'castle', 'the castle is the final building in the sequence')
assert(getBuilding('house').id === 'house', 'getBuilding resolves a known building id')
let threw = false
try {
  getBuilding('does-not-exist' as never)
} catch {
  threw = true
}
assert(threw, 'getBuilding throws for an unknown building id')

console.log('\n== Resource economics ==')
assert(EMPTY_RESOURCES.coins === 0 && EMPTY_RESOURCES.wood === 0 && EMPTY_RESOURCES.stone === 0 && EMPTY_RESOURCES.stars === 0, 'a kingdom starts with zero of every resource')
let pool = addResources(EMPTY_RESOURCES, { coins: 5, wood: 2 })
assert(pool.coins === 5 && pool.wood === 2 && pool.stone === 0, 'addResources only changes the kinds given')
assert(canAfford(pool, { coins: 5 }), 'canAfford is true when the pool exactly meets the cost')
assert(!canAfford(pool, { coins: 6 }), 'canAfford is false when the pool falls short')
const spent = spendResources(pool, { coins: 5 })
assert(spent.coins === 0 && spent.wood === 2, 'spendResources only deducts the kinds given')

console.log('\n== Resource rewards are deterministic, not random ==')
const r0 = resourcesEarnedForAnswer(0)
const r1 = resourcesEarnedForAnswer(0)
assert(JSON.stringify(r0) === JSON.stringify(r1), 'resourcesEarnedForAnswer is a pure function of the answer count')
assert(resourcesEarnedForAnswer(0).coins === 4, 'every correct answer earns coins')
assert(resourcesEarnedForAnswer(3).stars === 1, 'the 4th correct answer (index 3) earns a star')
assert(resourcesEarnedForAnswer(0).stars === undefined, 'not every correct answer earns a star -- stars are the rarest resource')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(KINGDOM_BUILDER_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Settler/Builder/Architect)')
const settler = getKingdomBuilderDifficultySettings('settler')
const builder = getKingdomBuilderDifficultySettings('builder')
assert(!settler.wrongAnswerCostsResources, 'Settler never costs resources for a wrong answer')
assert(builder.wrongAnswerCostsResources, 'Builder costs resources for a wrong answer')
assert(
  !('questionDifficulty' in settler) && !('questionTypes' in settler),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Streak-driven visual upgrade tiers ==')
assert(streakUpgradeTier(0) === 0, 'zero streak is tier 0')
assert(streakUpgradeTier(STREAK_UPGRADE_TIERS[1]) === 1, 'reaching the 2nd threshold unlocks tier 1')
assert(streakUpgradeTier(STREAK_UPGRADE_TIERS[2]) === 2, 'reaching the 3rd threshold unlocks tier 2')
assert(streakUpgradeTier(STREAK_UPGRADE_TIERS[3]) === 3, 'reaching the 4th threshold unlocks tier 3 (max)')
assert(streakUpgradeTier(999) === 3, 'tier is capped at 3, never unbounded')

console.log('\n== Auto-construction: correct answers alone grow the kingdom ==')
const pilot = getKingdomBuilderDifficultySettings('builder')
let state = createInitialKingdom(pilot)
assert(state.builtIds.length === 0, 'a kingdom starts with nothing built')
assert(nextBuildingToConstruct(state.builtIds)?.id === 'house', 'the house is the first building queued')
let guard = 0
while (state.builtIds.length === 0 && guard < 20) {
  state = applyCorrectAnswer(state, pilot)
  guard++
}
assert(state.builtIds.includes('house'), 'enough correct answers automatically construct the house -- no separate build action needed')
assert(state.justCompletedId === 'house', 'justCompletedId flags the house as freshly completed')
state = acknowledgeCompletion(state)
assert(state.justCompletedId === null, 'acknowledging completion clears the one-shot flag')

console.log('\n== Wrong answers never destroy already-built progress ==')
state = createInitialKingdom(pilot)
for (let i = 0; i < 5 && state.builtIds.length === 0; i++) state = applyCorrectAnswer(state, pilot)
assert(state.builtIds.length > 0, 'setup: at least one building stands before testing wrong-answer safety')
const builtBeforeWrong = [...state.builtIds]
for (let i = 0; i < 10; i++) state = applyWrongAnswer(state, pilot)
assert(JSON.stringify(state.builtIds) === JSON.stringify(builtBeforeWrong), 'ten consecutive wrong answers never remove a single already-built structure')
assert(state.resources.coins >= 0 && state.resources.wood >= 0 && state.resources.stone >= 0, 'resources never go negative from repeated wrong answers')
assert(state.currentStreak === 0, 'a wrong answer resets the current streak')

console.log('\n== Recovery: a broken streak costs only cosmetic tier, never resets progress ==')
state = createInitialKingdom(pilot)
for (let i = 0; i < STREAK_UPGRADE_TIERS[2]; i++) state = applyCorrectAnswer(state, pilot)
const tierBeforeWrong = streakUpgradeTier(state.currentStreak)
const builtBeforeStreakBreak = [...state.builtIds]
state = applyWrongAnswer(state, pilot)
assert(streakUpgradeTier(state.currentStreak) < tierBeforeWrong || tierBeforeWrong === 0, 'breaking a streak can drop the cosmetic tier')
assert(JSON.stringify(state.builtIds) === JSON.stringify(builtBeforeStreakBreak), 'breaking a streak does not remove any built structure')
state = applyCorrectAnswer(state, pilot)
assert(state.currentStreak === 1, 'the very next correct answer starts rebuilding the streak immediately -- recovery is always available')

console.log('\n== Full kingdom completion ==')
state = createInitialKingdom(getKingdomBuilderDifficultySettings('settler'))
let iterations = 0
while (!kingdomComplete(state) && iterations < 300) {
  state = applyCorrectAnswer(state, getKingdomBuilderDifficultySettings('settler'))
  iterations++
}
assert(kingdomComplete(state), 'answering enough questions correctly eventually completes the entire kingdom')
assert(iterations < 300, 'completing the kingdom happens in a bounded number of steps, never hangs')
assert(isKingdomComplete(state.builtIds) === true, 'isKingdomComplete agrees with kingdomComplete')
assert(kingdomProgressPct(state) === 100, 'kingdom progress reads 100% once every building stands')
assert(nextBuildingToConstruct(state.builtIds) === null, 'there is no next building queued once the kingdom is complete')

console.log('\n== Registry: Kingdom Builder has a real, testable engine behind it ==')
const engine = getGameEngineV2('kingdom-builder')
assert(engine !== undefined, 'kingdom-builder is registered')
assert(engine?.status === 'COMING_SOON', 'Kingdom Builder is hidden (COMING_SOON) until rebuilt as a real game -- its logic stays tested here')
assert(engine?.compatibility.soloSupport === true, 'Kingdom Builder supports solo play')
assert(engine?.compatibility.supportedQuestionTypes.includes('MULTIPLE_CHOICE') === true, 'Kingdom Builder supports MULTIPLE_CHOICE questions')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
