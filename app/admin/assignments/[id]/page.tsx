import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiCalendar } from 'react-icons/fi'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubmissionSignedUrl } from '@/lib/storage/submissionUrl'
import { formatDateOnly } from '@/lib/dates'
import { AdminSubmissionsClient, type AdminSubmissionRow } from './AdminSubmissionsClient'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60

export default async function AdminAssignmentDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: assignment } = await admin
    .from('sms_assignments')
    .select('*, class:sms_classes(id, name), creator:sms_profiles(first_name, last_name)')
    .eq('id', params.id)
    .single()

  if (!assignment) notFound()

  const [{ data: submissions }, { data: grades }] = await Promise.all([
    admin
      .from('sms_submissions')
      .select('*, student:sms_students(first_name, last_name)')
      .eq('assignment_id', params.id)
      .order('submitted_at', { ascending: false }),
    admin.from('sms_grades').select('student_id, score, feedback').eq('assignment_id', params.id),
  ])

  const gradeByStudent = new Map((grades ?? []).map((g) => [g.student_id, g]))

  const rows: AdminSubmissionRow[] = await Promise.all(
    (submissions ?? []).map(async (s) => ({
      id: s.id,
      studentName: s.student ? `${s.student.first_name} ${s.student.last_name}`.trim() : 'Unknown',
      content: s.content,
      fileSignedUrl: s.file_url ? await getSubmissionSignedUrl(admin, s.file_url, s.storage_provider, SIGNED_URL_TTL_SECONDS) : null,
      audioSignedUrl: s.audio_url ? await getSubmissionSignedUrl(admin, s.audio_url, s.storage_provider, SIGNED_URL_TTL_SECONDS) : null,
      fileSize: s.file_size,
      audioSize: s.audio_size,
      submittedAt: s.submitted_at,
      grade: gradeByStudent.get(s.student_id) ?? null,
    }))
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/assignments"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400"
      >
        <FiArrowLeft className="w-3.5 h-3.5" /> Back to assignments
      </Link>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400">
          {assignment.class?.name ?? 'Unknown class'}
        </p>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white mt-0.5">{assignment.title}</h1>
        {assignment.description && <p className="text-stone-600 dark:text-stone-300 mt-2">{assignment.description}</p>}
        {assignment.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- teacher-uploaded Storage URL
          <img src={assignment.image_url} alt="" className="max-w-full rounded-xl border border-stone-200 dark:border-stone-800 mt-3" />
        )}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500 dark:text-stone-400">
          <span>
            By {assignment.creator ? `${assignment.creator.first_name} ${assignment.creator.last_name}` : 'Unknown'}
          </span>
          {assignment.due_date && (
            <span className="flex items-center gap-1.5">
              <FiCalendar className="w-3.5 h-3.5" /> Due {formatDateOnly(assignment.due_date)}
            </span>
          )}
          <span>Out of {assignment.max_score}</span>
        </div>
      </div>

      <AdminSubmissionsClient assignmentId={assignment.id} assignmentTitle={assignment.title} submissions={rows} />
    </div>
  )
}
