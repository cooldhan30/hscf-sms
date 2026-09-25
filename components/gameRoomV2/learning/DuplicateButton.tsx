'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiCopy } from 'react-icons/fi'
import { toast } from '@/lib/toast'

// Copies a readable question set into the caller's My Question Sets (via
// the existing duplicate route) and opens the copy in the Builder.
export function DuplicateButton({ questionSetId, label = 'Duplicate to My Question Sets' }: { questionSetId: string; label?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function duplicate() {
    setBusy(true)
    const res = await fetch(`/api/gameroom-v2/question-sets/${questionSetId}/duplicate`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      toast.error(data.error || 'Failed to duplicate')
      return
    }
    toast.success('Copied to My Question Sets -- the copy is yours to edit')
    router.push(`/gameroom-v2/builder/${data.questionSet.id}`)
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={duplicate}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
    >
      <FiCopy className="w-4 h-4" aria-hidden /> {busy ? 'Copying...' : label}
    </button>
  )
}
