import { TopicPracticeRunner } from '@/components/grClassic/student/TopicPracticeRunner'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { toPlayQuestion } from '@/lib/grClassic/play'
import { grcStudentPage } from '@/lib/grClassic/server/studentAssignments'
import { pickTopicQuestions } from '@/lib/grClassic/server/topics'
import { parseTopicPlay } from '@/lib/grClassic/topicPlay'

export const dynamic = 'force-dynamic'

// A student plays a topic on their own (?topic=&type=&count=&seconds=).
// The server draws the questions at random and sends only the answer-free
// version; answers are checked at /api/gr-classic/practice/topic/*.
export default async function GrClassicTopicPracticePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const s = await grcStudentPage('/gr-classic/student/topics')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  const parsed = parseTopicPlay(searchParams)
  const picked = parsed.ok ? await pickTopicQuestions(s.admin, parsed.value).catch(() => null) : null
  if (!parsed.ok || !picked) return <TeachersOnly who="students" message="That topic game isn’t available. Go back and pick a topic again." />
  return <TopicPracticeRunner title={picked.title} type={parsed.value.type} seconds={parsed.value.seconds} questions={picked.questions.map(toPlayQuestion)} />
}
