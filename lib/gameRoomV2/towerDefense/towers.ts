// Tower Defense's 3 tower types -- pure data, no rendering. Names are
// original Tamil-flavored designs (not drawn from any lesson content --
// per the spec, Tower Defense must never embed Tamil lesson content
// itself; these are just flavor names for game pieces, same category as
// "Boss Battle"/"Kingdom Builder" naming elsewhere in the V2 registry).
export type TowerTypeId = 'vel' | 'yanai' | 'pani'

export interface TowerType {
  id: TowerTypeId
  name: string
  tamilName: string
  description: string
  cost: number
  upgradeCost: number
  // Base stats at level 1; upgrading scales these (see upgradedStats).
  damage: number
  range: number
  fireIntervalMs: number
  // Frost-chime only: multiplies enemy speed while in range (1 = no
  // effect). Every other tower leaves this at 1.
  slowFactor: number
  // Yanai-cannon only: damages every enemy within splashRadius of the
  // hit target, not just the target itself.
  splashRadius: number
}

export const TOWER_TYPES: TowerType[] = [
  {
    id: 'vel',
    name: 'Vel Spear Tower',
    tamilName: 'வேல் கோபுரம்',
    description: 'Fires rapidly at the nearest enemy. Low damage per hit, but relentless.',
    cost: 40,
    upgradeCost: 35,
    damage: 8,
    range: 3,
    fireIntervalMs: 500,
    slowFactor: 1,
    splashRadius: 0,
  },
  {
    id: 'yanai',
    name: 'Yanai Cannon',
    tamilName: 'யானை பீரங்கி',
    description: 'A heavy cannon that fires slowly but hits hard, damaging nearby enemies too.',
    cost: 70,
    upgradeCost: 60,
    damage: 30,
    range: 2.5,
    fireIntervalMs: 1800,
    slowFactor: 1,
    splashRadius: 1.2,
  },
  {
    id: 'pani',
    name: 'Pani Frost Chime',
    tamilName: 'பனி மணி',
    description: 'Chimes that slow every enemy passing through its range. Weak damage alone.',
    cost: 50,
    upgradeCost: 40,
    damage: 2,
    range: 2.2,
    fireIntervalMs: 900,
    slowFactor: 0.5,
    splashRadius: 0,
  },
]

export function getTowerType(id: TowerTypeId): TowerType {
  const t = TOWER_TYPES.find((tt) => tt.id === id)
  if (!t) throw new Error(`Unknown tower type: ${id}`)
  return t
}

// A tower upgrade doubles damage and range grows modestly -- kept as a
// single flat multiplier (no per-level curve) since the spec only asks
// for "potentially upgrade towers," not a deep leveling system.
export function upgradedStats(base: TowerType, level: number): { damage: number; range: number; fireIntervalMs: number } {
  return {
    damage: base.damage * Math.pow(1.8, level - 1),
    range: base.range + (level - 1) * 0.4,
    fireIntervalMs: Math.max(150, base.fireIntervalMs - (level - 1) * 100),
  }
}
