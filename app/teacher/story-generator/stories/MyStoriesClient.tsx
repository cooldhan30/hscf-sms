'use client'

import { useEffect, useState } from 'react'
import { FiArrowLeft, FiTrash2, FiImage } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

interface SavedStory {
  id: string
  theme: string
  story: string
  imageUrl: string | null
  created_at: string
}

export function MyStoriesClient() {
  const confirm = useConfirm()
  const [stories, setStories] = useState<SavedStory[] | null>(null)
  const [selected, setSelected] = useState<SavedStory | null>(null)

  useEffect(() => {
    fetch('/api/teacher/stories')
      .then((res) => res.json())
      .then((data) => setStories(data.stories ?? []))
      .catch(() => setStories([]))
  }, [])

  async function handleDelete(story: SavedStory) {
    const confirmed = await confirm({
      title: `Delete this story?`,
      description: `"${story.theme}" and its illustration (if any) will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/teacher/stories/${story.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Story deleted')
      setStories((prev) => (prev ?? []).filter((s) => s.id !== story.id))
      if (selected?.id === story.id) setSelected(null)
    } else {
      toast.error('Failed to delete story')
    }
  }

  if (stories === null) {
    return <p className="text-sm text-stone-400 dark:text-stone-500">Loading your stories...</p>
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to My Stories
        </button>
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
          <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase">{selected.theme}</p>
          {selected.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- generated illustration, arbitrary B2 signed URL
            <img src={selected.imageUrl} alt="Story illustration" className="w-full max-w-xs mx-auto rounded-xl border border-stone-200 dark:border-stone-800" />
          )}
          <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{selected.story}</p>
        </div>
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <EmptyState
        title="No saved stories yet"
        description="Generate a story and click Save Story to keep it here."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {stories.map((story) => (
        <div
          key={story.id}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden flex flex-col"
        >
          <button
            type="button"
            onClick={() => setSelected(story)}
            className="aspect-video flex items-center justify-center bg-stone-50 dark:bg-stone-950/40 text-stone-300 dark:text-stone-700"
          >
            {story.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- thumbnail, arbitrary B2 signed URL
              <img src={story.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FiImage className="w-8 h-8" />
            )}
          </button>
          <div className="p-3 flex-1 flex flex-col gap-1">
            <button type="button" onClick={() => setSelected(story)} className="text-left">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 line-clamp-2">{story.theme}</p>
            </button>
            <p className="text-xs text-stone-400 dark:text-stone-500">{new Date(story.created_at).toLocaleDateString()}</p>
            <div className="mt-auto flex justify-end pt-2">
              <button
                onClick={() => handleDelete(story)}
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
