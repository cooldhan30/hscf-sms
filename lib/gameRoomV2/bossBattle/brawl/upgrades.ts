// Boss Battle upgrades: four auto-firing weapons and ten passive boons.
// A run starts with Agni Flame; level-ups and checkpoint blessings offer
// three choices. Golden ("blessed") choices -- earned with good Tamil
// answers at a checkpoint -- grant two levels at once.
//
// No randomness here that a player pays for: choices are rolled from the
// run's own seeded RNG, there is no currency, nothing is bought.

export type WeaponId = 'flame' | 'silambu' | 'vel' | 'kural'
export type PassiveId = 'might' | 'haste' | 'swift' | 'vitality' | 'armor' | 'keen' | 'reach' | 'magnet' | 'renewal' | 'focus'
export type UpgradeId = WeaponId | PassiveId

export const MAX_LEVEL = 5
export const MAX_WEAPONS = 4

export interface UpgradeDef {
  id: UpgradeId
  kind: 'weapon' | 'passive'
  name: string
  tamilName: string
  // One line per level (index 0 = what level 1 does).
  levels: string[]
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'flame',
    kind: 'weapon',
    name: 'Agni Flame',
    tamilName: 'அக்னி',
    levels: ['Fires a flame bolt at the nearest enemy', '+1 bolt', '+30% damage', 'Bolts pierce one enemy', '+1 bolt, +30% damage'],
  },
  {
    id: 'silambu',
    kind: 'weapon',
    name: 'Silambu Spin',
    tamilName: 'சிலம்பம்',
    levels: ['A staff spins around you', '+1 staff', 'Wider and faster spin', '+1 staff', '+1 staff, +40% damage'],
  },
  {
    id: 'vel',
    kind: 'weapon',
    name: 'Vel Strike',
    tamilName: 'வேல்',
    levels: ['Hurls a vel that pierces every enemy in a line', '+40% damage', 'Throws faster', 'Throws two vels', '+60% damage'],
  },
  {
    id: 'kural',
    kind: 'weapon',
    name: 'Kural Wave',
    tamilName: 'குறள் அலை',
    levels: ['A ring of sound bursts out, pushing enemies back', 'Bigger ring', '+40% damage', 'Pulses more often', 'Double pulse'],
  },
  { id: 'might', kind: 'passive', name: 'Might', tamilName: 'வலிமை', levels: ['+15% damage', '+15% damage', '+15% damage', '+15% damage', '+15% damage'] },
  { id: 'haste', kind: 'passive', name: 'Haste', tamilName: 'விரைவு', levels: ['Weapons fire 10% faster', '+10%', '+10%', '+10%', '+10%'] },
  { id: 'swift', kind: 'passive', name: 'Swift Feet', tamilName: 'வேகம்', levels: ['+10% move speed', '+10%', '+10%', '+10%', '+10%'] },
  { id: 'vitality', kind: 'passive', name: 'Vitality', tamilName: 'உயிர்ப்பு', levels: ['+20 max health and heal 20', '+20 max health', '+20 max health', '+20 max health', '+20 max health'] },
  { id: 'armor', kind: 'passive', name: 'Armor', tamilName: 'கவசம்', levels: ['Take 2 less damage per hit', '-2 more', '-2 more', '-2 more', '-2 more'] },
  { id: 'keen', kind: 'passive', name: 'Keen Eye', tamilName: 'கூர்மை', levels: ['+6% critical hit chance', '+6%', '+6%', '+6%', '+6%'] },
  { id: 'reach', kind: 'passive', name: 'Reach', tamilName: 'விரிவு', levels: ['+15% attack area', '+15%', '+15%', '+15%', '+15%'] },
  { id: 'magnet', kind: 'passive', name: 'Magnet', tamilName: 'ஈர்ப்பு', levels: ['Collect sparks from further away', '+40% range', '+40% range', '+40% range', '+40% range'] },
  { id: 'renewal', kind: 'passive', name: 'Renewal', tamilName: 'புதுப்பித்தல்', levels: ['Regenerate 1 health per second', '+1 per second', '+1 per second', '+1 per second', '+1 per second'] },
  { id: 'focus', kind: 'passive', name: 'Focus', tamilName: 'கவனம்', levels: ['Guardian Dash recharges 15% faster', '+15%', '+15%', '+15%', '+15%'] },
]

export function getUpgrade(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!
}

export interface UpgradeChoice {
  id: UpgradeId
  // Level this choice brings the upgrade to.
  toLevel: number
  blessed: boolean
}

// Rolls up to three distinct choices. New weapons are only offered while
// there is a free weapon slot; maxed upgrades are never offered.
export function rollChoices(levels: Partial<Record<UpgradeId, number>>, rand: () => number, blessed: boolean): UpgradeChoice[] {
  const weaponsOwned = UPGRADES.filter((u) => u.kind === 'weapon' && (levels[u.id] ?? 0) > 0).length
  const pool = UPGRADES.filter((u) => {
    const lv = levels[u.id] ?? 0
    if (lv >= MAX_LEVEL) return false
    if (u.kind === 'weapon' && lv === 0 && weaponsOwned >= MAX_WEAPONS) return false
    return true
  })
  // Unowned weapons are a little more likely early on -- they change how
  // a run plays the most.
  const weighted = pool.map((u) => ({ u, w: u.kind === 'weapon' ? ((levels[u.id] ?? 0) === 0 ? 2.2 : 1.6) : 1 }))
  const out: UpgradeChoice[] = []
  while (out.length < 3 && weighted.length) {
    const total = weighted.reduce((s, x) => s + x.w, 0)
    let r = rand() * total
    let i = 0
    while (i < weighted.length - 1 && r >= weighted[i].w) r -= weighted[i++].w
    const u = weighted.splice(i, 1)[0].u
    const lv = levels[u.id] ?? 0
    out.push({ id: u.id, toLevel: Math.min(MAX_LEVEL, lv + (blessed ? 2 : 1)), blessed })
  }
  return out
}
