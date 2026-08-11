'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUserMinus } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

export interface RosterRow {
  status: string
  student: { id: string; first_name: string; last_name: string }
}

export function RosterList({ classId, enrollments }: { classId: string; enrollments: RosterRow[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null)

  async function remove(studentId: string, name: string) {
    const confirmed = await confirm({
      title: `Remove ${name} from this class?`,
      description: 'They will need to be re-invited or re-approved to rejoin.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!confirmed) return

    setBusyStudentId(studentId)
    const res = await fetch(`/api/teacher/classes/${classId}/enrollments?studentId=${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    })
    setBusyStudentId(null)
    if (res.ok) {
      toast.success('Student removed from class')
      router.refresh()
    } else {
      toast.error('Failed to remove student')
    }
  }

  if (enrollments.length === 0) {
    return <EmptyState title="No students enrolled yet" />
  }

  return (
    <div className="divide-y divide-stone-100 dark:divide-stone-800">
      {enrollments.map((e) => (
        <div key={e.student.id} className="py-2.5 flex items-center justify-between text-sm">
          <span className="font-medium text-stone-800 dark:text-stone-100">
            {e.student.first_name} {e.student.last_name}
          </span>
          <div className="flex items-center gap-3">
            <span className="capitalize text-stone-500 dark:text-stone-400">{e.status}</span>
            <button
              onClick={() => remove(e.student.id, `${e.student.first_name} ${e.student.last_name}`)}
              disabled={busyStudentId === e.student.id}
              className="p-1.5 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
              aria-label="Remove from class"
            >
              <FiUserMinus className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
