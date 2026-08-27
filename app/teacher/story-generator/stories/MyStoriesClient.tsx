'use client'

import { useEffect, useState } from 'react'
import { FiArrowLeft, FiTrash2, FiImage, FiSend } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/dashboard/Modal'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

interface SavedStory {
  id: string
  theme: string
  story: string
  imageUrl: string | null
  image_key: string | null
  created_at: string
}

interface MyStoriesClientProps {
  classes: { id: string; name: string }[]
}

export function MyStoriesClient({ classes }: MyStoriesClientProps) {
  const confirm = useConfirm()
  const [stories, setStories] = useState<SavedStory[] | null>(null)
  const [selected, setSelected] = useState<SavedStory | null>(null)

  // Assigning a saved story reuses the exact same sms_assignments
  // machinery as every other assignment (due date, scoring, late
  // penalty) -- mirrors the "Assign to Class" flow already on the
  // generator page (StoryGeneratorClient.tsx), just sourced from a
  // saved story's theme/story/image_key instead of in-progress
  // generator state.
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignClassId, setAssignClassId] = useState(classes[0]?.id ?? '')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assignMaxScore, setAssignMaxScore] = useState('100')
  const [assignPenalty, setAssignPenalty] = useState('0')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

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

  function openAssign() {
    setAssignClassId(classes[0]?.id ?? '')
    setAssignDueDate('')
    setAssignMaxScore('100')
    setAssignPenalty('0')
    setAssignError(null)
    setAssignOpen(true)
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!assignClassId) {
      setAssignError('Choose a class')
      return
    }
    setAssigning(true)
    setAssignError(null)

    const res = await fetch('/api/teacher/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: assignClassId,
        title: selected.theme,
        description: selected.story,
        dueDate: assignDueDate || null,
        maxScore: assignMaxScore,
        pointsDeductionPerDay: assignPenalty,
        published: true,
        storyImageKey: selected.image_key || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setAssigning(false)

    if (res.ok) {
      toast.success('Story assigned to your class')
      setAssignOpen(false)
    } else {
      setAssignError(data.error || 'Failed to assign story')
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

          {classes.length > 0 && (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <Button variant="outline" icon={<FiSend />} onClick={openAssign}>
                Assign to Class
              </Button>
            </div>
          )}
        </div>

        <Modal open={assignOpen} title={`Assign "${selected.theme}"`} onClose={() => setAssignOpen(false)}>
          <form onSubmit={handleAssign} className="space-y-4">
            {assignError && (
              <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
                {assignError}
              </p>
            )}

            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Class</label>
              <select
                value={assignClassId}
                onChange={(e) => setAssignClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Max Score</label>
                <input
                  type="number"
                  min="1"
                  value={assignMaxScore}
                  onChange={(e) => setAssignMaxScore(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Late Penalty (points/day)
              </label>
              <input
                type="number"
                min="0"
                value={assignPenalty}
                onChange={(e) => setAssignPenalty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={assigning}>
              {assigning ? 'Assigning...' : 'Assign'}
            </Button>
          </form>
        </Modal>
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
