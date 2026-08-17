'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { FiUpload, FiPaperclip } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { AudioRecorder } from '@/components/submissions/AudioRecorder'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { previewMaxPoints } from '@/lib/points'
import { toast } from '@/lib/toast'

interface ExistingSubmission {
  content: string | null
  fileSignedUrl: string | null
  audioSignedUrl: string | null
  submittedAt: string
}

export function SubmissionForm({
  assignmentId,
  maxScore,
  deductionPerDay,
  dueDate,
  allowedTypes,
  existingSubmission,
}: {
  assignmentId: string
  maxScore: number
  deductionPerDay: number
  dueDate: string | null
  allowedTypes: string[]
  existingSubmission: ExistingSubmission | null
}) {
  const router = useRouter()
  const { userId } = useAuth()
  const supabase = useSupabaseBrowserClient()

  const [content, setContent] = useState(existingSubmission?.content ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const now = new Date()
  const isOverdue = dueDate ? now > new Date(dueDate) : false
  const decayedMax =
    isOverdue && !existingSubmission && deductionPerDay > 0
      ? previewMaxPoints({ maxScore, deductionPerDay, dueDate, now })
      : null

  async function handleSubmit() {
    if (!userId) return
    if (!content.trim() && !file && !audioBlob && !existingSubmission?.fileSignedUrl && !existingSubmission?.audioSignedUrl) {
      toast.error('Add some text, a file, or a recording before submitting.')
      return
    }

    setSubmitting(true)
    try {
      let filePath: string | undefined
      let audioPath: string | undefined
      let storageProvider: 'supabase' | 'b2' | undefined

      if (file) {
        const result = await uploadFile({ supabase, bucket: 'submissions', file, assignmentId })
        filePath = result.path
        storageProvider = result.provider
      }

      if (audioBlob) {
        const result = await uploadFile({ supabase, bucket: 'submissions', file: audioBlob, assignmentId })
        audioPath = result.path
        storageProvider = result.provider
      }

      const res = await fetch('/api/student/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, content: content.trim() || null, filePath, audioPath, storageProvider }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit')

      toast.success(existingSubmission ? 'Resubmitted.' : 'Submitted.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
      <h2 className="font-bold text-stone-800 dark:text-stone-100">
        {existingSubmission ? 'Your submission' : 'Submit your work'}
      </h2>

      {decayedMax !== null && (
        <p className="text-sm font-semibold text-terracotta-600 dark:text-terracotta-400">
          This is overdue -- submitting now caps your score at {decayedMax}/{maxScore} pts.
        </p>
      )}

      {existingSubmission && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Last submitted {new Date(existingSubmission.submittedAt).toLocaleString()}
        </p>
      )}

      {allowedTypes.includes('text') && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your answer..."
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
      )}

      {allowedTypes.includes('file') && (
        <div>
          {existingSubmission?.fileSignedUrl && !file && (
            <a
              href={existingSubmission.fileSignedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline mb-2"
            >
              <FiPaperclip className="w-3.5 h-3.5" /> View current file
            </a>
          )}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-stone-600 dark:text-stone-300"
          />
        </div>
      )}

      {allowedTypes.includes('audio') && (
        <div className="space-y-2">
          {existingSubmission?.audioSignedUrl && !audioBlob && <AudioPlayer src={existingSubmission.audioSignedUrl} />}
          <AudioRecorder onRecorded={setAudioBlob} />
        </div>
      )}

      <Button type="button" variant="primary" icon={<FiUpload />} disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Submitting...' : existingSubmission ? 'Resubmit' : 'Submit'}
      </Button>
    </div>
  )
}
