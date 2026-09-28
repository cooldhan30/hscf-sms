'use client'

import { FiCopy, FiShare2 } from 'react-icons/fi'
import { toast } from '@/lib/toast'

// Same hard-coded prefix as lib/gameRoom/sound.ts -- next.config.mjs basePath.
const BASE_PATH = '/tamizhi'

// Large, copy/share-able join code for a teacher's class card on My Classes.
// (JoinCodeBadge is the compact inline version used on detail pages/tables.)
export function ClassJoinCodePanel({ code, className }: { code: string; className: string }) {
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('Could not copy -- select the code and copy it manually')
    }
  }

  async function share() {
    const url = `${window.location.origin}${BASE_PATH}/student/classes`
    const text = `Join "${className}" on Tamizhi: sign in, go to My Classes and enter join code ${code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${className}`, text, url })
      } catch {
        // User closed the share sheet -- nothing to do.
      }
      return
    }
    await copy(`${text}\n${url}`, 'Invite message copied')
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Join code</p>
        <p className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.2em] text-primary-800 dark:text-primary-300 select-all break-all">
          {code}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => copy(code, 'Join code copied')}
          aria-label={`Copy join code for ${className}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <FiCopy className="w-4 h-4" /> Copy
        </button>
        <button
          type="button"
          onClick={share}
          aria-label={`Share join code for ${className}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 transition-colors"
        >
          <FiShare2 className="w-4 h-4" /> Share
        </button>
      </div>
    </div>
  )
}
