import type { ReactNode } from 'react'

// An earned achievement badge -- distinct from GameV2StatusPill (which
// communicates an ENGINE's availability state, not a PLAYER's
// accomplishment). `locked` renders the same badge desaturated with a
// lock overlay rather than hiding it, so a student can see what's
// achievable, not just what they've already earned.
export function GameV2Badge({
  icon,
  label,
  locked = false,
}: {
  icon: ReactNode
  label: string
  locked?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-20 text-center">
      <div
        className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2 ${
          locked
            ? 'bg-gamev2ink-50 dark:bg-gamev2ink-900 border-gamev2ink-100 dark:border-gamev2ink-800 grayscale opacity-50'
            : 'bg-gradient-to-br from-gamev2spark-300 to-gamev2spark-500 border-gamev2spark-600 shadow-md'
        }`}
        aria-hidden
      >
        {icon}
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center text-lg" aria-hidden>
            🔒
          </span>
        )}
      </div>
      <p className={`text-xs font-bold leading-tight ${locked ? 'text-gamev2ink-400 dark:text-gamev2ink-600' : 'text-gamev2ink-700 dark:text-gamev2ink-200'}`}>
        {label}
        {locked && <span className="sr-only"> (locked)</span>}
      </p>
    </div>
  )
}
