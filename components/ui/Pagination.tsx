'use client'

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  total: number
  pageSize: number
}) {
  if (pageCount <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-1 pt-3 flex-wrap gap-3">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300 px-2" aria-current="page">
          Page {page} of {pageCount}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  )
}
