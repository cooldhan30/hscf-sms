'use client'

import { useEffect } from 'react'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

// Shared body for every route-segment error.tsx (Next.js requires each
// error.tsx to be its own Client Component, so this is the one place the
// actual UI/branding lives -- the per-segment files just forward props).
export function ErrorBoundaryScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 gap-4">
      <span className="p-4 rounded-full bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-600 dark:text-terracotta-400">
        <FiAlertTriangle className="w-8 h-8" />
      </span>
      <div>
        <h1 className="text-xl font-bold text-primary-900 dark:text-white">Something went wrong</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
          An unexpected error occurred while loading this page. You can try again, or head back to your dashboard.
        </p>
      </div>
      <Button variant="primary" size="sm" icon={<FiRefreshCw />} onClick={reset}>
        Try Again
      </Button>
    </div>
  )
}
