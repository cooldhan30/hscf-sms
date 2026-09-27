'use client'

import { motion } from 'framer-motion'
import { FiAlertTriangle, FiInbox } from 'react-icons/fi'
import { GameV2Button } from './GameV2Button'
import { useGameV2Motion } from './useGameV2Motion'

// Loading, empty, and error states -- kept as one file since they
// share the same "centered icon + message" shell and are always used
// in the same places (swapped for each other depending on fetch
// state), unlike the interactive components above which each stand
// alone.

export function GameV2Loading({ label = 'ஏற்றுகிறது... · Loading...' }: { label?: string }) {
  const { reduced } = useGameV2Motion()

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500 dark:text-stone-400">
      <motion.div
        className="w-10 h-10 rounded-full border-4 border-stone-200 dark:border-stone-700 border-t-primary-600"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={reduced ? undefined : { repeat: Infinity, duration: 0.8, ease: 'linear' }}
        role="status"
        aria-label={label}
      />
      <p className="font-tamil text-sm font-semibold">{label}</p>
    </div>
  )
}

export function GameV2Empty({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FiInbox,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  // Override the default inbox glyph for a more specific empty state
  // (e.g. FiAward for "no accomplishments yet") -- optional, since most
  // empty states are fine with the generic one.
  icon?: typeof FiInbox
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500">
        <Icon className="w-5 h-5" aria-hidden />
      </div>
      <p className="font-tamil font-semibold text-stone-700 dark:text-stone-200">{title}</p>
      {description && <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <GameV2Button variant="ghost" size="md" onClick={onAction} className="mt-1">
          {actionLabel}
        </GameV2Button>
      )}
    </div>
  )
}

export function GameV2Error({
  title = 'ஏதோ தவறு நடந்துவிட்டது · Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
        <FiAlertTriangle className="w-5 h-5" aria-hidden />
      </div>
      <p className="font-tamil font-semibold text-stone-700 dark:text-stone-200">{title}</p>
      {description && <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">{description}</p>}
      {onRetry && (
        <GameV2Button variant="danger" size="md" onClick={onRetry} className="mt-1">
          <span className="font-tamil">மீண்டும் முயல்க</span> · Try again
        </GameV2Button>
      )}
    </div>
  )
}
