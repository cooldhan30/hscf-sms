'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { FiUpload, FiPaperclip, FiCamera } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { AudioRecorder } from '@/components/submissions/AudioRecorder'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage/uploadFile'
import { previewMaxPoints } from '@/lib/points'
import { isPastDueDate } from '@/lib/dates'
import { toast } from '@/lib/toast'

const MAX_PHOTO_BYTES = 20 * 1024 * 1024

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
  // A photo of the homework ('photo' type) is uploaded as the submission's
  // file, so it shares `file` -- this is just its on-screen preview.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])
  const photoOnly = allowedTypes.length === 1 && allowedTypes[0] === 'photo'

  function choosePhoto(picked: File | null) {
    // Phones sometimes report a saved photo with no type, so the
    // extension counts too.
    if (picked && !picked.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(picked.name)) {
      toast.error('Please choose a photo.')
      return
    }
    if (picked && picked.size > MAX_PHOTO_BYTES) {
      toast.error('That photo is too big (over 20MB). Try taking it again.')
      return
    }
    setFile(picked)
    setPhotoPreview(picked ? URL.createObjectURL(picked) : null)
  }

  const now = new Date()
  const isOverdue = dueDate ? isPastDueDate(dueDate, now) : false
  const decayedMax =
    isOverdue && !existingSubmission && deductionPerDay > 0
      ? previewMaxPoints({ maxScore, deductionPerDay, dueDate, now })
      : null

  async function handleSubmit() {
    if (!userId) return
    if (!content.trim() && !file && !audioBlob && !existingSubmission?.fileSignedUrl && !existingSubmission?.audioSignedUrl) {
      toast.error(photoOnly ? 'Add a photo of your homework before submitting.' : 'Add some text, a file, or a recording before submitting.')
      return
    }

    setSubmitting(true)
    try {
      let filePath: string | undefined
      let audioPath: string | undefined
      let fileSize: number | undefined
      let audioSize: number | undefined
      let storageProvider: 'supabase' | 'b2' | undefined

      if (file) {
        const result = await uploadFile({ supabase, bucket: 'submissions', file, assignmentId })
        filePath = result.path
        fileSize = file.size
        storageProvider = result.provider
      }

      if (audioBlob) {
        const result = await uploadFile({ supabase, bucket: 'submissions', file: audioBlob, assignmentId })
        audioPath = result.path
        audioSize = audioBlob.size
        storageProvider = result.provider
      }

      const res = await fetch('/api/student/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          content: content.trim() || null,
          filePath,
          audioPath,
          fileSize,
          audioSize,
          storageProvider,
        }),
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

      {allowedTypes.includes('photo') && (
        <div className="space-y-3">
          <p className="text-sm text-stone-600 dark:text-stone-300">Take a clear photo of your finished homework and upload it here.</p>
          {(photoPreview || existingSubmission?.fileSignedUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview / signed Storage URL
            <img
              src={photoPreview ?? existingSubmission!.fileSignedUrl!}
              alt={photoPreview ? 'Photo you are about to submit' : 'Photo you submitted'}
              className="max-h-80 rounded-xl border border-stone-200 dark:border-stone-800"
            />
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors">
            <FiCamera className="w-4 h-4" />
            {photoPreview || existingSubmission?.fileSignedUrl ? 'Choose a different photo' : 'Add photo'}
            <input type="file" accept="image/*" onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
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
