'use client'

import { EmptyState } from '@/components/dashboard/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/hooks/usePagination'

export interface ReportTableColumn<T> {
  header: string
  accessor: (row: T) => React.ReactNode
  align?: 'left' | 'right'
}

export function ReportTable<T>({
  columns,
  rows,
  keyFor,
  emptyTitle = 'No data for this range',
  footer,
  pageSize = 10,
}: {
  columns: ReportTableColumn<T>[]
  rows: T[]
  keyFor: (row: T) => string
  emptyTitle?: string
  footer?: React.ReactNode[]
  pageSize?: number
}) {
  const { page, setPage, pageCount, pageItems, total, pageSize: currentPageSize, setPageSize } = usePagination(
    rows,
    pageSize
  )

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`font-semibold text-stone-600 dark:text-stone-300 px-4 py-3 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
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
                  <td
                    key={col.header}
                    className={`px-4 py-3 text-stone-700 dark:text-stone-200 ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t-2 border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50 font-semibold">
                {footer.map((cell, i) => (
                  <td
                    key={i}
                    className={`px-4 py-3 text-stone-800 dark:text-stone-100 ${
                      columns[i]?.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
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
