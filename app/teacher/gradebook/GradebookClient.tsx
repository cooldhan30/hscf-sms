'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FiSave, FiSearch, FiFileText, FiPaperclip, FiImage, FiMic, FiType, FiTrash2 } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Modal } from '@/components/dashboard/Modal'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { AudioRecorder } from '@/components/submissions/AudioRecorder'
import { previewMaxPoints } from '@/lib/points'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { toast } from '@/lib/toast'

interface ClassOption {
  id: string
  name: string
}

interface AssignmentOption {
  id: string
  class_id: string
  title: string
  max_score: number
  due_date: string | null
  points_deduction_per_day: number
}

interface RosterStudent {
  id: string
  first_name: string
  last_name: string
}

interface GradeRecord {
  student_id: string
  score: number | null
  feedback: string | null
  audio_feedback_url: string | null
  audioFeedbackSignedUrl: string | null
}

// Per-student audio feedback state, tracked alongside `entries`
// (score/feedback text). `path` round-trips on every save (see
// app/api/teacher/grades/route.ts's POST comment) so an untouched
// student's existing audio survives a bulk "Save Grades" that only
// changed OTHER students. `signedUrl` is only for local playback in
// this session (never persisted) -- refreshed after a new recording
// upload, or cleared to null immediately for "removed" without waiting
// on a reload.
interface AudioFeedbackState {
  path: string | null
  signedUrl: string | null
}

interface SubmissionRecord {
  student_id: string
  content: string | null
  file_url: string | null
  submitted_at: string
  fileSignedUrl: string | null
  audioSignedUrl: string | null
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic'])

// file_url is the raw storage path (userId/assignmentId/timestamp-original-name.ext)
// -- original filename and extension survive from the student's own
// upload, so this is enough to tell an image submission apart from any
// other file type without needing to fetch/sniff content.
function isImagePath(path: string | null): boolean {
  if (!path) return false
  const ext = path.split('.').pop()?.toLowerCase()
  return Boolean(ext && IMAGE_EXTENSIONS.has(ext))
}

export function GradebookClient({
  classes,
  assignments,
}: {
  classes: ClassOption[]
  assignments: AssignmentOption[]
}) {
  const searchParams = useSearchParams()
  const requestedClassId = searchParams.get('classId')
  const [classId, setClassId] = useState(
    requestedClassId && classes.some((c) => c.id === requestedClassId) ? requestedClassId : classes[0]?.id ?? ''
  )
  const classAssignments = useMemo(() => assignments.filter((a) => a.class_id === classId), [assignments, classId])
  const [assignmentId, setAssignmentId] = useState(classAssignments[0]?.id ?? '')
  const [studentSearch, setStudentSearch] = useState('')

  const supabase = useSupabaseBrowserClient()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [entries, setEntries] = useState<Record<string, { score: string; feedback: string }>>({})
  const [audioFeedback, setAudioFeedback] = useState<Record<string, AudioFeedbackState>>({})
  const [submissions, setSubmissions] = useState<Record<string, SubmissionRecord>>({})
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null)
  const [recordingForStudentId, setRecordingForStudentId] = useState<string | null>(null)
  const [uploadingAudioFor, setUploadingAudioFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    const first = assignments.filter((a) => a.class_id === classId)[0]
    setAssignmentId(first?.id ?? '')
  }, [classId, assignments])

  const currentAssignment = assignments.find((a) => a.id === assignmentId)

  useEffect(() => {
    if (!classId || !assignmentId) {
      setRoster([])
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setSavedMessage(null)
      const res = await fetch(`/api/teacher/grades?classId=${classId}&assignmentId=${assignmentId}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Failed to load gradebook')
        return
      }

      setRoster(data.roster ?? [])
      const initial: Record<string, { score: string; feedback: string }> = {}
      for (const s of data.roster ?? []) {
        const existing = (data.grades ?? []).find((g: GradeRecord) => g.student_id === s.id)
        initial[s.id] = {
          score: existing?.score === null || existing?.score === undefined ? '' : String(existing.score),
          feedback: existing?.feedback ?? '',
        }
      }
      setEntries(initial)

      const initialAudio: Record<string, AudioFeedbackState> = {}
      for (const s of data.roster ?? []) {
        const existing = (data.grades ?? []).find((g: GradeRecord) => g.student_id === s.id)
        initialAudio[s.id] = {
          path: existing?.audio_feedback_url ?? null,
          signedUrl: existing?.audioFeedbackSignedUrl ?? null,
        }
      }
      setAudioFeedback(initialAudio)

      const submissionMap: Record<string, SubmissionRecord> = {}
      for (const sub of data.submissions ?? []) {
        submissionMap[sub.student_id] = sub
      }
      setSubmissions(submissionMap)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [classId, assignmentId])

  const visibleRoster = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q))
  }, [roster, studentSearch])

  function percentageFor(studentId: string): string {
    const score = entries[studentId]?.score
    if (!currentAssignment || score === '' || score === undefined) return '—'
    const pct = (Number(score) / currentAssignment.max_score) * 100
    if (Number.isNaN(pct)) return '—'
    return `${pct.toFixed(1)}%`
  }

  async function saveAll() {
    if (!assignmentId) return
    setSaving(true)
    setError(null)
    setSavedMessage(null)

    const records = roster.map((s) => ({
      studentId: s.id,
      score: entries[s.id]?.score ?? '',
      feedback: entries[s.id]?.feedback ?? '',
      audioFeedbackPath: audioFeedback[s.id]?.path ?? null,
    }))

    const res = await fetch('/api/teacher/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, records }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Failed to save grades')
      return
    }

    setSavedMessage('Grades saved.')
  }

  // Uploads the moment recording stops (same "attach immediately, no
  // separate confirm step" behavior as the student's own submission
  // recorder -- see AudioRecorder.tsx's comment on the bug that caused:
  // a teacher who records feedback and then clicks Save Grades right
  // away, without a round trip through some other "attach" button
  // first, must not have the recording silently dropped). Persisted to
  // the grade only once "Save Grades" is clicked, same as score/text
  // feedback -- this just gets the file into Storage and the row's
  // local state updated so the save has a path to send.
  //
  // The modal stays open afterwards so the teacher can listen back and
  // re-record before clicking Done; Re-record (blob = null) drops the
  // previous take so what's attached always matches what they last heard.
  async function handleAudioRecorded(studentId: string, blob: Blob | null) {
    if (!blob) {
      removeAudioFeedback(studentId)
      return
    }
    if (!assignmentId) return
    setUploadingAudioFor(studentId)
    try {
      const { path } = await uploadFile({ supabase, bucket: 'grade-feedback', file: blob, assignmentId })
      setAudioFeedback((prev) => ({ ...prev, [studentId]: { path, signedUrl: URL.createObjectURL(blob) } }))
    } catch {
      toast.error('Failed to upload audio feedback')
    } finally {
      setUploadingAudioFor(null)
    }
  }

  function removeAudioFeedback(studentId: string) {
    setAudioFeedback((prev) => ({ ...prev, [studentId]: { path: null, signedUrl: null } }))
  }

  if (classes.length === 0) {
    return <EmptyState title="No classes assigned" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          disabled={classAssignments.length === 0}
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-60"
        >
          {classAssignments.length === 0 ? (
            <option>No assignments in this class</option>
          ) : (
            classAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} (out of {a.max_score})
              </option>
            ))
          )}
        </select>
      </div>

      {assignmentId && (
        <div className="relative max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Filter by student..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {savedMessage && (
        <p className="text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900 rounded-lg px-3 py-2">
          {savedMessage}
        </p>
      )}

      {!assignmentId ? (
        <EmptyState title="No assignments for this class yet" description="Create one from the Assignments page." />
      ) : loading ? (
        <SkeletonTable rows={8} columns={5} />
      ) : visibleRoster.length === 0 ? (
        <EmptyState title="No students match" />
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3">Student</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3">
                  Score (of {currentAssignment?.max_score})
                </th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3">Percentage</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3">Feedback</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-3">Submission</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoster.map((s) => {
                const submission = submissions[s.id]
                const decayedMax =
                  submission && currentAssignment?.due_date && currentAssignment.points_deduction_per_day > 0
                    ? previewMaxPoints({
                        maxScore: currentAssignment.max_score,
                        deductionPerDay: currentAssignment.points_deduction_per_day,
                        dueDate: currentAssignment.due_date,
                        now: new Date(submission.submitted_at),
                      })
                    : null
                return (
                  <tr key={s.id} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-100 whitespace-nowrap">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={currentAssignment?.max_score}
                        value={entries[s.id]?.score ?? ''}
                        onChange={(e) =>
                          setEntries((prev) => ({ ...prev, [s.id]: { ...prev[s.id], score: e.target.value } }))
                        }
                        className="w-24 px-2 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                      />
                      {decayedMax !== null && decayedMax < currentAssignment!.max_score && (
                        <p className="text-xs text-terracotta-600 dark:text-terracotta-400 mt-1">
                          Late: max {decayedMax}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200">{percentageFor(s.id)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entries[s.id]?.feedback ?? ''}
                        onChange={(e) =>
                          setEntries((prev) => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))
                        }
                        className="w-full min-w-[180px] px-2 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                      />
                      <div className="mt-1.5">
                        {audioFeedback[s.id]?.signedUrl ? (
                          <div className="flex items-center gap-2">
                            <div className="max-w-[200px]">
                              <AudioPlayer src={audioFeedback[s.id]!.signedUrl!} />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAudioFeedback(s.id)}
                              className="p-1 rounded text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40"
                              aria-label="Remove audio feedback"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRecordingForStudentId(s.id)}
                            disabled={uploadingAudioFor === s.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline disabled:opacity-50"
                          >
                            <FiMic className="w-3.5 h-3.5" />
                            {uploadingAudioFor === s.id ? 'Uploading...' : 'Record voice feedback'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {submission ? (
                        <button
                          type="button"
                          onClick={() => setViewingStudentId(s.id)}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
                        >
                          <FiFileText className="w-3.5 h-3.5" /> View
                          <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-600 font-normal">
                            {submission.content && (
                              <span title="Text">
                                <FiType className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {submission.fileSignedUrl && (
                              <span title={isImagePath(submission.file_url) ? 'Image' : 'File'}>
                                {isImagePath(submission.file_url) ? (
                                  <FiImage className="w-3.5 h-3.5" />
                                ) : (
                                  <FiPaperclip className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}
                            {submission.audioSignedUrl && (
                              <span title="Audio">
                                <FiMic className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400 dark:text-stone-600">None</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {assignmentId && roster.length > 0 && (
        <Button variant="primary" icon={<FiSave />} disabled={saving} onClick={saveAll}>
          {saving ? 'Saving...' : 'Save Grades'}
        </Button>
      )}

      <Modal
        open={viewingStudentId !== null}
        title={
          viewingStudentId
            ? `${roster.find((s) => s.id === viewingStudentId)?.first_name ?? ''}'s submission`
            : 'Submission'
        }
        onClose={() => setViewingStudentId(null)}
      >
        {viewingStudentId && submissions[viewingStudentId] && (
          <div className="space-y-4">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Submitted {new Date(submissions[viewingStudentId].submitted_at).toLocaleString()}
            </p>
            {submissions[viewingStudentId].content && (
              <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
                {submissions[viewingStudentId].content}
              </p>
            )}
            {submissions[viewingStudentId].fileSignedUrl && isImagePath(submissions[viewingStudentId].file_url) && (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not worth Next/Image's remote-pattern config
              <img
                src={submissions[viewingStudentId].fileSignedUrl!}
                alt="Submitted image"
                className="max-w-full rounded-xl border border-stone-200 dark:border-stone-800"
              />
            )}
            {submissions[viewingStudentId].fileSignedUrl && (
              <a
                href={submissions[viewingStudentId].fileSignedUrl!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
              >
                <FiPaperclip className="w-3.5 h-3.5" />
                {isImagePath(submissions[viewingStudentId].file_url) ? 'Open image full size' : 'View attached file'}
              </a>
            )}
            {submissions[viewingStudentId].audioSignedUrl && (
              <AudioPlayer src={submissions[viewingStudentId].audioSignedUrl!} />
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={recordingForStudentId !== null}
        title={
          recordingForStudentId
            ? `Record feedback for ${roster.find((s) => s.id === recordingForStudentId)?.first_name ?? ''}`
            : 'Record feedback'
        }
        onClose={() => setRecordingForStudentId(null)}
      >
        {recordingForStudentId && (
          <div className="space-y-4">
            <AudioRecorder
              attachedLabel="Attached to this student's grade"
              onRecorded={(blob) => handleAudioRecorded(recordingForStudentId, blob)}
            />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Listen back before you finish. Students only get it after you click Save Grades.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                disabled={uploadingAudioFor === recordingForStudentId}
                onClick={() => setRecordingForStudentId(null)}
              >
                {uploadingAudioFor === recordingForStudentId ? 'Uploading...' : 'Done'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
