'use client'

import { FiPlay, FiRotateCcw } from 'react-icons/fi'
import { useStartGame } from './useStartGame'

export function PlayButton({
  questionSetId,
  engineId,
  label,
  variant = 'primary',
  again = false,
}: {
  questionSetId: string
  engineId: string
  label: string
  variant?: 'primary' | 'secondary'
  again?: boolean
}) {
  const { start, starting } = useStartGame()
  const Icon = again ? FiRotateCcw : FiPlay
  const classes =
    variant === 'primary'
      ? 'bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white'
      : 'border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'
  return (
    <button
      type="button"
      disabled={starting !== null}
      onClick={() => start(questionSetId, engineId)}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${classes}`}
    >
      <Icon className="w-4 h-4" aria-hidden /> {starting ? 'Starting...' : label}
    </button>
  )
}
