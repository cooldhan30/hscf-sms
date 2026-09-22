import { ACHIEVEMENTS } from './achievements'

// Everything an achievement rule might need to decide "has this been
// earned yet" -- a plain snapshot, not a live DB connection, so every
// rule here is a pure function the reward service (and tests) can call
// with fabricated data. The reward service is the ONLY caller that
// assembles this from real queries; achievement rules never fetch
// anything themselves.
export interface AchievementContext {
  // Totals AFTER this session's rewards have been applied.
  sessionsCompletedTotal: number
  correctAnswersTotal: number
  currentDailyStreak: number
  // This session's own outcome.
  sessionAccuracyPct: number
  sessionAnsweredCount: number
  sessionCorrectCount: number
  engineId: string
  // Engine ids the student has now completed at least one session of
  // (including this one) -- used for "played every engine" and
  // per-engine "first clear" achievements.
  enginesPlayed: string[]
  totalActiveEngineCount: number
  // Whether THIS session counts as a strong clear of its engine --
  // computed entirely server-side from answer/lives data already
  // persisted on the session row (see rewardService.ts's
  // computeEngineMilestone), NEVER a client-reported claim. In-game
  // simulation state (wave number, boss phase, treasure found) lives
  // entirely client-side today, so there is no server-verifiable signal
  // for "did the player narratively finish the level" -- this is a
  // deliberate, server-only proxy for that (every question answered,
  // strong accuracy, no lives lost) rather than trusting the client to
  // say so.
  engineMilestoneReached: boolean
  // How many times (including this one) the student has fully
  // completed this exact Question Set.
  questionSetCompletionCount: number
  // Achievement ids the student has already earned -- rules never
  // re-grant one already present here.
  alreadyEarnedIds: string[]
}

export interface AchievementCheckResult {
  achievementId: string
  reason: string
}

// One rule per achievement id in ACHIEVEMENTS -- kept as a lookup table
// (not a giant if/else) so adding an achievement means adding one
// catalog entry AND one rule function, impossible to do only half of
// without evaluateAchievements below immediately flagging the mismatch
// in tests.
type AchievementRule = (ctx: AchievementContext) => boolean

const ENGINE_MILESTONE_ACHIEVEMENT_BY_ENGINE: Record<string, string> = {
  'tower-defense': 'tower-defender',
  'boss-battle': 'boss-slayer',
  'treasure-quest': 'treasure-hunter',
  racing: 'checkered-flag',
  'word-ninja': 'word-master',
}

const ACHIEVEMENT_RULES: Record<string, AchievementRule> = {
  'first-game': (ctx) => ctx.sessionsCompletedTotal >= 1,
  'ten-games': (ctx) => ctx.sessionsCompletedTotal >= 10,
  'fifty-games': (ctx) => ctx.sessionsCompletedTotal >= 50,
  'perfect-score': (ctx) => ctx.sessionAnsweredCount > 0 && ctx.sessionCorrectCount === ctx.sessionAnsweredCount,
  'hundred-correct': (ctx) => ctx.correctAnswersTotal >= 100,
  'five-hundred-correct': (ctx) => ctx.correctAnswersTotal >= 500,
  'three-day-streak': (ctx) => ctx.currentDailyStreak >= 3,
  'seven-day-streak': (ctx) => ctx.currentDailyStreak >= 7,
  'thirty-day-streak': (ctx) => ctx.currentDailyStreak >= 30,
  'grammar-explorer': (ctx) => ctx.engineId === 'word-ninja',
  'word-master': (ctx) => ctx.engineId === 'word-ninja' && ctx.engineMilestoneReached,
  'tower-defender': (ctx) => ctx.engineId === 'tower-defense' && ctx.engineMilestoneReached,
  'boss-slayer': (ctx) => ctx.engineId === 'boss-battle' && ctx.engineMilestoneReached,
  'treasure-hunter': (ctx) => ctx.engineId === 'treasure-quest' && ctx.engineMilestoneReached,
  'checkered-flag': (ctx) => ctx.engineId === 'racing' && ctx.engineMilestoneReached,
  'well-rounded': (ctx) => ctx.totalActiveEngineCount > 0 && ctx.enginesPlayed.length >= ctx.totalActiveEngineCount,
  'set-champion': (ctx) => ctx.questionSetCompletionCount >= 3,
}

// Confirms every catalog entry has exactly one rule and vice versa --
// exercised by verify-gameroom-v2-progression.ts so a future
// achievement added to the catalog without a rule (or a rule without a
// catalog entry) fails loudly instead of silently never firing.
export function achievementIdsWithoutRules(): string[] {
  return ACHIEVEMENTS.map((a) => a.id).filter((id) => !(id in ACHIEVEMENT_RULES))
}

export function ruleIdsWithoutAchievements(): string[] {
  return Object.keys(ACHIEVEMENT_RULES).filter((id) => !ACHIEVEMENTS.some((a) => a.id === id))
}

export { ENGINE_MILESTONE_ACHIEVEMENT_BY_ENGINE }

// Evaluates every achievement rule against the given context and
// returns the ones newly earned (never re-returns one already in
// alreadyEarnedIds) -- the single function the reward service calls
// after a session finalizes.
export function evaluateAchievements(ctx: AchievementContext): AchievementCheckResult[] {
  const earned: AchievementCheckResult[] = []
  for (const achievement of ACHIEVEMENTS) {
    if (ctx.alreadyEarnedIds.includes(achievement.id)) continue
    const rule = ACHIEVEMENT_RULES[achievement.id]
    if (rule && rule(ctx)) {
      earned.push({ achievementId: achievement.id, reason: achievement.teacherDescription })
    }
  }
  return earned
}
