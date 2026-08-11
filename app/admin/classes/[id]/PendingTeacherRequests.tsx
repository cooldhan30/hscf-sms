'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheck, FiX } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'
import type { SmsProfile } from '@/types/database'

export interface TeacherRequestRow {
  id: string
  requested_at: string
  teacher: { profile: SmsProfile }
}

export function PendingTeacherRequests({ classId, requests }: { classId: string; requests: TeacherRequestRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function resolve(requestId: string, action: 'approve' | 'deny') {
    setBusyId(requestId)
    const res = await fetch(`/api/admin/classes/${classId}/teacher-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusyId(null)
    if (res.ok) {
      toast.success(action === 'approve' ? 'Teacher approved for this class' : 'Request denied')
      router.refresh()
    } else {
      toast.error('Failed to update request')
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-3">
      <h2 className="text-lg font-bold text-primary-900 dark:text-white">Pending Teacher Requests</h2>
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
          <div>
            <p className="font-medium text-stone-800 dark:text-stone-100">
              {r.teacher.profile.first_name} {r.teacher.profile.last_name}
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-600">
              Requested {new Date(r.requested_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<FiX />}
              disabled={busyId === r.id}
              onClick={() => resolve(r.id, 'deny')}
            >
              Deny
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<FiCheck />}
              disabled={busyId === r.id}
              onClick={() => resolve(r.id, 'approve')}
            >
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
