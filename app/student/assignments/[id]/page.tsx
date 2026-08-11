import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft, FiCalendar } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { SubmissionForm } from './SubmissionForm'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60

export default async function StudentAssignmentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  const { data: assignment } = await supabase
    .from('sms_assignments')
    .select('*, class:sms_classes(id, name)')
    .eq('id', params.id)
    .eq('published', true)
    .single()

  if (!assignment || !student) {
    notFound()
  }

  const { data: grade } = await supabase
    .from('sms_grades')
    .select('score, feedback')
    .eq('assignment_id', assignment.id)
    .eq('student_id', student.id)
    .maybeSingle()

  const { data: submission } = await supabase
    .from('sms_submissions')
    .select('*')
    .eq('assignment_id', assignment.id)
    .eq('student_id', student.id)
    .maybeSingle()

  let fileSignedUrl: string | null = null
  let audioSignedUrl: string | null = null
  if (submission?.file_url) {
    const { data } = await supabase.storage.from('submissions').createSignedUrl(submission.file_url, SIGNED_URL_TTL_SECONDS)
    fileSignedUrl = data?.signedUrl ?? null
  }
  if (submission?.audio_url) {
    const { data } = await supabase.storage.from('submissions').createSignedUrl(submission.audio_url, SIGNED_URL_TTL_SECONDS)
    audioSignedUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/student/assignments"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400"
      >
        <FiArrowLeft className="w-3.5 h-3.5" /> Back to assignments
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400">
          {assignment.class.name}
        </p>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white mt-0.5">{assignment.title}</h1>
        {assignment.description && (
          <p className="text-stone-600 dark:text-stone-300 mt-2">{assignment.description}</p>
        )}
        {assignment.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- teacher-uploaded Storage URL
          <img src={assignment.image_url} alt="" className="max-w-full rounded-xl border border-stone-200 dark:border-stone-800 mt-3" />
        )}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500 dark:text-stone-400">
          {assignment.due_date && (
            <span className="flex items-center gap-1.5">
              <FiCalendar className="w-3.5 h-3.5" /> Due {new Date(assignment.due_date).toLocaleDateString()}
            </span>
          )}
          <span>Out of {assignment.max_score}</span>
        </div>
      </div>

      {grade && grade.score !== null && grade.score !== undefined && (
        <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/40">
          <p className="font-bold text-primary-800 dark:text-primary-300">
            Graded: {grade.score}/{assignment.max_score}
          </p>
          {grade.feedback && <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">{grade.feedback}</p>}
        </div>
      )}

      <SubmissionForm
        assignmentId={assignment.id}
        maxScore={assignment.max_score}
        deductionPerDay={assignment.points_deduction_per_day}
        dueDate={assignment.due_date}
        allowedTypes={assignment.allow_submission_types}
        existingSubmission={
          submission
            ? {
                content: submission.content,
                fileSignedUrl,
                audioSignedUrl,
                submittedAt: submission.submitted_at,
              }
            : null
        }
      />
    </div>
  )
}
