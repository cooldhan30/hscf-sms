'use client'

import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import type { SmsAssignment, SmsClass, SmsGrade } from '@/types/database'

type GradeRow = SmsGrade & { assignment: SmsAssignment & { class: Pick<SmsClass, 'id' | 'name'> } }

export function GradesClient({ grades }: { grades: GradeRow[] }) {
  const [classFilter, setClassFilter] = useState('all')

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const g of grades) seen.set(g.assignment.class.id, g.assignment.class.name)
    return Array.from(seen.entries())
  }, [grades])

  const filtered = useMemo(
    () => (classFilter === 'all' ? grades : grades.filter((g) => g.assignment.class.id === classFilter)),
    [grades, classFilter]
  )

  const columns: DataTableColumn<GradeRow>[] = [
    { header: 'Subject', accessor: (g) => g.assignment.class.name },
    { header: 'Assignment', accessor: (g) => g.assignment.title },
    { header: 'Score', accessor: (g) => `${g.score} / ${g.assignment.max_score}` },
    {
      header: 'Percentage',
      accessor: (g) => {
        const pct = ((g.score ?? 0) / g.assignment.max_score) * 100
        return (
          <span
            className={`font-semibold ${
              pct >= 70
                ? 'text-primary-700 dark:text-primary-400'
                : pct >= 50
                  ? 'text-gold-700 dark:text-gold-400'
                  : 'text-terracotta-700 dark:text-terracotta-400'
            }`}
          >
            {pct.toFixed(1)}%
          </span>
        )
      },
    },
    { header: 'Feedback', accessor: (g) => g.feedback || '—' },
  ]

  return (
    <div className="space-y-4">
      {classOptions.length > 0 && (
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="all">All Subjects</option>
          {classOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(g) => g.id}
        emptyTitle="No graded assignments yet"
      />
    </div>
  )
}
