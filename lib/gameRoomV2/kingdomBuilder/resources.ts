// The four resources correct answers earn -- deliberately generic
// fantasy-kingdom resources (coins/wood/stone/stars), never anything
// with a religious connotation, per the "no religious gameplay
// mechanics" requirement. `stars` is the rarest, reserved for the
// late-game castle -- see buildings.ts's ResourceCost.
export type ResourceKind = 'coins' | 'wood' | 'stone' | 'stars'

export interface ResourceBundle {
  coins: number
  wood: number
  stone: number
  stars: number
}

export const EMPTY_RESOURCES: ResourceBundle = { coins: 0, wood: 0, stone: 0, stars: 0 }

export function addResources(base: ResourceBundle, delta: Partial<ResourceBundle>): ResourceBundle {
  return {
    coins: base.coins + (delta.coins ?? 0),
    wood: base.wood + (delta.wood ?? 0),
    stone: base.stone + (delta.stone ?? 0),
    stars: base.stars + (delta.stars ?? 0),
  }
}

export function canAfford(available: ResourceBundle, cost: Partial<ResourceBundle>): boolean {
  return (
    available.coins >= (cost.coins ?? 0) &&
    available.wood >= (cost.wood ?? 0) &&
    available.stone >= (cost.stone ?? 0) &&
    available.stars >= (cost.stars ?? 0)
  )
}

export function spendResources(available: ResourceBundle, cost: Partial<ResourceBundle>): ResourceBundle {
  return {
    coins: available.coins - (cost.coins ?? 0),
    wood: available.wood - (cost.wood ?? 0),
    stone: available.stone - (cost.stone ?? 0),
    stars: available.stars - (cost.stars ?? 0),
  }
}

// A correct answer's resource reward, cycling through the four kinds
// deterministically by the running correct-answer count -- not
// Math.random(), matching Treasure Quest's keysEarnedForAnswer and
// Space Mission's streakThrustMultiplier precedent for testable, not
// randomized, earn logic. Coins are the most frequent (every correct
// answer), wood/stone alternate on top, stars are the rarest (every
// 4th correct answer) since they gate the final castle.
export function resourcesEarnedForAnswer(correctAnswerCountBefore: number): Partial<ResourceBundle> {
  const n = correctAnswerCountBefore
  const reward: Partial<ResourceBundle> = { coins: 4 }
  if (n % 2 === 0) reward.wood = 3
  else reward.stone = 3
  if (n % 4 === 3) reward.stars = 1
  return reward
}
