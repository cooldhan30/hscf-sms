'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiPlus, FiX, FiUser } from 'react-icons/fi'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

export interface ClassTeacherRow {
  teacher_id: string
  is_primary: boolean
  teacher: { id: string; profile: { first_name: string; last_name: string } | null } | null
}

export interface TeacherOption {
  id: string
  profile: { first_name: string; last_name: string } | null
}

// A class can be taught by several teachers. Every assigned teacher has
// the same access -- roster, attendance, assignments, gradebook -- the
// "Lead" badge only marks whose name shows beside the class elsewhere.
export function ClassTeachers({
  classId,
  assigned,
  allTeachers,
}: {
  classId: string
  assigned: ClassTeacherRow[]
  allTeachers: TeacherOption[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  const assignedIds = new Set(assigned.map((a) => a.teacher_id))
  const available = allTeachers.filter((t) => !assignedIds.has(t.id))

  function nameOf(p: { first_name: string; last_name: string } | null | undefined) {
    return p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown teacher'
  }

  async function addTeacher(teacherId: string) {
    setAdding(false)
    setBusy(true)
    const res = await fetch(`/api/admin/classes/${classId}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      toast.error(data.error || 'Could not add teacher')
      return
    }
    toast.success('Teacher added to this class')
    router.refresh()
  }

  async function removeTeacher(row: ClassTeacherRow) {
    const name = nameOf(row.teacher?.profile)
    const proceed = await confirm({
      title: `Remove ${name} from this class?`,
      description: row.is_primary
        ? `They are the lead teacher. Another assigned teacher will take over as lead, or the class becomes unassigned if nobody else is left.`
        : `They will lose access to this class's roster, attendance, assignments and gradebook.`,
      confirmLabel: 'Remove teacher',
      tone: 'danger',
    })
    if (!proceed) return

    setBusy(true)
    const res = await fetch(`/api/admin/classes/${classId}/teachers?teacherId=${row.teacher_id}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      toast.error(data.error || 'Could not remove teacher')
      return
    }
    toast.success(`${name} removed from this class`)
    router.refresh()
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">Teachers</h2>
        {available.length > 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors disabled:opacity-50"
          >
            <FiPlus className="w-3.5 h-3.5" /> Add teacher
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => e.target.value && addTeacher(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">Select a teacher...</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {nameOf(t.profile)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAdding(false)}
            className="px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {assigned.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No teacher assigned yet. Add one so they can take attendance and post assignments.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {assigned.map((row) => (
            <li key={row.teacher_id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
                <FiUser className="w-4 h-4 text-stone-400 flex-shrink-0" />
                {nameOf(row.teacher?.profile)}
                {row.is_primary && (
                  <Badge variant="neutral" size="sm">
                    Lead
                  </Badge>
                )}
              </span>
              <button
                onClick={() => removeTeacher(row)}
                disabled={busy}
                aria-label={`Remove ${nameOf(row.teacher?.profile)}`}
                className="p-1.5 rounded-lg text-stone-400 hover:text-terracotta-700 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors disabled:opacity-50"
              >
                <FiX className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
