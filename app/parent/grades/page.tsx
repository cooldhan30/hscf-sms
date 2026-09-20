import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/dashboard/DataTable'
import { AudioPlayer } from '@/components/submissions/AudioPlayer'
import { getGradeFeedbackSignedUrl } from '@/lib/storage/gradeFeedbackUrl'
import { ChildSelector } from '../ChildSelector'
import { resolveSelectedChildId, type ChildOption } from '../child-utils'
import type { SmsAssignment, SmsClass, SmsGrade } from '@/types/database'

export const dynamic = 'force-dynamic'

type GradeRow = SmsGrade & { assignment: SmsAssignment & { class: Pick<SmsClass, 'id' | 'name'> } }

export default async function ParentGradesPage({ searchParams }: { searchParams: { childId?: string } }) {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: parent } = await supabase.from('sms_parents').select('id').eq('profile_id', userId ?? '').single()

  const { data: links } = await supabase
    .from('sms_student_parents')
    .select('student:sms_students(id, first_name, last_name)')
    .eq('parent_id', parent?.id ?? '')
    .returns<{ student: ChildOption }[]>()

  const children = (links ?? []).map((l) => l.student)
  const childId = resolveSelectedChildId(children, searchParams.childId)

  const { data: grades } = childId
    ? await supabase
        .from('sms_grades')
        .select('*, assignment:sms_assignments!inner(id, title, max_score, class:sms_classes!inner(id, name))')
        .eq('student_id', childId)
        .not('score', 'is', null)
        .order('graded_at', { ascending: false })
        .returns<GradeRow[]>()
    : { data: [] as GradeRow[] }

  // Defensive: a grade whose assignment (or that assignment's class) is
  // invisible under this parent's own RLS-scoped read -- e.g. a
  // still-unpublished assignment a teacher graded before publishing --
  // comes back with a null nested embed rather than an error. Rendering
  // g.assignment.max_score unguarded on that row crashed the whole page
  // (real bug hit in production: 2026-08-09). Filtering those out here
  // means the parent just doesn't see that one row yet, instead of the
  // page dying entirely.
  const all = (grades ?? []).filter((g) => g.assignment && g.assignment.class)

  const audioSignedUrlByGradeId = new Map(
    await Promise.all(
      all
        .filter((g) => g.audio_feedback_url)
        .map(async (g) => [g.id, await getGradeFeedbackSignedUrl(supabase, g.audio_feedback_url!, 3600)] as const)
    )
  )

  const average =
    all.length > 0
      ? (
          all.reduce((sum, g) => sum + ((g.score ?? 0) / g.assignment.max_score) * 100, 0) / all.length
        ).toFixed(1)
      : null

  const columns: DataTableColumn<GradeRow>[] = [
    { header: 'Subject', accessor: (g) => g.assignment.class.name },
    { header: 'Assignment', accessor: (g) => g.assignment.title },
    { header: 'Score', accessor: (g) => `${g.score} / ${g.assignment.max_score}` },
    {
      header: 'Percentage',
      accessor: (g) => `${(((g.score ?? 0) / g.assignment.max_score) * 100).toFixed(1)}%`,
    },
    { header: 'Feedback', accessor: (g) => g.feedback || '—' },
    {
      header: 'Voice Feedback',
      accessor: (g) => {
        const signedUrl = audioSignedUrlByGradeId.get(g.id)
        return signedUrl ? (
          <div className="max-w-[200px]">
            <AudioPlayer src={signedUrl} />
          </div>
        ) : (
          '—'
        )
      },
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Grades</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">Your child&apos;s assignment grades and feedback.</p>
        </div>
        <Suspense fallback={null}>
          <ChildSelector options={children} />
        </Suspense>
      </div>

      {children.length === 0 ? (
        <EmptyState title="No children linked yet" />
      ) : (
        <>
          {average !== null && (
            <div className="p-6 rounded-2xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30">
              <p className="text-4xl font-bold text-primary-800 dark:text-primary-300">{average}%</p>
              <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">Overall average across {all.length} graded assignment{all.length === 1 ? '' : 's'}</p>
            </div>
          )}

          <DataTable columns={columns} rows={all} keyFor={(g) => g.id} emptyTitle="No graded assignments yet" />
        </>
      )}
    </div>
  )
}
