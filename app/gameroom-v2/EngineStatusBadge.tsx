import type { GameEngineStatus } from '@/lib/gameRoomV2/domain'

const STATUS_STYLE: Record<GameEngineStatus, string> = {
  COMING_SOON: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
  ALPHA: 'bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-950 dark:text-terracotta-300',
  BETA: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300',
  ACTIVE: 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300',
  DISABLED: 'bg-stone-200 text-stone-400 dark:bg-stone-900 dark:text-stone-600',
}

const STATUS_LABEL: Record<GameEngineStatus, string> = {
  COMING_SOON: 'Coming Soon',
  ALPHA: 'Alpha',
  BETA: 'Beta',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
}

export function EngineStatusBadge({ status }: { status: GameEngineStatus }) {
  return (
    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
