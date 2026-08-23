'use client'

import { useEffect, useState } from 'react'
import { FiArrowLeft, FiTrash2, FiGrid, FiBookOpen } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { PictureFillBlankWorksheet } from '@/components/resources/PictureFillBlankWorksheet'
import { ReadingComprehensionWorksheet } from '@/components/resources/ReadingComprehensionWorksheet'
import type { WorksheetContent } from '@/lib/worksheetTypes'

interface SavedWorksheet {
  id: string
  theme: string
  content: WorksheetContent
  created_at: string
}

export function MyWorksheetsClient() {
  const confirm = useConfirm()
  const [worksheets, setWorksheets] = useState<SavedWorksheet[] | null>(null)
  const [selected, setSelected] = useState<SavedWorksheet | null>(null)

  useEffect(() => {
    fetch('/api/teacher/worksheets')
      .then((res) => res.json())
      .then((data) => setWorksheets(data.worksheets ?? []))
      .catch(() => setWorksheets([]))
  }, [])

  async function handleDelete(worksheet: SavedWorksheet) {
    const confirmed = await confirm({
      title: `Delete this worksheet?`,
      description: `"${worksheet.theme}" will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/teacher/worksheets/${worksheet.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Worksheet deleted')
      setWorksheets((prev) => (prev ?? []).filter((w) => w.id !== worksheet.id))
      if (selected?.id === worksheet.id) setSelected(null)
    } else {
      toast.error('Failed to delete worksheet')
    }
  }

  if (worksheets === null) {
    return <p className="text-sm text-stone-400 dark:text-stone-500">Loading your worksheets...</p>
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to My Worksheets
        </button>
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          {selected.content.worksheetType === 'picture_fillblank' ? (
            <PictureFillBlankWorksheet content={selected.content} />
          ) : (
            <ReadingComprehensionWorksheet content={selected.content} />
          )}
        </div>
      </div>
    )
  }

  if (worksheets.length === 0) {
    return (
      <EmptyState
        title="No saved worksheets yet"
        description="Generate a worksheet from the Resources page and click Save Worksheet to keep it here."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {worksheets.map((worksheet) => (
        <div
          key={worksheet.id}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden flex flex-col"
        >
          <button
            type="button"
            onClick={() => setSelected(worksheet)}
            className="aspect-video flex items-center justify-center bg-stone-50 dark:bg-stone-950/40 text-stone-300 dark:text-stone-700"
          >
            {worksheet.content.worksheetType === 'picture_fillblank' ? (
              <FiGrid className="w-8 h-8" />
            ) : (
              <FiBookOpen className="w-8 h-8" />
            )}
          </button>
          <div className="p-3 flex-1 flex flex-col gap-1">
            <button type="button" onClick={() => setSelected(worksheet)} className="text-left">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 line-clamp-2">
                {worksheet.content.title || worksheet.theme}
              </p>
            </button>
            <div>
              <Badge variant="secondary" size="sm">
                {worksheet.content.worksheetType === 'picture_fillblank' ? 'Picture Fill-in-Blank' : 'Reading Comprehension'}
              </Badge>
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">{new Date(worksheet.created_at).toLocaleDateString()}</p>
            <div className="mt-auto flex justify-end pt-2">
              <button
                onClick={() => handleDelete(worksheet)}
                className="p-1.5 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                aria-label="Delete"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
