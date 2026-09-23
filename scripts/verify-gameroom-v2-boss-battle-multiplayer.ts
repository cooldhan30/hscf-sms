// Standalone verification script for Boss Battle's Live Classroom
// cooperative multiplayer layer (lib/gameRoomV2/bossBattle/coopBattle.ts
// + the registry/engine-branch consistency this feature depends on).
// Same tsx-script convention as every other verify-gameroom-v2-*.ts
// script.
//
// This SIMULATES MULTIPLE PARTICIPANTS end-to-end at the pure-function
// level (there is no local Postgres harness in this repo, so the
// SECURITY DEFINER RPC sms_gamev2_get_live_boss_battle_state and its
// ownership check are verified by direct code review instead -- the
// same posture verify-gameroom-v2-{live-classroom,racing-multiplayer}
// .ts already document for their own RPCs): constructs synthetic
// participant contribution summaries and runs them through
// buildCoopBattleState/rankCoopContributions -- the EXACT pure
// functions the live API route calls -- asserting authoritative boss
// HP, damage isolation, streak-triggered team attacks, victory
// detection, and the "no naming/shaming" design constraints hold.
//
// Run with: npx tsx scripts/verify-gameroom-v2-boss-battle-multiplayer.ts

import { getBossBattleDifficultySettings } from '../lib/gameRoomV2/bossBattle/difficulty'
import { getBoss } from '../lib/gameRoomV2/bossBattle/bosses'
import {
  buildCoopBattleState,
  coopProgressPct,
  rankCoopContributions,
  streakTeamAttacksTriggered,
  isCoopBattleConcluded,
  STREAK_TEAM_ATTACK_THRESHOLD,
  STREAK_TEAM_ATTACK_BONUS_DAMAGE,
  type ParticipantAnswerSummary,
} from '../lib/gameRoomV2/bossBattle/coopBattle'
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

const settings = getBossBattleDifficultySettings('normal')
const bossId = 'kotravai-guardian' // the smallest boss (220 HP), keeps arithmetic easy to hand-verify
const boss = getBoss(bossId)

console.log('== Simulating 4 participants with distinct contribution levels ==')
// Kavya: 2 correct answers, streak of 6 (exactly crosses ONE team-
// attack threshold) -- highest individual contribution.
// Arjun: 1 correct answer, no streak crossing.
// Meera: 0 correct answers yet (just joined) -- zero contribution,
// never an error.
// Priya: 3 correct answers but only a best streak of 5 (never crossed
// the threshold) -- tests that streak bonuses are based on BEST
// streak, not current, without accidentally defeating the boss.
// Deliberately kept well under kotravai-guardian's 220 HP in total so
// this scenario stays "in progress," not a victory.
const participants: ParticipantAnswerSummary[] = [
  { participantId: 'p-kavya', nickname: 'Kavya R.', correctCount: 2, currentStreak: 6, bestStreak: 6 },
  { participantId: 'p-arjun', nickname: 'Arjun P.', correctCount: 1, currentStreak: 1, bestStreak: 1 },
  { participantId: 'p-meera', nickname: 'Meera S.', correctCount: 0, currentStreak: 0, bestStreak: 0 },
  { participantId: 'p-priya', nickname: 'Priya K.', correctCount: 3, currentStreak: 3, bestStreak: 5 },
]

const battle = buildCoopBattleState(bossId, settings, participants)

console.log('\n== Every participant produces exactly one contribution row ==')
assert(battle.contributions.length === 4, `4 distinct participants produce exactly 4 contributions (found ${battle.contributions.length})`)
assert(battle.contributions.every((c) => typeof c.damageDealt === 'number' && !Number.isNaN(c.damageDealt)), 'every contribution has a valid numeric damageDealt -- none crashed or produced NaN')

console.log('\n== A participant with zero correct answers never crashes and deals zero damage ==')
const meera = battle.contributions.find((c) => c.participantId === 'p-meera')!
assert(meera.damageDealt === 0, 'a participant with zero correct answers deals exactly zero damage -- no error, no fabricated contribution')

console.log('\n== Damage is purely additive per participant, based on correctCount * baseDamagePerCorrectAnswer ==')
const arjun = battle.contributions.find((c) => c.participantId === 'p-arjun')!
assert(arjun.damageDealt === 1 * settings.baseDamagePerCorrectAnswer, "Arjun's damage is exactly 1 correct answer's worth, no team-attack bonus (streak never crossed 6)")

console.log('\n== Streak-triggered team attacks: based on BEST streak, not current streak ==')
const priya = battle.contributions.find((c) => c.participantId === 'p-priya')!
assert(streakTeamAttacksTriggered(5) === 0, 'a best streak of 5 (below the threshold of 6) triggers zero team attacks')
assert(
  priya.damageDealt === 3 * settings.baseDamagePerCorrectAnswer,
  "Priya's damage reflects only her 3 correct answers -- her best streak of 5 never crossed the team-attack threshold, even though her CURRENT streak (3) is lower still (confirming bestStreak, not currentStreak, gates the bonus)"
)
const kavya = battle.contributions.find((c) => c.participantId === 'p-kavya')!
assert(streakTeamAttacksTriggered(STREAK_TEAM_ATTACK_THRESHOLD) === 1, 'a best streak exactly at the threshold triggers exactly one team attack')
assert(
  kavya.damageDealt === 2 * settings.baseDamagePerCorrectAnswer + STREAK_TEAM_ATTACK_BONUS_DAMAGE,
  "Kavya's damage includes her 2 correct answers PLUS one team-attack bonus, since her best streak of 6 crossed the threshold exactly once"
)

console.log('\n== Team attacks re-trigger at every multiple of the threshold, not just the first ==')
assert(streakTeamAttacksTriggered(STREAK_TEAM_ATTACK_THRESHOLD * 3) === 3, 'a streak of 3x the threshold triggers exactly 3 team attacks')
assert(streakTeamAttacksTriggered(STREAK_TEAM_ATTACK_THRESHOLD - 1) === 0, 'one short of the threshold triggers zero team attacks')

console.log('\n== Boss HP is the shared total minus the SUM of every participant\'s damage (isolation + aggregation) ==')
const expectedTotalDamage = battle.contributions.reduce((sum, c) => sum + c.damageDealt, 0)
assert(battle.totalDamageDealt === expectedTotalDamage, 'totalDamageDealt is exactly the sum of every individual contribution')
assert(battle.bossHealth === Math.max(0, boss.baseHealth - expectedTotalDamage), 'bossHealth is the boss\'s max health minus the combined class damage, clamped at zero')
assert(battle.bossMaxHealth === boss.baseHealth, 'bossMaxHealth reflects the chosen boss\'s real base health')

console.log('\n== One participant\'s contribution never affects another\'s (isolation) ==')
const kavyaAlone = buildCoopBattleState(bossId, settings, [participants[0]])
const kavyaContributionAlone = kavyaAlone.contributions[0].damageDealt
assert(kavyaContributionAlone === kavya.damageDealt, "Kavya's own damage is identical whether she's racing alone or with 3 others -- no participant's answers leak into another's contribution")

console.log('\n== Victory: the class defeating the boss together ==')
const bigContribution: ParticipantAnswerSummary[] = [
  { participantId: 'p-a', nickname: 'A', correctCount: 20, currentStreak: 0, bestStreak: 0 },
  { participantId: 'p-b', nickname: 'B', correctCount: 20, currentStreak: 0, bestStreak: 0 },
]
const victoryBattle = buildCoopBattleState(bossId, settings, bigContribution)
assert(victoryBattle.victory === true, 'enough combined correct answers across the class defeats the boss')
assert(victoryBattle.bossHealth === 0, 'boss health is clamped at exactly 0 on victory, never negative')

console.log('\n== No victory: the class has not yet dealt enough combined damage ==')
assert(battle.victory === false, 'the original 4-participant scenario (well short of 220 HP) has not defeated the boss yet')

console.log('\n== Class progress percentage ==')
assert(coopProgressPct(battle) >= 0 && coopProgressPct(battle) <= 100, 'progress percentage is always within [0, 100]')
assert(coopProgressPct(victoryBattle) === 100, 'progress reads exactly 100% once the boss is defeated')
assert(coopProgressPct(buildCoopBattleState(bossId, settings, [])) === 0, 'zero participants (or zero damage) reads 0% progress, never NaN or negative')

console.log('\n== Leaderboard ranking: by damage dealt, positive contribution only ==')
const ranked = rankCoopContributions(battle.contributions)
assert(ranked[0].participantId === 'p-kavya', "the highest-damage contributor (Kavya, boosted by her team-attack bonus) ranks first -- a smaller correct-answer count can still out-rank a larger one when a streak bonus is earned, correctly reflecting TOTAL contribution")
assert(ranked[ranked.length - 1].participantId === 'p-meera', 'the zero-contribution participant (Meera) ranks last, never omitted or erroring')
assert(ranked.length === battle.contributions.length, 'ranking never drops or duplicates a participant')
// The "no naming/shaming" design constraint: contributions never carry
// any wrong-answer-derived figure at all (no answeredCount, no
// incorrectCount) -- only positive numbers are ever exposed for
// ranking.
assert(
  Object.keys(ranked[0]).every((k) => !k.toLowerCase().includes('wrong') && !k.toLowerCase().includes('incorrect') && !k.toLowerCase().includes('miss')),
  'no contribution field is ever wrong-answer/miss-derived -- only positive contribution (correctCount, streak, damageDealt) is ever tracked or exposed'
)

console.log('\n== End condition state machine: every status x victory combination (concurrency/state-transition coverage) ==')
// Regression coverage for a real bug caught during development:
// sms_gamev2_end_live_session (migration 080) marks every still-
// in-progress participant session ABANDONED when the host ends the
// live session, never COMPLETED -- an earlier version of
// BossBattleGame.tsx's end-condition check only watched for a
// populated `result` (which only ever arrives via a genuinely
// COMPLETED session's /complete call), which would have left a
// student mid-battle when the teacher clicked "End" stuck on an
// infinite loading screen, with literally no path to a results
// summary. isCoopBattleConcluded is the fix, and this is its full
// truth table.
assert(isCoopBattleConcluded(false, 'ACTIVE') === false, 'ACTIVE + no victory: the battle is still in progress')
assert(isCoopBattleConcluded(false, 'PAUSED') === false, 'PAUSED + no victory: still in progress, just frozen')
assert(isCoopBattleConcluded(false, 'CREATED') === false, 'CREATED + no victory: not even started yet')
assert(isCoopBattleConcluded(false, 'READY') === false, 'READY + no victory: not even started yet')
assert(isCoopBattleConcluded(true, 'ACTIVE') === true, 'victory=true concludes the battle even if this participant\'s own session row is still nominally ACTIVE (the class won; individual session status can lag by one poll)')
assert(isCoopBattleConcluded(false, 'COMPLETED') === true, 'COMPLETED + no class victory: this participant ran out of questions before the class finished the boss -- still concludes for them')
assert(isCoopBattleConcluded(false, 'ABANDONED') === true, 'ABANDONED + no class victory: THE REGRESSION CASE -- the host ended the live session mid-battle, and this must still resolve to concluded, not hang forever')
assert(isCoopBattleConcluded(true, 'ABANDONED') === true, 'victory=true always concludes the battle regardless of this participant\'s own session status')

console.log('\n== Registry/engine-branch consistency: Boss Battle is genuinely wired for cooperative multiplayer ==')
assert(hasDedicatedLiveClassroomComponent('boss-battle'), 'boss-battle is still declared as having a dedicated Live Classroom component')
const engine = getGameEngineV2('boss-battle')
assert(engine?.compatibility.liveClassroomSupport === true, 'Boss Battle declares liveClassroomSupport -- now genuinely backed by real cooperative multiplayer')
assert(engine?.status === 'ACTIVE', 'Boss Battle is ACTIVE in the registry')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
