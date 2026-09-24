'use client'

import { motion } from 'framer-motion'
import { FiCheck, FiX } from 'react-icons/fi'
import { useGameV2Motion } from './useGameV2Motion'

export type AnswerOptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'dimmed'

// The single answer-button component every question-type UI should
// build on. State is communicated through THREE independent channels
// (background/border color, an icon, and a border-width/scale change),
// never color alone -- a colorblind student, or anyone on a
// low-contrast screen, can still tell "this was right" from "this was
// picked but wrong" from the icon and shape alone.
//
// `dimmed` is a distinct 5th state (not just `idle` + disabled) for the
// "everyone else's unpicked options once the round has resolved" case
// -- visually receding without looking broken/greyed-out-by-accident.
const STATE_CLASSES: Record<AnswerOptionState, string> = {
  idle: 'border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-800 dark:text-gamev2ink-100 hover:border-gamev2ink-400 dark:hover:border-gamev2ink-500',
  selected: 'border-gamev2ink-600 dark:border-gamev2ink-400 bg-gamev2ink-50 dark:bg-gamev2ink-800 text-gamev2ink-900 dark:text-white ring-4 ring-gamev2ink-200 dark:ring-gamev2ink-700',
  correct: 'border-gamev2mint-500 bg-gamev2mint-50 dark:bg-gamev2mint-500/10 text-gamev2mint-700 dark:text-gamev2mint-300',
  incorrect: 'border-gamev2coral-500 bg-gamev2coral-50 dark:bg-gamev2coral-500/10 text-gamev2coral-700 dark:text-gamev2coral-300',
  dimmed: 'border-gamev2ink-100 dark:border-gamev2ink-800 bg-gamev2ink-50/50 dark:bg-gamev2ink-900/50 text-gamev2ink-300 dark:text-gamev2ink-600',
}

export function AnswerOption({
  label,
  state = 'idle',
  disabled = false,
  onClick,
}: {
  label: string
  state?: AnswerOptionState
  disabled?: boolean
  onClick?: () => void
}) {
  const { spring, reduced } = useGameV2Motion()
  const interactive = !disabled && (state === 'idle' || state === 'selected')

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      animate={state === 'incorrect' && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={state === 'incorrect' ? { duration: 0.4 } : spring}
      whileHover={interactive && !reduced ? { scale: 1.02 } : undefined}
      whileTap={interactive && !reduced ? { scale: 0.97 } : undefined}
      className={`relative flex items-center justify-between gap-3 w-full min-h-[56px] px-5 py-4 rounded-2xl border-2 font-tamil text-lg font-semibold leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 disabled:cursor-not-allowed ${STATE_CLASSES[state]}`}
    >
      <span>{label}</span>
      {state === 'correct' && (
        // Dark ink icon, not white -- white-on-mint-500 measures ~2.0:1,
        // below even the 3:1 WCAG minimum for a meaningful UI icon (a
        // low-vision student could lose the ONE non-color signal this
        // component's own header comment relies on). gamev2ink-950 on
        // mint-500 measures ~8.8:1.
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gamev2mint-500 text-gamev2ink-950 flex items-center justify-center">
          <FiCheck className="w-4 h-4" aria-hidden />
        </span>
      )}
      {state === 'incorrect' && (
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gamev2coral-500 text-white flex items-center justify-center">
          <FiX className="w-4 h-4" aria-hidden />
        </span>
      )}
      <span className="sr-only">
        {state === 'correct' ? ' — correct answer' : state === 'incorrect' ? ' — incorrect' : ''}
      </span>
    </motion.button>
  )
}
