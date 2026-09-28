import { FiClock, FiZap, FiStar, FiCheckCircle, FiSlash } from 'react-icons/fi'
import type { GameEngineStatus } from '@/lib/gameRoomV2/domain'

// Status is never color-alone here -- each state pairs a distinct icon
// with its label, so a colorblind reader (or a screen reader, via the
// text itself) never depends on hue to tell "coming soon" apart from
// "active".
const STATUS_CONFIG: Record<GameEngineStatus, { label: string; icon: typeof FiClock; classes: string }> = {
  COMING_SOON: { label: 'Coming Soon', icon: FiClock, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  ALPHA: { label: 'Alpha', icon: FiZap, classes: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  BETA: { label: 'Beta', icon: FiStar, classes: 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-200' },
  ACTIVE: { label: 'Play', icon: FiCheckCircle, classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  DISABLED: { label: 'Unavailable', icon: FiSlash, classes: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500' },
  HIDDEN: { label: 'Unavailable', icon: FiSlash, classes: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500' },
}

export function GameV2StatusPill({ status }: { status: GameEngineStatus }) {
  const { label, icon: Icon, classes } = STATUS_CONFIG[status]
  return (
    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>
      <Icon className="w-3 h-3" aria-hidden />
      {label}
    </span>
  )
}
