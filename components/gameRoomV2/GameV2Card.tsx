import type { ReactNode } from 'react'

// Generic content card -- the base surface every panel/modal body in
// this design system sits on. Rounder and thicker-bordered than the
// main app's plain white cards, to read as "game UI" rather than "form
// UI" even before anything inside it renders.
export function GameV2Card({
  children,
  className = '',
  padding = 'md',
}: {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}) {
  const paddingClasses = { sm: 'p-4', md: 'p-6', lg: 'p-8' }

  return (
    <div
      className={`rounded-3xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 shadow-lg ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
