'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheck, FiX } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { toast } from '@/lib/toast'

export interface JoinRequestRow {
  id: string
  requested_at: string
  student: { first_name: string; last_name: string }
}

export function PendingJoinRequests({ classId, requests }: { classId: string; requests: JoinRequestRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function resolve(requestId: string, action: 'approve' | 'deny') {
    setBusyId(requestId)
    const res = await fetch(`/api/teacher/classes/${classId}/join-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusyId(null)
    if (res.ok) {
      toast.success(action === 'approve' ? 'Student added to class' : 'Request denied')
      router.refresh()
    } else {
      toast.error('Failed to update request')
    }
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-3">
      <h2 className="text-lg font-bold text-primary-900 dark:text-white">Pending Join Requests</h2>
      {requests.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
            <div>
              <p className="font-medium text-stone-800 dark:text-stone-100">
                {r.student.first_name} {r.student.last_name}
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
        ))
      )}
    </div>
  )
}
