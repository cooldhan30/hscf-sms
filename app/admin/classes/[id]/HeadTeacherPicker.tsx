'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiStar } from 'react-icons/fi'
import { toast } from '@/lib/toast'

export interface ClassTeacherOption {
  teacherId: string
  name: string
  isPrimary: boolean
}

// Only shown when a class has more than one active teacher -- with just
// one, they're unambiguously the head, and this would be noise.
export function HeadTeacherPicker({ classId, teachers }: { classId: string; teachers: ClassTeacherOption[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function makeHead(teacherId: string) {
    setBusy(true)
    const res = await fetch(`/api/admin/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
    setBusy(false)
    if (res.ok) {
      toast.success('Head teacher updated')
      router.refresh()
    } else {
      toast.error('Failed to update head teacher')
    }
  }

  if (teachers.length < 2) return null

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-3">
      <h2 className="text-lg font-bold text-primary-900 dark:text-white">Head Teacher</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        All co-teachers can grade and manage this class the same way -- head teacher is just who gets top billing.
      </p>
      <div className="space-y-2">
        {teachers.map((t) => (
          <div
            key={t.teacherId}
            className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0"
          >
            <span className="flex items-center gap-2 font-medium text-stone-800 dark:text-stone-100">
              {t.isPrimary && <FiStar className="w-4 h-4 text-gold-500" />}
              {t.name}
            </span>
            {!t.isPrimary && (
              <button
                type="button"
                disabled={busy}
                onClick={() => makeHead(t.teacherId)}
                className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline disabled:opacity-60"
              >
                Make head teacher
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
