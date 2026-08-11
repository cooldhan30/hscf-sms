'use client'

import { FiDownload, FiFileText } from 'react-icons/fi'
import { downloadCsv, type ExportColumn } from '@/lib/reports/csv'
import { downloadPdf } from '@/lib/reports/pdf'

export function ExportButtons({
  filename,
  title,
  columns,
  rows,
}: {
  filename: string
  title: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
}) {
  const disabled = rows.length === 0

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => downloadCsv(filename, columns, rows)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FiDownload className="w-3.5 h-3.5" /> CSV
      </button>
      <button
        onClick={() => downloadPdf(filename, title, columns, rows)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FiFileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  )
}
