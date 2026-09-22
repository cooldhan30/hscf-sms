import { EMPTY_RESOURCES, addResources, canAfford, spendResources, resourcesEarnedForAnswer, type ResourceBundle } from './resources'
import { BUILD_ORDER, nextBuildingToConstruct, isKingdomComplete, type BuildingId } from './buildings'
import type { KingdomBuilderDifficultySettings } from './difficulty'

// Correct-answer streaks unlock visual upgrade tiers -- purely
// cosmetic (a glow/sparkle intensity level the scene renders), never a
// gameplay-mechanical bonus, so a student who breaks a streak loses
// nothing but the current tier's shine, never resources or buildings
// already earned.
export const STREAK_UPGRADE_TIERS = [0, 3, 6, 10] as const
export type StreakUpgradeTier = 0 | 1 | 2 | 3

export function streakUpgradeTier(currentStreak: number): StreakUpgradeTier {
  if (currentStreak >= STREAK_UPGRADE_TIERS[3]) return 3
  if (currentStreak >= STREAK_UPGRADE_TIERS[2]) return 2
  if (currentStreak >= STREAK_UPGRADE_TIERS[1]) return 1
  return 0
}

export interface KingdomState {
  difficulty: KingdomBuilderDifficultySettings['id']
  resources: ResourceBundle
  builtIds: BuildingId[]
  currentStreak: number
  bestStreak: number
  correctAnswerCount: number
  wrongAnswerCount: number
  // The building that just finished construction this turn, if any --
  // read once by the UI to trigger its "just completed" celebration
  // animation, then cleared, so the same construction doesn't
  // re-celebrate on every subsequent render.
  justCompletedId: BuildingId | null
}

export function createInitialKingdom(settings: KingdomBuilderDifficultySettings): KingdomState {
  return {
    difficulty: settings.id,
    resources: EMPTY_RESOURCES,
    builtIds: [],
    currentStreak: 0,
    bestStreak: 0,
    correctAnswerCount: 0,
    wrongAnswerCount: 0,
    justCompletedId: null,
  }
}

function scaleReward(reward: Partial<ResourceBundle>, multiplier: number): Partial<ResourceBundle> {
  const scaled: Partial<ResourceBundle> = {}
  for (const [key, value] of Object.entries(reward) as [keyof ResourceBundle, number][]) {
    scaled[key] = Math.max(1, Math.round(value * multiplier))
  }
  return scaled
}

// Applies a correct answer's resource reward, then auto-constructs the
// next building in sequence the moment it becomes affordable --
// construction is never a separate player action, it happens
// automatically as soon as earned resources allow it, so answering
// correctly is the ENTIRE build mechanic (no extra clicking/spending
// UI to get in the way of the core "correct answers grow your
// kingdom" loop the spec describes).
export function applyCorrectAnswer(state: KingdomState, settings: KingdomBuilderDifficultySettings): KingdomState {
  const reward = scaleReward(resourcesEarnedForAnswer(state.correctAnswerCount), settings.resourceMultiplier)
  let resources = addResources(state.resources, reward)
  let builtIds = state.builtIds
  let justCompletedId: BuildingId | null = null

  const next = nextBuildingToConstruct(builtIds)
  if (next && canAfford(resources, next.cost)) {
    resources = spendResources(resources, next.cost)
    builtIds = [...builtIds, next.id]
    justCompletedId = next.id
  }

  const nextStreak = state.currentStreak + 1
  return {
    ...state,
    resources,
    builtIds,
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    correctAnswerCount: state.correctAnswerCount + 1,
    justCompletedId,
  }
}

// A wrong answer under Builder/Architect costs a small resource
// setback -- but NEVER removes a building already standing and NEVER
// drops any resource below what the current buildings already cost
// (i.e. it can only ever eat into resources saved up toward the NEXT
// building, never claw back a completed one). This is the concrete
// mechanism behind "incorrect answers should allow recovery without
// destroying previously earned progress": progress already built is
// permanent, full stop.
const WRONG_ANSWER_RESOURCE_PENALTY: Partial<ResourceBundle> = { coins: 2, wood: 1, stone: 1 }

export function applyWrongAnswer(state: KingdomState, settings: KingdomBuilderDifficultySettings): KingdomState {
  if (!settings.wrongAnswerCostsResources) {
    return { ...state, currentStreak: 0, wrongAnswerCount: state.wrongAnswerCount + 1, justCompletedId: null }
  }

  const penalized: ResourceBundle = {
    coins: Math.max(0, state.resources.coins - (WRONG_ANSWER_RESOURCE_PENALTY.coins ?? 0)),
    wood: Math.max(0, state.resources.wood - (WRONG_ANSWER_RESOURCE_PENALTY.wood ?? 0)),
    stone: Math.max(0, state.resources.stone - (WRONG_ANSWER_RESOURCE_PENALTY.stone ?? 0)),
    stars: state.resources.stars,
  }

  return {
    ...state,
    resources: penalized,
    currentStreak: 0,
    wrongAnswerCount: state.wrongAnswerCount + 1,
    justCompletedId: null,
  }
}

// Clears the one-shot "just completed" flag once the UI has played its
// celebration animation for it.
export function acknowledgeCompletion(state: KingdomState): KingdomState {
  if (!state.justCompletedId) return state
  return { ...state, justCompletedId: null }
}

export function kingdomProgressPct(state: KingdomState): number {
  return Math.round((state.builtIds.length / BUILD_ORDER.length) * 100)
}

export function kingdomComplete(state: KingdomState): boolean {
  return isKingdomComplete(state.builtIds)
}
