import { GiFireball, GiSwirlRing, GiThrownSpear, GiSoundWaves, GiBiceps, GiStopwatch, GiWingfoot, GiHeartPlus, GiChestArmor, GiCrosshair, GiExpand, GiMagnet, GiHealthIncrease, GiShield } from 'react-icons/gi'
import type { UpgradeId } from '@/lib/gameRoomV2/bossBattle/brawl'

// One icon + accent per upgrade, shared by the HUD build strip, the
// upgrade picker and the results screen.
export const UPGRADE_ICON: Record<UpgradeId, typeof GiFireball> = {
  flame: GiFireball,
  silambu: GiSwirlRing,
  vel: GiThrownSpear,
  kural: GiSoundWaves,
  might: GiBiceps,
  haste: GiStopwatch,
  swift: GiWingfoot,
  vitality: GiHeartPlus,
  armor: GiChestArmor,
  keen: GiCrosshair,
  reach: GiExpand,
  magnet: GiMagnet,
  renewal: GiHealthIncrease,
  focus: GiShield,
}

export const UPGRADE_TINT: Record<UpgradeId, string> = {
  flame: 'bg-orange-500',
  silambu: 'bg-amber-600',
  vel: 'bg-slate-600',
  kural: 'bg-gold-500',
  might: 'bg-rose-600',
  haste: 'bg-primary-600',
  swift: 'bg-sky-500',
  vitality: 'bg-emerald-600',
  armor: 'bg-stone-600',
  keen: 'bg-red-500',
  reach: 'bg-violet-600',
  magnet: 'bg-indigo-500',
  renewal: 'bg-green-500',
  focus: 'bg-sky-700',
}
