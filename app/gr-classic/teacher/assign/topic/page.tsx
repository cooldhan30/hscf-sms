import { notFound } from 'next/navigation'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { topicCatalog } from '@/lib/grClassic/server/topics'
import { parseTopicPlay } from '@/lib/grClassic/topicPlay'

export const dynamic = 'force-dynamic'

// Assign a topic of the question library (?topic=&type=&count=&seconds=):
// the usual classes / due date / settings form. The questions are drawn
// when the teacher publishes.
export default async function GrClassicAssignTopicPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = await grcTeacherPage('/gr-classic/teacher/quick')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const parsed = parseTopicPlay(searchParams)
  if (!parsed.ok) notFound()
  const [topics, classes] = await Promise.all([topicCatalog(t.supabase), teacherClasses(t.supabase)])
  const topic = topics.find((x) => x.id === parsed.value.topic)
  const available = topic?.counts[parsed.value.type] ?? 0
  if (!topic || !available) notFound()
  const count = Math.min(parsed.value.count, available)
  return <AssignForm game={{ id: '', title: topic.name, type: parsed.value.type, category: topic.name, questionCount: count }} classes={classes} topic={{ ...parsed.value, count }} />
}
