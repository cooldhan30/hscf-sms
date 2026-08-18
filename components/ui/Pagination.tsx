'use client'

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  onPageSizeChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  total: number
  pageSize: number
  onPageSizeChange?: (pageSize: number) => void
}) {
  if (total === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  // Options always include whatever pageSize is currently in effect, even
  // if it's not one of the presets (a caller-provided initial pageSize
  // like 25) -- otherwise the select would silently show the wrong value.
  const options = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b)

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-1 pt-3 flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Showing {start}–{end} of {total}
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 text-xs focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {options.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pageCount > 1 && (
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
      )}
    </nav>
  )
}
