// Four genuinely different tower archetypes, each with three levels.
// Ranges are in grid cells, fire intervals in milliseconds.
export type TowerTypeId = 'vel' | 'yanai' | 'pani' | 'kuri'
export type TargetingMode = 'first' | 'strongest' | 'closest'

export interface TowerLevelStats {
  damage: number
  range: number
  fireIntervalMs: number
  // Cannon: enemies within this radius of the impact take full damage.
  splashRadius: number
  // Frost: enemies in range move at this fraction of their speed.
  slowFactor: number
  // Sniper: ignores enemy armour.
  armorPiercing: boolean
  projectileSpeed: number // cells per second (0 = instant pulse)
}

export interface TowerType {
  id: TowerTypeId
  name: string
  tamilName: string
  role: string
  description: string
  cost: number
  // upgradeCosts[i] is the price of going from level i+1 to i+2.
  upgradeCosts: [number, number]
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats]
  defaultTargeting: TargetingMode
  color: string
}

export const MAX_TOWER_LEVEL = 3
export const SELL_REFUND_RATIO = 0.6

export const TOWER_TYPES: TowerType[] = [
  {
    id: 'vel',
    name: 'Vel Tower',
    tamilName: 'வேல் கோபுரம்',
    role: 'Rapid',
    description: 'Throws spears fast at a single enemy. Great against swarms and scouts; armour blunts it.',
    cost: 50,
    upgradeCosts: [45, 80],
    levels: [
      { damage: 7, range: 2.6, fireIntervalMs: 450, splashRadius: 0, slowFactor: 1, armorPiercing: false, projectileSpeed: 12 },
      { damage: 11, range: 2.8, fireIntervalMs: 380, splashRadius: 0, slowFactor: 1, armorPiercing: false, projectileSpeed: 13 },
      { damage: 17, range: 3.1, fireIntervalMs: 300, splashRadius: 0, slowFactor: 1, armorPiercing: false, projectileSpeed: 14 },
    ],
    defaultTargeting: 'first',
    color: '#0f766e',
  },
  {
    id: 'yanai',
    name: 'Yanai Cannon',
    tamilName: 'யானை பீரங்கி',
    role: 'Area',
    description: 'Slow, heavy stone shots that hit every enemy near the impact. Best on bends where enemies bunch up.',
    cost: 90,
    upgradeCosts: [70, 120],
    levels: [
      { damage: 26, range: 2.4, fireIntervalMs: 1600, splashRadius: 1.1, slowFactor: 1, armorPiercing: false, projectileSpeed: 6 },
      { damage: 40, range: 2.6, fireIntervalMs: 1450, splashRadius: 1.3, slowFactor: 1, armorPiercing: false, projectileSpeed: 6.5 },
      { damage: 62, range: 2.8, fireIntervalMs: 1300, splashRadius: 1.5, slowFactor: 1, armorPiercing: false, projectileSpeed: 7 },
    ],
    defaultTargeting: 'first',
    color: '#9a3412',
  },
  {
    id: 'pani',
    name: 'Pani Frost Shrine',
    tamilName: 'பனி மணி',
    role: 'Support',
    description: 'Rings a frost bell that slows every enemy in range and chips at them. Pairs well with the cannon.',
    cost: 70,
    upgradeCosts: [55, 95],
    levels: [
      { damage: 3, range: 2.0, fireIntervalMs: 1000, splashRadius: 0, slowFactor: 0.55, armorPiercing: false, projectileSpeed: 0 },
      { damage: 5, range: 2.3, fireIntervalMs: 900, splashRadius: 0, slowFactor: 0.45, armorPiercing: false, projectileSpeed: 0 },
      { damage: 8, range: 2.6, fireIntervalMs: 800, splashRadius: 0, slowFactor: 0.35, armorPiercing: false, projectileSpeed: 0 },
    ],
    defaultTargeting: 'first',
    color: '#0369a1',
  },
  {
    id: 'kuri',
    name: 'Kuri Archer',
    tamilName: 'குறி வில்லாளர்',
    role: 'Heavy',
    description: 'A long-range marksman whose arrows pierce armour. Targets the toughest enemy -- your answer to brutes and bosses.',
    cost: 110,
    upgradeCosts: [90, 150],
    levels: [
      { damage: 55, range: 4.2, fireIntervalMs: 2200, splashRadius: 0, slowFactor: 1, armorPiercing: true, projectileSpeed: 20 },
      { damage: 90, range: 4.8, fireIntervalMs: 2000, splashRadius: 0, slowFactor: 1, armorPiercing: true, projectileSpeed: 22 },
      { damage: 140, range: 5.4, fireIntervalMs: 1800, splashRadius: 0, slowFactor: 1, armorPiercing: true, projectileSpeed: 24 },
    ],
    defaultTargeting: 'strongest',
    color: '#6d28d9',
  },
]

export function getTowerType(id: TowerTypeId): TowerType {
  const t = TOWER_TYPES.find((tt) => tt.id === id)
  if (!t) throw new Error(`Unknown tower type: ${id}`)
  return t
}

export function statsFor(id: TowerTypeId, level: number): TowerLevelStats {
  const t = getTowerType(id)
  return t.levels[Math.min(Math.max(level, 1), MAX_TOWER_LEVEL) - 1]
}

export function upgradeCost(id: TowerTypeId, level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) return null
  return getTowerType(id).upgradeCosts[level - 1]
}

// Damage per second against an unarmoured target -- shown in the inspector.
export function dps(stats: TowerLevelStats): number {
  return Math.round((stats.damage * 1000) / stats.fireIntervalMs)
}
