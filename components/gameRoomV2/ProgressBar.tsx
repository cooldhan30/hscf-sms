'use client'

import { motion } from 'framer-motion'
import { useGameV2Motion } from './useGameV2Motion'

// A single-value progress readout (question N of M, level fill, etc) --
// not a data chart, so this intentionally skips the dataviz system's
// multi-series machinery (legend, categorical palette). The one color
// rule that DOES carry over: the fill's meaning is also stated in
// visible text (the label prop), never conveyed by color alone.
export function GameV2ProgressBar({
  value,
  max,
  label,
  tone = 'ink',
}: {
  value: number
  max: number
  label?: string
  tone?: 'ink' | 'spark' | 'mint'
}) {
  const { reduced } = useGameV2Motion()
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0

  const fillClasses = {
    ink: 'bg-gamev2ink-600 dark:bg-gamev2ink-400',
    spark: 'bg-gamev2spark-500',
    mint: 'bg-gamev2mint-500',
  }

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between text-xs font-bold text-gamev2ink-500 dark:text-gamev2ink-400 mb-1.5">
          <span>{label}</span>
          <span className="tabular-nums">
            {value}/{max}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className="h-3 rounded-full bg-gamev2ink-100 dark:bg-gamev2ink-800 overflow-hidden"
      >
        <motion.div
          className={`h-full rounded-full ${fillClasses[tone]}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
