import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { TopicPicker } from '@/components/grClassic/TopicPicker'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { topicCatalog } from '@/lib/grClassic/server/topics'

// Quick live game: pick a topic of the shared question library, how many
// questions and the time per question, and start -- no game to build.
export default async function GrClassicQuickGamePage() {
  const t = await grcTeacherPage('/gr-classic/teacher/quick')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const [topics, classes] = await Promise.all([topicCatalog(t.supabase), teacherClasses(t.supabase)])
  return <TopicPicker mode="host" topics={topics} classes={classes} />
}
