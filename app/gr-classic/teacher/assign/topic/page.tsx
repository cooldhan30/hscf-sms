import { notFound } from 'next/navigation'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { topicCatalog } from '@/lib/grClassic/server/topics'
import { combineTopics, parseTopicPlay } from '@/lib/grClassic/topicPlay'

export const dynamic = 'force-dynamic'

// Assign one or more topics of the question library
// (?topics=id1,id2&type=&count=&seconds=): the usual classes / due date /
// settings form. The questions are drawn when the teacher publishes.
export default async function GrClassicAssignTopicPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = await grcTeacherPage('/gr-classic/teacher/quick')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const parsed = parseTopicPlay(searchParams)
  if (!parsed.ok) notFound()
  const [catalog, classes] = await Promise.all([topicCatalog(t.supabase), teacherClasses(t.supabase)])
  const chosen = parsed.value.topics.map((id) => catalog.find((x) => x.id === id)).filter((x) => x !== undefined)
  const combined = chosen.length === parsed.value.topics.length ? combineTopics(chosen) : null
  const available = combined?.counts[parsed.value.type] ?? 0
  if (!combined || !available) notFound()
  const count = Math.min(parsed.value.count, available)
  return <AssignForm game={{ id: '', title: combined.name, type: parsed.value.type, category: combined.name, questionCount: count }} classes={classes} topic={{ ...parsed.value, count }} />
}
