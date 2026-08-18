'use client'

import { useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'

// router.refresh() re-runs the Server Component but the request can still
// be answered by a cache in front of the app (Vercel/Cloudflare) --
// window.location.reload() forces a real new navigation, which is the
// more reliable way to guarantee fresh numbers after a storage cleanup.
export function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false)

  return (
    <button
      onClick={() => {
        setRefreshing(true)
        window.location.reload()
      }}
      disabled={refreshing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40"
    >
      <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  )
}
