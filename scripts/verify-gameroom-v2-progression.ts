// Standalone verification script for GameRoom V2's shared progression
// system (lib/gameRoomV2/progression/*): the level curve, achievement
// catalog + evaluation rules, the engine-milestone server-side proxy
// (abuse protection for engine achievements), daily practice streaks,
// and daily challenges. Same tsx-script convention as every other
// verify-gameroom-v2-*.ts script.
//
// Run with: npx tsx scripts/verify-gameroom-v2-progression.ts

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { xpRequiredForLevel, levelForXp } from '../lib/gameRoomV2/progression/levels'
import { ACHIEVEMENTS, getAchievement } from '../lib/gameRoomV2/progression/achievements'
import { evaluateAchievements, achievementIdsWithoutRules, ruleIdsWithoutAchievements, type AchievementContext } from '../lib/gameRoomV2/progression/achievementRules'
import { computeEngineMilestone } from '../lib/gameRoomV2/progression/engineMilestone'
import { applyDailyActivity } from '../lib/gameRoomV2/progression/streaks'
import { DAILY_CHALLENGES, dailyChallengeForDate, applyDailyChallengeProgress } from '../lib/gameRoomV2/progression/dailyChallenge'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

function baseContext(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    sessionsCompletedTotal: 0,
    correctAnswersTotal: 0,
    currentDailyStreak: 0,
    sessionAccuracyPct: 0,
    sessionAnsweredCount: 0,
    sessionCorrectCount: 0,
    engineId: 'classic-quiz',
    enginesPlayed: [],
    totalActiveEngineCount: 6,
    engineMilestoneReached: false,
    questionSetCompletionCount: 1,
    alreadyEarnedIds: [],
    ...overrides,
  }
}

console.log('== Level curve: one shared, monotonic, zero-based ==')
assert(xpRequiredForLevel(1) === 0, 'level 1 requires 0 XP -- every brand-new student starts here')
assert(xpRequiredForLevel(2) > xpRequiredForLevel(1), 'each level requires strictly more XP than the last')
assert(xpRequiredForLevel(5) > xpRequiredForLevel(4), 'the curve keeps increasing at higher levels too')
assert(levelForXp(0).level === 1, '0 XP is level 1')
assert(levelForXp(-50).level === 1, 'negative XP (should never happen, but never throws) clamps to level 1')
const lvl2 = levelForXp(xpRequiredForLevel(2))
assert(lvl2.level === 2, 'exactly the XP required for level 2 IS level 2')
assert(lvl2.xpIntoCurrentLevel === 0, 'landing exactly on a level threshold shows 0 XP into that level')
const midLevel = levelForXp(xpRequiredForLevel(3) - 10)
assert(midLevel.level === 2, '10 XP short of level 3 is still level 2')
assert(midLevel.xpNeededForNextLevel === xpRequiredForLevel(3) - xpRequiredForLevel(2), 'xpNeededForNextLevel matches the actual gap between levels')

console.log('\n== Achievement catalog integrity ==')
assert(ACHIEVEMENTS.length >= 15, `at least 15 achievements declared (found ${ACHIEVEMENTS.length})`)
assert(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'every achievement has a unique id')
assert(achievementIdsWithoutRules().length === 0, `every catalog achievement has a matching rule (missing: ${achievementIdsWithoutRules().join(', ')})`)
assert(ruleIdsWithoutAchievements().length === 0, `every rule has a matching catalog entry (orphaned: ${ruleIdsWithoutAchievements().join(', ')})`)
for (const a of ACHIEVEMENTS) {
  assert(a.teacherDescription.length > 10, `${a.name}'s teacher description is a real sentence, not a placeholder`)
  assert(!/\bwpm\b|\bcombo\b|\baggro\b|\bdps\b/i.test(a.teacherDescription), `${a.name}'s teacher description avoids opaque game-internal jargon a teacher wouldn't recognize`)
}
assert(getAchievement('first-game')?.id === 'first-game', "getAchievement('first-game') resolves")
assert(getAchievement('does-not-exist') === undefined, 'getAchievement returns undefined for an unknown id')

console.log('\n== Achievement rules: milestones ==')
assert(evaluateAchievements(baseContext({ sessionsCompletedTotal: 1 })).some((r) => r.achievementId === 'first-game'), 'completing 1 session earns First Game')
assert(!evaluateAchievements(baseContext({ sessionsCompletedTotal: 1, alreadyEarnedIds: ['first-game'] })).some((r) => r.achievementId === 'first-game'), 'an already-earned achievement is never re-granted')
assert(evaluateAchievements(baseContext({ sessionsCompletedTotal: 10 })).some((r) => r.achievementId === 'ten-games'), '10 sessions earns 10 Games Completed')
assert(!evaluateAchievements(baseContext({ sessionsCompletedTotal: 9 })).some((r) => r.achievementId === 'ten-games'), '9 sessions does NOT earn 10 Games Completed')
assert(evaluateAchievements(baseContext({ sessionsCompletedTotal: 50 })).some((r) => r.achievementId === 'fifty-games'), '50 sessions earns 50 Games Completed')

console.log('\n== Achievement rules: accuracy ==')
assert(
  evaluateAchievements(baseContext({ sessionAnsweredCount: 10, sessionCorrectCount: 10 })).some((r) => r.achievementId === 'perfect-score'),
  'every question correct in a session earns Perfect Score'
)
assert(
  !evaluateAchievements(baseContext({ sessionAnsweredCount: 10, sessionCorrectCount: 9 })).some((r) => r.achievementId === 'perfect-score'),
  'one wrong answer does NOT earn Perfect Score'
)
assert(
  !evaluateAchievements(baseContext({ sessionAnsweredCount: 0, sessionCorrectCount: 0 })).some((r) => r.achievementId === 'perfect-score'),
  'a session with zero answered questions never earns Perfect Score (0/0 is not a perfect score)'
)
assert(evaluateAchievements(baseContext({ correctAnswersTotal: 100 })).some((r) => r.achievementId === 'hundred-correct'), '100 lifetime correct answers earns 100 Correct Answers')
assert(evaluateAchievements(baseContext({ correctAnswersTotal: 500 })).some((r) => r.achievementId === 'five-hundred-correct'), '500 lifetime correct answers earns 500 Correct Answers')

console.log('\n== Achievement rules: consistency (daily streaks) ==')
assert(evaluateAchievements(baseContext({ currentDailyStreak: 3 })).some((r) => r.achievementId === 'three-day-streak'), '3-day streak earns the 3-Day Practice Streak achievement')
assert(evaluateAchievements(baseContext({ currentDailyStreak: 7 })).some((r) => r.achievementId === 'seven-day-streak'), '7-day streak earns the 7-Day Practice Streak achievement')
assert(!evaluateAchievements(baseContext({ currentDailyStreak: 6 })).some((r) => r.achievementId === 'seven-day-streak'), '6-day streak does NOT earn the 7-day achievement')
assert(evaluateAchievements(baseContext({ currentDailyStreak: 30 })).some((r) => r.achievementId === 'thirty-day-streak'), '30-day streak earns the 30-Day Practice Streak achievement')

console.log('\n== Achievement rules: per-engine (server-verified milestone, never a client claim) ==')
assert(evaluateAchievements(baseContext({ engineId: 'word-ninja' })).some((r) => r.achievementId === 'grammar-explorer'), 'any completed Word Ninja session earns Grammar Explorer')
assert(
  !evaluateAchievements(baseContext({ engineId: 'word-ninja', engineMilestoneReached: false })).some((r) => r.achievementId === 'word-master'),
  'Word Master requires the server-verified milestone, not just playing the engine'
)
assert(
  evaluateAchievements(baseContext({ engineId: 'word-ninja', engineMilestoneReached: true })).some((r) => r.achievementId === 'word-master'),
  'a verified milestone in Word Ninja earns Word Master'
)
assert(
  evaluateAchievements(baseContext({ engineId: 'tower-defense', engineMilestoneReached: true })).some((r) => r.achievementId === 'tower-defender'),
  'a verified milestone in Tower Defense earns Tower Defender'
)
assert(
  !evaluateAchievements(baseContext({ engineId: 'racing', engineMilestoneReached: true })).some((r) => r.achievementId === 'tower-defender'),
  'a milestone in a DIFFERENT engine never earns another engine\'s achievement'
)
assert(
  evaluateAchievements(baseContext({ engineId: 'boss-battle', engineMilestoneReached: true })).some((r) => r.achievementId === 'boss-slayer'),
  'a verified milestone in Boss Battle earns Boss Slayer'
)
assert(
  evaluateAchievements(baseContext({ engineId: 'treasure-quest', engineMilestoneReached: true })).some((r) => r.achievementId === 'treasure-hunter'),
  'a verified milestone in Treasure Quest earns Treasure Hunter'
)
assert(
  evaluateAchievements(baseContext({ engineId: 'racing', engineMilestoneReached: true })).some((r) => r.achievementId === 'checkered-flag'),
  'a verified milestone in Racing earns Checkered Flag'
)

console.log('\n== Achievement rules: mastery (breadth, repetition) ==')
const allEngines = GAME_ENGINES_V2.filter((e) => e.status === 'ACTIVE').map((e) => e.id)
assert(
  evaluateAchievements(baseContext({ enginesPlayed: allEngines, totalActiveEngineCount: allEngines.length })).some((r) => r.achievementId === 'well-rounded'),
  'having played every active engine earns Well-Rounded Player'
)
assert(
  !evaluateAchievements(baseContext({ enginesPlayed: allEngines.slice(0, -1), totalActiveEngineCount: allEngines.length })).some((r) => r.achievementId === 'well-rounded'),
  'missing even one active engine does NOT earn Well-Rounded Player'
)
assert(evaluateAchievements(baseContext({ questionSetCompletionCount: 3 })).some((r) => r.achievementId === 'set-champion'), 'completing the same Question Set 3 times earns Question Set Champion')
assert(!evaluateAchievements(baseContext({ questionSetCompletionCount: 2 })).some((r) => r.achievementId === 'set-champion'), '2 completions does NOT earn Question Set Champion')

console.log('\n== Abuse protection: engine milestone is a server-verified proxy, not a client claim ==')
assert(
  computeEngineMilestone({ answeredCount: 10, totalQuestions: 10, correctCount: 10, lives: 3, maxLives: 3 }) === true,
  'every question answered, all correct, no lives lost -- a genuine strong clear'
)
assert(
  computeEngineMilestone({ answeredCount: 10, totalQuestions: 10, correctCount: 9, lives: 3, maxLives: 3 }) === false,
  'even one wrong answer fails the milestone -- cannot be faked by mostly playing well'
)
assert(
  computeEngineMilestone({ answeredCount: 10, totalQuestions: 10, correctCount: 10, lives: 1, maxLives: 3 }) === false,
  'losing lives along the way fails the milestone even with a perfect final answer tally'
)
assert(
  computeEngineMilestone({ answeredCount: 5, totalQuestions: 10, correctCount: 5, lives: 3, maxLives: 3 }) === false,
  'abandoning early (fewer answered than total questions) never earns the milestone'
)
assert(computeEngineMilestone({ answeredCount: 0, totalQuestions: 0, correctCount: 0, lives: 3, maxLives: 3 }) === false, 'a session with zero questions never earns the milestone')

console.log('\n== Daily practice streaks: consecutive DAYS, not consecutive answers ==')
const firstEver = applyDailyActivity('2026-01-01', { lastActiveDate: null, currentDailyStreak: 0, bestDailyStreak: 0 })
assert(firstEver.currentDailyStreak === 1, 'a student\'s very first active day starts a streak of 1')
const sameDayAgain = applyDailyActivity('2026-01-01', { lastActiveDate: '2026-01-01', currentDailyStreak: 1, bestDailyStreak: 1 })
assert(sameDayAgain.currentDailyStreak === 1, 'playing a second session on the SAME day does not double-count the streak')
const consecutiveDay = applyDailyActivity('2026-01-02', { lastActiveDate: '2026-01-01', currentDailyStreak: 1, bestDailyStreak: 1 })
assert(consecutiveDay.currentDailyStreak === 2, 'playing the very next calendar day continues the streak')
const gapDay = applyDailyActivity('2026-01-05', { lastActiveDate: '2026-01-01', currentDailyStreak: 3, bestDailyStreak: 3 })
assert(gapDay.currentDailyStreak === 1, 'missing a day resets the streak to 1, no partial credit')
assert(gapDay.bestDailyStreak === 3, 'the BEST streak is preserved even after a reset -- past achievement is not erased')
const newBest = applyDailyActivity('2026-01-05', { lastActiveDate: '2026-01-04', currentDailyStreak: 10, bestDailyStreak: 10 })
assert(newBest.bestDailyStreak === 11, 'a new personal-best streak updates bestDailyStreak')

console.log('\n== Daily challenges: deterministic rotation, server-computed progress ==')
assert(DAILY_CHALLENGES.length >= 2, `at least 2 challenge variants exist for rotation variety (found ${DAILY_CHALLENGES.length})`)
const challengeA = dailyChallengeForDate('2026-03-01')
const challengeB = dailyChallengeForDate('2026-03-01')
assert(challengeA.id === challengeB.id, 'the same date always resolves to the same challenge -- fully deterministic')
const challengeNextDay = dailyChallengeForDate('2026-03-02')
assert(Boolean(challengeNextDay.id), 'the rotation resolves a real challenge for the next calendar day too')

const sessionsChallenge = DAILY_CHALLENGES.find((c) => c.goalType === 'complete-sessions' && c.goalCount > 1)!
const progress1 = applyDailyChallengeProgress(sessionsChallenge, 0, { engineId: 'classic-quiz', correctCount: 5 })
assert(progress1.progressCount === 1 && !progress1.completed, 'completing 1 of N sessions makes partial progress, not yet complete')
let progress = { progressCount: 0 }
for (let i = 0; i < sessionsChallenge.goalCount; i++) {
  progress = applyDailyChallengeProgress(sessionsChallenge, progress.progressCount, { engineId: 'classic-quiz', correctCount: 1 })
}
assert(progress.progressCount === sessionsChallenge.goalCount, 'reaching the goal count completes the challenge')

const correctAnswersChallenge = DAILY_CHALLENGES.find((c) => c.goalType === 'correct-answers')!
const overshoot = applyDailyChallengeProgress(correctAnswersChallenge, correctAnswersChallenge.goalCount - 2, { engineId: 'classic-quiz', correctCount: 100 })
assert(overshoot.progressCount === correctAnswersChallenge.goalCount, 'progress never exceeds the goal count even if a single session answers far more than needed')
assert(overshoot.completed, 'overshooting the goal still correctly marks the challenge completed')

console.log('\n== Abuse protection: reward centralization -- no game engine can award its own currency ==')
// The concrete, filesystem-level proof behind "do not let individual
// game clients arbitrarily award currency": scans every file under
// each engine's own lib/gameRoomV2/<engine>/ and
// components/gameRoomV2/<engine>/ directories for ANY reference to
// Supabase (a database client, an .rpc(...) call) -- if a future
// engine ever tried to call the reward RPCs directly instead of
// emitting a result through the shared session routes, this fails
// immediately rather than relying on code review to catch it.
const ROOT = join(__dirname, '..')
const ENGINE_DIRS = [
  'lib/gameRoomV2/towerDefense',
  'lib/gameRoomV2/racing',
  'lib/gameRoomV2/bossBattle',
  'lib/gameRoomV2/treasureQuest',
  'lib/gameRoomV2/wordNinja',
  'components/gameRoomV2/towerDefense',
  'components/gameRoomV2/racing',
  'components/gameRoomV2/bossBattle',
  'components/gameRoomV2/treasureQuest',
  'components/gameRoomV2/wordNinja',
]

function listFiles(relDir: string): string[] {
  try {
    return execSync(`git ls-files -- "${relDir}"`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

let engineFilesScanned = 0
const violations: string[] = []
for (const dir of ENGINE_DIRS) {
  for (const file of listFiles(dir)) {
    engineFilesScanned++
    const content = readFileSync(join(ROOT, file), 'utf8')
    // Strip line comments before checking, so a comment MENTIONING
    // supabase (e.g. explaining an architectural boundary, as several
    // engine files do) never counts as a violation -- only an actual
    // import/call does.
    const codeOnly = content
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n')
    if (/supabase|createClient|\.rpc\(/.test(codeOnly)) {
      violations.push(file)
    }
  }
}
assert(engineFilesScanned > 20, `scanned a real, non-trivial number of engine files (${engineFilesScanned})`)
assert(violations.length === 0, `no engine file references Supabase/RPC calls directly (violations: ${violations.join(', ') || 'none'})`)

// The reward service itself must be the place that owns the SECURITY
// DEFINER RPC names -- if a route ever bypassed it and called the RPCs
// itself, that would reintroduce exactly the "individual routes award
// currency" pattern the reward service exists to prevent.
const rewardServiceSource = readFileSync(join(ROOT, 'lib/gameRoomV2/rewards/rewardService.ts'), 'utf8')
assert(rewardServiceSource.includes('sms_gamev2_apply_session_rewards'), 'the reward service is the one place that calls sms_gamev2_apply_session_rewards')
assert(rewardServiceSource.includes('sms_gamev2_apply_progression'), 'the reward service is the one place that calls sms_gamev2_apply_progression')
assert(rewardServiceSource.includes('sms_gamev2_apply_daily_challenge_progress'), 'the reward service is the one place that calls sms_gamev2_apply_daily_challenge_progress')

const completeRouteSource = readFileSync(join(ROOT, 'app/api/gameroom-v2/sessions/[id]/complete/route.ts'), 'utf8')
assert(!completeRouteSource.includes('.rpc('), 'the /complete route itself never calls an RPC directly -- it delegates entirely to finalizeSessionRewards()')
assert(completeRouteSource.includes('finalizeSessionRewards'), 'the /complete route calls the centralized reward service')

const answerRouteSource = readFileSync(join(ROOT, 'app/api/gameroom-v2/sessions/[id]/answer/route.ts'), 'utf8')
assert(!answerRouteSource.includes('sms_gamev2_player_stats'), 'the /answer route never touches the durable ledger table -- only session-local running totals')
assert(!answerRouteSource.includes('.rpc('), 'the /answer route never calls any reward RPC -- rewards are only ever finalized once, at /complete')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
