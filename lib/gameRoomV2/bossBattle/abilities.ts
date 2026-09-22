// Player abilities -- a small kit giving tactical choice beyond "just
// answer correctly": each ability costs charge (earned from correct
// answers, like Tower Defense's coins/Racing's boosts are their own
// engine-local currencies) and has a distinct effect. Charge is
// session-local gameplay state, separate from the account's real
// XP/coins ledger, same separation established by every prior V2
// engine.
export type AbilityId = 'heavy-strike' | 'shield' | 'focus'

export interface AbilityDefinition {
  id: AbilityId
  name: string
  tamilName: string
  description: string
  chargeCost: number
  // Heavy Strike: bonus direct damage to the boss on use.
  bonusDamage: number
  // Shield: absorbs the boss's next N counterattacks entirely.
  shieldCharges: number
  // Focus: the next correct answer's damage is multiplied -- a
  // temporary buff rather than an instant effect, rewarding a student
  // who times it before a question they feel confident about.
  focusDamageMultiplier: number
  focusUsesRemaining: number
}

export const ABILITIES: AbilityDefinition[] = [
  {
    id: 'heavy-strike',
    name: 'Heavy Strike',
    tamilName: 'பலத்த தாக்குதல்',
    description: 'Spend charge for an immediate burst of extra damage to the boss.',
    chargeCost: 40,
    bonusDamage: 35,
    shieldCharges: 0,
    focusDamageMultiplier: 1,
    focusUsesRemaining: 0,
  },
  {
    id: 'shield',
    name: 'Shield',
    tamilName: 'கேடயம்',
    description: 'Blocks the boss\'s next counterattack completely.',
    chargeCost: 30,
    bonusDamage: 0,
    shieldCharges: 1,
    focusDamageMultiplier: 1,
    focusUsesRemaining: 0,
  },
  {
    id: 'focus',
    name: 'Focus',
    tamilName: 'கவனம்',
    description: 'Doubles the damage of your next correct answer.',
    chargeCost: 25,
    bonusDamage: 0,
    shieldCharges: 0,
    focusDamageMultiplier: 2,
    focusUsesRemaining: 1,
  },
]

export function getAbility(id: AbilityId): AbilityDefinition {
  const a = ABILITIES.find((ab) => ab.id === id)
  if (!a) throw new Error(`Unknown ability: ${id}`)
  return a
}
