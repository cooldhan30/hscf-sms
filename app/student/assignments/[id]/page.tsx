import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft, FiCalendar, FiExternalLink } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { getSubmissionSignedUrl } from '@/lib/storage/submissionUrl'
import { getGradeFeedbackSignedUrl } from '@/lib/storage/gradeFeedbackUrl'
import { formatDateOnly } from '@/lib/dates'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { SubmissionForm } from './SubmissionForm'
import { extractYouTubeId, youTubeEmbedUrl } from '@/lib/youtube'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60

export default async function StudentAssignmentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  const { data: assignment } = await supabase
    .from('sms_assignments')
    .select('*, class:sms_classes!inner(id, name)')
    .eq('id', params.id)
    .eq('published', true)
    .single()

  if (!assignment || !student) {
    notFound()
  }

  const { data: grade } = await supabase
    .from('sms_grades')
    .select('score, feedback, audio_feedback_url')
    .eq('assignment_id', assignment.id)
    .eq('student_id', student.id)
    .maybeSingle()

  const gradeAudioSignedUrl = grade?.audio_feedback_url
    ? await getGradeFeedbackSignedUrl(supabase, grade.audio_feedback_url, SIGNED_URL_TTL_SECONDS)
    : null

  const { data: submission } = await supabase
    .from('sms_submissions')
    .select('*')
    .eq('assignment_id', assignment.id)
    .eq('student_id', student.id)
    .maybeSingle()

  // A resource-linked assignment (see 044) is displayed above the normal
  // SubmissionForm -- allow_submission_types is forced to ['audio'] for
  // these at assign time, so the form itself just becomes "record
  // yourself reading this" with no extra branching needed here.
  const { data: resource } = assignment.resource_id
    ? await supabase.from('sms_resources').select('*').eq('id', assignment.resource_id).single()
    : { data: null }

  let fileSignedUrl: string | null = null
  let audioSignedUrl: string | null = null
  if (submission?.file_url) {
    fileSignedUrl = await getSubmissionSignedUrl(supabase, submission.file_url, submission.storage_provider, SIGNED_URL_TTL_SECONDS)
  }
  if (submission?.audio_url) {
    audioSignedUrl = await getSubmissionSignedUrl(supabase, submission.audio_url, submission.storage_provider, SIGNED_URL_TTL_SECONDS)
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

        {resource && (
          <div className="mt-3 p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40">
            {['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((resource.file_type ?? '').toLowerCase()) && (
              // eslint-disable-next-line @next/next/no-img-element -- resource preview, arbitrary Storage URL
              <img
                src={resource.file_url}
                alt=""
                className="max-w-full max-h-[32rem] rounded-lg border border-stone-200 dark:border-stone-800 mb-3"
              />
            )}
            {resource.file_type === 'youtube' && extractYouTubeId(resource.file_url) && (
              <iframe
                src={youTubeEmbedUrl(extractYouTubeId(resource.file_url)!)}
                className="w-full aspect-video rounded-lg border border-stone-200 dark:border-stone-800 mb-3"
                title={resource.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
            <p className="font-semibold text-stone-800 dark:text-stone-100">{resource.title}</p>
            {resource.description && (
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{resource.description}</p>
            )}
            {resource.file_type !== 'youtube' && (
              <a
                href={resource.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline mt-2"
              >
                <FiExternalLink className="w-3.5 h-3.5" />{' '}
                {resource.file_type === 'link' ? 'Open link' : `Open ${resource.file_type ? `.${resource.file_type}` : 'file'}`}
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500 dark:text-stone-400">
          {assignment.due_date && (
            <span className="flex items-center gap-1.5">
              <FiCalendar className="w-3.5 h-3.5" /> Due {formatDateOnly(assignment.due_date)}
            </span>
          )}
          <span>Out of {assignment.max_score}</span>
        </div>
      </div>

      {grade && grade.score !== null && grade.score !== undefined && (
        <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/40 space-y-2">
          <p className="font-bold text-primary-800 dark:text-primary-300">
            Graded: {grade.score}/{assignment.max_score}
          </p>
          {grade.feedback && <p className="text-sm text-primary-700 dark:text-primary-400">{grade.feedback}</p>}
          {gradeAudioSignedUrl && (
            <div>
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 mb-1">Voice feedback</p>
              <AudioPlayer src={gradeAudioSignedUrl} />
            </div>
          )}
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
