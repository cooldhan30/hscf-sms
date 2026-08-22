'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiFeather, FiImage, FiRefreshCw, FiSave, FiBookOpen, FiCheckCircle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

const POLL_INTERVAL_MS = 2000
// LCM-LoRA generation runs ~7-8s once the model is warm in VRAM (down
// from ~30-50s on the previous 30-step config) -- 15 polls at 2s each
// gives a 30s ceiling, comfortably covering a cold-start model load or
// a queue of a few jobs ahead of this one without leaving a teacher
// waiting a full 2 minutes on a job that's genuinely stuck.
const MAX_POLLS = 15

type ImageStatus = 'idle' | 'generating' | 'done' | 'error'

export function StoryGeneratorClient() {
  const [theme, setTheme] = useState('')
  const [language, setLanguage] = useState<'ta' | 'en'>('ta')
  const [targetAge, setTargetAge] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [story, setStory] = useState<string | null>(null)

  // Kept in component state (not persisted) -- the story itself isn't
  // saved anywhere yet either, so the image follows the same lifetime:
  // both are gone on refresh. promptId living in state (not a ref) means
  // a re-render from elsewhere on the page won't drop an in-progress
  // poll loop, since the effect below re-arms off this same value.
  const [imageStatus, setImageStatus] = useState<ImageStatus>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [promptId, setPromptId] = useState<string | null>(null)
  // 1-based position in ComfyUI's combined running+pending queue (1 =
  // currently executing); null until the first poll reports one.
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const pollCountRef = useRef(0)

  // Set once a save succeeds; the saved row's id is what a later
  // illustration PATCHes onto (see handleGenerateImage) so generating an
  // image after saving updates the same row instead of needing a second
  // save action.
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (generating) return

    setGenerating(true)
    setError(null)
    // A new story invalidates whatever illustration belonged to the
    // previous one -- reset the image lifecycle along with it.
    setImageStatus('idle')
    setImageUrl(null)
    setImageKey(null)
    setImageError(null)
    setPromptId(null)
    setQueuePosition(null)
    setSavedStoryId(null)
    setSaveError(null)

    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          language,
          targetAge: targetAge ? Number(targetAge) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to generate story')
        return
      }

      setStory(data.story)
    } catch {
      setError('Failed to generate story -- check your connection and try again')
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateImage() {
    if (imageStatus === 'generating') return
    setImageStatus('generating')
    setImageError(null)
    setImageUrl(null)
    setImageKey(null)
    setQueuePosition(null)
    pollCountRef.current = 0

    // Reusing the teacher's own theme as the image prompt -- it's
    // already a short scene description ("a story about a helpful
    // elephant"), unlike the generated story itself, which is long-form
    // Tamil prose that Stable Diffusion checkpoints handle poorly.
    // Wrapped with a fixed style prefix so every illustration reads as
    // the same "children's book" look regardless of theme.
    const prompt = `children's book illustration, storybook art style, colorful, ${theme}`

    try {
      const res = await fetch('/api/story-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setImageStatus('error')
        setImageError(data.error || 'Failed to start image generation')
        return
      }

      setPromptId(data.promptId)
    } catch {
      setImageStatus('error')
      setImageError('Failed to start image generation -- check your connection and try again')
    }
  }

  async function handleSaveStory() {
    if (!story || saving) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch('/api/teacher/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, story, imageKey }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSaveError(data.error || 'Failed to save story')
        return
      }

      setSavedStoryId(data.story.id)
    } catch {
      setSaveError('Failed to save story -- check your connection and try again')
    } finally {
      setSaving(false)
    }
  }

  // Polls /api/story-image/status while a job is in flight. Re-arms
  // whenever promptId changes and tears itself down on completion/error/
  // unmount, so navigating away mid-poll just stops polling rather than
  // leaking an interval -- there's nowhere else for an in-progress
  // promptId to live once this component is gone, matching the
  // client-state-only scope of the story text it belongs to.
  useEffect(() => {
    if (!promptId || imageStatus !== 'generating') return

    const interval = setInterval(async () => {
      pollCountRef.current += 1
      try {
        const res = await fetch(`/api/story-image/status?promptId=${encodeURIComponent(promptId)}`)
        const data = await res.json().catch(() => ({}))

        if (!res.ok || data.status === 'error') {
          clearInterval(interval)
          setImageStatus('error')
          setImageError(data.error || 'Image generation failed')
          return
        }

        if (data.status === 'done') {
          clearInterval(interval)
          setImageStatus('done')
          setImageUrl(data.url)
          setImageKey(data.key)
          // Story already saved (teacher clicked Save before generating
          // the illustration, or is regenerating one after an earlier
          // save) -- attach the new image to that same row rather than
          // requiring a second explicit save just for the picture.
          if (savedStoryId) {
            fetch(`/api/teacher/stories/${savedStoryId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageKey: data.key }),
            }).catch(() => {
              // Best-effort -- the image still displays in this session
              // either way; a failed background attach just means it
              // won't show up yet in the saved library until retried.
            })
          }
          return
        }

        // data.status === 'pending' -- still queued/running. Position is
        // best-effort (the status route falls back to null if the queue
        // check itself fails), so this just quietly has no number to
        // show rather than treating a missing position as an error.
        setQueuePosition(typeof data.position === 'number' ? data.position : null)

        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(interval)
          setImageStatus('error')
          setImageError('Image generation is taking longer than expected -- please try again.')
        }
      } catch {
        // A single dropped poll isn't fatal -- keep trying until
        // MAX_POLLS, since a transient network hiccup shouldn't abandon
        // a job that's still genuinely running on the server.
        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(interval)
          setImageStatus('error')
          setImageError('Lost connection while checking image generation status.')
        }
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [promptId, imageStatus, savedStoryId])

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="space-y-4 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        {error && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Theme / Idea
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. ஒரு நண்பன் உதவும் கதை, or 'a story about a helpful elephant'"
            rows={3}
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Tamil or English -- the story itself is always written in Tamil.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Target Age (optional)
            </label>
            <input
              type="number"
              min="1"
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value)}
              placeholder="e.g. 7"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Theme Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'ta' | 'en')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="ta">Tamil</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth icon={<FiFeather />} disabled={generating}>
          {generating ? 'Generating story...' : 'Generate Story'}
        </Button>
      </form>

      <div className="flex justify-end">
        <Link
          href="/teacher/story-generator/stories"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
        >
          <FiBookOpen className="w-4 h-4" /> My Stories
        </Link>
      </div>

      {story && (
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
          <h2 className="font-bold text-stone-800 dark:text-stone-100">Generated Story</h2>
          <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{story}</p>

          <div>
            {saveError && (
              <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2 mb-2">
                {saveError}
              </p>
            )}
            {savedStoryId ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400">
                <FiCheckCircle className="w-4 h-4" /> Saved to My Stories
              </p>
            ) : (
              <Button variant="outline" icon={<FiSave />} onClick={handleSaveStory} disabled={saving}>
                {saving ? 'Saving...' : 'Save Story'}
              </Button>
            )}
          </div>

          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
            {imageStatus === 'idle' && (
              <Button variant="outline" icon={<FiImage />} onClick={handleGenerateImage}>
                Generate Illustration
              </Button>
            )}

            {imageStatus === 'generating' && (
              <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                {queuePosition === null ? (
                  'Starting illustration generation...'
                ) : queuePosition === 1 ? (
                  'Generating your illustration now... this usually takes about 10 seconds.'
                ) : (
                  `${queuePosition}${queuePosition === 2 ? 'nd' : queuePosition === 3 ? 'rd' : 'th'} in queue -- other teachers are generating illustrations too. This may take a few minutes.`
                )}
              </div>
            )}

            {imageStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
                  {imageError}
                </p>
                <Button variant="outline" icon={<FiRefreshCw />} onClick={handleGenerateImage}>
                  Try Again
                </Button>
              </div>
            )}

            {imageStatus === 'done' && imageUrl && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated illustration, arbitrary B2 signed URL */}
                <img src={imageUrl} alt="Story illustration" className="w-full max-w-xs mx-auto rounded-xl border border-stone-200 dark:border-stone-800" />
                <Button variant="outline" icon={<FiRefreshCw />} onClick={handleGenerateImage}>
                  Regenerate Illustration
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
