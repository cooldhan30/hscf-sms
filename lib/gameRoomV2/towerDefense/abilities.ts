// Limited strategic powers. They cost "scroll" charges, which are earned
// only by answering Tamil questions correctly, and each has a cooldown so
// they're decisions, not spam.
export type AbilityId = 'freeze' | 'rally' | 'repair' | 'strike'

export interface AbilityDefinition {
  id: AbilityId
  name: string
  tamilName: string
  description: string
  charges: number
  cooldownMs: number
  needsTarget: boolean
}

export const FREEZE_DURATION_MS = 3500
export const RALLY_DURATION_MS = 8000
export const RALLY_DAMAGE_MULTIPLIER = 1.6
export const REPAIR_AMOUNT = 5
export const STRIKE_DAMAGE = 90
export const STRIKE_RADIUS = 1.6

export const ABILITIES: AbilityDefinition[] = [
  {
    id: 'freeze',
    name: 'Frost Wave',
    tamilName: 'உறைபனி',
    description: `Stops every enemy for ${FREEZE_DURATION_MS / 1000}s.`,
    charges: 2,
    cooldownMs: 20000,
    needsTarget: false,
  },
  {
    id: 'rally',
    name: 'War Drum',
    tamilName: 'போர்ப்பறை',
    description: `All towers deal +${Math.round((RALLY_DAMAGE_MULTIPLIER - 1) * 100)}% damage for ${RALLY_DURATION_MS / 1000}s.`,
    charges: 2,
    cooldownMs: 25000,
    needsTarget: false,
  },
  {
    id: 'repair',
    name: 'Mend Walls',
    tamilName: 'கோட்டை பழுது',
    description: `Restores ${REPAIR_AMOUNT} fort health.`,
    charges: 3,
    cooldownMs: 30000,
    needsTarget: false,
  },
  {
    id: 'strike',
    name: 'Stone Rain',
    tamilName: 'கல் மழை',
    description: `Tap the field: ${STRIKE_DAMAGE} damage to everything nearby, ignoring armour.`,
    charges: 2,
    cooldownMs: 15000,
    needsTarget: true,
  },
]

export function getAbility(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((a) => a.id === id)!
}

export const MAX_CHARGES = 6
