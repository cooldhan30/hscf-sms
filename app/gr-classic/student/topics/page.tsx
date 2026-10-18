import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { TopicPicker } from '@/components/grClassic/TopicPicker'
import { grcStudentPage } from '@/lib/grClassic/server/studentAssignments'
import { topicCatalog } from '@/lib/grClassic/server/topics'

// Play by topic: a student picks a topic of the question library, how many
// questions and the time per question, and plays on their own. Only topic
// names and question counts are sent here -- never questions or answers.
export default async function GrClassicStudentTopicsPage() {
  const s = await grcStudentPage('/gr-classic/student/topics')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  return <TopicPicker mode="solo" topics={await topicCatalog(s.admin)} />
}
