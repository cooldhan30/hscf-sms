import type { ReactNode } from 'react'

// Generic content card -- the same white/stone rounded-2xl card with a
// single stone border used on every page of the main app (see
// app/student/page.tsx), so GameRoom surfaces match the rest of the app.
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
      className={`rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
