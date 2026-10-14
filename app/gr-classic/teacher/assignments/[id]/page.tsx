import { notFound } from 'next/navigation'
import { AssignmentResults } from '@/components/grClassic/teacher/AssignmentResults'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { assignmentResults } from '@/lib/grClassic/server/teacherAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

export default async function GrClassicResultsPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound()
  const t = await grcTeacherPage(`/gr-classic/teacher/assignments/${params.id}`)
  if (!t.ok) return <TeachersOnly message={t.error} />
  const view = await assignmentResults(t.supabase, params.id, t.userId)
  if (!view) notFound()
  return <AssignmentResults view={view} />
}
