'use client'

import { FiCopy } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { toast } from '@/lib/toast'

interface Season {
  id: string
  name: string
  year: number
  join_code: string | null
  is_active: boolean
  enrollments: { count: number }[]
  words: { count: number }[]
}

// Phase 1 admin surface: view seasons, their join codes, and basic
// counts. Word CRUD / bulk import UI and per-season activation controls
// are a Phase 6 follow-up -- the 2026 season and its ~800 words are
// already seeded via scripts/import-tamil-theni-2026.js.
export function TheniAdminClient({ seasons }: { seasons: Season[] }) {
  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success('Join code copied')
  }

  if (seasons.length === 0) {
    return <EmptyState title="No Tamil Theni seasons yet" description="Run scripts/import-tamil-theni-2026.js to seed the 2026 season." />
  }

  return (
    <div className="space-y-4">
      {seasons.map((season) => (
        <div key={season.id} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-stone-800 dark:text-stone-100">{season.name}</p>
                {season.is_active && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {season.words?.[0]?.count ?? 0} words · {season.enrollments?.[0]?.count ?? 0} students enrolled
              </p>
            </div>
            {season.join_code && (
              <button
                onClick={() => copyCode(season.join_code!)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-semibold tracking-widest text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                {season.join_code} <FiCopy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
