'use client'

import { FiCopy } from 'react-icons/fi'
import { toast } from '@/lib/toast'

export function JoinCodeBadge({ code }: { code: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(code)
        toast.success('Join code copied')
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
    >
      {code} <FiCopy className="w-3 h-3" />
    </button>
  )
}
