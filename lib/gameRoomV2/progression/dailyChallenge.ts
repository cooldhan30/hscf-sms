// Daily challenges -- a small, deterministic rotation of objectives
// (code, not a DB table, same reasoning as the achievement catalog).
// Which challenge is "today's" is a pure function of the date, so every
// student sees the identical challenge on a given day with no
// scheduling job needed, and the choice is fully reproducible for
// tests.
export type DailyChallengeGoalType = 'complete-sessions' | 'correct-answers' | 'play-engine'

export interface DailyChallengeDefinition {
  id: string
  name: string
  description: string
  goalType: DailyChallengeGoalType
  goalCount: number
  // Only meaningful for goalType 'play-engine' -- null otherwise (any
  // engine counts).
  engineId: string | null
  xpReward: number
  coinsReward: number
}

export const DAILY_CHALLENGES: DailyChallengeDefinition[] = [
  {
    id: 'daily-three-games',
    name: 'Triple Play',
    description: 'Complete 3 GameRoom sessions today.',
    goalType: 'complete-sessions',
    goalCount: 3,
    engineId: null,
    xpReward: 30,
    coinsReward: 10,
  },
  {
    id: 'daily-twenty-correct',
    name: 'Sharp Mind',
    description: 'Answer 20 questions correctly today.',
    goalType: 'correct-answers',
    goalCount: 20,
    engineId: null,
    xpReward: 40,
    coinsReward: 12,
  },
  {
    id: 'daily-one-game',
    name: 'Quick Practice',
    description: 'Complete 1 GameRoom session today.',
    goalType: 'complete-sessions',
    goalCount: 1,
    engineId: null,
    xpReward: 15,
    coinsReward: 5,
  },
  {
    id: 'daily-ten-correct',
    name: 'Steady Progress',
    description: 'Answer 10 questions correctly today.',
    goalType: 'correct-answers',
    goalCount: 10,
    engineId: null,
    xpReward: 20,
    coinsReward: 8,
  },
]

// A stable day-number so the rotation is deterministic and never
// depends on timezone-sensitive Date math beyond parsing the date
// string itself.
function dayNumber(dateIso: string): number {
  return Math.floor(new Date(`${dateIso}T00:00:00Z`).getTime() / (24 * 60 * 60 * 1000))
}

export function dailyChallengeForDate(dateIso: string): DailyChallengeDefinition {
  const index = ((dayNumber(dateIso) % DAILY_CHALLENGES.length) + DAILY_CHALLENGES.length) % DAILY_CHALLENGES.length
  return DAILY_CHALLENGES[index]
}

export interface DailyChallengeProgress {
  challengeId: string
  progressCount: number
  goalCount: number
  completed: boolean
}

// Applies today's session outcome to the day's challenge progress.
// Pure function: given the challenge, the progress so far, and this
// session's outcome, returns the new progress -- never awards the
// challenge's XP/coins itself (that's the reward service's job, exactly
// once, when completed flips from false to true).
export function applyDailyChallengeProgress(
  challenge: DailyChallengeDefinition,
  previousCount: number,
  session: { engineId: string; correctCount: number }
): DailyChallengeProgress {
  let increment = 0
  switch (challenge.goalType) {
    case 'complete-sessions':
      increment = 1
      break
    case 'correct-answers':
      increment = session.correctCount
      break
    case 'play-engine':
      increment = challenge.engineId === session.engineId ? 1 : 0
      break
  }

  const progressCount = Math.min(challenge.goalCount, previousCount + increment)
  return {
    challengeId: challenge.id,
    progressCount,
    goalCount: challenge.goalCount,
    completed: progressCount >= challenge.goalCount,
  }
}
