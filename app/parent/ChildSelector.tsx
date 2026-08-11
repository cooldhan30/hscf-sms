'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { ChildOption } from './child-utils'

// Shared across attendance/grades/assignments pages so a parent with
// multiple children can switch which child's data is shown. Syncs to a
// ?childId= query param rather than local state, so links (e.g. from the
// dashboard) can deep-link straight to a specific child's view.
export function ChildSelector({ options }: { options: ChildOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('childId') ?? options[0]?.id ?? ''

  if (options.length <= 1) return null

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('childId', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
    >
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.first_name} {c.last_name}
        </option>
      ))}
    </select>
  )
}
