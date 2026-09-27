import { FiZap, FiShield, FiFastForward, FiTarget, FiCompass, FiTool, FiStar } from 'react-icons/fi'
import { POWERS, type PowerId } from '@/lib/gameRoomV2/racing3d'

const ICON = { boost: FiZap, shield: FiShield, burst: FiFastForward, magnet: FiTarget, grip: FiCompass, repair: FiTool, star: FiStar } as const

// One glyph per power-up, in the power's colour (shape + colour + the
// Tamil name next to it, so it never relies on colour alone).
export function PowerIcon({ id, className = '' }: { id: PowerId; className?: string }) {
  const Icon = ICON[id]
  return <Icon className={className} style={{ color: POWERS[id].color }} aria-hidden />
}
