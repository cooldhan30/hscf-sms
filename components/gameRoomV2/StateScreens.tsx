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

export function GameV2Loading({ label = 'Loading...' }: { label?: string }) {
  const { reduced } = useGameV2Motion()

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gamev2ink-500 dark:text-gamev2ink-400">
      <motion.div
        className="w-12 h-12 rounded-2xl border-4 border-gamev2ink-200 dark:border-gamev2ink-700 border-t-gamev2spark-500"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={reduced ? undefined : { repeat: Infinity, duration: 0.8, ease: 'linear' }}
        role="status"
        aria-label={label}
      />
      <p className="text-sm font-semibold">{label}</p>
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
      <div className="w-16 h-16 rounded-2xl bg-gamev2ink-100 dark:bg-gamev2ink-800 flex items-center justify-center text-gamev2ink-400 dark:text-gamev2ink-500">
        <Icon className="w-7 h-7" aria-hidden />
      </div>
      <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100">{title}</p>
      {description && <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <GameV2Button variant="ghost" size="md" onClick={onAction} className="mt-1">
          {actionLabel}
        </GameV2Button>
      )}
    </div>
  )
}

export function GameV2Error({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gamev2coral-100 dark:bg-gamev2coral-500/20 flex items-center justify-center text-gamev2coral-600 dark:text-gamev2coral-400">
        <FiAlertTriangle className="w-7 h-7" aria-hidden />
      </div>
      <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100">{title}</p>
      {description && <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 max-w-xs">{description}</p>}
      {onRetry && (
        <GameV2Button variant="danger" size="md" onClick={onRetry} className="mt-1">
          Try Again
        </GameV2Button>
      )}
    </div>
  )
}
