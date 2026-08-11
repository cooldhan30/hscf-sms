'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUserPlus, FiUserMinus } from 'react-icons/fi'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import type { SmsStudent } from '@/types/database'

export interface EnrollmentRow {
  status: string
  enrolled_at: string
  student: SmsStudent
}

export function RosterClient({
  classId,
  initialEnrollments,
  allStudents,
}: {
  classId: string
  initialEnrollments: EnrollmentRow[]
  allStudents: SmsStudent[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [busy, setBusy] = useState(false)

  const availableStudents = useMemo(() => {
    const enrolledIds = new Set(initialEnrollments.map((e) => e.student.id))
    return allStudents.filter((s) => !enrolledIds.has(s.id))
  }, [allStudents, initialEnrollments])

  async function enroll() {
    if (!selectedStudentId) return
    setBusy(true)
    const res = await fetch(`/api/admin/classes/${classId}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: selectedStudentId }),
    })
    setBusy(false)
    if (res.ok) {
      setSelectedStudentId('')
      toast.success('Student enrolled')
      router.refresh()
    } else {
      toast.error('Failed to enroll student')
    }
  }

  async function unenroll(studentId: string) {
    const confirmed = await confirm({
      title: 'Remove this student from the class?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy(true)
    const res = await fetch(
      `/api/admin/classes/${classId}/enrollments?studentId=${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    )
    setBusy(false)
    if (res.ok) {
      toast.success('Student removed from class')
      router.refresh()
    } else {
      toast.error('Failed to remove student')
    }
  }

  const columns: DataTableColumn<EnrollmentRow>[] = [
    {
      header: 'Student',
      accessor: (e) => (
        <span className="font-semibold text-stone-800 dark:text-stone-100">
          {e.student.first_name} {e.student.last_name}
        </span>
      ),
    },
    { header: 'Status', accessor: (e) => <span className="capitalize">{e.status}</span> },
    {
      header: '',
      accessor: (e) => (
        <button
          onClick={() => unenroll(e.student.id)}
          disabled={busy}
          className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
          aria-label="Remove from class"
        >
          <FiUserMinus className="w-4 h-4" />
        </button>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">Class Roster</h2>
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {initialEnrollments.length} student{initialEnrollments.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="">Select a student to enroll...</option>
          {availableStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
        <Button variant="primary" icon={<FiUserPlus />} disabled={!selectedStudentId || busy} onClick={enroll}>
          Enroll
        </Button>
      </div>

      {initialEnrollments.length > 0 ? (
        <DataTable columns={columns} rows={initialEnrollments} keyFor={(e) => e.student.id} />
      ) : (
        <EmptyState icon={FiUserPlus} title="No students enrolled yet" description="Use the dropdown above to add students." />
      )}
    </div>
  )
}
