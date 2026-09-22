import { FiClock, FiZap, FiStar, FiCheckCircle, FiSlash } from 'react-icons/fi'
import type { GameEngineStatus } from '@/lib/gameRoomV2/domain'

// Status is never color-alone here -- each state pairs a distinct icon
// with its label, so a colorblind reader (or a screen reader, via the
// text itself) never depends on hue to tell "coming soon" apart from
// "active".
const STATUS_CONFIG: Record<GameEngineStatus, { label: string; icon: typeof FiClock; classes: string }> = {
  COMING_SOON: { label: 'Coming Soon', icon: FiClock, classes: 'bg-gamev2ink-100 text-gamev2ink-600 dark:bg-gamev2ink-800 dark:text-gamev2ink-300' },
  ALPHA: { label: 'Alpha', icon: FiZap, classes: 'bg-gamev2coral-100 text-gamev2coral-600 dark:bg-gamev2coral-500/20 dark:text-gamev2coral-400' },
  BETA: { label: 'Beta', icon: FiStar, classes: 'bg-gamev2spark-100 text-gamev2spark-700 dark:bg-gamev2spark-500/20 dark:text-gamev2spark-300' },
  ACTIVE: { label: 'Play', icon: FiCheckCircle, classes: 'bg-gamev2mint-100 text-gamev2mint-700 dark:bg-gamev2mint-500/20 dark:text-gamev2mint-300' },
  DISABLED: { label: 'Unavailable', icon: FiSlash, classes: 'bg-gamev2ink-100 text-gamev2ink-400 dark:bg-gamev2ink-800 dark:text-gamev2ink-500' },
}

export function GameV2StatusPill({ status }: { status: GameEngineStatus }) {
  const { label, icon: Icon, classes } = STATUS_CONFIG[status]
  return (
    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${classes}`}>
      <Icon className="w-3 h-3" aria-hidden />
      {label}
    </span>
  )
}
