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
    levels: ['அருகிலுள்ள எதிரி மீது தீக்கணை வீசும்', '+1 தீக்கணை', '+30% தாக்கு வலிமை', 'கணை ஓர் எதிரியைத் துளைத்துச் செல்லும்', '+1 தீக்கணை, +30% தாக்கு வலிமை'],
  },
  {
    id: 'silambu',
    kind: 'weapon',
    name: 'Silambu Spin',
    tamilName: 'சிலம்பம்',
    levels: ['உங்களைச் சுற்றி ஒரு சிலம்பம் சுழலும்', '+1 சிலம்பம்', 'அகலமாகவும் வேகமாகவும் சுழலும்', '+1 சிலம்பம்', '+1 சிலம்பம், +40% தாக்கு வலிமை'],
  },
  {
    id: 'vel',
    kind: 'weapon',
    name: 'Vel Strike',
    tamilName: 'வேல்',
    levels: ['வரிசையில் உள்ள எல்லா எதிரிகளையும் துளைக்கும் வேல் வீசும்', '+40% தாக்கு வலிமை', 'வேகமாக வீசும்', 'இரண்டு வேல்கள் வீசும்', '+60% தாக்கு வலிமை'],
  },
  {
    id: 'kural',
    kind: 'weapon',
    name: 'Kural Wave',
    tamilName: 'குறள் அலை',
    levels: ['ஒலி வளையம் வெடித்து எதிரிகளைப் பின்னுக்குத் தள்ளும்', 'பெரிய வளையம்', '+40% தாக்கு வலிமை', 'அடிக்கடி ஒலிக்கும்', 'இரட்டை ஒலி அலை'],
  },
  { id: 'might', kind: 'passive', name: 'Might', tamilName: 'வலிமை', levels: ['+15% தாக்கு வலிமை', '+15% தாக்கு வலிமை', '+15% தாக்கு வலிமை', '+15% தாக்கு வலிமை', '+15% தாக்கு வலிமை'] },
  { id: 'haste', kind: 'passive', name: 'Haste', tamilName: 'விரைவு', levels: ['ஆயுதங்கள் 10% வேகமாகத் தாக்கும்', '+10% வேகம்', '+10% வேகம்', '+10% வேகம்', '+10% வேகம்'] },
  { id: 'swift', kind: 'passive', name: 'Swift Feet', tamilName: 'வேகம்', levels: ['+10% நகர்வு வேகம்', '+10% நகர்வு வேகம்', '+10% நகர்வு வேகம்', '+10% நகர்வு வேகம்', '+10% நகர்வு வேகம்'] },
  { id: 'vitality', kind: 'passive', name: 'Vitality', tamilName: 'உயிர்ப்பு', levels: ['+20 அதிகபட்ச உயிராற்றல், 20 குணம்', '+20 அதிகபட்ச உயிராற்றல்', '+20 அதிகபட்ச உயிராற்றல்', '+20 அதிகபட்ச உயிராற்றல்', '+20 அதிகபட்ச உயிராற்றல்'] },
  { id: 'armor', kind: 'passive', name: 'Armor', tamilName: 'கவசம்', levels: ['ஒவ்வொரு அடியிலும் 2 குறைவான சேதம்', 'மேலும் -2 சேதம்', 'மேலும் -2 சேதம்', 'மேலும் -2 சேதம்', 'மேலும் -2 சேதம்'] },
  { id: 'keen', kind: 'passive', name: 'Keen Eye', tamilName: 'கூர்மை', levels: ['+6% பேரடி வாய்ப்பு', '+6% பேரடி வாய்ப்பு', '+6% பேரடி வாய்ப்பு', '+6% பேரடி வாய்ப்பு', '+6% பேரடி வாய்ப்பு'] },
  { id: 'reach', kind: 'passive', name: 'Reach', tamilName: 'விரிவு', levels: ['+15% தாக்குதல் பரப்பு', '+15% தாக்குதல் பரப்பு', '+15% தாக்குதல் பரப்பு', '+15% தாக்குதல் பரப்பு', '+15% தாக்குதல் பரப்பு'] },
  { id: 'magnet', kind: 'passive', name: 'Magnet', tamilName: 'ஈர்ப்பு', levels: ['தொலைவிலிருந்தே தீப்பொறிகளை ஈர்க்கும்', '+40% ஈர்ப்பு எல்லை', '+40% ஈர்ப்பு எல்லை', '+40% ஈர்ப்பு எல்லை', '+40% ஈர்ப்பு எல்லை'] },
  { id: 'renewal', kind: 'passive', name: 'Renewal', tamilName: 'புதுப்பித்தல்', levels: ['நொடிக்கு 1 உயிராற்றல் மீளும்', 'நொடிக்கு +1', 'நொடிக்கு +1', 'நொடிக்கு +1', 'நொடிக்கு +1'] },
  { id: 'focus', kind: 'passive', name: 'Focus', tamilName: 'கவனம்', levels: ['காவல் பாய்ச்சல் 15% விரைவில் மீளும்', '+15% விரைவு', '+15% விரைவு', '+15% விரைவு', '+15% விரைவு'] },
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
