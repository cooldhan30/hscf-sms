'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheck, FiX } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

export function LinkRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)

  async function resolve(action: 'approve' | 'deny') {
    setBusy(action)
    try {
      const res = await fetch(`/api/student/link-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update request')

      toast.success(action === 'approve' ? 'Link approved.' : 'Request denied.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex gap-2 flex-shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<FiX />}
        disabled={busy !== null}
        onClick={() => resolve('deny')}
      >
        {busy === 'deny' ? '...' : 'Deny'}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={<FiCheck />}
        disabled={busy !== null}
        onClick={() => resolve('approve')}
      >
        {busy === 'approve' ? '...' : 'Approve'}
      </Button>
    </div>
  )
}
