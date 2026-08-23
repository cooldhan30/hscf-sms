'use client'

import { useEffect, useState } from 'react'
import { FiArrowLeft, FiTrash2, FiImage } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import type { WorksheetContent } from '@/lib/worksheetTypes'

interface SavedWorksheet {
  id: string
  theme: string
  content: WorksheetContent
  imageUrl: string | null
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
      description: `"${worksheet.theme}" and its illustration (if any) will be removed. This cannot be undone.`,
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
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
          <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase">{selected.theme}</p>
          {selected.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- generated illustration, arbitrary B2 signed URL
            <img src={selected.imageUrl} alt="Worksheet illustration" className="w-full max-w-xs mx-auto rounded-xl border border-stone-200 dark:border-stone-800" />
          )}

          <div>
            <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Passage</h3>
            <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{selected.content.passage}</p>
          </div>

          {selected.content.comprehensionQuestions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Questions</h3>
              <ol className="list-decimal list-inside space-y-1 text-stone-700 dark:text-stone-200">
                {selected.content.comprehensionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}

          {selected.content.vocabulary.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Vocabulary</h3>
              <ul className="space-y-1 text-stone-700 dark:text-stone-200">
                {selected.content.vocabulary.map(({ word, meaning }, i) => (
                  <li key={i}>
                    <span className="font-semibold">{word}</span> -- {meaning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.content.wordPuzzle.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Word Puzzle</h3>
              <ul className="flex flex-wrap gap-2">
                {selected.content.wordPuzzle.map(({ scrambled }, i) => (
                  <li
                    key={i}
                    className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm tracking-widest"
                  >
                    {scrambled}
                  </li>
                ))}
              </ul>
            </div>
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
            {worksheet.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- thumbnail, arbitrary B2 signed URL
              <img src={worksheet.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FiImage className="w-8 h-8" />
            )}
          </button>
          <div className="p-3 flex-1 flex flex-col gap-1">
            <button type="button" onClick={() => setSelected(worksheet)} className="text-left">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 line-clamp-2">{worksheet.theme}</p>
            </button>
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
