import { notFound } from 'next/navigation'
import { CreateGameWizard } from '@/components/grClassic/teacher/CreateGameWizard'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories, listQuestions } from '@/lib/grClassic/server/db'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// Create a game, or edit one with ?edit=<game id>.
// ?type=quiz|match|word-builder opens straight on the Questions step (used
// by the Question Library's "Make a game with these questions").
export default async function GrClassicCreatePage({ searchParams }: { searchParams: { edit?: string; type?: string } }) {
  const t = await grcTeacherPage('/gr-classic/teacher/create')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const categories = await listCategories(t.supabase, t.userId)
  const names = categoryNames(categories)
  const [library, edit] = await Promise.all([
    listQuestions(t.supabase, names, t.userId),
    searchParams.edit ? (isUuid(searchParams.edit) ? getGame(t.supabase, searchParams.edit, names) : Promise.resolve(null)) : Promise.resolve(undefined),
  ])
  if (edit === null) notFound()
  const startType = searchParams.type === 'quiz' || searchParams.type === 'match' || searchParams.type === 'word-builder' ? searchParams.type : undefined
  return <CreateGameWizard edit={edit} library={library} categories={categories} startType={startType} />
}
