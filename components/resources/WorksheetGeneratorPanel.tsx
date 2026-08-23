'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiFeather, FiImage, FiRefreshCw, FiSave, FiBookOpen, FiCheckCircle, FiSend } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/dashboard/Modal'
import { toast } from '@/lib/toast'
import { STORY_LEVEL_OPTIONS } from '@/lib/storyLevels'
import type { WorksheetContent } from '@/lib/worksheetTypes'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 15

type ImageStatus = 'idle' | 'generating' | 'done' | 'error'

// Adapts StoryGeneratorClient's generate/poll-image/save/assign lifecycle
// for structured worksheet content instead of a single prose string --
// see app/teacher/story-generator/StoryGeneratorClient.tsx for the
// original this mirrors.
export function WorksheetGeneratorPanel({
  open,
  onClose,
  classes,
}: {
  open: boolean
  onClose: () => void
  classes: { id: string; name: string }[]
}) {
  const [theme, setTheme] = useState('')
  const [language, setLanguage] = useState<'ta' | 'en'>('ta')
  const [level, setLevel] = useState<string>(STORY_LEVEL_OPTIONS[1]?.value ?? STORY_LEVEL_OPTIONS[0].value)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [worksheet, setWorksheet] = useState<WorksheetContent | null>(null)

  const [imageStatus, setImageStatus] = useState<ImageStatus>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [promptId, setPromptId] = useState<string | null>(null)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const pollCountRef = useRef(0)

  const [savedWorksheetId, setSavedWorksheetId] = useState<string | null>(null)
  const rowIdRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignClassId, setAssignClassId] = useState(classes[0]?.id ?? '')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assignMaxScore, setAssignMaxScore] = useState('100')
  const [assignPenalty, setAssignPenalty] = useState('0')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (generating) return

    setGenerating(true)
    setError(null)
    setWorksheet(null)
    setImageStatus('idle')
    setImageUrl(null)
    setImageKey(null)
    setImageError(null)
    setPromptId(null)
    setQueuePosition(null)
    setSavedWorksheetId(null)
    setSaveError(null)
    rowIdRef.current = null

    handleGenerateImage()

    try {
      const res = await fetch('/api/generate-worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, language, level }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to generate worksheet')
        return
      }

      setWorksheet(data.worksheet)
    } catch {
      setError('Failed to generate worksheet -- check your connection and try again')
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
    setSavedWorksheetId(null)
    setSaveError(null)

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

  async function handleSaveWorksheet() {
    if (!worksheet || saving) return
    setSaving(true)
    setSaveError(null)

    const isUpdate = Boolean(rowIdRef.current)
    const url = isUpdate ? `/api/teacher/worksheets/${rowIdRef.current}` : '/api/teacher/worksheets'

    try {
      const res = await fetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, content: worksheet, imageKey }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSaveError(data.error || 'Failed to save worksheet')
        return
      }

      rowIdRef.current = data.worksheet.id
      setSavedWorksheetId(data.worksheet.id)
    } catch {
      setSaveError('Failed to save worksheet -- check your connection and try again')
    } finally {
      setSaving(false)
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
    if (!worksheet) return
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
        title: theme,
        worksheetContent: worksheet,
        dueDate: assignDueDate || null,
        maxScore: assignMaxScore,
        pointsDeductionPerDay: assignPenalty,
        published: true,
        storyImageKey: imageKey || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setAssigning(false)

    if (res.ok) {
      toast.success('Worksheet assigned to your class')
      setAssignOpen(false)
    } else {
      setAssignError(data.error || 'Failed to assign worksheet')
    }
  }

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
          return
        }

        setQueuePosition(typeof data.position === 'number' ? data.position : null)

        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(interval)
          setImageStatus('error')
          setImageError('Image generation is taking longer than expected -- please try again.')
        }
      } catch {
        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(interval)
          setImageStatus('error')
          setImageError('Lost connection while checking image generation status.')
        }
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [promptId, imageStatus])

  return (
    <Modal open={open} title="Worksheet Generator" onClose={onClose} size="large">
      <div className="space-y-6">
        <form onSubmit={handleGenerate} className="space-y-4">
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
              Tamil or English -- the worksheet itself is always written in Tamil.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Student Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                {STORY_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
            {generating ? 'Generating worksheet...' : 'Generate Worksheet'}
          </Button>
        </form>

        <div className="flex justify-end">
          <Link
            href="/teacher/resources/worksheets"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
          >
            <FiBookOpen className="w-4 h-4" /> My Worksheets
          </Link>
        </div>

        {worksheet && (
          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
            <h2 className="font-bold text-stone-800 dark:text-stone-100">Generated Worksheet</h2>

            <div>
              {imageStatus === 'idle' && (
                <Button variant="outline" icon={<FiImage />} onClick={handleGenerateImage}>
                  Generate Illustration
                </Button>
              )}

              {imageStatus === 'generating' && (
                <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 py-6 justify-center bg-stone-50 dark:bg-stone-950/40 rounded-xl">
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  {queuePosition === null ? (
                    'Starting illustration...'
                  ) : queuePosition === 1 ? (
                    'Illustrating your worksheet... this usually takes about 10 seconds.'
                  ) : (
                    `${queuePosition}${queuePosition === 2 ? 'nd' : queuePosition === 3 ? 'rd' : 'th'} in queue -- other teachers are generating illustrations too. This may take a few minutes.`
                  )}
                </div>
              )}

              {imageStatus === 'error' && (
                <div className="space-y-2">
                  <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
                    Illustration: {imageError} You can still save your worksheet without it.
                  </p>
                  <Button variant="outline" icon={<FiRefreshCw />} onClick={handleGenerateImage}>
                    Try Again
                  </Button>
                </div>
              )}

              {imageStatus === 'done' && imageUrl && (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated illustration, arbitrary B2 signed URL */}
                  <img src={imageUrl} alt="Worksheet illustration" className="w-full max-w-xs mx-auto rounded-xl border border-stone-200 dark:border-stone-800" />
                  <div className="flex justify-center">
                    <Button variant="outline" icon={<FiRefreshCw />} onClick={handleGenerateImage}>
                      Regenerate Illustration
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Passage</h3>
              <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{worksheet.passage}</p>
            </div>

            {worksheet.comprehensionQuestions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Questions</h3>
                <ol className="list-decimal list-inside space-y-1 text-stone-700 dark:text-stone-200">
                  {worksheet.comprehensionQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}

            {worksheet.vocabulary.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Vocabulary</h3>
                <ul className="space-y-1 text-stone-700 dark:text-stone-200">
                  {worksheet.vocabulary.map(({ word, meaning }, i) => (
                    <li key={i}>
                      <span className="font-semibold">{word}</span> -- {meaning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {worksheet.wordPuzzle.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Word Puzzle</h3>
                <ul className="flex flex-wrap gap-2">
                  {worksheet.wordPuzzle.map(({ scrambled }, i) => (
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

            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
              {saveError && (
                <p className="w-full text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2 mb-2">
                  {saveError}
                </p>
              )}
              {savedWorksheetId ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400">
                  <FiCheckCircle className="w-4 h-4" /> Saved to My Worksheets
                </p>
              ) : (
                <Button variant="outline" icon={<FiSave />} onClick={handleSaveWorksheet} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Worksheet'}
                </Button>
              )}
              {classes.length > 0 && (
                <Button variant="outline" icon={<FiSend />} onClick={openAssign}>
                  Assign to Class
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={assignOpen} title={`Assign "${theme}"`} onClose={() => setAssignOpen(false)}>
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
    </Modal>
  )
}
