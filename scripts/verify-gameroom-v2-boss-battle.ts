// Standalone verification script for Boss Battle's pure battle
// simulation (lib/gameRoomV2/bossBattle/*). Same tsx-script convention
// as every other verify-gameroom-v2-*.ts script. Covers: boss phase
// transitions, question-powered damage, ability economics, the
// wrong-answer counterattack consequence, health/win-loss detection,
// and the co-op-ready generic attacker model.
//
// Run with: npx tsx scripts/verify-gameroom-v2-boss-battle.ts

import { BOSSES, getBoss, phaseIndexForHealthFraction } from '../lib/gameRoomV2/bossBattle/bosses'
import { ABILITIES, getAbility } from '../lib/gameRoomV2/bossBattle/abilities'
import { BOSS_BATTLE_DIFFICULTY_SETTINGS, getBossBattleDifficultySettings } from '../lib/gameRoomV2/bossBattle/difficulty'
import {
  PLAYER_ATTACKER_ID,
  createInitialBattle,
  applyCorrectAnswerDamage,
  applyWrongAnswerConsequence,
  activateAbility,
  canUseAbility,
  tickBattle,
  type AttackerState,
  type BattleState,
} from '../lib/gameRoomV2/bossBattle/battle'
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

console.log('== Boss roster & phases ==')
assert(BOSSES.length >= 3, `at least 3 bosses declared (found ${BOSSES.length})`)
for (const boss of BOSSES) {
  const totalShare = boss.phases.reduce((sum, p) => sum + p.healthShare, 0)
  assert(Math.abs(totalShare - 1) < 1e-9, `${boss.name}'s phase health shares sum to exactly 1 (found ${totalShare})`)
  assert(boss.phases.length >= 2, `${boss.name} has at least 2 phases`)
  for (let i = 1; i < boss.phases.length; i++) {
    assert(
      boss.phases[i].counterattackIntervalMs <= boss.phases[i - 1].counterattackIntervalMs,
      `${boss.name}'s phase ${i} counterattacks at least as fast as the previous phase -- phases have real mechanical weight`
    )
  }
}
assert(getBoss('suran').id === 'suran', "getBoss('suran') resolves")

console.log('\n== Phase resolution from health fraction ==')
const suran = getBoss('suran')
assert(phaseIndexForHealthFraction(suran, 1.0) === 0, 'full health resolves to phase 0')
assert(phaseIndexForHealthFraction(suran, 0.51) === 0, 'health just above the phase-0/phase-1 boundary resolves to phase 0')
assert(phaseIndexForHealthFraction(suran, 0.5) === 1, 'health exactly at the boundary belongs to the phase it is entering (phase 1)')
assert(phaseIndexForHealthFraction(suran, 0.49) === 1, 'just past the boundary resolves to phase 1')
assert(phaseIndexForHealthFraction(suran, 0.15) === 2, 'deep health resolves to the final phase')
assert(phaseIndexForHealthFraction(suran, 0) === 2, 'zero health still resolves to the final phase, never throws or goes out of bounds')

console.log('\n== Abilities: cost real charge, distinct effects ==')
assert(ABILITIES.length === 3, `exactly 3 abilities declared (found ${ABILITIES.length})`)
const heavyStrike = getAbility('heavy-strike')
const shield = getAbility('shield')
const focus = getAbility('focus')
assert(heavyStrike.bonusDamage > 0 && shield.bonusDamage === 0 && focus.bonusDamage === 0, 'only Heavy Strike deals direct bonus damage')
assert(shield.shieldCharges > 0 && heavyStrike.shieldCharges === 0, 'only Shield grants shield charges')
assert(focus.focusDamageMultiplier > 1 && heavyStrike.focusDamageMultiplier === 1, 'only Focus buffs the next answer\'s damage')

console.log('\n== Difficulty: alters gameplay parameters only ==')
assert(BOSS_BATTLE_DIFFICULTY_SETTINGS.length === 3, 'exactly 3 difficulty tiers (Easy/Normal/Hard)')
const easy = getBossBattleDifficultySettings('easy')
const hard = getBossBattleDifficultySettings('hard')
assert(easy.playerMaxHealth > hard.playerMaxHealth, 'Easy gives more player health than Hard')
assert(easy.bossCounterattackMultiplier < hard.bossCounterattackMultiplier, 'Hard\'s boss counterattacks harder than Easy\'s')
assert(
  !('questionDifficulty' in easy) && !('questionTypes' in easy),
  'difficulty settings never reference question difficulty/types -- that comes only from the Question Set'
)

console.log('\n== Question-powered attacks: correct answers damage the boss ==')
const settings = getBossBattleDifficultySettings('normal')
let battle = createInitialBattle('suran', settings)
const initialBossHealth = battle.bossHealth
battle = applyCorrectAnswerDamage(battle, PLAYER_ATTACKER_ID, settings)
assert(battle.bossHealth < initialBossHealth, 'a correct answer reduces the boss\'s health')
assert(
  battle.attackers.find((a) => a.id === PLAYER_ATTACKER_ID)!.charge === settings.chargePerCorrectAnswer,
  'a correct answer also grants ability charge'
)

console.log('\n== Boss phases have real mechanical weight ==')
battle = createInitialBattle('suran', settings)
assert(battle.bossPhaseIndex === 0, 'the battle starts in phase 0')
// Deal enough damage to cross into the final phase (health share 0.2 of 300 = 60).
while (battle.bossHealth > battle.bossMaxHealth * 0.2 && !battle.battleOver) {
  battle = applyCorrectAnswerDamage(battle, PLAYER_ATTACKER_ID, settings)
}
assert(battle.bossPhaseIndex === 2, 'dealing enough damage transitions the boss into its final phase')

console.log('\n== Wrong-answer consequence: an immediate, bounded counterattack ==')
battle = createInitialBattle('suran', settings)
const healthBeforeWrong = battle.attackers[0].health
battle = applyWrongAnswerConsequence(battle, PLAYER_ATTACKER_ID, settings)
assert(battle.attackers[0].health < healthBeforeWrong, 'a wrong answer triggers an immediate counterattack against the player')
assert(battle.attackers[0].health > 0, 'a single wrong answer never one-shots the player -- a bounded, age-appropriate consequence')

console.log('\n== Shield blocks a counterattack entirely ==')
battle = createInitialBattle('suran', settings)
battle = { ...battle, attackers: battle.attackers.map((a) => ({ ...a, charge: 100 })) }
battle = activateAbility(battle, PLAYER_ATTACKER_ID, 'shield')
const healthAfterShieldUp = battle.attackers[0].health
battle = applyWrongAnswerConsequence(battle, PLAYER_ATTACKER_ID, settings)
assert(battle.attackers[0].health === healthAfterShieldUp, 'a shielded counterattack deals zero damage')
assert(battle.attackers[0].shieldCharges === 0, 'the shield charge is consumed by the blocked counterattack')

console.log('\n== Focus doubles the next correct answer\'s damage ==')
battle = createInitialBattle('suran', settings)
battle = { ...battle, attackers: battle.attackers.map((a) => ({ ...a, charge: 100 })) }
const unfocusedDamageBattle = applyCorrectAnswerDamage(createInitialBattle('suran', settings), PLAYER_ATTACKER_ID, settings)
const unfocusedDamage = suran.baseHealth - unfocusedDamageBattle.bossHealth
battle = activateAbility(battle, PLAYER_ATTACKER_ID, 'focus')
battle = applyCorrectAnswerDamage(battle, PLAYER_ATTACKER_ID, settings)
const focusedDamage = suran.baseHealth - battle.bossHealth
assert(focusedDamage === unfocusedDamage * 2, 'a Focus-buffed correct answer deals exactly double damage')
battle = applyCorrectAnswerDamage(battle, PLAYER_ATTACKER_ID, settings)
const secondHitDamage = suran.baseHealth - focusedDamage - battle.bossHealth
assert(secondHitDamage === unfocusedDamage, 'Focus is consumed after one use -- the following answer deals normal damage again')

console.log('\n== Ability affordability ==')
battle = createInitialBattle('suran', settings)
assert(!canUseAbility(battle, PLAYER_ATTACKER_ID, 'heavy-strike'), 'a fresh battle starts with zero charge -- no ability is affordable yet')
const brokeUse = activateAbility(battle, PLAYER_ATTACKER_ID, 'heavy-strike')
assert(brokeUse.bossHealth === battle.bossHealth, 'using an ability without enough charge does nothing')
battle = { ...battle, attackers: battle.attackers.map((a) => ({ ...a, charge: 100 })) }
assert(canUseAbility(battle, PLAYER_ATTACKER_ID, 'heavy-strike'), 'a fully charged attacker can afford Heavy Strike')

console.log('\n== Health & win/loss detection ==')
battle = createInitialBattle('suran', settings)
let iterations = 0
while (!battle.battleOver && iterations < 500) {
  battle = applyCorrectAnswerDamage(battle, PLAYER_ATTACKER_ID, settings)
  iterations++
}
assert(battle.victory && battle.battleOver, 'answering enough questions correctly defeats the boss -- a real victory condition')
assert(battle.bossHealth <= 0, 'a defeated boss\'s health is at or below zero, never negative-looking in a way that would render oddly')

// Losing condition: enough wrong answers (and the boss's own clock)
// bring the player to 0 health without the player ever answering
// correctly.
let losingBattle = createInitialBattle('suran', settings)
iterations = 0
while (!losingBattle.battleOver && iterations < 200) {
  losingBattle = applyWrongAnswerConsequence(losingBattle, PLAYER_ATTACKER_ID, settings)
  iterations++
}
assert(losingBattle.battleOver && !losingBattle.victory, 'enough wrong answers alone eventually defeats the player -- a real loss condition')
assert(iterations < 200, 'losing happens in a bounded number of wrong answers, never hangs')

console.log('\n== Boss clock: counterattacks escalate with phase, independent of answers ==')
let clockBattle = createInitialBattle('suran', settings)
let clockTicks = 0
const initialPlayerHealth = clockBattle.attackers[0].health
while (clockBattle.attackers[0].health === initialPlayerHealth && clockTicks < 1000) {
  clockBattle = tickBattle(clockBattle, 100, settings)
  clockTicks++
}
assert(clockBattle.attackers[0].health < initialPlayerHealth, 'the boss counterattacks on its own clock even if the player never answers')

console.log('\n== Co-op-ready: damage/ability functions work for ANY attacker id ==')
battle = createInitialBattle('suran', settings)
const secondAttacker: AttackerState = {
  id: 'a-future-coop-participant',
  label: 'Classmate',
  isPlayer: true,
  health: 100,
  maxHealth: 100,
  charge: 0,
  maxCharge: 100,
  focusMultiplier: null,
  shieldCharges: 0,
  damageDealt: 0,
}
const coopBattle: BattleState = { ...battle, attackers: [...battle.attackers, secondAttacker] }
const afterCoopDamage = applyCorrectAnswerDamage(coopBattle, secondAttacker.id, settings)
assert(
  afterCoopDamage.bossHealth < coopBattle.bossHealth,
  'applyCorrectAnswerDamage works for a SECOND attacker id sharing the same boss health pool -- the exact hook a future co-op session would reuse'
)
assert(
  afterCoopDamage.attackers.find((a) => a.id === PLAYER_ATTACKER_ID)!.charge === 0,
  "one attacker's correct answer never grants charge to a different attacker"
)

console.log('\n== Registry: Boss Battle supports both solo and (Live Classroom) cooperative multiplayer play ==')
const engine = getGameEngineV2('boss-battle')
assert(engine?.status === 'ACTIVE', 'Boss Battle is ACTIVE in the registry')
assert(engine?.compatibility.soloSupport === true, 'Boss Battle supports solo play')
// multiplayerSupport is now genuinely backed by Live Classroom's
// cooperative shared-boss-HP battle (see scripts/verify-gameroom-v2-
// boss-battle-multiplayer.ts for the actual multi-participant
// coverage) -- this script only re-confirms the flag itself, since the
// pure SOLO battle logic tested above has no opinion on Live Classroom.
assert(engine?.compatibility.multiplayerSupport === true, 'Boss Battle declares multiplayer/co-op as a supported capability')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
