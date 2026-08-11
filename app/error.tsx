'use client'

import { ErrorBoundaryScreen } from '@/components/dashboard/ErrorBoundaryScreen'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <ErrorBoundaryScreen error={error} reset={reset} />
    </div>
  )
}
