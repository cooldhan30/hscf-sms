'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheckCircle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

// A resource-linked assignment has nothing to type/upload -- the
// "submission" is just marking it read, via the same
// /api/student/submissions endpoint every other assignment already
// POSTs to (content: 'Completed' satisfies its "provide text, a file,
// or audio" check).
export function ReadingComplete({ assignmentId }: { assignmentId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function markComplete() {
    setSaving(true)
    const res = await fetch('/api/student/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, content: 'Completed' }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (res.ok) {
      toast.success('Marked as complete')
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to mark as complete')
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <Button variant="primary" icon={<FiCheckCircle />} onClick={markComplete} disabled={saving}>
        {saving ? 'Saving...' : 'Mark as read'}
      </Button>
    </div>
  )
}
