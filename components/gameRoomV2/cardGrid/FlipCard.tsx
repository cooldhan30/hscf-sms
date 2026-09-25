'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from '@/components/gameRoomV2'

export type CardVisualState = 'hidden' | 'revealed' | 'selected' | 'matched' | 'mismatched'

const STATE_RING: Record<CardVisualState, string> = {
  hidden: 'border-gamev2ink-200 dark:border-gamev2ink-700',
  revealed: 'border-gamev2ink-300 dark:border-gamev2ink-600',
  selected: 'border-gamev2spark-400 dark:border-gamev2spark-500 ring-4 ring-gamev2spark-200 dark:ring-gamev2spark-500/30',
  matched: 'border-gamev2mint-400 dark:border-gamev2mint-500',
  mismatched: 'border-gamev2coral-400 dark:border-gamev2coral-500',
}

// The shared flip-card primitive both Matching (front always visible,
// tap-to-select) and Memory (front hidden until flipped) build on.
// `faceUp` controls whether the label side or the back ("?") side is
// showing -- Matching always passes `faceUp: true` (nothing to flip,
// it only ever needs the state-ring/selection visuals), Memory toggles
// it per its own flip state. This is the one genuinely shared piece of
// UI between the two engines: a tappable/keyboard-focusable card with
// a state ring and an optional 3D flip transition -- everything about
// WHEN a card flips or WHAT counts as a match stays in each engine's
// own round logic.
export function FlipCard({
  label,
  faceUp,
  state,
  disabled,
  onActivate,
  ariaLabel,
}: {
  label: string
  faceUp: boolean
  state: CardVisualState
  disabled: boolean
  onActivate: () => void
  ariaLabel: string
}) {
  const { reduced } = useGameV2Motion()

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onActivate}
      aria-label={ariaLabel}
      aria-pressed={state === 'selected' || state === 'matched'}
      className="relative aspect-[4/3] w-full [perspective:800px] disabled:cursor-not-allowed"
    >
      <motion.div
        className="relative w-full h-full [transform-style:preserve-3d]"
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Front face -- the label side */}
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-white dark:bg-gamev2ink-900 px-2 py-2 text-center font-tamil leading-relaxed font-bold text-sm sm:text-base text-gamev2ink-800 dark:text-gamev2ink-100 transition-colors ${STATE_RING[state]} [backface-visibility:hidden]`}
        >
          {label}
        </div>
        {/* Back face -- the hidden/unrevealed side, Memory-only in
            practice (Matching never shows this since faceUp is always
            true) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-gamev2spark-300 dark:border-gamev2spark-600 bg-gradient-to-br from-gamev2spark-100 to-gamev2spark-200 dark:from-gamev2spark-900 dark:to-gamev2spark-800 text-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          aria-hidden
        >
          {'✨'}
        </div>
      </motion.div>
    </button>
  )
}
