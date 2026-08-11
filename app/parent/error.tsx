'use client'

import { ErrorBoundaryScreen } from '@/components/dashboard/ErrorBoundaryScreen'

export default function ParentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryScreen error={error} reset={reset} />
}
