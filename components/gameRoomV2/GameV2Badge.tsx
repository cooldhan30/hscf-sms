import type { ReactNode } from 'react'
import { FiAward, FiLock } from 'react-icons/fi'

// An earned (or locked) achievement. Uses the app's icon library rather
// than the catalog's emoji so achievements read like the rest of the UI;
// `icon` is still accepted for API compatibility but is not rendered.
// `locked` shows the badge muted with a lock, so a student can see what's
// achievable, not just what they've already earned.
export function GameV2Badge({
  label,
  locked = false,
}: {
  icon?: ReactNode
  label: string
  locked?: boolean
}) {
  const Icon = locked ? FiLock : FiAward
  return (
    <div className="flex flex-col items-center gap-1.5 w-20 text-center">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center border ${
          locked
            ? 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500'
            : 'bg-gold-50 dark:bg-gold-900/30 border-gold-200 dark:border-gold-800 text-gold-700 dark:text-gold-300'
        }`}
        aria-hidden
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className={`text-xs font-medium leading-tight ${locked ? 'text-stone-400 dark:text-stone-500' : 'text-stone-700 dark:text-stone-200'}`}>
        {label}
        {locked && <span className="sr-only"> (locked)</span>}
      </p>
    </div>
  )
}
