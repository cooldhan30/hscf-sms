// Boss Battle's roster -- pure data, no rendering. Names/flavor are
// original game-piece designs (not Tamil lesson content -- Boss Battle,
// like every V2 engine, must never embed lesson content itself; the
// Question Set is the only source of questions).
export type BossId = 'suran' | 'kotravai-guardian' | 'naga-serpent'

export interface BossPhaseDefinition {
  // Fraction of the boss's total health this phase covers (all phases
  // must sum to 1) -- e.g. [0.5, 0.3, 0.2] is a 3-phase boss where the
  // final phase is the shortest, most dramatic stretch.
  healthShare: number
  name: string
  // A phase transition is a visible beat: the boss's counterattack
  // strength changes here, giving "boss phases" real mechanical weight
  // rather than just a color change at health thresholds.
  counterattackDamage: number
  counterattackIntervalMs: number
}

export interface BossDefinition {
  id: BossId
  name: string
  tamilName: string
  description: string
  baseHealth: number
  phases: BossPhaseDefinition[]
}

export const BOSSES: BossDefinition[] = [
  {
    id: 'suran',
    name: 'Suran the Unyielding',
    tamilName: 'சூரன்',
    description: 'A three-phase boss who counterattacks faster and harder as his health drops.',
    baseHealth: 300,
    phases: [
      { healthShare: 0.5, name: 'Rising Fury', counterattackDamage: 6, counterattackIntervalMs: 6000 },
      { healthShare: 0.3, name: 'Storm Guard', counterattackDamage: 9, counterattackIntervalMs: 4500 },
      { healthShare: 0.2, name: 'Final Stand', counterattackDamage: 13, counterattackIntervalMs: 3200 },
    ],
  },
  {
    id: 'kotravai-guardian',
    name: "Kotravai's Guardian",
    tamilName: 'காவலர்',
    description: 'A steady two-phase guardian -- a gentler introduction to Boss Battle.',
    baseHealth: 220,
    phases: [
      { healthShare: 0.6, name: 'Watchful', counterattackDamage: 5, counterattackIntervalMs: 6500 },
      { healthShare: 0.4, name: 'Alert', counterattackDamage: 8, counterattackIntervalMs: 5000 },
    ],
  },
  {
    id: 'naga-serpent',
    name: 'The Naga Serpent',
    tamilName: 'நாக பாம்பு',
    description: 'A four-phase marathon boss for confident players chasing a longer battle.',
    baseHealth: 380,
    phases: [
      { healthShare: 0.35, name: 'Coiling', counterattackDamage: 6, counterattackIntervalMs: 6000 },
      { healthShare: 0.25, name: 'Striking', counterattackDamage: 8, counterattackIntervalMs: 5000 },
      { healthShare: 0.25, name: 'Constricting', counterattackDamage: 11, counterattackIntervalMs: 4000 },
      { healthShare: 0.15, name: 'Venomous Last Stand', counterattackDamage: 15, counterattackIntervalMs: 3000 },
    ],
  },
]

export function getBoss(id: BossId): BossDefinition {
  const b = BOSSES.find((boss) => boss.id === id)
  if (!b) throw new Error(`Unknown boss: ${id}`)
  return b
}

// The health threshold (as a fraction of total health remaining) at
// which each phase BEGINS, computed from the cumulative healthShare
// counted down from 1 -- phase 0 covers [1 - share0, 1], phase 1 covers
// [1 - share0 - share1, 1 - share0], etc.
export function phaseIndexForHealthFraction(boss: BossDefinition, healthFraction: number): number {
  let cumulativeFromEnd = 0
  for (let i = boss.phases.length - 1; i >= 0; i--) {
    cumulativeFromEnd += boss.phases[i].healthShare
    if (healthFraction <= cumulativeFromEnd + 1e-9) return i
  }
  return 0
}
