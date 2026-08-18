'use client'

import { EmptyState } from './EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/hooks/usePagination'

export interface DataTableColumn<T> {
  header: string
  accessor: (row: T) => React.ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  keyFor,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  pageSize = 10,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  keyFor: (row: T) => string
  emptyTitle?: string
  emptyDescription?: string
  pageSize?: number
}) {
  const { page, setPage, pageCount, pageItems, total, pageSize: currentPageSize, setPageSize } = usePagination(
    rows,
    pageSize
  )

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div>
      <div className="relative rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        {/* Right-edge fade: below `lg` these tables commonly overflow their
            card with no other visual cue that there's more to scroll to --
            the last column just looks clipped. Purely decorative, so it's
            fine that it shows even when there's nothing to scroll to. */}
        <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-8 rounded-r-2xl bg-gradient-to-l from-white dark:from-stone-900 to-transparent" />
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3 whitespace-nowrap"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr
                  key={keyFor(row)}
                  className="border-b border-stone-100 dark:border-stone-800/60 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.header} className={`px-4 py-3 text-stone-700 dark:text-stone-200 ${col.className ?? ''}`}>
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        total={total}
        pageSize={currentPageSize}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}
