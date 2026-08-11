'use client'

import { useMemo, useState } from 'react'
import { FiSave, FiSend, FiClock, FiMail, FiBell } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { RichTextEditor } from './RichTextEditor'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { SmsAnnouncement, SmsAnnouncementAudience } from '@/types/database'

export interface AnnouncementSubmitPayload {
  title: string
  body: string
  audienceType: SmsAnnouncementAudience
  gradeLevel: string | null
  classIds: string[]
  status: 'draft' | 'published'
  publishAt: string | null
  notifyEmail: boolean
  notifyPush: boolean
}

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
}

const ADMIN_AUDIENCES: { value: SmsAnnouncementAudience; label: string }[] = [
  { value: 'school', label: 'Entire School' },
  { value: 'teachers', label: 'All Teachers' },
  { value: 'parents', label: 'All Parents' },
  { value: 'students', label: 'All Students' },
  { value: 'grade', label: 'Grade' },
  { value: 'class', label: 'Class(es)' },
]

const TEACHER_AUDIENCES: { value: SmsAnnouncementAudience; label: string }[] = [
  { value: 'grade', label: 'My Grade' },
  { value: 'class', label: 'My Class(es)' },
]

export function AnnouncementForm({
  scope,
  classOptions,
  initial,
  onSubmit,
  onDone,
}: {
  scope: 'admin' | 'teacher'
  classOptions: ClassOption[]
  initial?: SmsAnnouncement & { classIds?: string[] }
  onSubmit: (payload: AnnouncementSubmitPayload) => Promise<{ error?: string } | void>
  onDone?: () => void
}) {
  const audiences = scope === 'admin' ? ADMIN_AUDIENCES : TEACHER_AUDIENCES

  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [audienceType, setAudienceType] = useState<SmsAnnouncementAudience>(initial?.audience_type ?? audiences[0].value)
  const [gradeLevel, setGradeLevel] = useState(initial?.grade_level ?? '')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(initial?.classIds ?? [])
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(initial?.publish_at))
  const [publishAt, setPublishAt] = useState(
    initial?.publish_at ? new Date(initial.publish_at).toISOString().slice(0, 16) : ''
  )
  const [notifyEmail, setNotifyEmail] = useState(initial?.notify_email ?? false)
  const [notifyPush, setNotifyPush] = useState(initial?.notify_push ?? false)
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const gradeOptions = useMemo(() => {
    if (scope === 'admin') return GRADE_LEVEL_OPTIONS
    const levels = new Set(classOptions.map((c) => c.grade_level).filter(Boolean) as string[])
    return GRADE_LEVEL_OPTIONS.filter((g) => levels.has(g.value))
  }, [scope, classOptions])

  function toggleClass(id: string) {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  async function handleSubmit(action: 'draft' | 'publish') {
    setError(null)

    if (!title.trim() || !body.trim() || body === '<p></p>') {
      setError('Title and message are required')
      return
    }
    if (audienceType === 'grade' && !gradeLevel) {
      setError('Select a grade level')
      return
    }
    if (audienceType === 'class' && selectedClassIds.length === 0) {
      setError('Select at least one class')
      return
    }
    if (action === 'publish' && scheduleEnabled && !publishAt) {
      setError('Pick a date/time to schedule for, or turn off scheduling')
      return
    }

    setSaving(action)

    const result = await onSubmit({
      title: title.trim(),
      body,
      audienceType,
      gradeLevel: audienceType === 'grade' ? gradeLevel : null,
      classIds: audienceType === 'class' ? selectedClassIds : [],
      status: action === 'draft' ? 'draft' : 'published',
      publishAt: action === 'publish' && scheduleEnabled && publishAt ? new Date(publishAt).toISOString() : null,
      notifyEmail,
      notifyPush,
    })

    setSaving(null)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      return
    }

    onDone?.()
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="announcement-title" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
          Title <span className="text-terracotta-600 dark:text-terracotta-400">*</span>
        </label>
        <input
          id="announcement-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-invalid={!!error && !title.trim()}
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Message</label>
        <RichTextEditor value={body} onChange={setBody} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Audience</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {audiences.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudienceType(a.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                audienceType === a.value
                  ? 'bg-primary-800 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {audienceType === 'grade' && (
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          >
            <option value="">Select a grade level...</option>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        )}

        {audienceType === 'class' && (
          <div className="flex flex-wrap gap-2">
            {classOptions.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                  selectedClassIds.includes(c.id)
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedClassIds.includes(c.id)}
                  onChange={() => toggleClass(c.id)}
                  className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-600"
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg border border-stone-200 dark:border-stone-800 space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600"
          />
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <FiClock className="w-4 h-4" /> Schedule for later
          </span>
        </label>
        {scheduleEnabled && (
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        )}

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-600"
            />
            <FiMail className="w-3.5 h-3.5" /> Email notification
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={notifyPush}
              onChange={(e) => setNotifyPush(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-600"
            />
            <FiBell className="w-3.5 h-3.5" /> Push notification
          </label>
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Notifications are queued for delivery once email/push is configured for this school -- they don&apos;t send yet.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          icon={<FiSave />}
          disabled={saving !== null}
          onClick={() => handleSubmit('draft')}
        >
          {saving === 'draft' ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button
          variant="primary"
          icon={scheduleEnabled ? <FiClock /> : <FiSend />}
          disabled={saving !== null}
          onClick={() => handleSubmit('publish')}
        >
          {saving === 'publish' ? 'Saving...' : scheduleEnabled ? 'Schedule' : 'Publish Now'}
        </Button>
      </div>
    </div>
  )
}
