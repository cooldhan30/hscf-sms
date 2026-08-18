'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiFileText, FiBook } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { formatDateOnly } from '@/lib/dates'
import type { SmsAssignment, SmsClass } from '@/types/database'

export interface AdminAssignmentRow extends SmsAssignment {
  class: Pick<SmsClass, 'id' | 'name'> | null
  creator: { first_name: string; last_name: string } | null
}

type SortKey = 'size-desc' | 'date-asc' | 'date-desc'

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminAssignmentsClient({ initialAssignments }: { initialAssignments: AdminAssignmentRow[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [sort, setSort] = useState<SortKey>('size-desc')

  const sorted = useMemo(() => {
    const rows = [...initialAssignments]
    if (sort === 'size-desc') {
      rows.sort((a, b) => (b.image_size ?? 0) - (a.image_size ?? 0))
    } else if (sort === 'date-asc') {
      rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else {
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return rows
  }, [initialAssignments, sort])

  async function handleDelete(a: AdminAssignmentRow) {
    const confirmed = await confirm({
      title: `Delete "${a.title}"?`,
      description:
        'This removes the assignment along with every student grade and submission for it (including any recorded audio). This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/assignments/${a.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Assignment deleted')
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to delete assignment')
    }
  }

  const columns: DataTableColumn<AdminAssignmentRow>[] = [
    {
      header: 'Title',
      accessor: (a) => (
        <div className="flex items-center gap-2">
          {a.resource_id ? (
            <FiBook className="w-4 h-4 flex-shrink-0 text-primary-600 dark:text-primary-400" aria-label="Reading exercise" />
          ) : (
            <FiFileText className="w-4 h-4 flex-shrink-0 text-stone-400" />
          )}
          <span className="font-semibold text-stone-800 dark:text-stone-100">{a.title}</span>
        </div>
      ),
    },
    { header: 'Class', accessor: (a) => a.class?.name ?? '—' },
    { header: 'Teacher', accessor: (a) => (a.creator ? `${a.creator.first_name} ${a.creator.last_name}` : '—') },
    {
      header: 'Image Size',
      accessor: (a) => (a.image_url ? formatBytes(a.image_size) : '—'),
    },
    { header: 'Due', accessor: (a) => (a.due_date ? formatDateOnly(a.due_date) : '—') },
    { header: 'Created', accessor: (a) => formatDateOnly(a.created_at.slice(0, 10)) },
    {
      header: '',
      accessor: (a) => (
        <button
          onClick={() => handleDelete(a)}
          className="p-1.5 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
          aria-label="Delete assignment"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-stone-700 dark:text-stone-300">Sort by</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="size-desc">Largest image first</option>
          <option value="date-asc">Oldest first</option>
          <option value="date-desc">Newest first</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={sorted}
        keyFor={(a) => a.id}
        emptyTitle="No assignments yet"
        pageSize={20}
      />
    </div>
  )
}
