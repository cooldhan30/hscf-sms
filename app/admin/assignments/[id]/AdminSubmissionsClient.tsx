'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiDownload, FiFileText, FiMusic } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

export interface AdminSubmissionRow {
  id: string
  studentName: string
  content: string | null
  fileSignedUrl: string | null
  audioSignedUrl: string | null
  fileSize: number | null
  audioSize: number | null
  submittedAt: string
  grade: { score: number | null; feedback: string | null } | null
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminSubmissionsClient({
  assignmentId,
  assignmentTitle,
  submissions,
}: {
  assignmentId: string
  assignmentTitle: string
  submissions: AdminSubmissionRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [deletingAssignment, setDeletingAssignment] = useState(false)

  async function handleDeleteSubmission(s: AdminSubmissionRow) {
    const confirmed = await confirm({
      title: `Delete ${s.studentName}'s submission?`,
      description: 'Removes their submitted text/file/audio and any grade/feedback for this assignment. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/submissions/${s.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    // A 404 means it's already gone -- same end state as success.
    if (res.ok || res.status === 404) {
      toast.success('Submission deleted')
      router.refresh()
    } else {
      toast.error(data.error || 'Failed to delete submission')
    }
  }

  async function handleDeleteAssignment() {
    const confirmed = await confirm({
      title: `Delete "${assignmentTitle}"?`,
      description: `This removes the assignment along with all ${submissions.length} student submission${submissions.length === 1 ? '' : 's'} and grades for it. This cannot be undone.`,
      confirmLabel: 'Delete Assignment',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingAssignment(true)
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingAssignment(false)

    // A 404 means it's already gone -- same end state as success.
    if (res.ok || res.status === 404) {
      toast.success('Assignment deleted')
      router.push('/admin/assignments')
    } else {
      toast.error(data.error || 'Failed to delete assignment')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">
          Submissions ({submissions.length})
        </h2>
        <Button
          variant="outline"
          icon={<FiTrash2 />}
          onClick={handleDeleteAssignment}
          disabled={deletingAssignment}
          className="!border-terracotta-600 !text-terracotta-700 dark:!border-terracotta-500 dark:!text-terracotta-400 hover:!bg-terracotta-50 dark:hover:!bg-terracotta-950/40"
        >
          {deletingAssignment ? 'Deleting...' : 'Delete Assignment'}
        </Button>
      </div>

      {submissions.length === 0 ? (
        <EmptyState title="No submissions yet" />
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 dark:text-stone-100">{s.studentName}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                    Submitted {new Date(s.submittedAt).toLocaleString()}
                  </p>

                  {s.content && (
                    <p className="text-sm text-stone-600 dark:text-stone-300 mt-2 whitespace-pre-wrap">{s.content}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    {s.fileSignedUrl && (
                      <a
                        href={s.fileSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
                      >
                        <FiFileText className="w-3.5 h-3.5" /> File ({formatBytes(s.fileSize)})
                      </a>
                    )}
                    {s.audioSignedUrl && (
                      <a
                        href={s.audioSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
                      >
                        <FiMusic className="w-3.5 h-3.5" /> Audio ({formatBytes(s.audioSize)})
                      </a>
                    )}
                  </div>

                  {s.audioSignedUrl && <audio controls src={s.audioSignedUrl} className="w-full mt-2" />}

                  {s.grade && s.grade.score !== null && (
                    <p className="text-sm font-semibold text-primary-700 dark:text-primary-400 mt-2">
                      Graded: {s.grade.score}
                      {s.grade.feedback ? ` — ${s.grade.feedback}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {s.fileSignedUrl && (
                    <a
                      href={s.fileSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg text-stone-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                      aria-label="Download file"
                    >
                      <FiDownload className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteSubmission(s)}
                    className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                    aria-label="Delete submission"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
