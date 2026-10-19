import { notFound } from 'next/navigation'
import { CreateGameWizard } from '@/components/grClassic/teacher/CreateGameWizard'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories } from '@/lib/grClassic/server/db'
import { topicCatalog } from '@/lib/grClassic/server/topics'
import { isUuid } from '@/lib/grClassic/validateQuestion'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Create a game, or edit one with ?edit=<game id>.
// ?type=quiz|match|word-builder opens straight on the Questions step (used
// by the Question Library's "Make a game with these questions").
// The library is too big to send at once: the page gets every topic with
// its question counts, and questions are fetched as they're needed (picked
// by topic, or one page at a time to choose by hand). Read by the server:
// every teacher may read the library. The game being edited is read as the
// teacher (only their own games).
export default async function GrClassicCreatePage({ searchParams }: { searchParams: { edit?: string; type?: string } }) {
  const t = await grcTeacherPage('/gr-classic/teacher/create')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const admin = createAdminClient()
  const [categories, topics] = await Promise.all([listCategories(admin, t.userId), topicCatalog(admin)])
  const edit = searchParams.edit ? (isUuid(searchParams.edit) ? await getGame(t.supabase, searchParams.edit, categoryNames(categories)) : null) : undefined
  if (edit === null) notFound()
  const startType = searchParams.type === 'quiz' || searchParams.type === 'match' || searchParams.type === 'word-builder' ? searchParams.type : undefined
  return <CreateGameWizard edit={edit} topics={topics} categories={categories} startType={startType} />
}
