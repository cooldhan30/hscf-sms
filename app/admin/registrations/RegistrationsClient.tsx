'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheck, FiX, FiMail } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { WebsiteRegistration } from '@/types/database'

const STATUS_TABS = ['pending', 'approved', 'rejected', 'waitlisted'] as const

export function RegistrationsClient({
  initialRegistrations,
  registrationIdsNeedingParent,
}: {
  initialRegistrations: WebsiteRegistration[]
  registrationIdsNeedingParent: string[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsParentInvite = useMemo(() => new Set(registrationIdsNeedingParent), [registrationIdsNeedingParent])

  const filtered = useMemo(
    () => initialRegistrations.filter((r) => r.registration_status === statusFilter),
    [initialRegistrations, statusFilter]
  )

  async function handleAction(id: string, action: 'approve' | 'reject' | 'invite-parent') {
    if (action === 'reject') {
      const confirmed = await confirm({
        title: 'Reject this registration?',
        confirmLabel: 'Reject',
        tone: 'danger',
      })
      if (!confirmed) return
    }

    setBusyId(id)
    setError(null)

    const res = await fetch(`/api/admin/registrations/${id}/${action}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    setBusyId(null)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      toast.error(data.error || 'Something went wrong')
      return
    }

    if (data.warning) {
      toast.error(data.warning, { duration: 15000 })
    } else {
      toast.success(
        action === 'approve' ? 'Registration approved' : action === 'reject' ? 'Registration rejected' : 'Parent invited'
      )
    }
    if (data.parentTempPassword) {
      toast.success(`Parent temp password: ${data.parentTempPassword}`, { duration: 30000 })
    }
    router.refresh()
  }

  const columns: DataTableColumn<WebsiteRegistration>[] = [
    {
      header: 'Student',
      accessor: (r) => (
        <div>
          <p className="font-semibold text-stone-800 dark:text-stone-100">
            {r.student_first_name} {r.student_last_name}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Age {r.student_age ?? '—'} ·{' '}
            {GRADE_LEVEL_OPTIONS.find((g) => g.value === r.preferred_class_level)?.label ||
              r.preferred_class_level ||
              '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Parent',
      accessor: (r) => (
        <div>
          <p className="font-medium text-stone-800 dark:text-stone-100">
            {r.parent_first_name} {r.parent_last_name}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{r.parent_email}</p>
        </div>
      ),
    },
    {
      header: 'Submitted',
      accessor: (r) => new Date(r.registration_date).toLocaleDateString(),
    },
    {
      header: '',
      accessor: (r) =>
        statusFilter === 'pending' ? (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleAction(r.id, 'approve')}
              disabled={busyId === r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-100 text-primary-800 hover:bg-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900 transition-colors disabled:opacity-50"
            >
              <FiCheck className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => handleAction(r.id, 'reject')}
              disabled={busyId === r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-terracotta-100 text-terracotta-800 hover:bg-terracotta-200 dark:bg-terracotta-950 dark:text-terracotta-300 dark:hover:bg-terracotta-900 transition-colors disabled:opacity-50"
            >
              <FiX className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        ) : statusFilter === 'approved' && needsParentInvite.has(r.id) ? (
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-terracotta-600 dark:text-terracotta-400">Parent not invited</span>
            <button
              onClick={() => handleAction(r.id, 'invite-parent')}
              disabled={busyId === r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-100 text-primary-800 hover:bg-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900 transition-colors disabled:opacity-50"
            >
              <FiMail className="w-3.5 h-3.5" /> Invite Parent
            </button>
          </div>
        ) : (
          <span className="capitalize text-stone-500 dark:text-stone-400">{r.registration_status}</span>
        ),
      className: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              statusFilter === status
                ? 'bg-primary-800 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {status}
            <span className="ml-1.5 opacity-70">
              ({initialRegistrations.filter((r) => r.registration_status === status).length})
            </span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFor={(r) => r.id}
        emptyTitle={`No ${statusFilter} registrations`}
      />
    </div>
  )
}
