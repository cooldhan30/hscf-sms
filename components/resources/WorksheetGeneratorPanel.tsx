'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiFeather, FiSave, FiBookOpen, FiCheckCircle, FiSend } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/dashboard/Modal'
import { toast } from '@/lib/toast'
import { STORY_LEVEL_OPTIONS, defaultWorksheetTypeForLevel } from '@/lib/storyLevels'
import type { WorksheetContent, WorksheetType } from '@/lib/worksheetTypes'
import { PictureFillBlankWorksheet } from '@/components/resources/PictureFillBlankWorksheet'
import { ReadingComprehensionWorksheet } from '@/components/resources/ReadingComprehensionWorksheet'

// Adapts StoryGeneratorClient's generate/save/assign lifecycle for
// structured worksheet content -- see app/teacher/story-generator/
// StoryGeneratorClient.tsx for the original this mirrors. Unlike stories,
// worksheets carry no illustration: picture_fillblank uses a curated
// emoji dictionary (lib/tamilVocabEmoji.ts) instead of ComfyUI, and
// reading_comprehension never needed an image at all -- so there's no
// image-generation/poll step here.
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
  const [worksheetType, setWorksheetType] = useState<WorksheetType>(defaultWorksheetTypeForLevel(level))
  const [typeTouched, setTypeTouched] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [worksheet, setWorksheet] = useState<WorksheetContent | null>(null)

  const [savedWorksheetId, setSavedWorksheetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignClassId, setAssignClassId] = useState(classes[0]?.id ?? '')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assignMaxScore, setAssignMaxScore] = useState('100')
  const [assignPenalty, setAssignPenalty] = useState('0')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  function handleLevelChange(newLevel: string) {
    setLevel(newLevel)
    // Once the teacher has manually picked a type, stop overriding it on
    // every level change -- the default is only a starting suggestion.
    if (!typeTouched) setWorksheetType(defaultWorksheetTypeForLevel(newLevel))
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (generating) return

    setGenerating(true)
    setError(null)
    setWorksheet(null)
    setSavedWorksheetId(null)
    setSaveError(null)

    try {
      const res = await fetch('/api/generate-worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, language, level, worksheetType }),
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

  async function handleSaveWorksheet() {
    if (!worksheet || saving) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch('/api/teacher/worksheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, content: worksheet }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSaveError(data.error || 'Failed to save worksheet')
        return
      }

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
        title: worksheet.title || theme,
        worksheetContent: worksheet,
        dueDate: assignDueDate || null,
        maxScore: assignMaxScore,
        pointsDeductionPerDay: assignPenalty,
        published: true,
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
                onChange={(e) => handleLevelChange(e.target.value)}
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

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Worksheet Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setWorksheetType('picture_fillblank')
                  setTypeTouched(true)
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  worksheetType === 'picture_fillblank'
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                Picture Fill-in-the-Blank
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorksheetType('reading_comprehension')
                  setTypeTouched(true)
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  worksheetType === 'reading_comprehension'
                    ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                Reading Comprehension
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Suggested automatically based on the student level -- change it anytime.
            </p>
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
            {worksheet.worksheetType === 'picture_fillblank' ? (
              <PictureFillBlankWorksheet content={worksheet} />
            ) : (
              <ReadingComprehensionWorksheet content={worksheet} />
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

      <Modal open={assignOpen} title={`Assign "${worksheet?.title ?? theme}"`} onClose={() => setAssignOpen(false)}>
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
